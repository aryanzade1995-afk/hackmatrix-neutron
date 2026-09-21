# Hackmatrix — Phase 3: Differentiators

Five features, in build order. Each closes a specific gap: the first because your
admin side isn't actually wired to the database you built in Phase 2, the next
three because they're genuinely different from what other teams will show, and
the last is a stretch goal only if you're ahead of schedule.

**A finding before anything else:** `frontend/src/app/admin/page.tsx` and
`admin/trends/page.tsx` still read from the hardcoded `conditionsByDistrict`
array in `demo-data.ts`. The real `/admin/aggregates` and `/admin/trends`
endpoints you built in Phase 2 exist and work — nothing on the admin side
actually calls them yet. Feature 0 fixes that, and it has to come before
Feature A, because an anomaly detector computed on hardcoded numbers would be
decoration, not a feature.

Guardrails carried over from every earlier guide, unchanged: two roles, ever.
No diagnosis suggestions — Feature D flags an attendance gap, never a clinical
recommendation. Append-only — Feature C's audit log is insert-only, same as
`visits`. Synthetic data only.

---

## Feature 0 — Wire the admin dashboard to the real backend

Same pattern as `store.tsx`, but read-only: no admin action ever writes to
`patients` or `visits`, so there's no equivalent of `addPatient`/`addVisit`
to build.

Create `frontend/src/lib/adminData.ts`:

```ts
"use client";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AggregateRow = { district: string; diagnosis: string; caseCount: number; week?: string };

function useApiList<T>(path: string): { data: T[]; source: "api" | "unavailable"; error: string | null } {
  const [data, setData] = useState<T[]>([]);
  const [source, setSource] = useState<"api" | "unavailable">("unavailable");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API) return;
    const controller = new AbortController();
    fetch(`${API}${path}`, { signal: controller.signal, cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(`${path} → ${r.status}`); return r.json(); })
      .then((rows: T[]) => { setData(rows); setSource("api"); setError(null); })
      .catch((err) => { if (!controller.signal.aborted) setError(String(err)); });
    return () => controller.abort();
  }, [path]);

  return { data, source, error };
}

export function useTrends() {
  return useApiList<AggregateRow>("/admin/trends");
}
export function useAggregates(district?: string, diagnosis?: string) {
  const qs = new URLSearchParams();
  if (district) qs.set("district", district);
  if (diagnosis) qs.set("diagnosis", diagnosis);
  return useApiList<AggregateRow>(`/admin/aggregates?${qs}`);
}
export function useSignals() {
  return useApiList<TrendSignal>("/admin/signals");
}

export type TrendSignal = {
  district: string; diagnosis: string; week: string;
  currentCount: number; baselineAvg: number; ratio: number;
  severity: "watch" | "alert";
};
```

