# Ainayya Studio Log — starter project

This is a small personal content-planner timesheet starter.

## Stack
- Vite is not required for this starter; it is a static HTML/CSS/JS app.
- Supabase Auth + PostgreSQL for login and cloud storage.
- Cloudflare Pages for free static hosting.
- GitHub for source control and deployment.

## Setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase.sql`.
3. In Supabase Project Settings > API, copy the Project URL and anon/publishable key.
4. Open `app.js` and replace `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
5. Push all files to a GitHub repository.
6. In Cloudflare Pages, import that repository. Build command: leave blank. Build output directory: `/` (or `.` if the UI requests it).
7. Open the deployed `*.pages.dev` URL.

## Important
- Never put the Supabase `service_role` key in frontend code. Only use the anon/publishable key.
- Row Level Security is enabled. Each authenticated user can access only their own work entries.
- `catalog.js` is a starter snapshot, not a live feed from Ainayya. Verify it and edit the arrays as the website catalogue changes.
- This starter's edit action uses browser prompts for simplicity. A later iteration can replace it with a polished edit modal.
- The catalog data is intentionally separate from work-entry data.
