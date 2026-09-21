-- Hackmatrix — bulk synthetic volume for the administrator dashboard
--
-- Entirely generated. No names, no phone numbers, no clinical detail — these
-- rows exist only so the aggregate views have something to count.
--
-- The distribution is deliberately uneven: common conditions in large districts
-- clear the k=5 threshold and appear on the dashboard, while rare conditions in
-- small districts stay below it and are suppressed. Showing both at once is the
-- point — a dashboard that only ever shows data proves nothing about privacy.
--
--   psql "$SUPERUSER_URL" -f db/bulk.sql

BEGIN;

DELETE FROM visits   WHERE id LIKE 'bv-%';
DELETE FROM patients WHERE id LIKE 'BP-%';

-- ---------------------------------------------------------------------------
-- Cohort — 260 synthetic patients spread unevenly across four districts
-- ---------------------------------------------------------------------------

INSERT INTO patients (id, name, dob, gender, facility, district, conditions, allergies, registered_at)
SELECT
  'BP-' || LPAD(n::text, 4, '0'),
  'Synthetic Patient ' || n,                       -- placeholder, never a real name
  DATE '1950-01-01' + (n * 97 % 25000),
  (ARRAY['Female','Male','Other'])[1 + (n % 3)],
  CASE n % 4
    WHEN 0 THEN 'PHC Wagholi'
    WHEN 1 THEN 'District Hospital Pune'
    WHEN 2 THEN 'Rural PHC Baramati'
    ELSE        'Sub-Center Hadapsar'
  END,
  -- Weighted: Pune City is large, Baramati small, so suppression bites there.
  CASE
    WHEN n % 10 < 4 THEN 'Pune City'
    WHEN n % 10 < 7 THEN 'Wagholi'
    WHEN n % 10 < 9 THEN 'Hadapsar'
    ELSE                 'Baramati'
  END,
  ARRAY[]::text[],
  '[]'::jsonb,
  DATE '2023-01-01' + (n * 3 % 1000)
FROM generate_series(1, 260) AS n;

-- ---------------------------------------------------------------------------
-- Visits — roughly 1,300 rows over the last 12 weeks
--
-- Condition mix is weighted so dengue and diabetes are common everywhere while
-- malaria is rare, especially in Baramati. That combination is what ends up
-- suppressed on the dashboard.
-- ---------------------------------------------------------------------------

INSERT INTO visits (id, patient_id, visit_date, display_date, facility, diagnosis, notes, prescriptions, vitals, entry_method)
SELECT
  'bv-' || n || '-' || k,
  'BP-' || LPAD(n::text, 4, '0'),
  d.visit_date,
  TO_CHAR(d.visit_date, 'DD Mon YYYY'),
  CASE n % 4
    WHEN 0 THEN 'PHC Wagholi'
    WHEN 1 THEN 'District Hospital Pune'
    WHEN 2 THEN 'Rural PHC Baramati'
    ELSE        'Sub-Center Hadapsar'
  END,
  CASE
    WHEN (n + k) % 17 = 0 THEN 'Malaria'          -- deliberately rare
    WHEN (n + k) % 11 = 0 THEN 'Tuberculosis'
    WHEN (n + k) % 4  = 0 THEN 'Hypertension'
    WHEN (n + k) % 3  = 0 THEN 'Diabetes'
    ELSE                       'Dengue'
  END,
  '',
  '[]'::jsonb,
  '{}'::jsonb,
  'quick'
FROM generate_series(1, 260) AS n
CROSS JOIN generate_series(1, 5) AS k
CROSS JOIN LATERAL (
  SELECT (CURRENT_DATE - ((n * 7 + k * 11) % 84))::date AS visit_date
) AS d;

COMMIT;

-- ---------------------------------------------------------------------------
-- What to expect afterwards
--
--   SELECT COUNT(*) FROM condition_totals;
--     -> several rows: the combinations that cleared k = 5
--
--   -- The same query without the threshold, run as a superuser, shows how many
--   -- groups exist in total. The difference is what suppression removed.
--   SELECT COUNT(*) FROM (
--     SELECT p.district, v.diagnosis
--     FROM visits v JOIN patients p ON p.id = v.patient_id
--     GROUP BY p.district, v.diagnosis
--   ) all_groups;
--
-- Malaria in Baramati should be among the suppressed ones — that is the cell to
-- point at when demonstrating the threshold.
-- ---------------------------------------------------------------------------
