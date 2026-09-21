-- Hackmatrix — synthetic seed data
--
-- Transcribed from frontend/src/lib/demo-data.ts so the database and the UI
-- tell exactly the same story. Nothing here is real: the names, phone numbers,
-- conditions and prescriptions are all invented for demonstration.
--
--   psql "$SUPERUSER_URL" -f db/seed.sql

BEGIN;

TRUNCATE visits, patients RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------

INSERT INTO patients (id, name, dob, gender, phone, facility, district, conditions, allergies, registered_at) VALUES
  ('PT-2291', 'Priya Nair', '1979-04-12', 'Female', '+91 98xxxxxx12',
   'PHC Wagholi', 'Pune City',
   ARRAY['Type 2 diabetes','Hypertension'],
   '[{"label":"Penicillin","drugClass":"penicillin","recorded":"02 Jun 2023","severity":"severe"}]'::jsonb,
   '2023-06-02'),

  ('PT-2314', 'Aarav Kulkarni', '2018-11-30', 'Male', '+91 97xxxxxx40',
   'Sub-Center Hadapsar', 'Hadapsar',
   ARRAY[]::text[], '[]'::jsonb, '2024-01-18'),

  ('PT-2356', 'Sunita Deshpande', '1962-08-03', 'Female', '+91 96xxxxxx77',
   'Rural PHC Baramati', 'Baramati',
   ARRAY['Hypertension'],
   '[{"label":"Ibuprofen","drugClass":"nsaid","recorded":"14 Feb 2025","severity":"moderate"}]'::jsonb,
   '2024-09-05'),

  ('PT-2402', 'Imran Shaikh', '1995-02-21', 'Male', NULL,
   'PHC Wagholi', 'Wagholi',
   ARRAY[]::text[], '[]'::jsonb, '2025-03-11'),

  ('PT-2447', 'Meera Joshi', '1988-07-16', 'Female', '+91 99xxxxxx08',
   'District Hospital Pune', 'Pune City',
   ARRAY['Asthma'], '[]'::jsonb, '2025-10-02');

-- ---------------------------------------------------------------------------
-- Visits
--
-- Note the 21 May 2026 row: a penicillin-class antibiotic prescribed at a
-- facility that could not see the allergy recorded at PHC Wagholi in 2023.
-- That is the gap this project exists to close, and the allergy check in
-- clinical.ts detects it from exactly this data.
-- ---------------------------------------------------------------------------

