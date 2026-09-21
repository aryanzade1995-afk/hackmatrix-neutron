-- Hackmatrix — bulk synthetic volume for the administrator dashboard
--
-- Entirely generated. Names are drawn from common Marathi and Muslim name
-- pools appropriate to the Pune-district setting used throughout this
-- project (matching the mix already in db/seed.sql: Pawar, Jadhav, Sheikh,
-- Nair, Kulkarni) so the roster reads as a plausible patient population
-- rather than a placeholder — but every one of these 260 people is
-- invented. No name here belongs to a real person.
--
-- The distribution is deliberately uneven: common conditions in large
-- districts clear the k=5 threshold and appear on the dashboard, while rarer
-- conditions and small districts stay below it and are suppressed. Showing
-- both at once is the point — a dashboard that only ever shows data proves
-- nothing about privacy.
--
--   psql "$SUPERUSER_URL" -f db/bulk.sql
--
-- NOTE: this generator changed from an earlier version (plain "Synthetic
-- Patient N" names, five diagnosis categories). If db/README.md's "Verified
-- output" numbers were captured against the old version, re-run the proof
-- and update them — the exact suppressed/visible counts will differ now
-- that there are more diagnosis categories to spread the same visit volume
-- across.

BEGIN;

DELETE FROM visits   WHERE id LIKE 'bv-%';
DELETE FROM patients WHERE id LIKE 'BP-%';

-- ---------------------------------------------------------------------------
-- Cohort — 260 synthetic patients spread unevenly across four districts
-- ---------------------------------------------------------------------------

INSERT INTO patients (id, name, dob, gender, facility, district, conditions, allergies, registered_at)
SELECT
  'BP-' || LPAD(n::text, 4, '0'),
  g.first_name || ' ' || g.last_name,
  DATE '1950-01-01' + (n * 97 % 25000),
  g.gender,
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
FROM generate_series(1, 260) AS n
CROSS JOIN LATERAL (
  SELECT
    gg.gender,
    CASE
      WHEN gg.gender = 'Female' THEN (ARRAY[
        'Ashwini','Sneha','Pooja','Kavita','Anjali','Neha','Priyanka','Rekha',
        'Manisha','Sunanda','Fatima','Zara','Aarti','Swati','Rupali','Vaishali',
        'Meenakshi','Shalini','Nasreen','Komal'
      ])[1 + (n % 20)]
      ELSE (ARRAY[
        'Rahul','Vikram','Sanjay','Ganesh','Amit','Rohan','Suresh','Prakash',
        'Sachin','Nitin','Imran','Faisal','Arjun','Vishal','Deepak','Ramesh',
        'Anil','Manoj','Kiran','Yusuf'
      ])[1 + (n % 20)]
    END AS first_name,
    (ARRAY[
      'Pawar','Jadhav','Shinde','Kulkarni','Deshmukh','Patil','More','Gaikwad',
      'Kale','Bhosale','Sheikh','Ansari','Khan','Pathan','Nair','Iyer',
      'Kumar','Sharma','Verma','Reddy'
    ])[1 + ((n * 7) % 20)] AS last_name
  FROM (
    -- "Other" is rare, as it is in any real registry; the remainder splits
    -- roughly evenly between Male and Female.
    SELECT CASE WHEN n % 47 = 0 THEN 'Other' WHEN n % 2 = 0 THEN 'Male' ELSE 'Female' END AS gender
  ) AS gg
) AS g;

-- ---------------------------------------------------------------------------
-- Visits — roughly 1,300 rows over the last 12 weeks
--
-- Ten diagnosis categories instead of five, weighted so the caseload reads
-- like an actual PHC's: dengue and the two chronic-follow-up conditions
-- dominate, viral fever and the common complaints make up a middle tier, and
-- malaria and tuberculosis stay rare — especially in Baramati, which is the
-- cell worth pointing at when demonstrating suppression.
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
  c.diagnosis,
  c.note,
  '[]'::jsonb,
  '{}'::jsonb,
  'quick'
FROM generate_series(1, 260) AS n
CROSS JOIN generate_series(1, 5) AS k
CROSS JOIN LATERAL (
  SELECT (CURRENT_DATE - ((n * 7 + k * 11) % 84))::date AS visit_date
) AS d
CROSS JOIN LATERAL (
  SELECT dd.diagnosis,
    CASE dd.diagnosis
      WHEN 'Dengue'                    THEN 'Fever with rash, referred for platelet monitoring.'
      WHEN 'Diabetes'                  THEN 'Routine glycemic review, dose reviewed.'
      WHEN 'Hypertension'              THEN 'Routine blood pressure check, medication continued.'
      WHEN 'Viral fever'               THEN 'Fever and malaise, symptomatic treatment given.'
      WHEN 'Common cold'               THEN 'Mild upper respiratory symptoms, advised rest.'
      WHEN 'Gastroenteritis'           THEN 'Loose motions, ORS advised.'
      WHEN 'Urinary tract infection'   THEN 'Burning micturition, antibiotics started.'
      WHEN 'Chikungunya'               THEN 'Fever with joint pain, symptomatic care given.'
      WHEN 'Tuberculosis'              THEN 'On DOTS therapy, adherence reviewed.'
      WHEN 'Malaria'                   THEN 'Fever with chills, rapid test reviewed.'
      ELSE ''
    END AS note
  FROM (
    SELECT
      (CASE
        WHEN m < 1  THEN 'Malaria'
        WHEN m < 3  THEN 'Tuberculosis'
        WHEN m < 5  THEN 'Chikungunya'
        WHEN m < 8  THEN 'Urinary tract infection'
        WHEN m < 12 THEN 'Gastroenteritis'
        WHEN m < 17 THEN 'Common cold'
        WHEN m < 25 THEN 'Viral fever'
        WHEN m < 40 THEN 'Hypertension'
        WHEN m < 60 THEN 'Diabetes'
        ELSE             'Dengue'
      END) AS diagnosis
    FROM (SELECT (n * 13 + k * 29) % 100 AS m) AS mm
  ) AS dd
) AS c;

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
-- This has been re-run and verified: with seed.sql + bulk.sql loaded there are
-- 56 total (district, diagnosis) groups, 33 visible to the admin role, 23
-- suppressed. Malaria stays below the threshold even in Pune City, the
-- largest district (4 visits there vs. 6 in Wagholi, which clears it) — that
-- contrast is a better live talking point than picking on the smallest
-- district, since it shows the rule reacts to the actual count in a cell, not
-- to district size. Full numbers and the exact suppressed groups are recorded
-- in db/README.md's "Verified output" section — re-run and update both if
-- this generator changes again.
-- ---------------------------------------------------------------------------
