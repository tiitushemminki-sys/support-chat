KÄYTTÖÖNOTTO
1. Suorita supabase/schema.sql Supabasen SQL Editorissa.
2. Luo Auth > Users -kohdassa ylläpitäjän käyttäjä. Kopioi UUID ja suorita SQL:
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where id = 'KÄYTTÄJÄN-UUID';
3. Lisää Edge Function Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
4. Julkaise Edge Function nimellä dynamic-endpoint.
5. Muokkaa config.js:ään projektin URL ja publishable key.
6. Julkaise public-kansio staattisena sivustona.
7. Avaa /admin.html ja kirjaudu sisään.
ÄLÄ koskaan laita service_role-avainta GitHubiin tai selaimen koodiin.
Automaattista käännöstä ei ole vielä toteutettu.