INSERT INTO visits (id, patient_id, visit_date, display_date, facility, diagnosis, notes, prescriptions, vitals, admission, chief_complaint, symptom_tags, entry_method) VALUES

  ('v-2026-08-12', 'PT-2291', '2026-08-12', '12 Aug 2026', 'PHC Wagholi',
   'Routine diabetes follow-up',
   'HbA1c stable at 6.8. Continue current dose, review in six months.',
   '[{"drug":"Metformin","strength":"500mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":1},"food":"After food","durationDays":null,"quantity":30,"drugClass":"biguanide"},
     {"drug":"Amlodipine","strength":"5mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":0},"food":"Any time","durationDays":null,"quantity":30,"drugClass":"calcium-channel-blocker"}]'::jsonb,
   '{"systolic":138,"diastolic":86,"hba1c":6.8,"weightKg":64,"heartRate":78}'::jsonb,
   FALSE, NULL, NULL, NULL),

  ('v-2026-05-21', 'PT-2291', '2026-05-21', '21 May 2026', 'Sub-Center Hadapsar',
   'Throat infection',
   'Seen at a facility with no access to her records. Penicillin-class antibiotic prescribed without sight of the allergy noted at PHC Wagholi in 2023.',
   '[{"drug":"Amoxicillin","strength":"500mg","form":"Capsule","route":"Oral","frequency":{"morning":1,"afternoon":1,"night":1},"food":"After food","durationDays":5,"quantity":15,"drugClass":"penicillin"}]'::jsonb,
   '{"systolic":142,"diastolic":88,"weightKg":64.5,"heartRate":82}'::jsonb,
   FALSE, NULL, NULL, NULL),

  ('v-2026-03-03', 'PT-2291', '2026-03-03', '03 Mar 2026', 'District Hospital Pune',
   'Hypertensive episode, ER admission',
   'Presented with BP 178/104. Stabilised overnight, discharged next morning.',
   '[{"drug":"Amlodipine","strength":"5mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":0},"food":"Any time","durationDays":null,"quantity":30,"drugClass":"calcium-channel-blocker"}]'::jsonb,
   '{"systolic":178,"diastolic":104,"weightKg":65,"heartRate":96}'::jsonb,
   TRUE, NULL, NULL, NULL),

  ('v-2025-11-17', 'PT-2291', '2025-11-17', '17 Nov 2025', 'PHC Wagholi',
   'Hypertensive episode, ER admission',
   'Second hypertensive episode. Started on amlodipine.',
   '[{"drug":"Amlodipine","strength":"5mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":0},"food":"Any time","durationDays":null,"quantity":30,"drugClass":"calcium-channel-blocker"}]'::jsonb,
   '{"systolic":172,"diastolic":101,"weightKg":66,"heartRate":94}'::jsonb,
   TRUE, NULL, NULL, NULL),

  ('v-2023-06-02', 'PT-2291', '2023-06-02', '02 Jun 2023', 'PHC Wagholi',
   'Diabetes diagnosis, initial workup',
   'Fasting glucose 156. Type 2 diabetes confirmed. Penicillin allergy recorded.',
   '[{"drug":"Metformin","strength":"500mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":1},"food":"After food","durationDays":null,"quantity":30,"drugClass":"biguanide"}]'::jsonb,
   '{"systolic":150,"diastolic":92,"hba1c":7.9,"weightKg":68,"heartRate":88}'::jsonb,
   FALSE, NULL, NULL, NULL),

  ('v-2026-07-04', 'PT-2314', '2026-07-04', '04 Jul 2026', 'Sub-Center Hadapsar',
   'Acute gastroenteritis',
   'Mild dehydration. ORS advised, follow up if symptoms persist beyond 3 days.',
   '[{"drug":"ORS","strength":"1 sachet in 1 L","form":"Sachet","route":"Oral","frequency":{"morning":0,"afternoon":0,"night":0,"asNeeded":true},"food":"Any time","durationDays":3,"quantity":3,"drugClass":"other"}]'::jsonb,
   '{"weightKg":22,"heartRate":104}'::jsonb,
   FALSE, 'Diarrhea', ARRAY['1-2 days','Vomiting'], 'quick'),

  ('v-2026-02-09', 'PT-2314', '2026-02-09', '09 Feb 2026', 'Sub-Center Hadapsar',
   'Upper respiratory infection', 'Viral. Symptomatic care only.',
   '[{"drug":"Paracetamol","strength":"125mg/5ml syrup","form":"Syrup","route":"Oral","frequency":{"morning":1,"afternoon":1,"night":1},"food":"After food","durationDays":3,"quantity":1,"drugClass":"other"}]'::jsonb,
   '{"weightKg":21,"heartRate":98}'::jsonb,
   FALSE, 'Cough / cold', ARRAY['3-5 days'], 'quick'),

  ('v-2026-06-19', 'PT-2356', '2026-06-19', '19 Jun 2026', 'Rural PHC Baramati',
   'Routine hypertension follow-up', 'BP well controlled on current dose.',
   '[{"drug":"Amlodipine","strength":"5mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":0,"night":0},"food":"Any time","durationDays":null,"quantity":30,"drugClass":"calcium-channel-blocker"}]'::jsonb,
   '{"systolic":134,"diastolic":84,"weightKg":58,"heartRate":74}'::jsonb,
   FALSE, NULL, NULL, NULL),

  ('v-2025-02-14', 'PT-2356', '2025-02-14', '14 Feb 2025', 'Rural PHC Baramati',
   'Joint pain', 'Reaction to ibuprofen noted and recorded as an allergy.',
   '[{"drug":"Paracetamol","strength":"500mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":1,"night":1},"food":"After food","durationDays":3,"quantity":9,"drugClass":"other"}]'::jsonb,
   '{"systolic":146,"diastolic":90,"weightKg":59,"heartRate":80}'::jsonb,
   FALSE, 'Body ache', ARRAY['5+ days'], 'detailed'),

  ('v-2026-04-27', 'PT-2402', '2026-04-27', '27 Apr 2026', 'PHC Wagholi',
   'Laceration, left forearm', 'Cleaned and dressed. Tetanus status confirmed current.',
   '[{"drug":"Paracetamol","strength":"500mg","form":"Tablet","route":"Oral","frequency":{"morning":1,"afternoon":1,"night":1},"food":"After food","durationDays":3,"quantity":9,"drugClass":"other"}]'::jsonb,
   '{"systolic":124,"diastolic":78,"weightKg":71,"heartRate":76}'::jsonb,
   FALSE, 'Injury / wound', ARRAY['Bleeding stopped'], 'quick'),

  ('v-2026-08-02', 'PT-2447', '2026-08-02', '02 Aug 2026', 'District Hospital Pune',
   'Asthma review', 'Inhaler technique reviewed. No night symptoms reported.',
   '[{"drug":"Salbutamol inhaler","strength":"100mcg/puff","form":"Inhaler","route":"Inhaled","frequency":{"morning":0,"afternoon":0,"night":0,"asNeeded":true},"food":"Any time","durationDays":null,"quantity":1,"drugClass":"other"}]'::jsonb,
   '{"systolic":118,"diastolic":74,"weightKg":62,"heartRate":72}'::jsonb,
   FALSE, NULL, NULL, NULL);

COMMIT;

-- ---------------------------------------------------------------------------
-- A note on the aggregate views after seeding
--
-- With only 11 visits, every (district, diagnosis, week) group is smaller than
-- the k=5 threshold, so `district_aggregates` returns ZERO rows. That is the
-- suppression working, not a bug — and it is worth demonstrating deliberately.
--
-- To show the admin dashboard with data, load db/bulk.sql as well, which adds
-- enough synthetic volume for some groups to clear the threshold while others
-- stay suppressed.
-- ---------------------------------------------------------------------------
