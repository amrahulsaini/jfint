# Migrating jfint from the GCP VM to Vercel

The app currently runs under PM2 on the GCP VM `x`
(project `gen-lang-client-0910402848`, zone `us-central1-b`, `34.133.49.19`) at
`/home/jecrcfoundation.live/public_html/jfint`, behind CyberPanel on port 3021.

Target: **Vercel** for the app, **TiDB Cloud Serverless** for MySQL, **Cloudflare R2**
for the 450 MB of photos and form PDFs, on a `*.vercel.app` domain for now.

The code changes are already merged. What remains is creating the three accounts and
pasting their credentials into Vercel.

---

## 1. Database — TiDB Cloud Serverless

A TiDB-compatible dump is ready: `jecr_2ndyear.tidb.sql` (17 MB, 2.2 MB gzipped),
produced on the VM at `/root/jfint-migrate/`. It is the MariaDB dump with three
things normalised so TiDB accepts it: `current_timestamp()` → `CURRENT_TIMESTAMP`
(16x), `utf8mb3` → `utf8mb4` (9 tables), and the MariaDB-only `/*M!...*/` sandbox
directive removed. All 17 tables are InnoDB with no fulltext/spatial indexes, so
nothing else needed changing.

```bash
# On TiDB Cloud: create a Serverless cluster, then create database jecr_2ndyear.
gunzip -c jecr_2ndyear.tidb.sql.gz | mysql \
  --host gateway01.<region>.prod.aws.tidbcloud.com --port 4000 \
  --user '<user>' --password '<pass>' \
  --ssl-mode=VERIFY_IDENTITY jecr_2ndyear
```

`lib/db.ts` already supports TLS via `DB_SSL=true`, so no code change is needed —
only the `DB_*` env vars.

Keep `DB_POOL_LIMIT` small (3). Each serverless instance opens its own pool, and
TiDB Serverless caps concurrent connections.

## 2. Assets — Cloudflare R2

`public/1styearphotos` (103 MB), `public/student_photos` (110 MB) and
`public/forms-1styear` (238 MB) are no longer tracked in git — 8,749 files were
removed from the index. They are served from R2 instead.

```bash
# On the VM, where the files still live:
export R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=jfint-assets
./scripts/sync-assets-to-r2.sh
```

Then set `NEXT_PUBLIC_ASSET_BASE_URL` to the bucket's public URL. `lib/assets.ts`
prefixes every photo path with it; unset, paths stay relative so local dev and the
VM keep working.

**The bucket needs CORS.** `StudentRecords.tsx` and `portal/bulk/page.tsx` fetch
photos into canvas to build PDFs, which is a cross-origin read. Allow the Vercel
origin with `GET`/`HEAD` in the bucket's CORS policy or PDF export will fail while
plain `<img>` display still works.

## 3. Environment variables

Copy every key from `.env.example` into Vercel's Project Settings. The live values
are in `.env.local` on the VM. `NEXT_PUBLIC_*` vars are inlined at build time, so
changing them requires a redeploy, not just a restart.

---

## Known limitations on Vercel

These are pre-existing behaviours that do not survive the move to serverless. None
of them affect the student-facing portal, chat, or payments.

- **`/api/pdf-extract` cannot run on Vercel.** It shells out to
  `scripts/extract_student_photos.py` via `execFile`. Vercel's Node runtime has no
  Python and no PyMuPDF. The `/data-insertion` admission-card extractor is
  therefore VM-only. Keep the VM for that workflow, or port the extractor to
  `pdfjs-dist` (already a dependency) to run it in Node.
- **`/api/extractions/ingest-all` reads PDFs off disk** from `public/forms-1styear`,
  which no longer ships with the deployment. Also VM-only. The already-extracted
  JSON in `data/extractions/` is committed and small, so `/api/extractions` (the
  read path) works fine on Vercel.
- **The cache is per-instance without Redis.** `lib/cache.ts` falls back to an
  in-process `Map`, which on serverless means most requests miss. Correct, just
  slower. Set `REDIS_URL` (Upstash) if the RTU scraping endpoints feel slow.
- **Sessions are 30 minutes and DB-backed**, so they survive across instances. No
  change needed.

## OTP is currently disabled

`OTP_DISABLED="true"` makes a `@jecrc.ac.in` address alone start a session — no code
is generated or emailed. This exists because the `jecrc@jecrcfoundation.live`
mailbox stopped working when the domain lapsed.

This is a real reduction in access control on a portal holding student PII, and it
is meant to be temporary. Restore it by removing the env var once SMTP works
(renewing the domain, or pointing `SMTP_*` at a mailbox on a domain you still own).
The OTP code path is untouched underneath.
