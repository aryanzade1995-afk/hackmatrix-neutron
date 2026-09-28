"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Loader2,
  Mic,
  MicOff,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import {
  COMPLAINT_OPTIONS,
  FOOD_OPTIONS,
  FREQUENCY_OPTIONS,
  VOICE_SCENARIOS,
  type DraftMedicine,
  type VoiceDraft,
} from "@/lib/voiceScenarios";

/**
 * Voice entry for the New Visit form.
 *
 * READY → RECORDING → PROCESSING → REVIEW. Recording uses the real microphone
 * when the browser allows it — the waveform is drawn from the live input —
 * and falls back to a demo recording when it does not, so a refused
 * permission never blocks the flow. The audio itself is never stored or sent
 * anywhere: transcription and field extraction are simulated from the sample
 * dictations in lib/voiceScenarios.ts.
 *
 * Nothing leaves this panel until the clinician presses Apply, and even then
 * it only fills the ordinary form. Saving is still the form's own Save visit.
 */

type Phase = "ready" | "requesting" | "recording" | "processing" | "review" | "denied";
type Source = "mic" | "demo";

const BARS = 32;
const MAX_SECONDS = 90;
const TRANSCRIBE_MS = 900;
const STRUCTURE_MS = 1000;

const STATUS: Record<Phase, { label: string; tone: string }> = {
  ready: { label: "Ready", tone: "bg-canvas text-ink-muted ring-1 ring-inset ring-border" },
  requesting: { label: "Waiting for microphone…", tone: "bg-canvas text-ink-muted ring-1 ring-inset ring-border" },
  recording: { label: "Listening…", tone: "bg-danger-tint text-danger" },
  processing: { label: "Processing…", tone: "bg-warning-tint text-warning" },
  review: { label: "Draft ready", tone: "bg-success-tint text-success" },
  denied: { label: "Microphone unavailable", tone: "bg-warning-tint text-warning" },
};

const fieldClass =
  "transition-calm w-full rounded-xl bg-canvas px-3.5 py-2 text-[13.5px] text-ink ring-1 ring-inset ring-border placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-sage";

