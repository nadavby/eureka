export interface ScoredPair {
  isMatch: boolean;
  score: number;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/** Binary classification metrics for "score >= threshold means match". */
export const computeMetrics = (pairs: ScoredPair[], threshold: number) => {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const { isMatch, score } of pairs) {
    const predicted = score >= threshold;
    if (predicted && isMatch) tp++;
    else if (predicted) fp++;
    else if (isMatch) fn++;
    else tn++;
  }
  const precision = ratio(tp, tp + fp);
  const recall = ratio(tp, tp + fn);
  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1: ratio(2 * precision * recall, precision + recall),
    accuracy: ratio(tp + tn, pairs.length),
  };
};
