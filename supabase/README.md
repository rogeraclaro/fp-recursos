# Supabase Setup

## Passos per configurar el projecte

1. Crear projecte a https://supabase.com
2. Copiar URL i anon key a `.env.local`
3. Al SQL Editor del dashboard, executar `migrations/001_initial_schema.sql`
4. Executar `seed.sql` per afegir les categories inicials
5. Crear usuari admin: Authentication → Users → Invite user
6. Actualitzar role admin: `update public.profiles set role = 'admin' where id = '<uuid>';`
