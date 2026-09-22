"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { verifyChain, type AccessLogEntry, type VerifyResult } from "@/lib/auditLog";

/**
 * The access log drawn as what it actually is: a chain.
 *
 * The list below this shows the same rows as readable events. This shows the
 * structure — each block carrying the digest of the one before it — because
 * "tamper-evident" is a claim about structure, and a table of timestamps does
 * not look like one.
 *
 * The verification is real. It calls GET /clinician/access-log/verify, which
 * recomputes every hash server-side from the stored columns and reports the
 * first row whose digest no longer matches. The animation only paces the
 * result; it never decides it. If the endpoint says the chain broke at #7,
 * this walks to #7 and stops there.
 */

type Status = "idle" | "pending" | "ok" | "broken" | "suspect";

/** How long each block dwells before the next lights up. */
const STEP_MS = 90;

function shorten(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function ChainBlocks({ entries }: { entries: AccessLogEntry[] }) {
  // The API hands rows back newest-first; a chain reads oldest-first.
  const ordered = [...entries].sort((a, b) => a.id - b.id);

  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const run = useCallback(async () => {
    clearTimers();
    setChecking(true);
    setResult(null);
    setFailed(false);
    setCursor(null);

    const verdict = await verifyChain();
    setChecking(false);

    if (!verdict) {
      setFailed(true);
      return;
    }
    setResult(verdict);

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const stopAt = verdict.valid
      ? ordered.length
      : Math.max(
          1,
          ordered.findIndex((e) => e.id === verdict.brokenAtId) + 1,
        );

    if (reduced) {
      setCursor(stopAt);
      return;
    }

    for (let i = 1; i <= stopAt; i += 1) {
      timers.current.push(setTimeout(() => setCursor(i), i * STEP_MS));
    }
  }, [ordered]);

  const statusOf = (index: number): Status => {
    if (cursor === null) return "idle";
    const position = index + 1;
    if (position < cursor) return "ok";
    if (position > cursor) {
      // Past a confirmed break, nothing downstream can be trusted — its hash
      // was computed over a predecessor that no longer matches.
      return result && !result.valid ? "suspect" : "pending";
    }
    return result && !result.valid ? "broken" : "ok";
  };

  const STYLE: Record<Status, string> = {
    idle: "border-border bg-surface",
    pending: "border-border bg-surface opacity-55",
    ok: "border-success bg-success-tint",
    broken: "border-danger bg-danger-tint",
    suspect: "border-border bg-canvas opacity-55",
  };

  if (ordered.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader
        eyebrow={
          <Badge tone="sage">
            <Link2 className="h-3 w-3" />
            Hash chain
          </Badge>
        }
        title="The chain itself"
        subtitle="Each block stores the digest of the block before it. Change any entry and every digest after it stops matching."
        action={
          <button
            type="button"
            onClick={run}
            disabled={checking}
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-mid disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            {checking ? "Verifying…" : "Verify chain integrity"}
          </button>
        }
      />

      <div className="overflow-x-auto px-7 pb-2">
        <div className="flex min-w-min items-stretch gap-0 pb-3">
          {/* Genesis: the anchor the first real block commits to. */}
          <div className="flex shrink-0 flex-col justify-center pr-1">
            <div className="rounded-lg border border-dashed border-border px-3 py-2.5 text-center">
              <p className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                Genesis
              </p>
              <p className="nums mt-1 font-mono text-[10.5px] text-ink-faint">
                0000…0000
              </p>
            </div>
          </div>

          {ordered.map((entry, i) => {
            const status = statusOf(i);
            return (
              <div key={entry.id} className="flex shrink-0 items-center">
                <span
                  className={`h-px w-4 shrink-0 ${
                    status === "ok" ? "bg-success" : "bg-border"
                  }`}
                />
                <div
                  className={`transition-calm w-[148px] rounded-xl border px-3 py-2.5 ${STYLE[status]}`}
                  title={`Entry #${entry.id} — ${entry.actor}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="nums text-[11.5px] font-semibold text-ink">
                      #{entry.id}
                    </span>
                    {status === "ok" && (
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    )}
                    {status === "broken" && (
                      <TriangleAlert className="h-3.5 w-3.5 text-danger" />
                    )}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-ink-muted">
                    {entry.action === "emergency_access" ? "break-glass" : "viewed"}
                    {entry.outcome === "denied" ? " · denied" : ""}
                  </p>
                  <p className="nums mt-1.5 truncate font-mono text-[10px] text-ink-faint">
                    {shorten(entry.hash)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------- Verdict */}
      <div className="border-t border-border px-7 py-5">
        {failed && (
          <p className="text-[13px] text-warning">
            Verification needs the backend connected — nothing is claimed about
            the chain while it is unreachable.
          </p>
        )}

        {!failed && !result && (
          <p className="text-[12.5px] leading-relaxed text-ink-muted">
            Verification recomputes every hash on the server from the stored
            columns, then compares. Nothing in this page decides the answer.
          </p>
        )}

        {result?.valid && (
          <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              <span className="font-semibold text-ink">
                {result.rowsChecked}{" "}
                {result.rowsChecked === 1 ? "entry" : "entries"} verified — chain
                intact.
              </span>{" "}
              Every digest was recomputed from its own fields plus its
              predecessor&apos;s hash, and all of them matched. The log is also
              append-only at the database: neither role holds an UPDATE or
              DELETE grant on this table, so rewriting a block requires
              administrator access to Postgres itself — and would still show up
              here.
            </span>
          </p>
        )}

        {result && !result.valid && (
          <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-muted">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>
              <span className="font-semibold text-danger">
                Break detected at entry #{result.brokenAtId}.
              </span>{" "}
              {result.detail ??
                "This entry no longer matches its recorded hash."}{" "}
              Everything after it is shown dimmed because it cannot be trusted
              either — each of those blocks committed to a predecessor that has
              since changed.
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
