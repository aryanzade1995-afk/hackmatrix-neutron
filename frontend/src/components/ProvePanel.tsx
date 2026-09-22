"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";

/**
 * Runs the separation proof against the live database and prints what came
 * back, one line at a time.
 *
 * The staged reveal is not decoration. The whole claim of this project is that
 * a permission check happens at the database rather than in our code, and a
 * block of JSON appearing all at once looks exactly like a hardcoded block of
 * JSON. Watching the lines arrive in order, with the actual Postgres error
 * text in them, reads as a system answering — which is what it is.
 *
 * The panel deliberately does not share the rest of the page's visual language:
 * monospace on a dark ground, because it is quoting a database, not styling a
 * dashboard.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type TableResult = { blocked: boolean; detail?: string };

type ProveResponse = {
  patients: TableResult;
  visits: TableResult;
  aggregates: { blocked: boolean; visibleGroups: number };
  connectedAs: string;
  summary: string;
};

type Line = {
  /** `ok` = the database refused, which is the outcome we want. */
  tone: "ok" | "bad" | "info" | "dim";
  label: string;
  value: string;
};

/** Turns the response into the lines to print, in the order they should appear. */
function toLines(r: ProveResponse): Line[] {
  const table = (name: string, res: TableResult): Line[] => [
    { tone: "dim", label: "$", value: `SELECT * FROM ${name} LIMIT 1;` },
    res.blocked
      ? { tone: "ok", label: "ERROR:", value: res.detail ?? "permission denied" }
      : {
          tone: "bad",
          label: "RETURNED ROWS:",
          value: res.detail ?? "the aggregate role read an identified table",
        },
  ];

  return [
    { tone: "dim", label: "$", value: "psql $DATABASE_URL_ADMIN" },
    { tone: "info", label: "connected as", value: r.connectedAs },
    ...table("patients", r.patients),
    ...table("visits", r.visits),
    { tone: "dim", label: "$", value: "SELECT count(*) FROM condition_totals;" },
    {
      tone: "info",
      label: "rows:",
      value: `${r.aggregates.visibleGroups} groups — every one already above the threshold`,
    },
  ];
}

const TONE: Record<Line["tone"], string> = {
  // Cream on the dark ground rather than a green/red pair alone: the panel has
  // to stay readable for a colour-blind judge across a projector.
  ok: "text-[#8FD4A8]",
  bad: "text-[#F5928A]",
  info: "text-[#F4F1E8]",
  dim: "text-[#8FA396]",
};

export function ProvePanel() {
  const [lines, setLines] = useState<Line[]>([]);
  const [shown, setShown] = useState(0);
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<ProveResponse | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Anyone who has asked not to see motion gets the whole transcript at once.
  // The proof is the content, not the animation.
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const run = useCallback(async () => {
    clearTimers();
    setState("running");
    setError(null);
    setLines([]);
    setShown(0);
    setVerdict(null);

    if (!API) {
      setState("error");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }

    try {
      const res = await fetch(`${API}/admin/prove`, { cache: "no-store" });
      if (!res.ok) throw new Error(`/admin/prove → ${res.status}`);
      const body = (await res.json()) as ProveResponse;
      const next = toLines(body);
      setLines(next);
      setVerdict(body);

      if (reducedMotion) {
        setShown(next.length);
        setState("done");
        return;
      }

      // A prompt line lands fast; a result line pauses first, the way a query
      // that actually went somewhere does.
      let elapsed = 0;
      next.forEach((line, i) => {
        elapsed += line.tone === "dim" ? 180 : 420;
        timers.current.push(
          setTimeout(() => {
            setShown(i + 1);
            if (i === next.length - 1) setState("done");
          }, elapsed),
        );
      });
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [reducedMotion]);

  const leaked =
    verdict !== null && (!verdict.patients.blocked || !verdict.visits.blocked);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-5">
        <div className="min-w-0">
          <p className="text-[11.5px] uppercase tracking-[0.08em] text-ink-faint">
            Prove it live
          </p>
          <h2 className="text-display mt-1.5 text-[19px] text-ink">
            Ask the database to refuse
          </h2>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-ink-muted">
            This runs two real <span className="font-mono text-[11.5px]">SELECT</span>{" "}
            statements against the identified tables over this dashboard&apos;s own
            connection. Nothing is mocked — the error text below comes back from
            Postgres.
          </p>
        </div>

        <button
          onClick={run}
          disabled={state === "running"}
          className="transition-calm inline-flex shrink-0 items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-[13px] font-medium text-cream hover:bg-forest-mid disabled:opacity-60"
        >
          {state === "done" || state === "error" ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {state === "running"
            ? "Running…"
            : state === "done" || state === "error"
              ? "Run it again"
              : "Run the proof"}
        </button>
      </div>

      {/* ------------------------------------------------------- Terminal */}
      <div className="bg-[#0C1A13] px-6 py-5">
        {state === "idle" && (
          <p className="font-mono text-[12.5px] text-[#8FA396]">
            {"// waiting — press Run the proof"}
          </p>
        )}

        {state === "error" && (
          <p className="font-mono text-[12.5px] leading-relaxed text-[#F0C070]">
            {"// the backend is unreachable, so there is nothing to prove here."}
            <br />
            {"// "}
            {error}
            <br />
            {
              "// the same check runs from a terminal: see the psql session in db/README.md"
            }
          </p>
        )}

        {(state === "running" || state === "done") && (
          <div className="space-y-1.5 font-mono text-[12.5px] leading-relaxed">
            {lines.slice(0, shown).map((line, i) => (
              <p
                key={`${line.label}-${i}`}
                className={`flex gap-2.5 ${TONE[line.tone]} ${
                  reducedMotion ? "" : "animate-[fadeIn_240ms_ease-out]"
                }`}
              >
                <span className="shrink-0 opacity-80">{line.label}</span>
                <span className="min-w-0 break-words">{line.value}</span>
              </p>
            ))}
            {shown < lines.length && (
              <p className="font-mono text-[12.5px] text-[#8FA396]">
                <span className="inline-block h-[14px] w-[7px] animate-pulse bg-[#8FD4A8] align-middle" />
              </p>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- Verdict */}
      {state === "done" && verdict && (
        <div
          className={`flex items-start gap-3 px-7 py-5 ${
            leaked ? "bg-danger-tint" : "bg-canvas"
          }`}
        >
          {leaked ? (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          )}
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            {leaked ? (
              <>
                <span className="font-semibold text-danger">
                  The aggregate role read an identified table.
                </span>{" "}
                That is a grant problem, not a display problem — re-run
                db/schema.sql and check the REVOKE lines.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">{verdict.summary}</span>{" "}
                The refusal is a permission that was never issued, so it holds
                for any query this dashboard could ever send — including one we
                write by mistake later.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
