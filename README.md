# Support Chat

Source starter for a customer support chat using Supabase Edge Functions and a static web frontend. This is not a deployed service or finished APK. Translation is not implemented yet.

## Setup
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Create an admin user in Supabase Authentication > Users. Copy its UUID and run:
```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where id = 'USER-UUID-HERE';
```
3. Add Edge Function secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must stay server-side and must never go into GitHub or the app.
4. Deploy `supabase/functions/dynamic-endpoint/index.ts` as `dynamic-endpoint`.
5. Edit `public/config.js` with your project URL and publishable key. These are public values.
6. Deploy the `public` folder to a static host. Open `/admin.html` for the inbox.
7. Build the Android APK from GitHub Actions: open Actions, select “Build Android APK”, run workflow, then download the `TulosteKauppa-Yllapito-APK` artifact from the completed run. Install the downloaded APK on your Android phone. The app opens the live admin inbox at `https://support-chat-d1ev.onrender.com/admin.html`.

Test with dummy conversations before using with customers. RLS stays enabled; all database access is through the Edge Function.
