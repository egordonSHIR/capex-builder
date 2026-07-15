# Capex Builder — Web App

Mobile-first web app to capture property tour notes and build a capex budget for any property. Single-property at a time, saves locally to the browser, exports to Excel.

## Folder contents

| File | Purpose |
|---|---|
| `index.html` | App entry point |
| `styles.css` | Mobile-first styling |
| `app.js` | All app logic (state, render, export) |
| `schema.js` | Auto-generated from `MFVA Capex page.xlsx`. Re-run `python ../build_schema.py` to regenerate |

The schema is split into four phases:
- **Phase 1 — Property Basics** (identity, units/area, building/site)
- **Phase 2 — Physical Characteristics** (construction, mechanical, plumbing, electrical, amenities)
- **Phase 3 — Capex Line Items** (187 items pulled from the source Excel, grouped Soft Costs → Ground Work → Building Work → Interior → Exterior → Amenities/Common → Commercial)
- **Phase 4 — Review & Export** (sanity check, contingency/fee adjustments, totals, Excel export)

## Running locally

Open `index.html` in any browser. All data persists in browser `localStorage` (per device). Use the menu (☰) → "Export JSON" before clearing browser data to avoid losing work.

## Deploying to GitHub Pages

From a terminal, in this `webapp/` folder:

```bash
git init
git add .
git commit -m "Initial Capex Builder web app"
gh repo create capex-builder --public --source=. --remote=origin --push
gh api -X POST /repos/:owner/capex-builder/pages -f source.branch=main -f source.path=/
```

(Or, manually: create a repo on github.com, `git remote add origin <url>`, push, then Settings → Pages → Source: `main` branch / root.)

Your app will be live at `https://<your-username>.github.io/capex-builder/` within ~1 minute.

## Enabling Google Drive sync

1. Go to https://console.cloud.google.com → create project → APIs & Services → Credentials → "Create Credentials" → "OAuth Client ID" → Web application.
2. Add your Pages URL (e.g. `https://<user>.github.io`) under "Authorized JavaScript origins".
3. Copy the **Client ID** and paste it into `app.js`:
   ```js
   const GOOGLE_CLIENT_ID = 'paste-here.apps.googleusercontent.com';
   ```
4. Commit + push. The menu's "Connect Google Drive" button will now request authorization. After connecting, a Drive access token is stored in localStorage. (Upload/download sync calls are stubbed — wire them to a known Drive folder ID once you've confirmed the OAuth handshake.)

## Modifying the schema

- **Phase 1 / Phase 2 fields**: edit the `phase1` / `phase2` lists in `../build_schema.py`, then run `python build_schema.py` from the parent folder.
- **Phase 3 capex line items**: edit `../MFVA Capex page.xlsx` (CAPEX sheet), then re-run `python build_schema.py`. The script reads the Excel and rewrites `schema.js`.

## Roadmap stubs

- [ ] Wire Drive upload/download (token capture is already in place)
- [ ] Add image attachments per line item (camera input on phone)
- [ ] Multi-property history (currently single-property; export JSONs as snapshots)
- [ ] More dropdown options on Phase 2 (Flooring, Landscape Level, etc.)
- [ ] Pull richer defaults from MF Typical / ExStay Typical columns