There is deliberately no seed-data fallback here, unlike `store.tsx`. The
clinician side falls back to synthetic patients because a demo with no patient
data is broken; the admin side, if the API is unreachable, should say so
plainly (`source === "unavailable"` → an `EmptyState` reading "Trend data
needs the backend connected") rather than silently showing the old static
mock numbers as if they were real. Faking "live" data here would undercut the
one claim your whole database section exists to prove.

Update `app/admin/page.tsx` and `app/admin/trends/page.tsx` to use these hooks
in place of the `conditionsByDistrict` import. The chart/table components
underneath (`PopulationGrid`, whatever renders `/admin/trends`'s table)
already take rows shaped like `{district, diagnosis, caseCount}` — check the
existing prop shapes before changing them; the goal is a new data source
behind the same components, not a redesign.

---

## Feature A — Outbreak signal detection

This is the highest-leverage addition, because it's the half of "Patient
Health Records **and Disease Trend Monitoring**" that a dashboard of static
counts doesn't actually deliver. It runs entirely on data you've already
computed and already suppressed — no new privacy surface.

### Backend

Add to `backend/app/models.py`:

```python
class TrendSignal(BaseModel):
    district: str
    diagnosis: str
    week: Date
    currentCount: int
    baselineAvg: float
    ratio: float
    severity: Literal["watch", "alert"]
```

Add to `backend/app/routers/admin.py`:

```python
from collections import defaultdict
from statistics import mean
from ..models import TrendSignal

@router.get("/signals", response_model=list[TrendSignal])
def signals(
    ratio_threshold: float = Query(default=2.0, ge=1.1),
    min_current_count: int = Query(default=8, ge=5),
    min_baseline_weeks: int = Query(default=3, ge=1),
    baseline_weeks: int = Query(default=8, ge=1, le=26),
):
    """
    Flags a (district, diagnosis) pair whose most recent week is well above its
    own trailing average. Arithmetic on `district_aggregates`, nothing more —
    no model, no prediction, and it runs on data that is already suppressed,
    so a flagged signal can never expose a group smaller than the k-anonymity
    threshold.

    A district-diagnosis pair with too little history is skipped rather than
    flagged on thin evidence — `min_baseline_weeks` exists so one lucky week
    doesn't read as an outbreak.
    """
    with admin_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT district, diagnosis, week, case_count FROM district_aggregates "
                "ORDER BY district, diagnosis, week"
            )
        ).all()

    series: dict[tuple[str, str], list[tuple]] = defaultdict(list)
    for r in rows:
        series[(r.district, r.diagnosis)].append((r.week, r.case_count))

    out: list[TrendSignal] = []
    for (district, diagnosis), points in series.items():
        if len(points) < min_baseline_weeks + 1:
            continue
        *history, (current_week, current_count) = points
        baseline_points = history[-baseline_weeks:]
        if len(baseline_points) < min_baseline_weeks:
            continue
        baseline_avg = mean(c for _, c in baseline_points)
        if baseline_avg <= 0 or current_count < min_current_count:
            continue
        ratio = current_count / baseline_avg
        if ratio < ratio_threshold:
            continue
        out.append(
            TrendSignal(
                district=district, diagnosis=diagnosis, week=current_week,
                currentCount=current_count, baselineAvg=round(baseline_avg, 1),
                ratio=round(ratio, 2),
                severity="alert" if ratio >= 3 else "watch",
            )
        )
    out.sort(key=lambda s: s.ratio, reverse=True)
    return out
```

Worth stating in the docstring and out loud in the demo: a week that was
suppressed (fewer than 5 cases) is invisible to this endpoint the same way
it's invisible to a human looking at the dashboard — the baseline is computed
only from the weeks the admin role could see in the first place. That's a
limitation, and it's the correct one to have, not a bug to fix — a version
that "corrected" for suppressed weeks would be leaking the suppressed count
back in through the side door.

### Demo data needs a spike, or there's nothing to flag

Add `db/spike.sql`, run after `bulk.sql`:

```sql
-- Synthetic outbreak for the signal detector to have something real to flag.
-- Not organic — deliberately inserted, and said so here and in the demo.
DO $$
DECLARE
  d TEXT := 'Wagholi';
  cond TEXT := 'Dengue';
  i INT;
BEGIN
  FOR i IN 1..40 LOOP
    INSERT INTO patients (id, name, dob, gender, facility, district, registered_at)
    VALUES (
      'PT-SPIKE-' || i, 'Synthetic Patient ' || i, '1990-01-01', 'Other',
      'PHC Wagholi', d, CURRENT_DATE
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO visits (id, patient_id, visit_date, display_date, facility, diagnosis, notes)
    VALUES (
      'v-spike-' || i, 'PT-SPIKE-' || i, CURRENT_DATE - (i % 3),
      to_char(CURRENT_DATE, 'DD Mon YYYY'), 'PHC Wagholi', cond,
      'Synthetic — inserted for the outbreak-signal demo, not real activity.'
    );
  END LOOP;
END $$;
```

Run `psql "$SUPERUSER_URL" -f db/spike.sql` after the other two seed scripts.
Document it in `db/README.md` next to the other seed files, with the same
plainness as everything else in there — a manufactured spike used to
demonstrate a real detector is legitimate; presenting it as organic data
would not be.

### Frontend

Add a "Signals" card to `/admin/trends`, above or beside the existing table,
using `useSignals()` from Feature 0's `adminData.ts`. Reuse `Card`,
`SectionLabel`, and `Badge` — `tone="danger"` for `severity: "alert"`,
`tone="warning"` for `"watch"`. Each row: `"${diagnosis} in ${district} —
${ratio}x its ${baseline_weeks}-week average (${currentCount} this week vs
~${baselineAvg})"`. If `data.length === 0`, an `EmptyState` reading "No
unusual activity in the current data" — a detector that never fires is not
a bug, and the UI should say so rather than showing nothing and looking
broken.

---

## Feature B — Patient-facing summary

You already compute the clinical summary's underlying facts in
`lib/summary.ts`; the only thing missing is a second way to say them.

### Refactor `summary.ts` into facts + renderer

Pull the per-visit computation apart from the sentence construction:

```ts
export type SummaryFacts = {
  patient: Patient;
  visitCount: number;
  facilityCount: number;
  oldest: Visit;
  ongoing: { drug: string; strength: string; visit: Visit }[];
  admissions: Visit[];
  bp: { fromValue: string; toValue: string; fromVisit: Visit; toVisit: Visit; direction: "fallen" | "risen" | "held" } | null;
  hba1c: { from: number; to: number; toVisit: Visit } | null;
  allergies: Allergy[];
  conflicts: Conflict[];
};

export function computeSummaryFacts(patient: Patient, visits: Visit[]): SummaryFacts | null {
  // Existing logic from buildSummary — the ongoing-medicines loop, the BP
  // direction calc, the HbA1c comparison, findAllergyConflicts — moves here
  // unchanged. It stops constructing sentences and returns the facts instead.
}
```

`buildSummary` (the existing clinical renderer with citations) becomes a thin
function that takes `SummaryFacts` and produces the `Summary` type exactly as
today — no behavior change for the existing `/clinician` page. Add a second
renderer beside it:

```ts
export type PatientSummary = {
  empty: boolean;
  greeting: string;                 // "Hello, Priya"
  paragraphs: string[];             // plain-language, second person, no jargon
  medicines: { line: string }[];    // "Metformin 500mg — twice a day, after food"
  disclaimer: string;
};

export function renderPatientSummary(facts: SummaryFacts | null): PatientSummary {
  if (!facts) return { empty: true, greeting: "", paragraphs: [], medicines: [], disclaimer: "" };

  const p: string[] = [];
  p.push(`You've been seen ${facts.visitCount} times across ${facts.facilityCount} ` +
    `${facts.facilityCount === 1 ? "facility" : "facilities"} since ${monthYear(facts.oldest.date)}.`);

  if (facts.bp) {
    const word = facts.bp.direction === "fallen" ? "come down" : facts.bp.direction === "risen" ? "gone up" : "stayed about the same";
    p.push(`Your blood pressure has ${word} since your last few visits.` +
      (facts.bp.direction === "fallen" ? " That's a good sign." : ""));
  }
  if (facts.hba1c && facts.hba1c.to < facts.hba1c.from) {
    p.push(`Your blood sugar levels have improved since they were last checked.`);
  }
  if (facts.admissions.length > 0) {
    p.push(`You've had ${facts.admissions.length} emergency ${facts.admissions.length === 1 ? "visit" : "visits"} — your care team has the details on file.`);
  }
  for (const a of facts.allergies) {
    p.push(`Your record shows you're allergic to ${a.label.toLowerCase()} — always mention this before taking a new medicine.`);
  }

  const medicines = facts.ongoing.map((m) => ({
    line: `${m.drug} ${m.strength} — ${plainFrequency(/* look up the Rx for this drug in the latest visit */)}`,
  }));

  return {
    empty: false,
    greeting: `Hello, ${facts.patient.name.split(" ")[0]}`,
    paragraphs: p,
    medicines,
    disclaimer: "This is a plain-language summary of your own health record, generated automatically. It does not replace advice from your doctor.",
  };
}
```

Add `plainFrequency(f: Frequency): string` to `prescribing.ts`, next to the
existing `frequencyShorthand`:

```ts
export function plainFrequency(f: Frequency): string {
  if (f.asNeeded) return "as needed";
  const slots = [f.morning, f.afternoon, f.night].filter((n) => n > 0).length;
  if (slots === 0) return "as directed";
  if (slots === 1) return f.night > 0 && f.morning === 0 ? "once a day, at night" : "once a day";
  if (slots === 2) return "twice a day";
  return "three times a day";
}
```

### New route

`frontend/src/app/clinician/patient-summary/page.tsx` — reads `?patient=`
the same way every other clinician page does, calls `computeSummaryFacts`
then `renderPatientSummary`. Visually, this page is meant to be turned toward
the patient or printed and handed to them, so it should *not* use the normal
`AppShell` chrome (no tabs, no clinician navigation) — larger type, the light
card visual mode, a print button matching the one already built in
`PatientQrPanel.tsx` (`window.print()`), and a single "Back to record" link
for the clinician. Put the disclaimer at the bottom, always visible, never
collapsed behind a tooltip.

Add an entry point: a "Print for patient" or "Show patient a summary" button
on `/clinician`'s record page, next to "Record a visit", linking to
`/clinician/patient-summary?patient=${patient.id}`.

---

## Feature C — Real, persisted, hash-chained audit log, with break-glass access

This upgrades your last major "shown as real, actually mock" gap, and adds
the one edge case every real access-control system has to handle: what
happens when the normal consent flow — scan the QR — isn't possible.

### Schema

Add to `db/schema.sql`, in its own transaction block after the existing one:

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS access_log (
  id          BIGSERIAL PRIMARY KEY,
  patient_id  TEXT REFERENCES patients(id),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('view_record', 'emergency_access')),
  outcome     TEXT NOT NULL CHECK (outcome IN ('granted', 'denied')),
  reason      TEXT,                 -- required by the API for emergency_access
  prev_hash   TEXT NOT NULL,
  hash        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_log_patient ON access_log(patient_id);

COMMIT;

-- Grants: the clinician role appends and reads its own log; the administrator
-- role gets nothing here either, deliberately — an access log is itself
-- identified data (it names a patient on every row), so it stays inside the
-- exact same boundary as patients and visits.

GRANT SELECT, INSERT ON access_log TO clinician_role;
-- BIGSERIAL's sequence needs its own grant — GRANT INSERT on the table alone
-- is not enough for a role to pull the next id from an identity/serial column.
GRANT USAGE, SELECT ON SEQUENCE access_log_id_seq TO clinician_role;
REVOKE ALL ON access_log FROM admin_role;
```

