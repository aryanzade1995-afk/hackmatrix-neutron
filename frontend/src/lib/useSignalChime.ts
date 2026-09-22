"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TrendSignal } from "@/lib/adminData";

/**
 * A two-note chime when a signal appears that was not there before.
 *
 * Sound is for the thing you are not looking at. A public-health desk has this
 * dashboard open on a second monitor all day; the chime is what makes a new
 * outbreak signal reach someone whose eyes are elsewhere. That is the whole
 * feature — the ambient drone below it is decoration and is kept quiet enough
 * to ignore.
 *
 * Muted by default and silent until the user clicks. Browsers will not let an
 * AudioContext start without a gesture, and that policy is right: a dashboard
 * that makes noise at a stranger unprompted is a dashboard people mute
 * permanently and then miss the one alert that mattered.
 *
 * Nothing here is persisted. The choice lasts as long as the page does.
 */

/** A minor third, rising. Two notes read as "attend", not as "well done". */
const NOTE_HZ = [587.33, 698.46]; // D5, F5

/** Identity of a signal for "is this one new?" — not its magnitude. */
function keyOf(signal: TrendSignal): string {
  return `${signal.district}|${signal.diagnosis}|${signal.week}`;
}

export function useSignalChime(signals: TrendSignal[], enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const droneRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  // What we had last time. Undefined until the first batch arrives, so the
  // initial load never chimes — every signal is "new" on a fresh page, and a
  // dashboard that sounds an alarm merely because someone opened it is a
  // dashboard that has taught its user to ignore alarms.
  const seenRef = useRef<Set<string> | null>(null);
  const [lastChimeAt, setLastChimeAt] = useState<number | null>(null);

  const context = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current;
  }, []);

  /** Two short sine notes. Exported so the toggle can prove it works. */
  const chime = useCallback(() => {
    const ctx = context();
    if (!ctx) return;
    void ctx.resume();

    NOTE_HZ.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.13;

      osc.type = "sine";
      osc.frequency.value = hz;

      // Ramps rather than steps: an instant gain change is an audible click.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.13, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });

    setLastChimeAt(Date.now());
  }, [context]);

  // --- new-signal detection ------------------------------------------------
  useEffect(() => {
    if (signals.length === 0 && seenRef.current === null) return;

    const now = new Set(signals.map(keyOf));

    if (seenRef.current === null) {
      seenRef.current = now; // first batch: remember, do not announce
      return;
    }

    const fresh = [...now].filter((k) => !seenRef.current?.has(k));
    seenRef.current = now;

    if (fresh.length > 0 && enabled) chime();
  }, [signals, enabled, chime]);

  // --- ambient drone -------------------------------------------------------
  /** Quiet, and only while enabled. Pitch is set by the caller. */
  const setDrone = useCallback(
    (hz: number | null) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      if (hz === null) {
        if (droneRef.current) {
          droneRef.current.gain.gain.exponentialRampToValueAtTime(
            0.0001,
            ctx.currentTime + 0.3,
          );
          droneRef.current.osc.stop(ctx.currentTime + 0.35);
          droneRef.current = null;
        }
        return;
      }

      if (!droneRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        // 0.012 is roughly "audible in a quiet room, inaudible in a hall".
        gain.gain.exponentialRampToValueAtTime(0.012, ctx.currentTime + 1.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        droneRef.current = { osc, gain };
      } else {
        droneRef.current.osc.frequency.exponentialRampToValueAtTime(
          hz,
          ctx.currentTime + 0.8,
        );
      }
    },
    [],
  );

  // Stop everything when switched off, and on unmount — a drone that outlives
  // the page it belongs to is the worst bug this feature could have.
  useEffect(() => {
    if (!enabled) setDrone(null);
  }, [enabled, setDrone]);

  useEffect(
    () => () => {
      setDrone(null);
      void ctxRef.current?.close();
      ctxRef.current = null;
    },
    [setDrone],
  );

  return { chime, setDrone, context, lastChimeAt };
}
