-- Versiona la protecció que ja existeix en producció: sense això, un
-- `supabase db reset` recrearia una BD on qualsevol usuari autenticat es
-- podria auto-promocionar a admin via `UPDATE profiles SET role='admin', active=true`.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.active IS NOT DISTINCT FROM OLD.active THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'No autoritzat a modificar role/active del perfil'
    USING ERRCODE = 'insufficient_privilege';
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

-- Elimina la policy duplicada i més laxa (sense comprovació `active`);
-- manté només la versió que ja exigeix `active` com les altres policies
-- d'aquest projecte (veure 005_enforce_active_on_writes.sql).
DROP POLICY IF EXISTS "Admin pot actualitzar perfils" ON public.profiles;

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active)
  );
