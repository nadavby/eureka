import { IItem } from "../models/item_model";
import geminiService from "./gemini-service";
import { shouldSkipComparison } from "./matching-service";
import { logger } from "../lib/logger";

const MIN_SCORE = 70;

/** Asks Gemini to score each plausible lost/found pair and returns the strong matches, best first. */
export const AIMatchingService = async (
  targetItem: IItem,
  potentialMatches: IItem[]
): Promise<{ item: IItem; confidenceScore: number }[]> => {
  const matches: { item: IItem; confidenceScore: number }[] = [];
  logger.debug({ itemType: targetItem.itemType, candidates: potentialMatches.length }, "Starting match analysis");

  for (const potentialMatch of potentialMatches) {
    try {
      const lostItem = targetItem.itemType === "lost" ? targetItem : potentialMatch;
      const foundItem = targetItem.itemType === "found" ? targetItem : potentialMatch;
      if (shouldSkipComparison(lostItem, foundItem)) continue;

      const { confidenceScore } = await geminiService.evaluateMatch(lostItem, foundItem);
      logger.debug({ lostItemId: lostItem._id, foundItemId: foundItem._id, confidenceScore }, "Pair evaluated");
      if (confidenceScore >= MIN_SCORE) matches.push({ item: potentialMatch, confidenceScore });
    } catch (err) {
      logger.warn({ err, candidateId: potentialMatch._id }, "Failed to evaluate candidate");
    }
  }

  return matches.sort((a, b) => b.confidenceScore - a.confidenceScore);
};
