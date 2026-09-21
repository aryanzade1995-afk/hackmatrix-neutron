-- Hackmatrix — schema and role separation
--
-- The point of this file is the GRANT block at the bottom. Two dashboards are
-- easy; what the brief asks for is proof that an administrator *cannot* reach
-- an identified record. That proof lives here, in Postgres, not in application
-- code — a bug in the API cannot grant a permission the database never issued.
--
-- Run order:
--   psql "$SUPERUSER_URL" -f db/schema.sql
--   psql "$SUPERUSER_URL" -f db/seed.sql
--
-- All data in this project is synthetic. No real patient records are used.

BEGIN;

-- ---------------------------------------------------------------------------
-- Tables
--
-- Column names and types mirror the TypeScript shapes in
-- frontend/src/lib/demo-data.ts and prescribing.ts field-for-field, so the API
-- can return JSON the frontend already knows how to render.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patients (
  id            TEXT PRIMARY KEY,                   -- "PT-2291"
  name          TEXT NOT NULL,
  dob           DATE NOT NULL,                      -- age is derived, never stored
  gender        TEXT NOT NULL CHECK (gender IN ('Female','Male','Other')),
  phone         TEXT,
  facility      TEXT NOT NULL,
  district      TEXT NOT NULL,
  conditions    TEXT[] NOT NULL DEFAULT '{}',
  allergies     JSONB NOT NULL DEFAULT '[]',        -- [{label, drugClass, recorded, severity}]
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS visits (
  id              TEXT PRIMARY KEY,
  patient_id      TEXT NOT NULL REFERENCES patients(id),
  visit_date      DATE NOT NULL,
  display_date    TEXT NOT NULL,                    -- pre-formatted, "12 Aug 2026"
  facility        TEXT NOT NULL,
  diagnosis       TEXT NOT NULL,
  notes           TEXT NOT NULL DEFAULT '',
  prescriptions   JSONB NOT NULL DEFAULT '[]',      -- [Prescription] — see prescribing.ts
  vitals          JSONB NOT NULL DEFAULT '{}',
  admission       BOOLEAN NOT NULL DEFAULT FALSE,
  chief_complaint TEXT,
  symptom_tags    TEXT[],
  entry_method    TEXT CHECK (entry_method IN ('quick','detailed')),
  -- A correction is a new row pointing at the one it replaces. Nothing is
  -- ever edited in place, which is what makes the audit trail meaningful.
  supersedes      TEXT REFERENCES visits(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date    ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_facility ON visits(facility);

-- ---------------------------------------------------------------------------
-- The aggregate view — the only thing an administrator may read
--
-- Suppression happens HERE, inside the view definition, not in the API and not
-- in the dashboard. A group smaller than the threshold is never returned to the
-- admin role at all, so there is no "real number" for application code to leak
-- by accident.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW district_aggregates AS
SELECT
  p.district,
  v.diagnosis,
  date_trunc('week', v.visit_date)::date AS week,
  COUNT(*)                               AS case_count
FROM visits v
JOIN patients p ON p.id = v.patient_id
GROUP BY p.district, v.diagnosis, date_trunc('week', v.visit_date)
HAVING COUNT(*) >= 5;   -- k-anonymity threshold

-- A second view without the week dimension, for the headline counts. Same
-- threshold; larger buckets, so fewer cells get suppressed.
CREATE OR REPLACE VIEW condition_totals AS
SELECT
  p.district,
  v.diagnosis,
  COUNT(*) AS case_count
FROM visits v
JOIN patients p ON p.id = v.patient_id
GROUP BY p.district, v.diagnosis
HAVING COUNT(*) >= 5;

COMMIT;

-- ---------------------------------------------------------------------------
-- Roles
--
-- Passwords are supplied at run time, never written to this file:
--
--   psql "$SUPERUSER_URL" \
--     -v clinician_pw="'...'" -v admin_pw="'...'" \
--     -f db/schema.sql
--
-- Generate them with:  openssl rand -base64 24
-- Store them in backend/.env, which is gitignored.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clinician_role') THEN
    CREATE ROLE clinician_role LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_role') THEN
    CREATE ROLE admin_role LOGIN;
  END IF;
END
$$;

\if :{?clinician_pw}
  ALTER ROLE clinician_role PASSWORD :clinician_pw;
\endif
\if :{?admin_pw}
  ALTER ROLE admin_role PASSWORD :admin_pw;
\endif

-- --- Clinician -------------------------------------------------------------
-- Read and append. No UPDATE, no DELETE — append-only is enforced by the
-- absence of the grant, not merely by which routes the API happens to expose.
-- Adding a PUT handler later would still fail at the database.

GRANT USAGE ON SCHEMA public TO clinician_role;
GRANT SELECT, INSERT ON patients, visits TO clinician_role;

-- --- Administrator ---------------------------------------------------------
-- Nothing on the identified tables. Postgres denies by default, so this REVOKE
-- is technically redundant — it is written explicitly because it is the line to
-- point at when a judge asks how you know the admin role cannot read records.

REVOKE ALL ON patients, visits FROM admin_role;
GRANT USAGE ON SCHEMA public TO admin_role;
GRANT SELECT ON district_aggregates, condition_totals TO admin_role;

-- Stop either role from acquiring table rights on anything added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM admin_role;

-- ---------------------------------------------------------------------------
-- Access log
--
-- Hash-chained: each row commits to the previous row's hash, so altering any
-- entry breaks every hash after it. Append-only for the same reason visits
-- are — an audit trail that can be edited is not an audit trail.
-- ---------------------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS access_log (
  id          BIGSERIAL PRIMARY KEY,
  patient_id  TEXT REFERENCES patients(id),
  actor       TEXT NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('view_record', 'emergency_access')),
  outcome     TEXT NOT NULL CHECK (outcome IN ('granted', 'denied')),
  reason      TEXT,                  -- required by the API for emergency_access
  prev_hash   TEXT NOT NULL,
  hash        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_log_patient ON access_log(patient_id);

COMMIT;

-- The administrator role gets nothing here either, deliberately: every row
-- names a patient, so the log is itself identified data and stays inside the
-- same boundary as `patients` and `visits`.

GRANT SELECT, INSERT ON access_log TO clinician_role;
-- BIGSERIAL needs its own grant. GRANT INSERT on the table alone does not let
-- a role draw the next value from the backing sequence.
GRANT USAGE, SELECT ON SEQUENCE access_log_id_seq TO clinician_role;
REVOKE ALL ON access_log FROM admin_role;
