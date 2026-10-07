import mongoose from "mongoose";
import { JobQueue, RescheduleError } from "../../jobs/job-queue";
import jobModel from "../../models/job_model";
import { config } from "../../lib/config";

const fastQueue = (name = "test") =>
  new JobQueue({ workerId: name, pollIntervalMs: 20, lockMs: 5_000, baseBackoffMs: 10, maxAttempts: 3 });

beforeAll(async () => {
  await mongoose.connect(config.DB_CONNECTION);
});
afterEach(async () => {
  await jobModel.deleteMany({});
});
afterAll(async () => {
  await mongoose.connection.close();
});

const waitFor = async (check: () => Promise<boolean>, timeoutMs = 3000) => {
  const start = Date.now();
  while (!(await check())) {
    if (Date.now() - start > timeoutMs) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
};

describe("JobQueue", () => {
  it("runs an enqueued job once with its data", async () => {
    const queue = fastQueue();
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.define("greet", handler);
    await queue.enqueue("greet", { name: "eureka" });
    await queue.drain();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ name: "eureka" }, expect.objectContaining({ attempt: 1 }));
    expect((await jobModel.findOne({ name: "greet" }))!.status).toBe("done");
  });

  it("retries failures with backoff and gives up after maxAttempts", async () => {
    const queue = fastQueue();
    const handler = jest.fn().mockRejectedValue(new Error("boom"));
    queue.define("flaky", handler);
    await queue.enqueue("flaky", {});
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 60)); // let the backoff elapse
      await queue.drain();
    }
    expect(handler).toHaveBeenCalledTimes(3);
    const job = await jobModel.findOne({ name: "flaky" });
    expect(job!.status).toBe("failed");
    expect(job!.attempts).toBe(3);
    expect(job!.lastError).toBe("boom");
  });

  it("calls onFailed once the last attempt fails", async () => {
    const queue = fastQueue();
    const onFailed = jest.fn();
    queue.define("doomed", jest.fn().mockRejectedValue(new Error("nope")), { maxAttempts: 1, onFailed });
    await queue.enqueue("doomed", { id: 7 });
    await queue.drain();
    expect(onFailed).toHaveBeenCalledWith({ id: 7 }, expect.any(Error));
  });

  it("reschedules without spending an attempt on RescheduleError", async () => {
    const queue = fastQueue();
    const handler = jest.fn().mockRejectedValueOnce(new RescheduleError(30)).mockResolvedValue(undefined);
    queue.define("throttled", handler);
    await queue.enqueue("throttled", {});
    await queue.drain();
    let job = await jobModel.findOne({ name: "throttled" });
    expect(job!.status).toBe("queued");
    expect(job!.attempts).toBe(0);
    await new Promise((r) => setTimeout(r, 50));
    await queue.drain();
    job = await jobModel.findOne({ name: "throttled" });
    expect(job!.status).toBe("done");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("never runs the same job on two workers", async () => {
    const runs: string[] = [];
    const a = fastQueue("a");
    const b = fastQueue("b");
    for (const q of [a, b]) {
      q.define("once", async (data: { n: number }) => {
        runs.push(String(data.n));
        await new Promise((r) => setTimeout(r, 20));
      });
    }
    for (let n = 0; n < 10; n++) await a.enqueue("once", { n });
    await Promise.all([a.drain(), b.drain()]);
    expect(runs.sort()).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("reclaims a job whose worker died mid-run", async () => {
    await jobModel.create({
      name: "orphan",
      data: {},
      status: "running",
      runAt: new Date(Date.now() - 10_000),
      lockedBy: "dead-worker",
      lockedUntil: new Date(Date.now() - 1),
      attempts: 1,
    });
    const queue = fastQueue();
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.define("orphan", handler);
    await queue.drain();
    expect(handler).toHaveBeenCalledWith({}, expect.objectContaining({ attempt: 2 }));
  });

  it("processes jobs in the background once started", async () => {
    const queue = fastQueue();
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.define("bg", handler);
    queue.start();
    await queue.enqueue("bg", {});
    await waitFor(async () => handler.mock.calls.length === 1);
    await queue.stop();
  });

  it("refuses to enqueue an unknown job name", async () => {
    await expect(fastQueue().enqueue("nope", {})).rejects.toThrow(/unknown job/i);
  });
});
