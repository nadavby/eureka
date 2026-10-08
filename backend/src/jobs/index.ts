import { JobQueue } from "./job-queue";

/** The process-wide queue. The API enqueues; index.ts starts the worker loop. */
export const queue = new JobQueue();
