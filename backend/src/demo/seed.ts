import fs from "fs/promises";
import path from "path";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import sharp from "sharp";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import matchModel from "../models/match_model";
import jobModel from "../models/job_model";
import demoTemplateModel from "../models/demo_template_model";
import { JobQueue } from "../jobs/job-queue";
import { ANALYZE_ITEM, MatchingOverrides, registerMatchingJobs } from "../matching";
import { processImage } from "../images/process-image";
import { ImageStorage, imageStorage } from "../images/storage";
import { logger } from "../lib/logger";
import { purgeUsers } from "./cleanup";
import { BOTS, ITEMS, SCENARIO } from "./seed-data";

const IMAGES_DIR = path.resolve(__dirname, "../../demo/images");
const DAY = 24 * 60 * 60 * 1000;

const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

/** Rasterises an illustration and stores it like any upload (re-encoded WebP, no metadata). */
const storeIllustration = async (storage: ImageStorage, file: string) => {
  const png = await sharp(await fs.readFile(path.join(IMAGES_DIR, file)), { density: 220 }).resize(1200).png().toBuffer();
  const { buffer } = await processImage(png);
  return storage.save(buffer, "items");
};

/** Runs every queued matching job to completion, waiting out AI rate limits (free tier). */
const runQueue = async (queue: JobQueue) => {
  for (;;) {
    await queue.drain();
    const pending = await jobModel.findOne({ status: { $in: ["queued", "running"] } }).sort({ runAt: 1 });
    if (!pending) return;
    const wait = Math.max(500, pending.runAt.getTime() - Date.now());
    logger.info({ waitMs: wait }, "Waiting for rate-limited AI jobs");
    await new Promise((r) => setTimeout(r, wait));
  }
};

export interface SeedOptions {
  storage?: ImageStorage;
  matching?: MatchingOverrides;
}

/**
 * Rebuilds the demo world from scratch: removes every demo account (bots and visitors) with
 * everything they own, then creates the bots, their public items (analysed by the real matching
 * pipeline, so visitor uploads can match them) and the template for visitor scenarios.
 * Only demo data is touched.
 */
export const seedDemo = async ({ storage = imageStorage, matching }: SeedOptions = {}) => {
  const existing = await userModel.find({ demoRole: { $exists: true } }, { _id: 1 });
  const purged = await purgeUsers(existing.map((u) => u._id.toString()), storage);
  const oldTemplates = await demoTemplateModel.find().lean();
  for (const t of oldTemplates) {
    for (const url of [t.lost.imageUrl, t.found.imageUrl]) {
      const id = t.imageIds?.[url];
      if (id) await storage.remove(id).catch(() => undefined);
    }
  }
  await demoTemplateModel.deleteMany({});

  const bots = new Map<string, string>();
  for (const bot of BOTS) {
    const user = await userModel.create({
      email: `bot-${bot.key}@demo.eureka`,
      password: await bcrypt.hash(randomUUID(), 10),
      userName: bot.userName,
      phoneNumber: bot.phoneNumber,
      demoRole: "seed",
    });
    bots.set(bot.key, user._id.toString());
  }

  const queue = new JobQueue({ workerId: "demo-seed", baseBackoffMs: 2000 });
  registerMatchingJobs(queue, matching);

  for (const seed of ITEMS) {
    const image = await storeIllustration(storage, seed.image);
    const item = await itemModel.create({
      userId: bots.get(seed.owner)!,
      itemType: seed.itemType,
      category: seed.category,
      colors: seed.colors,
      brand: seed.brand,
      description: seed.description,
      placeName: seed.placeName,
      location: seed.location,
      date: daysAgo(seed.daysAgo),
      imageUrl: image.url,
      imagePublicId: image.publicId,
      matchingStatus: "analyzing",
    });
    await queue.enqueue(ANALYZE_ITEM, { itemId: item._id.toString() });
  }
  await runQueue(queue);

  // Bots don't need matches among themselves; the demo is about the visitor.
  const botIds = [...bots.values()];
  await matchModel.deleteMany({ userId1: { $in: botIds }, userId2: { $in: botIds } });
  await itemModel.updateMany({ userId: { $in: botIds } }, { matchCount: 0 });

  const [lostImage, foundImage] = await Promise.all([
    storeIllustration(storage, SCENARIO.lost.image),
    storeIllustration(storage, SCENARIO.found.image),
  ]);
  const side = (s: typeof SCENARIO.lost, imageUrl: string) => ({
    imageUrl,
    category: s.category,
    colors: s.colors,
    description: s.description,
    placeName: s.placeName,
    location: s.location,
    date: daysAgo(s.daysAgo),
  });
  await demoTemplateModel.create({
    botId: bots.get(SCENARIO.bot)!,
    score: SCENARIO.score,
    reasons: SCENARIO.reasons,
    conflicts: SCENARIO.conflicts,
    firstMessage: SCENARIO.firstMessage,
    botReply: SCENARIO.botReply,
    lost: side(SCENARIO.lost, lostImage.url),
    found: side(SCENARIO.found, foundImage.url),
    imageIds: { [lostImage.url]: lostImage.publicId, [foundImage.url]: foundImage.publicId },
  });

  const analysed = await itemModel.countDocuments({ userId: { $in: botIds }, matchingStatus: "done" });
  const summary = { purged, bots: bots.size, items: ITEMS.length, analysed };
  logger.info(summary, "Demo seeded");
  return summary;
};
