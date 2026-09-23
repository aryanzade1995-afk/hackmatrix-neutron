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

## Testing

```
cd backend
python3 -m pytest tests/ -q
```

32 tests, about seven seconds. Three files, three different claims:

| File | Asserts |
|---|---|
| `test_role_separation.py` | Postgres refuses the reads and writes the grants do not allow |
| `test_suppression.py` | No group below k=5 reaches the administrator's views |
| `test_auth.py` | Routes refuse callers who have not proved who they are, or proved the wrong thing |

### These run against the development database

Not a throwaway one, and that is deliberate. The thing under test *is* the
Postgres grant. A mock, or a SQLite stand-in, would assert nothing — worse
than no test, because it would look like proof.

Two safeguards make that acceptable:

- **Nothing writes to an application table.** The only rows created are two
  temporary `staff` accounts with uuid-suffixed usernames, removed in fixture
  teardown — which runs even when tests fail. The suppression tests read only.
- **A guard refuses to run** unless the target database is named `hackmatrix`.
  Point `DATABASE_URL_CLINICIAN` anywhere else and the suite exits before
  collecting a single test.

To confirm the database is untouched afterwards:

```
psql "$SUPER" -c "SELECT count(*) FROM staff WHERE username LIKE 'pytest.%';"
```

That should be `0`.

### Requirements

The tests need a seeded database — run `db/dev-db.sh reseed` first if
`test_suppression.py` reports that a view returned nothing. They also need
`db/auth.sql` applied and `AUTH_SECRET_KEY` set in `.env`, or the auth tests
cannot mint a session.

### One thing worth knowing about these tests

`test_clinician_cannot_modify_visits` asserts on the *error message*, not just
the exception type. Its first version used `WHERE id = -1`, which raised
`ProgrammingError` — but because `visits.id` is TEXT and Postgres rejected the
comparison before it ever considered the privilege. The test passed while
proving nothing. If you add tests here, assert what the failure actually says.

Similarly, `test_suppression_actually_suppresses_something` exists to stop the
other two suppression tests passing vacuously: if no group in the seed data
fell below the threshold, a view with no filter at all would satisfy them.

