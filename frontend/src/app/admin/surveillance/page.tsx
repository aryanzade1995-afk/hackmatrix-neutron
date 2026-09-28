"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  CircleCheck,
  ChevronDown,
  LineChart,
  RotateCcw,
  Sparkles,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle, SectionLabel } from "@/components/Card";
import { SurveillanceChart } from "@/components/SurveillanceChart";
import { weekLabel } from "@/components/chartTheme";
import { adminTabs } from "@/lib/demo-data";
import {
  ANOMALY_THRESHOLD,
  FORECAST_WEEKS,
  SURVEILLANCE_DISEASES,
  SURVEILLANCE_LOCATIONS,
  analysisDelayMs,
  runSurveillance,
  type OutbreakSignal,
  type SurveillanceDisease,
  type SurveillanceFactor,
  type SurveillanceInput,
  type SurveillanceLocation,
  type SurveillanceResult,
} from "@/lib/mockDiseaseAI";

type State =
  | { status: "analyzing"; delay: number }
  | { status: "ready"; result: SurveillanceResult }
  | { status: "error"; message: string };

const SIGNAL_COPY: Record<
  OutbreakSignal,
  { headline: string; tint: string; text: string; badge: "success" | "warning" | "danger" }
> = {
  LOW: {
    headline: "Normal activity",
    tint: "bg-success-tint",
    text: "text-success",
    badge: "success",
  },
  MODERATE: {
    headline: "Rising disease activity",
    tint: "bg-warning-tint",
    text: "text-warning",
    badge: "warning",
  },
  HIGH: {
    headline: "Potential outbreak signal",
    tint: "bg-danger-tint",
    text: "text-danger",
    badge: "danger",
  },
};

const SIGNAL_LEVELS: OutbreakSignal[] = ["LOW", "MODERATE", "HIGH"];

/** The three stages shown while the analysis runs, in order. */
const STAGES = [
  "Reading 12 weeks of case counts",
  "Fitting the trend model",
  "Scoring weekly anomalies",
  "Estimating the outbreak signal",
];

const FACTOR_ICON: Record<SurveillanceFactor["kind"], typeof TrendingUp> = {
  growth: TrendingUp,
  anomaly: TriangleAlert,
  forecast: LineChart,
  trend: ArrowUpRight,
  stable: CircleCheck,
};

