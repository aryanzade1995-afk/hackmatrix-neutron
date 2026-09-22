"use client";

import { useEffect, useState } from "react";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { useSignalChime } from "@/lib/useSignalChime";
import type { TrendSignal } from "@/lib/adminData";

/**
 * Turns the signal chime on, and proves it works.
 *
 * The "hear it" button matters more than it looks. A chime that only fires on
 * a new outbreak cannot be demonstrated on demand — you would be asking a
 * roomful of judges to take on faith that the speaker is connected and the
 * volume is up. One click removes that.
 *
 * It is labelled as a test rather than dressed up as a real alert, because a
 * demo that fakes its own alerts is exactly the kind of thing this project
 * spends the rest of its effort not doing.
 */

/** Scales total weekly volume onto a narrow, low pitch range. */
function droneHz(caseCount: number): number {
  const floor = 96;
  const ceiling = 132;
  // Log scale: case counts vary by orders of magnitude between demo data and
  // a real division, and a linear map would peg the pitch at one end.
  const t = Math.min(1, Math.log10(Math.max(1, caseCount)) / 4);
  return floor + (ceiling - floor) * t;
}

export function SoundToggle({
  signals,
  totalCases,
}: {
  signals: TrendSignal[];
  totalCases: number;
}) {
  const [enabled, setEnabled] = useState(false);
  const { chime, setDrone, context, lastChimeAt } = useSignalChime(signals, enabled);
  const [justChimed, setJustChimed] = useState(false);

  useEffect(() => {
    if (!enabled || totalCases <= 0) return;
    setDrone(droneHz(totalCases));
  }, [enabled, totalCases, setDrone]);

  useEffect(() => {
    if (lastChimeAt === null) return;
    setJustChimed(true);
    const id = setTimeout(() => setJustChimed(false), 1400);
    return () => clearTimeout(id);
  }, [lastChimeAt]);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    // The click is the gesture the autoplay policy wants; resume inside it.
    if (next) void context()?.resume();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={enabled}
        title={
          enabled
            ? "Sound on — a chime plays when a new signal appears"
            : "Sound off. Nothing plays until you turn this on."
        }
        className={`transition-calm inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] ${
          enabled
            ? "border-sage bg-success-tint text-ink"
            : "border-border text-ink-muted hover:bg-canvas"
        }`}
      >
        {enabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
        {enabled ? "Sound on" : "Sound off"}
      </button>

      {enabled && (
        <button
          type="button"
          onClick={chime}
          title="Play the alert chime now, so you know the sound works"
          className={`transition-calm inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:bg-canvas ${
            justChimed ? "bg-success-tint" : ""
          }`}
        >
          <Bell className={`h-3 w-3 ${justChimed ? "animate-pulse" : ""}`} />
          Hear it
        </button>
      )}
    </div>
  );
}