### Hash chain

New file `backend/app/audit.py`:

```python
"""
Hash-chains the access log: each row's hash is a function of the previous
row's hash plus its own fields, so altering any row breaks every hash after
it. Concurrency is handled with a Postgres advisory lock rather than locking
the last row directly — `SELECT ... FOR UPDATE ORDER BY id DESC LIMIT 1` is
the more obvious approach but behaves oddly under concurrent inserts; a fixed
advisory lock key serializes chain appends cleanly and releases automatically
at transaction end.
"""

import hashlib
import json

GENESIS = "0" * 64
CHAIN_LOCK_KEY = "hackmatrix_access_log_chain"


def compute_hash(prev_hash: str, patient_id, actor, action, outcome, reason, created_at: str) -> str:
    payload = json.dumps(
        {"prev": prev_hash, "patientId": patient_id, "actor": actor, "action": action,
         "outcome": outcome, "reason": reason, "at": created_at},
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()
```

### Endpoints

Add to `backend/app/models.py`:

```python
AccessAction = Literal["view_record", "emergency_access"]
AccessOutcome = Literal["granted", "denied"]

class AccessLogCreate(BaseModel):
    patientId: str | None = None
    actor: str
    action: AccessAction
    outcome: AccessOutcome = "granted"
    reason: str | None = None

class AccessLogEntry(BaseModel):
    id: int
    patientId: str | None
    actor: str
    action: AccessAction
    outcome: AccessOutcome
    reason: str | None
    prevHash: str
    hash: str
    createdAt: str
```

