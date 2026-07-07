-- Migration 0001 — add employees.employee_code
--
-- Stores the UKG-generated Employee ID, surfaced as "Employee ID" in the app's
-- Add/Edit employee form. New (schema.sql) installs already include this column;
-- existing databases need this one-time ALTER.
--
-- Run ONCE against your live D1 database, either:
--   • Cloudflare dashboard → Workers & Pages → D1 → ebg-onboarding → Console →
--     paste the statement below → Run; or
--   • wrangler d1 execute ebg-onboarding --remote \
--       --command "ALTER TABLE employees ADD COLUMN employee_code TEXT;"
--
-- Re-running is harmless (it errors with "duplicate column name" and changes
-- nothing). Until this runs, the app still works — the Employee ID field simply
-- won't save yet.

ALTER TABLE employees ADD COLUMN employee_code TEXT;
