# Lake House Booking Site

A complete, live booking website **and** an owner/admin portal in one small app.
Guests can reserve 1–3 nights, add their party, upload IDs, read and sign the
rental agreement, and see the price. You manage everything from a private admin
page.

## What guests can do (the public site, `/`)

1. **Pick the number of nights** — 1, 2, or 3 (max 3 nights / 4 days).
2. **See real availability on a calendar** — days that can't fit the chosen stay
   are greyed out. Dates already booked (or blocked by you) disappear
   automatically.
3. **Enter their details** and add up to **7 guests total (including themselves)**,
   each with first name, last name, and age.
4. **Optionally upload a driver's license and/or voter ID** for each guest
   (photos or PDF).
5. **Choose the boating / gas-equipment option** — adds the gas fee.
6. **Read and sign the agreement** right on the page (draw a signature).
7. **Confirm** — they get a booking reference and a button to your **payment link**.

## Pricing

- Base price: **$300 for the whole stay** (1–3 nights).
- **+ $150 gas fee** if the guest selects boating / gas-powered equipment
  (final gas amount can be adjusted; you can change the fee anytime).
- **All prices, the payment link, contact info, and the agreement text are
  editable in the admin → Settings.** Nothing is hard-coded.

## What you can do (the admin portal, `/admin`)

- Log in with your admin password.
- **See every booking** with full details: dates, nights, party list with ages,
  uploaded IDs, the signed agreement + signature, and the total.
- **Reach out** to a guest with one click (email or call links, pre-filled).
- **Delete a booking** (this frees the dates again).
- **Block dates** ("house time-off") for maintenance or personal use — blocked
  dates stop being bookable.
- **Edit settings**: property name, base price, gas fee, max nights/guests,
  payment link, contact email/phone, and the full agreement text.

---

## Run it on your computer (optional, for testing)

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
cp .env.example .env      # then edit .env and set ADMIN_PASSWORD + SESSION_SECRET
npm start
```

Open **http://localhost:3000** for the booking site and
**http://localhost:3000/admin** for the admin portal.

In local mode the data is stored in a file at `./data/booking.db` — no setup
required.

---

## Going Live (free) — step by step

The site needs to be hosted so anyone with the link can use it. The plan below
is **100% free** and keeps your bookings safe permanently:

- **Render** (free) runs the website.
- **Turso** (free) stores your bookings so they survive restarts. (Render's free
  tier wipes its own disk on restart, so the database lives in Turso instead.)

### Step 1 — Create the free database (Turso)

1. Go to **https://turso.tech** and sign up (free).
2. Create a new database (any name, e.g. `lakehouse`).
3. Open the database and copy two things:
   - the **Database URL** (looks like `libsql://lakehouse-yourname.turso.io`)
   - a **Database Token** (create one if needed — it's a long string)

   *(If you prefer the command line, after installing the Turso CLI:
   `turso db create lakehouse`, then `turso db show lakehouse --url` for the URL
   and `turso db tokens create lakehouse` for the token.)*

### Step 2 — Put the code on GitHub

This repository is already on GitHub. Make sure your latest changes are pushed
(they are, if you're reading this from the repo).

### Step 3 — Deploy on Render

1. Go to **https://render.com** and sign up (free) — choose "Sign in with
   GitHub" so it can see this repo.
2. Click **New + → Blueprint**, pick this repository, and confirm. Render reads
   the included `render.yaml` automatically.
3. When prompted, fill in the environment values:
   - **ADMIN_PASSWORD** → choose a strong password (this is how you log into
     `/admin`).
   - **DATABASE_URL** → the Turso Database URL from Step 1.
   - **DATABASE_AUTH_TOKEN** → the Turso token from Step 1.
   - **SESSION_SECRET** → leave it; Render fills it with a random value.
4. Click **Apply / Create**. Render installs and starts the site (first build
   takes a couple of minutes).
5. When it's live, Render gives you a public URL like
   `https://lakehouse-booking.onrender.com`. **That's your link to share.**
   The admin portal is that same URL with `/admin` on the end.

> *(No `render.yaml`? You can instead choose **New + → Web Service**, pick the
> repo, set Build Command `npm install`, Start Command `npm start`, and add the
> same four environment variables by hand.)*

### Step 4 — Set up your booking page

1. Open `your-link/admin`, log in with your `ADMIN_PASSWORD`.
2. Go to **Settings** and set your property name, confirm the $300 / $150
   prices, add your **payment link** (you can paste this later once you have it),
   and your contact email/phone. Edit the agreement text if you'd like.
3. Share your public link. You're live!

### Notes

- **Free-tier sleep:** Render's free site "sleeps" after ~15 minutes of no
  visitors, so the *first* visit after a quiet period can take ~30–60 seconds to
  load. Visits after that are instant. (Upgrading Render's plan removes the
  sleep, if you ever want that.)
- **Skipping Turso:** If you deploy without the two `DATABASE_*` values, the site
  still works, but bookings are stored on Render's temporary disk and will be
  **lost when the free service restarts**. Use Turso for anything real.
- **Custom domain:** Render lets you attach your own domain (e.g.
  `book.yourhouse.com`) for free in the service settings.

---

## How it's built

| Part | Tech |
|---|---|
| Server / API | Node.js + Express |
| Database | libSQL / SQLite (local file in dev, free Turso cloud in production) |
| Front end | Plain HTML/CSS/JavaScript (no build step) |
| Signature | Lightweight canvas pad (no dependencies) |
| Admin auth | Password + signed session token |

```
server.js              Express server: serves pages + all API routes
src/
  db.js                Database connection, schema, settings
  availability.js      Date math + which nights are taken
  auth.js              Admin password check + session tokens
public/
  index.html           The booking site
  admin.html           The admin portal
  css/styles.css       All styling
  js/booking.js        Booking flow logic
  js/calendar.js       Availability calendar
  js/signature.js      Signature pad
  js/admin.js          Admin portal logic
render.yaml            One-click Render deploy config
.env.example           Template for your settings/secrets
```

## Security notes

- Set a **strong `ADMIN_PASSWORD`** and a long random `SESSION_SECRET` before
  going live (Render generates the latter for you).
- Guest IDs and signatures are stored in your database and only shown in the
  password-protected admin portal.
- The agreement template is a general starting point — **have it reviewed by a
  lawyer** before relying on it.
