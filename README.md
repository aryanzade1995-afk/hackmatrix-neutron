# Hackmatrix — HLTH-01

A health records system with two strictly separated ways in. A **clinician** opens one
patient's complete history behind a QR consent token. An **administrator** sees only
combined, anonymous case counts.

The separation is not an `if (role === 'admin')` check. It is a Postgres grant — and it is
demonstrable in one command:

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT * FROM patients;"
# ERROR:  permission denied for table patients
```

That error comes from the database, not from our code. There is no route to bypass and no
bug we could introduce in the API that would make it succeed, because `admin_role` was
never granted `SELECT` on that table. See [`db/README.md`](db/README.md).

---

## Status

| Area | Status |
| --- | --- |
| Next.js frontend, both role views | Built |
| Design system, illustration set | Built |
| Patient registration, QR issue and recovery | Built |
| Visit entry — complaint, diagnosis, prescription, review | Built |
| Prescriptions with schedule, food timing, duration, quantity | Built |
| Allergy conflict detection across facilities | Built |
| **Postgres schema and role separation** | **Built — [proof](db/README.md#the-proof)** |
| **k-anonymity suppression in the view layer** | **Built — verified** |
| **FastAPI over two database roles** | **Built — [details](backend/README.md)** |
| **Frontend reading and writing through the API** | **Built — verified** |
| **Real QR scanning (camera and image)** | **Built — image decode verified** |
| **Clinical summary generated from the record** | **Built — deterministic, cited** |
| **Admin dashboard reading live aggregates** | **Built — no mock fallback, by design** |
| **Outbreak signal detection** | **Built — [`/admin/signals`](backend/app/routers/admin.py)** |
| **Hash-chained audit log, persisted** | **Built — [verifiable](backend/README.md)** |
| **Break-glass emergency access** | **Built — reason required, logged** |
| **Patient-facing plain-language summary** | **Built — printable** |
| **Overdue follow-up detection** | **Built — attendance only** |
| **Offline write queue** | **Built — survives reload, replays on reconnect** |
| Authentication (login, sessions) | **Not built** — see below |

### What is honestly not finished

- **Authentication.** `/login` is a cosmetic role picker. The *data* separation is real and
  provable; deciding which role a given human gets is still ahead. This is worth stating
  plainly rather than letting it be discovered.
- **Live camera decoding** has not been tested on hardware with a camera. Decoding from a
  QR *image* has been verified end to end, including the routing that follows.
- **Re-identification by differencing** overlapping aggregate queries is not defended
  against. A threshold on single queries does not stop that.
- **The outbreak detector's baseline ignores suppressed weeks.** A week below the
  threshold is invisible to it exactly as it is to a human reading the dashboard. That is
  the correct limitation to have — a version that corrected for the missing weeks would
  leak the suppressed counts back in through the side door.
- **The allergy check is prototype logic, not clinical decision support.** It warns on a
  shared drug class and never blocks. The system never suggests or infers a diagnosis
  anywhere.

---

## The four claims, and where each is proved

Each of these is checkable, not asserted. That is the whole point of the project.

**1 — An administrator cannot read an identified record.**
Enforced by `GRANT`/`REVOKE` in [`db/schema.sql`](db/schema.sql). Verified against
Postgres 16 with the full seed loaded. Also exposed over HTTP at `GET /admin/prove`, so
it can be shown in a browser without a terminal — and it reports `blocked: false` if the
grants ever break, rather than hiding a failure.

**2 — Small groups are suppressed before anyone can see them.**
The `HAVING COUNT(*) >= 5` lives inside the view definition, so the admin role never
receives an unsuppressed number for application code to leak. On the current data: **56
groups exist, 33 are visible, 23 are hidden.** Malaria stays below the threshold even in
Pune City, the largest district — the rule reacts to the count in a cell, not to district
size.

**3 — Records are append-only.**
The clinician role holds `SELECT, INSERT` and deliberately not `UPDATE` or `DELETE`.
There is no edit route in the API, and adding one later would still fail at the database.
A correction is a new visit row carrying `supersedes`.

**4 — The audit trail cannot be quietly rewritten.**
Every row in `access_log` commits to the previous row's hash, so altering one breaks
every hash after it. `GET /clinician/access-log/verify` recomputes the whole chain and
reports the first divergence — tested by tampering with a row as superuser, which was
caught at exactly that row. The clinician role cannot perform that edit at all.

---

## Patient data

All patient data is **synthetic** — invented names, conditions, facilities and dates. No
real medical records are used anywhere.

The medicine formulary in [`frontend/src/lib/formulary.ts`](frontend/src/lib/formulary.ts)
carries illustrative strengths, schedules and paediatric mg/kg rules. **These have not been
reviewed by a clinician** and are demo data, not prescribing guidance. The allergy check is
prototype logic that warns and never blocks; it is not clinical decision support, and the
system never suggests or infers a diagnosis.

---

## Running it

### Frontend only, on seeded data

Requires Node.js 18.17+. No backend needed.

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>. The store falls back to
[`src/lib/demo-data.ts`](frontend/src/lib/demo-data.ts) whenever the API is unreachable, so
the UI stays usable with nothing else running.

### With the database and API

```bash
# 1. Database — see db/README.md for generating the role passwords
psql "$SUPERUSER_URL" -v clinician_pw="'…'" -v admin_pw="'…'" -f db/schema.sql
psql "$SUPERUSER_URL" -f db/seed.sql
psql "$SUPERUSER_URL" -f db/bulk.sql

