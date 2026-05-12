-- Categories inicials
-- Executar després de crear l'esquema al dashboard Supabase
insert into public.categories (name) values
  ('Eines IA'),
  ('Normativa i legislació'),
  ('Recursos didàctics'),
  ('Articles i novetats')
on conflict (name) do nothing;

-- Nota: l'usuari admin s'ha de crear via Supabase Auth dashboard
-- Després actualitzar el seu role:
-- update public.profiles set role = 'admin' where id = '<uuid-admin>';
