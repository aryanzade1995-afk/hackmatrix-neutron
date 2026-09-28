/**
 * AI Disease Surveillance — the in-browser estimation engine behind
 * /admin/surveillance.
 *
 * Runs entirely in the browser over a small, fixed set of weekly case series
 * bundled below. Nothing here calls the API and nothing here is random at run
 * time: the same disease and location always produce the same result, so a
 * selection can be revisited and shows exactly what it showed before.
 *
 * The numbers are computed, not written in. Each series goes through the same
 * three steps:
 *
 *   1. Forecast — damped Holt (double exponential) smoothing, projected three
 *      weeks ahead.
 *   2. Anomaly — each week scored against the median of the six weeks before
 *      it, in robust standard deviations (MAD), with a Poisson floor so a very
 *      regular series cannot produce absurd scores.
 *   3. Signal — a transparent points score over growth, anomaly, forecast and
 *      trend persistence. Every point awarded becomes a line of the "why this
 *      signal" explanation, so the explanation is the calculation.
 *
 * This is a public-health surveillance estimate over case counts. It does not
 * diagnose anyone and never looks at an individual record.
 */

export const SURVEILLANCE_DISEASES = [
  "Dengue",
  "Malaria",
  "Typhoid",
  "Influenza",
  "Chikungunya",
  "Gastroenteritis",
] as const;

/** The four districts used everywhere else in the project. */
export const SURVEILLANCE_LOCATIONS = ["Pune City", "Wagholi", "Hadapsar", "Baramati"] as const;

export type SurveillanceDisease = (typeof SURVEILLANCE_DISEASES)[number];
export type SurveillanceLocation = (typeof SURVEILLANCE_LOCATIONS)[number];
export type OutbreakSignal = "LOW" | "MODERATE" | "HIGH";

export type SurveillanceInput = {
  disease: SurveillanceDisease;
  location: SurveillanceLocation;
};

export type SurveillancePoint = {
  /** Monday of the week, YYYY-MM-DD. */
  week: string;
  actual: number | null;
  predicted: number | null;
  /** Forecast band, forecast weeks only. */
  lower: number | null;
  upper: number | null;
  /** Robust z-score of this week against the six before it. */
  anomalyScore: number | null;
  anomaly: boolean;
};

export type SurveillanceFactor = {
  kind: "growth" | "anomaly" | "forecast" | "trend" | "stable";
  text: string;
};

export type SurveillanceResult = {
  disease: SurveillanceDisease;
  location: SurveillanceLocation;
  signal: OutbreakSignal;
  /** Cases in the most recent complete week (the one before this). */
  currentCases: number;
  /** Next three weeks, rounded to whole cases. */
  predictedCases: number[];
  /** Mean of the forecast against the current week, in percent. */
  trendPercent: number;
  /** Current week against the four-week baseline before the recent run. */
  baselinePercent: number;
  /** Robust z-score of the current week. */
  anomalyScore: number;
  /** 0–1, derived from one-step-ahead backtest error on this series. */
  confidence: number;
  /** Backtest median absolute percentage error, 0–1. */
  backtestError: number;
  factors: SurveillanceFactor[];
  points: SurveillancePoint[];
  /** Weeks of observed history the estimate used. */
  historyWeeks: number;
};

// ---------------------------------------------------------------------------
// Bundled weekly series
// ---------------------------------------------------------------------------

const WEEKS = 12;

/**
 * Series written out by hand, for the combinations that anchor the walkthrough.
 * Everything else is generated below from a seeded, fixed recipe.
 */
const AUTHORED: Partial<Record<string, number[]>> = {
  // Terminal outbreak: steady around thirteen, then five weeks of acceleration.
  "Dengue|Wagholi": [12, 11, 14, 13, 12, 15, 14, 17, 22, 29, 35, 42],
  // Slow, sustained climb with no single unusual week.
  "Malaria|Pune City": [6, 7, 6, 8, 7, 8, 9, 9, 10, 11, 11, 12],
  // Flat seasonal background.
  "Influenza|Hadapsar": [18, 17, 19, 18, 16, 17, 18, 17, 16, 17, 18, 17],
  // City-wide dengue season building steadily.
  "Dengue|Pune City": [22, 24, 23, 25, 24, 26, 27, 29, 30, 32, 34, 36],
  // A one-week cluster mid-series that has since settled.
  "Typhoid|Baramati": [5, 6, 5, 6, 5, 14, 7, 6, 6, 5, 6, 6],
  // Past its peak and falling.
  "Chikungunya|Pune City": [9, 11, 14, 18, 21, 22, 20, 17, 14, 12, 10, 9],
  // Recent jump without a long run-up.
  "Gastroenteritis|Wagholi": [8, 9, 8, 9, 10, 8, 9, 9, 10, 9, 16, 19],
};

