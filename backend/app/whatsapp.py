"""
WhatsApp delivery of the patient QR, via Twilio.

Kept out of routers/clinician.py because everything here is optional. The
`twilio` and `qrcode` imports happen inside functions rather than at module
scope so that a checkout without them installed still starts, still serves
every other route, and fails on this one path with a sentence explaining what
to install — rather than dying at import with a traceback.

Three things about Twilio's WhatsApp sandbox shape this module, and all three
are constraints to build around rather than bugs to route past:

1. The API takes a media *URL*, not an upload and not a base64 blob. Twilio's
   servers fetch the image themselves, which is why PUBLIC_BASE_URL has to be
   publicly reachable — http://localhost:8000 resolves to Twilio's own machine
   and always fails.

2. The sandbox only delivers to a number that has already sent the join phrase
   to the sandbox number from WhatsApp. That is a manual, one-time step per
   phone, and no amount of application code can perform it. The error for it is
   specific (63015 / 63007-family) and gets its own message, because "failed to
   send" would send someone debugging their credentials for an hour.

3. Twilio accepting a message means queued, not delivered. This module reports
   what it actually knows — the message SID and the queued status — and does
   not claim the patient received anything.
"""

from __future__ import annotations

import io
import os
import re

# Twilio's own numeric codes. Worth naming: the difference between "your
# credentials are wrong" and "that phone has not joined the sandbox" is the
# difference between five minutes and an afternoon.
ERR_NOT_IN_SANDBOX = {63015, 63007, 21608}
ERR_BAD_NUMBER = {21211, 21614, 63011}
ERR_MEDIA_FETCH = {12300, 21620, 63021}

#: Deliberately loose. E.164 allows 15 digits and country codes vary; this
#: rejects the obvious mistakes (missing +, local format, letters) without
#: pretending to validate real-world reachability, which only Twilio can do.
E164 = re.compile(r"^\+[1-9]\d{7,14}$")


