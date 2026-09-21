-- Hackmatrix — a synthetic outbreak, so the signal detector has something real
-- to find.
--
-- This spike is DELIBERATELY INSERTED. It is not organic activity emerging from
-- the other seed data, and it should be described that way in the demo. A
-- manufactured spike used to exercise a real detector is legitimate; presenting
-- it as naturally occurring would not be.
--
-- Run after schema.sql, seed.sql and bulk.sql:
--   psql "$SUPERUSER_URL" -f db/spike.sql

BEGIN;

DELETE FROM visits   WHERE id LIKE 'v-spike-%';
DELETE FROM patients WHERE id LIKE 'PT-SPIKE-%';

DO $$
DECLARE
  target_district  TEXT := 'Wagholi';
  target_condition TEXT := 'Dengue';
  i INT;
BEGIN
  FOR i IN 1..60 LOOP
    INSERT INTO patients (id, name, dob, gender, facility, district, registered_at)
    VALUES (
      'PT-SPIKE-' || i,
      'Synthetic Patient S' || i,          -- placeholder, never a real name
      DATE '1990-01-01',
      'Other',
      'PHC Wagholi',
      target_district,
      CURRENT_DATE
    )
    ON CONFLICT (id) DO NOTHING;

    -- Every spike visit is dated today, so all forty land in the *current*
    -- week bucket. Spreading them over the last few days looks more organic
    -- but silently breaks the demo when today is early in the week: Postgres
    -- weeks start on Monday, so "today minus two days" can fall into the
    -- previous bucket and inflate the very baseline the spike is measured
    -- against.
    INSERT INTO visits (id, patient_id, visit_date, display_date, facility, diagnosis, notes)
    VALUES (
      'v-spike-' || i,
      'PT-SPIKE-' || i,
      CURRENT_DATE,
      to_char(CURRENT_DATE, 'DD Mon YYYY'),
      'PHC Wagholi',
      target_condition,
      'Synthetic — inserted for the outbreak-signal demo, not real activity.'
    );
  END LOOP;
END $$;

COMMIT;

-- Check what the detector now sees:
--   curl -s localhost:8000/admin/signals | python3 -m json.tool
--
-- Expect Dengue in Wagholi at a high ratio against its own trailing average.
-- Other pairs should stay quiet — a detector that flags everything is as
-- useless as one that flags nothing.