/** Typical weekly volume per condition, before the district scale. */
const DISEASE_BASE: Record<SurveillanceDisease, number> = {
  Dengue: 14,
  Malaria: 6,
  Typhoid: 7,
  Influenza: 16,
  Chikungunya: 5,
  Gastroenteritis: 10,
};

/** Relative size of each district's reporting population. */
const LOCATION_SCALE: Record<SurveillanceLocation, number> = {
  "Pune City": 1.6,
  Wagholi: 1.0,
  Hadapsar: 1.15,
  Baramati: 0.7,
};

type Pattern = "stable" | "rising" | "decline" | "settled-spike";
const PATTERNS: Pattern[] = ["stable", "rising", "decline", "settled-spike", "stable", "rising"];

/** FNV-1a. Stable across runs and browsers, which is the only requirement. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — a tiny seeded generator, so generated series never change. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generatedSeries(disease: SurveillanceDisease, location: SurveillanceLocation): number[] {
  const key = `${disease}|${location}`;
  const rand = seeded(hash(key));
  const base = DISEASE_BASE[disease] * LOCATION_SCALE[location];
  const pattern = PATTERNS[hash(`${key}#pattern`) % PATTERNS.length];

  return Array.from({ length: WEEKS }, (_, i) => {
    let level = base;
    // Flat for five weeks, then climbing about 8% of baseline a week.
    if (pattern === "rising") level = base * (1 + 0.08 * Math.max(0, i - 4));
    if (pattern === "decline") level = base * (1.3 - 0.035 * i);
    if (pattern === "settled-spike" && i === 6) level = base * 2.1;
    // Reporting noise, roughly Poisson: about sqrt(level) either way, but
    // never less than a tenth of the level.
    const amplitude = Math.max(0.1 * level, 0.7 * Math.sqrt(level));
    const noise = (rand() - 0.5) * 2 * amplitude;
    return Math.max(1, Math.round(level + noise));
  });
}

export function seriesFor(input: SurveillanceInput): number[] {
  return AUTHORED[`${input.disease}|${input.location}`] ?? generatedSeries(input.disease, input.location);
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(xs.length, 1);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Damped Holt smoothing. Tuned once, applied identically to every series. */
const HOLT = { alpha: 0.75, beta: 0.45, phi: 0.92 };
export const FORECAST_WEEKS = 3;

function holt(values: number[], horizon: number) {
  const { alpha, beta, phi } = HOLT;
  let level = values[0];
  let trend = values[1] - values[0];
  const oneStep: number[] = [];

  for (let t = 1; t < values.length; t++) {
    const expected = level + phi * trend;
    oneStep.push(expected);
    const nextLevel = alpha * values[t] + (1 - alpha) * expected;
    trend = beta * (nextLevel - level) + (1 - beta) * phi * trend;
    level = nextLevel;
  }

  const forecast: number[] = [];
  let damp = 0;
  for (let h = 1; h <= horizon; h++) {
    damp += phi ** h;
    forecast.push(Math.max(0, level + damp * trend));
  }
  return { forecast, oneStep };
}

/** Weeks of history each anomaly score is measured against. */
const ANOMALY_WINDOW = 6;
const MIN_ANOMALY_HISTORY = 4;
export const ANOMALY_THRESHOLD = 2.5;

/** A forecast rise at or above this share of the current week scores a point. */
export const FORECAST_RISE = 5;

