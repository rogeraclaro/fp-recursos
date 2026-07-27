# Backups de la base de dades i restauració

## Com funciona el backup automàtic

Workflow: `.github/workflows/backup-db.yml` (repo `fp-recursos`).

- **Freqüència**: diari, a les 03:15 UTC (cron), i també es pot llançar manualment.
- **Què fa**: `pg_dump` de la base de dades de Supabase → comprimit (`.sql.gz`) → es puja al repo privat separat `fp-recursos-backups`, a `backups/YYYY-MM-DD.sql.gz`.
- **Retenció**: es guarden els últims 30 backups; els més antics s'esborren automàticament a cada execució.
- **Per què un repo separat**: perquè el backup visqui fora del VPS de producció — si el VPS o Supabase falla, el backup no en depèn.

### Secrets necessaris (configurats a `fp-recursos` → Settings → Secrets and variables → Actions)

- `SUPABASE_DB_URL` — connection string de Postgres (Supabase Dashboard → botó "Connect" → pestanya "Direct"), amb la contrasenya inclosa.
- `BACKUP_REPO_TOKEN` — Personal Access Token (fine-grained) amb permís d'escriptura només sobre el repo `fp-recursos-backups`.

### Llançar un backup manualment

GitHub → repo `fp-recursos` → pestanya **Actions** → **"Backup Supabase database"** → botó **"Run workflow"**.

## Com restaurar un backup

1. Descarrega el fitxer `.sql.gz` que vulguis del repo `fp-recursos-backups` (carpeta `backups/`).
2. Restaura'l contra la base de dades amb:

```bash
gunzip -c backups/YYYY-MM-DD.sql.gz | psql "<connection string de Supabase>"
```

La `<connection string>` és la mateixa que `SUPABASE_DB_URL` (Supabase Dashboard → "Connect" → pestanya "Direct").

⚠️ **Precaució**: aquesta comanda executa el dump directament contra la base de dades de destí — si la base de dades ja té dades, poden xocar amb el contingut restaurat (duplicats, errors de clau primària, etc.). Per a una restauració neta:

- **Opció segura (recomanada)**: restaura contra un projecte Supabase nou/buit per verificar que el dump és correcte abans de tocar producció.
- **Restauració real a producció**: només si estàs segur que cal sobreescriure — considera buidar les taules afectades abans, o parlar-ho amb calma perquè és una operació difícil de desfer.