# 2. API
cd backend
pip install -r requirements.txt
cp .env.example .env        # fill in both connection strings
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd ../frontend
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

`GET /health` reports which database role each connection is authenticated as.

---

## Routes

### Clinician

| Route | What it does |
| --- | --- |
| `/clinician/scan` | Camera or image QR scan, break-glass access, plus simulated paths |
| `/clinician/register` | One-time registration, issues the patient's QR |
| `/clinician/find` | Search by name, phone or id; reissue a lost QR |
| `/clinician` | The record: generated summary, allergy conflicts, timeline, vitals trends |
| `/clinician/visit/new` | Four-step visit entry with live allergy checking |
| `/clinician/patient-summary` | Plain-language summary to hand to the patient, printable |
| `/clinician/history` | Every visit, conflicts flagged |
| `/clinician/follow-ups` | Patients on long-term medicine not seen recently |
| `/clinician/audit` | The real access log, with a "verify chain" button |

### Administrator

| Route | What it does |
| --- | --- |
| `/admin` | Aggregate dashboard with the privacy threshold |
| `/admin/trends` | Cases by district, suppressed cells marked, plus outbreak signals |
| `/admin/ask` | Natural-language query over aggregates only |

`/lab/*` are internal design comparison pages, not part of the product.

---

## Layout

```
db/         schema, seed, bulk data, and the role-separation proof
backend/    FastAPI over two database roles
frontend/   Next.js app
  src/lib/  clinical.ts, formulary.ts, prescribing.ts, summary.ts, store.tsx
```

The logic worth reading is in `frontend/src/lib/` — allergy conflict detection, visit
diffing, medicine ranking by past frequency, and the summary generator. All of it computes
from the record rather than hardcoding results.

---

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS 3 · FastAPI · PostgreSQL 16

Tailwind is pinned to v3 and Next to 14 deliberately: Tailwind v4's native engine requires
Node 20+, which the build environment does not have.

## Design notes

**The clinical summary is generated deterministically from the visit record**, not by a
language model. Each sentence is constructed from the visits it cites, so a claim without
a source cannot be produced — a guarantee by construction rather than a post-check on
model output. The patient-facing summary is a second renderer over the same computed
facts, so the two cannot drift apart and disagree about one record.

**Medicine ranking reports what has actually been prescribed** for a diagnosis at that
facility. It is a statement of frequency, never a recommendation. The doctor can always
type something not on the list.

**Follow-up detection reports attendance, not clinical judgment.** A patient stable on a
repeat prescription and one who stopped taking it look identical from the data; only the
clinician can tell them apart.

**The admin dashboard has no mock fallback.** If the API is unreachable it says so rather
than showing stale numbers — the opposite of the clinician side, which falls back to seed
data because a record screen with no patient is simply broken. Faking live data on the
privacy-critical side would undercut the claim the whole database layer exists to prove.

**Writes survive losing the network.** Rural PHC connectivity is the deployment context,
not an edge case, so a failed write is queued to `localStorage` and replayed on
reconnect. Replay is idempotent because ids are generated client-side: a repeat hits the
backend's "honour a client-supplied id, 409 if taken" path.
