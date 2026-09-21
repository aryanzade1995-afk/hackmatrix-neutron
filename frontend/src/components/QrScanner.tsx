"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, CameraOff, ImageUp, Loader2 } from "lucide-react";

/**
 * Reads a patient QR with the device camera.
 *
 * The code encodes only a patient id — the same string PatientQrPanel writes —
 * so a successful decode hands back that id and nothing else. Access is still
 * decided server-side by the scanner's role; the code itself grants nothing.
 *
 * A camera can always fail on stage: bad light, a webcam that will not focus,
 * a browser that blocks the permission prompt. Every failure here is reported
 * plainly so the simulated path stays available as a fallback.
 */

type Status = "idle" | "starting" | "scanning" | "error";

export function QrScanner({
  onDecode,
  className = "",
}: {
  onDecode: (value: string) => void;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  // useId rather than a random string: the value must match between the server
  // render and the client, or the library looks up an id the DOM never had.
  // Colons are stripped because they are awkward in selectors.
  const containerId = `qr-${useId().replace(/:/g, "")}`;
  // Holds the Html5Qrcode instance. Typed loosely because the library is
  // imported dynamically — it touches `navigator` and cannot run on the server.
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(
    null,
  );
  const decodedRef = useRef(false);

  async function start() {
    setStatus("starting");
    setError(null);
    decodedRef.current = false;

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          // A camera fires repeatedly on the same code; act once.
          if (decodedRef.current) return;
          decodedRef.current = true;
          void stop().then(() => onDecode(decodedText.trim()));
        },
        () => {
          // Per-frame "no code found" — normal, and far too noisy to surface.
        },
      );

      setStatus("scanning");
    } catch (err) {
      setStatus("error");
      setError(messageFor(err));
    }
  }

  async function stop() {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // Already stopped, or the page is unmounting. Nothing useful to do.
    }
    setStatus("idle");
  }

  /**
   * Decode from a still image instead of a live camera.
   *
   * Two reasons this exists. It is a third fallback when the camera will not
   * cooperate — the register screen downloads the QR as a PNG, and a phone
   * photo works equally well. And unlike the camera path it can be exercised
   * on a machine with no camera at all, which is how the decode path was
   * tested.
   */
  async function decodeFile(file: File) {
    setStatus("starting");
    setError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      const text = await scanner.scanFile(file, /* showImage */ false);
      scanner.clear();
      setStatus("idle");
      onDecode(text.trim());
    } catch {
      setStatus("error");
      setError("No QR code found in that image. Try a clearer photo of the code.");
    }
  }

  // Release the camera if the component goes away mid-scan.
  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  return (
    <div className={className}>
      {/* Kept mounted and measurable from "starting" onwards — html5-qrcode
          needs real dimensions to size the video, so display:none breaks it. */}
      <div
        id={containerId}
        className={`overflow-hidden rounded-xl ${
          status === "scanning" || status === "starting"
            ? "w-full max-w-[300px] bg-forest-deep"
            : "h-0 w-0"
        }`}
      />

      {status !== "scanning" && (
        <div className="flex flex-col items-center">
          {status === "starting" ? (
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting the camera…
            </span>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={start}
                className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
              >
                <Camera className="h-4 w-4" />
                {status === "error" ? "Try the camera again" : "Scan with camera"}
              </button>

              <label className="transition-calm inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-muted">
                <ImageUp className="h-3.5 w-3.5" />
                Upload a photo of the code
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="qr-file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void decodeFile(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      {status === "scanning" && (
        <button
          type="button"
          onClick={() => void stop()}
          className="transition-calm mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
        >
          <CameraOff className="h-3.5 w-3.5" />
          Stop camera
        </button>
      )}

      {error && (
        <p className="mt-3 max-w-xs text-center text-[12.5px] leading-relaxed text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function messageFor(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/permission|NotAllowed/i.test(raw)) {
    return "Camera permission was refused. Allow it in the browser, or use a simulated scan below.";
  }
  if (/NotFound|no camera/i.test(raw)) {
    return "No camera found on this device. Use a simulated scan below.";
  }
  if (/NotReadable|in use/i.test(raw)) {
    return "The camera is being used by another app. Close it, or use a simulated scan below.";
  }
  if (/secure|https/i.test(raw)) {
    return "Camera access needs HTTPS or localhost. Use a simulated scan below.";
  }
  return `Camera could not start: ${raw}. Use a simulated scan below.`;
}
