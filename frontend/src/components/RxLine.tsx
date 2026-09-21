import { Badge } from "./Badge";
import {
  formatDuration,
  formatFrequency,
  frequencyShorthand,
  quantityUnit,
  type Prescription,
} from "@/lib/prescribing";
import { TriangleAlert } from "lucide-react";

/**
 * One prescription, rendered the way it reads on a slip:
 *
 *   Amoxicillin 500mg · Cap
 *   1-0-1 (TDS) · After food · 5 days · 15 capsules
 */
export function RxLine({
  prescription: p,
  conflict = false,
  className = "",
}: {
  prescription: Prescription;
  conflict?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 ${
        conflict
          ? "bg-danger-tint ring-1 ring-inset ring-danger"
          : "bg-canvas ring-1 ring-inset ring-border"
      } ${className}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`text-[14px] font-semibold ${conflict ? "text-danger" : "text-ink"}`}
        >
          {p.drug} {p.strength}
        </span>
        <span className="text-[11.5px] text-ink-faint">
          {p.form}
          {p.route !== "Oral" && ` · ${p.route}`}
        </span>
        {conflict && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-danger">
            <TriangleAlert className="h-3 w-3" />
            allergy conflict
          </span>
        )}
      </div>

      <div className="nums mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-ink-muted">
        <span className="font-semibold text-forest-mid">
          {formatFrequency(p.frequency)}
        </span>
        <span className="text-ink-faint">({frequencyShorthand(p.frequency)})</span>
        <span className="text-border-strong">·</span>
        <span>{p.food}</span>
        <span className="text-border-strong">·</span>
        <span>{formatDuration(p.durationDays)}</span>
        <span className="text-border-strong">·</span>
        <span className="text-ink-faint">
          {p.quantity} {quantityUnit(p.form, p.quantity)}
        </span>
      </div>

      {p.instruction && (
        <p className="mt-1.5 text-[12px] italic text-ink-muted">{p.instruction}</p>
      )}
    </div>
  );
}

/** Compact form for timelines, where space is tight. */
export function RxBadge({
  prescription: p,
  conflict = false,
}: {
  prescription: Prescription;
  conflict?: boolean;
}) {
  const label = `${p.drug} ${p.strength} · ${formatFrequency(p.frequency)} · ${formatDuration(
    p.durationDays,
  )}`;

  if (conflict) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-tint px-2.5 py-1 text-[11.5px] font-semibold text-danger ring-1 ring-inset ring-danger">
        <TriangleAlert className="h-3 w-3" />
        Rx · {label}
      </span>
    );
  }
  return <Badge tone="neutral">Rx · {label}</Badge>;
}
