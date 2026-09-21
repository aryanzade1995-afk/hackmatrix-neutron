"use client";

import { useState } from "react";
import { Chip } from "./Chip";
import { SectionLabel } from "./Card";
import {
  DURATION_PRESETS,
  FOOD_OPTIONS,
  FREQUENCY_PRESETS,
  buildPrescription,
  formatDuration,
  formatFrequency,
  frequencyShorthand,
  quantityFor,
  quantityUnit,
  type Prescription,
} from "@/lib/prescribing";
import type { FoodTiming, Frequency, MedicineOption } from "@/lib/formulary";
import { Baby, Check, Info, X } from "lucide-react";

/**
 * Stage two of the picker. The medicine is chosen; this turns it into a
 * dispensable line — strength, schedule, food timing, duration — with the
 * quantity computed rather than typed.
 */
export function DoseBuilder({
  medicine,
  isChild,
  onAdd,
  onCancel,
}: {
  medicine: MedicineOption;
  isChild: boolean;
  onAdd: (p: Prescription) => void;
  onCancel: () => void;
}) {
  const [strength, setStrength] = useState(medicine.strengths[0]);
  const [frequency, setFrequency] = useState<Frequency>(medicine.defaultFrequency);
  const [food, setFood] = useState<FoodTiming>(medicine.defaultFood);
  const [durationDays, setDurationDays] = useState<number | null>(
    medicine.defaultDurationDays,
  );

  const quantity = quantityFor(medicine.form, frequency, durationDays);

  return (
    <div className="rounded-2xl border border-border-strong bg-sage-tint px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-display text-[19px] text-ink">{medicine.drug}</p>
          <p className="mt-1 text-[12px] text-ink-muted">
            {medicine.category} · {medicine.form} · {medicine.route}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="transition-calm rounded-lg p-1.5 text-ink-faint hover:bg-surface hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isChild && medicine.paediatricRule && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface px-4 py-3">
          <Baby className="mt-0.5 h-4 w-4 shrink-0 text-forest-mid" />
          <div>
            <p className="text-[12.5px] font-semibold text-ink">
              Paediatric reference · {medicine.paediatricRule}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
              Shown for reference only — the dose is not calculated for you.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-5">
        {medicine.strengths.length > 1 && (
          <div>
            <SectionLabel>Strength</SectionLabel>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {medicine.strengths.map((s) => (
                <Chip
                  key={s}
                  label={s}
                  selected={strength === s}
                  onClick={() => setStrength(s)}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>Schedule · morning-afternoon-night</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {FREQUENCY_PRESETS.map((f) => (
              <Chip
                key={f.label}
                label={f.label}
                selected={formatFrequency(frequency) === f.label}
                onClick={() => setFrequency(f.value)}
              />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Timing</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {FOOD_OPTIONS.map((f) => (
              <Chip key={f} label={f} selected={food === f} onClick={() => setFood(f)} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Duration</SectionLabel>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {DURATION_PRESETS.map((d) => (
              <Chip
                key={d.label}
                label={d.label}
                selected={durationDays === d.value}
                onClick={() => setDurationDays(d.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Computed, so nobody has to do arithmetic at the counter */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-border-strong pt-4">
        <p className="nums text-[13px] text-ink">
          <span className="font-semibold">
            {strength} · {formatFrequency(frequency)}
          </span>
          <span className="text-ink-muted">
            {" "}
            ({frequencyShorthand(frequency)}) · {food} · {formatDuration(durationDays)}
          </span>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11.5px] font-semibold text-forest-mid">
            <Info className="h-3 w-3" />
            dispense {quantity} {quantityUnit(medicine.form, quantity)}
          </span>
        </p>

        <button
          type="button"
          onClick={() =>
            onAdd(
              buildPrescription(medicine, { strength, frequency, food, durationDays }),
            )
          }
          className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
        >
          <Check className="h-4 w-4" />
          Add to prescription
        </button>
      </div>
    </div>
  );
}
