# EBG Onboarding Tracker — Cloud backend (Cloudflare Worker + D1)

This folder is the small server that fixes shared, live data across all
computers. It holds the database connection so the desktop app never ships a
database password. The app keeps its own login screen.

- `schema.sql` — the database tables (run once against D1).
- `src/index.js` — the Worker API (login, data queries, password endpoints).
- `wrangler.toml` — config; paste your D1 database ID into it.

## What you'll do (one-time setup, ~15–20 min, I'll guide each step)

1. **Create a free Cloudflare account** at https://dash.cloudflare.com/sign-up
2. **Create the database (D1):** Workers & Pages → D1 → *Create database* →
   name it `ebg-onboarding`. Copy the **Database ID** it shows you and paste it
   into `wrangler.toml` (replacing `PASTE_YOUR_D1_DATABASE_ID_HERE`).
3. **Create the tables:** open the new database → *Console* → paste the contents
   of `schema.sql` → Run.
4. **Set a server secret:** the Worker needs a `SESSION_SECRET` (any long random
   string) to sign login tokens. We'll set this in the Worker's settings.
5. **Deploy the Worker** (two options — pick what you're comfortable with):
   - **Dashboard:** Workers & Pages → Create → connect this GitHub repo →
     set the root directory to `cloud/` → deploy, then bind the D1 database
     (binding name `DB`) and add the `SESSION_SECRET` variable.
   - **Command line (if you have a terminal):**
     ```
     npm i -g wrangler
     wrangler login
     wrangler d1 execute ebg-onboarding --file=cloud/schema.sql --remote
     wrangler secret put SESSION_SECRET    # paste a long random string
     wrangler deploy --config cloud/wrangler.toml
     ```
6. You'll get a URL like `https://ebg-onboarding-api.<account>.workers.dev`.
   Send me that URL — the desktop app gets pointed at it.

## Migrating your existing data
Your current data lives in the shared `.db` file. Keep the backup from the app
(**Settings → Download backup**). I'll convert it into a `data.sql` you load
into D1 the same way as the schema, so nothing is lost.

## Notes / future hardening
This uses a pragmatic "trusted-staff" model: any signed-in user can run normal
reads/writes through the API (password hashes are always protected). If you
later want stricter limits (e.g. only admins can change roles), that's a small
follow-up — say the word.
