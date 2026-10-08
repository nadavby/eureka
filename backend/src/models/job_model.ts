import mongoose from "mongoose";

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface IJob {
  name: string;
  data: Record<string, unknown>;
  status: JobStatus;
  runAt: Date;
  attempts: number;
  lockedBy?: string;
  lockedUntil?: Date;
  lastError?: string;
  finishedAt?: Date;
}

const jobSchema = new mongoose.Schema<IJob>(
  {
    name: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
    runAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    lockedBy: String,
    lockedUntil: Date,
    lastError: String,
    finishedAt: Date,
  },
  { timestamps: true, minimize: false }
);

// The claim query: due queued jobs, and running jobs whose lock expired.
jobSchema.index({ status: 1, runAt: 1 });
jobSchema.index({ status: 1, lockedUntil: 1 });
// Finished jobs are kept for a week for debugging, then removed by MongoDB.
jobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const jobModel = mongoose.model<IJob>("jobs", jobSchema);
export default jobModel;
