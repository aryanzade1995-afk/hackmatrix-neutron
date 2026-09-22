/**
 * Descriptive statistics for the dashboard charts.
 *
 * Small and dependency-free on purpose. Every figure the interface shows has
 * to be defensible to someone who asks "how did you get that", and a
 * forty-line file they can read beats a library they have to trust.
 *
 * All of these operate on counts the admin role is already permitted to see.
 * Nothing here reconstructs a suppressed group: a week that never cleared the
 * threshold is absent from the input, so it is absent from the mean, the
 * median and the deviation too. That biases these figures upward slightly,
 * which is the honest direction — see `docs` note on the explorer page.
 */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Sample standard deviation (n-1).
 *
 * n-1 rather than n because these weeks are a sample of an ongoing process,
 * not the entire population of weeks that will ever exist.
 */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Trailing moving average, `window` points wide.
 *
 * Returns null for positions with too little history behind them rather than
 * averaging over a short window — a 4-week line that silently becomes a
 * 1-week line at the left edge is a line that lies about its own smoothing.
 */
export function movingAverage(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i + 1 < window) return null;
    return mean(values.slice(i + 1 - window, i + 1));
  });
}

/** How many standard deviations a value sits from the mean. */
export function zScore(value: number, values: number[]): number {
  const sd = stdDev(values);
  if (sd === 0) return 0;
  return (value - mean(values)) / sd;
}

/**
 * Least-squares slope, in units per step.
 *
 * Used only to label a series as rising, flat or falling. It is not a
 * forecast, and the interface does not extend the line past the last
 * observation.
 */
export function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

export type Summary = {
  total: number;
  mean: number;
  median: number;
  sd: number;
  peak: number;
  peakIndex: number;
  slope: number;
  /** Percent change, last third of the period against the first third. */
  changePct: number | null;
};

export function summarise(values: number[]): Summary {
  if (values.length === 0) {
    return {
      total: 0, mean: 0, median: 0, sd: 0,
      peak: 0, peakIndex: -1, slope: 0, changePct: null,
    };
  }

  const peak = Math.max(...values);

  // Thirds rather than first-vs-last point: two single weeks is a comparison
  // dominated by whichever of them happened to be noisy.
  const third = Math.floor(values.length / 3);
  let changePct: number | null = null;
  if (third >= 1) {
    const early = mean(values.slice(0, third));
    const late = mean(values.slice(-third));
    if (early > 0) changePct = ((late - early) / early) * 100;
  }

  return {
    total: values.reduce((sum, v) => sum + v, 0),
    mean: mean(values),
    median: median(values),
    sd: stdDev(values),
    peak,
    peakIndex: values.indexOf(peak),
    slope: slope(values),
    changePct,
  };
}