Add to `backend/app/routers/clinician.py`:

```python
from datetime import datetime, timezone
from ..audit import compute_hash, GENESIS, CHAIN_LOCK_KEY
from ..models import AccessLogCreate, AccessLogEntry

def _entry_from_row(row) -> AccessLogEntry:
    return AccessLogEntry(
        id=row.id, patientId=row.patient_id, actor=row.actor, action=row.action,
        outcome=row.outcome, reason=row.reason, prevHash=row.prev_hash, hash=row.hash,
        createdAt=row.created_at.isoformat(),
    )

@router.post("/access-log", response_model=AccessLogEntry, status_code=201)
def log_access(body: AccessLogCreate):
    if body.action == "emergency_access" and not (body.reason and body.reason.strip()):
        raise HTTPException(status_code=422, detail="A reason is required for emergency access")

    with clinician_engine().begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(hashtext(:key))"), {"key": CHAIN_LOCK_KEY})
        last_hash = conn.execute(text("SELECT hash FROM access_log ORDER BY id DESC LIMIT 1")).scalar_one_or_none()
        prev_hash = last_hash or GENESIS
        created_at = datetime.now(timezone.utc).isoformat()
        new_hash = compute_hash(prev_hash, body.patientId, body.actor, body.action, body.outcome, body.reason, created_at)

        row = conn.execute(
            text(
                """
                INSERT INTO access_log (patient_id, actor, action, outcome, reason, prev_hash, hash, created_at)
                VALUES (:patient_id, :actor, :action, :outcome, :reason, :prev_hash, :hash, :created_at)
                RETURNING *
                """
            ),
            {
                "patient_id": body.patientId, "actor": body.actor, "action": body.action,
                "outcome": body.outcome, "reason": body.reason, "prev_hash": prev_hash,
                "hash": new_hash, "created_at": created_at,
            },
        ).one()
    return _entry_from_row(row)


@router.get("/access-log", response_model=list[AccessLogEntry])
def list_access_log(patient_id: str | None = Query(default=None), limit: int = Query(default=200, le=1000)):
    clauses, params = [], {"limit": limit}
    if patient_id:
        clauses.append("patient_id = :patient_id")
        params["patient_id"] = patient_id
    where = f"WHERE {clauses[0]}" if clauses else ""
    with clinician_engine().connect() as conn:
        rows = conn.execute(
            text(f"SELECT * FROM access_log {where} ORDER BY id DESC LIMIT :limit"), params
        ).all()
    return [_entry_from_row(r) for r in rows]


@router.get("/access-log/verify")
def verify_chain():
    """Recomputes every row's hash from its stored fields and the previous
    row's hash, and reports the first point where they diverge. This is the
    tamper-evidence claim, made checkable rather than asserted — same idea as
    GET /admin/prove for the role separation."""
    with clinician_engine().connect() as conn:
        rows = conn.execute(text("SELECT * FROM access_log ORDER BY id")).all()

    expected_prev = GENESIS
    for r in rows:
        recomputed = compute_hash(
            expected_prev, r.patient_id, r.actor, r.action, r.outcome, r.reason, r.created_at.isoformat()
        )
        if r.prev_hash != expected_prev or r.hash != recomputed:
            return {"valid": False, "brokenAtId": r.id, "rowsChecked": r.id}
        expected_prev = r.hash
    return {"valid": True, "rowsChecked": len(rows)}
```

