# Onboarding Tracker

A downloadable Windows desktop app that turns your paper **Onboarding Checklist**
into a shared, live tracker. Add each new hire once and their full checklist is
generated automatically; everyone can see where each person is in the process,
and each staff member gets a focused **My Tasks** list of what they're
responsible for.

Built with Electron + React + sql.js. Runs fully offline with a local SQLite
database that can live on a **shared network folder** so every computer in the
office sees the same data — no cloud, no monthly fees.

## What it does

- **Add an employee** (name, position, start date, owner) and the whole
  checklist is created from your template instantly.
- **Per-employee checklist** grouped into the same sections as the paper form —
  New Hire Paperwork, Before Start Date / Systems, Payroll / Benefits,
  Training & Touchdowns, and UKG Setup — each task with a status
  (Pending / Done / N/A), an assigned staff member, and a notes field.
- **Progress at a glance** — every employee shows a live % complete; the
  dashboard summarizes active onboardings, completed, your open tasks, and any
  overdue tasks (start date passed but still pending).
- **My Tasks** — each person signs in and sees only the tasks assigned to them,
  grouped by employee, with one-click status updates.
- **Roles** — *Admin* (full access), *Manager* (add/edit employees, reassign
  tasks), *Staff* (work their own tasks, view everyone).
- **Customizable template** — Admin → Checklist Template lets you add/edit/remove
  sections and tasks and set the default assignee for each.
- **Export to PDF** — print or email any employee's checklist (keeps a paper
  trail if you need one).
- **Backup & restore** — one-click database snapshot.

## Sharing data across computers

This was set up for the **shared network folder** model:

1. Install the app on each staff computer.
2. On one computer, go to **Settings → Data location → Change data folder…** and
   pick a folder on your shared drive (e.g. `\\SERVER\Onboarding`). That computer
   copies its current data into the shared folder.
3. On every other computer, point **Settings → Data location** at the **same**
   shared folder.

Now everyone reads and writes the same database file. If another computer makes a
change while you have the app open, a **"Refresh now"** banner appears so you can
pull the latest.

> For a single office this works great. If many people need to edit at the exact
> same second, or you need access from home / multiple locations, that's the
> point to move to a hosted/cloud backend — the app is structured so that can be
> added as a next phase.

## Getting the Windows app

### Option A — build the installer in the cloud (no Windows PC needed)
This repo includes a GitHub Actions workflow that builds the installer on a
Windows runner:

1. Push this repo to GitHub.
2. Open the **Actions** tab → **Build Windows installer** → **Run workflow**.
3. When it finishes, download the **OnboardingTracker-Windows** artifact — it
   contains `OnboardingTracker-Setup-x.y.z.exe`.
4. Run that installer on each company computer.

### Option B — build locally on Windows
```bash
npm install
npm run dist:win      # outputs release/OnboardingTracker-Setup-x.y.z.exe
```

## Running in development
```bash
npm install

# Web preview in a browser (quick UI work; data saved to localStorage)
npm run dev

# Full desktop app with hot reload
npm run start

# Production web build
npm run build
```

## First sign-in

| Account | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Staff (seeded from your form) | e.g. `jgarcia`, `snguyen`, `byork`… | `welcome123` |

Everyone should change their password after first sign-in
(**Admin → Staff → Password** resets them). The seeded staff match the names on
your checklist and are pre-set as the default owners for their tasks.

## Editing the checklist

The default checklist lives in `src/services/checklistTemplate.js` (used the
first time the database is created). Day-to-day, edit it in the app under
**Admin → Checklist Template**. Template changes apply to **new** employees;
people already in the system keep the checklist they were created with.

## Where the data lives

- **Desktop app**: a SQLite file (`onboarding-data.db`) in the app's data folder
  by default, or your chosen shared folder. PDFs are saved wherever you pick.
- **Web preview**: browser `localStorage` (use Settings → Backup to export).

## Project layout

```
electron/
  main.js          Electron main process, configurable DB path, IPC
  preload.cjs      Safe bridge: readDb / writeDb / dbStat / chooseDataFolder / export
src/
  main.jsx         React entry (providers + router)
  App.jsx          Routes
  services/
    db.js                Schema, seeding, all domain queries (Users, Employees, Tasks, Template)
    checklistTemplate.js The default checklist transcribed from your PDF
    pdf.js               Per-employee checklist PDF
    format.js            Dates, statuses, progress helpers
  contexts/        Database / Auth / Theme providers
  components/
    Login, Layout, Dashboard
    EmployeeList, EmployeeFormModal, EmployeeDetail
    MyTasks
    UserManagement (Staff), TemplateEditor, Settings
    ProgressBar, StatusControl
scripts/
  validate-db.mjs  Runtime sanity check of the data layer (node scripts/validate-db.mjs)
.github/workflows/
  build-windows.yml  Builds the Windows installer as a downloadable artifact
```

## Notes on security

- All data is local — nothing is transmitted to any server.
- Passwords are hashed (SHA-256). For a small offline team this is a reasonable
  start; if you later add cloud/remote access, move to a per-user salt and a slow
  KDF (argon2/bcrypt).
- Keep the shared folder on a drive only your team can access, and keep regular
  backups (Settings → Download backup).

## License

MIT
