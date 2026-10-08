import itemModel, { IItem } from "../models/item_model";
import matchModel, { pairKeyOf } from "../models/match_model";
import notificationModel from "../models/notification_model";
import { logger } from "../lib/logger";
import { RescheduleError } from "../jobs/job-queue";
import { AiClient } from "./ai-client";
import { CandidateSearch } from "./candidate-search";
import { embedItem } from "./embedding";
import { AiDisabledError, AiQuotaError } from "./errors";
import { ImageData } from "./image-loader";
import { analyzeItem } from "./item-analysis";
import { isPlausiblePair } from "./prefilter";
import { scorePair } from "./rerank";
import { MatchableItem, MatchingStatus, PairVerdict } from "./types";

export interface PipelineDeps {
  ai: AiClient;
  search: CandidateSearch;
  loadImage: (url: string) => Promise<ImageData>;
  enqueue: (job: string, data: Record<string, unknown>) => Promise<unknown>;
  emitToUser: (userId: string, event: string, payload: unknown) => void;
  settings: {
    radiusKm: number;
    threshold: number;
    /** nearest neighbours fetched from vector search */
    candidateLimit: number;
    /** how many survivors of the rules get the expensive AI comparison */
    rerankLimit: number;
  };
}

type ItemDoc = IItem & { _id: unknown };

const asMatchable = (item: ItemDoc): MatchableItem => ({
  _id: String(item._id),
  itemType: item.itemType,
  category: item.category,
  date: item.date,
  location: item.location,
  isResolved: item.isResolved,
});

export const USER_FACING_FAILURE = "Matching failed, please try again later";

export const createPipeline = (deps: PipelineDeps) => {
  const setStatus = async (item: ItemDoc, status: MatchingStatus, extra: Partial<IItem> = {}) => {
    await itemModel.updateOne({ _id: item._id }, { matchingStatus: status, ...extra });
    deps.emitToUser(item.userId, "item_status", {
      itemId: String(item._id),
      status,
      matchCount: extra.matchCount ?? item.matchCount ?? 0,
    });
  };

  const notify = async (userId: string, matchId: string, itemType: string) => {
    const notification = await notificationModel.create({
      type: "MATCH_FOUND",
      title: "Potential Match Found!",
      message: `We found a potential match for your ${itemType} item!`,
      userId,
      matchId,
      isRead: false,
    });
    deps.emitToUser(userId, "match_notification", notification.toJSON());
  };

  /** Creates the match once per pair (unique pairKey) and notifies both owners only the first time. */
  const recordMatch = async (newItem: ItemDoc, existing: ItemDoc, verdict: PairVerdict) => {
    const pairKey = pairKeyOf(String(newItem._id), String(existing._id));
    const result = await matchModel.findOneAndUpdate(
      { pairKey },
      {
        $setOnInsert: {
          item1Id: String(existing._id),
          userId1: existing.userId,
          item2Id: String(newItem._id),
          userId2: newItem.userId,
          pairKey,
          user1Confirmed: false,
          user2Confirmed: false,
        },
        $set: { matchScore: verdict.score, verdict: verdict.verdict, reasons: verdict.reasons, conflicts: verdict.conflicts },
      },
      { upsert: true, new: true, includeResultMetadata: true }
    );
    const created = !result.lastErrorObject?.updatedExisting;
    if (created && result.value) {
      const matchId = result.value._id.toString();
      await notify(existing.userId, matchId, existing.itemType);
      await notify(newItem.userId, matchId, newItem.itemType);
      logger.info({ matchId, score: verdict.score }, "Match created");
    }
  };

  const countMatches = (itemId: string) =>
    matchModel.countDocuments({ $or: [{ item1Id: itemId }, { item2Id: itemId }] });

  /** Step 1: extract attributes and compute the multimodal embedding. */
  const analyze = async (itemId: string) => {
    const item = await itemModel.findById(itemId).lean<ItemDoc>();
    if (!item || item.isResolved) return;

    const image = await deps.loadImage(item.imageUrl);
    const attributes = await analyzeItem(deps.ai, image, item);
    const embedding = await embedItem(deps.ai, image, { ...item, attributes });

    await itemModel.updateOne({ _id: itemId }, { attributes, embedding });
    await setStatus(item, "searching");
    await deps.enqueue("find-matches", { itemId });
  };

  /** Step 2: vector search, rule filter, AI rerank of the best few, record matches. */
  const findMatches = async (itemId: string) => {
    const item = await itemModel.findById(itemId).select("+embedding").lean<ItemDoc>();
    if (!item || item.isResolved || !item.embedding?.length) return;

    const { radiusKm, threshold, candidateLimit, rerankLimit } = deps.settings;
    const candidates = await deps.search.find(
      { _id: itemId, itemType: item.itemType, category: item.category, embedding: item.embedding },
      candidateLimit
    );
    const plausible = candidates
      .filter((c) => isPlausiblePair(asMatchable(item), asMatchable(c.item), { radiusKm }))
      .slice(0, rerankLimit);

    // Sequential on purpose: the free tier allows only a few AI calls per minute.
    const ownImage = plausible.length ? await deps.loadImage(item.imageUrl) : null;
    for (const candidate of plausible) {
      const [lost, found] =
        item.itemType === "lost"
          ? [{ item, image: ownImage! }, { item: candidate.item, image: await deps.loadImage(candidate.item.imageUrl) }]
          : [{ item: candidate.item, image: await deps.loadImage(candidate.item.imageUrl) }, { item, image: ownImage! }];
      const verdict = await scorePair(deps.ai, lost, found);
      logger.debug({ itemId, candidateId: candidate.item._id, similarity: candidate.similarity, score: verdict.score }, "Pair scored");
      if (verdict.score >= threshold) {
        await recordMatch(item, candidate.item, verdict);
        await itemModel.updateOne({ _id: candidate.item._id }, { matchCount: await countMatches(candidate.item._id) });
      }
    }

    await setStatus(item, "done", { matchCount: await countMatches(itemId) });
  };

  const markFailed = async (itemId: string, message: string) => {
    const item = await itemModel.findById(itemId).lean<ItemDoc>();
    if (item) await setStatus(item, "failed", { matchingError: message });
  };

  /** Maps AI errors to queue behaviour: disabled fails at once, quota waits, the rest retries. */
  const guarded = (step: (itemId: string) => Promise<void>) => async (data: { itemId: string }) => {
    try {
      await step(data.itemId);
    } catch (err) {
      if (err instanceof AiQuotaError) throw new RescheduleError(err.retryAfterMs);
      if (err instanceof AiDisabledError) {
        await markFailed(data.itemId, err.message);
        return;
      }
      throw err;
    }
  };

  return {
    analyzeItem: guarded(analyze),
    findMatches: guarded(findMatches),
    onFailed: (data: { itemId: string }) => markFailed(data.itemId, USER_FACING_FAILURE),
  };
};
