-- Redefineix el trigger per escapar HTML dels valors d'usuari (anti-XSS).
-- El render també sanititza (DOMPurify), però escapar a l'origen evita
-- emmagatzemar markup injectat a changelog_posts.content.
CREATE OR REPLACE FUNCTION public.auto_post_new_bookmark()
RETURNS TRIGGER AS $$
DECLARE
  v_username  TEXT;
  v_desc      TEXT;
  v_title     TEXT;
  v_new_item  TEXT;
  v_today     TIMESTAMPTZ;
  v_post_id   UUID;
  v_post_content TEXT;
BEGIN
  SELECT username INTO v_username FROM public.profiles WHERE id = NEW.user_id;
  v_username := COALESCE(v_username, 'desconegut');

  -- Escapat HTML mínim (&, <, >, ", ')
  v_username := replace(replace(replace(replace(replace(v_username,
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_title := replace(replace(replace(replace(replace(COALESCE(NEW.title,''),
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_desc := COALESCE(NEW.description, '');
  IF char_length(v_desc) > 40 THEN
    v_desc := left(v_desc, 40) || '[...]';
  END IF;
  v_desc := replace(replace(replace(replace(replace(v_desc,
    '&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');

  v_new_item := '<li><p><a href="#" data-bookmark-id="' || NEW.id
    || '" class="underline text-blue-600 hover:text-blue-800">'
    || v_title || '</a>';
  IF v_desc <> '' THEN
    v_new_item := v_new_item || ' — ' || v_desc;
  END IF;
  v_new_item := v_new_item || ' <em>(' || v_username || ')</em></p></li>';

  v_today := date_trunc('day', NOW());

  SELECT id, content
    INTO v_post_id, v_post_content
    FROM public.changelog_posts
   WHERE title = 'Noves entrades'
     AND created_at >= v_today
     AND created_at < v_today + INTERVAL '1 day'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_post_id IS NOT NULL THEN
    UPDATE public.changelog_posts
       SET content = left(v_post_content, char_length(v_post_content) - 5)
                  || v_new_item || '</ul>'
     WHERE id = v_post_id;
  ELSE
    INSERT INTO public.changelog_posts (title, content, status)
    VALUES ('Noves entrades', '<ul>' || v_new_item || '</ul>', 'published');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_post_new_bookmark error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger trg_auto_post_new_bookmark de 003 ja apunta a aquesta funció;
-- CREATE OR REPLACE FUNCTION n'actualitza el cos sense recrear el trigger.
