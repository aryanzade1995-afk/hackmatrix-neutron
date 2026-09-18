"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer } from "lucide-react";

/**
 * The patient's QR, shared by registration and QR recovery.
 *
 * The code encodes only the patient id — nothing clinical. Losing it is not a
 * security problem, which is why reissuing is a one-click action rather than a
 * guarded one; the access check happens at scan time against the scanner's role.
 */
export function PatientQrPanel({
  patientId,
  patientName,
  className = "",
}: {
  patientId: string;
  patientName: string;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${patientId}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className={`rounded-2xl border border-border-strong bg-sage-tint px-6 py-6 ${className}`}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div
          ref={wrapRef}
          className="shrink-0 rounded-xl bg-surface p-3.5 ring-1 ring-inset ring-border print:ring-0"
        >
          <QRCodeCanvas
            value={patientId}
            size={148}
            bgColor="#FFFFFF"
            fgColor="#11271D"
            level="M"
          />
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-display text-[18px] text-ink">{patientName}</p>
          <p className="nums mt-1 font-mono text-[12.5px] text-ink-muted">{patientId}</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
            Give this to the patient. If they lose it, it can be reissued from Find
            patient — losing it is not a security problem, it is only an identifier.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2.5 sm:justify-start print:hidden">
            <button
              type="button"
              onClick={download}
              className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink"
            >
              <Printer className="h-3.5 w-3.5" />
              Print card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
