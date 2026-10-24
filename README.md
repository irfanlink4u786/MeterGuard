# CP AuditTrack — assigned-sites field app

Supabase project: `jwgtnlfyaoxtadgtuxpi`.

## Implemented in this source package

- Shared username `Meter` (password is NOT embedded in frontend code).
- Mandatory full name and Pakistan mobile number (03XXXXXXXXX) after sign-in. Saved with each reading.
- Site ID search limited in the frontend to `monitoring_assigned = true` (324 assigned sites).
- Previous reading and submitter displayed, plus cumulative peak/off-peak delta, elapsed days and daily average.
- Photo required for submission; evidence in private Supabase storage.
- Reading history includes submitter name, mobile and photo link.
- No edit/delete actions in frontend; database trigger blocks updates/deletes.
- Monthly criteria, grid, priority and pay mode displayed.

## IMPORTANT — activation still required

1. Create one shared Supabase Authentication user via Authentication > Users > Add user. Supabase Auth needs an email; create `meter@cp-audittrack.local` with the agreed password **only if the dashboard accepts this address**. A real controlled email is preferable for recovery; if you choose another email, change the internal sign-in email in `src/App.tsx`.
2. Add an active profile for the shared user's UUID in SQL Editor (replace UUID):
   `insert into public.meter_profiles (user_id, full_name, role, active) values ('<AUTH_USER_UUID>', 'Meter Field Team', 'supervisor', true) on conflict(user_id) do update set active=true;`
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. Publishable key is public; NEVER expose service_role or secret keys.
4. Run `npm install && npm run build`; deploy as Vite with `dist` output. Package build **has not been validated** because npm registry access was unavailable in this environment.
5. Test authentication, assigned-site search, first reading, second reading, evidence upload and immutable records with an authorized test user.

## Limitations

- Database migration to add `submitter_name` and `submitter_mobile` succeeded.
- Database has 324 assigned sites and their monthly criteria.
- The field-only assigned-site restriction is currently applied in frontend queries, **not fully enforced in RLS**; verify backend access policies before broad rollout.
- The shared login is not independently attributable; names and mobile numbers are self-reported.
- A meter replacement or rollover requires a separate supervised workflow.
- Monthly criterion divided by 30 is an indicative daily benchmark, not a finding of electricity theft.
- Site monthly billed units are not cumulative meter registers; the first visit establishes a baseline.


## 13 Oct update: Three register photos
Each visit requires manually entered Peak, Off-Peak and Total register values and three separate corresponding photographs. The connected Supabase database has already been migrated. If using another Supabase project, run MIGRATION_3_PHOTOS.sql. Copy updated App.tsx, styles.css, and index.html to the Codespaces project root (the flat Codespaces layout).

## Pakistan Standard Time & approximate equivalent running hours

All visit date/time inputs are explicitly interpreted in `Asia/Karachi` (UTC+05:00), independent of the browser timezone. Saved `reading_at` is UTC ISO in Supabase, displayed in PKT. The actual elapsed hours between consecutive readings normalize consumption: interval kWh / elapsed hours = actual kWh/hour, then multiply by 24 for kWh/day. The monthly site criterion is divided by 30*24 to estimate a reference hourly consumption rate. **Equivalent RH/day** = actual kWh/day / reference kWh/hour. This may exceed 24 if consumption is above the reference; it is a *consumption-equivalent* metric, not measured generator runtime, and must not be presented as proven theft. A first baseline visit or a site without a valid criterion cannot yield RH. The supervisor must separately inspect the wiring and record their observation.

Files are flat for the user's Codespaces layout; replace App.tsx in the root and restart Vite.
