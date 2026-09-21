# Database — and how the role separation is proved

The brief asks for access controls that **provably** prevent administrators from
viewing individual identifiable records. This directory is where that claim is
substantiated.

The distinction that matters: the separation is not an `if (role === 'admin')`
check in application code. It is a Postgres grant. A bug in the API cannot hand
out a permission the database never issued.

---

## Files

| File | What it does |
|---|---|
| `schema.sql` | Tables, the two roles, the grants, and the suppressed aggregate views |
| `seed.sql` | The 23 synthetic visits (15 named patients) used by the clinician demo, transcribed from `frontend/src/lib/demo-data.ts` |
| `bulk.sql` | ~1,300 generated rows so the admin dashboard has volume, deliberately uneven so some groups suppress and others don't |

All data is synthetic. No real patient records are used anywhere in this project.

---

## Setup

Use a hosted Postgres (Supabase or Neon, both free tier) rather than a local
install, so the demo doesn't depend on a service running on one laptop.

Generate two passwords and keep them out of git:

```bash
openssl rand -base64 24   # clinician
openssl rand -base64 24   # admin
```

Apply the schema, passing them in rather than writing them into the file:

```bash
psql "$SUPERUSER_URL" \
  -v clinician_pw="'PASTE_CLINICIAN_PW'" \
  -v admin_pw="'PASTE_ADMIN_PW'" \
  -f db/schema.sql

psql "$SUPERUSER_URL" -f db/seed.sql
psql "$SUPERUSER_URL" -f db/bulk.sql
```

Then put the two connection strings in `backend/.env` (gitignored):

```
DATABASE_URL_CLINICIAN=postgresql://clinician_role:...@host/db
DATABASE_URL_ADMIN=postgresql://admin_role:...@host/db
```

---

## The proof

Three commands. Run them in this order — the first is the one that matters.

### 1. The administrator cannot read patient records

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT * FROM patients;"
```

```
ERROR:  permission denied for table patients
```

That error comes from Postgres, not from our code. There is no route to
bypass, no flag to flip, and no bug we could introduce in the API that would
make this succeed — the `admin_role` was never granted `SELECT` on this table.

The same holds for `visits`:

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT * FROM visits;"
# ERROR:  permission denied for table visits
```

### 2. The administrator can read aggregates

```bash
psql "$DATABASE_URL_ADMIN" -c "SELECT * FROM condition_totals ORDER BY case_count DESC LIMIT 10;"
```

Returns district/diagnosis counts. Every row has `case_count >= 5`, because
the threshold lives in the view's `HAVING` clause — groups below it are never
returned to this role at all. There is no suppressed value sitting in the
response for the dashboard to accidentally reveal.

### 3. The clinician can read records

```bash
psql "$DATABASE_URL_CLINICIAN" -c "SELECT id, name, facility FROM patients LIMIT 3;"
```

Returns rows. The clinician role has `SELECT, INSERT` — and deliberately not
`UPDATE` or `DELETE`:

```bash
psql "$DATABASE_URL_CLINICIAN" -c "DELETE FROM visits WHERE id = 'v-2026-08-12';"
# ERROR:  permission denied for table visits
```

Append-only is enforced by the absence of the grant, not by which routes the API
happens to expose. Adding a `PUT` handler later would still fail here.

---

### 4. Append-only is enforced by the database

```bash
psql "$DATABASE_URL_CLINICIAN" -c "UPDATE visits SET diagnosis='x' WHERE id='v-2026-08-12';"
# ERROR:  permission denied for table visits

psql "$DATABASE_URL_CLINICIAN" -c "INSERT INTO patients (...) VALUES (...);"
# INSERT 0 1
```

Insert succeeds, update and delete do not.

---

## Verified output

Every command above was re-run against a real Postgres 16 instance after the
September 2026 data-realism pass (real Maharashtra-region names, ten diagnosis
categories, ten new named clinician-demo patients) — with this schema,
`seed.sql` and `bulk.sql` loaded: 276 patients, 1,323 visits:

```
Admin   SELECT * FROM patients          ERROR: permission denied for table patients
Admin   SELECT * FROM visits            ERROR: permission denied for table visits
Admin   SELECT * FROM condition_totals  10 rows shown (LIMIT 10, ORDER BY case_count DESC):
                                           Pune City/Dengue 207, Wagholi/Dengue 154,
                                           Hadapsar/Dengue 106, Pune City/Diabetes 104,
                                           Wagholi/Diabetes 81, Pune City/Hypertension 81,
                                           Wagholi/Hypertension 55, Baramati/Dengue 54,
                                           Hadapsar/Diabetes 52, Pune City/Viral fever 40
Clin    SELECT * FROM patients          3 rows (Priya Nair, Aarav Kulkarni, Sunita Deshpande)
Clin    DELETE FROM visits              ERROR: permission denied for table visits
Clin    UPDATE visits                   ERROR: permission denied for table visits
Clin    INSERT INTO patients            INSERT 0 1
```

Suppression measured on the same data:

```
total (district, diagnosis) groups   56
visible to admin (n >= 5)            33
suppressed (n < 5)                   23
```

Worth noting which groups fall below the line: every one of the named
clinician-demo patients' diagnoses does — an administrator cannot see Priya
Nair's throat infection, or Vikram Pawar's tuberculosis, or Komal Verma's
cellulitis, even in aggregate, because each of those cells has a count of one
or two. It also catches rarer conditions inside the bulk cohort: even in Pune
City, the largest district, malaria only reached 4 recorded visits this run —
below the threshold — while the same condition cleared it in Wagholi (6
visits). That contrast is worth pointing at live: size of the district isn't
what decides suppression, the count in that specific cell is.

Because the generators in `bulk.sql` and `seed.sql` are deterministic (based
on row number, not real randomness), re-running this exact proof against an
unmodified checkout will reproduce these same numbers. If either file changes
again, re-run the proof and update this section rather than trusting stale
figures — an outdated "verified" count is worse than none.

---

## Why the threshold is in the view

`district_aggregates` and `condition_totals` both carry
`HAVING COUNT(*) >= 5`. Putting suppression in the view rather than in the API
means:

- The admin database role has no way to see the unsuppressed number
- No application code path can leak it, because it was never fetched
- The rule is auditable in one place, in SQL, rather than scattered across handlers

After loading only `seed.sql`, `district_aggregates` returns **zero rows** —
23 visits spread across 15 named patients are not enough for any weekly group
to reach five. That is the suppression working correctly, not a bug. `bulk.sql`
adds volume so some groups clear the threshold while rare ones (malaria in
Pune City, for instance — see "Verified output" below) stay hidden.

---

## Record the proof before demo day

Live `psql` on stage is a risk — venue wifi, a laptop that won't wake, a typo
under pressure. Record the three commands above as a short screen capture while
everything is working, and keep it as a fallback.

---

## What this does not yet cover

Being precise about the gap, since the point of this directory is provability:

- **Authentication is not built.** `/login` is a cosmetic role picker. The
  *data* separation is real and provable; deciding *which* role a given human
  gets is still ahead. Say this plainly in the demo rather than letting a judge
  discover it.
- **The audit log is not yet in the database.** The hash-chained log shown in
  the UI is frontend mock data.
- **Re-identification via repeated queries** is not defended against. A
  threshold on single queries does not stop someone differencing overlapping
  aggregates. Real deployments need query logging and budgets; we have neither.