function clock(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function micError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Microphone permission was denied. Allow it in the browser to dictate, or continue with the demo recording.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No microphone was found on this device.";
  if (name === "NotReadableError")
    return "The microphone is being used by another application.";
  return err instanceof Error ? err.message : "The microphone could not be started.";
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Waveform({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    <div className="flex h-16 items-center justify-center gap-[3px]" aria-hidden>
      {levels.map((l, i) => (
        <span
          key={i}
          className={`w-[4px] rounded-full transition-[height] duration-100 ${
            active ? "bg-forest-mid" : "bg-border-strong"
          }`}
          style={{ height: `${Math.max(8, Math.round(l * 100))}%` }}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-label text-ink-faint">
        {label}
      </span>
      {children}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function VoiceEntry({
  scenarioIndex,
  onRecorded,
  onClose,
  onApply,
}: {
  /** Which sample dictation the next recording is matched to. */
  scenarioIndex: number;
  /** Called once per completed recording, so the parent can move the cycle on. */
  onRecorded: () => void;
  onClose: () => void;
  onApply: (draft: VoiceDraft) => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [source, setSource] = useState<Source>("mic");
  const [sample, setSample] = useState(scenarioIndex % VOICE_SCENARIOS.length);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));
  const [stage, setStage] = useState(0);
  const [shownWords, setShownWords] = useState(0);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scenario = VOICE_SCENARIOS[sample];
  const words = scenario.transcript.split(" ");

  // Live resources, kept in refs so cleanup can always reach them.
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const frame = useRef<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAt = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const releaseMedia = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    try {
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    } catch {
      /* already stopped */
    }
    recorder.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    analyser.current = null;
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // Everything is released on close, whatever state it was in.
  useEffect(
    () => () => {
      releaseMedia();
      clearTimers();
    },
    [releaseMedia, clearTimers],
  );

  // Modal behaviour: Escape closes, the page behind does not scroll. Runs
  // once — the latest onClose is read through a ref.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  /** Samples the waveform and the timer once per animation frame. */
  const tick = useCallback((kind: Source) => {
    const buffer = new Uint8Array(1024);
    let lastPush = 0;
    let lastSecond = -1;

    const loop = (now: number) => {
      const seconds = (now - startedAt.current) / 1000;
      // The clock shows whole seconds, so it only re-renders when one passes.
      if (Math.floor(seconds) !== lastSecond) {
        lastSecond = Math.floor(seconds);
        setElapsed(lastSecond);
      }

      if (now - lastPush > 70) {
        lastPush = now;
        let level: number;
        if (kind === "mic" && analyser.current) {
          analyser.current.getByteTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128;
            sum += v * v;
          }
          // RMS of speech sits well below 1; scale it into a readable bar.
          level = Math.min(1, Math.sqrt(sum / buffer.length) * 4.5);
        } else {
          // Demo: syllable-like bursts under a slower phrase envelope.
          const phrase = 0.55 + 0.45 * Math.sin(seconds * 1.7);
          const syllable = Math.abs(Math.sin(seconds * 9.3) * Math.sin(seconds * 4.1 + 1));
          const pause = Math.sin(seconds * 0.9) > 0.85 ? 0.15 : 1;
          level = Math.min(1, 0.12 + phrase * syllable * pause * 0.95);
        }
        setLevels((prev) => [...prev.slice(1), level]);
      }

      if (seconds >= MAX_SECONDS) {
        stopRef.current();
        return;
      }
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
  }, []);

  const beginRecording = useCallback(
    (kind: Source) => {
      setSource(kind);
      setError(null);
      setElapsed(0);
      setLevels(Array(BARS).fill(0.08));
      startedAt.current = performance.now();
      setPhase("recording");
      tick(kind);
    },
    [tick],
  );

  const startMic = useCallback(async () => {
    setPhase("requesting");
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not offer microphone access on this page.");
      setPhase("denied");
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const node = ctx.createAnalyser();
        node.fftSize = 1024;
        ctx.createMediaStreamSource(s).connect(node);
        audioCtx.current = ctx;
        analyser.current = node;
      }
      // Recorded locally so the microphone behaves as it would in a real
      // dictation; the chunks are discarded, never uploaded.
      if (typeof MediaRecorder !== "undefined") {
        try {
          const r = new MediaRecorder(s);
          r.start();
          recorder.current = r;
        } catch {
          recorder.current = null;
        }
      }
      beginRecording("mic");
    } catch (err) {
      releaseMedia();
      setError(micError(err));
      setPhase("denied");
    }
  }, [beginRecording, releaseMedia]);

  const stop = useCallback(() => {
    releaseMedia();
    clearTimers();
    onRecorded();
    setPhase("processing");
    setStage(0);
    setShownWords(0);

    timers.current.push(
      setTimeout(() => {
        setStage(1);
        // The transcript arrives word by word while the fields are structured.
        const perWord = (STRUCTURE_MS * 0.8) / words.length;
        words.forEach((_, i) =>
          timers.current.push(setTimeout(() => setShownWords(i + 1), perWord * (i + 1))),
        );
      }, TRANSCRIBE_MS),
      setTimeout(() => {
        setShownWords(words.length);
        setDraft(JSON.parse(JSON.stringify(scenario.draft)) as VoiceDraft);
        setPhase("review");
      }, TRANSCRIBE_MS + STRUCTURE_MS),
    );
  }, [releaseMedia, clearTimers, onRecorded, words, scenario]);
  stopRef.current = stop;

  /** Back to Ready with the same sample — for Cancel during a recording. */
  const cancelRecording = useCallback(() => {
    releaseMedia();
    clearTimers();
    setPhase("ready");
  }, [releaseMedia, clearTimers]);

  /** Record again: back to Ready, moved on to the next sample dictation. */
  const restart = useCallback(() => {
    releaseMedia();
    clearTimers();
    setDraft(null);
    setError(null);
    setStage(0);
    setShownWords(0);
    setSample((s) => (s + 1) % VOICE_SCENARIOS.length);
    setPhase("ready");
  }, [releaseMedia, clearTimers]);

  const update = <K extends keyof VoiceDraft>(key: K, value: VoiceDraft[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  const updateMedicine = (i: number, patch: Partial<DraftMedicine>) =>
    setDraft((d) =>
      d ? { ...d, medicines: d.medicines.map((m, j) => (j === i ? { ...m, ...patch } : m)) } : d,
    );

  const status = STATUS[phase];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      style={{ background: "rgba(9, 22, 16, 0.48)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-entry-title"
        tabIndex={-1}
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-card-lift focus:outline-none sm:rounded-2xl"
      >
        {/* ------------------------------------------------------ Header */}
        <header className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-border px-6 py-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-tint-strong">
            <Mic className="h-[18px] w-[18px] text-forest-mid" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="voice-entry-title" className="text-display text-[19px] text-ink">
              Voice entry
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-muted">
              <Sparkles className="h-3 w-3 text-forest-mid" />
              AI-assisted record extraction · you verify every field
            </p>
          </div>
          {/* Its own line under the title on phones, beside it from sm up. */}
          <div className="order-last basis-full pl-12 sm:order-none sm:basis-auto sm:pl-0">
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${status.tone}`}
              role="status"
              aria-live="polite"
            >
              {phase === "recording" && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
              )}
              {status.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close voice entry"
            className="transition-calm -mr-1.5 rounded-lg p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {/* ------------------------------------------------------ Ready */}
          {(phase === "ready" || phase === "requesting") && (
            <div className="flex flex-col items-center text-center">
              <span className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-sage-tint" />
                <span className="absolute inset-2 rounded-full bg-sage-tint-strong" />
                <Mic className="relative h-8 w-8 text-forest" />
              </span>
              <p className="mt-5 text-[15px] font-semibold text-ink">Dictate the consultation</p>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
                Speak the complaint, findings, diagnosis and medicines. A draft is prepared for
                you to check — nothing is added to the visit until you apply it.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void startMic()}
                  disabled={phase === "requesting"}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep disabled:opacity-60"
                >
                  {phase === "requesting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                  {phase === "requesting" ? "Allow the microphone…" : "Start recording"}
                </button>
                <button
                  type="button"
                  onClick={() => beginRecording("demo")}
                  disabled={phase === "requesting"}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink disabled:opacity-60"
                >
                  <AudioLines className="h-4 w-4" />
                  Use demo recording
                </button>
              </div>

              <label className="mt-6 flex items-center gap-2 text-[12px] text-ink-faint">
                Sample dictation
                <select
                  value={sample}
                  onChange={(e) => setSample(Number(e.target.value))}
                  className="rounded-lg bg-canvas px-2 py-1 text-[12px] text-ink-muted ring-1 ring-inset ring-border focus:outline-none focus:ring-sage"
                >
                  {VOICE_SCENARIOS.map((s, i) => (
                    <option key={s.id} value={i}>
                      {i + 1}. {s.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* --------------------------------------------------- Recording */}
          {phase === "recording" && (
            <div className="flex flex-col items-center text-center">
              <span className="relative flex h-20 w-20 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-danger-tint" />
                <span className="absolute inset-2 rounded-full bg-danger-tint" />
                <Mic className="relative h-8 w-8 text-danger" />
              </span>
              <p className="mt-5 flex items-center gap-2 text-[14px] font-semibold text-danger">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                Recording
              </p>
              <p className="nums mt-1 text-[28px] font-semibold text-ink">{clock(elapsed)}</p>
              <p className="mt-1 text-[12px] text-ink-faint">
                {source === "mic"
                  ? "Listening to your microphone — the audio stays on this device"
                  : `Demo recording · ${scenario.title}`}
              </p>

              <div className="mt-5 w-full max-w-md">
                <Waveform levels={levels} active />
              </div>

              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={stop}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl bg-danger px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:opacity-90"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop recording
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* -------------------------------------------------- Processing */}
          {phase === "processing" && (
            <div>
              <ol className="space-y-3">
                {["Transcribing clinical note…", "Structuring clinical information…"].map(
                  (label, i) => (
                    <li key={label} className="flex items-center gap-3 text-[13.5px]">
                      {stage > i ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : stage === i ? (
                        <Loader2 className="h-4 w-4 animate-spin text-forest-mid" />
                      ) : (
                        <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-border-strong" />
                      )}
                      <span className={stage >= i ? "font-medium text-ink" : "text-ink-faint"}>
                        {label}
                      </span>
                    </li>
                  ),
                )}
              </ol>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-canvas">
                <div
                  className="surveil-progress h-full rounded-full bg-gradient-to-r from-sage to-forest-mid"
                  style={{ ["--surveil-ms" as string]: `${TRANSCRIBE_MS + STRUCTURE_MS}ms` }}
                />
              </div>
              <div className="mt-5 min-h-[96px] rounded-xl bg-canvas px-4 py-3.5">
                <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
                  Transcript
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink">
                  {stage === 0 ? (
                    <span className="text-ink-faint">Converting speech to text…</span>
                  ) : (
                    words.slice(0, shownWords).join(" ")
                  )}
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ Denied */}
          {phase === "denied" && (
            <div className="flex flex-col items-center text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-tint">
                <MicOff className="h-7 w-7 text-warning" />
              </span>
              <p className="mt-4 text-[15px] font-semibold text-ink">Microphone not available</p>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-muted">{error}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => beginRecording("demo")}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
                >
                  <AudioLines className="h-4 w-4" />
                  Use demo recording
                </button>
                <button
                  type="button"
                  onClick={() => void startMic()}
                  className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try the microphone again
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------ Review */}
          {phase === "review" && draft && (
            <div className="animate-[fadeIn_240ms_ease-out]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-tint px-2.5 py-1 text-[11px] font-semibold uppercase tracking-label text-warning">
                  <Sparkles className="h-3 w-3" />
                  AI generated draft
                </span>
                <span className="text-[12px] text-ink-faint">from {clock(elapsed)} of dictation</span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-ink-muted">
                Review generated information before adding it to the visit. Every field below
                can be changed, and the diagnosis is taken from what was dictated — it is not
                suggested by the system.
              </p>

              <details className="mt-4 rounded-xl bg-canvas px-4 py-3 text-[13px]">
                <summary className="cursor-pointer text-[12px] font-semibold text-ink-muted">
                  Transcript
                </summary>
                <p className="mt-2 leading-relaxed text-ink">{scenario.transcript}</p>
              </details>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Chief complaint">
                  <input
                    value={draft.complaint}
                    onChange={(e) => update("complaint", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Duration">
                  <input
                    value={draft.complaintDuration}
                    onChange={(e) => update("complaintDuration", e.target.value)}
                    placeholder="Not dictated"
                    className={fieldClass}
                  />
                </Field>
                <Field label="Record under">
                  <select
                    value={draft.complaintId}
                    onChange={(e) => update("complaintId", e.target.value)}
                    className={fieldClass}
                  >
                    {COMPLAINT_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Diagnosis (as dictated)">
                  <input
                    value={draft.diagnosis}
                    onChange={(e) => update("diagnosis", e.target.value)}
                    className={fieldClass}
                  />
                </Field>
              </div>

              <div className="mt-4 grid grid-cols-3 items-end gap-3">
                <Field label="Temperature °F">
                  <input
                    inputMode="decimal"
                    value={draft.temperatureF}
                    onChange={(e) => update("temperatureF", e.target.value)}
                    placeholder="—"
                    className={`${fieldClass} nums`}
                  />
                </Field>
                <Field label="Blood pressure">
                  <input
                    value={draft.bloodPressure}
                    onChange={(e) => update("bloodPressure", e.target.value)}
                    placeholder="—"
                    className={`${fieldClass} nums`}
                  />
                </Field>
                <Field label="Heart rate">
                  <input
                    inputMode="numeric"
                    value={draft.heartRate}
                    onChange={(e) => update("heartRate", e.target.value)}
                    placeholder="—"
                    className={`${fieldClass} nums`}
                  />
                </Field>
              </div>

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-label text-ink-faint">
                  Prescription
                </p>
                <div className="mt-2 space-y-3">
                  {draft.medicines.map((m, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 gap-3 rounded-xl border border-border px-4 py-3.5 sm:grid-cols-6"
                    >
                      <Field label="Medicine" className="sm:col-span-2">
                        <input
                          value={m.drug}
                          onChange={(e) => updateMedicine(i, { drug: e.target.value })}
                          className={fieldClass}
                        />
                      </Field>
                      <Field label="Dose">
                        <input
                          value={m.dose}
                          onChange={(e) => updateMedicine(i, { dose: e.target.value })}
                          className={`${fieldClass} nums`}
                        />
                      </Field>
                      <Field label="Duration">
                        <input
                          value={m.duration}
                          onChange={(e) => updateMedicine(i, { duration: e.target.value })}
                          className={fieldClass}
                        />
                      </Field>
                      <Field label="Frequency" className="sm:col-span-2">
                        <select
                          value={m.frequency}
                          onChange={(e) =>
                            updateMedicine(i, {
                              frequency: e.target.value as DraftMedicine["frequency"],
                            })
                          }
                          className={fieldClass}
                        >
                          {FREQUENCY_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Instructions" className="col-span-2 sm:col-span-5">
                        <select
                          value={m.instructions}
                          onChange={(e) =>
                            updateMedicine(i, {
                              instructions: e.target.value as DraftMedicine["instructions"],
                            })
                          }
                          className={fieldClass}
                        >
                          {FOOD_OPTIONS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="col-span-2 flex items-end justify-end sm:col-span-1">
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) =>
                              d ? { ...d, medicines: d.medicines.filter((_, j) => j !== i) } : d,
                            )
                          }
                          aria-label={`Remove ${m.drug || "medicine"}`}
                          className="transition-calm inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[12px] text-ink-faint hover:bg-canvas hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              medicines: [
                                ...d.medicines,
                                {
                                  drug: "",
                                  dose: "",
                                  frequency: "Twice daily",
                                  instructions: "After food",
                                  duration: "3 days",
                                },
                              ],
                            }
                          : d,
                      )
                    }
                    className="transition-calm inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add a medicine
                  </button>
                </div>
              </div>

              <Field label="Notes" className="mt-5">
                <textarea
                  value={draft.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  rows={2}
                  placeholder="Anything else from the dictation"
                  className={`${fieldClass} resize-y`}
                />
              </Field>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------ Footer */}
        {phase === "review" && draft && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClose}
                className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={restart}
                className="transition-calm inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-ink-muted hover:bg-canvas hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Record again
              </button>
            </div>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
            >
              <Check className="h-4 w-4" />
              Apply to Visit Form
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