### Frontend wiring

On a successful decode in `clinician/scan/page.tsx`'s `handleDecode`, fire a
background `POST /clinician/access-log` with `{patientId, actor: "Dr. R.
Deshmukh", action: "view_record", outcome: "granted"}` before navigating —
don't block the redirect on it.

Add a break-glass path on the same page: a small link, "Can't scan this
patient?", opening a short form — a patient search (reuse
`findPatientsByQuery`) plus a required reason field. On submit, `POST
/clinician/access-log` with `action: "emergency_access"`, the typed reason,
and the selected patient, then navigate to
`` `/clinician?patient=${id}&emergency=1` ``. On the record page, when
`emergency=1` is present, show a persistent `tone="danger"` banner: "Opened
via emergency access — reason logged in the audit trail." Be precise in code
comments that this query parameter is a *display cue only* — the actual
record of the access is the database row, which exists regardless of the
URL, and nobody should mistake the parameter itself for a security control.

Rewrite `clinician/audit/page.tsx` to fetch `GET /clinician/access-log`
instead of importing the hardcoded `accessLog` array — same rendering, real
hashes now. Add a "Verify chain" button calling `GET
/clinician/access-log/verify` and showing the result inline (a green
"265 entries verified, chain intact" or a red "break detected at entry #N").

---

## Feature D — Care-gap follow-up detection

Pure function, no schema change needed — it's derived entirely from data
already in `patients`/`visits`.

Add to `frontend/src/lib/clinical.ts`:

```ts
export type FollowUpGap = {
  patient: Patient;
  lastVisit: Visit;
  drug: string;
  ongoingSince: string;
  daysSinceLastVisit: number;
};

/**
 * A patient on an open-ended medicine (no stop date — the long-term case,
 * diabetes, hypertension) who hasn't been seen in `thresholdDays`. This flags
 * an attendance gap, not a clinical judgment — it says nothing about whether
 * the gap matters for this patient, only that it exists.
 */
export function overdueFollowUps(
  patients: Patient[],
  visits: Visit[],
  facility: string,
  thresholdDays = 90,
  asOf: Date = new Date(),
): FollowUpGap[] {
  const out: FollowUpGap[] = [];

  for (const patient of patients.filter((p) => p.facility === facility)) {
    const theirs = visitsForPatient(visits, patient.id);
    if (theirs.length === 0) continue;

    const ongoing = theirs
      .flatMap((v) => v.prescriptions.filter((p) => p.durationDays === null).map((p) => ({ p, v })))
      .sort((a, b) => a.v.date.localeCompare(b.v.date));
    if (ongoing.length === 0) continue;

    const last = [...theirs].sort((a, b) => b.date.localeCompare(a.date))[0];
    const daysSince = Math.floor((asOf.getTime() - new Date(last.date).getTime()) / 86_400_000);
    if (daysSince < thresholdDays) continue;

    out.push({
      patient, lastVisit: last, drug: ongoing[0].p.drug,
      ongoingSince: ongoing[0].v.date, daysSinceLastVisit: daysSince,
    });
  }

  return out.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}
```

New route `frontend/src/app/clinician/follow-ups/page.tsx`: since there's no
real auth yet to derive "the logged-in clinician's facility" from, add a
facility selector (reuse the `FACILITIES` list) defaulting to `PHC Wagholi`
— say so plainly in a one-line note, consistent with how the rest of the
project already documents what auth doesn't yet do. List each gap: "Priya
Nair — on Metformin since Jun 2023, last seen 142 days ago," with a "Record a
visit" link into `/clinician/visit/new?patient=${id}`. Add a `Follow-ups`
entry to `clinicianTabs` in `demo-data.ts` — this is a real feature, not a
buried one.

---

## Feature E — Offline-first write queue (stretch — only if 1–2 is not enough time on their own)

The most authentic feature to the real deployment context — rural PHC
connectivity is unreliable — and the one your architecture is already closest
to supporting, because `store.tsx` already degrades gracefully on read
failure. This extends that same idea to writes.

In `store.tsx`, when `addPatient`/`addVisit`'s `fetch` throws (a network
error specifically — distinguish from a `4xx` the server actually answered,
which is a real rejection, not a connectivity problem), push the payload into
a queue persisted to `localStorage` instead of just setting `error`. Track
`pendingCount` in the store's context value.

On mount, and again on the browser's `online` event, attempt to flush the
queue in order: `POST` each item; on success or on `409` (the id already
exists — meaning an earlier attempt actually reached the server even though
the response was lost) remove it from the queue; on a network failure, stop
and leave the rest queued for next time. Because ids are already generated
client-side (`nextPatientId`, and the visit id built in
`visit/new/page.tsx`'s `save()`), a replayed write is naturally idempotent —
the backend's existing "honour a client-supplied id, 409 if taken" behavior
(already in `create_patient`) is exactly what makes this safe without any
new server-side idempotency key.

Surface `pendingCount` as a small badge in `AppShell` — "3 changes waiting to
sync" in a `tone="warning"` badge, clearing to a brief "All changes synced"
when the queue drains.

---

## Suggested order

1. Feature 0 (wire admin to the real backend) + Feature A (signals) +
   `db/spike.sql`. These belong together — there is nothing to build A on
   without 0, and nothing to demo on A without a spike in the seed data.
2. Feature C (schema, hash chain, break-glass endpoints, then the frontend
   wiring). The largest single piece — plan a full block of time for it.
3. Feature D (care-gap function and page) — small, can slot in alongside or
   right after C since it touches none of the same files.
4. Feature B (summary refactor and the patient-facing route) — do this after
   the others, since the `summary.ts` refactor is worth doing carefully
   rather than squeezed in.
5. Feature E only if you're genuinely ahead by the time you reach it.

Leave real days at the end — not hours — for full regression testing across
all of this together, a README pass documenting each new claim the same way
the existing ones are documented, and rehearsal.
