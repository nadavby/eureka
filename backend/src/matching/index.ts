import { config } from "../lib/config";
import { JobQueue } from "../jobs/job-queue";
import { AiClient, createAiClient } from "./ai-client";
import { AtlasCandidateSearch, CandidateSearch, InMemoryCandidateSearch } from "./candidate-search";
import { ImageData, loadImage } from "./image-loader";
import { createPipeline, PipelineDeps } from "./pipeline";
import { emitToUser } from "../services/notification.socket.service";

export const ANALYZE_ITEM = "analyze-item";
export const FIND_MATCHES = "find-matches";

export interface MatchingOverrides {
  ai?: AiClient;
  search?: CandidateSearch;
  loadImage?: (url: string) => Promise<ImageData>;
  emitToUser?: PipelineDeps["emitToUser"];
  settings?: Partial<PipelineDeps["settings"]>;
}

/** Registers the two matching jobs on the queue. Dependencies default to the real ones. */
export const registerMatchingJobs = (queue: JobQueue, overrides: MatchingOverrides = {}) => {
  const pipeline = createPipeline({
    ai: overrides.ai ?? createAiClient(),
    search: overrides.search ?? (config.VECTOR_SEARCH === "atlas" ? new AtlasCandidateSearch() : new InMemoryCandidateSearch()),
    loadImage: overrides.loadImage ?? loadImage,
    enqueue: (job, data) => queue.enqueue(job, data),
    emitToUser: overrides.emitToUser ?? emitToUser,
    settings: {
      radiusKm: config.MATCH_RADIUS_KM,
      threshold: config.MATCH_THRESHOLD,
      candidateLimit: 30,
      rerankLimit: 5,
      ...overrides.settings,
    },
  });
  queue.define(ANALYZE_ITEM, pipeline.analyzeItem, { onFailed: pipeline.onFailed });
  queue.define(FIND_MATCHES, pipeline.findMatches, { onFailed: pipeline.onFailed });
  return pipeline;
};
