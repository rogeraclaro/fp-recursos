-- Exigeix que el perfil del caller estigui actiu per escriure.
-- Sense això, profiles.active = false no revoca cap permís (era cosmètic).

-- bookmarks: insert
DROP POLICY IF EXISTS "Editors can insert own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can insert own bookmarks"
  ON public.bookmarks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- bookmarks: update (propi)
DROP POLICY IF EXISTS "Editors can update own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can update own bookmarks"
  ON public.bookmarks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- bookmarks: delete (propi)
DROP POLICY IF EXISTS "Editors can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Editors can delete own bookmarks"
  ON public.bookmarks FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
  );

-- categories: gestió (admins). Un admin desactivat tampoc no hauria de gestionar.
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role = 'admin' AND p.active)
  );
