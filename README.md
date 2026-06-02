# Capex Builder — Web App

Mobile-first web app to capture property tour notes and build a capex budget for any property. Single-property at a time, saves locally to the browser, exports to Excel.

## Live

Deployed via GitHub Pages: https://egordonsHIR.github.io/capex-builder/ (enable in repo Settings → Pages → Source: main / root if not yet live).

## Files

| File | Purpose |
|---|---|
| `index.html` | App entry point |
| `styles.css` | Mobile-first styling |
| `app.js` | All app logic (state, render, export) |
| `schema.js` | Auto-generated from `MFVA Capex page.xlsx`. Re-run `python build_schema.py` in source folder to regenerate |

## Phases

- **Phase 1** — Property Basics (identity, units/area, building/site)
- **Phase 2** — Physical Characteristics (construction, mechanical, plumbing, electrical, amenities)
- **Phase 3** — 187 capex line items (Soft Costs → Base → Building → Interior → Exterior → Amenities → Commercial)
- **Phase 4** — Review, sanity check, contingency/fee, totals, Excel export

## Local dev

Open `index.html` in any browser. Data persists in `localStorage`. Use ☰ menu → Export JSON to back up.

## Google Drive sync

1. console.cloud.google.com → OAuth Client ID (Web) → Authorized JS origins: your Pages URL.
2. Paste Client ID into `app.js`: `const GOOGLE_CLIENT_ID = '...';`
3. Commit + push. Drawer "Connect Google Drive" button activates.
