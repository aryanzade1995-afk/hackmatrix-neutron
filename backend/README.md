# Backend — FastAPI over two database roles

The design in one sentence: **there are two database connections, one per role,
and the administrator's connection has no grant on the identified tables.**

`routers/admin.py` is not trusted to avoid patient data — it is incapable of
reaching it. A query added there by mistake raises `permission denied` instead of
quietly returning records. See `app/db.py` and `db/README.md`.

---

## Run it

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # fill in both connection strings
uvicorn app.main:app --reload --port 8000
```

Interactive docs at `http://localhost:8000/docs`.

The database must exist first — see `db/README.md`.

---

## Endpoints

### Meta

| | |
|---|---|
| `GET /health` | Reports which database role each connection authenticates as |

```json
{ "status": "ok", "clinicianRole": "clinician_role", "adminRole": "admin_role" }
```

### Clinician — runs on the clinician engine

| | |
|---|---|
| `GET /clinician/patients/{id}` | One patient |
| `GET /clinician/patients/search?q=` | Name, phone or id; same semantics as `findPatientsByQuery` |
| `GET /clinician/patients/{id}/visits` | Visits, newest first |
| `POST /clinician/patients` | Server assigns the next `PT-####` |
| `POST /clinician/visits` | Appends; server assigns id and display date |
| `POST /clinician/access-log` | Appends one hash-chained entry; a reason is required for `emergency_access` |
| `GET /clinician/access-log` | The trail, newest first |
| `GET /clinician/access-log/verify` | Recomputes every hash and reports the first break |

There is no `PUT`, `PATCH` or `DELETE` for visits, and there should never be.
A correction is a new row carrying `supersedes`. The clinician role holds no
`UPDATE` grant, so such a route would fail at the database regardless.

### Administrator — runs on the admin engine

| | |
|---|---|
| `GET /admin/aggregates?district=&diagnosis=` | Weekly counts from `district_aggregates` |
| `GET /admin/trends` | Totals from `condition_totals` |
| `GET /admin/signals` | Conditions whose latest week is well above their own trailing average |
| `GET /admin/prove` | Attempts to read identified tables and reports the refusal |

`/admin/signals` is arithmetic over the suppressed aggregates and nothing more — no
model, no prediction. Its baseline is computed only from weeks the admin role could
actually see, so a suppressed week stays invisible to it. Correcting for those weeks
would leak their counts back in.

---

## `GET /admin/prove`

The `psql` proof from `db/README.md`, over HTTP, so it can be shown live without
a terminal:

```json
{
  "patients":   { "blocked": true, "detail": "permission denied for table patients" },
  "visits":     { "blocked": true, "detail": "permission denied for table visits" },
  "aggregates": { "blocked": false, "visibleGroups": 33 },
  "connectedAs": "admin_role",
  "summary": "Identified tables are unreachable on this connection; only suppressed aggregates are readable. Enforced by Postgres grants, not application code."
}
```

If `blocked` were ever `false` for `patients` or `visits`, that would be a
serious finding — the endpoint reports it rather than hiding it.

---

## Verified

Run against Postgres 16 with `schema.sql`, `seed.sql` and `bulk.sql` loaded
(the full seed; currently 335 patients, 1,383 visits):

```
GET  /health                              clinician_role / admin_role
GET  /clinician/patients/PT-2291          Priya Nair, penicillin allergy
GET  /clinician/patients/PT-2291/visits   5 visits, prescriptions intact
GET  /clinician/patients/search?q=priya   ['Priya Nair']
GET  /clinician/patients/search?q=96…77   ['Sunita Deshpande']   (phone match)
POST /clinician/patients                  201, id PT-2448
POST /clinician/visits                    201, persisted and read back
GET  /admin/trends                        Wagholi/Dengue 214, Pune City/Dengue 207…
GET  /admin/prove                         both identified tables blocked
PUT/PATCH/DELETE /clinician/visits/…      404 — no such route
```

JSON field names are camelCase and match the frontend's TypeScript types
field-for-field, so wiring `StoreProvider` to these endpoints needs no type
changes in any page.

---

## Not built

- **Authentication.** `/login` is a cosmetic role picker. The *data* separation
  is real and provable; deciding which role a human gets is not built. Say so in
  the demo rather than letting a judge find it.
- **The audit log** is still frontend mock data, not a table.
- **Rate limiting and query budgets.** A threshold on single queries does not
  stop someone differencing overlapping aggregates over time.

## WhatsApp delivery of the patient QR

Optional. Everything else runs without it; only the **Send to WhatsApp** button
on the QR panel needs the setup below.

### Why ngrok is required

Twilio's API takes a **URL** for media, not an upload and not a base64 blob.
Twilio's own servers fetch the image over the internet, which means:

- `http://localhost:8000` can never work. To Twilio, `localhost` is Twilio's
  machine, not yours.
- The backend has to be publicly reachable for the duration of the send.

So during any live demo:

```
ngrok http 8000
```

and put the `https://…` URL it prints into `backend/.env`:

```
PUBLIC_BASE_URL=https://a1b2c3d4.ngrok-free.app
```

**On the free tier this URL changes every time ngrok restarts.** Update
`PUBLIC_BASE_URL` and restart the backend each time, or Twilio will fetch from
a dead address and the message arrives with a broken image. The send route
refuses to build a localhost URL rather than letting that happen silently.

### Sandbox opt-in is manual, and per phone

The Twilio WhatsApp Sandbox will only deliver to a number that has **already
sent the sandbox join phrase** to the sandbox number from WhatsApp. This is a
one-time step for each phone and **cannot be done by this application** — no
API call performs it.

Test with every handset you plan to use *before* the day. The failure mode is
that a number silently stops receiving, and on stage it looks identical to a
credentials problem. The app reports this case specifically (Twilio codes
63015 / 63007 / 21608) with a message saying the number has not joined, rather
than a generic failure.

### What "sent" means

A green result means **Twilio accepted the message**, which is queued, not
delivered. The interface says so rather than claiming the patient has it.

### Checklist before demoing

1. `pip install -r backend/requirements.txt` (adds `twilio` and `qrcode[pil]`)
2. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` in `.env`
3. `ngrok http 8000` running, its URL in `PUBLIC_BASE_URL`, backend restarted
4. Demo handset has sent the join phrase to the sandbox number
5. The patient you will register has a phone in `+<country><number>` form