/** Robust z-score of each week against the median of the weeks before it. */
function robustScores(values: number[]): (number | null)[] {
  return values.map((value, i) => {
    if (i < MIN_ANOMALY_HISTORY) return null;
    const window = values.slice(Math.max(0, i - ANOMALY_WINDOW), i);
    const med = median(window);
    const mad = median(window.map((x) => Math.abs(x - med)));
    // Poisson floor: counts carry noise of about sqrt(mean) however tidy they
    // look, so the spread never collapses to zero on a regular series.
    const spread = Math.max(1.4826 * mad, Math.sqrt(Math.max(med, 1)));
    return (value - med) / spread;
  });
}

/**
 * Consecutive weeks, counting back from the latest, over which cases kept
 * rising. One flat week is tolerated inside a run; a second, or any fall,
 * ends it. The run only counts as a trend if it holds at least three actual
 * rises — a plateau with one uptick at the end is not "sustained".
 */
function risingRun(values: number[]): number {
  let run = 0;
  let rises = 0;
  let flats = 0;
  for (let i = values.length - 1; i > 0; i--) {
    if (values[i] > values[i - 1]) rises++;
    else if (values[i] === values[i - 1] && flats === 0) flats++;
    else break;
    run++;
  }
  return rises >= 3 ? run : 0;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const pct = (now: number, then: number) => (then > 0 ? ((now - then) / then) * 100 : 0);

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function analyzeDisease(input: SurveillanceInput, asOf: Date = new Date()): SurveillanceResult {
  const values = seriesFor(input);
  const n = values.length;
  const current = values[n - 1];

  const { forecast, oneStep } = holt(values, FORECAST_WEEKS);
  const scores = robustScores(values);

  // Backtest: one-step-ahead error over the second half of the series, where
  // the smoother has settled. This is what the confidence figure rests on.
  // Median rather than mean, so one earlier spike does not dominate it.
  const tail = Math.floor(n / 2);
  const errors = values
    .slice(tail)
    .map((v, i) => Math.abs(v - oneStep[tail - 1 + i]) / Math.max(v, 1));
  const backtestError = median(errors);
  // Band spread from the residuals' median absolute deviation, so one old
  // spike (and the overshoot after it) does not widen every future range.
  const residuals = values.slice(1).map((v, i) => v - oneStep[i]);
  const residualMedian = median(residuals);
  const residualSd = 1.4826 * median(residuals.map((r) => Math.abs(r - residualMedian)));
  // Smooth in the error rather than clamped: 5% error reads as ~0.89, 15% as
  // ~0.76, a series the model tracks badly drifts towards one half.
  const confidence = Math.min(0.95, Math.max(0.5, 0.97 * Math.exp(-1.7 * backtestError)));

  // Baseline: the four weeks before the latest three, so a recent run-up is
  // measured against where the series was, not against itself.
  const baseline = mean(values.slice(n - 7, n - 3));
  const baselinePercent = pct(current, baseline);
  const trendPercent = pct(mean(forecast), current);
  const anomalyScore = scores[n - 1] ?? 0;
  const run = risingRun(values);
  const recentSpike = scores.slice(n - 3).some((s) => (s ?? 0) >= ANOMALY_THRESHOLD);
  const pastSpikeIndex = scores.findIndex(
    (s, i) => i < n - 3 && (s ?? 0) >= ANOMALY_THRESHOLD,
  );

  // Points, each with the sentence that explains it.
  let points = 0;
  const factors: SurveillanceFactor[] = [];

  if (baselinePercent >= 50) {
    points += 2;
    factors.push({
      kind: "growth",
      text: `${Math.round(baselinePercent)}% increase over the recent 4-week baseline`,
    });
  } else if (baselinePercent >= 20) {
    points += 1;
    factors.push({
      kind: "growth",
      text: `${Math.round(baselinePercent)}% increase over the recent 4-week baseline`,
    });
  }

  if (anomalyScore >= 3) {
    points += 2;
    factors.push({
      kind: "anomaly",
      text: `Unusual weekly spike detected — the latest week is ${anomalyScore.toFixed(1)} robust SD above normal`,
    });
  } else if (recentSpike) {
    points += 1;
    factors.push({
      kind: "anomaly",
      text: "Unusual weekly spike detected in the last three weeks",
    });
  }

  if (trendPercent >= FORECAST_RISE) {
    points += 1;
    factors.push({
      kind: "forecast",
      text: `Model projects a further ${Math.round(trendPercent)}% rise over the next ${FORECAST_WEEKS} weeks`,
    });
  }

  if (run >= 3) {
    points += 1;
    factors.push({
      kind: "trend",
      text: `Sustained upward trend for ${run} consecutive weeks`,
    });
  }

  const signal: OutbreakSignal = points >= 4 ? "HIGH" : points >= 2 ? "MODERATE" : "LOW";

  if (signal === "LOW") {
    // A low signal still owes the reader its reasons, not just an absence.
    factors.length = 0;
    factors.push({
      kind: "stable",
      text:
        Math.abs(baselinePercent) < 1
          ? "Current week in line with the 4-week baseline"
          : Math.abs(baselinePercent) < 20
          ? `Current week within ${Math.round(Math.abs(baselinePercent))}% of the 4-week baseline`
          : baselinePercent < 0
            ? `Cases down ${Math.round(-baselinePercent)}% on the 4-week baseline`
            : `${Math.round(baselinePercent)}% above the 4-week baseline, without an unusual week or a forecast rise of ${FORECAST_RISE}% or more`,
    });
    factors.push({
      kind: "stable",
      text:
        pastSpikeIndex >= 0
          ? `One earlier spike (${n - 1 - pastSpikeIndex} weeks ago) has since returned to normal`
          : "No unusual weeks in the last 12",
    });
    factors.push({
      kind: "forecast",
      text:
        Math.abs(trendPercent) < 2
          ? `Forecast stays level over the next ${FORECAST_WEEKS} weeks`
          : trendPercent < 0
            ? `Forecast eases ${Math.round(-trendPercent)}% lower over the next ${FORECAST_WEEKS} weeks`
            : trendPercent < FORECAST_RISE
              ? `Forecast edges up ${Math.round(trendPercent)}%, below the ${FORECAST_RISE}% line for a rise`
              : `Forecast rise of ${Math.round(trendPercent)}% without supporting growth or an unusual week`,
    });
  }

  // Week dates. The latest observed week is the last complete one — the week
  // before the one this runs in — so the first forecast week is this week.
  const lastWeek = mondayOf(asOf);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const weekAt = (offset: number) => {
    const d = new Date(lastWeek);
    d.setDate(d.getDate() + offset * 7);
    return isoDate(d);
  };

  const band = 1.96 * Math.max(residualSd, Math.sqrt(Math.max(current, 1)) * 0.5);
  const history: SurveillancePoint[] = values.map((v, i) => ({
    week: weekAt(i - (n - 1)),
    actual: v,
    // The forecast line starts from the last observed week so the two join.
    predicted: i === n - 1 ? v : null,
    lower: null,
    upper: null,
    anomalyScore: scores[i] === null ? null : round1(scores[i] as number),
    anomaly: (scores[i] ?? 0) >= ANOMALY_THRESHOLD,
  }));
  const future: SurveillancePoint[] = forecast.map((f, h) => ({
    week: weekAt(h + 1),
    actual: null,
    predicted: round1(f),
    lower: round1(Math.max(0, f - band * Math.sqrt(h + 1))),
    upper: round1(f + band * Math.sqrt(h + 1)),
    anomalyScore: null,
    anomaly: false,
  }));

  return {
    disease: input.disease,
    location: input.location,
    signal,
    currentCases: current,
    predictedCases: forecast.map((f) => Math.round(f)),
    trendPercent: round1(trendPercent),
    baselinePercent: round1(baselinePercent),
    anomalyScore: round1(anomalyScore),
    confidence: Math.round(confidence * 100) / 100,
    backtestError: Math.round(backtestError * 1000) / 1000,
    factors,
    points: [...history, ...future],
    historyWeeks: n,
  };
}

/**
 * How long the analysis step is shown for, 700–1200 ms. Fixed per selection,
 * so revisiting a combination feels the same each time.
 */
export function analysisDelayMs(input: SurveillanceInput): number {
  return 700 + (hash(`${input.disease}|${input.location}#delay`) % 501);
}

/** Runs the analysis behind a short processing step. Abortable. */
export function runSurveillance(
  input: SurveillanceInput,
  signal?: AbortSignal,
): Promise<SurveillanceResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        resolve(analyzeDisease(input));
      } catch (err) {
        reject(err);
      }
    }, analysisDelayMs(input));
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}
