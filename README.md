# Dental Clinic Manager

Desktop application for dental clinics: patient intake, multi-language consent forms with digital signatures, an interactive 32-tooth chart, clinical notes, and automated PDF treatment report generation.

Built with Electron + React + sql.js. Runs entirely offline with a local SQLite database persisted to the user's data directory.

## Features

### Patient Management
- Full patient registration with demographics, contact, insurance, medical history, allergies, medications
- Search by name, phone, email, or patient ID
- Per-patient dashboard with visit history and document archive
- Visual allergy / medical-condition alerts at every relevant screen

### Consent Forms
- Multi-language consent (English, Spanish, French) — extensible via `src/services/translations.js`
- Standard clinic, HIPAA, risk-acknowledgment, and financial-responsibility sections
- In-app signature capture with clear/redraw
- Auto-archived to patient record with timestamp
- Generated as professional PDFs with clinic branding header/footer

### Interactive Tooth Chart
- Full 32-tooth dental arch (Universal numbering)
- Click any tooth to annotate condition, surfaces (O/B/L/M/D/I), and note
- 10 color-coded conditions: cavity, filled, crown, missing, implant, root canal, sensitive, extraction, watch, healthy
- Visual legend
- Findings persist per visit

### Clinical Notes
- Categorized notes (exam, diagnosis, treatment plan, follow-up, general)
- Quick-template buttons for common findings per category
- Free-text input
- Optionally link any note to a selected tooth

### Treatment Reports
- One-click PDF generation pulling all patient data, alerts, tooth chart, findings summary, and grouped notes
- Visual tooth chart rendered into the PDF
- Next-appointment scheduling
- Doctor signature line
- Archived to patient file, viewable and re-exportable

### Provider Dashboard
- Today's visit queue with allergy badges
- Patient + visit + document counters
- Recent documents feed

### Admin
- User management (admin / doctor / staff roles)
- Password reset
- Clinic settings (name, address, phone, license — appears in all PDFs)
- Full database backup / restore
- Audit log of all auditable actions (login, patient changes, signed forms, generated reports)

## Tech Stack

| Layer | Library |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 18 + React Router 6 |
| Build | Vite 5 |
| Database | sql.js (SQLite compiled to WASM) |
| PDF | jsPDF |
| Signatures | signature_pad |
| Icons | lucide-react |

## Running

```bash
npm install

# Web dev (no Electron, useful for quick UI work)
npm run dev

# Full Electron development with hot-reload
npm run start

# Build static assets
npm run build

# Run a built version inside Electron
npm run electron
```

Default credentials on first launch: `admin` / `admin123`.

## Data Storage

- **Electron mode**: SQLite file at `<userData>/clinic-data.db`. PDFs at `<userData>/documents/`.
- **Web mode**: Database and documents persisted to `localStorage`. Use Settings → Backup to export.

## Project Layout

```
electron/
  main.js          Electron main process & IPC handlers
  preload.cjs      contextBridge exposing readDb / writeDb / saveDoc / readDoc
src/
  main.jsx         React entry, providers, router
  App.jsx          Route table
  services/
    db.js          sql.js wrapper + domain helpers (Patients, Visits, ...)
    pdf.js         Consent + treatment-report PDF generators
    translations.js  Consent form copy per language
  contexts/
    DatabaseContext.jsx  Loads sql.js, gates the app on init
    AuthContext.jsx      Login / logout / session storage
    ThemeContext.jsx     Light / dark mode
  components/
    Login.jsx
    Layout.jsx
    Dashboard.jsx
    PatientList.jsx
    PatientFormModal.jsx
    PatientDetail.jsx
    VisitScreen.jsx
    ToothChart.jsx       The clickable 32-tooth chart
    ClinicalNotesPanel.jsx
    ConsentFormModal.jsx
    SignaturePad.jsx
    ArchiveView.jsx
    Settings.jsx
    UserManagement.jsx
styles/
  global.css       Theme tokens, all component styles
```

## Adding Languages

1. Open `src/services/translations.js`
2. Add a new entry to `LANGUAGES`
3. Add a matching entry to `CONSENT_TEMPLATES` with `title`, `intro`, `sections`, signature labels
4. Language appears automatically in the consent form picker

## Workflow

1. **Intake** — Register a new patient or open an existing one
2. **Consent** — From patient detail, open Consent Form, select language, patient signs in-app, archived automatically
3. **Visit** — Start visit; opens the exam screen with tooth chart + notes side-by-side
4. **Examine** — Click each tooth, set condition / surfaces / note. Add categorized clinical notes (optionally linked to a tooth).
5. **Report** — Click "Generate Report"; PDF is built from all visit data and stored on the patient
6. **Complete** — Mark visit completed; next-appointment date saved

## Security Notes

- All data is stored locally — no cloud transmission
- Password hashing uses SHA-256 with a fixed salt (suitable for a starting point; for production, swap to a per-user salt and a slow KDF like argon2 or bcrypt)
- HIPAA-friendly design: local storage only, audit log, role-based access
- For full HIPAA compliance: enable disk-level encryption on the host machine, configure automatic screen locks, and back up to encrypted media only

## License

MIT
