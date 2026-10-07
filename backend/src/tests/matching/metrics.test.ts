import { computeMetrics } from "../../matching/metrics";

describe("computeMetrics", () => {
  it("computes the confusion matrix, precision, recall and F1", () => {
    const m = computeMetrics(
      [
        { isMatch: true, score: 90 }, // TP
        { isMatch: true, score: 75 }, // TP
        { isMatch: true, score: 40 }, // FN
        { isMatch: false, score: 80 }, // FP
        { isMatch: false, score: 10 }, // TN
        { isMatch: false, score: 69 }, // TN (just under)
      ],
      70
    );
    expect(m).toMatchObject({ tp: 2, fp: 1, fn: 1, tn: 2 });
    expect(m.precision).toBeCloseTo(2 / 3);
    expect(m.recall).toBeCloseTo(2 / 3);
    expect(m.f1).toBeCloseTo(2 / 3);
    expect(m.accuracy).toBeCloseTo(4 / 6);
  });

  it("treats empty denominators as 0 instead of NaN", () => {
    const m = computeMetrics([{ isMatch: false, score: 0 }], 70);
    expect(m.precision).toBe(0);
    expect(m.recall).toBe(0);
    expect(m.f1).toBe(0);
  });
});
