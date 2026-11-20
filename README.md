# Ainayya Studio Log — updated project

A personal Content Planner timesheet with four activity types and a two-source catalog:

- **Content Posting** — collection/series required; product optional.
- **Meeting** — agenda/type and participants; no collection required.
- **On-site Photoshoot / Videography** — optional collection, including upcoming collections not yet on the website; shoot type, location and deliverables.
- **Other Tasks** — general work tracking.

## Architecture

- Static frontend: HTML, CSS and JavaScript on Cloudflare Pages.
- Authentication and database: Supabase Auth + PostgreSQL.
- Catalog: Supabase `catalog_collections` and `catalog_products` tables.
- Online catalog sync: a Cloudflare Worker reads public Ainayya category pages and product links once per day. Manual upcoming collections/products live in the same catalog tables.

The worker discovers collection-like category pages linked from `https://www.ainayya.id/categories`, then indexes product links from those pages. Ainayya can change its website markup at any time; check the sync log after deployment and adjust the parser if the website changes. This is a best-effort public-page reader, not an official Ainayya API.

## 1. Update Supabase database

1. Open Supabase Dashboard → SQL Editor → New query.
2. Paste the complete contents of `supabase.sql`.
3. Run it. It is designed as an additive migration and preserves existing work entries.
4. Confirm that `catalog_collections`, `catalog_products`, and `catalog_sync_runs` appear under Table Editor.

The frontend uses the existing Project URL and publishable key in `app.js`. The publishable key is suitable for browser use. **Never place the Supabase `service_role` key in `app.js`, GitHub, or any public frontend file.**

## 2. Deploy the frontend

1. Upload/commit `index.html`, `styles.css`, `app.js`, and `supabase.sql` to the root of your GitHub repository (keep the existing Supabase URL and publishable key in `app.js`).
2. Cloudflare Pages will deploy from GitHub automatically.
3. Wait for the latest deployment to show **Success**, then reload the site.

## 3. Deploy the catalog-sync Worker

Create a separate Cloudflare Worker named `ainayya-catalog-sync`.

### Dashboard method

1. Cloudflare Dashboard → Workers & Pages → Create → Worker.
2. Name it `ainayya-catalog-sync` and create/deploy it.
3. Open **Edit code** and replace the starter code with the full contents of `worker/index.js`.
4. Save and deploy.
5. Open Worker Settings → Variables and Secrets. Add:
   - `SUPABASE_URL` (Text): your Supabase Project URL, e.g. `https://PROJECT.supabase.co`.
   - `SUPABASE_SERVICE_ROLE_KEY` (Secret): copy from Supabase Project Settings → API Keys / service_role (secret). Do not share or expose it.
   - `SYNC_SECRET` (Secret): create a long random value for manual sync requests.
6. Open Worker Settings → Triggers → Cron Triggers. Add `0 2 * * *` (daily at 02:00 UTC / 09:00 WIB).
7. Save/deploy the Worker again after adding the settings.

The `worker/wrangler.toml` file contains the same daily cron if you deploy using Wrangler CLI instead.

### Test the Worker

Open `https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/health`. It should return `{"ok":true,...}`.

To run a one-time sync manually from a terminal, use:

```bash
curl -X POST "https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/sync" \
  -H "x-sync-secret: YOUR_SYNC_SECRET"
```

Do not put `SYNC_SECRET` in the frontend. The scheduled daily sync does not need a browser call.

After the first sync, sign in to Studio Log and check the catalog status at the bottom of the app. In Supabase Table Editor, inspect `catalog_sync_runs` for success/error details and item counts.

## 4. How catalog matching works

- Website-discovered collections are marked `Published` and `source = website`.
- Manually created collections/products are marked `Upcoming` / `source = manual`.
- If a manually created collection has the same normalized name as a website collection, the Worker promotes that existing record to `Published` rather than creating a second collection.
- Historical work entries keep text snapshots of collection/product names, so the log remains readable even if a catalog record is later archived.
- For collection names that differ significantly between the internal working name and the website name, manually reconcile the names once in Supabase before the next sync.

## 5. Security and costs

- Supabase Row Level Security protects work entries per signed-in user.
- Authenticated users can read the shared catalog; manual catalog inserts are authenticated and recorded with `created_by`.
- The Worker service-role key is stored only as a Cloudflare Worker Secret.
- Cloudflare Workers and Supabase free tiers have quotas. A daily run that checks up to 45 category pages is intended to be light, but monitor Cloudflare usage. If Ainayya's category list grows substantially, reduce `MAX_CATEGORY_PAGES` or use an official product feed/API if the site owner can provide one.

## Existing account / signup note

If Create Account still returns `Invalid path specified in request url`, verify that the Project URL in `app.js` is the exact Supabase Project URL (not a REST/Auth endpoint), and that the publishable/anon key belongs to the same project. In Supabase Authentication settings, enable Email signups and configure the Site URL and Redirect URLs to include the Cloudflare Pages domain.