const selectClass =
  "transition-calm w-full appearance-none rounded-xl bg-canvas py-2.5 pl-4 pr-10 text-[13.5px] font-medium text-ink ring-1 ring-inset ring-border hover:ring-border-strong focus:outline-none focus:ring-2 focus:ring-sage";

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0 flex-1 sm:max-w-[240px]">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-label text-ink-faint">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          disabled={disabled}
          className={selectClass}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      </span>
    </label>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "ink",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "ink" | "danger" | "warning" | "success";
}) {
  const color = {
    ink: "text-ink",
    danger: "text-danger",
    warning: "text-warning",
    success: "text-success",
  }[tone];
  return (
    <Card className="px-5 py-4">
      <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">{label}</p>
      <p className={`nums mt-2 text-[24px] font-semibold leading-none ${color}`}>{value}</p>
      <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">{note}</p>
    </Card>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-canvas ${className}`} />;
}

function AnalyzingPanel({ delay }: { delay: number }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const step = delay / STAGES.length;
    const timers = STAGES.slice(1).map((_, i) =>
      setTimeout(() => setStage(i + 1), step * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [delay]);

  return (
    <div>
      <Card className="mb-6 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-tint-strong">
            <BrainCircuit className="h-[18px] w-[18px] animate-pulse text-forest-mid" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">Analyzing disease patterns…</p>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">{STAGES[stage]}</p>
          </div>
          <span className="nums hidden text-[11.5px] text-ink-faint sm:block">
            step {stage + 1} of {STAGES.length}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-canvas">
          <div
            className="surveil-progress h-full rounded-full bg-gradient-to-r from-sage to-forest-mid"
            style={{ ["--surveil-ms" as string]: `${delay}ms` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="space-y-4 px-6 py-6">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
        </Card>
        <Card className="px-6 py-6">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-6 h-[240px] w-full" />
        </Card>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Card key={i} className="px-5 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-16" />
            <Skeleton className="mt-3 h-3 w-24" />
          </Card>
        ))}
      </div>
    </div>
  );
}

function SignalCard({ result }: { result: SurveillanceResult }) {
  const copy = SIGNAL_COPY[result.signal];
  const level = SIGNAL_LEVELS.indexOf(result.signal);
  const lastWeek = result.points[result.historyWeeks - 1]?.week;

  return (
    <Card className="flex flex-col">
      <div className={`${copy.tint} px-6 pb-5 pt-6`}>
        <SectionLabel>Current outbreak signal</SectionLabel>
        <p className={`mt-3 text-display text-[40px] leading-none ${copy.text}`}>{result.signal}</p>
        <p className="mt-2.5 text-[15px] font-semibold text-ink">{copy.headline}</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {result.disease} · {result.location}
          {lastWeek && <> · week of {weekLabel(lastWeek)}</>}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-1.5" aria-hidden>
          {SIGNAL_LEVELS.map((l, i) => (
            <span
              key={l}
              className={`h-1.5 rounded-full ${
                i <= level
                  ? i === 0
                    ? "bg-success"
                    : i === 1
                      ? "bg-warning"
                      : "bg-danger"
                  : "bg-white/70"
              }`}
            />
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-3 text-[10.5px] text-ink-faint">
          <span>Low</span>
          <span className="text-center">Moderate</span>
          <span className="text-right">High</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 px-6 py-5">
        <p className="flex items-center gap-2 text-[12px] font-medium text-forest-mid">
          <Sparkles className="h-3.5 w-3.5" />
          AI-assisted surveillance estimate
        </p>
        <p className="text-[12px] leading-relaxed text-ink-faint">
          A public-health signal over weekly case counts. It is not a medical diagnosis and
          does not describe any individual patient.
        </p>
      </div>
    </Card>
  );
}

export default function AdminSurveillancePage() {
  const [input, setInput] = useState<SurveillanceInput>({
    disease: "Dengue",
    location: "Wagholi",
  });
  const [state, setState] = useState<State>({
    status: "analyzing",
    delay: analysisDelayMs({ disease: "Dengue", location: "Wagholi" }),
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "analyzing", delay: analysisDelayMs(input) });
    runSurveillance(input, controller.signal)
      .then((result) => setState({ status: "ready", result }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => controller.abort();
  }, [input, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const analyzing = state.status === "analyzing";

  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Pune Division"
        title="AI Disease Surveillance"
        subtitle="Forecasts and anomaly flags over weekly case counts, by condition and district."
        action={
          <Badge tone="sage">
            <Sparkles className="h-3 w-3" />
            AI-assisted surveillance estimate
          </Badge>
        }
      />

      {/* --------------------------------------------------------- Filters */}
      <Card className="mb-6 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Select<SurveillanceDisease>
            label="Condition"
            value={input.disease}
            options={SURVEILLANCE_DISEASES}
            onChange={(disease) => setInput((prev) => ({ ...prev, disease }))}
          />
          <Select<SurveillanceLocation>
            label="Location"
            value={input.location}
            options={SURVEILLANCE_LOCATIONS}
            onChange={(location) => setInput((prev) => ({ ...prev, location }))}
          />
          <div className="flex items-center gap-2 text-[12px] text-ink-faint sm:ml-auto sm:pb-3">
            <Activity className="h-3.5 w-3.5 shrink-0" />
            <span>12 weeks of history · {FORECAST_WEEKS}-week forecast</span>
          </div>
        </div>
      </Card>

      {/* One live region, always present, so a screen reader hears both the
          start of the analysis and its result. */}
      <p className="sr-only" role="status" aria-live="polite">
        {state.status === "analyzing"
          ? `Analyzing disease patterns for ${input.disease} in ${input.location}`
          : state.status === "ready"
            ? `${state.result.disease} in ${state.result.location}: ${state.result.signal} signal, ${SIGNAL_COPY[state.result.signal].headline}`
            : "The analysis did not complete"}
      </p>

      {analyzing && <AnalyzingPanel key={`${input.disease}|${input.location}|${attempt}`} delay={state.delay} />}

      {state.status === "error" && (
        <Card className="px-6 py-8 text-center">
          <TriangleAlert className="mx-auto h-6 w-6 text-warning" />
          <p className="mt-3 text-[14px] font-semibold text-ink">The analysis did not complete</p>
          <p className="mt-1 text-[12.5px] text-ink-muted">{state.message}</p>
          <button
            type="button"
            onClick={retry}
            className="transition-calm mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Run again
          </button>
        </Card>
      )}

      {state.status === "ready" && (
        <div className="animate-[fadeIn_240ms_ease-out]">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <SignalCard result={state.result} />

            <Card>
              <CardHeader
                title="Weekly cases and forecast"
                subtitle={`${state.result.disease} in ${state.result.location}: observed weeks, then the model's projection for the next ${FORECAST_WEEKS}. Hover a week for details.`}
              />
              <div className="px-4 pb-5">
                <SurveillanceChart points={state.result.points} />
              </div>
            </Card>
          </div>

          {/* ------------------------------------------------- Predictions */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              label="Current cases"
              value={String(state.result.currentCases)}
              note="last complete week"
            />
            <Metric
              label="Predicted next week"
              value={String(state.result.predictedCases[0])}
              note={`then ${state.result.predictedCases.slice(1).join(", ")}`}
            />
            <Metric
              label="Predicted change"
              value={`${state.result.trendPercent > 0 ? "+" : ""}${Math.round(state.result.trendPercent)}%`}
              note={`next ${FORECAST_WEEKS} weeks vs this week`}
              tone={
                state.result.trendPercent >= 10
                  ? "warning"
                  : state.result.trendPercent <= -10
                    ? "success"
                    : "ink"
              }
            />
            <Metric
              label="Anomaly score"
              value={state.result.anomalyScore.toFixed(1)}
              note={
                state.result.anomalyScore >= ANOMALY_THRESHOLD
                  ? `above the ${ANOMALY_THRESHOLD} alert line`
                  : `below the ${ANOMALY_THRESHOLD} alert line`
              }
              tone={state.result.anomalyScore >= ANOMALY_THRESHOLD ? "danger" : "ink"}
            />
            <Metric
              label="Confidence"
              value={`${Math.round(state.result.confidence * 100)}%`}
              note={`backtest error ${Math.round(state.result.backtestError * 100)}%`}
            />
          </div>

          {/* ------------------------------------------------- Explanation */}
          <Card className="mt-6" accent>
            <CardHeader
              eyebrow={
                <Badge tone={SIGNAL_COPY[state.result.signal].badge}>
                  {state.result.signal} signal
                </Badge>
              }
              title="Why this signal?"
              subtitle="Each reason below is one of the checks that set the signal level."
            />
            <ul className="space-y-2.5 px-7 pb-7">
              {state.result.factors.map((f) => {
                const Icon = FACTOR_ICON[f.kind];
                return (
                  <li
                    key={f.text}
                    className="flex items-start gap-3 rounded-xl bg-canvas px-4 py-3 text-[13.5px] text-ink"
                  >
                    <Icon
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        f.kind === "anomaly"
                          ? "text-danger"
                          : f.kind === "stable"
                            ? "text-success"
                            : "text-forest-mid"
                      }`}
                    />
                    {f.text}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>How this estimate is produced</SectionLabel>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
          The forecast is damped trend smoothing over the last 12 weeks. Each week is scored
          against the median of the six before it, and weeks more than {ANOMALY_THRESHOLD} robust
          standard deviations above it are marked as unusual. The signal level combines growth
          over the recent baseline, the anomaly score, the forecast and how long cases have kept
          rising. Confidence comes from how closely the model predicted weeks it had already
          seen. This view runs on a bundled set of sample weekly series in the browser; it does
          not read the live aggregates or any patient record.
        </p>
      </div>
    </AppShell>
  );
}
