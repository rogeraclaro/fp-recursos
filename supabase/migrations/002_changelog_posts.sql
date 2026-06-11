-- Taula de posts del changelog
CREATE TABLE IF NOT EXISTS public.changelog_posts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  author_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Actualitza updated_at automàticament
CREATE OR REPLACE FUNCTION public.update_changelog_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_changelog_updated_at
  BEFORE UPDATE ON public.changelog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_changelog_updated_at();

-- RLS
ALTER TABLE public.changelog_posts ENABLE ROW LEVEL SECURITY;

-- Lectura pública: només posts publicats
CREATE POLICY "changelog_read_published"
  ON public.changelog_posts FOR SELECT
  USING (status = 'published');

-- Admin llegeix tot
CREATE POLICY "changelog_admin_read_all"
  ON public.changelog_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admin pot crear
CREATE POLICY "changelog_admin_insert"
  ON public.changelog_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admin pot actualitzar
CREATE POLICY "changelog_admin_update"
  ON public.changelog_posts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Admin pot eliminar
CREATE POLICY "changelog_admin_delete"
  ON public.changelog_posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