class WhatsAppError(Exception):
    """Carries an HTTP status and a message written for a clinician, not a log."""

    def __init__(self, status: int, message: str, *, code: int | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


def normalise_phone(raw: str | None) -> str:
    """Strip formatting and require something E.164-shaped."""
    if not raw or not raw.strip():
        raise WhatsAppError(
            400,
            "This patient has no phone number on record, so there is nowhere to "
            "send the QR. Add one by registering them again, or hand over a "
            "printed card instead.",
        )

    cleaned = re.sub(r"[\s\-()./]", "", raw.strip())
    if not cleaned.startswith("+"):
        raise WhatsAppError(
            400,
            f"The number on record ({raw}) has no country code. WhatsApp needs "
            "the full international form, starting with + — for example "
            "+919876543210.",
        )
    if not E164.match(cleaned):
        raise WhatsAppError(
            400,
            f"The number on record ({raw}) is not a valid international number. "
            "Expected + followed by 8 to 15 digits.",
        )
    return cleaned


def render_qr_png(payload: str) -> bytes:
    """The same content the browser encodes — the patient id and nothing else.

    Generated server-side only because Twilio needs a URL it can fetch. What is
    encoded is unchanged: no name, no diagnosis, no date of birth. A QR that
    leaks on a bus should be worth nothing to whoever picks it up.
    """
    try:
        import qrcode
    except ModuleNotFoundError as exc:  # pragma: no cover - deployment issue
        raise WhatsAppError(
            500,
            "The qrcode package is not installed on the server. "
            "Run: pip install -r backend/requirements.txt",
        ) from exc

    # Box size 10 gives roughly a 300px image — large enough for a phone camera
    # to read off another phone's screen, which is how this will be scanned.
    code = qrcode.QRCode(version=None, box_size=10, border=2)
    code.add_data(payload)
    code.make(fit=True)

    buffer = io.BytesIO()
    code.make_image(fill_color="#11271D", back_color="white").save(buffer, format="PNG")
    return buffer.getvalue()


def public_media_url(patient_id: str) -> str:
    """Where Twilio should fetch the QR from.

    Refuses to build a localhost URL. Handing Twilio one produces a delivery
    that silently arrives with a broken image, which is worse than an error.
    """
    base = (os.getenv("PUBLIC_BASE_URL") or "").strip().rstrip("/")

    if not base:
        raise WhatsAppError(
            503,
            "PUBLIC_BASE_URL is not set, so there is no address Twilio could "
            "fetch the QR image from. Start a tunnel (ngrok http 8000), put the "
            "https URL it prints into backend/.env as PUBLIC_BASE_URL, and "
            "restart the backend.",
        )

    if re.search(r"(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])", base):
        raise WhatsAppError(
            503,
            f"PUBLIC_BASE_URL is {base}, which Twilio cannot reach — its servers "
            "fetch the image themselves, and localhost there means their machine, "
            "not yours. Use the public URL from ngrok instead.",
        )

    return f"{base}/clinician/patients/{patient_id}/qr.png"


def send_qr(patient_id: str, phone: str) -> dict:
    """Hand the message to Twilio and report what actually came back."""
    try:
        from twilio.base.exceptions import TwilioRestException
        from twilio.rest import Client
    except ModuleNotFoundError as exc:  # pragma: no cover - deployment issue
        raise WhatsAppError(
            500,
            "The twilio package is not installed on the server. "
            "Run: pip install -r backend/requirements.txt",
        ) from exc

    sid = (os.getenv("TWILIO_ACCOUNT_SID") or "").strip()
    token = (os.getenv("TWILIO_AUTH_TOKEN") or "").strip()
    sender = (os.getenv("TWILIO_WHATSAPP_FROM") or "").strip()

    missing = [
        name
        for name, value in (
            ("TWILIO_ACCOUNT_SID", sid),
            ("TWILIO_AUTH_TOKEN", token),
            ("TWILIO_WHATSAPP_FROM", sender),
        )
        if not value
    ]
    if missing:
        raise WhatsAppError(
            503,
            f"WhatsApp delivery is not configured: {', '.join(missing)} "
            f"{'is' if len(missing) == 1 else 'are'} missing from backend/.env.",
        )

    if not sender.startswith("whatsapp:"):
        sender = f"whatsapp:{sender}"

    media_url = public_media_url(patient_id)

    try:
        message = Client(sid, token).messages.create(
            from_=sender,
            to=f"whatsapp:{phone}",
            body="Your Hackmatrix patient record QR — keep this for your visits.",
            media_url=[media_url],
        )
    except TwilioRestException as exc:
        raise WhatsAppError(status=502, message=_explain(exc, phone), code=exc.code) from exc

    return {
        "sid": message.sid,
        # Twilio returns "queued" or "accepted" here. It means Twilio has the
        # message, not that a phone has it — see the module docstring.
        "status": message.status,
        "to": phone,
        "mediaUrl": media_url,
        "detail": (
            "Twilio accepted the message. That means it is queued for delivery, "
            "not that the handset has it yet."
        ),
    }


def _explain(exc, phone: str) -> str:
    """Turn a Twilio error into something a clinician can act on."""
    code = getattr(exc, "code", None)

    if code in ERR_NOT_IN_SANDBOX:
        return (
            f"{phone} has not joined the WhatsApp sandbox yet. From that phone, "
            "send the sandbox join phrase to the sandbox number on WhatsApp, then "
            "try again. This is a one-time step per number and cannot be done "
            "from this app."
        )
    if code in ERR_BAD_NUMBER:
        return (
            f"Twilio rejected {phone} as a WhatsApp destination. Check the country "
            "code and that the number actually has WhatsApp."
        )
    if code in ERR_MEDIA_FETCH:
        return (
            "Twilio could not fetch the QR image from PUBLIC_BASE_URL. Check the "
            "tunnel is still up and that the URL in backend/.env matches the one "
            "ngrok is currently printing — free-tier URLs change on every restart."
        )
    if code == 20003:
        return (
            "Twilio rejected the credentials. Check TWILIO_ACCOUNT_SID and "
            "TWILIO_AUTH_TOKEN in backend/.env."
        )

    detail = getattr(exc, "msg", None) or str(exc)
    return f"Twilio refused the message (code {code}): {detail}"
