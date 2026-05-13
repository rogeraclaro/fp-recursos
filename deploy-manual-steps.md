# Passos de desplegament manual — FP Recursos

**Domini:** `fp-recursos.masellas.info`  
**Directori al VPS:** `/home/masellas-fp-recursos/htdocs/fp-recursos.masellas.info`  
**Stack:** React + Vite (SPA estàtica) + Supabase (cloud)

---

## FASE 1 — Preparació local (ordinador)

**1.** Assegura't que el fitxer `.env.local` té les credencials reals de Supabase (no els placeholders):

```
VITE_SUPABASE_URL=https://<el-teu-projecte>.supabase.co
VITE_SUPABASE_ANON_KEY=<la-teva-anon-key>
```

**2.** Construeix l'aplicació:

```bash
cd "/Users/rogermasellas/AI/FP Recursos/fp-recursos"
npm run build
```

Resultat: es crea la carpeta `dist/` amb tots els fitxers estàtics.

**3.** Verifica que `dist/index.html` existeix i que la carpeta `dist/assets/` conté fitxers `.js` i `.css`.

---

## FASE 2 — Pujar fitxers al VPS per FTP

**4.** Connecta al VPS per FTP (amb FileZilla o similar):

- Host: `masellas.info`
- Credencials: les del teu usuari FTP

**5.** Al VPS, navega fins a `/home/masellas-fp-recursos/htdocs/fp-recursos.masellas.info/`. Aquesta carpeta ja hauria d'existir (creada pel panell de control).

**6.** Buida el contingut actual de la carpeta si n'hi ha (fitxers per defecte del hosting).

**7.** Puja **tot el contingut** de la carpeta `dist/` local a `/home/masellas-fp-recursos/htdocs/fp-recursos.masellas.info/` al VPS.

> Important: puja el _contingut_ de `dist/`, no la carpeta en si. A la carpeta destí ha d'haver-hi directament `index.html`, `assets/`, etc.

**8.** Verifica al FTP que `index.html` és a l'arrel de la carpeta destí.

---

## FASE 3 — Configurar Nginx al VPS (terminal)

**9.** Connecta al VPS per SSH:

```bash
ssh user@masellas.info
```

**10.** Crea el fitxer de configuració del virtual host:

```bash
sudo nano /etc/nginx/sites-available/fp-recursos
```

**11.** Enganxa aquest contingut (versió HTTP primer, sense SSL — el SSL s'afegeix al pas 15):

```nginx
server {
    listen 80;
    server_name fp-recursos.masellas.info;

    root /home/masellas-fp-recursos/htdocs/fp-recursos.masellas.info;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Desa amb `Ctrl+O`, surt amb `Ctrl+X`.

**12.** Activa el virtual host:

```bash
sudo ln -s /etc/nginx/sites-available/fp-recursos /etc/nginx/sites-enabled/
```

**13.** Verifica que la configuració és correcta:

```bash
sudo nginx -t
```

Ha de dir `syntax is ok` i `test is successful`.

**14.** Recarrega Nginx:

```bash
sudo systemctl reload nginx
```

---

## FASE 4 — Certificat SSL (Let's Encrypt)

**15.** Comprova que el subdomini `fp-recursos.masellas.info` apunta al VPS (DNS). Si acabes de crear-lo, espera uns minuts fins que propagui.

**16.** Obté i instal·la el certificat SSL:

```bash
sudo certbot --nginx -d fp-recursos.masellas.info
```

Certbot modificarà automàticament el fitxer Nginx per afegir SSL i el redirect HTTP→HTTPS.

**17.** Verifica que el fitxer Nginx resultant té dos blocs `server` (un per HTTP redirect i un per HTTPS).

**18.** Torna a verificar i recarregar Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## FASE 5 — Verificació final

**19.** Obre `https://fp-recursos.masellas.info` al navegador. Ha de mostrar la pàgina pública amb els recursos.

**20.** Comprova que el cadenat SSL és verd (HTTPS actiu).

**21.** Prova la navegació: filtra per categoria, fes una cerca, comprova que recarregar la pàgina no dona error 404 (el `try_files` ho hauria de solucionar).

**22.** Fes login amb un usuari editor i comprova que pots afegir un recurs.

---

## FASE 6 — Desplegar Edge Functions a Supabase (terminal local)

Les Edge Functions no van al VPS — es despleguen directament a Supabase des del teu ordinador.

**23.** Instal·la la Supabase CLI si no la tens:

```bash
npm install -g supabase
```

**24.** Inicia sessió a Supabase:

```bash
supabase login
```

S'obrirà el navegador per autenticar-te.

**25.** Vincula el projecte local amb el teu projecte Supabase (l'ID el trobes a Settings → General del dashboard):

```bash
cd "/Users/rogermasellas/AI/FP Recursos/fp-recursos"
supabase link --project-ref <project-id>
```

**26.** Configura el secret de la service_role key (Settings → API → service_role al dashboard Supabase):

```bash
supabase secrets set SERVICE_ROLE_KEY=<service-role-key>
```

**27.** Configura el secret de l'API de Gemini:

```bash
supabase secrets set GEMINI_API_KEY=<gemini-api-key>
```

**28.** Desplega les dues Edge Functions:

```bash
supabase functions deploy suggest-resource
supabase functions deploy create-editor
```

**29.** Verifica que les funcions apareixen a Supabase Dashboard → Edge Functions.

---

## FASE 7 — Desplegaments futurs (quan hi hagi canvis)

**30.** Per canvis a la web app: repeteix els passos **1–8** (build + FTP).

> No cal tocar Nginx ni SSL per als desplegaments posteriors.

**31.** Per canvis a les Edge Functions: repeteix els passos del 28 només per la funció modificada.npm run

---

## Notes importants

- Les credencials Supabase estan **embebudes al build** (fitxers JS). Si mai canvies la URL o la clau, hauràs de fer un nou build i tornar a pujar.
- La `service_role` key **mai** ha d'anar al `.env.local` ni al codi del frontend — només als secrets de Supabase CLI.
- L'extensió Chrome es desplega de manera independent (càrrega manual a `chrome://extensions` o Chrome Web Store).
