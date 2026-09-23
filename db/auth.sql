-- ---------------------------------------------------------------------------
-- Staff accounts.
--
-- Apply AFTER schema.sql and BEFORE seed.sql:
--
--     psql "$SUPER" -v auth_pw="'...'" -f db/auth.sql
--
-- This table answers "who is asking", which is a different question from the
-- one the rest of db/schema.sql answers ("what may this connection reach").
-- Both are enforced, independently — see the comment on the grants below.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS staff (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('clinician','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- A third database role, for the login endpoint only.
--
-- The obvious shortcut is to read `staff` over clinician_engine(), since that
-- connection already exists. This file does not, for one reason: that role
-- holds SELECT on `patients` and `visits`. Routing the login path through it
-- would mean an unauthenticated request — the one request anybody on the
-- internet can make — arrives on a connection that can read every patient
-- record. The bug that turns that into a breach is a single bad query in a
-- handler that is, by definition, reachable before any identity check has run.
--
-- auth_role can read exactly one table: usernames, bcrypt hashes and roles.
-- It cannot see a patient, a visit, an aggregate, or the audit log. So the
-- worst case for a flaw in routers/auth.py is the disclosure of password
-- hashes — bad, but bounded, and bcrypt is what stands behind that.
--
-- It also keeps the project's central claim honest at a third point: every
-- connection holds the narrowest grant that lets it do its job.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_role') THEN
    CREATE ROLE auth_role LOGIN;
  END IF;
END
$$;

\if :{?auth_pw}
  ALTER ROLE auth_role PASSWORD :auth_pw;
\endif

-- Deny first, then grant the single thing it needs.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM auth_role;
GRANT USAGE ON SCHEMA public TO auth_role;
GRANT SELECT ON staff TO auth_role;

-- No INSERT/UPDATE/DELETE on staff either. Accounts are created by
-- db/seed_staff.py over a superuser connection, deliberately out of band: a
-- running API that can mint its own accounts is a running API that can mint an
-- attacker one.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM auth_role;

-- The other two roles have no business here.
REVOKE ALL ON staff FROM clinician_role, admin_role;
