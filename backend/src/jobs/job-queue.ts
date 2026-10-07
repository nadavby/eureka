import { randomUUID } from "crypto";
import jobModel from "../models/job_model";
import { logger } from "../lib/logger";

/** Throw from a handler to run the job again later without counting a failed attempt. */
export class RescheduleError extends Error {
  constructor(public readonly delayMs: number) {
    super(`rescheduled in ${delayMs}ms`);
  }
}

export interface JobContext {
  attempt: number;
}

type Handler<T> = (data: T, ctx: JobContext) => Promise<void>;

interface Definition {
  handler: Handler<never>;
  maxAttempts: number;
  onFailed?: (data: never, err: Error) => Promise<void> | void;
}

export interface JobQueueOptions {
  workerId?: string;
  pollIntervalMs?: number;
  /** How long a claimed job stays locked; a crashed worker's jobs are reclaimed after this. */
  lockMs?: number;
  baseBackoffMs?: number;
  maxAttempts?: number;
  concurrency?: number;
}

/**
 * A small durable job queue on MongoDB. Jobs survive restarts (Render's free tier sleeps),
 * a job is claimed atomically so two workers never run it twice, and failures are
 * retried with exponential backoff.
 */
export class JobQueue {
  private readonly definitions = new Map<string, Definition>();
  private readonly workerId: string;
  private readonly opts: Required<Omit<JobQueueOptions, "workerId">>;
  private timer?: NodeJS.Timeout;
  private active = 0;
  private stopping = false;

  constructor(options: JobQueueOptions = {}) {
    this.workerId = options.workerId ?? `worker-${randomUUID().slice(0, 8)}`;
    this.opts = {
      pollIntervalMs: options.pollIntervalMs ?? 2000,
      lockMs: options.lockMs ?? 5 * 60 * 1000,
      baseBackoffMs: options.baseBackoffMs ?? 15_000,
      maxAttempts: options.maxAttempts ?? 3,
      concurrency: options.concurrency ?? 2,
    };
  }

  define<T>(name: string, handler: Handler<T>, options: { maxAttempts?: number; onFailed?: Definition["onFailed"] } = {}) {
    this.definitions.set(name, {
      handler: handler as Handler<never>,
      maxAttempts: options.maxAttempts ?? this.opts.maxAttempts,
      onFailed: options.onFailed,
    });
  }

  async enqueue(name: string, data: Record<string, unknown>, options: { delayMs?: number } = {}) {
    if (!this.definitions.has(name)) throw new Error(`Unknown job "${name}"`);
    return jobModel.create({ name, data, runAt: new Date(Date.now() + (options.delayMs ?? 0)) });
  }

  /** Atomically claims the next due job (or one whose worker died), or returns null. */
  private claim() {
    const now = new Date();
    return jobModel.findOneAndUpdate(
      {
        name: { $in: [...this.definitions.keys()] },
        $or: [
          { status: "queued", runAt: { $lte: now } },
          { status: "running", lockedUntil: { $lt: now } },
        ],
      },
      {
        $set: { status: "running", lockedBy: this.workerId, lockedUntil: new Date(now.getTime() + this.opts.lockMs) },
        $inc: { attempts: 1 },
      },
      { sort: { runAt: 1 }, new: true }
    );
  }

  private async runOne(): Promise<boolean> {
    const job = await this.claim();
    if (!job) return false;
    const def = this.definitions.get(job.name)!;
    const log = logger.child({ jobId: job._id.toString(), job: job.name, attempt: job.attempts });
    try {
      await def.handler(job.data as never, { attempt: job.attempts });
      await job.updateOne({ status: "done", finishedAt: new Date(), $unset: { lockedBy: 1, lockedUntil: 1 } });
    } catch (err) {
      if (err instanceof RescheduleError) {
        log.info({ delayMs: err.delayMs }, "Job rescheduled");
        await job.updateOne({
          status: "queued",
          runAt: new Date(Date.now() + err.delayMs),
          $inc: { attempts: -1 },
          $unset: { lockedBy: 1, lockedUntil: 1 },
        });
        return true;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      if (job.attempts >= def.maxAttempts) {
        log.error({ err: error }, "Job failed permanently");
        await job.updateOne({ status: "failed", lastError: error.message, finishedAt: new Date() });
        await def.onFailed?.(job.data as never, error);
      } else {
        const delay = this.opts.baseBackoffMs * 2 ** (job.attempts - 1);
        log.warn({ err: error, retryInMs: delay }, "Job failed, will retry");
        await job.updateOne({
          status: "queued",
          lastError: error.message,
          runAt: new Date(Date.now() + delay),
          $unset: { lockedBy: 1, lockedUntil: 1 },
        });
      }
    }
    return true;
  }

  /** Runs every job that is due right now, then resolves. Used by tests and scripts. */
  async drain() {
    while (await this.runOne()) {
      /* keep going */
    }
  }

  private async tick() {
    while (!this.stopping && this.active < this.opts.concurrency) {
      this.active++;
      const ran = await this.runOne()
        .catch((err) => {
          logger.error({ err }, "Job queue tick failed");
          return false;
        })
        .finally(() => this.active--);
      if (!ran) break;
    }
  }

  start() {
    this.stopping = false;
    this.timer = setInterval(() => void this.tick(), this.opts.pollIntervalMs);
    this.timer.unref();
    logger.info({ workerId: this.workerId }, "Job queue started");
  }

  /** Stops polling and waits for running jobs to finish. */
  async stop() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    while (this.active > 0) await new Promise((r) => setTimeout(r, 20));
  }
}
