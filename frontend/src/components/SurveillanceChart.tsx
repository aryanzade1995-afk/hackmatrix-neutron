"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART, SERIES, weekLabel } from "./chartTheme";
import type { SurveillancePoint } from "@/lib/mockDiseaseAI";

/**
 * Weekly cases with a three-week forecast.
 *
 * Observed weeks are a solid line; the forecast is dashed and sits in a
 * shaded region with its range band, so history and projection are never
 * confused. Weeks the anomaly scorer flagged carry a red marker, and their
 * tooltip says so in words.
 */

type Row = SurveillancePoint & { bandBase: number | null; band: number | null };

const TOOLTIP_STYLE = {
  background: CHART.surface,
  border: `1px solid ${CHART.grid}`,
  borderRadius: 12,
  fontSize: 12.5,
  color: CHART.ink,
  boxShadow: "0 10px 22px -8px rgba(21,45,33,0.18)",
  padding: "10px 12px",
} as const;

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Row }>;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const isForecast = row.actual === null;

  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-ink">
        Week of {weekLabel(row.week)}
        {isForecast && <span className="ml-1.5 font-normal text-ink-faint">· forecast</span>}
      </p>
      {row.actual !== null && (
        <p className="nums mt-1 text-ink-muted">
          Cases: <span className="font-semibold text-ink">{row.actual}</span>
        </p>
      )}
      {isForecast && row.predicted !== null && (
        <>
          <p className="nums mt-1 text-ink-muted">
            Predicted: <span className="font-semibold text-ink">{Math.round(row.predicted)}</span>
          </p>
          {row.lower !== null && row.upper !== null && (
            <p className="nums text-[11.5px] text-ink-faint">
              likely range {Math.round(row.lower)}–{Math.round(row.upper)}
            </p>
          )}
        </>
      )}
      {row.anomaly && (
        <p className="mt-1.5 font-semibold text-danger">
          Unusual increase detected
          {row.anomalyScore !== null && (
            <span className="nums ml-1 font-normal">(score {row.anomalyScore.toFixed(1)})</span>
          )}
        </p>
      )}
    </div>
  );
}

/** Red ring on flagged weeks; nothing on ordinary ones. */
function AnomalyDot(props: { cx?: number; cy?: number; payload?: Row; index?: number }) {
  const { cx, cy, payload, index } = props;
  if (cx === undefined || cy === undefined || !payload?.anomaly) {
    return <g key={`dot-${index}`} />;
  }
  return (
    <g key={`dot-${index}`}>
      <circle cx={cx} cy={cy} r={9} fill={CHART.danger} opacity={0.16} />
      <circle cx={cx} cy={cy} r={4.5} fill={CHART.danger} stroke={CHART.surface} strokeWidth={2} />
    </g>
  );
}

export function SurveillanceChart({ points }: { points: SurveillancePoint[] }) {
  const rows: Row[] = points.map((p) => ({
    ...p,
    bandBase: p.lower,
    band: p.lower !== null && p.upper !== null ? p.upper - p.lower : null,
  }));
  const forecastRows = rows.filter((r) => r.actual === null);
  const lastObserved = rows.filter((r) => r.actual !== null).at(-1);
  const unusual = rows.filter((r) => r.anomaly).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-3 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-2">
          <span className="h-[2.5px] w-5 rounded-full" style={{ background: SERIES[0] }} />
          Historical cases
        </span>
        <span className="flex items-center gap-2">
          <svg width="20" height="4" aria-hidden>
            <line x1="0" y1="2" x2="20" y2="2" stroke={SERIES[2]} strokeWidth="2.5" strokeDasharray="5 3" />
          </svg>
          Predicted cases
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-5 rounded-sm" style={{ background: SERIES[2], opacity: 0.2 }} />
          Forecast range
        </span>
        <span className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
            style={{ background: CHART.danger }}
          />
          Unusual week
        </span>
        <span
          className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-medium ${
            unusual > 0 ? "bg-danger-tint text-danger" : "bg-canvas text-ink-muted"
          }`}
        >
          {unusual === 0 ? "No unusual weeks" : `${unusual} unusual ${unusual === 1 ? "week" : "weeks"}`}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 14, right: 16, bottom: 4, left: -10 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />

          {lastObserved && forecastRows.length > 0 && (
            <ReferenceArea
              x1={lastObserved.week}
              x2={forecastRows[forecastRows.length - 1].week}
              fill={CHART.canvas}
              fillOpacity={0.9}
              label={{
                value: "Forecast",
                position: "insideTopRight",
                fill: CHART.axis,
                fontSize: 10.5,
              }}
            />
          )}

          <XAxis
            dataKey="week"
            tickFormatter={weekLabel}
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: CHART.grid }}
            minTickGap={18}
          />
          <YAxis
            tick={{ fill: CHART.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={44}
            allowDecimals={false}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as ReadonlyArray<{ payload?: Row }> | undefined}
              />
            )}
            cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
          />

          {/* Range band: an invisible floor at `lower`, then the visible
              height up to `upper`. */}
          <Area
            dataKey="bandBase"
            stackId="range"
            stroke="none"
            fill="transparent"
            isAnimationActive={false}
            activeDot={false}
          />
          <Area
            dataKey="band"
            stackId="range"
            stroke="none"
            fill={SERIES[2]}
            fillOpacity={0.2}
            isAnimationActive={false}
            activeDot={false}
          />

          <Line
            type="monotone"
            dataKey="predicted"
            stroke={SERIES[2]}
            strokeWidth={2.5}
            strokeDasharray="6 4"
            dot={{ r: 3, fill: SERIES[2], strokeWidth: 0 }}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHART.surface }}
            connectNulls={false}
            isAnimationActive
            animationDuration={600}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={SERIES[0]}
            strokeWidth={2.5}
            dot={AnomalyDot}
            activeDot={{ r: 4.5, strokeWidth: 2, stroke: CHART.surface }}
            connectNulls={false}
            isAnimationActive
            animationDuration={600}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
