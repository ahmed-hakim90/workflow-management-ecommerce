# Supabase Migration Notes

This branch starts a clean Supabase migration for the OMS platform. It does not migrate old Firestore data.

## Implemented
- Added `@supabase/supabase-js` and `@supabase/ssr`.
- Added Supabase env validation for `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- Added shared Supabase clients/helpers:
  - `lib/db/supabase-server.ts`
  - `lib/supabase/client.ts`
  - `lib/supabase/session.ts`
- Added the initial clean Postgres schema and RLS migration at `supabase/migrations/20260511132000_initial_clean_schema.sql`.
- Replaced Firebase Auth usage in staff auth context, login, registration, onboarding, and admin user creation with Supabase Auth.
- Replaced the legacy Firebase auth uid field in the app user model with `supabaseUserId`.
- Migrated core order/user/tenant/settings/rollup paths to Supabase-backed implementations.
- Replaced client-side Firestore listeners for orders/new-order notifications with API polling as the simplest stable realtime replacement.

## Important Follow-Up
- Do not remove Firebase files or dependencies until import search returns zero Firebase usage.
- Remaining Firebase-backed service groups still need full Supabase rewrites before cleanup:
  - shipments
  - tickets
  - analytics
  - outbound webhooks
  - platform packages
  - chat/inbox services
  - WhatsApp automation/logging services
  - worker routes/scripts that still import `getDb`
- RLS policies rely on `profiles.user_id = auth.users.id` and tenant membership through `profiles.tenant_id`.
- The first production setup still needs a seed path for platform admin and initial tenant bootstrap.

## Validation
- `npm run build` passes after the implemented migration slice.
- `npm test` passes.
- Build still reports pre-existing React hook dependency warnings in `app/(app)/orders/page.tsx`.
- Firebase import search returns no matches outside removed files; Firebase dependencies and config files were removed.
- Manual Supabase login/order/inbox flow still requires live Supabase project credentials and seeded tenant/profile data.
