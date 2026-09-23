"use client";

import { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  Printer,
  TriangleAlert,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * WhatsApp delivery is opt-in and off by default.
 *
 * Not because the code is unfinished — the route, the validation and every
 * error path are built and tested — but because a Twilio *trial* account
 * cannot send media or free-form WhatsApp messages at all. Until the account
 * is upgraded, showing the button would mean offering a control that fails
 * when pressed. Hidden beats shown-and-broken.
 */
const WHATSAPP_ENABLED = process.env.NEXT_PUBLIC_WHATSAPP_ENABLED === "true";

/**
 * The patient's QR, shared by registration and QR recovery.
 *
 * The code encodes only the patient id — nothing clinical. Losing it is not a
 * security problem, which is why reissuing is a one-click action rather than a
 * guarded one; the access check happens at scan time against the scanner's role.
 *
 * Three ways out: download, print, and WhatsApp. The first two draw from the
 * canvas below; the third asks the server to render its own PNG, because
 * Twilio fetches media over HTTP and cannot take a blob from a browser. Same
 * payload either way.
 */

/** Mirrors the `source` discriminator used by adminData.ts. */
type SendState =
  | { source: "idle" }
  | { source: "sending" }
  | { source: "sent"; sid: string; detail: string }
  | { source: "failed"; message: string; twilioCode: number | null };

export function PatientQrPanel({
  patientId,
  patientName,
  patientPhone,
  className = "",
}: {
  patientId: string;
  patientName: string;
  /** Absent or blank disables WhatsApp delivery, with the reason shown. */
  patientPhone?: string | null;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [send, setSend] = useState<SendState>({ source: "idle" });

  const hasPhone = Boolean(patientPhone && patientPhone.trim());

  function download() {
    const canvas = wrapRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${patientId}-qr.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  async function sendToWhatsApp() {
    setSend({ source: "sending" });

    if (!API) {
      setSend({
        source: "failed",
        message: "NEXT_PUBLIC_API_URL is not set, so there is no backend to ask.",
        twilioCode: null,
      });
      return;
    }

    try {
      const res = await fetch(
        `${API}/clinician/patients/${encodeURIComponent(patientId)}/send-qr`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        // The server returns {detail: {message, twilioCode}} for the cases it
        // understands. Anything else is passed through rather than replaced
        // with a generic line — an unfamiliar error is still more useful than
        // "something went wrong".
        const detail = body?.detail;
        setSend({
          source: "failed",
          message:
            typeof detail === "string"
              ? detail
              : (detail?.message ??
                `The server refused the send (HTTP ${res.status}).`),
          twilioCode: typeof detail === "object" ? (detail?.twilioCode ?? null) : null,
        });
        return;
      }

      setSend({
        source: "sent",
        sid: body?.sid ?? "",
        detail: body?.detail ?? "",
      });
    } catch (err) {
      setSend({
        source: "failed",
        message:
          err instanceof Error
            ? `Could not reach the backend: ${err.message}`
            : String(err),
        twilioCode: null,
      });
    }
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

            {WHATSAPP_ENABLED && (
            <button
              type="button"
              onClick={sendToWhatsApp}
              disabled={!hasPhone || send.source === "sending"}
              title={
                hasPhone
                  ? `Send the QR to ${patientPhone} on WhatsApp`
                  : "No phone number on record for this patient, so there is nowhere to send it"
              }
              className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-ink-muted"
            >
              {send.source === "sending" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MessageCircle className="h-3.5 w-3.5" />
              )}
              {send.source === "sending" ? "Sending…" : "Send to WhatsApp"}
            </button>
            )}
          </div>

          {WHATSAPP_ENABLED && !hasPhone && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint print:hidden">
              WhatsApp delivery needs a phone number on record. This patient has
              none, so download or print the card instead.
            </p>
          )}

          {send.source === "sent" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-success-tint px-3.5 py-3 text-left print:hidden">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-success">
                  Twilio accepted the message for {patientPhone}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
                  {send.detail ||
                    "Queued for delivery — that is Twilio confirming receipt, not the handset."}
                </p>
                {send.sid && (
                  <p className="nums mt-1 font-mono text-[10.5px] text-ink-faint">
                    {send.sid}
                  </p>
                )}
              </div>
            </div>
          )}

          {send.source === "failed" && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-danger bg-danger-tint px-3.5 py-3 text-left print:hidden">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-danger">
                  The QR was not sent
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                  {send.message}
                </p>
                {send.twilioCode !== null && (
                  <p className="nums mt-1 font-mono text-[10.5px] text-ink-faint">
                    Twilio code {send.twilioCode}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
