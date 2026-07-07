// Capex Builder — multi-property web app
// STORE = { version, properties: {[id]: Property}, currentPropertyId }
// STATE = live reference to the current property (so existing render code keeps working).

const STORAGE_KEY = 'capex_builder_state_v1';   // legacy single-property key (read for migration)
const STORE_KEY   = 'capex_builder_store_v2';   // current multi-property key
const DRIVE_TOKEN_KEY = 'capex_builder_drive_token';
const DRIVE_TOKEN_EXP_KEY = 'capex_builder_drive_token_exp';
const OPTIONS_KEY = 'capex_options_overrides_v1';
const ONBOARDING_DISMISSED_KEY = 'capex_onboarding_dismissed_v1';
const DRIVE_EVER_CONNECTED_KEY = 'capex_drive_ever_connected_v1';
const ANTHROPIC_KEY_STORAGE = 'capex_anthropic_key_v1';

// ---------- Dropdown option overrides (loaded from Excel via import) ----------
function loadOptionOverrides() {
  try { return JSON.parse(localStorage.getItem(OPTIONS_KEY) || '{}'); }
  catch { return {}; }
}
function getFieldOptions(field) {
  const ov = loadOptionOverrides();
  return ov[field.key] || field.options || [];
}
function resetOptionOverrides() {
  localStorage.removeItem(OPTIONS_KEY);
}

// ---------- Anthropic API key (for Process Survey) ----------
// Resolution order: personal key (this browser's localStorage) → org-shared
// key (capex_builder_config.json in the central Drive sync folder). The shared
// key lives ONLY on Drive — readable by company-domain accounts, never baked
// into the public repo/site. Publish yours via ☰ → Share Key Org-Wide.
const SHARED_CONFIG_FILENAME = 'capex_builder_config.json';
let SHARED_ANTHROPIC_KEY_CACHE = null;   // null = not fetched this session; '' = fetched, none found

function getAnthropicKey() { return localStorage.getItem(ANTHROPIC_KEY_STORAGE) || ''; }
function setAnthropicKey(k) {
  if (k) localStorage.setItem(ANTHROPIC_KEY_STORAGE, k);
  else localStorage.removeItem(ANTHROPIC_KEY_STORAGE);
}
function updateAnthropicKeyStatus() {
  const s = $('#anthropic-key-status');
  if (!s) return;
  const k = getAnthropicKey();
  if (k) s.textContent = 'Personal key set (' + k.slice(0, 14) + '…)';
  else if (SHARED_ANTHROPIC_KEY_CACHE) s.textContent = 'Using org-shared key (Drive)';
  else s.textContent = 'No personal key — org-shared key used if available';
}

// Fetch the org-shared key from the sync folder. Requires Drive to be
// connected (Process Survey already does). Cached per session; pass force to
// refetch (e.g. after a 401 — the key may have been rotated).
async function fetchSharedAnthropicKey(force) {
  if (!force && SHARED_ANTHROPIC_KEY_CACHE !== null) return SHARED_ANTHROPIC_KEY_CACHE;
  try {
    const res = await driveDownloadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME);
    SHARED_ANTHROPIC_KEY_CACHE = (res && res.data && typeof res.data.anthropic_api_key === 'string')
      ? res.data.anthropic_api_key.trim() : '';
  } catch (e) {
    console.warn('fetchSharedAnthropicKey:', e);
    SHARED_ANTHROPIC_KEY_CACHE = '';
  }
  updateAnthropicKeyStatus();
  return SHARED_ANTHROPIC_KEY_CACHE;
}

// Publish this browser's personal key org-wide (☰ → Share Key Org-Wide).
// Merges into the existing config file so future config fields survive.
async function shareAnthropicKeyOrgWide() {
  const k = getAnthropicKey();
  if (!k) { alert('No API key stored in this browser yet.\n\nClick "Set Anthropic API Key" first, then share it org-wide.'); return; }
  if (!confirm(
    'Share your Anthropic API key org-wide?\n\n' +
    'It will be stored in the shared Capex Builder sync folder on Drive. ' +
    'Everyone in the company domains can then run 🛰 Process Survey billed to your Anthropic account.'
  )) return;
  try {
    let existing = {};
    try {
      const res = await driveDownloadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME);
      if (res && res.data && typeof res.data === 'object') existing = res.data;
    } catch {}
    existing.anthropic_api_key = k;
    existing.anthropic_key_shared_by = (CURRENT_USER && CURRENT_USER.email) || '';
    existing.anthropic_key_shared_at = new Date().toISOString();
    await driveUploadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME, existing);
    // Verify by re-reading from Drive — an alert (not just a toast) so the
    // one-time setup action gets unmistakable confirmation.
    const check = await fetchSharedAnthropicKey(true);
    if (check === k) {
      alert('✅ API key shared org-wide.\n\nVerified: the key is now readable from the shared Drive sync folder. Teammates\' 🛰 Process Survey will use it automatically — no key entry needed.');
    } else {
      alert('⚠️ Upload completed but verification read back a different value — try again, or check the sync folder (capex_builder_config.json).');
    }
    updateAnthropicKeyStatus();
  } catch (e) {
    console.error('shareAnthropicKeyOrgWide:', e);
    alert('❌ Could not share key: ' + e.message);
  }
}

// ---------- Asana integration: write the Capex Builder link to the deal task ----------
// When a property is linked to a Google Drive deal folder, set the "Capex Builder
// Link" (text) custom field on the deal's PIPELINE task to the property's unique
// URL. Auth mirrors the Anthropic key: personal localStorage token → org-shared
// `asana_pat` in capex_builder_config.json (Drive, company-domain access only).
const ASANA_TOKEN_STORAGE = 'capex_asana_token_v1';
const ASANA_API = 'https://app.asana.com/api/1.0';
const ASANA_PIPELINE_PROJECT = '701270220756366';    // "PIPELINE" (value-add / standard deals)
const ASANA_EXSTAY_PROJECT = '1214742025664401';     // "ExStay Conv. Pipeline" (hotel→MF conversions)
const ASANA_DEAL_PROJECTS = [ASANA_PIPELINE_PROJECT, ASANA_EXSTAY_PROJECT];  // searched for the deal task
const ASANA_CAPEX_LINK_FIELD = '1215879558403626';   // "Capex Builder Link" (text) custom field
const CAPEX_BUILDER_BASE_URL = 'https://capex-builder.pages.dev/';  // canonical host for shareable links
let SHARED_ASANA_TOKEN_CACHE = null;  // null = not fetched; '' = fetched, none found

function getAsanaToken() { return localStorage.getItem(ASANA_TOKEN_STORAGE) || ''; }
function setAsanaToken(k) {
  if (k) localStorage.setItem(ASANA_TOKEN_STORAGE, k.trim());
  else localStorage.removeItem(ASANA_TOKEN_STORAGE);
}
function updateAsanaTokenStatus() {
  const s = $('#asana-token-status');
  if (!s) return;
  const k = getAsanaToken();
  if (k) s.textContent = 'Personal token set (' + k.slice(0, 10) + '…)';
  else if (SHARED_ASANA_TOKEN_CACHE) s.textContent = 'Using org-shared token (Drive)';
  else s.textContent = 'No personal token — org-shared token used if available';
}
async function fetchSharedAsanaToken(force) {
  if (!force && SHARED_ASANA_TOKEN_CACHE !== null) return SHARED_ASANA_TOKEN_CACHE;
  try {
    const res = await driveDownloadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME);
    SHARED_ASANA_TOKEN_CACHE = (res && res.data && typeof res.data.asana_pat === 'string')
      ? res.data.asana_pat.trim() : '';
  } catch (e) {
    console.warn('fetchSharedAsanaToken:', e);
    SHARED_ASANA_TOKEN_CACHE = '';
  }
  updateAsanaTokenStatus();
  return SHARED_ASANA_TOKEN_CACHE;
}
async function resolveAsanaToken() {
  const personal = getAsanaToken();
  if (personal) return personal;
  return await fetchSharedAsanaToken();
}
async function shareAsanaTokenOrgWide() {
  const k = getAsanaToken();
  if (!k) { alert('No Asana token stored in this browser yet.\n\nClick "Set Asana Token" first, then share it org-wide.'); return; }
  if (!confirm(
    'Share your Asana Personal Access Token org-wide?\n\n' +
    'It will be stored in the shared Capex Builder sync folder on Drive (company-domain access only). ' +
    'The app will then auto-write each property\'s Capex Builder link to its Asana deal task on behalf of your account.'
  )) return;
  try {
    let existing = {};
    try {
      const res = await driveDownloadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME);
      if (res && res.data && typeof res.data === 'object') existing = res.data;
    } catch {}
    existing.asana_pat = k;
    existing.asana_pat_shared_by = (CURRENT_USER && CURRENT_USER.email) || '';
    existing.asana_pat_shared_at = new Date().toISOString();
    await driveUploadJson(SYNC_FOLDER_ID, SHARED_CONFIG_FILENAME, existing);
    const check = await fetchSharedAsanaToken(true);
    if (check === k) alert('✅ Asana token shared org-wide and verified in the sync folder. Teammates\' apps will now write Capex Builder links to Asana automatically.');
    else alert('⚠️ Upload completed but verification read back a different value — try again, or check capex_builder_config.json in the sync folder.');
    updateAsanaTokenStatus();
  } catch (e) {
    console.error('shareAsanaTokenOrgWide:', e);
    alert('❌ Could not share token: ' + e.message);
  }
}

// Low-level Asana REST call (browser → Asana API with a Bearer PAT; Asana supports CORS).
async function asanaFetch(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(ASANA_API + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null; try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (json && json.errors && json.errors[0] && json.errors[0].message) || ('Asana HTTP ' + res.status);
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return json;
}

function capexBuilderUrlForProperty(p) {
  return CAPEX_BUILDER_BASE_URL + propertyHash(p);   // #/prop/<slug> (canonical), else #/p/<id>
}
function _normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

// Score deal tasks against a property name. Pulls from every deal project
// (PIPELINE + ExStay Conv. Pipeline) and dedupes by gid. Returns candidates
// sorted best-first. (Each project list is capped at 100 tasks.)
async function findAsanaCandidates(token, propName) {
  const byGid = new Map();
  for (const proj of ASANA_DEAL_PROJECTS) {
    let data;
    try { data = await asanaFetch(`/projects/${proj}/tasks?opt_fields=name&limit=100`, { token }); }
    catch (e) { console.warn('findAsanaCandidates: project', proj, e); continue; }
    for (const t of ((data && data.data) || [])) if (t && !byGid.has(t.gid)) byGid.set(t.gid, t);
  }
  const tasks = Array.from(byGid.values());
  const target = _normName(propName);
  const targetTokens = target.split(' ').filter(w => w.length > 2);
  return tasks.map(t => {
    const n = _normName(t.name);
    let score = 0;
    if (n && n === target) score = 100;
    else if (n && target && (n.includes(target) || target.includes(n))) score = 80;
    else if (targetTokens.length) score = (targetTokens.filter(w => n.includes(w)).length / targetTokens.length) * 60;
    return { gid: t.gid, name: t.name, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
}

// Ensure the property is matched to a PIPELINE task, then PUT the Capex Builder
// URL into its "Capex Builder Link" field. Best-effort. interactive=false (silent
// auto-link) only links on an EXACT name match and never prompts.
async function syncCapexLinkToAsana(p, { interactive = true, silent = false } = {}) {
  p = p || STATE;
  if (!p) return;
  let token = await resolveAsanaToken();
  if (!token) {
    if (!interactive) return;   // no token + non-interactive: skip quietly
    const entered = prompt('To write Capex Builder links to Asana, paste an Asana Personal Access Token\n(asana.com → My Settings → Apps → Developer → Personal access tokens).\n\nTip: share it org-wide afterward via ☰ → Asana → Share Token.');
    if (!entered || !entered.trim()) return;
    setAsanaToken(entered.trim()); updateAsanaTokenStatus();
    token = entered.trim();
  }
  p.asana = p.asana || {};
  const propName = p.name || (p.phase1 && p.phase1.prop_name) || '';
  try {
    let taskGid = p.asana.taskGid;
    if (!taskGid) {
      const candidates = await findAsanaCandidates(token, propName);
      if (!candidates.length) { if (interactive) toast('No PIPELINE task matched "' + propName + '" — link via ☰ → Asana', 'error'); return; }
      const best = candidates[0];
      if (!interactive) {
        if (best.score >= 100) taskGid = best.gid;   // only auto-link on an exact name match
        else return;                                 // ambiguous — wait for an interactive run
      } else if (best.score >= 100 || (candidates.length === 1 && best.score >= 60)) {
        if (!confirm('Link this property to Asana deal task:\n\n  "' + best.name + '"\n\nand set its Capex Builder Link?')) return;
        taskGid = best.gid;
      } else {
        const top = candidates.slice(0, 8);
        const pick = prompt('Which Asana deal task is "' + propName + '"? Enter a number (or Cancel):\n\n' +
          top.map((c, i) => (i + 1) + '. ' + c.name).join('\n'));
        const idx = parseInt(pick, 10);
        if (!idx || idx < 1 || idx > top.length) return;
        taskGid = top[idx - 1].gid;
      }
      p.asana.taskGid = taskGid; saveState();
    }
    const url = capexBuilderUrlForProperty(p);
    await asanaFetch(`/tasks/${taskGid}`, {
      method: 'PUT', token,
      body: { data: { custom_fields: { [ASANA_CAPEX_LINK_FIELD]: url } } },
    });
    p.asana.linkPushedAt = new Date().toISOString();
    p.asana.linkPushedUrl = url;
    saveState();
    if (!silent) toast('Capex Builder link written to Asana ✓', 'success');
  } catch (e) {
    console.warn('syncCapexLinkToAsana:', e);
    if (e.status === 401) { SHARED_ASANA_TOKEN_CACHE = null; if (getAsanaToken()) { setAsanaToken(''); updateAsanaTokenStatus(); } }
    if (interactive) toast('Asana update failed: ' + e.message, 'error');
  }
}

function newPropertyId() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
}
const DEFAULT_PROPERTY = () => ({
  id: newPropertyId(),
  name: '',
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  drive: { folderId: '', fileId: '', capexFolderId: '', lastPushed: null, lastPulled: null, remoteModifiedTime: null },
  phase1: {},
  phase2: {}, // Physical characteristics questionnaire (rendered within the Basics tab)
  unitMix: [], // [{ type, count, beds, baths, sqft, status }] — part of the Physical section
  checklist: {}, // CAPEX checklist (Questionnaire tab): `${gi}.${si}.${ii}` -> true
  phase3: {}, // Details: keyed `${gi}.${si}.${ii}` -> {qty, unit_type, unit_cost, notes, mf_linked, pct_group_id, finish}
  // User-defined CAPEX Groups: buckets of line items used as the base for any
  // line item priced as a percentage. Each group = {id, name, itemKeys:[ckKey]}.
  capexGroups: [],
  phase4: { contingency_pct: 0.10, mgmt_fee_pct: 0.10, notes: '' },
  // Survey-derived site specs (from survey-breakdown-specs skill).
  // Flat values land in phase1 (parking_spots_hc, site_perimeter_lf, etc.);
  // per-building, per-tract, and meta data live here.
  survey: {
    processed_at: null,
    source_pdf: '',
    scale_paper: '',
    ft_per_pixel: null,
    buildings: [],   // [{label, footprint_sf, stories, height_ft, roof_pitch, roof_sf, facade_sf}]
    tracts: [],      // [{name, is_easement, land_sf, land_ac}]
    google_maps_notes: '',
    discrepancies: [],
  },
});
const DEFAULT_STORE = () => ({ version: 2, properties: {}, currentPropertyId: null });

let STORE = loadStore();
let STATE = STORE.currentPropertyId ? STORE.properties[STORE.currentPropertyId] : null;
let CURRENT_VIEW = STATE ? 'property' : 'home';
let CURRENT_PHASE = 1;

// ---------- Storage ----------
function loadStore() {
  try {
    const rawV2 = localStorage.getItem(STORE_KEY);
    if (rawV2) {
      const s = JSON.parse(rawV2);
      if (s && s.properties) {
        // Ensure currentPropertyId still references a live property
        if (s.currentPropertyId && !s.properties[s.currentPropertyId]) s.currentPropertyId = null;
        return s;
      }
    }
    // One-time migration from v1 single-property state
    const rawV1 = localStorage.getItem(STORAGE_KEY);
    if (rawV1) {
      const old = JSON.parse(rawV1);
      const p = Object.assign(DEFAULT_PROPERTY(), {
        name: (old.phase1 && old.phase1.prop_name) || 'Untitled Property',
        phase1: old.phase1 || {},
        phase2: old.phase2 || {},
        unitMix: old.unitMix || [],
        phase3: old.phase3 || {},
        phase4: old.phase4 || { contingency_pct: 0.10, mgmt_fee_pct: 0.10, notes: '' },
        created: (old.meta && old.meta.created) || new Date().toISOString(),
        updated: (old.meta && old.meta.updated) || new Date().toISOString(),
      });
      const store = DEFAULT_STORE();
      store.properties[p.id] = p;
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      return store;
    }
  } catch (e) { console.warn('loadStore failed', e); }
  return DEFAULT_STORE();
}
const PROP_NAME_MAX = 25;
function saveState() {
  if (STATE) {
    STATE.updated = new Date().toISOString();
    // Property Name is capped at PROP_NAME_MAX chars (truncate anything longer).
    if (STATE.phase1 && typeof STATE.phase1.prop_name === 'string' && STATE.phase1.prop_name.length > PROP_NAME_MAX) {
      STATE.phase1.prop_name = STATE.phase1.prop_name.slice(0, PROP_NAME_MAX);
    }
    // Keep displayed name in sync with phase1.prop_name when the user edits it on the form
    if (STATE.phase1 && STATE.phase1.prop_name) STATE.name = STATE.phase1.prop_name;
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
  scheduleAutoPush();   // Drive-authoritative: converge the cache to Drive shortly after each edit
}

// ---- Drive-authoritative auto-push ----------------------------------------
// localStorage is a transient write-behind cache; Drive is the source of truth.
// Every saveState() schedules a debounced silent push so the device never holds
// divergent data for more than ~2s. The 60s syncTick remains as a backstop +
// heartbeat. _syncState feeds the single sync-bar status.
let _autoPushTimer = null;
let _syncState = 'idle';   // 'idle' | 'saving' | 'error' | 'conflict'
const AUTO_PUSH_DEBOUNCE_MS = 2000;
function scheduleAutoPush() {
  if (!STATE || !STATE.drive || !STATE.drive.folderId) return;          // nothing to sync to yet
  if (typeof getDriveToken === 'function' && !getDriveToken()) return;  // Drive not connected
  _syncState = 'saving';
  if (typeof updateSyncBar === 'function') updateSyncBar();
  if (_autoPushTimer) clearTimeout(_autoPushTimer);
  _autoPushTimer = setTimeout(async () => {
    _autoPushTimer = null;
    const ok = await pushToDrive({ silent: true });   // true=ok, false=fail, 'conflict'=remote newer, undefined=skip
    _syncState = (ok === false) ? 'error' : (ok === 'conflict') ? 'conflict' : 'idle';
    if (typeof updateSyncBar === 'function') updateSyncBar();
  }, AUTO_PUSH_DEBOUNCE_MS);
}

function createProperty(name) {
  const p = DEFAULT_PROPERTY();
  p.name = (name || '').trim() || 'Untitled Property';
  p.phase1.prop_name = p.name;
  STORE.properties[p.id] = p;
  STORE.currentPropertyId = p.id;
  STATE = p;
  saveState();
  return p;
}
function openProperty(id) {
  if (!STORE.properties[id]) return;
  STORE.currentPropertyId = id;
  STATE = STORE.properties[id];
  // Enforce the 25-char Property Name cap on existing records as they're opened.
  if (STATE.phase1 && typeof STATE.phase1.prop_name === 'string' && STATE.phase1.prop_name.length > PROP_NAME_MAX) {
    STATE.phase1.prop_name = STATE.phase1.prop_name.slice(0, PROP_NAME_MAX);
    STATE.name = STATE.phase1.prop_name;
    saveState();   // persist + sync the truncation
  }
  maybeGuessMarketMSA();   // backfill an empty Market (MSA) — bumps updated + auto-pushes only if it fills one
  // Persist currentPropertyId WITHOUT bumping `updated` (opening a property is not
  // an edit — bumping it would falsely mark the cache dirty and risk a stale push).
  localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
  CURRENT_PHASE = 1;
  CURRENT_VIEW = 'property';
  renderShell();
  // Kick off the auto-sync loop for this property — pushes dirty changes,
  // refreshes our heartbeat, surfaces concurrent-editor banners.
  if (typeof startAutoSync === 'function') startAutoSync();
  setHash(propertyHash(STATE));   // reflect the open property in the URL (#/prop/<slug>)
  reconcileFromDrive();   // Drive-authoritative: adopt a newer remote copy if this device is clean
}
// Drive-authoritative reconcile: after a cache-first open, if the deal-folder copy
// is newer than our cache AND we have no unsynced local edits, adopt Drive (Drive
// wins). If local is dirty and remote is newer, we leave it — pushToDrive's silent
// bail + the concurrent-editor banner handle that conflict without clobbering.
function reconcileFromDrive() {
  if (!STATE || !STATE.drive || !STATE.drive.folderId) return;
  if (typeof getDriveToken === 'function' && !getDriveToken()) return;
  const targetId = STATE.id;
  (async () => {
    try {
      const targetFolder = await resolveCapexFolder();
      const existing = await driveFindFile(targetFolder, STATE_FILENAME);
      if (!existing || !STATE || STATE.id !== targetId) return;   // gone/navigated away
      const localDirty = !STATE.drive.lastPushed || STATE.drive.lastPushed < STATE.updated;
      const remoteNewer = existing.modifiedTime &&
        (!STATE.drive.remoteModifiedTime || existing.modifiedTime > STATE.drive.remoteModifiedTime);
      if (remoteNewer && !localDirty) {
        _syncState = 'saving'; updateSyncBar();
        await pullFromDrive({ auto: true });
      }
    } catch (e) { console.warn('reconcileFromDrive failed:', e); }
  })();
}
function closeProperty() {
  // Stop auto-sync and release our editor lock so teammates do not see a stale
  // heartbeat. Fire-and-forget on the lock release; the heartbeat goes stale
  // (>2.5 min) anyway, so an inflight failure here is harmless.
  if (typeof stopAutoSync === 'function') stopAutoSync();
  if (typeof releaseEditorLock === 'function') releaseEditorLock().catch(() => {});
  STORE.currentPropertyId = null;
  STATE = null;
  saveState();
  CURRENT_VIEW = 'home';
  renderShell();
  // Refresh the home screen with the latest manifest snapshot.
  if (typeof refreshHomeIndex === 'function') refreshHomeIndex().catch(() => {});
  setHash('#/');   // back to the home URL
}
function deleteProperty(id) {
  delete STORE.properties[id];
  if (STORE.currentPropertyId === id) {
    STORE.currentPropertyId = null;
    STATE = null;
    CURRENT_VIEW = 'home';
    setHash('#/');   // deleted the open property -> drop to the home URL
  }
  saveState();
  // Best-effort: remove from the org manifest too. If a teammate still has
  // the property locally, their next sync tick will recreate the entry —
  // which is what we want (delete = drop my local copy, not org-wide remove).
  if (typeof removeManifestEntry === 'function' && getDriveToken()) {
    removeManifestEntry(id).catch((e) => console.warn('removeManifestEntry failed', e));
  }
}

// ---------- Hash routing: a unique, shareable URL per property ----------
// Canonical form is a readable slug derived from the property NAME:
//   "AUS TX - Crestwood"  ->  #/prop/AUSTX_Crestwood
// Legacy/permanent fallback is the internal id: #/p/<id> (never changes, so
// older links + Asana links written before the slug change still resolve).
// Opening a property reflects its slug in location.hash; loading (or back/forward
// to) a #/prop/<slug> or #/p/<id> URL opens that property — local if present,
// else pulled from the org manifest via Drive. Home is "#/". No router lib.
let _pendingDeepLink = null;  // parsed hash we can't resolve yet (waiting on the manifest)

// Slug from a property name: " - " separator -> "_", then strip spaces/punctuation.
function propertySlug(name) {
  const s = String(name == null ? '' : name)
    .trim()
    .replace(/\s*-\s*/g, '_')        // " - " (market / name separator) -> underscore
    .replace(/\s+/g, '')             // drop remaining spaces
    .replace(/[^A-Za-z0-9_]/g, '');  // keep only URL-safe chars
  return s || 'property';
}
// Canonical hash for a property: slug if it has a name, else the id, else home.
function propertyHash(p) {
  if (p && p.name) return '#/prop/' + propertySlug(p.name);
  if (p && p.id) return '#/p/' + encodeURIComponent(p.id);
  return '#/';
}
// Parse the hash into {kind:'slug'|'id', value} or null (home).
function parseHash() {
  const h = location.hash || '';
  let m = h.match(/^#\/prop\/(.+)$/);
  if (m) return { kind: 'slug', value: decodeURIComponent(m[1]) };
  m = h.match(/^#\/p\/(.+)$/);
  if (m) return { kind: 'id', value: decodeURIComponent(m[1]) };
  return null;
}
function setHash(h) {
  // Skip a redundant history entry / hashchange when nothing actually changes.
  const cur = location.hash || '';
  if (cur === h || (h === '#/' && cur === '')) return;
  location.hash = h;
}
function _matchesHash(parsed, name, id) {
  if (!parsed) return false;
  if (parsed.kind === 'id') return id === parsed.value;
  return propertySlug(name).toLowerCase() === parsed.value.toLowerCase();
}
// Most-recently-updated LOCAL property matching the hash (slugs can collide).
function findLocalPropertyByHash(parsed) {
  if (!parsed) return null;
  if (parsed.kind === 'id') return STORE.properties[parsed.value] || null;
  const hits = Object.values(STORE.properties).filter(p => _matchesHash(parsed, p.name, p.id));
  hits.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')));
  return hits[0] || null;
}
// Most-recently-modified MANIFEST entry matching the hash.
function findManifestEntryByHash(parsed) {
  const props = (MANIFEST_CACHE && MANIFEST_CACHE.data && Array.isArray(MANIFEST_CACHE.data.properties))
    ? MANIFEST_CACHE.data.properties : [];
  if (!parsed) return null;
  if (parsed.kind === 'id') return props.find(e => e && e.id === parsed.value) || null;
  const hits = props.filter(e => e && _matchesHash(parsed, e.name, e.id));
  hits.sort((a, b) => String(b.lastModified || '').localeCompare(String(a.lastModified || '')));
  return hits[0] || null;
}
function tryOpenPendingDeepLink() {
  if (!_pendingDeepLink) return;
  const parsed = _pendingDeepLink;
  const local = findLocalPropertyByHash(parsed);
  if (local) { _pendingDeepLink = null; openProperty(local.id); return; }
  const entry = findManifestEntryByHash(parsed);
  if (entry) { _pendingDeepLink = null; openRemoteProperty(entry); return; }
  // Manifest has loaded but nothing matches — give up so we don't retry forever.
  if (MANIFEST_CACHE && MANIFEST_CACHE.data) {
    _pendingDeepLink = null;
    toast('That property link isn’t available on this account', 'error');
  }
}
// Drive the view from the URL (browser back/forward, edited address bar, opened link).
function routeFromHash() {
  const parsed = parseHash();
  if (parsed) {
    if (STATE && CURRENT_VIEW === 'property' && _matchesHash(parsed, STATE.name, STATE.id)) return;  // already showing it
    const local = findLocalPropertyByHash(parsed);
    if (local) { _pendingDeepLink = null; openProperty(local.id); return; }
    const entry = findManifestEntryByHash(parsed);
    if (entry) { _pendingDeepLink = null; openRemoteProperty(entry); return; }
    // Unknown: remember it, soft-drop to home WITHOUT rewriting the hash (so the
    // shareable link stays in the bar), and let the manifest refresh open it.
    _pendingDeepLink = parsed;
    if (STATE) {
      if (typeof stopAutoSync === 'function') stopAutoSync();
      if (typeof releaseEditorLock === 'function') releaseEditorLock().catch(() => {});
    }
    STORE.currentPropertyId = null; STATE = null; saveState();
    CURRENT_VIEW = 'home'; renderShell();
    if (getDriveToken()) refreshHomeIndex().catch(() => {});
    else tryOpenPendingDeepLink();
  } else {
    _pendingDeepLink = null;
    if (STATE || CURRENT_VIEW !== 'home') closeProperty();
  }
}

// ---------- Helpers ----------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return e;
}
function fmtMoney(n) {
  if (!isFinite(n)) return '$0';
  return '$' + Math.round(n).toLocaleString();
}
// Gray background while an input/textarea is empty; normal white once it has a value.
function grayWhenEmpty(inputEl) {
  if (!inputEl) return;
  const empty = !String(inputEl.value || '').trim();
  inputEl.style.background = empty ? '#f3f4f6' : '#ffffff';
}
// Comma-format a Budget-tab qty/cost <input>'s displayed value. `v` is a plain
// number, or '' to display blank (callers already decide falsy-vs-blank before
// calling this) — used wherever these inputs are set programmatically outside
// the input/blur listeners that strip+reformat live.
function setNumVal(inp, v) {
  if (!inp) return;
  inp.value = (v === '' || v === null || v === undefined) ? '' : formatNumberWithCommas(v);
}
// Strip commas + parse a Budget-tab qty/cost <input>'s current value to a number ('' if blank).
function numVal(inp) {
  const s = inp.value.replace(/,/g, '');
  return s === '' ? '' : Number(s);
}
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2200);
}
function computeField(expr, bag) {
  try {
    // For each value: keep strings as strings (for `show_if` comparisons), coerce empty to 0 for math.
    const args = Object.values(bag).map(v => {
      if (v === '' || v === null || v === undefined) return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isFinite(n) && /^-?\d/.test(String(v)) ? n : v;
    });
    return Function(...Object.keys(bag), `return (${expr});`)(...args);
  } catch { return ''; }
}
// Build an eval bag that includes the section's own fields AND phase1 fields prefixed `p1_`.
function getEvalBag(bag) {
  const out = { ...bag };
  if (typeof STATE !== 'undefined' && STATE && STATE.phase1) {
    for (const k in STATE.phase1) out['p1_' + k] = STATE.phase1[k];
  }
  return out;
}

// ---------- Render: generic form ----------
function formatNumber(v, decimals) {
  if (v === '' || v === null || v === undefined || !isFinite(v)) return '';
  if (decimals === 0) return String(Math.round(Number(v)));
  if (decimals > 0) return Number(v).toFixed(decimals);
  return String(v);
}

// Same as formatNumber, but with thousands separators — used for number-type
// input display (Basics tab). `decimals` undefined => grouped integer display.
function formatNumberWithCommas(v, decimals) {
  if (v === '' || v === null || v === undefined || !isFinite(v)) return '';
  const opts = decimals !== undefined
    ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    : { maximumFractionDigits: 6 };
  return Number(v).toLocaleString('en-US', opts);
}

// Comma-formatted number <input> for the small standalone row editors (Unit Mix,
// Survey per-building breakdown) that build their own fields outside renderField.
// Native <input type=number> can't display commas, so this is a text input that
// strips commas before calling onChange and reformats with commas on blur.
function makeNumberInput(value, onChange, opts) {
  opts = opts || {};
  const inp = el('input', { type: 'text' });
  inp.setAttribute('inputmode', opts.decimals ? 'decimal' : 'numeric');
  if (opts.min !== undefined) inp.min = opts.min;
  if (opts.step !== undefined) inp.step = opts.step;
  inp.value = formatNumberWithCommas(value, opts.decimals);
  const raw = () => inp.value.replace(/,/g, '');
  inp.addEventListener('input', () => onChange(raw() === '' ? '' : Number(raw())));
  inp.addEventListener('blur', () => {
    if (inp.value === '') return;
    const num = Number(raw());
    if (isFinite(num)) inp.value = formatNumberWithCommas(num, opts.decimals);
  });
  return inp;
}

function renderField(field, value, onChange) {
  // 'info' fields: italic gray summary text, no input.
  if (field.type === 'info') {
    const div = el('div', { class: 'field info-text' });
    div.setAttribute('data-key', field.key);
    div.textContent = '';
    return div;
  }
  // 'divider' fields: a horizontal rule that visually splits a section into
  // sub-groups (no input, no value). Used in Basics > Building & Site.
  if (field.type === 'divider') {
    const d = el('div', { class: 'field-divider' });
    if (field.key) d.setAttribute('data-key', field.key);
    return d;
  }
  // 'maps_link' fields: a Google Maps hyperlink built live from the address.
  // Hidden until refreshSection finds a non-empty address (see field.addr_expr).
  if (field.type === 'maps_link') {
    const div = el('div', { class: 'field maps-link-field', style: 'display:none' });
    div.setAttribute('data-key', field.key);
    div.appendChild(el('a', {
      class: 'maps-link', target: '_blank', rel: 'noopener noreferrer',
      style: 'display:inline-flex;align-items:center;gap:5px;color:var(--primary);font-weight:600;font-size:14px;text-decoration:underline;cursor:pointer'
    }, '🔗 ' + (field.label || 'View on Google Maps')));
    return div;
  }
  // 'multiselect' fields: checkbox group, value is an array of selected option strings.
  if (field.type === 'multiselect') {
    const wrap = el('div', { class: 'field' });
    wrap.appendChild(el('label', {}, field.label + (field.required ? ' *' : '')));
    if (field.hint) wrap.appendChild(el('div', { class: 'hint' }, field.hint));
    const container = el('div', { class: 'multiselect' });
    container.setAttribute('data-key', field.key);
    const selected = new Set(Array.isArray(value) ? value : []);
    getFieldOptions(field).forEach((opt) => {
      const cb = el('input', { type: 'checkbox' });
      if (selected.has(opt)) cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) selected.add(opt); else selected.delete(opt);
        onChange(Array.from(selected));
      });
      container.appendChild(el('label', { class: 'ms-option' }, cb, ' ' + opt));
    });
    wrap.appendChild(container);
    return wrap;
  }

  // 3-column inline layout (label | hint | box) is the DEFAULT for standard fields
  // so each sits on one line. Opt out with inline:false; row-grouped fields
  // (field.row) keep their shared multi-field .field-row layout instead.
  const useInline = field.inline !== false && !field.row;
  const wrap = el('div', { class: 'field' + (field.computed ? ' computed' : '') + (useInline ? ' inline' : '') });
  const labelEl = el('label', {}, field.label + (field.required ? ' *' : ''));
  // label_info: a small computed value shown right after the field name (kept live
  // by refreshSection). e.g. pervious % next to "Other Pervious Sqft".
  if (field.label_info) {
    const li = el('span', { class: 'label-info' });
    li.setAttribute('data-labelinfo', field.key);
    labelEl.appendChild(document.createTextNode(' '));
    labelEl.appendChild(li);
  }
  wrap.appendChild(labelEl);
  if (field.hint) wrap.appendChild(el('div', { class: 'hint' }, field.hint));

  let input;
  if (field.type === 'select') {
    input = el('select');
    input.appendChild(el('option', { value: '' }, '—'));
    getFieldOptions(field).forEach(opt => {
      const o = el('option', { value: opt }, opt);
      if (value === opt) o.selected = true;
      input.appendChild(o);
    });
  } else if (field.type === 'textarea') {
    input = el('textarea', { rows: 3 });
    if (field.maxlength) input.maxLength = field.maxlength;
    input.value = value || '';
  } else {
    // Number fields render as text inputs so the display can carry thousands
    // commas (a native <input type=number> rejects commas outright). The
    // underlying value is still a plain number — commas are stripped before
    // onChange and before any min/max/step bookkeeping.
    const isNumber = field.type === 'number';
    input = el('input', { type: isNumber ? 'text' : (field.type || 'text') });
    if (isNumber) input.setAttribute('inputmode', field.decimals ? 'decimal' : 'numeric');
    if (field.pattern) input.pattern = field.pattern;
    if (field.maxlength) input.maxLength = field.maxlength;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
    // Computed fields WITHOUT a partner are read-only (pure auto-calc).
    // Computed fields WITH a partner (e.g. land_sf <-> land_acres) remain editable.
    if (field.computed && !field.partner) input.readOnly = true;
    const initial = (isNumber && !field.nocomma) ? formatNumberWithCommas(value, field.decimals)
      : isNumber ? (value !== undefined && value !== null ? String(value) : '')   // nocomma: raw digits (e.g. Year Built 2024)
      : field.decimals !== undefined ? formatNumber(value, field.decimals) : (value !== undefined && value !== null ? value : '');
    input.value = initial;
  }

  const isNumberInput = field.type === 'number';
  const useCommas = isNumberInput && !field.nocomma;
  const rawValue = () => isNumberInput ? input.value.replace(/,/g, '') : input.value;
  input.addEventListener('input', () => onChange(rawValue()));
  input.addEventListener('change', () => onChange(rawValue()));
  if (useCommas) {
    input.addEventListener('blur', () => {
      if (input.value === '') return;
      const num = Number(rawValue());
      if (isFinite(num)) input.value = formatNumberWithCommas(num, field.decimals);
    });
  }
  wrap.appendChild(input);
  return wrap;
}

// Refresh all derived UI in a section (info text, computed fields, show_if visibility)
function refreshSection(sec, body, bag) {
  const eb = getEvalBag(bag);
  sec.fields.forEach(ff => {
    if (ff.type === 'info') {
      const node = body.querySelector(`[data-key="${ff.key}"]`);
      if (node) node.textContent = String(computeField(ff.expr, eb) ?? '');
    } else if (ff.type === 'maps_link') {
      const node = body.querySelector(`[data-key="${ff.key}"]`);
      const a = node && node.querySelector('a');
      if (node && a) {
        const addr = String(computeField(ff.addr_expr, eb) ?? '').trim();
        if (addr) {
          a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr);
          a.title = 'Open ' + addr + ' in Google Maps';
          node.style.display = '';
        } else {
          node.style.display = 'none';
        }
      }
    } else if (ff.computed) {
      const cv = computeField(ff.computed, eb);
      bag[ff.key] = cv;
      const inp = body.querySelector(`[data-key="${ff.key}"]`);
      if (inp) inp.value = ff.type === 'number' ? formatNumberWithCommas(cv, ff.decimals) : (isFinite(cv) ? cv : '');
    }
    // label_info: small computed text shown next to the field name.
    if (ff.label_info) {
      const li = body.querySelector(`[data-labelinfo="${ff.key}"]`);
      if (li) li.textContent = String(computeField(ff.label_info, eb) ?? '');
    }
    // Dynamic label: re-evaluate the field's label text from an expression.
    if (ff.dynamic_label) {
      const node = body.querySelector(`[data-key="${ff.key}"]`);
      const wrap = node && (node.closest ? node.closest('.field') : null);
      if (wrap) {
        const lbl = wrap.querySelector('label');
        if (lbl) lbl.textContent = String(computeField(ff.dynamic_label, eb) ?? ff.label);
      }
    }
    if (ff.show_if) {
      const node = body.querySelector(`[data-key="${ff.key}"]`);
      const wrap = node && (node.closest ? node.closest('.field') : null);
      // Fields inside an .expansion-group are governed by the group's visibility (handled below).
      const inGroup = wrap && wrap.closest && wrap.closest('.expansion-group');
      if (wrap && !inGroup) {
        const show = !!computeField(ff.show_if, eb);
        wrap.style.display = show ? '' : 'none';
      }
    }
  });
  // Expansion groups (consecutive same-show_if fields wrapped together)
  body.querySelectorAll('.expansion-group[data-show-if]').forEach(grp => {
    const show = !!computeField(grp.getAttribute('data-show-if'), eb);
    grp.style.display = show ? '' : 'none';
  });

  // Section status mark in the header (left of the chevron): green ✓ when complete,
  // red ✗ when not.
  const section = body.parentElement;
  const check = section && section.querySelector('.section-check');
  if (check) {
    const done = isSectionComplete(sec, bag);
    check.textContent = done ? '✓' : '✗';
    check.style.color = done ? '#16a34a' : '#dc2626';
    check.style.display = '';
  }
  updateBasicsTabCheck();
}

// A field "counts" toward completion if it's a real input (not info/divider/maps_link),
// isn't purely auto-derived (computed), and is currently relevant (show_if true or absent).
function isFieldFilled(f, bag) {
  if (f.type === 'info' || f.type === 'divider' || f.type === 'maps_link') return true;
  if (f.computed) return true;
  const v = bag[f.key];
  if (f.type === 'multiselect') return Array.isArray(v) && v.length > 0;
  return v !== '' && v !== null && v !== undefined;
}
// True only if the user has actually entered a value for this field (excludes
// info/divider/maps_link/computed, which carry no user input).
function fieldHasUserValue(f, bag) {
  if (f.type === 'info' || f.type === 'divider' || f.type === 'maps_link' || f.computed) return false;
  const v = bag[f.key];
  if (f.type === 'multiselect') return Array.isArray(v) && v.length > 0;
  return v !== '' && v !== null && v !== undefined;
}
function isSectionComplete(sec, bag) {
  const eb = getEvalBag(bag);
  // (1) every applicable *required* field must be filled...
  const requiredOk = sec.fields.every(f => {
    if (!f.required) return true;                              // optional fields never block the ✓ (Required? = N in Basics_Control.xlsx)
    if (f.show_if && !computeField(f.show_if, eb)) return true; // required but not currently shown -> doesn't block
    return isFieldFilled(f, bag);
  });
  if (!requiredOk) return false;
  // (2) ...and the user must have entered at least one currently-shown value, so
  // an untouched all-optional section (e.g. Electrical) does NOT show a false ✓.
  return sec.fields.some(f => {
    if (f.show_if && !computeField(f.show_if, eb)) return false; // ignore hidden fields
    return fieldHasUserValue(f, bag);
  });
}
function isBasicsAllComplete() {
  if (!STATE) return false;
  const p1ok = (SCHEMA.phase1 || []).every(sec => isSectionComplete(sec, STATE.phase1));
  const p2ok = (SCHEMA.phase2 || []).every(sec => isSectionComplete(sec, STATE.phase2));
  return p1ok && p2ok;
}
// Green checkmark on the "1. Basics" nav tab once every section on the tab is complete.
function updateBasicsTabCheck() {
  const tabBtn = document.querySelector('.tab[data-phase="1"]');
  if (!tabBtn) return;
  let mark = tabBtn.querySelector('.tab-check');
  if (STATE && isBasicsAllComplete()) {
    if (!mark) tabBtn.appendChild(el('span', { class: 'tab-check', style: 'color:#16a34a;margin-left:6px;font-weight:700' }, '✓'));
  } else if (mark) {
    mark.remove();
  }
}

// Pastel per-section color scheme for the Basics tab. Each section header gets a
// soft tint + a matching deeper left-border accent (text stays dark/readable).
const BASICS_SECTION_TINTS = [
  { bg: '#FDE2E4', bar: '#F2A1AD' }, // pink
  { bg: '#E3F0E5', bar: '#9FD2A8' }, // mint
  { bg: '#DCEBF7', bar: '#97C0E6' }, // sky
  { bg: '#FFF1E6', bar: '#F4BE86' }, // peach
  { bg: '#F1E7FB', bar: '#C4A3E8' }, // lavender
  { bg: '#E0F4F3', bar: '#97D6D2' }, // aqua
  { bg: '#FCEFD6', bar: '#EACB6E' }, // butter
  { bg: '#E7EDFF', bar: '#A6BCEF' }, // periwinkle
  { bg: '#EFE6F7', bar: '#C2A6DC' }, // mauve
  { bg: '#E9F5E0', bar: '#AFD993' }, // sage
  { bg: '#FBE4EC', bar: '#ECA3C0' }, // rose
  { bg: '#E6F2EC', bar: '#9ED2B6' }, // seafoam
];
let _basicsColorMap = null;
function basicsSectionColor(name) {
  if (!_basicsColorMap) {
    _basicsColorMap = {};
    const secs = [...(SCHEMA.phase1 || []), ...(SCHEMA.phase2 || [])];
    secs.forEach((s, i) => { _basicsColorMap[s.section] = BASICS_SECTION_TINTS[i % BASICS_SECTION_TINTS.length]; });
  }
  return _basicsColorMap[name] || null;
}

function renderSchemaForm(sections, bag, onUpdate) {
  const frag = document.createDocumentFragment();
  // Track every rendered {sec, body} so an edit can refresh derived UI in ALL
  // sections (cross-section computed like total_site_area_sf = land_sf, and
  // label_info that reads a field in another section).
  const rendered = [];
  sections.forEach((sec, si) => {
    // Default to collapsed; preserve user's explicit choice during the session.
    const collapsed = window['_collapsed_' + sec.section] !== false;
    const body = el('div', { class: 'section-body' });
    const tint = basicsSectionColor(sec.section);   // section pastel (also colors its dividers)

    let activeExpGroup = null;
    let activeExpExpr = null;
    // Row grouping: consecutive fields sharing the same `row` tag render side-by-side
    // in a flex .field-row (e.g. City / State / ZIP on one line).
    let activeRowGroup = null;
    let activeRowKey = null;
    const placeInBody = (node, f) => {
      if (f && f.row) {
        if (activeRowKey !== f.row) {
          activeRowGroup = el('div', { class: 'field-row' });
          activeRowGroup.setAttribute('data-row', f.row);
          body.appendChild(activeRowGroup);
          activeRowKey = f.row;
        }
        activeRowGroup.appendChild(node);
      } else {
        activeRowGroup = null; activeRowKey = null;
        body.appendChild(node);
      }
    };

    sec.fields.forEach(f => {
      let value;
      if (f.type === 'info') value = '';
      else if (f.computed) { value = computeField(f.computed, getEvalBag(bag)); bag[f.key] = value; }
      else value = bag[f.key];
      // pctOf1 fields are stored 0–1 (decimal) but shown/typed as whole percentage points.
      if (f.pctOf1 && value !== '' && value !== null && value !== undefined) value = Number(value) * 100;

      const handleChange = (v) => {
        bag[f.key] = (f.pctOf1) ? (v === '' ? '' : Number(v) / 100)
                   : (f.type === 'multiselect') ? (Array.isArray(v) ? v : [])
                   : (f.type === 'number') ? (v === '' ? '' : Number(v)) : v;
        if (f.partner && bag[f.key] !== '') {
          const pv = computeField(f.partner.expr, getEvalBag(bag));
          bag[f.partner.target] = pv;
          const pInp = body.querySelector(`[data-key="${f.partner.target}"]`);
          if (pInp) {
            const partnerField = sec.fields.find(x => x.key === f.partner.target);
            pInp.value = (partnerField && partnerField.type === 'number') ? formatNumberWithCommas(pv, partnerField.decimals) : (isFinite(pv) ? pv : '');
          }
        }
        rendered.forEach(rs => refreshSection(rs.sec, rs.body, bag));   // refresh ALL sections (cross-section deps)
        saveState();
        onUpdate && onUpdate();
      };
      const fieldNode = renderField(f, value, handleChange);
      if (f.type === 'divider' && tint) fieldNode.style.borderBottomColor = tint.bar;   // divider matches section color
      const inp = fieldNode.querySelector ? fieldNode.querySelector('input, select, textarea') : null;
      if (inp) inp.setAttribute('data-key', f.key);

      // "Per MF Unit" convenience toggle (field flag per_mf_unit): a checkbox that
      // fills this number field with the MF-unit count from the Unit Mix and locks
      // it. The checkbox state persists in the bag under <key>_permf.
      if (f.per_mf_unit && inp) {
        const permfKey = f.key + '_permf';
        const mfUnits = () => Number(STATE && STATE.phase1 && STATE.phase1.mf_units) || 0;
        const applyPerMf = () => {
          const n = mfUnits();
          inp.value = n ? formatNumberWithCommas(n) : '';
          inp.readOnly = true; inp.style.background = '#f3f4f6';
          handleChange(n ? String(n) : '');
        };
        const releasePerMf = () => { inp.readOnly = false; inp.style.background = ''; };
        const cb = el('input', { type: 'checkbox' });
        cb.checked = !!bag[permfKey];
        cb.addEventListener('change', () => {
          bag[permfKey] = cb.checked;
          if (cb.checked) applyPerMf(); else { releasePerMf(); saveState(); }
        });
        const cbWrap = el('label', {
          class: 'permf-toggle',
          style: 'display:flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;color:var(--muted);cursor:pointer'
        }, cb, ' Per MF Unit (auto-fill from Unit Mix)');
        fieldNode.appendChild(cbWrap);
        if (cb.checked) applyPerMf();
      }

      // Group consecutive same-show_if fields into an indented expansion-group container,
      // but ONLY when 2+ fields share the same show_if (single-field conditionals do not need a toggle).
      if (f.show_if) {
        // Look back + ahead: is this field part of a multi-field run with the same expression?
        const fi = sec.fields.indexOf(f);
        const prev = sec.fields[fi - 1];
        const next = sec.fields[fi + 1];
        const isPartOfMulti = (prev && prev.show_if === f.show_if) || (next && next.show_if === f.show_if);
        if (isPartOfMulti) {
          if (activeExpExpr !== f.show_if) {
            const groupKey = sec.section + '::' + f.show_if;
            const grpCollapsedKey = '_expCollapsed_' + groupKey;
            const startCollapsed = window[grpCollapsedKey] === true;
            const grp = el('div', { class: 'expansion-group' + (startCollapsed ? ' collapsed' : '') });
            grp.setAttribute('data-exp-key', groupKey);
            grp.setAttribute('data-show-if', f.show_if);
            const toggleBtn = el('button', { class: 'expansion-toggle', type: 'button', title: 'Collapse / expand' });
            toggleBtn.textContent = startCollapsed ? '▶' : '▼';
            toggleBtn.addEventListener('click', () => {
              const nowCollapsed = !grp.classList.contains('collapsed');
              grp.classList.toggle('collapsed', nowCollapsed);
              toggleBtn.textContent = nowCollapsed ? '▶' : '▼';
              window[grpCollapsedKey] = nowCollapsed;
            });
            grp.appendChild(toggleBtn);
            body.appendChild(grp);
            activeExpGroup = grp;
            activeExpExpr = f.show_if;
          }
          activeExpGroup.appendChild(fieldNode);
          activeRowGroup = null; activeRowKey = null;
        } else {
          // Single conditional field: render inline; refreshSection toggles its display.
          activeExpGroup = null;
          activeExpExpr = null;
          activeRowGroup = null; activeRowKey = null;
          body.appendChild(fieldNode);
        }
      } else {
        activeExpGroup = null;
        activeExpExpr = null;
        placeInBody(fieldNode, f);
      }
    });

    rendered.push({ sec, body });
    setTimeout(() => refreshSection(sec, body, bag), 0);

    const section = el('section', {
      class: 'section' + (collapsed ? ' collapsed' : ''),
      style: tint ? `border-left:4px solid ${tint.bar}` : ''
    },
      el('header', { class: 'section-header',
        style: tint ? `background:${tint.bg}` : '',
        onClick: (e) => {
          e.currentTarget.parentElement.classList.toggle('collapsed');
          window['_collapsed_' + sec.section] = e.currentTarget.parentElement.classList.contains('collapsed');
        }
      },
        el('span', {}, sec.section),
        el('span', { style: 'display:flex;align-items:center;gap:8px' },
          el('span', { class: 'section-check', style: 'color:#dc2626;font-weight:700' }, '✗'),
          el('span', { class: 'chev' }, '▼')
        )
      ),
      body
    );
    frag.appendChild(section);
  });
  return frag;
}

// Compact "Expand all / Collapse all" bar rendered at the top of Phases 1/2/3.
// Targets every `<section class="section">` inside #phase-content — schema
// sections, CAPEX group banners, sub-sections, Unit Mix, and the Survey
// Breakdown block. Unit-mix item rows, survey-building rows, and conditional
// .expansion-group toggles have their own UX and are intentionally left alone.
// Compact button style shared by the Expand/Collapse bar and the Basics-page
// Import/Export buttons so they line up at the same size on one row.
const BAR_BTN_STYLE = 'padding:6px 10px;font-size:12px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--primary);white-space:nowrap';
// Variant for buttons that sit ON the navy summary bar (Budget page Expand/
// Collapse): match the blue background, white font, thin white border.
const BAR_BTN_STYLE_ON_NAVY = 'padding:6px 10px;font-size:12px;font-weight:600;background:var(--primary);border:1px solid #fff;border-radius:6px;cursor:pointer;color:#fff;white-space:nowrap';
// One SHIR-navy box (matches the Budget page summary bar): optional left content
// (leftStat for a summary chip and/or leftItems for buttons) on the left, and the
// Expand/Collapse-all buttons on the right. All buttons use the on-navy style
// (navy bg, white text, thin white border) so they read as one master blue box.
// leftItems buttons should already carry BAR_BTN_STYLE_ON_NAVY.
function renderExpandCollapseBar(leftItems, leftStat) {
  const hasLeft = (Array.isArray(leftItems) && leftItems.length) || !!leftStat;
  const bar = el('div', {
    class: 'expand-collapse-bar',
    style: `display:flex;justify-content:${hasLeft ? 'space-between' : 'flex-end'};align-items:center;gap:10px;margin:0 0 12px;flex-wrap:wrap;background:var(--primary);color:#fff;padding:10px 12px;border-radius:8px`
  });
  if (hasLeft) {
    const left = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' });
    if (leftStat) left.appendChild(leftStat);
    if (Array.isArray(leftItems)) leftItems.forEach(b => left.appendChild(b));
    bar.appendChild(left);
  }
  const right = el('div', { style: 'display:flex;gap:6px' });
  right.appendChild(el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Expand all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section.collapsed')
        .forEach(s => s.classList.remove('collapsed'));
    },
  }, '▼ Expand all'));
  right.appendChild(el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Collapse all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section')
        .forEach(s => s.classList.add('collapsed'));
    },
  }, '▶ Collapse all'));
  bar.appendChild(right);
  return bar;
}

// Gather every currently-applicable Basics field (phase1 + phase2) that has no
// value, skipping non-input fields (info/divider/maps_link/computed) and fields
// hidden by an unmet show_if. Returns [{section, field, key, required, type}].
function collectEmptyBasicsFields() {
  const rows = [];
  const scan = (sections, bag) => {
    (sections || []).forEach(sec => {
      const eb = getEvalBag(bag);
      sec.fields.forEach(f => {
        if (f.type === 'info' || f.type === 'divider' || f.type === 'maps_link' || f.computed) return;
        if (f.show_if && !computeField(f.show_if, eb)) return;   // hidden -> not applicable
        const v = bag[f.key];
        const empty = (f.type === 'multiselect')
          ? !(Array.isArray(v) && v.length)
          : (v === '' || v === null || v === undefined);
        if (empty) rows.push({ section: sec.section, field: f.label || f.key, key: f.key, required: !!f.required, type: f.type || 'text' });
      });
    });
  };
  scan(SCHEMA.phase1, STATE.phase1);
  scan(SCHEMA.phase2, STATE.phase2);
  return rows;
}
// Friendly label for a field's input type (column D of the export).
const FIELD_TYPE_LABELS = { text: 'Text', textarea: 'Text (long)', number: 'Number', select: 'Dropdown', multiselect: 'Multi-select' };
// Export the empty/missing Basics fields as a formatted .xlsx: Required and
// Optional split into two blocks, frozen bold header, column widths 35/45/20/22,
// with the field type in column D.
async function exportEmptyBasicsFields() {
  const rows = collectEmptyBasicsFields();
  if (!rows.length) { toast('All applicable Basics fields are filled ✓', 'success'); return; }
  if (typeof ExcelJS === 'undefined') { toast('ExcelJS not loaded yet — try again', 'error'); return; }
  const req = rows.filter(r => r.required);
  const opt = rows.filter(r => !r.required);
  const typeLabel = (t) => FIELD_TYPE_LABELS[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Missing Basics Fields', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ width: 35 }, { width: 45 }, { width: 20 }, { width: 22 }];

  // Frozen, bold header row (SHIR navy).
  const hdr = ws.addRow(['Section', 'Field', 'Required?', 'Type']);
  hdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hdr.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D2D47' } };
    c.alignment = { vertical: 'middle' };
  });

  const addBlock = (title, list, reqLabel, titleFill) => {
    const t = ws.addRow([`${title} (${list.length})`]);
    ws.mergeCells(`A${t.number}:D${t.number}`);
    t.getCell(1).font = { bold: true };
    t.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleFill } };
    if (!list.length) {
      const e = ws.addRow(['(none)']);
      e.getCell(1).font = { italic: true, color: { argb: 'FF888888' } };
      return;
    }
    list.forEach(r => ws.addRow([r.section, r.field, reqLabel, typeLabel(r.type)]));
  };

  addBlock('REQUIRED — MISSING', req, 'Required', 'FFFCE4E4');   // pale red
  ws.addRow([]);                                                 // spacer between blocks
  addBlock('OPTIONAL — MISSING', opt, 'Optional', 'FFEAF0F6');   // pale blue-gray

  const buf = await wb.xlsx.writeBuffer();
  const propName = (STATE && STATE.phase1 && STATE.phase1.prop_name) || 'property';
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${propName.replace(/[^a-z0-9]+/gi, '_')}_Basics_Missing_${stamp}.xlsx`;
  const a = el('a', {});
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = filename;
  a.click();
  toast(`Exported ${rows.length} missing field${rows.length === 1 ? '' : 's'} (${req.length} required, ${opt.length} optional) → ${filename}`, 'success');
}

// ---------- Phase 1: Basics (identity + Physical characteristics folded in) ----------
function renderPhase1() {
  const root = el('div');
  // All Basics-page buttons live in one master SHIR-navy box: Import + Export on
  // the left, Expand/Collapse all on the right (all on-navy styled).
  const importBtn = el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Import Basics + Unit Mix from the deal proforma in GDrive',
    onClick: () => pullBasicsAndUnitsFromDrive(),
  }, '☁ Import Proforma Basics & Units');
  const exportBtn = el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Download the empty/missing Basics fields as an Excel file',
    onClick: () => exportEmptyBasicsFields(),
  }, '📋 Export Missing Fields');
  root.appendChild(renderExpandCollapseBar([importBtn, exportBtn]));
  root.appendChild(renderSchemaForm(SCHEMA.phase1, STATE.phase1));

  // Inject the Unit Mix block into the "Units" schema section (split out from the
  // former "Units & Area" on 2026-07-02) so the unit-by-unit breakdown lives next
  // to the count it feeds. Sums (mf_units) auto-populate the Units/Area inputs via
  // syncUnitMixSumsToPhase1. ("Units & Area" still matched for deploy-safety.)
  const sections = root.querySelectorAll('section.section');
  for (const sec of sections) {
    const hdr = sec.querySelector('.section-header span');
    const t = hdr ? hdr.textContent.trim() : '';
    if (t === 'Units' || t === 'Units & Area') {
      const body = sec.querySelector('.section-body');
      if (body) body.appendChild(renderUnitMix());
      break;
    }
  }

  // Inject the survey block (action buttons + per-building breakdown) at the
  // TOP of the "Building & Site" section body (merged 2026-06-19 with the former
  // "Survey Site Specs" section). The matcher also accepts the legacy survey
  // section name so an older cached schema still wires up during a deploy.
  let surveyHost = null;
  for (const sec of sections) {
    const hdr = sec.querySelector('.section-header span');
    const t = hdr ? hdr.textContent.trim() : '';
    if (/^building\s*&\s*site$/i.test(t) || /^survey([\s\-]*derived)?[\s\-]*site specs$/i.test(t)) {
      surveyHost = sec.querySelector('.section-body');
      break;
    }
  }
  if (surveyHost) surveyHost.insertBefore(renderSurveyBlock(), surveyHost.firstChild);
  else root.appendChild(renderSurveyBlock());   // fallback if the schema section is renamed
  // Physical characteristics questionnaire lives here too (collapsible sections).
  root.appendChild(el('div', { class: 'group-divider' }, 'Physical Characteristics'));
  root.appendChild(renderSchemaForm(SCHEMA.phase2, STATE.phase2));
  return root;
}

// ---------- Unit Mix (part of Physical; repeatable rows) ----------
const UNIT_STATUS = ['Original', 'Partial', 'Reno'];

function getUnitMix() {
  if (!Array.isArray(STATE.unitMix)) STATE.unitMix = [];
  return STATE.unitMix;
}
function addUnitRow(row) {
  getUnitMix().push(row || { type: '', count: '', beds: '', baths: '', sqft: '', status: '' });
  saveState();
}
function updateUnitRow(i, patch) {
  const m = getUnitMix();
  if (m[i]) {
    Object.assign(m[i], patch);
    syncUnitMixSumsToPhase1();   // refresh mf_units / mf_rsf / overall_rsf as user types
    saveState();
  }
}
function removeUnitRow(i) {
  getUnitMix().splice(i, 1);
  syncUnitMixSumsToPhase1();
  saveState();
}

// Sums from the unit mix populate the mf_units and mf_rsf fields in the
// "Units & Area" schema section, plus the computed overall_rsf. Triggered
// on every unit mix change (add/remove/edit/import). Empty rows are
// ignored so they do not clobber a user's manual entries.
function syncUnitMixSumsToPhase1() {
  if (!STATE || !STATE.phase1) return;
  const rows = getUnitMix();
  const totalUnits = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const totalRSF = rows.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.sqft) || 0), 0);
  if (totalUnits > 0) STATE.phase1.mf_units = totalUnits;
  if (totalRSF > 0)   STATE.phase1.mf_rsf   = totalRSF;
  // Reflect the new values in the visible inputs (no-op if Phase 1 is not on screen).
  const setVal = (key, val) => {
    const inp = document.querySelector(`[data-key="${key}"]`);
    if (inp) inp.value = val ? formatNumberWithCommas(val) : '';
  };
  if (totalUnits > 0) setVal('mf_units', totalUnits);
  if (totalRSF > 0)   setVal('mf_rsf', totalRSF);
  // overall_rsf is computed (mf_rsf + commercial_rsf + common_sf); recompute its display.
  const commRsf  = Number(STATE.phase1.commercial_rsf) || 0;
  const commonSf = Number(STATE.phase1.common_sf) || 0;
  const mfRsf    = Number(STATE.phase1.mf_rsf) || 0;
  const overall  = Math.round(mfRsf + commRsf + commonSf);
  const overallInp = document.querySelector('[data-key="overall_rsf"]');
  if (overallInp) overallInp.value = overall ? formatNumberWithCommas(overall) : '';

  // If the Details tab is open and shows Interior rows, recompute their qty and
  // refresh the inline status-totals header — unit-mix counts drive both.
  if (typeof refreshInteriorStatusHeader === 'function') {
    refreshInteriorStatusHeader();
    const counts = getUnitStatusCounts();
    document.querySelectorAll('.detail-item-interior').forEach(wrap => {
      const key = wrap.dataset.ckkey;
      if (!key) return;
      const [gi, si, ii] = key.split('.').map(Number);
      if ([gi, si, ii].some(isNaN)) return;
      recomputeInteriorRowQty(gi, si, ii, counts);
      const qtyInp = wrap.querySelector('[data-qty-input]');
      if (qtyInp) setNumVal(qtyInp, (Number(getP3(gi, si, ii).qty) || 0) || '');
      renderDetailTotals(wrap, gi, si, ii);
    });
    const summaryNode = document.querySelector('.summary-totals');
    if (summaryNode) updateDetailSummary(summaryNode);
  }
}

function renderUnitMix() {
  const section = el('section', { class: 'section' });
  section.appendChild(el('header', { class: 'section-header',
    onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
    el('span', {}, 'Unit Mix'),
    el('span', { class: 'chev' }, '▼')
  ));
  const body = el('div', { class: 'section-body' });
  section.appendChild(body);

  function rebuild() {
    body.innerHTML = '';
    const rows = getUnitMix();
    syncUnitMixSumsToPhase1();   // keep Units & Area totals current on every rebuild

    const totalUnits = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
    const totalSF = rows.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.sqft) || 0), 0);
    body.appendChild(el('div', { class: 'muted small', style: 'padding:0 16px 8px' },
      rows.length
        ? `${rows.length} unit type${rows.length === 1 ? '' : 's'}`
            + (totalUnits ? ` · ${totalUnits.toLocaleString()} total units` : '')
            + (totalSF ? ` · ${totalSF.toLocaleString()} total sf` : '')
        : 'No unit types yet — add one below or import from the proforma.'));

    // Property-wide, count-weighted averages — these drive the Avg Sqft / Avg # BRs /
    // Avg # BAs sizing Qty Types on the Interior Details rows.
    const avgs = getUnitMixAverages();
    if (!avgs.empty) {
      body.appendChild(el('div', { class: 'small', style: 'padding:0 16px 10px;color:#1d2d47;font-weight:600' },
        `Avg / unit — ${Math.round(avgs.avgSqft).toLocaleString()} sqft · `
          + `${avgs.avgBeds.toFixed(1)} BR · ${avgs.avgBaths.toFixed(1)} BA`));
    }

    const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls', style: 'display:none' });
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) importProformaUnitMix(f, rebuild);
      e.target.value = '';
    });
    // All four buttons on a single line above the unit list.
    // `nowrap` keeps them in a row even on narrow screens; small font + tight padding
    // lets them all fit on a phone.
    const actions = el('div', { style: 'padding:8px 16px;display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto' },
      el('button', { class: 'um-btn', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => { addUnitRow(); rebuild(); } }, '+ Type'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => pullProformaFromDrive(rebuild) }, '☁ Import > GDrive'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => fileInput.click() }, '⬆ Upload XLS'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => exportUnitMixXlsx() }, '⬇ Export XLS'),
      fileInput
    );
    body.appendChild(actions);

    rows.forEach((r, i) => body.appendChild(renderUnitRow(r, i, rebuild)));

    // Guidance for proforma extraction.
    body.appendChild(el('div', { class: 'um-note' },
      el('strong', {}, 'Importing the unit mix: '),
      el('strong', {}, '☁ Import > GDrive'),
      ' finds the latest “Full AI UW” (or “Init UW” fallback) in the 2. UW-Analysis folder (you confirm it first), or use ',
      el('strong', {}, '⬆ Upload'),
      ' to pick a file manually. Either way it reads the ',
      el('strong', {}, 'RR (rent roll) tab'),
      ' — the per-unit rows beneath the “Unit Type Name” header — and rolls them up by unit type + status ' +
      '(Original / Partial / Reno), filling in beds, baths, average SqFt, and the unit count for each. ',
      el('em', {}, 'It overwrites the rows above.')
    ));
    return body;
  }
  rebuild();
  return section;
}

// Each unit type is a single-line row: Type, # Units, Beds, Baths, SqFt, Status, ✕.
// No collapse/expand — all 6 fields are always visible and directly editable.
function renderUnitRow(r, i, rebuild) {
  const wrap = el('div', { class: 'unit-row-flat' });

  const fieldWrap = (label, input, extraClass) => el('div', { class: 'field' + (extraClass ? ' ' + extraClass : '') },
    el('label', {}, label), input);

  const typeInput = el('input', { type: 'text', placeholder: 'Unit type (e.g. 1BR / 1BA – Plan A)' });
  typeInput.value = r.type || '';
  typeInput.addEventListener('input', () => updateUnitRow(i, { type: typeInput.value }));
  wrap.appendChild(fieldWrap('Type', typeInput, 'field-type'));

  const numField = (label, key) => fieldWrap(label,
    makeNumberInput(r[key], (v) => { updateUnitRow(i, { [key]: v }); r[key] = v; }, { min: 0 }),
    'field-num');
  wrap.appendChild(numField('# Units', 'count'));
  wrap.appendChild(numField('Beds', 'beds'));
  wrap.appendChild(numField('Baths', 'baths'));
  wrap.appendChild(numField('SqFt', 'sqft'));

  const statusSel = el('select');
  statusSel.appendChild(el('option', { value: '' }, '—'));
  UNIT_STATUS.forEach(o => {
    const op = el('option', { value: o }, o);
    if (r.status === o) op.selected = true;
    statusSel.appendChild(op);
  });
  statusSel.addEventListener('change', () => updateUnitRow(i, { status: statusSel.value }));
  wrap.appendChild(fieldWrap('Status', statusSel, 'field-status'));

  wrap.appendChild(el('button', { class: 'unit-remove', title: 'Remove unit type',
    onClick: () => { removeUnitRow(i); rebuild(); } }, '✕'));

  return wrap;
}

// ---------- Survey site specs (Per-building breakdown + Import / Process) ----------
// The flat survey fields (perimeter, parking lot SF, roof/facade totals, fencing notes,
// landscaping_sf, etc.) are part of phase1[Survey Site Specs] and render as a
// regular schema section BELOW this block (injected at the top of that section's
// body by renderPhase1). This block adds:
//   - the repeatable per-building list (label/footprint/stories/height/pitch/roof_sf/facade_sf)
//   - the 📥 Import Survey and 🛰 Process Survey buttons
//   - a small status line showing when the survey was last processed
// All non-flat data (per-building, per-tract, meta) is stored on STATE.survey.
function ensureSurveyState() {
  if (!STATE.survey) {
    STATE.survey = {
      processed_at: null, source_pdf: '', scale_paper: '', ft_per_pixel: null,
      buildings: [], tracts: [], google_maps_notes: '', discrepancies: [],
    };
  }
  if (!Array.isArray(STATE.survey.buildings)) STATE.survey.buildings = [];
  if (!Array.isArray(STATE.survey.tracts)) STATE.survey.tracts = [];
  if (!Array.isArray(STATE.survey.discrepancies)) STATE.survey.discrepancies = [];
  return STATE.survey;
}
function addSurveyBuilding(row) {
  ensureSurveyState().buildings.push(row || {
    label: '', footprint_sf: '', stories: '', height_ft: '', roof_pitch: '',
    roof_sf: '', facade_sf: '',
  });
  saveState();
}
function updateSurveyBuilding(i, patch) {
  const arr = ensureSurveyState().buildings;
  if (arr[i]) { Object.assign(arr[i], patch); saveState(); }
}
function removeSurveyBuilding(i) {
  ensureSurveyState().buildings.splice(i, 1);
  saveState();
}

function renderSurveyBlock() {
  ensureSurveyState();
  // Plain block injected at the TOP of the "Survey Site Specs" schema section
  // body: action buttons first, then summary/meta, then the per-building rows.
  // The flat schema fields follow below this block.
  const body = el('div', { class: 'survey-block', style: 'border-bottom:1px solid var(--border, #e5e7eb);margin-bottom:10px;padding-bottom:6px' });

  function rebuild() {
    body.innerHTML = '';
    const s = ensureSurveyState();
    const blds = s.buildings;

    // Action buttons row at the very top — same nowrap-scroll pattern as Unit Mix.
    const fileInput = el('input', { type: 'file', accept: '.xlsx,.xls', style: 'display:none' });
    fileInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (f) importSurveyFromFile(f, rebuild);
      e.target.value = '';
    });
    const actions = el('div', { style: 'padding:8px 16px;display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto' },
      el('button', { class: 'um-btn', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => { addSurveyBuilding(); rebuild(); } }, '+ Building'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => importSurveyFromDrive(rebuild) }, '📥 Import Survey'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => fileInput.click() }, '⬆ Upload XLSX'),
      el('button', { class: 'um-btn secondary', style: 'white-space:nowrap;font-size:13px;padding:8px 10px',
        onClick: () => processSurveyWithClaude(rebuild) }, '🛰 Process Survey'),
      fileInput
    );

    // Survey status chips, inline with the action buttons: does a survey PDF
    // exist in the deal folder, and does a processed SurveyBreakdownSpecs
    // workbook exist in 7. Title_Survey/? Checked via Drive (cached
    // per property); click the chips to re-check.
    const chipStyle = (on) =>
      'white-space:nowrap;font-size:12px;font-weight:600;padding:5px 10px;border-radius:999px;align-self:center;cursor:pointer;' +
      (on ? 'background:#dcfce7;color:#166534' : 'background:#f1f5f9;color:#64748b');
    const statusHolder = el('span', { style: 'display:flex;gap:6px;align-items:center;margin-left:auto', title: 'Survey status — click to re-check Drive' });
    actions.appendChild(statusHolder);
    const renderChips = (st) => {
      statusHolder.innerHTML = '';
      if (st === undefined) {
        statusHolder.appendChild(el('span', { style: chipStyle(false) }, '⏳ survey status…'));
        return;
      }
      if (st === null) {
        statusHolder.appendChild(el('span', { style: chipStyle(false), title: 'Connect Drive and link a deal folder to check survey status' }, '🔗 link Drive to check'));
        return;
      }
      statusHolder.appendChild(el('span', {
        style: chipStyle(!!st.pdf),
        title: st.pdf ? `Survey PDF on file: ${st.pdf.name}` : 'No survey PDF found in 7. Title_Survey or 1. Offering Materials',
      }, st.pdf ? '📄 survey ✓' : '📄 no survey'));
      statusHolder.appendChild(el('span', {
        style: chipStyle(!!st.report),
        title: st.report ? `Breakdown workbook on file: ${st.report.name}` : 'No SurveyBreakdownSpecs workbook in 7. Title_Survey — run 🛰 Process Survey',
      }, st.report ? '📐 processed ✓' : '📐 not processed'));
    };
    const loadChips = (force) => {
      if (!STATE.drive.folderId || !getDriveToken()) { renderChips(null); return; }
      renderChips(undefined);
      getSurveyFileStatus(force).then(st => { if (statusHolder.isConnected) renderChips(st); })
        .catch(() => { if (statusHolder.isConnected) renderChips(null); });
    };
    statusHolder.addEventListener('click', () => loadChips(true));
    loadChips(false);

    body.appendChild(actions);

    // Summary / meta line
    const totalFp = blds.reduce((a, b) => a + (Number(b.footprint_sf) || 0), 0);
    const totalRoof = blds.reduce((a, b) => a + (Number(b.roof_sf) || 0), 0);
    const totalFac = blds.reduce((a, b) => a + (Number(b.facade_sf) || 0), 0);
    const summaryBits = [];
    if (blds.length) {
      summaryBits.push(`${blds.length} building${blds.length === 1 ? '' : 's'}`);
      if (totalFp) summaryBits.push(`${totalFp.toLocaleString()} sf footprint`);
      if (totalRoof) summaryBits.push(`${totalRoof.toLocaleString()} sf roof`);
      if (totalFac) summaryBits.push(`${totalFac.toLocaleString()} sf facade`);
    }
    const metaLine = s.processed_at
      ? `Last processed: ${new Date(s.processed_at).toLocaleString()}` +
        (s.source_pdf ? ` · from ${s.source_pdf.split(/[\\/]/).pop()}` : '')
      : 'No survey processed yet.';
    body.appendChild(el('div', { class: 'muted small', style: 'padding:0 16px 4px' },
      summaryBits.length ? summaryBits.join(' · ') : 'No buildings logged.'));
    body.appendChild(el('div', { class: 'muted small', style: 'padding:0 16px 8px;font-style:italic' }, metaLine));

    blds.forEach((b, i) => body.appendChild(renderSurveyBuildingRow(b, i, rebuild)));

    // Collapsible one-line "Instructions" (collapsed by default).
    const instr = el('details', {
      style: 'margin:8px 16px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;overflow:hidden'
    });
    instr.appendChild(el('summary', {
      style: 'padding:7px 10px;cursor:pointer;font-size:12px;font-weight:600;color:#475569;user-select:none'
    }, 'ⓘ Instructions'));
    instr.appendChild(el('div', { style: 'padding:2px 10px 10px;font-size:12px;color:#475569;line-height:1.45' },
      el('strong', {}, 'Populating these fields: '),
      'click ', el('strong', {}, '📥 Import Survey'), ' to load the latest ',
      el('em', {}, '*_SurveyBreakdownSpecs_*.xlsx'),
      ' from the deal folder: ', el('em', {}, '7. Title_Survey/'),
      ' folder, or ', el('strong', {}, '⬆ Upload XLSX'),
      ' to pick a file manually. Each import overwrites the flat fields below ',
      '(perimeter, parking lot SF, roof/facade totals, fencing notes, landscaping SF) ',
      'and replaces the buildings list with the Site-Total values from the workbook.'
    ));
    body.appendChild(instr);
    return body;
  }
  rebuild();
  return body;
}

function renderSurveyBuildingRow(b, i, rebuild) {
  const wrap = el('div', { class: 'unit-row' });
  wrap.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;margin:6px 16px;background:#fff;overflow:hidden';

  const summaryBar = el('div', {
    style: 'display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;user-select:none;background:#f8fafc',
    onClick: () => {
      const isOpen = wrap.classList.toggle('expanded');
      details.style.display = isOpen ? 'block' : 'none';
      chev.textContent = isOpen ? '▼' : '▶';
    },
  });
  const chev = el('span', { style: 'color:#64748b;font-size:11px;width:12px' }, '▶');
  const nameSpan = el('span', { style: 'flex:1;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' },
    b.label || `(Building ${i + 1})`);
  const metaText = (bb) => {
    const bits = [];
    if (bb.footprint_sf) bits.push(`${Number(bb.footprint_sf).toLocaleString()} sf fp`);
    if (bb.stories) bits.push(`${bb.stories} story`);
    if (bb.roof_pitch) bits.push(`${bb.roof_pitch} pitch`);
    return bits.join(' · ');
  };
  const metaSpan = el('span', { style: 'color:#64748b;font-size:13px;white-space:nowrap' }, metaText(b));
  summaryBar.appendChild(chev); summaryBar.appendChild(nameSpan); summaryBar.appendChild(metaSpan);
  wrap.appendChild(summaryBar);

  const details = el('div', { style: 'display:none;padding:10px 12px;border-top:1px solid #e5e7eb' });
  wrap.appendChild(details);

  const labelInput = el('input', { type: 'text', placeholder: 'Building label (e.g. "Hotel — North wing")' });
  labelInput.value = b.label || '';
  labelInput.addEventListener('input', () => {
    updateSurveyBuilding(i, { label: labelInput.value });
    nameSpan.textContent = labelInput.value || `(Building ${i + 1})`;
  });
  details.appendChild(el('div', { class: 'unit-row-top' },
    labelInput,
    el('button', { class: 'unit-remove', title: 'Remove building',
      onClick: (e) => { e.stopPropagation(); removeSurveyBuilding(i); rebuild(); } }, '✕')
  ));

  const updateMeta = () => { metaSpan.textContent = metaText(b); };
  const numField = (label, key, step) => el('div', { class: 'field' },
    el('label', {}, label),
    makeNumberInput(b[key], (v) => { updateSurveyBuilding(i, { [key]: v }); b[key] = v; updateMeta(); }, { min: 0, step })
  );
  const textField = (label, key, placeholder) => el('div', { class: 'field' },
    el('label', {}, label),
    (() => {
      const inp = el('input', { type: 'text', placeholder: placeholder || '' });
      inp.value = b[key] ?? '';
      inp.addEventListener('input', () => {
        updateSurveyBuilding(i, { [key]: inp.value });
        b[key] = inp.value;
        updateMeta();
      });
      return inp;
    })()
  );

  details.appendChild(el('div', { class: 'unit-grid' },
    numField('Footprint SF', 'footprint_sf'),
    numField('Stories', 'stories'),
    numField('Height (ft)', 'height_ft'),
    textField('Roof Pitch', 'roof_pitch', 'e.g. 4:12'),
    numField('Roof SF (pitch-adj)', 'roof_sf'),
    numField('Facade SF', 'facade_sf')
  ));
  return wrap;
}

// ---------- Survey: Excel parser ----------
// Parses a SHIR survey-breakdown-specs export workbook (the one written by
// survey-breakdown-specs_export-v1.py). Returns {flat, buildings, meta, notes,
// discrepancies}. Strategy: title rows 1-2 carry meta; row 4 is the header row;
// row 5+ are data. Site Total is always the LAST column. Per-building rows
// follow items 7/8/9 and are indented with 4 leading spaces.
function _surveyNum(v) {
  if (v === '' || v == null) return '';
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : '';
}
function _surveyStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function parseSurveyXlsx(wb) {
  // Find the right sheet — the export names it "Survey Breakdown Specs".
  let sheetName = wb.SheetNames.find(n => /survey/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('No worksheet found');
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
  if (!rows.length) throw new Error('Empty worksheet');

  // ---- Meta (title + subtitle) -----
  const titleStr = _surveyStr(rows[0] && rows[0][0]);
  // "<Property>  —  Survey Breakdown Specs  —  YYYY-MM-DD"
  const titleMatch = titleStr.match(/^(.*?)\s+[—-]+\s+Survey\s+(Breakdown|Layout)\s+Specs\s+[—-]+\s+(\d{4}-\d{2}-\d{2})/i);
  const meta = {
    property_name: titleMatch ? titleMatch[1].trim() : '',
    survey_date: titleMatch ? titleMatch[3] : '',
    address: '', scale_paper: '', ft_per_pixel: null,
  };
  const subStr = _surveyStr(rows[1] && rows[1][0]);
  // "<address>    |    Paper scale: X    |    ft/pixel: Y"
  if (subStr) {
    const parts = subStr.split(/\s*\|\s*/);
    meta.address = parts[0] || '';
    const scaleP = parts.find(p => /paper scale/i.test(p));
    if (scaleP) meta.scale_paper = scaleP.replace(/.*paper scale\s*:\s*/i, '').trim();
    const fpp = parts.find(p => /ft\s*\/\s*pixel/i.test(p));
    if (fpp) meta.ft_per_pixel = parseFloat(fpp.replace(/.*ft\s*\/\s*pixel\s*:\s*/i, '')) || null;
  }

  // ---- Locate header row (row labeled "Item" in col A) ----
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    if (_surveyStr(rows[i] && rows[i][0]).toLowerCase() === 'item') { headerIdx = i; break; }
  }
  if (headerIdx < 0) throw new Error('Could not find header row');
  const headers = rows[headerIdx];
  // The last column that contains "Site Total" — fall back to the last non-null column.
  let siteTotalCol = headers.length - 1;
  for (let c = headers.length - 1; c >= 2; c--) {
    if (/site\s*total/i.test(_surveyStr(headers[c]))) { siteTotalCol = c; break; }
  }
  // Tract columns are C..(siteTotalCol-1). First tract col is C (index 2).
  const tractCols = [];
  for (let c = 2; c < siteTotalCol; c++) {
    const h = _surveyStr(headers[c]);
    if (h) tractCols.push({ col: c, label: h.replace(/\n.*$/s, '').trim(), is_easement: /easement/i.test(h) });
  }

  const flat = {};
  const buildings = [];
  let currentSection = null;   // '7' | '8' | '9' — which item we are inside
  let bldIdx = 0;
  const notes = [];
  const discrepancies = [];
  let inNotes = false, inDiscrepancies = false;

  const ensureBldAtIdx = (i) => {
    while (buildings.length <= i) buildings.push({
      label: '', footprint_sf: '', stories: '', height_ft: '',
      roof_pitch: '', roof_sf: '', facade_sf: '',
    });
    return buildings[i];
  };
  // Extract "(N Story, Ht X.X')" → {stories, height_ft}; strip from label.
  const extractStoryHeight = (label) => {
    const m = label.match(/\((\d+)\s*Story(?:[, ]+Ht\s*([\d.]+)\s*['′]?)?\)/i);
    if (!m) return { stories: '', height_ft: '', cleanLabel: label };
    return {
      stories: Number(m[1]),
      height_ft: m[2] ? Number(m[2]) : '',
      cleanLabel: label.replace(m[0], '').trim(),
    };
  };

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const labelRaw = _surveyStr(row[0]);
    if (!labelRaw && !row.some(c => c != null && c !== '')) continue; // skip blank
    const siteVal = row[siteTotalCol];
    const isIndented = /^\s{2,}/.test(String(row[0] || ''));

    // ---- Footer detection ----
    if (/^google maps cross-reference notes$/i.test(labelRaw)) { inNotes = true; inDiscrepancies = false; continue; }
    if (/^discrepancies/i.test(labelRaw)) { inNotes = false; inDiscrepancies = true; continue; }
    if (inNotes) { if (labelRaw && labelRaw !== '—') notes.push(labelRaw); continue; }
    if (inDiscrepancies) {
      if (labelRaw && labelRaw !== '—') discrepancies.push(labelRaw.replace(/^•\s*/, ''));
      continue;
    }

    // ---- Section heading rows (set currentSection) ----
    if (/^1\.\s*Parking\s*[—-]+\s*Regular/i.test(labelRaw)) { flat.parking_regular = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^1\.\s*Parking\s*[—-]+\s*Handicapped/i.test(labelRaw)) { flat.parking_spots_hc = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^1\.\s*Parking\s*[—-]+\s*Total/i.test(labelRaw)) { flat.parking_spots_existing = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^2\.\s*Land\s*area\s*\(SF\)/i.test(labelRaw)) { flat.land_sf = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^2\.\s*Land\s*area\s*\(acres\)/i.test(labelRaw)) { flat.land_acres = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^3\.\s*Perimeter\s*[—-]+\s*TOTAL/i.test(labelRaw)) { flat.site_perimeter_lf = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^4\.\s*Fencing/i.test(labelRaw)) {
      // Fencing/gates have free-text per-tract; take the first non-"n/a" cell.
      const txts = tractCols.map(t => _surveyStr(row[t.col])).filter(s => s && s.toLowerCase() !== 'n/a');
      flat.fencing_notes = txts.length ? txts.join(' / ') : 'n/a';
      currentSection = null; continue;
    }
    if (/^4\.\s*Gates/i.test(labelRaw)) {
      const txts = tractCols.map(t => _surveyStr(row[t.col])).filter(s => s && s.toLowerCase() !== 'n/a');
      flat.gates_notes = txts.length ? txts.join(' / ') : 'n/a';
      currentSection = null; continue;
    }
    if (/^5\.\s*Parking\s*lot\s*SF/i.test(labelRaw)) { flat.parking_lot_sf = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^6\.\s*Building\s*count/i.test(labelRaw)) { flat.num_buildings = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^7\.\s*Building\s*footprint/i.test(labelRaw)) { flat.total_footprint_sf = _surveyNum(siteVal); currentSection = '7'; bldIdx = 0; continue; }
    if (/^8\.\s*Roof\s*SF/i.test(labelRaw)) { flat.total_roof_sf = _surveyNum(siteVal); currentSection = '8'; bldIdx = 0; continue; }
    if (/^9\.\s*Facade\s*SF/i.test(labelRaw)) { flat.total_facade_sf = _surveyNum(siteVal); currentSection = '9'; bldIdx = 0; continue; }
    if (/^10\.\s*Landscaping/i.test(labelRaw)) { flat.landscaping_sf = _surveyNum(siteVal); currentSection = null; continue; }
    if (/^\s*as\s*%\s*of\s*tract/i.test(labelRaw)) { currentSection = null; continue; }
    if (/^3\.\s*Perimeter\s*[—-]+\s*per side/i.test(labelRaw)) { currentSection = null; continue; }

    // ---- Indented sub-rows under sections 7/8/9 ----
    if (isIndented && currentSection) {
      const trimmed = labelRaw.trim();
      if (currentSection === '7') {
        const info = extractStoryHeight(trimmed);
        const b = ensureBldAtIdx(bldIdx);
        b.label = info.cleanLabel || trimmed;
        if (info.stories !== '') b.stories = info.stories;
        if (info.height_ft !== '') b.height_ft = info.height_ft;
        b.footprint_sf = _surveyNum(siteVal);
        bldIdx++;
      } else if (currentSection === '8') {
        // "Roof — <name>  (pitch X:Y (...))"
        const pitchM = trimmed.match(/\(\s*pitch\s+([^)]+?)(?:\s*\(.*\))?\s*\)/i);
        const b = ensureBldAtIdx(bldIdx);
        if (pitchM) b.roof_pitch = pitchM[1].trim().replace(/\s*\(assumed\).*$/i, '').trim();
        b.roof_sf = _surveyNum(siteVal);
        bldIdx++;
      } else if (currentSection === '9') {
        const b = ensureBldAtIdx(bldIdx);
        b.facade_sf = _surveyNum(siteVal);
        bldIdx++;
      }
    }
  }

  return { flat, buildings, meta, notes: notes.join('\n'), discrepancies };
}

// Apply parsed survey data to STATE.phase1 (flat fields) and STATE.survey
// (per-building + meta). Overwrites existing values. Returns a summary string.
function applySurveyParsedData(parsed, sourcePdf) {
  ensureSurveyState();
  const flatKeys = [
    'parking_spots_hc', 'parking_spots_existing', 'land_sf', 'land_acres',
    'site_perimeter_lf', 'parking_lot_sf', 'num_buildings', 'total_footprint_sf',
    'total_roof_sf', 'total_facade_sf', 'landscaping_sf',
    'fencing_notes', 'gates_notes',
  ];
  let filled = 0;
  for (const k of flatKeys) {
    const v = parsed.flat[k];
    if (v !== undefined && v !== '' && v !== null) {
      STATE.phase1[k] = v;
      filled++;
    }
  }
  STATE.survey.buildings = parsed.buildings || [];
  STATE.survey.processed_at = new Date().toISOString();
  STATE.survey.source_pdf = sourcePdf || (parsed.meta && parsed.meta.address) || '';
  STATE.survey.scale_paper = parsed.meta && parsed.meta.scale_paper || '';
  STATE.survey.ft_per_pixel = parsed.meta && parsed.meta.ft_per_pixel || null;
  STATE.survey.google_maps_notes = parsed.notes || '';
  STATE.survey.discrepancies = parsed.discrepancies || [];
  saveState();
  return `${filled} field${filled === 1 ? '' : 's'} + ${(parsed.buildings || []).length} building${(parsed.buildings || []).length === 1 ? '' : 's'}`;
}

// Import a survey workbook from a local file (Upload XLSX button).
async function importSurveyFromFile(file, rebuild) {
  try {
    toast('Reading survey workbook…');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const parsed = parseSurveyXlsx(wb);
    const summary = applySurveyParsedData(parsed, file.name);
    if (rebuild) rebuild();
    renderShell();   // refresh the whole form so flat fields show new values
    toast(`Survey imported — ${summary}`, 'success');
  } catch (e) {
    toast('Survey import failed: ' + e.message, 'error');
  }
}

// Find and import the latest *_SurveyBreakdownSpecs_*.xlsx from this deal
// 7. Title_Survey/ folder (with legacy SurveyLayoutSpecs fallback).
async function importSurveyFromDrive(rebuild) {
  if (!STATE) return;
  if (!STATE.drive.folderId) { toast('Link this property to a Drive deal folder first (☰ → Find/Link).', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { toast('Connect Google Drive first', 'error'); return; }
  try {
    toast('Searching for survey report in Drive…');
    // Locate matching workbooks in 7. Title_Survey/ (newest first).
    const matches = await _listSurveyReportCandidates();
    if (!matches.length) { toast('No SurveyBreakdownSpecs workbook found in 7. Title_Survey/ — run 🛰 Process Survey or the skill first.', 'error'); return; }
    const dateOf = (name) => {
      const m = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : '';
    };
    // Confirm pick (with next-best walk, same UX as proforma import).
    const fmtD = (iso) => iso ? new Date(iso).toLocaleString() : 'unknown';
    let chosen = null;
    for (let idx = 0; idx < matches.length; idx++) {
      const cand = matches[idx];
      const remaining = matches.length - idx - 1;
      const tail = remaining > 0
        ? `\n\n[OK = use this · Cancel = see next best (${remaining} more)]`
        : `\n\n[OK = use this · Cancel = abort]`;
      const ok = confirm(
        `Import survey breakdown from this workbook?\n\n` +
        `📄 ${cand.name}\n` +
        `Survey date: ${dateOf(cand.name) || '(none in filename)'}\n` +
        `Modified: ${fmtD(cand.modifiedTime)}` + tail
      );
      if (ok) { chosen = cand; break; }
      if (remaining === 0) return;
    }
    if (!chosen) return;
    // 6) Download + parse + apply.
    toast('Downloading…');
    const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${chosen.id}?alt=media`);
    const buf = await r.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const parsed = parseSurveyXlsx(wb);
    const summary = applySurveyParsedData(parsed, chosen.name);
    if (rebuild) rebuild();
    renderShell();
    toast(`Survey imported from ${chosen.name} — ${summary}`, 'success');
  } catch (e) {
    toast('Survey import failed: ' + e.message, 'error');
  }
}

// ---------- Process Survey with Claude AI ----------
// Searches the deal folder for a survey PDF, downloads it, sends it to the
// Anthropic API as a base64 document block, and applies the parsed results via
// applySurveyParsedData(). Requires an Anthropic API key stored in localStorage.
// Uses anthropic-dangerous-direct-browser-access:true to allow direct browser calls.

// List survey-PDF candidates in the deal folder, best first (no user prompts).
// Checks 7. Title_Survey (priority 5) and 1. Offering Materials (priority 0)
// with one level of subfolder recursion. ALTA files score +10.
async function _listSurveyPdfCandidates() {
  if (!STATE || !STATE.drive.folderId) return [];
  const topSubs = await listSubfolders(STATE.drive.folderId);

  const candidates = [];
  const scoredFile = (f, base) => ({
    ...f,
    _priority: base + (/alta/i.test(f.name) ? 10 : 0),
  });

  async function scanFolder(folderId, basePriority) {
    const files = await driveListFilesInFolder(folderId);
    for (const f of files) {
      if (/\.pdf$/i.test(f.name) && /survey|alta/i.test(f.name)) {
        candidates.push(scoredFile(f, basePriority));
      }
    }
    const subs = await listSubfolders(folderId);
    for (const sf of subs) {
      const sfFiles = await driveListFilesInFolder(sf.id);
      for (const f of sfFiles) {
        if (/\.pdf$/i.test(f.name) && /survey|alta/i.test(f.name)) {
          candidates.push(scoredFile(f, basePriority));
        }
      }
    }
  }

  const ts = topSubs.find(f => /^\s*7\.?\s*title[\s_\-]*survey/i.test(f.name))
          || topSubs.find(f => /title[\s_\-]*survey/i.test(f.name));
  const om = topSubs.find(f => /^\s*1\.?\s*offering/i.test(f.name))
          || topSubs.find(f => /offering\s*materials?/i.test(f.name));

  if (ts) await scanFolder(ts.id, 5);
  if (om) await scanFolder(om.id, 0);

  candidates.sort((a, b) =>
    b._priority !== a._priority
      ? b._priority - a._priority
      : (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
  );
  return candidates;
}

// List *_SurveyBreakdownSpecs_*.xlsx candidates in 7. Title_Survey/, newest
// first by filename date then modifiedTime (no user prompts).
async function _listSurveyReportCandidates() {
  if (!STATE || !STATE.drive.folderId) return [];
  const subs = await listSubfolders(STATE.drive.folderId);
  const ts = subs.find(f => /^\s*7\.?\s*title[\s_\-]*survey/i.test(f.name))
          || subs.find(f => /title[\s_\-]*survey/i.test(f.name));
  if (!ts) return [];
  const files = await driveListFilesInFolder(ts.id);
  const matches = files.filter(f =>
    /\.xlsx?$/i.test(f.name) &&
    /survey(breakdown|layout)specs/i.test(f.name.replace(/[\s_\-]/g, ''))
  );
  const dateOf = (name) => {
    const m = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  };
  matches.sort((a, b) => {
    const dd = dateOf(b.name).localeCompare(dateOf(a.name));
    if (dd !== 0) return dd;
    return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
  });
  return matches;
}

// Survey file status for the current property: does a survey PDF exist, and
// does a processed SurveyBreakdownSpecs workbook exist? Cached per property
// (Drive folder walks are slow) — pass force to re-check; the cache entry is
// invalidated automatically when AI processing uploads a new workbook.
const SURVEY_STATUS_CACHE = {};   // property id -> {pdf, report, checkedAt}
async function getSurveyFileStatus(force) {
  if (!STATE || !STATE.drive.folderId) return null;
  const key = STATE.id;
  if (!force && SURVEY_STATUS_CACHE[key]) return SURVEY_STATUS_CACHE[key];
  const [pdfs, reports] = await Promise.all([
    _listSurveyPdfCandidates(), _listSurveyReportCandidates(),
  ]);
  const status = {
    pdf: pdfs.length ? { name: pdfs[0].name } : null,
    report: reports.length ? { name: reports[0].name } : null,
    checkedAt: Date.now(),
  };
  SURVEY_STATUS_CACHE[key] = status;
  return status;
}

// Find the best survey PDF in the deal folder, confirming the pick with the user.
async function findSurveyPdfInDrive() {
  const candidates = await _listSurveyPdfCandidates();
  if (!candidates.length) return null;

  // Confirm walk — same UX as Import Survey and proforma import.
  const fmtD = (iso) => iso ? new Date(iso).toLocaleString() : 'unknown';
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const remaining = candidates.length - i - 1;
    const ok = confirm(
      `Process this survey PDF with Claude AI?\n\n📄 ${c.name}\nModified: ${fmtD(c.modifiedTime)}` +
      (remaining > 0
        ? `\n\n[OK = use this · Cancel = see next (${remaining} more)]`
        : '\n\n[OK = use this · Cancel = abort]')
    );
    if (ok) return c;
    if (remaining === 0) return null;
  }
  return null;
}

// Call the Anthropic Messages API with the survey PDF as a base64 document block.
// Returns a parsed object matching the shape expected by applySurveyParsedData().
async function callClaudeWithSurveyPdf(apiKey, pdfBase64, filename) {
  // Survey-extraction system prompt lives in survey_extraction_prompt.md
  // (parent folder, next to capex_schema.json) and is injected into schema.js
  // by build_schema.py as window.SURVEY_EXTRACTION_PROMPT. To tune the
  // extraction, edit the .md → python build_schema.py → push.
  const system = window.SURVEY_EXTRACTION_PROMPT;
  if (!system) throw new Error('SURVEY_EXTRACTION_PROMPT missing — rebuild schema.js (python build_schema.py)');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 4096,
      system,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: `Extract all site specs from this survey file ("${filename}") and return the JSON object.` },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`Anthropic ${resp.status}: ${errText.slice(0, 300)}`);
  }

  const data = await resp.json();
  const text = (data.content && data.content[0] && data.content[0].text) || '';
  if (!text) throw new Error('Empty response from Claude');

  // Strip optional markdown code fences then parse.
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Could not parse JSON from Claude response — check the browser console');
  }
}

// Main entry point for the 🛰 Process Survey button.
async function processSurveyWithClaude(rebuild) {
  if (!STATE) return;
  if (!STATE.drive.folderId) {
    toast('Link this property to a Drive deal folder first (☰ → Find/Link).', 'error');
    return;
  }

  // Personal key first, then the org-shared key from the Drive sync folder.
  let usingSharedKey = false;
  let apiKey = getAnthropicKey();
  if (!apiKey) {
    apiKey = await fetchSharedAnthropicKey();
    usingSharedKey = !!apiKey;
  }
  if (!apiKey) {
    const entered = prompt(
      'No org-shared API key found on Drive.\n\n' +
      'Enter an Anthropic API key to process surveys with Claude AI.\n' +
      'The key will be stored in this browser\'s localStorage only.\n' +
      'Get one at console.anthropic.com → API Keys.',
      'sk-ant-...'
    );
    if (!entered || !entered.trim()) return;
    const trimmed = entered.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      toast('API key must start with sk-ant-', 'error');
      return;
    }
    setAnthropicKey(trimmed);
    updateAnthropicKeyStatus();
    apiKey = trimmed;
  }

  try {
    toast('Searching for survey PDF in Drive…');
    const pdfFile = await findSurveyPdfInDrive();
    if (!pdfFile) {
      toast('No survey PDF found in 7. Title_Survey or 1. Offering Materials.', 'error');
      return;
    }

    toast('Downloading survey PDF…');
    const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${pdfFile.id}?alt=media`);
    const buf = await r.arrayBuffer();
    const b64 = arrayBufferToBase64(buf);

    toast('Sending to Claude AI — this may take 1–3 minutes…');
    const parsed = await callClaudeWithSurveyPdf(apiKey, b64, pdfFile.name);

    const summary = applySurveyParsedData(parsed, pdfFile.name);
    if (rebuild) rebuild();
    renderShell();
    toast(`Survey processed by AI — ${summary}`, 'success');

    // Final leg: regenerate the SHIR workbook into 7. Title_Survey/ so
    // the deal folder carries the standard artifact and 📥 Import Survey works
    // for every teammate/device. Re-render after — the upload invalidates the
    // survey-status cache, so the chips flip to "processed ✓".
    await uploadSurveyWorkbookToDrive(parsed);
    renderShell();
  } catch (e) {
    if (/401|invalid.*key|auth/i.test(e.message)) {
      if (usingSharedKey) {
        // Shared key may have been rotated — drop the session cache so the
        // next attempt refetches from Drive.
        SHARED_ANTHROPIC_KEY_CACHE = null;
        toast('Org-shared API key rejected — ask the key owner to re-share it (☰ → Share Key Org-Wide), or set a personal key.', 'error');
      } else {
        toast('API key rejected — update it via ☰ → Set Anthropic API Key.', 'error');
      }
    } else {
      toast('Survey processing failed: ' + e.message, 'error');
    }
    console.error('processSurveyWithClaude:', e);
  }
}

// ---------- SHIR survey workbook regeneration ----------
// Rebuild the standard <Property>_SurveyBreakdownSpecs_<date>.xlsx from the
// parsed survey object (AI path). Layout mirrors the survey-breakdown-specs
// skill export closely enough that parseSurveyXlsx() re-imports it: title +
// subtitle rows, an "Item | Unit | Tract 1 | Site Total" header, numbered item
// rows, 4-space-indented per-building sub-rows under items 7/8/9, and the
// Google Maps notes + Discrepancies footer.
async function generateSurveyBreakdownXlsx(parsed) {
  if (typeof ExcelJS === 'undefined') throw new Error('ExcelJS not loaded yet — try again');
  const NAVY = 'FF1E3A8A', LIGHT = 'FFF1F5F9';
  const flat = parsed.flat || {};
  const meta = parsed.meta || {};
  const buildings = parsed.buildings || [];
  const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(meta.survey_date || ''))
    ? meta.survey_date : new Date().toISOString().slice(0, 10);
  const propName = String(meta.property_name || (STATE && STATE.name) || 'Property').trim();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Capex Builder';
  wb.created = new Date();
  const ws = wb.addWorksheet('Survey Breakdown Specs');
  ws.columns = [{ width: 48 }, { width: 10 }, { width: 28 }, { width: 16 }];

  const title = ws.addRow([`${propName} — Survey Breakdown Specs — ${dateStr}`]);
  title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  title.height = 24;
  title.alignment = { vertical: 'middle' };
  ws.mergeCells(`A${title.number}:D${title.number}`);

  const subParts = [meta.address || '—'];
  if (meta.scale_paper) subParts.push(`Paper scale: ${meta.scale_paper}`);
  if (meta.ft_per_pixel != null && meta.ft_per_pixel !== '') subParts.push(`ft/pixel: ${meta.ft_per_pixel}`);
  const sub = ws.addRow([subParts.join('    |    ')]);
  sub.font = { italic: true, size: 10 };
  ws.mergeCells(`A${sub.number}:D${sub.number}`);
  ws.addRow([]);

  const header = ws.addRow(['Item', 'Unit', 'Tract 1', 'Site Total']);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  header.eachCell((c) => { c.border = { bottom: { style: 'medium', color: { argb: NAVY } } }; });

  const num = (v) => {
    if (v == null || v === '') return '';
    const n = Number(v);
    return isFinite(n) ? n : '';
  };
  // Numeric items carry their value in Site Total (col D — what the parser
  // reads); free-text items (fencing/gates) carry it in the tract col (C).
  const addItem = (label, unit, siteVal, opts = {}) => {
    const r = ws.addRow([label, unit || '', opts.tractText || '', siteVal == null ? '' : siteVal]);
    if (opts.bold) r.font = { bold: true };
    if (typeof r.getCell(4).value === 'number') r.getCell(4).numFmt = '#,##0';
    return r;
  };

  addItem('1. Parking — Regular', 'spots', num(flat.parking_regular));
  addItem('1. Parking — Handicapped', 'spots', num(flat.parking_spots_hc));
  addItem('1. Parking — Total', 'spots', num(flat.parking_spots_existing), { bold: true });
  addItem('2. Land area (SF)', 'SF', num(flat.land_sf));
  addItem('2. Land area (acres)', 'acres', num(flat.land_acres));
  addItem('3. Perimeter — TOTAL', 'LF', num(flat.site_perimeter_lf));
  addItem('4. Fencing', 'notes', '', { tractText: flat.fencing_notes || 'n/a' });
  addItem('4. Gates', 'notes', '', { tractText: flat.gates_notes || 'n/a' });
  addItem('5. Parking lot SF', 'SF', num(flat.parking_lot_sf));
  addItem('6. Building count', 'count', num(flat.num_buildings));

  // The "(N Story, Ht X')" / "(pitch X:Y)" suffixes are what parseSurveyXlsx()
  // extracts stories/height/pitch from — keep the exact shapes.
  addItem('7. Building footprint', 'SF', num(flat.total_footprint_sf), { bold: true });
  buildings.forEach((b, i) => {
    const lbl = b.label || `Building ${i + 1}`;
    let suffix = '';
    if (b.stories != null && b.stories !== '') {
      suffix = (b.height_ft != null && b.height_ft !== '')
        ? ` (${b.stories} Story, Ht ${b.height_ft}')`
        : ` (${b.stories} Story)`;
    }
    addItem(`    ${lbl}${suffix}`, 'SF', num(b.footprint_sf));
  });
  addItem('8. Roof SF', 'SF', num(flat.total_roof_sf), { bold: true });
  buildings.forEach((b, i) => {
    const lbl = b.label || `Building ${i + 1}`;
    const pitch = b.roof_pitch ? ` (pitch ${b.roof_pitch})` : '';
    addItem(`    Roof — ${lbl}${pitch}`, 'SF', num(b.roof_sf));
  });
  addItem('9. Facade SF', 'SF', num(flat.total_facade_sf), { bold: true });
  buildings.forEach((b, i) => {
    addItem(`    Facade — ${b.label || `Building ${i + 1}`}`, 'SF', num(b.facade_sf));
  });
  addItem('10. Landscaping', 'SF', num(flat.landscaping_sf));

  ws.addRow([]);
  const notesHdr = ws.addRow(['Google Maps Cross-Reference Notes']);
  notesHdr.font = { bold: true };
  const noteLines = String(parsed.notes || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (noteLines.length) noteLines.forEach(n => ws.addRow([n]));
  else ws.addRow(['—']);
  ws.addRow([]);
  const discHdr = ws.addRow(['Discrepancies (Survey vs Google Maps)']);
  discHdr.font = { bold: true };
  const discs = (parsed.discrepancies || []).map(s => String(s).trim()).filter(Boolean);
  if (discs.length) discs.forEach(d => ws.addRow([`• ${d}`]));
  else ws.addRow(['—']);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const filename = `${propName.replace(/[^a-z0-9]+/gi, '')}_SurveyBreakdownSpecs_${dateStr}.xlsx`;
  return { blob, filename };
}

// Upload the regenerated survey workbook to <deal>/7. Title_Survey/ (folder
// created if missing). Falls back to a local download if the Drive upload
// fails so the artifact isn't lost.
async function uploadSurveyWorkbookToDrive(parsed) {
  let wbOut = null;
  try {
    toast('Generating SHIR survey workbook…');
    wbOut = await generateSurveyBreakdownXlsx(parsed);
    const subs = await listSubfolders(STATE.drive.folderId);
    const ts = subs.find(f => /^\s*7\.?\s*title[\s_\-]*survey/i.test(f.name))
            || subs.find(f => /title[\s_\-]*survey/i.test(f.name));
    const tsId = ts ? ts.id : await driveEnsureSubfolder(STATE.drive.folderId, '7. Title_Survey');
    await driveUploadBinary(tsId, wbOut.filename, wbOut.blob,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    delete SURVEY_STATUS_CACHE[STATE.id];   // breakdown file just changed — re-check chips on next render
    toast(`Saved ${wbOut.filename} to 7. Title_Survey/`, 'success');
  } catch (e) {
    console.error('uploadSurveyWorkbookToDrive:', e);
    if (wbOut) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(wbOut.blob);
      a.download = wbOut.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast(`Drive upload failed (${e.message}) — workbook downloaded locally instead.`, 'error');
    } else {
      toast('Survey workbook generation failed: ' + e.message, 'error');
    }
  }
}

// Shared helpers for proforma parsing.
function umNorm(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function umNum(v) { if (v === '' || v == null) return ''; const n = Number(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : ''; }
function umStatus(s) {
  const v = String(s || '').toLowerCase();
  if (v.includes('unreno')) return 'Original';   // check before 'reno'
  if (v.startsWith('orig')) return 'Original';
  if (v.startsWith('part')) return 'Partial';
  if (v.includes('reno')) return 'Reno';
  return '';
}

// Primary parser: SHIR proforma "RR" tab — handles the aggregated unit-mix
// summary layout where each row is one (BR/BA group, plan, status) combo.
// Header row example: [_, _, Status, Type, # Units, # BRs, # BAs, Total SF, SF/Unit, ...]
// Data rows are nested: col 1 holds a BR/BA group label ("0x1") that
// applies to all following rows until the next group; col 2 holds a plan
// name ("S505") that cascades the same way; col 3 is Original/Partial/Reno;
// col 4 is the count for that combo. Empty/zero counts are skipped.
// Excel rows (1-based) on the SHIR proforma RR tab that are subtotals/totals
// and must NOT be counted. Identified empirically from the live workbook.
const SHIR_RR_SKIP_ROWS = (() => {
  const skip = new Set();
  const ranges = [
    [47, 50], [97, 100], [147, 150], [197, 200], [247, 250], [297, 300], [347, 350],
    [352, 365],
    [447, 450], [497, 500], [547, 550], [597, 600], [647, 650], [697, 700],
    [747, 800],
  ];
  for (const [a, b] of ranges) for (let n = a; n <= b; n++) skip.add(n);
  return skip;
})();
// Hard cap for RR scanning: anything past this row is junk (separators, extra notes, etc.).
const SHIR_RR_MAX_EXCEL_ROW = 800;
// Sanity ceiling: no single floor plan ever has this many units in one row.
const SHIR_RR_MAX_PER_ROW_COUNT = 1000;

function parseSHIRSummaryRR(wb) {
  const sheet = wb.Sheets['RR'];
  if (!sheet) return null;
  // blankrows:true so rows[i] corresponds to Excel row (i+1) — the skip-list
  // is expressed in Excel row numbers and we need the alignment to be exact.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: true, defval: null });
  // Find the header row by content: has both "# Units" and "# BRs" (or similar).
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const cells = (rows[i] || []).map(c => String(c == null ? '' : c).toLowerCase().replace(/\s+/g, ''));
    const hasUnits = cells.some(c => /^#?units?$/.test(c));
    const hasBRs = cells.some(c => /^#?brs?$/.test(c) || c === 'bedrooms');
    if (hasUnits && hasBRs) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return null;

  // Aggregate by (group||plan||status) so the same unit type appearing in
  // both the occupied (rows ~1-400) and vacant (rows ~401-746) sections
  // combines into one row with the total count.
  const agg = new Map();
  let curGroup = '';
  let curPlan = '';
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const excelRow = i + 1;
    if (excelRow > SHIR_RR_MAX_EXCEL_ROW) break;
    if (SHIR_RR_SKIP_ROWS.has(excelRow)) continue;
    const row = rows[i] || [];
    const newGroup = String(row[1] == null ? '' : row[1]).trim();
    const newPlan = String(row[2] == null ? '' : row[2]).trim();
    if (newGroup) curGroup = newGroup;
    if (newPlan) curPlan = newPlan;
    // Rows where col 2 is empty are group-only declarative rows (the spreadsheet
    // pre-allocates 50 rows per BR/BA block, most of which are empty placeholders).
    // Without this guard, curPlan would cascade in from a prior section and create
    // phantom rows like "4x2(.5) 2BR-1075".
    if (!newPlan) continue;
    const statusVal = umStatus(row[3]);
    const countNum = Number(row[4]);
    if (!isFinite(countNum) || countNum <= 0) continue;
    if (countNum > SHIR_RR_MAX_PER_ROW_COUNT) continue;
    // Type is just the plan code (e.g. "S505"). BR/BA is displayed dynamically
    // from the beds/baths columns at render time, not baked into the name.
    const type = curPlan;
    const key = `${type}||${statusVal}`;
    const existing = agg.get(key);
    if (existing) {
      existing.count += countNum;
      // Fill in beds/baths/sqft from later rows if the first row was missing them.
      if (existing.beds === '' || existing.beds == null) existing.beds = umNum(row[5]);
      if (existing.baths === '' || existing.baths == null) existing.baths = umNum(row[6]);
      if (existing.sqft === '' || existing.sqft == null) existing.sqft = umNum(row[8]) || umNum(row[7]);
    } else {
      agg.set(key, {
        type, status: statusVal, count: countNum,
        beds: umNum(row[5]),
        baths: umNum(row[6]),
        sqft: umNum(row[8]) || umNum(row[7]),
      });
    }
  }
  const out = [...agg.values()];
  return out.length ? out : null;
}

// Parser for the ExStay proforma "UNITS" tab — the same nested group/plan/
// status column layout as the MFVA "RR" tab (BR/BA group@col B, plan@C,
// status@D, # units@E, # BRs@F, # BAs@G, Total SF@H, SF/unit@I), but the tab
// is named "UNITS" and its subtotal blocks sit at DIFFERENT row positions —
// the RR hardcoded skip-list would drop real data here (e.g. Eff rows at
// Excel rows 47-49), so subtotal rows are identified by text instead
// ("Subtotal/Avg", plan "ALL", "Grand Tot/Avg"). Beds/baths fall back to the
// BR/BA group label ("2x2(.5)" → 2 beds / 2.5 baths) because the # BRs /
// # BAs cells are often uncached formulas that SheetJS reads as blank. The
// read range is bounded: these sheets can carry a corrupt dimension record
// (A1:AZ1047135 on the live Towneplace workbook) and an unbounded
// blankrows:true read would materialize a million rows.
// Worked out from the live Towneplace Suites South ExStay Init UW workbook.
function parseUnitsTab(wb) {
  const sheetName = wb.SheetNames.find(n => /^units$/i.test(String(n).trim()));
  if (!sheetName) return null;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName],
    { header: 1, blankrows: true, defval: null, range: 'A1:Z1200' });
  // Header row: has "# Units" plus "Type" or "# BRs" within the first 15 rows.
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] || []).map(umNorm);
    if (cells.some(c => /^#?units?$/.test(c)) && cells.some(c => /^#?brs?$/.test(c) || c === 'type')) { hi = i; break; }
  }
  if (hi < 0) return null;
  const agg = new Map();
  let curGroup = '';
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const g = String(row[1] == null ? '' : row[1]).trim();
    if (g) curGroup = g;
    const plan = String(row[2] == null ? '' : row[2]).trim();
    if (!plan) continue;                                   // pre-allocated placeholder rows
    if (/^all$|grand|subtotal|tot\s*\/?\s*avg/i.test(plan)) continue;
    const status = umStatus(row[3]);
    const count = Number(row[4]);
    if (!isFinite(count) || count <= 0) continue;
    if (count > SHIR_RR_MAX_PER_ROW_COUNT) continue;
    let beds = umNum(row[5]), baths = umNum(row[6]);
    const gm = curGroup.match(/^(\d+)\s*x\s*(\d+)\s*(\(\.5\))?$/);
    if (beds === '' && gm) beds = Number(gm[1]);
    if (baths === '' && gm) baths = Number(gm[2]) + (gm[3] ? 0.5 : 0);
    let sqft = umNum(row[8]);
    if (sqft === '') { const t = umNum(row[7]); if (t !== '' && count) sqft = Math.round(t / count); }
    const key = `${plan}||${status}`;
    const existing = agg.get(key);
    if (existing) {
      existing.count += count;
      if (existing.sqft === '' || existing.sqft == null) existing.sqft = sqft;
      if (existing.beds === '' || existing.beds == null) existing.beds = beds;
      if (existing.baths === '' || existing.baths == null) existing.baths = baths;
    } else {
      agg.set(key, { type: plan, status, count, beds, baths, sqft });
    }
  }
  const out = [...agg.values()];
  return out.length ? out : null;
}

// Parser for the SHIR proforma "U Mix Sum" (Unit Mix Summary) tab — a clean,
// already-aggregated table with one row per (floor plan, upgrade status). Used as a
// fallback when the "RR" tab is empty or non-standard (e.g. early "Init UW" files, or
// proformas that keep the rent roll only as this summary). Header row has both
// "Floor Plan" and "# Units"; per-plan "Average" sub-rows and the trailing
// "Grand Tot / Avg" row are skipped. Columns are detected by label, not position.
function parseUMixSum(wb) {
  // Try every name-matching sheet (priority: "U Mix Sum"-style names, then a
  // bare "Units") instead of only the first match — ExStay workbooks name
  // their RR-layout tab "UNITS", which matched first and made this parser
  // bail before ever reading the real "U Mix Sum" tab.
  const candidates = wb.SheetNames.filter(n => /u\s*mix\s*sum|unit\s*mix\s*sum/i.test(n))
    .concat(wb.SheetNames.filter(n => /^units?$/i.test(String(n).trim())));
  for (const sheetName of candidates) {
    const out = _parseUMixSumSheet(wb.Sheets[sheetName]);
    if (out) return out;
  }
  return null;
}
function _parseUMixSumSheet(sheet) {
  // defval:null fills empty cells so rows aren't sparse — otherwise .map(umNorm)
  // leaves holes that findIndex visits as undefined and .includes() throws.
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: null });
  let hi = -1, C = null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = (rows[i] || []).map(umNorm);
    const plan = cells.findIndex(c => c.includes('floorplan'));
    const units = cells.findIndex(c => /^#?units?$/.test(c));
    if (plan >= 0 && units >= 0) {
      const find = (re) => cells.findIndex(c => re.test(c));
      hi = i;
      C = { plan, units, status: find(/upgrade|status/), beds: find(/^#?brs?$|bed/),
            baths: find(/^#?bas?$|bath/), sfunit: find(/sfunit|sfperunit/), totsf: find(/totalsf/) };
      break;
    }
  }
  if (hi < 0) return null;
  const agg = new Map();
  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const g = (k) => (k >= 0 && k < row.length ? row[k] : null);
    const plan = String(g(C.plan) == null ? '' : g(C.plan)).trim();
    if (!plan || /grand|total|avg/i.test(plan)) continue;   // stop at / skip the totals row
    const status = umStatus(g(C.status));
    if (!status) continue;                                  // skips per-plan "Average" sub-rows
    const cnt = umNum(g(C.units));
    if (!(typeof cnt === 'number' && cnt > 0)) continue;
    let sqft = umNum(g(C.sfunit));
    if (sqft === '' && C.totsf >= 0) { const t = umNum(g(C.totsf)); if (t !== '') sqft = Math.round(t / cnt); }
    const key = plan + '||' + status;
    const existing = agg.get(key);
    if (existing) existing.count += cnt;
    else agg.set(key, { type: plan, status, count: cnt, beds: umNum(g(C.beds)), baths: umNum(g(C.baths)), sqft });
  }
  const out = [...agg.values()];
  return out.length ? out : null;
}

// Secondary parser: raw per-unit rent roll — aggregate one row per unit by
// (Unit Type Name + Reno/Unreno status). Header must have both a "Unit Type Name"
// column and a per-unit "Unit #" column to be recognized.
function parseProformaRR(wb) {
  // Scan RR / rent-roll sheets first.
  const sheets = wb.SheetNames.slice().sort((a, b) =>
    (/^rr$|rent\s*roll/i.test(b) ? 1 : 0) - (/^rr$|rent\s*roll/i.test(a) ? 1 : 0));
  for (const sn of sheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false, defval: null });
    let h = -1, col = null;
    for (let i = 0; i < rows.length; i++) {
      const cells = (rows[i] || []).map(umNorm);
      const type = cells.findIndex(c => c.includes('unittype'));
      const unitNo = cells.findIndex(c => c === 'unit' || c === 'unitno' || c === 'unitnumber');
      const status = cells.findIndex(c => c.includes('reno') || c.includes('status') || c.includes('condition'));
      const beds = cells.findIndex(c => c === 'brs' || c === 'br' || c.includes('bed'));
      const baths = cells.findIndex(c => c === 'ba' || c === 'bas' || c.includes('bath'));
      const sqft = cells.findIndex(c => c === 'sqft' || c === 'sf' || c.includes('sqft') || c.includes('squarefe'));
      if (type >= 0 && unitNo >= 0 && status >= 0 && (beds >= 0 || sqft >= 0)) {
        h = i; col = { type, status, beds, baths, sqft }; break;
      }
    }
    if (h < 0) continue;

    const agg = new Map(); // key: type||status
    for (let i = h + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const type = String(row[col.type] == null ? '' : row[col.type]).trim();
      if (!type) continue;
      const status = umStatus(row[col.status]);
      const key = type + '||' + status;
      let a = agg.get(key);
      if (!a) { a = { type, status, count: 0, beds: '', baths: '', sqftSum: 0, sqftN: 0 }; agg.set(key, a); }
      a.count += 1;
      const b = umNum(col.beds >= 0 ? row[col.beds] : '');  if (b !== '') a.beds = b;
      const ba = umNum(col.baths >= 0 ? row[col.baths] : ''); if (ba !== '') a.baths = ba;
      const sf = umNum(col.sqft >= 0 ? row[col.sqft] : '');  if (sf !== '') { a.sqftSum += sf; a.sqftN += 1; }
    }
    const out = [...agg.values()]
      .map(a => ({ type: a.type, count: a.count, beds: a.beds, baths: a.baths, sqft: a.sqftN ? Math.round(a.sqftSum / a.sqftN) : '', status: a.status }))
      .sort((x, y) => (x.type + '/' + x.status).localeCompare(y.type + '/' + y.status));
    if (out.length) return out;
  }
  return null;
}

// Fallback parser: a simple unit-mix summary table (one row per unit type).
// Scans "unit mix"-named sheets first, then every other sheet. A sheet is
// accepted only if at least one parsed row carries a positive unit count —
// without that guard the loose header detection false-positives on dashboard
// sheets (e.g. the DASH tab's "Property Type" / "Commercial RSF" labels) and
// imports garbage rows.
function parseGenericUnitMix(wb) {
  const sheets = wb.SheetNames.slice().sort((a, b) =>
    (/unit\s*mix/i.test(b) ? 1 : 0) - (/unit\s*mix/i.test(a) ? 1 : 0));
  for (const sheetName of sheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: null });
    let headerIdx = -1, cols = {};
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const cells = (rows[i] || []).map(umNorm);
      const has = (...keys) => cells.findIndex(c => keys.some(k => c.includes(k)));
      const type = has('unittype', 'type', 'plan', 'floorplan', 'unitname');
      const beds = cells.findIndex(c => c === 'bd' || c === 'br' || c.includes('bed') || c === 'brs');
      const baths = cells.findIndex(c => c === 'ba' || c.includes('bath'));
      const sqft = cells.findIndex(c => c.includes('sqft') || c.includes('squarefe') || c === 'sf' || c.includes('rsf'));
      if (type >= 0 && (beds >= 0 || baths >= 0 || sqft >= 0)) {
        headerIdx = i;
        cols = { type, beds, baths, sqft, count: has('ofunits', 'units', 'qty', 'count', 'quantity'), status: has('status', 'condition', 'reno') };
        break;
      }
    }
    if (headerIdx < 0) continue;
    const out = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const get = (idx) => (idx >= 0 ? row[idx] : '');
      const typeVal = String(get(cols.type) || '').trim();
      if (!typeVal) continue;
      out.push({ type: typeVal, count: umNum(get(cols.count)), beds: umNum(get(cols.beds)), baths: umNum(get(cols.baths)), sqft: umNum(get(cols.sqft)), status: umStatus(get(cols.status)) });
    }
    if (out.length && out.some(r => typeof r.count === 'number' && r.count > 0)) return out;
  }
  return null;
}

// Import unit mix from the deal proforma. Reads the SHIR "RR" rent roll first,
// falling back to a generic unit-mix summary table.
function importProformaUnitMix(file, rebuild) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const out = parseSHIRSummaryRR(wb) || parseUnitsTab(wb) || parseUMixSum(wb) || parseProformaRR(wb) || parseGenericUnitMix(wb);
      if (!out || !out.length) {
        toast('Could not find unit-mix data (looked for the RR rent roll — see the note).', 'error');
        return;
      }
      if (getUnitMix().length && !confirm(`Replace the current ${getUnitMix().length} unit type(s) with ${out.length} from the proforma?`)) return;
      STATE.unitMix = out;
      syncUnitMixSumsToPhase1();
      saveState();
      // Full re-render (not just the unit-mix block) so every derived field —
      // mf_units / mf_rsf / overall_rsf and anything conditional on them —
      // shows the imported values without a manual page refresh.
      renderShell();
      toast(`Imported ${out.length} unit type/status row(s) from the proforma`, 'success');
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Standalone Unit Mix Excel export — SHIR-branded, just the unit-mix table.
// Downloads locally (no Drive upload), independent of the full Capex export.
async function exportUnitMixXlsx() {
  if (typeof ExcelJS === 'undefined') { toast('ExcelJS not loaded yet, try again', 'error'); return; }
  const rows = getUnitMix();
  if (!rows.length) { toast('No unit mix to export — add or import rows first.', 'error'); return; }
  const NAVY = 'FF1E3A8A', LIGHT = 'FFF1F5F9';
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Capex Builder';
  wb.created = new Date();
  const ws = wb.addWorksheet('Unit Mix');
  ws.columns = [
    { width: 32 }, { width: 10 }, { width: 8 }, { width: 8 },
    { width: 12 }, { width: 14 }, { width: 14 },
  ];

  const propName = (STATE && STATE.phase1 && STATE.phase1.prop_name) || '';
  const title = ws.addRow([propName ? `UNIT MIX — ${propName.toUpperCase()}` : 'UNIT MIX']);
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  title.height = 26;
  title.alignment = { vertical: 'middle' };
  ws.mergeCells(`A${title.number}:G${title.number}`);
  ws.addRow([]);

  const header = ws.addRow(['Unit Type', '# Units', 'Beds', 'Baths', 'SqFt / Unit', 'Status', 'Total SF']);
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  header.eachCell((c) => {
    c.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
    c.alignment = { horizontal: 'center' };
  });

  rows.forEach((r) => {
    const count = Number(r.count) || 0;
    const sqft = Number(r.sqft) || 0;
    const row = ws.addRow([
      r.type || '',
      count || '',
      r.beds === '' || r.beds == null ? '' : Number(r.beds),
      r.baths === '' || r.baths == null ? '' : (isNaN(Number(r.baths)) ? r.baths : Number(r.baths)),
      sqft || '',
      r.status || '',
      count && sqft ? count * sqft : '',
    ]);
    row.getCell(7).numFmt = '#,##0';
  });

  // Totals row
  const totalCount = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const totalSF = rows.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.sqft) || 0), 0);
  ws.addRow([]);
  const totals = ws.addRow(['TOTAL', totalCount || '', '', '', '', '', totalSF || '']);
  totals.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totals.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  totals.getCell(7).numFmt = '#,##0';

  const filename = `UnitMix_${(propName || 'property').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast(`Downloaded ${filename}`, 'success');
}

// List all (non-folder) files in a Drive folder, with created/modified timestamps.
async function driveListFilesInFolder(folderId) {
  const all = [];
  let pageToken = null;
  do {
    const q = `'${folderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,createdTime,modifiedTime),nextPageToken&pageSize=200&orderBy=modifiedTime desc`;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const r = await driveFetch(url);
    const j = await r.json();
    all.push(...(j.files || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return all;
}

// Shared helper: locate and confirm a proforma file in this property 2. UW-Analysis
// folder. Tries “Full AI UW” first; falls back to “Init UW” if no match found.
// Returns the chosen file object or null if nothing found / user aborted.
async function _findProformaInUWFolder(actionLabel) {
  if (!STATE || !STATE.drive.folderId) { toast('Link this property to a Drive deal folder first (☰ → Find/Link).', 'error'); return null; }
  const subs = await listSubfolders(STATE.drive.folderId);
  const uw = subs.find(f => /uw[\s\-_.]*analysis/i.test(f.name))
          || subs.find(f => /uw/i.test(f.name) && /analy/i.test(f.name));
  if (!uw) { toast('No “2. UW-Analysis” folder found in the deal folder.', 'error'); return null; }

  const files = await driveListFilesInFolder(uw.id);
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isSheet = (f) => /\.xlsx?$/i.test(f.name) ||
    f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
    f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const isTemp = (f) => /^~\$/.test(String(f.name || ''));   // Excel lock/temp files (~$…)
  // The team's versioned working-model convention, e.g. "AUS - TX - Crestwood_v2.5.xlsx"
  // or "… v3.xlsx". Supplements (+RR+T12, +Comps, Demographics, _working) carry no
  // " v#"/"_v#" suffix so they're naturally excluded.
  const isVersionedModel = (f) => /[ _]v\d+(?:\.\d+)?\.xlsx?$/i.test(String(f.name || ''));

  let matches = files.filter(f => isSheet(f) && !isTemp(f) && norm(f.name).includes(norm('Full AI UW')));
  if (!matches.length) {
    // Fallback: "Init UW" (early-stage deals) OR the "<name>_v#.xlsx" working model
    // (the common naming once underwriting is underway — Crestwood, etc.). The version
    // sort below picks the HIGHEST version, so the current model wins over a stale
    // "Init UW v1" whose rent roll may still be empty.
    matches = files.filter(f => isSheet(f) && !isTemp(f) &&
      (norm(f.name).includes(norm('Init UW')) || isVersionedModel(f)));
    if (!matches.length) { toast('No “Full AI UW”, “Init UW”, or “<name>_v#” proforma spreadsheet found in 2. UW-Analysis.', 'error'); return null; }
  }

  const extractVersion = (name) => { const m = String(name||'').match(/[vV](\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : -1; };
  matches.sort((a, b) => { const vd = extractVersion(b.name) - extractVersion(a.name); return vd !== 0 ? vd : (b.modifiedTime||'').localeCompare(a.modifiedTime||''); });
  const fmtD = (iso) => iso ? new Date(iso).toLocaleString() : 'unknown';
  const labelFor = (mf) => { const v = extractVersion(mf.name); return v >= 0 ? `v${v}` : '(no version tag)'; };

  const topVersion = extractVersion(matches[0].name);
  const tiedAtTop = matches.filter(m => extractVersion(m.name) === topVersion);

  if (tiedAtTop.length > 1) {
    const vl = topVersion >= 0 ? `v${topVersion}` : '(no version tag)';
    const msg = `Multiple proforma files share the highest version (${vl}).\nPick one:\n\n` +
      tiedAtTop.map((c, i) => `${i + 1}. ${c.name}\n   Modified: ${fmtD(c.modifiedTime)}`).join('\n\n') +
      `\n\nEnter 1-${tiedAtTop.length} (or blank to cancel):`;
    const pick = prompt(msg, '1');
    const idx = parseInt(pick, 10);
    if (!idx || idx < 1 || idx > tiedAtTop.length) return null;
    return tiedAtTop[idx - 1];
  } else {
    for (let idx = 0; idx < matches.length; idx++) {
      const candidate = matches[idx];
      const remaining = matches.length - idx - 1;
      const nextHint = remaining > 0
        ? `\n\n[OK = use this · Cancel = see next best (${remaining} more)]`
        : `\n\n[OK = use this · Cancel = abort (no more candidates)]`;
      const ok = confirm(
        `${actionLabel || 'Import from this proforma?'}\n\n` +
        `📄 ${candidate.name}\n` +
        `Version:  ${labelFor(candidate)}\n` +
        `Created:  ${fmtD(candidate.createdTime)}\n` +
        `Modified: ${fmtD(candidate.modifiedTime)}` + nextHint
      );
      if (ok) return candidate;
      if (remaining === 0) return null;
    }
    return null;
  }
}

// Pull the proforma straight from the linked deal folder: find 2. UW-Analysis →
// the latest “Full AI UW” (or “Init UW”) workbook, confirm it, then import unit mix.
async function pullProformaFromDrive(rebuild) {
  if (!STATE) return;
  if (!GOOGLE_CLIENT_ID) { toast('Connect Google Drive first', 'error'); return; }
  try {
    toast('Finding the proforma in Drive…');
    const f = await _findProformaInUWFolder('Import unit mix from this proforma?');
    if (!f) return;
    toast('Downloading proforma…');
    const isGSheet = f.mimeType === 'application/vnd.google-apps.spreadsheet';
    const url = isGSheet
      ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`
      : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
    const r = await driveFetch(url);
    const buf = await r.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const out = parseSHIRSummaryRR(wb) || parseUnitsTab(wb) || parseUMixSum(wb) || parseProformaRR(wb) || parseGenericUnitMix(wb);
    if (!out || !out.length) { toast('Found the file but could not parse a unit mix from its RR tab.', 'error'); return; }
    if (getUnitMix().length && !confirm(`Replace the current ${getUnitMix().length} unit type(s) with ${out.length} from ${f.name}?`)) return;
    STATE.unitMix = out;
    syncUnitMixSumsToPhase1();
    saveState();
    // Full re-render so all derived fields reflect the import immediately.
    renderShell();
    toast(`Imported ${out.length} unit row(s) from ${f.name}`, 'success');
  } catch (e) {
    toast('Proforma pull failed: ' + e.message, 'error');
  }
}

// Parse identity + area fields from the “Dash” sheet of a SHIR proforma workbook.
// Cell references: E6=address, E7=city/state/zip, E8=Market (MSA), E9=year_built,
// E12=commercial_rsf, E13=common_sf, E17=property_type, E18=occupancy.
function parseDashSheet(wb) {
  const sheetName = wb.SheetNames.find(n => /^dash$/i.test(n));
  if (!sheetName) return null;
  const ws = wb.Sheets[sheetName];
  if (!ws) return null;

  const cv = (addr) => {
    const c = ws[addr];
    if (!c) return '';
    return c.w !== undefined ? String(c.w).trim() : (c.v !== undefined ? String(c.v).trim() : '');
  };
  const nv = (addr) => {
    const v = cv(addr);
    if (v === '') return '';
    const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
    return isFinite(n) ? n : '';
  };

  const result = {};

  const addr = cv('E6');
  if (addr) result.mailing_address = addr;

  // E7: “Dallas, TX 75001” → city + state + zip
  const csz = cv('E7');
  if (csz) {
    const m = csz.match(/^(.*?),?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/);
    if (m) {
      result.city = m[1].trim();
      result.state = m[2];
      result.zip = m[3];
    } else {
      const stM = csz.match(/\b([A-Z]{2})\b/);
      const zipM = csz.match(/\b(\d{5})\b/);
      const cityPart = csz.replace(/\b[A-Z]{2}\b/, '').replace(/\b\d{5}(?:-\d{4})?\b/, '').replace(/[,\s]+$/, '').trim();
      if (cityPart) result.city = cityPart;
      if (stM) result.state = stM[1];
      if (zipM) result.zip = zipM[1];
    }
  }

  const msa = cv('E8');
  if (msa) result.market_msa = msa;

  const yb = nv('E9');
  if (yb !== '') result.year_built = yb;

  const commRsf = nv('E12');
  if (commRsf !== '') result.commercial_rsf = commRsf;

  const commonSf = nv('E13');
  // Some proformas derive Common SF as a subtraction that can land negative;
  // never carry a negative into the field (floor at 0).
  if (commonSf !== '') result.common_sf = Math.max(0, commonSf);

  const propType = cv('E17');
  if (propType) {
    const pt = propType.toUpperCase().replace(/[\s\-_]/g, '');
    if (pt.includes('EXSTAY') || pt.includes('EXTENDEDSTAY')) result.property_type = 'EXSTAY';
    else if (pt.includes('MFVA') || pt.includes('MULTIFAMILY') || pt.includes('MF')) result.property_type = 'MFVA';
    else result.property_type = propType;
  }

  // E18: occupancy — may be stored as 0.85 or “85%” in the cell
  const occRaw = cv('E18');
  if (occRaw !== '') {
    let occ = parseFloat(String(occRaw).replace(/[^0-9.]/g, ''));
    if (isFinite(occ)) {
      if (occ > 1) occ = occ / 100;
      result.current_occupancy = Math.round(occ * 10000) / 10000;
    }
  }

  return Object.keys(result).length ? result : null;
}

// ---- Market (MSA) resolution ------------------------------------------------
// Options live on the market_msa schema field (single source of truth).
function getMarketOptions() {
  for (const s of (SCHEMA.phase1 || [])) for (const f of s.fields) if (f.key === 'market_msa') return f.options || [];
  return [];
}
// Common suburb / alt-name -> MSA principal city (guessing aid; extend as needed).
const MSA_CITY_ALIASES = {
  'arvada': 'Denver', 'aurora': 'Denver', 'lakewood': 'Denver', 'centennial': 'Denver', 'thornton': 'Denver', 'westminster': 'Denver', 'littleton': 'Denver',
  'plano': 'Dallas', 'frisco': 'Dallas', 'irving': 'Dallas', 'mckinney': 'Dallas', 'garland': 'Dallas', 'arlington': 'Dallas', 'denton': 'Dallas', 'fort worth': 'Dallas', 'richardson': 'Dallas', 'carrollton': 'Dallas', 'allen': 'Dallas', 'grand prairie': 'Dallas',
  'round rock': 'Austin', 'cedar park': 'Austin', 'georgetown': 'Austin', 'pflugerville': 'Austin', 'san marcos': 'Austin', 'kyle': 'Austin', 'leander': 'Austin',
  'the woodlands': 'Houston', 'sugar land': 'Houston', 'katy': 'Houston', 'pasadena': 'Houston', 'pearland': 'Houston', 'conroe': 'Houston', 'spring': 'Houston',
  'mesa': 'Phoenix', 'scottsdale': 'Phoenix', 'chandler': 'Phoenix', 'glendale': 'Phoenix', 'tempe': 'Phoenix', 'gilbert': 'Phoenix', 'surprise': 'Phoenix', 'goodyear': 'Phoenix',
  'henderson': 'Las Vegas', 'north las vegas': 'Las Vegas', 'paradise': 'Las Vegas',
  'st. petersburg': 'Tampa', 'st petersburg': 'Tampa', 'clearwater': 'Tampa', 'brandon': 'Tampa',
  'kissimmee': 'Orlando', 'sanford': 'Orlando',
  'fort lauderdale': 'Miami', 'hollywood': 'Miami', 'pompano beach': 'Miami', 'west palm beach': 'Miami', 'boca raton': 'Miami', 'pembroke pines': 'Miami',
  'brooklyn': 'New York', 'queens': 'New York', 'bronx': 'New York', 'newark': 'New York', 'jersey city': 'New York',
  'oakland': 'San Francisco', 'berkeley': 'San Francisco',
  'st. paul': 'Minneapolis', 'st paul': 'Minneapolis', 'bloomington': 'Minneapolis',
};
// Best-effort "City, ST" market guess: exact match -> alias -> largest MSA in state.
function guessMarketMSA(o) {
  o = o || {};
  const options = getMarketOptions(); if (!options.length) return '';
  const byKey = {}; options.forEach(x => { byKey[x.toLowerCase()] = x; });
  const st = (o.state || '').trim().toUpperCase();
  const raw = (o.raw || '').trim();
  if (raw && byKey[raw.toLowerCase()]) return byKey[raw.toLowerCase()];          // 1. Dash!E8 already a valid option
  const city = (o.city || '').trim().toLowerCase();
  if (city && st && byKey[city + ', ' + st.toLowerCase()]) return byKey[city + ', ' + st.toLowerCase()]; // 2. exact City, ST
  if (city && MSA_CITY_ALIASES[city]) {                                          // 3. suburb -> principal city
    const alias = MSA_CITY_ALIASES[city].toLowerCase();
    if (st && byKey[alias + ', ' + st.toLowerCase()]) return byKey[alias + ', ' + st.toLowerCase()];
    const anySt = options.find(x => x.toLowerCase().startsWith(alias + ', '));
    if (anySt) return anySt;
  }
  if (st) { const inState = options.find(x => x.toUpperCase().endsWith(', ' + st)); if (inState) return inState; } // 4. largest MSA in state
  return '';
}
// Backfill an empty Market (MSA) from the stored address (used on property open).
function maybeGuessMarketMSA() {
  if (!STATE || !STATE.phase1 || STATE.phase1.market_msa) return;
  const mm = guessMarketMSA({ city: STATE.phase1.city, state: STATE.phase1.state });
  if (mm) { STATE.phase1.market_msa = mm; STATE.updated = Date.now(); saveState(); }
}

// Import identity fields from the Dash sheet AND unit mix from the RR tab in one shot.
async function pullBasicsAndUnitsFromDrive() {
  if (!STATE) return;
  if (!GOOGLE_CLIENT_ID) { toast('Connect Google Drive first', 'error'); return; }
  try {
    toast('Finding the proforma in Drive…');
    const f = await _findProformaInUWFolder('Import Basics + Units from this proforma?');
    if (!f) return;
    toast('Downloading proforma…');
    const isGSheet = f.mimeType === 'application/vnd.google-apps.spreadsheet';
    const url = isGSheet
      ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`
      : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
    const r = await driveFetch(url);
    const buf = await r.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });

    const filled = [];
    const FIELD_LABELS = {
      mailing_address: 'Mailing Address', city: 'City', state: 'State', zip: 'ZIP',
      year_built: 'Year Built', property_type: 'Property Type', market_msa: 'Market (MSA)',
      current_occupancy: 'Occupancy', commercial_rsf: 'Commercial RSF', common_sf: 'Common SF',
    };

    // Apply Dash sheet basics
    const basics = parseDashSheet(wb);
    if (basics) {
      Object.assign(STATE.phase1, basics);
      for (const k of Object.keys(basics)) {
        if (basics[k] !== '' && basics[k] != null) filled.push(FIELD_LABELS[k] || k);
      }
    }

    // Market (MSA): use Dash!E8 if it matches an option, otherwise guess from the address.
    const mm = guessMarketMSA({ raw: basics && basics.market_msa, city: STATE.phase1.city, state: STATE.phase1.state });
    if (mm) {
      STATE.phase1.market_msa = mm;
      if (!filled.includes('Market (MSA)')) filled.push('Market (MSA)');
    } else if (STATE.phase1.market_msa && !getMarketOptions().includes(STATE.phase1.market_msa)) {
      STATE.phase1.market_msa = '';   // drop an unrecognized raw value so the dropdown stays valid
    }

    // Apply unit mix from RR tab
    const umOut = parseSHIRSummaryRR(wb) || parseUnitsTab(wb) || parseUMixSum(wb) || parseProformaRR(wb) || parseGenericUnitMix(wb);
    if (umOut && umOut.length) {
      const existingCount = getUnitMix().length;
      if (!existingCount || confirm(`Replace the current ${existingCount} unit type(s) with ${umOut.length} from ${f.name}?`)) {
        STATE.unitMix = umOut;
        syncUnitMixSumsToPhase1();
        filled.push(`${umOut.length} unit type${umOut.length === 1 ? '' : 's'}`);
      }
    }

    if (!filled.length) { toast('Nothing could be extracted from the Dash or RR tab in this file.', 'error'); return; }
    saveState();
    renderShell();
    toast(`Imported from ${f.name}: ${filled.join(', ')}`, 'success');
  } catch (e) {
    toast('Basics import failed: ' + e.message, 'error');
  }
}

// ---------- Shared key + checklist helpers ----------
function ckKey(gi, si, ii) { return `${gi}.${si}.${ii}`; }
function isChecked(gi, si, ii) {
  return !!(STATE.checklist && STATE.checklist[ckKey(gi, si, ii)]);
}
function setChecked(gi, si, ii, val) {
  if (!STATE.checklist) STATE.checklist = {};
  const k = ckKey(gi, si, ii);
  if (val) STATE.checklist[k] = true; else delete STATE.checklist[k];
  saveState();
}
function countChecked() {
  return STATE.checklist ? Object.keys(STATE.checklist).length : 0;
}

// CAPEX group header colors, matched to the source Excel "CAPEX" tab.
const GROUP_COLORS = {
  'Soft Costs': '#417B85',
  'Base Work': '#78697B',
  'Building Work': '#B2BCCB',
  'Interior': '#A64D79',
  'Exterior': '#3477B2',
  'Amenities': '#242852',
  'Commercial Tenant Costs': '#FFCC66',
};
// Pick readable text color (dark on light fills, white on dark fills).
function textOn(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#0f172a' : '#ffffff';
}
// Lighten a hex color toward white. blend=0 returns the input, blend=1 returns white.
// Used to derive sub-section and line-item tints from each group's banner color.
function lightenHex(hex, blend) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const mix = (n) => Math.round(n + (255 - n) * blend).toString(16).padStart(2, '0');
  return '#' + mix(r) + mix(g) + mix(b);
}
// Build a colored group <header> for the CAPEX group sections.
function groupHeader(groupName, badgeNode) {
  const color = GROUP_COLORS[groupName];
  const txt = color ? textOn(color) : null;
  const headerAttrs = {
    class: 'section-header group-header',
    onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed'),
  };
  if (color) headerAttrs.style = `background:${color};color:${txt};border-bottom-color:rgba(0,0,0,0.12)`;
  return el('header', headerAttrs,
    el('span', { style: 'font-size:15px;font-weight:700;flex:1' + (txt ? `;color:${txt}` : '') }, groupName.toUpperCase()),
    badgeNode || false,
    el('span', { class: 'chev', style: txt ? `color:${txt}` : '' }, '▼')
  );
}

// Update the per-section / per-group "N selected" badges shown on collapsed
// Questionnaire headers. Cheap DOM walk over the badge placeholders.
function refreshQuestionnaireBadges() {
  const root = $('#phase-content');
  if (!root) return;
  root.querySelectorAll('[data-q-badge]').forEach(b => {
    const [gi, si] = b.dataset.qBadge.split('.').map(Number);
    const sec = SCHEMA.phase3[gi] && SCHEMA.phase3[gi].sections[si];
    if (!sec) return;
    let n = 0; sec.items.forEach((_, ii) => { if (isChecked(gi, si, ii)) n++; });
    b.textContent = `${n} selected`;
  });
  root.querySelectorAll('[data-q-badge-group]').forEach(b => {
    const gi = Number(b.dataset.qBadgeGroup);
    const g = SCHEMA.phase3[gi]; if (!g) return;
    let n = 0; g.sections.forEach((sec, si) => sec.items.forEach((_, ii) => { if (isChecked(gi, si, ii)) n++; }));
    b.textContent = `${n} selected`;
  });
}

// ---------- Phase 2: Questionnaire (CAPEX checklist — checkboxes only) ----------
function renderPhase2() {
  const root = el('div');
  // "# Items" count sits inline in the navy bar with Expand/Collapse all.
  const itemsStat = el('div', { style: 'display:flex;align-items:center;gap:8px' },
    el('span', { style: 'color:#cbd5e1;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em' }, '# Items'),
    el('span', { class: 'value', 'data-checked-count': true, style: 'color:#fff;font-size:16px;font-weight:700' }, String(countChecked())));
  root.appendChild(renderExpandCollapseBar(null, itemsStat));
  root.appendChild(el('div', { class: 'muted small', style: 'margin:2px 2px 14px' },
    'Check every capex item this property needs. Selected items appear in the BUDGET $ tab for pricing.'));

  const refreshCount = () => {
    const n = root.querySelector('[data-checked-count]');
    if (n) n.textContent = String(countChecked());
    refreshQuestionnaireBadges();
  };

  SCHEMA.phase3.forEach((group, gi) => {
    if (!group.sections.length) return;
    // groupBody carries .section-body so collapsing the group hides everything inside.
    const groupBody = el('div', { class: 'section-body group-body' });
    // Group-derived tints (same scheme as renderPhase3): sub-section headers
    // get a medium-light tint; line items get a very-light tint of the same hue.
    const groupColor = GROUP_COLORS[group.name];
    const subHeaderBg = groupColor ? lightenHex(groupColor, 0.55) : '';
    const subHeaderTxt = groupColor ? textOn(subHeaderBg) : '';
    const rowIdleBg = groupColor ? lightenHex(groupColor, 0.88) : '';
    group.sections.forEach((sec, si) => {
      if (!sec.items.length) return;
      const secBody = el('div', { class: 'section-body' });
      sec.items.forEach((item, ii) => {
        const cb = el('input', { type: 'checkbox' });
        cb.checked = isChecked(gi, si, ii);
        cb.setAttribute('data-cb-key', ckKey(gi, si, ii));
        cb.addEventListener('change', () => { setChecked(gi, si, ii, cb.checked); refreshCount(); });
        const itemLabel = el('label', { class: 'check-item' }, cb, el('span', {}, item.name));
        if (rowIdleBg) itemLabel.style.background = rowIdleBg;
        secBody.appendChild(itemLabel);
      });
      // Bulk Select all / Clear buttons for this subsection. stopPropagation
      // so clicking them does not also collapse the section via the header.
      const bulkBtnStyle = 'padding:3px 8px;font-size:11px;font-weight:600;background:rgba(255,255,255,0.92);color:#0f172a;border:1px solid rgba(0,0,0,0.18);border-radius:4px;cursor:pointer;white-space:nowrap;text-transform:none;letter-spacing:0';
      const bulkSet = (value) => {
        sec.items.forEach((_, ii) => {
          setChecked(gi, si, ii, value);
          const cb = secBody.querySelector(`[data-cb-key="${ckKey(gi, si, ii)}"]`);
          if (cb) cb.checked = value;
        });
        refreshCount();
      };
      const selectAllBtn = el('button', {
        type: 'button', style: bulkBtnStyle, title: 'Select every item in this subsection',
        onClick: (e) => { e.stopPropagation(); bulkSet(true); },
      }, '✓ All');
      const clearBtn = el('button', {
        type: 'button', style: bulkBtnStyle, title: 'Deselect every item in this subsection',
        onClick: (e) => { e.stopPropagation(); bulkSet(false); },
      }, '✗ None');
      // Questionnaire sub-sections start expanded so users can see all available
      // line items at a glance — collapse is still available via the chevron.
      const secHeaderStyle = subHeaderBg
        ? `background:${subHeaderBg};color:${subHeaderTxt}`
        : '';
      const secChecked = sec.items.filter((_, ii) => isChecked(gi, si, ii)).length;
      const secNode = el('section', { class: 'section' },
        el('header', { class: 'section-header', style: secHeaderStyle,
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
          el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1' }, sec.name),
          el('span', { class: 'section-collapsed-badge', 'data-q-badge': gi + '.' + si }, `${secChecked} selected`),
          el('span', { style: 'display:flex;align-items:center;gap:6px;flex-shrink:0' },
            selectAllBtn,
            clearBtn,
            el('span', { class: 'chev', style: subHeaderTxt ? `color:${subHeaderTxt}` : '' }, '▼')
          )
        ),
        secBody
      );
      groupBody.appendChild(secNode);
    });
    let groupChecked = 0;
    group.sections.forEach((sec, si) => sec.items.forEach((_, ii) => { if (isChecked(gi, si, ii)) groupChecked++; }));
    const groupBadge = el('span', { class: 'section-collapsed-badge', 'data-q-badge-group': gi }, `${groupChecked} selected`);
    const groupNode = el('section', { class: 'section group-section' }, groupHeader(group.name, groupBadge), groupBody);
    root.appendChild(groupNode);
  });
  return root;
}

// ---------- Phase 3: Details (checked items only — # units, unit type, $/unit) ----------
// '%' is a special type: the row's $/Qty becomes a read-only display of
// (selected CAPEX Group total) / 100, and the row's $ Amt = (qty / 100) ×
// group total. A sub-row appears below the line item to pick the group.
// Source of truth: LISTS!A3:A<n> in Capex_Builder_Line_Items_Control.xlsx.
// Keep in sync with that workbook's QTY_TYPES list. '%' triggers special % logic
// (see getDetailItemTotal / renderDetailItem); all others are display-only.
const UNIT_TYPES = ['MF Unit', 'Building', 'Reno Unit', 'Each', 'Device', 'Allowance', 'Sqft', 'Linear Ft', 'Sq Yard', 'Cubic Yard', 'LS', 'Month', 'Hour', 'Day', '%', 'Park', 'Int. Hall', 'Avg Sqft', 'Avg # BRs', 'Avg # BAs',
  // Basics-linked Qty Types (2026-07-07): picking one auto-fills a Budget row's
  // # Qty (read-only) from the mapped Basics/Physical field — see BASICS_QTY_TYPE_FIELDS.
  'Multifamily RSF', 'Land Sqft', 'Parking Lot Sqft', 'Total Facade Sqft', 'Other Pervious Sqft',
  '# Parking Spots', '# Vehicle Gates', '# Elevators', '# Private Yards', '# Garage',
  '# Hallways', '# Outdoor Pool(s)', '# Dog Park(s)', '# Laundry Facility(ies)', '# Indoor Pool(s)'];
// Interior "sizing" Qty Types: when an Interior row uses one of these, its
// auto-computed # Qty (units being renovated) is multiplied by the matching
// property-wide average from the Unit Mix. See avgSizingForUnitType().
const AVG_QTY_TYPES = ['Avg Sqft', 'Avg # BRs', 'Avg # BAs'];

// Basics-linked Qty Types: Qty Type name -> Basics/Physical schema key. When a
// Budget row uses one of these, its # Qty auto-fills (read-only) from the
// property's value for that field. Mirrors the LISTS "Basics Item" column in
// Budget_Details_Control.xlsx (col A == col B there). Keep both in sync.
const BASICS_QTY_TYPE_FIELDS = {
  // 'MF Unit' replaces the old =MF checkbox: auto-fills # Qty from # of MF Units.
  'MF Unit': 'mf_units',
  'Multifamily RSF': 'mf_rsf',
  'Land Sqft': 'land_sf',
  'Parking Lot Sqft': 'parking_lot_sf',
  'Total Facade Sqft': 'total_facade_sf',
  'Other Pervious Sqft': 'landscaping_sf',
  '# Parking Spots': 'parking_spots_existing',
  '# Vehicle Gates': 'vehicle_gates',
  '# Elevators': 'elevators_yn',
  '# Private Yards': 'private_yard_existing',
  '# Garage': 'garage',
  '# Hallways': 'hallways',
  '# Outdoor Pool(s)': 'outdoor_pools',
  '# Dog Park(s)': 'dog_parks',
  '# Laundry Facility(ies)': 'laundry_facilities',
  '# Indoor Pool(s)': 'indoor_pools',
};
// Property value backing a Basics-linked Qty Type, or null if `ut` isn't one.
// Reads phase1 then phase2 (keys are unique across the two); blank/non-numeric -> 0.
function basicsQtyValue(ut) {
  const key = BASICS_QTY_TYPE_FIELDS[ut];
  if (!key) return null;
  const p1 = STATE.phase1 || {}, p2 = STATE.phase2 || {};
  const raw = (p1[key] !== undefined && p1[key] !== '') ? p1[key]
            : (p2[key] !== undefined ? p2[key] : '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
// Populate a Qty Type <select> with a leading "—" and every UNIT_TYPES entry,
// inserting a disabled "----------" separator between the base types and the
// appended Basics-linked ones. ('MF Unit' is a base type that's also Basics-
// linked, so it stays ABOVE the separator; the split lands before the first
// truly-appended type, i.e. 'Multifamily RSF'.) `effectiveUT` is pre-selected.
function fillQtyTypeOptions(sel, effectiveUT) {
  sel.appendChild(el('option', { value: '' }, '—'));
  let sepDone = false;
  UNIT_TYPES.forEach(u => {
    if (!sepDone && u !== 'MF Unit' && BASICS_QTY_TYPE_FIELDS[u]) {
      sel.appendChild(el('option', { value: '', disabled: true }, '----------'));
      sepDone = true;
    }
    const o = el('option', { value: u }, u);
    if (effectiveUT === u) o.selected = true;
    sel.appendChild(o);
  });
}

function getP3(gi, si, ii) {
  return STATE.phase3[ckKey(gi, si, ii)] || { qty: '', unit_type: '', unit_cost: '', notes: '', mf_linked: false, pct_group_id: '', pct_orig: '', pct_part: '', pct_reno: '', finish: '' };
}

// Look up the $/Qty for a (item, finish) pair on the schema-attached options
// list. Returns null when the item has no options or the finish isn't found
// (stale-finish case — keep the row's last unit_cost frozen, see callers).
function getFinishRate(item, finish) {
  if (!item || !Array.isArray(item.options) || !finish) return null;
  const o = item.options.find(opt => (opt && opt.finish === finish));
  if (!o) return null;
  const n = Number(o.default_cost);
  return Number.isFinite(n) ? n : null;
}

// Effective $/Qty for a Details row.
//   1. If the row has a unit_cost set, that wins (user override is sticky).
//   2. Else if the row has a Finish and the item still defines that option,
//      use the Options-tab rate.
//   3. Else 0 (no rate).
// Used by both getDetailItemTotal and getCapexGroupTotal so % rows see the
// same number as the visible row.
function getEffectiveUnitCost(gi, si, ii) {
  const v = getP3(gi, si, ii);
  if (v.unit_cost !== '' && v.unit_cost !== null && v.unit_cost !== undefined) {
    const n = Number(v.unit_cost);
    if (Number.isFinite(n)) return n;
  }
  const item = (SCHEMA.phase3[gi] && SCHEMA.phase3[gi].sections[si] && SCHEMA.phase3[gi].sections[si].items[ii]) || null;
  if (v.finish && item) {
    const r = getFinishRate(item, v.finish);
    if (r != null) return r;
  }
  if (item && item.default_cost_per_item != null && item.default_cost_per_item !== '') {
    const n = Number(item.default_cost_per_item);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function isInteriorGroup(gi) {
  return !!(SCHEMA.phase3[gi] && SCHEMA.phase3[gi].name === 'Interior');
}

function getUnitStatusCounts() {
  const rows = (STATE && Array.isArray(STATE.unitMix)) ? STATE.unitMix : [];
  let orig = 0, part = 0, reno = 0;
  for (const r of rows) {
    const c = Number(r.count) || 0;
    if (!c) continue;
    const s = String(r.status || '').toLowerCase();
    if (s.includes('unreno') || s.startsWith('orig')) orig += c;
    else if (s.startsWith('part')) part += c;
    else if (s.includes('reno')) reno += c;
  }
  return { orig, part, reno, empty: (orig + part + reno) === 0 };
}

// Property-wide, count-weighted averages from the Unit Mix. Used both for the
// summary line at the top of the Unit Mix section and as the sizing multiplier
// for Interior rows whose Qty Type is one of AVG_QTY_TYPES.
function getUnitMixAverages() {
  const rows = (STATE && Array.isArray(STATE.unitMix)) ? STATE.unitMix : [];
  let totalCount = 0, sqftSum = 0, bedsSum = 0, bathsSum = 0;
  for (const r of rows) {
    const c = Number(r.count) || 0;
    if (!c) continue;
    totalCount += c;
    sqftSum  += c * (Number(r.sqft)  || 0);
    bedsSum  += c * (Number(r.beds)  || 0);
    bathsSum += c * (Number(r.baths) || 0);
  }
  if (!totalCount) return { avgSqft: 0, avgBeds: 0, avgBaths: 0, empty: true };
  return {
    avgSqft:  sqftSum  / totalCount,
    avgBeds:  bedsSum  / totalCount,
    avgBaths: bathsSum / totalCount,
    empty: false,
  };
}
// Maps an Avg-* Qty Type to its property-wide average; returns null for any
// non-sizing Qty Type so callers can tell "no sizing applies" from "sizing of 0".
function avgSizingForUnitType(ut, avgsOpt) {
  if (!AVG_QTY_TYPES.includes(ut)) return null;
  const a = avgsOpt || getUnitMixAverages();
  if (ut === 'Avg Sqft')  return a.avgSqft;
  if (ut === 'Avg # BRs') return a.avgBeds;
  if (ut === 'Avg # BAs') return a.avgBaths;
  return null;
}

function recomputeInteriorRowQty(gi, si, ii, countsOpt) {
  const v = getP3(gi, si, ii);
  const c = countsOpt || getUnitStatusCounts();
  const po = Number(v.pct_orig) || 0;
  const pp = Number(v.pct_part) || 0;
  const pr = Number(v.pct_reno) || 0;
  let qty = Math.round((po / 100) * c.orig + (pp / 100) * c.part + (pr / 100) * c.reno);
  // Avg-* Qty Types scale the unit count by the matching property-wide average
  // (sqft / beds / baths) so e.g. Flooring priced $/sqft computes against total sqft.
  const sizing = avgSizingForUnitType(v.unit_type);
  if (sizing != null) qty = Math.round(qty * sizing);
  if ((Number(v.qty) || 0) !== qty) setP3(gi, si, ii, { qty });
  return qty;
}
function setP3(gi, si, ii, patch) {
  const k = ckKey(gi, si, ii);
  STATE.phase3[k] = Object.assign(getP3(gi, si, ii), patch);
  saveState();
}

// ---------- CAPEX Groups (user-defined buckets for percentage-based line items) ----------
// A CAPEX Group is a named bucket of detail-page line items. Any line item priced
// as a percentage references one group; its $ Amt = (qty / 100) × the group's
// total (sum of non-% line items in the group, to prevent recursion).
function ensureCapexGroups() {
  if (!Array.isArray(STATE.capexGroups)) STATE.capexGroups = [];
  return STATE.capexGroups;
}
function findCapexGroup(id) {
  return ensureCapexGroups().find(g => g.id === id) || null;
}
function createCapexGroup() {
  const g = { id: 'cg_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36), name: '', itemKeys: [] };
  ensureCapexGroups().push(g);
  saveState();
  return g;
}
function updateCapexGroup(id, patch) {
  const g = findCapexGroup(id);
  if (g) { Object.assign(g, patch); saveState(); }
}
function removeCapexGroup(id) {
  const arr = ensureCapexGroups();
  const idx = arr.findIndex(g => g.id === id);
  if (idx < 0) return;
  arr.splice(idx, 1);
  // Clear any phase3 rows that referenced this group so they do not dangle.
  Object.values(STATE.phase3 || {}).forEach(v => {
    if (v && v.pct_group_id === id) v.pct_group_id = '';
  });
  saveState();
}
// Group total = sum of $ Amts of non-% items in the group (anti-recursion).
function getCapexGroupTotal(groupId) {
  const g = findCapexGroup(groupId);
  if (!g) return 0;
  let total = 0;
  for (const key of (g.itemKeys || [])) {
    const parts = key.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) continue;
    const [gi, si, ii] = parts;
    if (!isChecked(gi, si, ii)) continue;
    const v = STATE.phase3[key];
    if (!v || v.unit_type === '%') continue;
    total += (Number(v.qty) || 0) * getEffectiveUnitCost(gi, si, ii);
  }
  return total;
}
// Unified $ Amt calculation — handles both normal (qty × cost) and % rows.
function getDetailItemTotal(gi, si, ii) {
  const v = getP3(gi, si, ii);
  const qty = Number(v.qty) || 0;
  if (v.unit_type === '%') {
    return (qty / 100) * getCapexGroupTotal(v.pct_group_id);
  }
  return qty * getEffectiveUnitCost(gi, si, ii);
}
// Look up the schema item for a ckKey (used by the CAPEX Groups UI to render
// item names + filter the Add Item dropdown).
function getSchemaItemByKey(ckKey) {
  const parts = ckKey.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [gi, si, ii] = parts;
  const g = SCHEMA.phase3[gi]; if (!g) return null;
  const s = g.sections && g.sections[si]; if (!s) return null;
  return (s.items && s.items[ii]) || null;
}
// Walk all % rows on the Details page and refresh their displayed $/Qty + $ Amt,
// then update the running subtotal. Called whenever any qty/cost/group change
// could affect a percentage calculation.
function recomputePctRowsAndSummary(summaryNode) {
  $$('.detail-item-wrap').forEach(wrap => {
    const key = wrap.dataset.ckkey;
    if (!key) return;
    const parts = key.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return;
    const [gi, si, ii] = parts;
    const v = getP3(gi, si, ii);
    if (v.unit_type === '%') {
      const grpTotal = getCapexGroupTotal(v.pct_group_id);
      const costInp = wrap.querySelector('[data-cost-input]');
      if (costInp) setNumVal(costInp, grpTotal ? Number((grpTotal / 100).toFixed(2)) : '');
      const grpTotEl = wrap.querySelector('[data-pct-grouptotal]');
      if (grpTotEl) grpTotEl.textContent = grpTotal ? `(group: ${fmtMoney(grpTotal)})` : '';
    }
    const condBlk = wrap.querySelector('[data-cond-block]');
    if (condBlk && condBlk._refresh) condBlk._refresh();
    renderDetailTotals(wrap, gi, si, ii);
  });
  if (summaryNode) updateDetailSummary(summaryNode);
  refreshBudgetBadges();
}
// Update the per-section / per-group "$ subtotal" badges shown on collapsed
// Budget headers (sum of $ Amt across each section's / group's checked items).
function refreshBudgetBadges() {
  const root = $('#phase-content');
  if (!root) return;
  root.querySelectorAll('[data-b-badge]').forEach(b => {
    const [gi, si] = b.dataset.bBadge.split('.').map(Number);
    const sec = SCHEMA.phase3[gi] && SCHEMA.phase3[gi].sections[si];
    if (!sec) return;
    let sum = 0; sec.items.forEach((_, ii) => { if (isChecked(gi, si, ii)) sum += getDetailItemTotal(gi, si, ii); });
    b.textContent = fmtMoney(sum);
  });
  root.querySelectorAll('[data-b-badge-group]').forEach(b => {
    const gi = Number(b.dataset.bBadgeGroup);
    const g = SCHEMA.phase3[gi]; if (!g) return;
    let sum = 0; g.sections.forEach((sec, si) => sec.items.forEach((_, ii) => { if (isChecked(gi, si, ii)) sum += getDetailItemTotal(gi, si, ii); }));
    b.textContent = fmtMoney(sum);
  });
}
// Re-populate every visible % group dropdown when CAPEX Groups change
// (added / renamed / deleted) so the in-line item % selectors stay current
// without a full Phase 3 re-render.
function refreshAllPctGroupSelects() {
  $$('[data-pct-group-select]').forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '' }, '— pick a CAPEX Group —'));
    ensureCapexGroups()
      .filter(g => (g.name || '').trim())
      .forEach(g => {
        const o = el('option', { value: g.id }, g.name);
        if (cur === g.id) o.selected = true;
        sel.appendChild(o);
      });
  });
}

// Conditional companion fields for a Budget line item (item.conditional_fields,
// defined on the Hidden tab of Budget_Details_Control.xlsx). Rendered as a sub-row
// under the item. Visibility (show_if) + info text (expr) are evaluated against a
// bag exposing the item's own quantity as `qty`, the phase1 fields as `p1_*`, and
// any conditional select values by their key. Refreshed by recomputePctRowsAndSummary
// whenever the row's qty / type / cost changes.
function renderItemConditionalFields(gi, si, ii, item, summaryNode) {
  const fields = Array.isArray(item.conditional_fields) ? item.conditional_fields : [];
  const wrap = el('div', { style: 'grid-column:1/-1;padding:2px 4px 8px 6px;display:flex;flex-direction:column;gap:4px' });
  wrap.setAttribute('data-cond-block', '');
  const bag = () => {
    const v = getP3(gi, si, ii);
    const cond = v.cond || {};
    const b = { qty: (v.qty === '' || v.qty == null) ? 0 : Number(v.qty) };
    fields.forEach(f => { if (f.type !== 'info') b[f.key] = (cond[f.key] != null ? cond[f.key] : ''); });
    return getEvalBag(b);   // adds p1_* phase1 aliases
  };
  const nodes = fields.map(f => {
    if (f.type === 'select') {
      const row = el('div', { style: 'display:flex;align-items:center;gap:6px;font-size:12px' });
      row.appendChild(el('span', { style: 'color:#475569;font-weight:600' }, (f.label || f.key) + ':'));
      const sel = el('select', { style: 'padding:2px 4px;font-size:12px' });
      sel.appendChild(el('option', { value: '' }, '—'));
      const cur = (getP3(gi, si, ii).cond || {})[f.key];
      (f.options || []).forEach(o => {
        const opt = el('option', { value: o }, o); if (cur === o) opt.selected = true; sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        const cond = Object.assign({}, getP3(gi, si, ii).cond); cond[f.key] = sel.value;
        setP3(gi, si, ii, { cond });
        recomputePctRowsAndSummary(summaryNode);
      });
      row.appendChild(sel);
      return { f, node: row };
    }
    // info (default): italic gray computed text
    return { f, node: el('div', { style: 'font-size:12px;color:#64748b;font-style:italic;line-height:1.3' }) };
  });
  nodes.forEach(n => wrap.appendChild(n.node));
  wrap._refresh = function () {
    const eb = bag();
    nodes.forEach(({ f, node }) => {
      const vis = f.show_if ? !!computeField(f.show_if, eb) : true;
      node.style.display = vis ? '' : 'none';
      if (vis && f.type === 'info') node.textContent = String(computeField(f.expr, eb) ?? '');
    });
  };
  wrap._refresh();
  return wrap;
}

// Shared 6-col grid for the Details page: item name | Options | # Qty | Qty Type
// | $/Qty | $ Amt. Options is the Finish picker — dropdown if the item has any
// options defined in the schema; gray-disabled cell otherwise. (The old =MF
// checkbox column was removed 2026-07-07 — use the "MF Unit" Qty Type instead.)
// Used by both the sticky column header and each line-item row so columns line up.
const DETAIL_GRID_COLS = 'minmax(0,1fr) 86px 64px 78px 72px 84px';
const DETAIL_GRID_BASE = `display:grid;grid-template-columns:${DETAIL_GRID_COLS};align-items:center;gap:6px;padding:6px 10px`;
// Interior group: 9 cols. Status-% inputs (Orig./Part./Reno.) replace the =MF
// checkbox; # Qty is computed from %s × Unit Mix status totals. Options sits
// between the status-% block and # Qty so it lines up roughly with the
// non-Interior Options column.
const DETAIL_GRID_COLS_INTERIOR = 'minmax(0,1fr) 28px 28px 28px 78px 48px 76px 58px 72px';
const DETAIL_GRID_BASE_INTERIOR = `display:grid;grid-template-columns:${DETAIL_GRID_COLS_INTERIOR};align-items:center;gap:4px;padding:6px 8px`;

// Status-totals + column header row rendered inside the Interior group (above
// its first sub-section). Reads `STATE.unitMix` via getUnitStatusCounts(); when
// empty, the count cells get a light-red bg to flag that unit mix is missing.
function renderInteriorStatusHeader() {
  const counts = getUnitStatusCounts();
  const missingBg = '#fee2e2'; // light red
  const fineBg = '#f8fafc';
  const cellBg = counts.empty ? missingBg : fineBg;
  const headerStyle = DETAIL_GRID_BASE_INTERIOR + ';font-weight:700;font-size:10px;color:#475569;text-transform:uppercase;background:#f8fafc;border-bottom:1px solid #cbd5e1';
  return el('div', { class: 'interior-status-header', style: headerStyle, 'data-interior-header': '' },
    el('div', {}, 'Item'),
    el('div', { 'data-status-cell': 'orig', style: `text-align:center;padding:2px 0;border-radius:4px;background:${cellBg}` },
      el('div', { style: 'font-size:10px;color:#475569' }, 'Orig.'),
      el('div', { style: 'font-size:12px;font-weight:700;color:#0f172a' }, String(counts.orig))
    ),
    el('div', { 'data-status-cell': 'part', style: `text-align:center;padding:2px 0;border-radius:4px;background:${cellBg}` },
      el('div', { style: 'font-size:10px;color:#475569' }, 'Part.'),
      el('div', { style: 'font-size:12px;font-weight:700;color:#0f172a' }, String(counts.part))
    ),
    el('div', { 'data-status-cell': 'reno', style: `text-align:center;padding:2px 0;border-radius:4px;background:${cellBg}` },
      el('div', { style: 'font-size:10px;color:#475569' }, 'Reno'),
      el('div', { style: 'font-size:12px;font-weight:700;color:#0f172a' }, String(counts.reno))
    ),
    el('div', {}, 'Options'),
    el('div', { style: 'text-align:right' }, '# Qty'),
    el('div', {}, 'Qty Type'),
    el('div', { style: 'text-align:right' }, '$/Qty'),
    el('div', { style: 'text-align:right' }, '$ Amt'),
  );
}

// Live-refresh the Interior status header counts in place (called when unit
// mix changes while the Details tab is open) without re-rendering the page.
function refreshInteriorStatusHeader() {
  const hdr = document.querySelector('[data-interior-header]');
  if (!hdr) return;
  const counts = getUnitStatusCounts();
  const missingBg = '#fee2e2';
  const fineBg = '#f8fafc';
  const cellBg = counts.empty ? missingBg : fineBg;
  ['orig', 'part', 'reno'].forEach(k => {
    const cell = hdr.querySelector(`[data-status-cell="${k}"]`);
    if (!cell) return;
    cell.style.background = cellBg;
    const valEl = cell.children[1];
    if (valEl) valEl.textContent = String(counts[k]);
  });
}

function renderPhase3() {
  const root = el('div');
  const totals = computeTotals();

  // Sticky top panel: one SHIR-navy box holding the summary stats (Items priced /
  // Running Subtotal / $/Unit) inline with Expand/Collapse all, + column header.
  // Pinned just below the global app-header (top 60px) + phase-tabs (~41px) so the
  // main nav tabs stay visible at all times. z-index 8 stays under the app-header (10)
  // and phase-tabs (9).
  const sticky = el('div', { style: 'position:sticky;top:101px;z-index:8;background:#fff;border-bottom:1px solid #cbd5e1;box-shadow:0 2px 4px rgba(0,0,0,0.05);margin:0 -16px 0' });
  const bar = el('div', {
    style: 'display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:nowrap;overflow-x:auto;background:var(--primary);color:#fff;padding:10px 14px'
  });
  const summary = el('div', { class: 'summary-totals summary-row-inline', style: 'background:transparent;border:none;padding:0;margin:0;border-radius:0;flex-wrap:nowrap' },
    el('div', { class: 'summary-stat' },
      el('span', { class: 'label', style: 'color:#cbd5e1' }, '# Items'),
      el('span', { class: 'value', 'data-stat': 'count', style: 'color:#fff' }, String(totals.itemCount))),
    el('div', { class: 'summary-stat' },
      el('span', { class: 'label', style: 'color:#cbd5e1' }, 'Subtotal'),
      el('span', { class: 'value', 'data-stat': 'subtotal', style: 'color:#fff' }, fmtMoney(totals.subtotal))),
    el('div', { class: 'summary-stat' },
      el('span', { class: 'label', style: 'color:#cbd5e1' }, '$/Unit'),
      el('span', { class: 'value', 'data-stat': 'perunit', style: 'color:#fff' }, fmtMoney(totals.subtotalPerUnit))));
  bar.appendChild(summary);
  const actions = el('div', { style: 'display:flex;gap:6px;flex-shrink:0;padding-left:12px;border-left:1px solid rgba(255,255,255,0.35)' });
  actions.appendChild(el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Expand all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section.collapsed')
        .forEach(s => s.classList.remove('collapsed'));
    },
  }, '▼ Expand all'));
  actions.appendChild(el('button', {
    type: 'button', style: BAR_BTN_STYLE_ON_NAVY, title: 'Collapse all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section')
        .forEach(s => s.classList.add('collapsed'));
    },
  }, '▶ Collapse all'));
  bar.appendChild(actions);
  sticky.appendChild(bar);
  // Column header row — same grid template as data rows so cells align.
  const colHdr = el('div', {
    style: DETAIL_GRID_BASE + ';font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;background:#f8fafc;border-top:1px solid #e5e7eb'
  },
    el('div', {}, 'Item'),
    el('div', {}, 'Options'),
    el('div', { style: 'text-align:right' }, '# Qty'),
    el('div', {}, 'Qty Type'),
    el('div', { style: 'text-align:right' }, '$/Qty'),
    el('div', { style: 'text-align:right' }, '$ Amt'),
  );
  sticky.appendChild(colHdr);
  root.appendChild(sticky);

  if (countChecked() === 0) {
    root.appendChild(el('div', { class: 'home-empty' },
      'No items selected yet. Check items on the Questionnaire tab and they will appear here for pricing.'));
    return root;
  }

  SCHEMA.phase3.forEach((group, gi) => {
    if (!group.sections.length) return;
    const isInterior = group.name === 'Interior';
    const groupBody = el('div', { class: 'section-body group-body' });
    let groupHasChecked = false;
    let groupSum = 0;
    // Derive sub-section + row tints from the group banner color. Sub-section
    // headers get a medium-light tint (still readable text); idle line-item
    // rows get an even lighter tint; rows with a non-zero $ Amt get a slightly
    // more saturated version of the same hue so "priced" reads at a glance.
    const groupColor = GROUP_COLORS[group.name];
    const subHeaderBg = groupColor ? lightenHex(groupColor, 0.55) : '';
    const subHeaderTxt = groupColor ? textOn(subHeaderBg) : '';
    const rowIdleBg = groupColor ? lightenHex(groupColor, 0.88) : '';
    const rowPricedBg = groupColor ? lightenHex(groupColor, 0.72) : '#f0fdf4';
    group.sections.forEach((sec, si) => {
      const checkedItems = sec.items
        .map((item, ii) => ({ item, ii }))
        .filter(o => isChecked(gi, si, o.ii));
      if (!checkedItems.length) return;
      groupHasChecked = true;
      const secBody = el('div', { class: 'section-body' });
      checkedItems.forEach(({ item, ii }) => {
        secBody.appendChild(
          isInterior
            ? renderInteriorDetailItem(gi, si, ii, item, summary, { rowIdleBg, rowPricedBg })
            : renderDetailItem(gi, si, ii, item, summary, { rowIdleBg, rowPricedBg })
        );
      });
      let secSum = 0;
      checkedItems.forEach(({ ii }) => { secSum += getDetailItemTotal(gi, si, ii); });
      groupSum += secSum;
      const secHeaderStyle = subHeaderBg
        ? `background:${subHeaderBg};color:${subHeaderTxt}`
        : '';
      const secNode = el('section', { class: 'section' },
        el('header', { class: 'section-header', style: secHeaderStyle,
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
          el('span', { style: 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0' }, sec.name),
          el('span', { class: 'section-collapsed-badge', 'data-b-badge': gi + '.' + si }, fmtMoney(secSum)),
          el('span', { class: 'chev', style: subHeaderTxt ? `color:${subHeaderTxt}` : '' }, '▼')
        ),
        secBody
      );
      groupBody.appendChild(secNode);
    });
    if (!groupHasChecked) return;
    const groupBadge = el('span', { class: 'section-collapsed-badge', 'data-b-badge-group': gi }, fmtMoney(groupSum));
    const groupNode = el('section', { class: 'section group-section' }, groupHeader(group.name, groupBadge));
    if (isInterior) groupNode.appendChild(renderInteriorStatusHeader());
    groupNode.appendChild(groupBody);
    root.appendChild(groupNode);
  });
  // CAPEX Groups manager — user-defined buckets used by any % line item.
  root.appendChild(renderCapexGroupsSection(summary));
  return root;
}

// Render the Options/Finish cell for a Details row. Returns a node that
// occupies one grid cell. For items with at least one entry on the Options
// tab, a <select> dropdown of finishes is rendered. Picking a finish writes
// `finish` to state and CLEARS `unit_cost` (so the Options-tab rate takes
// over via getEffectiveUnitCost). The user's subsequent typed override in
// $/Qty re-populates `unit_cost`, which then wins (sticky override).
// For items without options, a gray-disabled empty cell is shown.
// Stale-finish handling: if v.finish names a finish that's no longer on
// item.options, the saved name is included as a disabled "(removed) — X"
// option so the row keeps its visible state until the user picks something
// new (the row's last unit_cost stays frozen via getEffectiveUnitCost).
function renderOptionsCell(gi, si, ii, item, onChange) {
  const v = getP3(gi, si, ii);
  const opts = Array.isArray(item.options) ? item.options : [];
  if (!opts.length && !v.finish) {
    return el('div', {
      style: 'min-height:22px;background:#e5e7eb;border-radius:4px',
      title: 'No finish options defined for this item',
    });
  }
  const sel = el('select', {
    style: 'width:100%;padding:3px 4px;font-size:12px;box-sizing:border-box',
    'data-finish-select': '',
  });
  sel.appendChild(el('option', { value: '' }, '—'));
  const seen = new Set();
  opts.forEach(o => {
    if (!o || !o.finish) return;
    seen.add(o.finish);
    const opt = el('option', { value: o.finish }, o.finish);
    if (v.finish === o.finish) opt.selected = true;
    sel.appendChild(opt);
  });
  // Stale finish (e.g. removed from the Options tab after a roundtrip): keep
  // the saved value visible as a disabled option so the user notices and
  // re-picks. Last unit_cost stays frozen via getEffectiveUnitCost.
  if (v.finish && !seen.has(v.finish)) {
    const opt = el('option', { value: v.finish }, `(removed) — ${v.finish}`);
    opt.selected = true;
    opt.disabled = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    // Picking a finish clears any prior typed override so the Options-tab
    // rate takes effect. If the user wants to override, they type in $/Qty.
    setP3(gi, si, ii, { finish: sel.value, unit_cost: '' });
    if (typeof onChange === 'function') onChange(sel.value);
  });
  return sel;
}

function renderDetailItem(gi, si, ii, item, summaryNode, tints) {
  const v = getP3(gi, si, ii);
  // Legacy migration: the old "=MF" checkbox (removed 2026-07-07) is superseded by
  // the "MF Unit" Basics-linked Qty Type. Convert any lingering mf_linked row to
  // unit_type 'MF Unit' so it keeps auto-filling # Qty from # of MF Units.
  if (v.mf_linked) {
    setP3(gi, si, ii, { unit_type: 'MF Unit', mf_linked: false });
  }
  // Basics-linked Qty Type: force qty from the mapped property value before the
  // initial total is computed (so $ Amt is right on first render, not just after
  // the next recompute).
  {
    const cur0 = getP3(gi, si, ii);
    const bv0 = basicsQtyValue(cur0.unit_type || item.default_qty_type || '');
    if (bv0 != null && (Number(cur0.qty) || 0) !== bv0) setP3(gi, si, ii, { qty: bv0 });
  }
  const total = getDetailItemTotal(gi, si, ii);
  // Group-derived tints: idle = very-light group color, priced = slightly more
  // saturated of the same hue. renderDetailTotals reads these from dataset to
  // re-tint as the user types.
  const rowIdleBg = (tints && tints.rowIdleBg) || '';
  const rowPricedBg = (tints && tints.rowPricedBg) || '#f0fdf4';

  // Single-line row using the same 6-col grid as the sticky header. The .detail-item-wrap
  // class + data-ckkey attribute let recomputePctRowsAndSummary walk every row to
  // refresh % calculations when a non-% row's qty or cost changes.
  const itemWrap = el('div', {
    class: 'detail-item-wrap',
    style: DETAIL_GRID_BASE + ';border-bottom:1px solid #e5e7eb;background:' + (total > 0 ? rowPricedBg : rowIdleBg)
  });
  itemWrap.dataset.ckkey = ckKey(gi, si, ii);
  itemWrap.dataset.bgIdle = rowIdleBg;
  itemWrap.dataset.bgPriced = rowPricedBg;

  // Col 1: item name (GL account dropped per user request — kept in schema for
  // export but not displayed on Details rows).
  const nameCell = el('div', { style: 'min-width:0;overflow:hidden' },
    el('div', { style: 'font-size:13px;font-weight:600;color:#0f172a;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, item.name)
  );
  itemWrap.appendChild(nameCell);

  // Inputs are declared up front so the type-change handler can flip
  // qty/cost readonly state.
  const qtyInp = el('input', {
    type: 'text', inputmode: 'decimal',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box'
  });
  setNumVal(qtyInp, v.qty);
  qtyInp.addEventListener('input', () => {
    if (qtyInp.readOnly) return;
    setP3(gi, si, ii, { qty: numVal(qtyInp) });
    recomputePctRowsAndSummary(summaryNode);
  });
  qtyInp.addEventListener('blur', () => setNumVal(qtyInp, numVal(qtyInp)));

  // Col 2: Options/Finish picker. When the user picks a finish, the row's
  // unit_cost is cleared so the Options-tab rate flows through; we then push
  // the new effective rate into costInp as the visible value. The user can
  // still type to override (sticky).
  const optionsCell = renderOptionsCell(gi, si, ii, item, () => {
    const eff = getEffectiveUnitCost(gi, si, ii);
    if (costInp) {
      setNumVal(costInp, eff ? eff : '');
    }
    recomputePctRowsAndSummary(summaryNode);
  });
  itemWrap.appendChild(optionsCell);

  // Col 4: # Qty (interpreted as the percentage value when unit_type === '%')
  itemWrap.appendChild(qtyInp);

  // Col 4: Qty Type
  // If the schema carries a default_qty_type for this item (from column G of
  // Capex_Builder_Line_Items_Control.xlsx) and the user has not picked one yet,
  // pre-select the default. Users can still override to anything in the list,
  // and selecting "—" effectively means "fall back to the default on next render."
  const effectiveUT = v.unit_type || item.default_qty_type || '';
  const utSel = el('select', { style: 'width:100%;padding:3px 4px;font-size:12px;box-sizing:border-box' });
  fillQtyTypeOptions(utSel, effectiveUT);
  utSel.addEventListener('change', () => {
    setP3(gi, si, ii, { unit_type: utSel.value });
    syncTypeRelatedUI();
    recomputePctRowsAndSummary(summaryNode);
  });
  itemWrap.appendChild(utSel);

  // Col 6: $/Qty — becomes a read-only display (group total ÷ 100) when type === '%'.
  // When a Finish is picked and no override is typed yet, the input displays
  // the Options-tab rate as its value (still editable — typing makes it a
  // sticky override that survives later Finish changes).
  const defaultRate = (item.default_cost_per_item != null && item.default_cost_per_item !== '') ? item.default_cost_per_item : '';
  const costInp = el('input', {
    type: 'text', inputmode: 'decimal',
    placeholder: defaultRate ? formatNumberWithCommas(defaultRate) : '',
    class: 'detail-cost-input',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box'
  });
  costInp.setAttribute('data-cost-input', '');
  if (v.unit_cost !== '' && v.unit_cost !== null && v.unit_cost !== undefined) {
    setNumVal(costInp, v.unit_cost);
  } else if (v.finish) {
    const eff = getEffectiveUnitCost(gi, si, ii);
    setNumVal(costInp, eff ? eff : '');
  } else {
    costInp.value = '';
  }
  costInp.addEventListener('input', () => {
    if (costInp.readOnly) return;
    setP3(gi, si, ii, { unit_cost: numVal(costInp) });
    recomputePctRowsAndSummary(summaryNode);
  });
  costInp.addEventListener('blur', () => { if (!costInp.readOnly) setNumVal(costInp, numVal(costInp)); });
  itemWrap.appendChild(costInp);

  // Col 6: $ Amt (computed, read-only display — driven by getDetailItemTotal so
  // % rows render correctly out of the gate).
  const totalEl = el('div', {
    'data-total': true,
    style: 'text-align:right;font-weight:700;font-size:13px;color:#0f172a'
  }, fmtMoney(total));
  itemWrap.appendChild(totalEl);

  // --- Sub-row: only visible when unit_type === '%' ---
  // Lets the user pick which CAPEX Group this percentage applies to. Spans all
  // 6 grid columns via grid-column:1/-1 so it sits below the line item.
  const subRow = el('div', {
    class: 'detail-pct-subrow',
    style: 'grid-column:1/-1;padding:4px 4px 8px 4px;display:none;align-items:center;gap:8px;font-size:12px;color:#475569;flex-wrap:wrap'
  });
  subRow.appendChild(el('span', { style: 'font-weight:600' }, '% of:'));
  const grpSel = el('select', {
    style: 'flex:1;min-width:140px;max-width:280px;padding:3px 4px;font-size:12px;box-sizing:border-box',
  });
  grpSel.setAttribute('data-pct-group-select', '');
  // Populate initial options — refreshAllPctGroupSelects keeps these current.
  grpSel.appendChild(el('option', { value: '' }, '— pick a CAPEX Group —'));
  ensureCapexGroups().filter(g => (g.name || '').trim()).forEach(g => {
    const o = el('option', { value: g.id }, g.name);
    if (v.pct_group_id === g.id) o.selected = true;
    grpSel.appendChild(o);
  });
  grpSel.addEventListener('change', () => {
    setP3(gi, si, ii, { pct_group_id: grpSel.value });
    syncTypeRelatedUI();
    recomputePctRowsAndSummary(summaryNode);
  });
  subRow.appendChild(grpSel);
  const grpTotEl = el('span', { 'data-pct-grouptotal': '', style: 'color:#64748b;font-style:italic;white-space:nowrap' }, '');
  subRow.appendChild(grpTotEl);
  itemWrap.appendChild(subRow);

  // Apply type-dependent UI: show/hide sub-row, toggle cost input read-only,
  // and display the auto-computed $/Qty value for % rows.
  function syncTypeRelatedUI() {
    const cur = getP3(gi, si, ii);
    // # Qty: Basics-linked Qty Types auto-fill (read-only) from the property value.
    const bv = basicsQtyValue(cur.unit_type);
    if (bv != null) {
      if ((Number(cur.qty) || 0) !== bv) setP3(gi, si, ii, { qty: bv });
      setNumVal(qtyInp, bv || '');
      qtyInp.readOnly = true;
      qtyInp.style.background = '#f1f5f9';
      qtyInp.title = bv
        ? `Auto-filled from Basics → ${cur.unit_type}`
        : `Auto-filled from Basics → ${cur.unit_type} (not set — enter it on the Basics tab)`;
    } else {
      qtyInp.readOnly = false;
      qtyInp.style.background = '';
      qtyInp.title = '';
    }
    if (cur.unit_type === '%') {
      subRow.style.display = 'flex';
      const grpTotal = getCapexGroupTotal(cur.pct_group_id);
      setNumVal(costInp, grpTotal ? Number((grpTotal / 100).toFixed(2)) : '');
      costInp.readOnly = true;
      costInp.style.background = '#f1f5f9';
      costInp.title = 'Auto-computed: selected CAPEX Group total ÷ 100';
      grpTotEl.textContent = grpTotal ? `(group: ${fmtMoney(grpTotal)})` : '(no group total yet)';
    } else {
      subRow.style.display = 'none';
      costInp.readOnly = false;
      costInp.style.background = '';
      costInp.title = '';
      if (cur.unit_cost !== '' && cur.unit_cost !== null && cur.unit_cost !== undefined) {
        setNumVal(costInp, cur.unit_cost);
      } else if (cur.finish) {
        const eff = getEffectiveUnitCost(gi, si, ii);
        setNumVal(costInp, eff ? eff : '');
      } else {
        costInp.value = '';
      }
    }
  }
  syncTypeRelatedUI();

  // Conditional companion fields (e.g. parking suggestion/cost on '# Parking Add - New Cover').
  if (Array.isArray(item.conditional_fields) && item.conditional_fields.length) {
    itemWrap.appendChild(renderItemConditionalFields(gi, si, ii, item, summaryNode));
  }

  return itemWrap;
}
// Interior-group line-item row. Same total/$Amt machinery as renderDetailItem,
// but the =MF column is replaced by three % inputs (Orig./Part./Reno) and the
// # Qty cell is read-only and auto-computed via recomputeInteriorRowQty().
function renderInteriorDetailItem(gi, si, ii, item, summaryNode, tints) {
  const v = getP3(gi, si, ii);
  // Ensure qty is in sync with current pct values + unit-mix counts before first render.
  const counts = getUnitStatusCounts();
  recomputeInteriorRowQty(gi, si, ii, counts);
  const total = getDetailItemTotal(gi, si, ii);
  const rowIdleBg = (tints && tints.rowIdleBg) || '';
  const rowPricedBg = (tints && tints.rowPricedBg) || '#f0fdf4';

  const itemWrap = el('div', {
    class: 'detail-item-wrap detail-item-interior',
    style: DETAIL_GRID_BASE_INTERIOR + ';border-bottom:1px solid #e5e7eb;background:' + (total > 0 ? rowPricedBg : rowIdleBg)
  });
  itemWrap.dataset.ckkey = ckKey(gi, si, ii);
  itemWrap.dataset.bgIdle = rowIdleBg;
  itemWrap.dataset.bgPriced = rowPricedBg;
  itemWrap.dataset.interior = '1';

  // Col 1: item name
  itemWrap.appendChild(el('div', { style: 'min-width:0;overflow:hidden' },
    el('div', { style: 'font-size:13px;font-weight:600;color:#0f172a;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, item.name)
  ));

  // Cols 2-4: pct_orig / pct_part / pct_reno inputs
  const qtyInp = el('input', {
    type: 'text', inputmode: 'numeric',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box;background:#f1f5f9'
  });
  qtyInp.setAttribute('data-qty-input', '');
  qtyInp.readOnly = true;
  const refreshQtyDisplay = () => {
    const cur = getP3(gi, si, ii);
    setNumVal(qtyInp, (Number(cur.qty) || 0) || '');
    const sizing = avgSizingForUnitType(cur.unit_type);
    qtyInp.title = sizing != null
      ? `Auto-computed: Σ (% × unit-status total) × avg ${cur.unit_type.replace(/^Avg /, '')} `
        + `(${sizing < 10 ? sizing.toFixed(1) : Math.round(sizing).toLocaleString()}), rounded`
      : 'Auto-computed: Σ (% × matching unit-status total), rounded';
  };
  function mkPctInput(field) {
    const baseStyle = 'width:100%;padding:4px 4px;font-size:12px;text-align:right;box-sizing:border-box';
    const errStyle = baseStyle + ';border:1px solid #dc2626;background:#fef2f2;color:#dc2626';
    const inp = el('input', {
      type: 'number', min: 1, max: 100, step: 'any',
      placeholder: '%',
      style: baseStyle
    });
    inp.value = v[field] !== '' && v[field] !== undefined && v[field] !== null ? v[field] : '';
    const clearError = () => { inp.style = baseStyle; inp.setCustomValidity(''); };
    const showError = () => {
      inp.style = errStyle;
      inp.setCustomValidity('Please enter a number between 1 and 100.');
      toast('Please enter a number between 1 and 100', 'error');
    };
    inp.addEventListener('input', () => {
      const raw = inp.value;
      if (raw === '') {
        clearError();
        setP3(gi, si, ii, { [field]: '' });
      } else {
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 1 || n > 100) {
          showError();
          // Don't persist an invalid value — row qty stays computed from the
          // last valid set of %s. User can correct and the row updates.
          return;
        }
        clearError();
        setP3(gi, si, ii, { [field]: n });
      }
      recomputeInteriorRowQty(gi, si, ii);
      refreshQtyDisplay();
      recomputePctRowsAndSummary(summaryNode);
    });
    return inp;
  }
  itemWrap.appendChild(mkPctInput('pct_orig'));
  itemWrap.appendChild(mkPctInput('pct_part'));
  itemWrap.appendChild(mkPctInput('pct_reno'));

  // Col 5: Options/Finish picker (same semantics as non-Interior — see
  // renderOptionsCell). Picking a finish clears any user override so the
  // Options-tab rate flows through; the $/Qty input is then refreshed.
  itemWrap.appendChild(renderOptionsCell(gi, si, ii, item, () => {
    const eff = getEffectiveUnitCost(gi, si, ii);
    if (costInp) setNumVal(costInp, eff ? eff : '');
    recomputePctRowsAndSummary(summaryNode);
  }));

  // Col 6: # Qty (read-only computed)
  refreshQtyDisplay();
  itemWrap.appendChild(qtyInp);

  // Col 6: Qty Type
  const effectiveUT = v.unit_type || item.default_qty_type || '';
  const utSel = el('select', { style: 'width:100%;padding:3px 4px;font-size:12px;box-sizing:border-box' });
  fillQtyTypeOptions(utSel, effectiveUT);
  utSel.addEventListener('change', () => {
    setP3(gi, si, ii, { unit_type: utSel.value });
    // Switching to/from an Avg-* sizing type changes the auto-computed # Qty.
    recomputeInteriorRowQty(gi, si, ii);
    refreshQtyDisplay();
    recomputePctRowsAndSummary(summaryNode);
  });
  itemWrap.appendChild(utSel);

  // Col 8: $/Qty. When a Finish is picked and no override is typed yet, the
  // input displays the Options-tab rate; typing makes it a sticky override.
  const defaultRate = (item.default_cost_per_item != null && item.default_cost_per_item !== '') ? item.default_cost_per_item : '';
  const costInp = el('input', {
    type: 'text', inputmode: 'decimal',
    placeholder: defaultRate ? formatNumberWithCommas(defaultRate) : '',
    class: 'detail-cost-input',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box'
  });
  costInp.setAttribute('data-cost-input', '');
  if (v.unit_cost !== '' && v.unit_cost !== null && v.unit_cost !== undefined) {
    setNumVal(costInp, v.unit_cost);
  } else if (v.finish) {
    const eff = getEffectiveUnitCost(gi, si, ii);
    setNumVal(costInp, eff ? eff : '');
  } else {
    costInp.value = '';
  }
  costInp.addEventListener('input', () => {
    setP3(gi, si, ii, { unit_cost: numVal(costInp) });
    recomputePctRowsAndSummary(summaryNode);
  });
  costInp.addEventListener('blur', () => setNumVal(costInp, numVal(costInp)));
  itemWrap.appendChild(costInp);

  // Col 8: $ Amt
  itemWrap.appendChild(el('div', {
    'data-total': true,
    style: 'text-align:right;font-weight:700;font-size:13px;color:#0f172a'
  }, fmtMoney(total)));

  return itemWrap;
}

function renderDetailTotals(itemWrap, gi, si, ii) {
  // Centralized via getDetailItemTotal so % rows compute correctly here too.
  const total = getDetailItemTotal(gi, si, ii);
  const t = itemWrap.querySelector('[data-total]');
  if (t) t.textContent = fmtMoney(total);
  // Use the group-derived tints stashed on the row at render time (see
  // renderDetailItem). Falls back to the legacy green/blank if the dataset
  // is missing for any reason.
  const idle = itemWrap.dataset.bgIdle || '';
  const priced = itemWrap.dataset.bgPriced || '#f0fdf4';
  itemWrap.style.background = total > 0 ? priced : idle;
}
function updateDetailSummary(node) {
  if (!node) return;
  const totals = computeTotals();
  const countEl = node.querySelector('[data-stat="count"]');
  const subtotalEl = node.querySelector('[data-stat="subtotal"]');
  const perUnitEl = node.querySelector('[data-stat="perunit"]');
  if (countEl) countEl.textContent = String(totals.itemCount);
  if (subtotalEl) subtotalEl.textContent = fmtMoney(totals.subtotal);
  if (perUnitEl) perUnitEl.textContent = fmtMoney(totals.subtotalPerUnit);
}

// ---------- CAPEX Groups manager (bottom of Details page) ----------
// Section listing all user-defined CAPEX Groups, with a top-level "+ Add Group"
// button. Each group renders as a card with a name input, an Add Item picker
// (styled <select> so mobile gets the native picker), a Save button, and a
// delete button — plus the list of items in the group with per-item delete.
function renderCapexGroupsSection(summaryNode) {
  const section = el('section', { class: 'section', style: 'margin-top:20px' });
  const header = el('header', {
    class: 'section-header',
    style: 'background:#0f172a;color:#fff',
    onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed'),
  });
  header.appendChild(el('span', {}, 'CAPEX GROUPS'));
  header.appendChild(el('span', { class: 'chev', style: 'color:#fff' }, '▼'));
  section.appendChild(header);

  const body = el('div', { class: 'section-body' });
  section.appendChild(body);

  function rebuild() {
    body.innerHTML = '';
    const groups = ensureCapexGroups();

    body.appendChild(el('div', { class: 'muted small', style: 'padding:4px 16px 8px' },
      'Create named buckets of line items to use as the base for any line item priced as a percentage. ' +
      (groups.length === 0
        ? 'No groups yet — tap + Add Group to start.'
        : `${groups.length} group${groups.length === 1 ? '' : 's'} defined.`)
    ));

    body.appendChild(el('div', { style: 'padding:0 16px 12px' },
      el('button', {
        class: 'um-btn',
        style: 'white-space:nowrap;font-size:13px;padding:8px 14px',
        onClick: () => {
          createCapexGroup();
          rebuild();
          refreshAllPctGroupSelects();
        },
      }, '+ Add Group')
    ));

    groups.forEach(grp => body.appendChild(renderCapexGroupCard(grp, rebuild, summaryNode)));
  }

  rebuild();
  return section;
}

function renderCapexGroupCard(grp, rebuildList, summaryNode) {
  const card = el('div', {
    style: 'border:1px solid #e5e7eb;border-radius:8px;margin:6px 16px;background:#fff;overflow:hidden'
  });

  // Top row — name input + Add Item (styled select) + Save + Delete group.
  const topRow = el('div', {
    style: 'display:flex;align-items:center;gap:6px;padding:10px 12px;background:#f8fafc;border-bottom:1px solid #e5e7eb;flex-wrap:wrap'
  });

  const nameInp = el('input', {
    type: 'text', placeholder: 'Group name (e.g. Hard Costs)',
    style: 'flex:1;min-width:140px;padding:6px 8px;font-size:13px;font-weight:600;border:1px solid #cbd5e1;border-radius:4px',
  });
  nameInp.value = grp.name || '';
  // Auto-save name keystrokes so users do not lose work; the % dropdowns and
  // Add Item selector also live-update from the latest name.
  nameInp.addEventListener('input', () => {
    updateCapexGroup(grp.id, { name: nameInp.value });
    refreshAllPctGroupSelects();
    rebuildAddOptions();
  });

  // + Add Item — a <select> styled as a button. On mobile this triggers the
  // native picker; on desktop it opens an inline list. Options auto-filter to
  // checked items not already in the group and exclude % rows (anti-recursion).
  const addSel = el('select', {
    style: 'white-space:nowrap;font-size:12px;font-weight:600;padding:6px 10px;background:#1d2d47;color:#fff;border:none;border-radius:4px;cursor:pointer',
  });
  function rebuildAddOptions() {
    addSel.innerHTML = '';
    const ready = !!(grp.name || '').trim();
    addSel.appendChild(el('option', { value: '' }, ready ? '+ Add Item' : '+ Add Item (name first)'));
    if (!ready) {
      addSel.disabled = true;
      addSel.style.opacity = '0.55';
      addSel.style.cursor = 'not-allowed';
      return;
    }
    addSel.disabled = false;
    addSel.style.opacity = '1';
    addSel.style.cursor = 'pointer';
    const existing = new Set(grp.itemKeys || []);
    let added = 0;
    SCHEMA.phase3.forEach((g, gi) => {
      g.sections.forEach((s, si) => {
        s.items.forEach((it, ii) => {
          if (!isChecked(gi, si, ii)) return;
          const k = ckKey(gi, si, ii);
          if (existing.has(k)) return;
          const v = getP3(gi, si, ii);
          if (v.unit_type === '%') return; // exclude % rows to prevent recursion
          addSel.appendChild(el('option', { value: k }, `${g.name} → ${it.name}`));
          added++;
        });
      });
    });
    if (!added) {
      addSel.appendChild(el('option', { value: '', disabled: true }, 'No eligible items — check more on the Questionnaire'));
    }
  }
  rebuildAddOptions();
  addSel.addEventListener('change', () => {
    if (!addSel.value) return;
    grp.itemKeys = grp.itemKeys || [];
    grp.itemKeys.push(addSel.value);
    saveState();
    addSel.value = '';
    rebuildList();
    refreshAllPctGroupSelects();
    recomputePctRowsAndSummary(summaryNode);
  });

  const saveBtn = el('button', {
    style: 'white-space:nowrap;font-size:12px;font-weight:600;padding:6px 12px;background:#16a34a;color:#fff;border:none;border-radius:4px;cursor:pointer',
    title: 'Persist this group and refresh % dropdowns',
    onClick: () => {
      saveState();
      refreshAllPctGroupSelects();
      recomputePctRowsAndSummary(summaryNode);
      const label = (grp.name || '').trim() || '(unnamed)';
      toast(`Saved "${label}"`, 'success');
    },
  }, '💾 Save');

  const delBtn = el('button', {
    title: 'Delete this group',
    style: 'white-space:nowrap;font-size:14px;padding:6px 10px;background:#fee2e2;color:#991b1b;border:1px solid #fecaca;border-radius:4px;cursor:pointer',
    onClick: () => {
      if (!confirm(`Delete CAPEX Group "${grp.name || '(unnamed)'}"?\n\nAny % line items referencing it will lose their group selection.`)) return;
      removeCapexGroup(grp.id);
      rebuildList();
      refreshAllPctGroupSelects();
      recomputePctRowsAndSummary(summaryNode);
    },
  }, '✕');

  topRow.appendChild(nameInp);
  topRow.appendChild(addSel);
  topRow.appendChild(saveBtn);
  topRow.appendChild(delBtn);
  card.appendChild(topRow);

  // Items list (or empty-state hint).
  const itemsList = el('div', { style: 'padding:6px 12px' });
  if (!grp.itemKeys || !grp.itemKeys.length) {
    itemsList.appendChild(el('div', { class: 'muted small', style: 'padding:8px 0;font-style:italic' },
      (grp.name || '').trim()
        ? 'No items yet — use + Add Item to pick from your BUDGET $ rows.'
        : 'Type a name above, then use + Add Item to pick rows.'
    ));
  } else {
    grp.itemKeys.forEach((key, idx) => {
      const it = getSchemaItemByKey(key);
      const parts = key.split('.').map(Number);
      const itemTotal = (parts.length === 3 && !parts.some(isNaN))
        ? getDetailItemTotal(parts[0], parts[1], parts[2])
        : 0;
      const row = el('div', {
        style: 'display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px'
      });
      row.appendChild(el('span', { style: 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#0f172a' },
        it ? it.name : `(missing item ${key})`
      ));
      row.appendChild(el('span', { style: 'color:#64748b;white-space:nowrap;font-size:12px' },
        itemTotal > 0 ? fmtMoney(itemTotal) : '—'
      ));
      row.appendChild(el('button', {
        title: 'Remove from this group',
        style: 'width:26px;height:26px;font-size:13px;background:transparent;color:#991b1b;border:1px solid #fecaca;border-radius:4px;cursor:pointer;padding:0;line-height:1',
        onClick: () => {
          grp.itemKeys.splice(idx, 1);
          saveState();
          rebuildList();
          refreshAllPctGroupSelects();
          recomputePctRowsAndSummary(summaryNode);
        },
      }, '✕'));
      itemsList.appendChild(row);
    });
    const grpTotal = getCapexGroupTotal(grp.id);
    itemsList.appendChild(el('div', {
      style: 'display:flex;justify-content:flex-end;padding:8px 0 4px;font-size:12px;color:#475569;font-weight:600'
    }, `Group total: ${fmtMoney(grpTotal)}`));
  }
  card.appendChild(itemsList);

  return card;
}

// ---------- Phase 4: Review ----------
function computeTotals() {
  let subtotal = 0;
  let itemCount = 0;
  const byGroup = {};
  SCHEMA.phase3.forEach((g, gi) => {
    byGroup[g.name] = 0;
    g.sections.forEach((s, si) => {
      s.items.forEach((it, ii) => {
        if (!isChecked(gi, si, ii)) return; // only priced items that are selected
        // Use getDetailItemTotal so % rows contribute their group-scaled value
        // (qty/100 × CAPEX Group total) instead of qty × literal unit_cost.
        const t = getDetailItemTotal(gi, si, ii);
        if (t > 0) { subtotal += t; itemCount += 1; byGroup[g.name] += t; }
      });
    });
  });
  // Contingency & construction-mgmt fee are NOT computed here anymore — they live
  // downstream in the MFVA proforma (CAPEX tab), applied to the Multifamily
  // Subtotal there. The Capex Builder is now the source of the line-item budget only.
  const units = Number(STATE.phase1.mf_units) || 0;
  const subtotalPerUnit = units > 0 ? subtotal / units : 0;
  return { subtotal, subtotalPerUnit, itemCount, byGroup };
}

// Items checked on the Budget tab that, if present, flag a Revenue Driver or
// Opex Reducer note on Finalize. Extend these tables as new examples come up —
// `match` tests the schema item's name; `note` is the line shown to the user.
const REVENUE_DRIVER_RULES = [
  { match: (name) => name === 'Private Yard', note: 'Private Yards — adding private yards can support a rent premium.' },
];
const OPEX_REDUCER_RULES = [
  { match: (name) => name === 'Toilet', note: 'New Toilets — low-flow toilet replacements reduce water/sewer utility cost.' },
];
// Empty for now — the user will specify what belongs here in a follow-up.
const RED_FLAG_RULES = [];

// Walks every checked Budget item and returns the de-duped notes whose rule matched.
function collectBudgetFlags(rules) {
  const notes = [];
  SCHEMA.phase3.forEach((g, gi) => {
    g.sections.forEach((s, si) => {
      s.items.forEach((it, ii) => {
        if (!isChecked(gi, si, ii)) return;
        rules.forEach((rule) => {
          if (rule.match(it.name) && !notes.includes(rule.note)) notes.push(rule.note);
        });
      });
    });
  });
  return notes;
}

// Collapsible section with a colored header/background — used for Sanity Check,
// Revenue Drivers, and Opex Reducers below.
function renderFlagSection(title, color, bg, lines, emptyText, startCollapsed) {
  // A flag box stays NEUTRAL GRAY until it actually has data — it only adopts its
  // signal color (green/red/navy) once there's something to show.
  const GRAY_TEXT = '#6b7280', GRAY_BG = '#f3f4f6';
  const hasData = lines.length > 0;
  const effColor = hasData ? color : GRAY_TEXT;
  const effBg = hasData ? bg : GRAY_BG;
  const bgStyle = effBg ? `background:${effBg}` : '';
  const wrap = el('section', { class: 'section' + (startCollapsed ? ' collapsed' : ''), style: bgStyle },
    el('header', { class: 'section-header', style: `color:${effColor};${bgStyle}`, onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
      el('span', {}, title), el('span', { class: 'chev' }, '▼')),
    el('div', { class: 'section-body', style: bgStyle })
  );
  const body = wrap.querySelector('.section-body');
  if (hasData) {
    lines.forEach(w => body.appendChild(el('div', { class: 'field', style: `color:${effColor}` }, w)));
  } else {
    body.appendChild(el('div', { class: 'field', style: 'color:#64748b;font-style:italic' }, emptyText));
  }
  return wrap;
}

function renderPhase4() {
  const root = el('div');

  // Sanity-check warnings
  const warnings = [];
  if (!STATE.phase1.prop_name) warnings.push('Property name is missing (Phase 1).');
  if (!STATE.phase1.mf_units) warnings.push('# of MF Units is missing (Basics) — per-unit metric will be $0.');
  const p2Filled = Object.values(STATE.phase2).filter(v => Array.isArray(v) ? v.length : Boolean(v)).length;
  if (p2Filled === 0) warnings.push('Physical characteristics (Basics tab) appear empty.');
  if (countChecked() === 0) warnings.push('No capex items selected on the Questionnaire tab.');
  // Building & Site area-consistency red flag: paved + footprint + impervious + pervious
  // should not exceed the total site area (= Land Sqft).
  {
    const p1 = STATE.phase1 || {};
    const site = Number(p1.total_site_area_sf) || Number(p1.land_sf) || 0;
    const sum = ['parking_lot_sf', 'total_footprint_sf', 'other_impervious_sf', 'landscaping_sf']
      .reduce((a, k) => a + (Number(p1[k]) || 0), 0);
    if (site > 0 && sum > site) {
      warnings.push(`🚩 Site area mismatch: Parking + Buildings Footprint + Other Impervious + Pervious = ${sum.toLocaleString()} sqft exceeds Total Site Area ${site.toLocaleString()} sqft (over by ${(sum - site).toLocaleString()}).`);
    }
  }

  root.appendChild(renderFlagSection('Sanity Check', '#dc2626', null, warnings, 'No issues found.', warnings.length === 0));

  // Revenue Drivers — green; Opex Reducers — red. Populated from REVENUE_DRIVER_RULES /
  // OPEX_REDUCER_RULES against whatever is checked on the Budget tab. Collapsed by
  // default unless there's something to show.
  const revenueLines = collectBudgetFlags(REVENUE_DRIVER_RULES);
  root.appendChild(renderFlagSection('Revenue Drivers', '#15803d', '#f0fdf4',
    revenueLines, 'No revenue-driving items currently selected on the Budget tab.', revenueLines.length === 0));
  const opexLines = collectBudgetFlags(OPEX_REDUCER_RULES);
  root.appendChild(renderFlagSection('Opex Reducers', '#b91c1c', '#fef2f2',
    opexLines, 'No opex-reducing items currently selected on the Budget tab.', opexLines.length === 0));

  // Red Flags / Considerations — gray, no rules wired up yet (placeholder for a future
  // request). Stays gray regardless of content — unlike Revenue/Opex this isn't a
  // green-good / red-bad signal, just a neutral running list.
  const redFlagLines = collectBudgetFlags(RED_FLAG_RULES);
  root.appendChild(renderFlagSection('Red Flags / Considerations', '#6b7280', '#f3f4f6',
    redFlagLines, 'No red flags or considerations yet.', redFlagLines.length === 0));

  // Notes — free-form. (Contingency & Construction Mgmt Fee were removed 2026-07-06:
  // they now live in the MFVA proforma CAPEX tab, applied to the Multifamily Subtotal,
  // so the Capex Builder no longer models them.)
  // Notes box stays gray until it has text (matches the flag boxes above).
  const notesField = renderField({ key: 'notes', label: 'Overall Notes', type: 'textarea', inline: false },
    STATE.phase4.notes, (v) => { STATE.phase4.notes = v; saveState(); grayWhenEmpty(notesBox); });
  const notesBox = notesField.querySelector('textarea, input');
  grayWhenEmpty(notesBox);
  if (notesBox) notesBox.addEventListener('input', () => grayWhenEmpty(notesBox));
  const adj = el('section', { class: 'section collapsed' },
    el('header', { class: 'section-header', onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
      el('span', {}, 'Overall Notes'), el('span', { class: 'chev' }, '▼')),
    el('div', { class: 'section-body' }, notesField)
  );
  root.appendChild(adj);

  // Export readiness — the buttons stay gray/disabled until the deal has the
  // minimum data for a meaningful export: a property name AND at least one
  // selected Budget item. (Without either, the export has no real content.)
  const missing = [];
  if (!STATE.phase1.prop_name) missing.push('a property name (Basics)');
  if (countChecked() === 0) missing.push('at least one selected Budget item (Questionnaire)');
  const exportReady = missing.length === 0;
  const readyTip = exportReady ? '' : 'Add ' + missing.join(' and ') + ' to enable export.';
  const btnStyle = (activeBg) => exportReady
    ? `flex:1 1 0;min-width:180px;padding:18px;background:${activeBg};color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer`
    : `flex:1 1 0;min-width:180px;padding:18px;background:#cbd5e1;color:#f8fafc;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:not-allowed`;

  // Export actions (side by side): download-only, and place into the deal's 25. Capex Drive folder.
  root.appendChild(el('div', { style: 'display:flex;gap:10px;margin-top:8px;flex-wrap:wrap' },
    el('button', {
      style: btnStyle('#1d2d47'), disabled: !exportReady, title: readyTip,
      onClick: exportXlsx
    }, '⬇  Export to Excel'),
    el('button', {
      style: btnStyle('#0f766e'), disabled: !exportReady, title: readyTip,
      onClick: placeInCapexFolder
    }, '☁  Place in Capex Folder')
  ));
  if (!exportReady) {
    root.appendChild(el('div', { style: 'margin-top:6px;color:#64748b;font-size:12px;font-style:italic' },
      'Export needs ' + missing.join(' and ') + '.'));
  }

  return root;
}

// ---------- Excel export ----------
// buildCapexWorkbook() mirrors the visual language of
// Control Excels/Budget_Details_Control.xlsx — group-colored full-width
// banners, light italic section banners, thin-bordered item rows, same
// column emphasis (Item Name / Options / Qty Type / $/Qty / GL / Notes) —
// but lists only this deal's CHECKED items with their real qty/rate/finish,
// i.e. a priced snapshot of THIS property rather than the blank universal
// line-item template. Split out from exportXlsx() so it can be built/tested
// without touching Drive.
async function buildCapexWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Capex Builder';
  workbook.created = new Date();
  const propName = STATE.phase1.prop_name || '';
  const units = Number(STATE.phase1.mf_units) || 0;
  const NAVY = 'FF1E3A8A', LIGHT = 'FFF1F5F9', BORDER_LIGHT = 'FFD1D5DB', WHITE = 'FFFFFFFF';
  const argb = (hex) => 'FF' + hex.replace('#', '').toUpperCase();
  const GRAY = 'FFE5E7EB'; // light gray for line items NOT worked on (unchecked) in the app
  const NEEDS = 'FFFDE68A'; // amber: Options cell that still needs a finish picked
  const styleCurrency = (cell) => { cell.numFmt = '"$"#,##0'; };
  // pct_orig/part/reno are stored as whole percentage points (80 = 80%), not
  // fractions — a literal "%" suffix (not Excel's auto-×100 '0%' format).
  const stylePct = (cell) => { cell.numFmt = '0"%"'; };

  // ===== Main "Capex Budget" sheet =====
  // Columns: A Section | B Item Name | C Options(Finish) | D % Orig | E % Part |
  // F % Reno | G # Qty | H Qty Type | I $/Qty | J Total | K GL Account | L Notes.
  // Section + Item are separate columns (no section banner rows); the % columns
  // sit just left of # Qty; only GROUPS get subtotals; each group's item rows are
  // an Excel outline band so a group can be collapsed with the [-] gutter button.
  const ws = workbook.addWorksheet('Capex Budget', { views: [{ state: 'frozen', xSplit: 0, ySplit: 7 }] });
  // Summary rows sit BELOW their detail band → collapse button lands on the
  // group subtotal row (Excel default, but set explicitly for clarity).
  ws.properties.outlineProperties = { summaryBelow: true, summaryRight: true };
  const COL_TOTAL = 10; // J
  ws.columns = [
    { width: 22 }, { width: 34 }, { width: 18 },
    { width: 8 }, { width: 8 }, { width: 8 },
    { width: 9 }, { width: 12 }, { width: 12 },
    { width: 15 }, { width: 28 }, { width: 30 },
  ];

  const titleRow = ws.addRow(['CAPEX BUDGET' + (propName ? ' — ' + propName.toUpperCase() : '')]);
  titleRow.font = { bold: true, size: 16, color: { argb: WHITE } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleRow.height = 24;
  titleRow.alignment = { vertical: 'middle' };
  ws.mergeCells(`A${titleRow.number}:L${titleRow.number}`);

  const propRow = ws.addRow(['Property:', propName]); propRow.getCell(1).font = { bold: true };
  const addrRow = ws.addRow(['Address:', [STATE.phase1.mailing_address, STATE.phase1.city, STATE.phase1.state, STATE.phase1.zip].filter(Boolean).join(', ')]);
  addrRow.getCell(1).font = { bold: true };
  const unitsRow = ws.addRow(['# Units:', units]); unitsRow.getCell(1).font = { bold: true };
  const yrRow = ws.addRow(['Year Built:', STATE.phase1.year_built || '']); yrRow.getCell(1).font = { bold: true };
  ws.addRow([]);

  // ----- Summary block (mirrors the proforma CAPEX tab so a standalone export
  // shares its exact layout). In a standalone export the Construction Mgmt Fee /
  // Contingency / Commercial Tenant Costs lines are $0 placeholders — those live
  // in the proforma — so Total Capex Budget = Multifamily Subtotal here. All $
  // values are backfilled after the detail is built. -----
  const mkSummary = (label, fillArgb, fontArgb, big) => {
    const row = ws.addRow([label, '', '', '', '', '', '', '', '', '', '', '']);
    row.eachCell({ includeEmpty: true }, (c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
      c.font = { bold: true, color: { argb: fontArgb }, size: big ? 14 : 11 };
    });
    if (big) row.height = 22;
    styleCurrency(row.getCell(COL_TOTAL));
    return row;
  };
  const commHex = GROUP_COLORS['Commercial Tenant Costs'] || '#FFCC66';
  const rowTotal = mkSummary('Total Capex Budget', NAVY, WHITE, true);
  const rowFee   = mkSummary('Construction Mgmt Fee', LIGHT, NAVY, false);
  const rowCont  = mkSummary('Contingency', LIGHT, NAVY, false);
  const rowComm  = mkSummary('Commercial Tenant Costs', argb(commHex), argb(textOn(commHex)), false);

  // Big banner marking the copy/paste boundary — sits directly above Multifamily Subtotal.
  const rowBanner = ws.addRow(['Copy/Paste Below This Line to Proforma', '', '', '', '', '', '', '', '', '', '', '']);
  rowBanner.eachCell({ includeEmpty: true }, (c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
    c.font = { bold: true, size: 13, color: { argb: WHITE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  rowBanner.height = 26;
  ws.mergeCells(`A${rowBanner.number}:L${rowBanner.number}`);

  const stRow = mkSummary('MULTIFAMILY SUBTOTAL', NAVY, WHITE, true);

  ws.addRow([]);
  const colHeaderRow = ws.addRow(['Section', 'Item Name', 'Options', '% Orig', '% Part', '% Reno', '# Qty', 'Qty Type', '$/Qty', 'Total', 'GL Account', 'Notes']);
  colHeaderRow.font = { bold: true, color: { argb: WHITE } };
  colHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  colHeaderRow.height = 22;
  colHeaderRow.eachCell((c) => { c.alignment = { horizontal: 'center', vertical: 'middle' }; });
  ws.views = [{ state: 'frozen', ySplit: colHeaderRow.number }];

  // Emit EVERY line item (full default list) so the export mirrors the proforma
  // CAPEX tab in its entirety. Items that were NOT worked on in the app (unchecked
  // on the Questionnaire) are rendered with a light-gray background so it's obvious
  // at a glance which items this deal actually touched.
  // Exclude the Commercial Tenant Costs group — it's represented by the top
  // "Commercial Tenant Costs" summary line and lives separately in the proforma;
  // the MF detail + Multifamily Subtotal cover the 6 multifamily groups only.
  const exportGroups = SCHEMA.phase3.map((group, gi) => {
    const sections = group.sections
      .map((sec, si) => ({
        sec, si,
        items: sec.items.map((item, ii) => ({ item, ii })),
      }))
      .filter((s) => s.items.length);
    return { group, gi, sections };
  }).filter((g) => g.sections.length && g.group.name !== 'Commercial Tenant Costs');

  const groupSubtotalAddrs = []; // Cell addresses like "J42" for the final grand-sum formula.

  exportGroups.forEach(({ group, gi, sections }) => {
    const groupColorHex = GROUP_COLORS[group.name] || '#1E3A8A';
    const groupFillArgb = argb(groupColorHex);
    const groupFontArgb = argb(textOn(groupColorHex));
    const rowTintArgb = argb(lightenHex(groupColorHex, 0.9));

    const gh = ws.addRow([group.name.toUpperCase(), '', '', '', '', '', '', '', '', '', '', '']);
    gh.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true, size: 12, color: { argb: groupFontArgb } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: groupFillArgb } };
    });
    gh.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    gh.height = 20;
    styleCurrency(gh.getCell(COL_TOTAL));

    let firstItemRowInGroup = null;
    let lastItemRowInGroup = null;

    sections.forEach(({ sec, si, items }) => {
      items.forEach(({ item, ii }) => {
        const worked = isChecked(gi, si, ii);   // "worked on in the app"
        const v = getP3(gi, si, ii);
        const qtyType = v.unit_type || item.default_qty_type || '';
        const isPct = qtyType === '%';
        const pct = (n) => (n === '' || n === null || n === undefined) ? '' : Number(n);

        let qty, finish, rate, pO, pP, pR, noteExtra = '';
        if (worked) {
          qty = Number(v.qty) || 0;
          finish = v.finish || '';
          pO = pct(v.pct_orig); pP = pct(v.pct_part); pR = pct(v.pct_reno);
          if (isPct) {
            const grp = findCapexGroup(v.pct_group_id);
            rate = getCapexGroupTotal(v.pct_group_id) / 100;
            noteExtra = `% of: ${grp && grp.name ? grp.name : '(no group selected)'}`;
          } else {
            rate = getEffectiveUnitCost(gi, si, ii);
          }
        } else {
          // Not worked on: blank inputs, show the schema default rate as a starting point.
          qty = ''; finish = ''; pO = ''; pP = ''; pR = '';
          const dc = Number(item.default_cost_per_item);
          rate = Number.isFinite(dc) ? dc : '';
        }
        const notesText = [worked ? v.notes : '', noteExtra].filter(Boolean).join(' — ');
        const rowFill = worked ? rowTintArgb : GRAY;

        // A Section | B Item | C Options | D/E/F % | G #Qty | H Qty Type | I $/Qty | J Total | K GL | L Notes
        const r = ws.addRow([
          sec.name, item.name, finish,
          pO, pP, pR,
          qty || '', qtyType, (rate === '' ? '' : (rate || 0)),
          '', // Total (col J) — live formula below
          item.gl_account || '', notesText,
        ]);
        // Total never shows an error (blank/text $/Qty) — falls back to 0.
        r.getCell(COL_TOTAL).value = { formula: `IFERROR(G${r.number}*I${r.number},0)`, result: (Number(qty) || 0) * (Number(rate) || 0) };
        stylePct(r.getCell(4)); stylePct(r.getCell(5)); stylePct(r.getCell(6));
        styleCurrency(r.getCell(9));
        styleCurrency(r.getCell(COL_TOTAL));   // per-row Total stays regular weight
        r.outlineLevel = 1; // collapsible under the group
        r.eachCell({ includeEmpty: true }, (c) => {
          c.border = { bottom: { style: 'hair', color: { argb: BORDER_LIGHT } } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } };
        });
        // Options cell needs a finish picked (item has finishes but none chosen) → amber.
        const hasOptions = Array.isArray(item.options) && item.options.length > 0;
        if (hasOptions && !finish) {
          r.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NEEDS } };
        }

        if (firstItemRowInGroup === null) firstItemRowInGroup = r.number;
        lastItemRowInGroup = r.number;
      });
    });

    // Group subtotal row — same coloring as this group's header banner.
    const subr = ws.addRow([`${group.name} Subtotal`, '', '', '', '', '', '', '', '', '', '', '']);
    subr.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true, color: { argb: groupFontArgb } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: groupFillArgb } };
      c.border = { top: { style: 'thin', color: { argb: NAVY } } };
    });
    if (firstItemRowInGroup !== null) {
      subr.getCell(COL_TOTAL).value = { formula: `SUM(J${firstItemRowInGroup}:J${lastItemRowInGroup})`, result: 0 };
      // Group header total = same range
      gh.getCell(COL_TOTAL).value = { formula: `SUM(J${firstItemRowInGroup}:J${lastItemRowInGroup})`, result: 0 };
      groupSubtotalAddrs.push(`J${subr.number}`);
    }
    styleCurrency(subr.getCell(COL_TOTAL));
    ws.addRow([]);
  });

  // Backfill the top summary now that group subtotal rows are known.
  if (groupSubtotalAddrs.length) {
    stRow.getCell(COL_TOTAL).value = { formula: groupSubtotalAddrs.join('+'), result: 0 };
  }
  rowFee.getCell(COL_TOTAL).value = 0;
  rowCont.getCell(COL_TOTAL).value = 0;
  rowComm.getCell(COL_TOTAL).value = 0;
  rowTotal.getCell(COL_TOTAL).value = { formula: `J${stRow.number}+J${rowComm.number}+J${rowCont.number}+J${rowFee.number}`, result: 0 };

  if (STATE.phase4.notes) {
    ws.addRow([]);
    const notesHead = ws.addRow(['Notes:']);
    notesHead.font = { bold: true };
    ws.addRow([STATE.phase4.notes]);
  }

  // ===== Unit Mix sheet =====
  if (Array.isArray(STATE.unitMix) && STATE.unitMix.length) {
    const um = workbook.addWorksheet('Unit Mix');
    um.columns = [{ width: 32 }, { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }];
    const ut = um.addRow(['UNIT MIX']);
    ut.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    ut.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    um.mergeCells(`A${ut.number}:F${ut.number}`);
    const uh = um.addRow(['Unit Type', '# Units', 'Beds', 'Baths', 'SqFt', 'Status']);
    uh.font = { bold: true };
    uh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    STATE.unitMix.forEach((r) => {
      um.addRow([r.type || '', Number(r.count) || '', Number(r.beds) || '', Number(r.baths) || '', Number(r.sqft) || '', r.status || '']);
    });
  }

  // ===== Property Basics + Physical sheets =====
  [
    { name: 'Property Basics', phase: SCHEMA.phase1, state: STATE.phase1 },
    { name: 'Physical', phase: SCHEMA.phase2, state: STATE.phase2 },
  ].forEach(({ name, phase, state }) => {
    const w = workbook.addWorksheet(name);
    w.columns = [{ width: 42 }, { width: 32 }];
    const t = w.addRow([name.toUpperCase()]);
    t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    w.mergeCells(`A${t.number}:B${t.number}`);
    w.addRow([]);
    phase.forEach((sec) => {
      const sr = w.addRow([sec.section]);
      sr.font = { bold: true };
      sr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      w.mergeCells(`A${sr.number}:B${sr.number}`);
      sec.fields.forEach((f) => {
        if (f.type === 'info' || f.type === 'divider') return;
        const v = state[f.key];
        const displayVal = Array.isArray(v) ? v.join(', ') : (v ?? '');
        w.addRow([f.label, displayVal]);
      });
      w.addRow([]);
    });
  });

  return workbook;
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Build the workbook once and return a downloadable blob + filename.
async function buildCapexBlob() {
  const propName = STATE.phase1.prop_name || '';
  const workbook = await buildCapexWorkbook();
  const filename = `Capex_${(propName || 'property').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buf = await workbook.xlsx.writeBuffer();
  return { blob: new Blob([buf], { type: XLSX_MIME }), filename };
}

// "Export to Excel" — download only (never touches Drive).
async function exportXlsx() {
  if (typeof ExcelJS === 'undefined') { toast('ExcelJS not loaded yet, try again', 'error'); return; }
  const { blob, filename } = await buildCapexBlob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast('Excel downloaded', 'success');
}

// "Place in Capex Folder" — upload the same workbook straight into the deal's
// "25. Capex" subfolder on Google Drive.
async function placeInCapexFolder() {
  if (typeof ExcelJS === 'undefined') { toast('ExcelJS not loaded yet, try again', 'error'); return; }
  if (typeof getDriveToken === 'function' && !getDriveToken()) { toast('Connect Google Drive first', 'error'); return; }
  if (!STATE || !STATE.drive || !STATE.drive.folderId) { toast('Link a deal Drive folder first (☰ menu)', 'error'); return; }
  try {
    toast('Uploading Excel to 25. Capex…');
    const { blob, filename } = await buildCapexBlob();
    const capexFolder = await driveEnsureSubfolder(STATE.drive.folderId, '25. Capex');
    await driveUploadBinary(capexFolder, filename, blob, XLSX_MIME);
    toast('Excel placed in 25. Capex', 'success');
    // (intentionally does NOT open the file in a new tab)
  } catch (e) {
    toast('Upload failed: ' + e.message, 'error');
  }
}

// ---------- App shell ----------
function renderApp() {
  // Renders the current phase inside #phase-content (only used in property view).
  const main = $('#phase-content');
  main.innerHTML = '';
  let view;
  if (CURRENT_PHASE === 1) view = renderPhase1();
  else if (CURRENT_PHASE === 2) view = renderPhase2();
  else if (CURRENT_PHASE === 3) view = renderPhase3();
  else view = renderPhase4();
  main.appendChild(view);
  // On navigation, start the section-heavy tabs (Basics / Questionnaire / Budget)
  // fully collapsed by default. Finalize (4) keeps its own per-section collapse
  // logic (Sanity auto-expands on issues, etc.).
  if (CURRENT_PHASE <= 3) {
    main.querySelectorAll('.section').forEach(s => s.classList.add('collapsed'));
  }
  $$('.tab').forEach(t => t.classList.toggle('active', Number(t.dataset.phase) === CURRENT_PHASE));
  setTimeout(updateBasicsTabCheck, 0);
}

function renderShell() {
  // Top-level router between Home and Property views.
  const inProp = CURRENT_VIEW === 'property' && STATE;
  $('#home-content').classList.toggle('hidden', inProp);
  $('#phase-content').classList.toggle('hidden', !inProp);
  $('#phase-tabs').classList.toggle('hidden', !inProp);
  $('#btn-back').classList.toggle('hidden', !inProp);
  // Saving is automatic (Drive-authoritative): no manual Save / Push / Pull
  // buttons. Edits write to the localStorage cache instantly and auto-push to
  // Drive on a short debounce (scheduleAutoPush); recovery re-sync is in the
  // ☰ drawer (#btn-resync).
  $('#drawer-property-section').classList.toggle('hidden', !inProp);
  $('#header-title').textContent = inProp
    ? (STATE.name || STATE.phase1.prop_name || 'Untitled Property')
    : 'Capex Builder';
  if (inProp) {
    renderApp();
    updateSyncBar();
    updateFolderStatus();
  } else {
    $('#sync-bar').classList.add('hidden');
    renderHome();
  }
}

function shouldShowOnboarding() {
  if (localStorage.getItem(ONBOARDING_DISMISSED_KEY) === '1') return false;
  if (localStorage.getItem(DRIVE_EVER_CONNECTED_KEY) === '1') return false;
  return true;
}
function renderOnboardingCard() {
  const card = el('div', { class: 'onboarding-card' });
  const connected = !!getDriveToken();

  card.appendChild(el('button', {
    class: 'onb-close',
    title: 'Dismiss',
    onClick: () => {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
      renderHome();
    },
  }, '✕'));

  card.appendChild(el('h2', {}, '👋 Welcome to Capex Builder'));
  card.appendChild(el('p', {},
    'Capture tour notes, sync to the deal Google Drive folder, and hand off to Excel ' +
    'when you are ready to finalize the budget.'
  ));

  const steps = el('ol', { class: 'onboarding-steps' });
  steps.appendChild(el('li', {}, 'Connect your Google Drive account (one tap below).'));
  steps.appendChild(el('li', {}, 'Tap "+ New Property" and fill in name, city, state on the Basics tab.'));
  steps.appendChild(el('li', {}, 'Leave Basics for the Questionnaire tab — the app finds the matching deal folder across your pipelines and links it automatically.'));
  steps.appendChild(el('li', {}, 'Check items on the Questionnaire, price them on BUDGET $, then sync to Drive (see below).'));
  card.appendChild(steps);

  // Push / Pull explainer — the core save-and-retrieve workflow.
  const sync = el('div', { class: 'onb-sync' });
  sync.appendChild(el('div', { class: 'onb-sync-title' }, 'Saving & retrieving your work'));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '💾'),
    el('span', {},
      el('strong', {}, 'Save'),
      ' stores your work on this device only (your browser). It does NOT upload to Google Drive — it is just a quick local save so you do not lose progress between sessions on this device.'
    )
  ));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '⬆'),
    el('span', {},
      el('strong', {}, 'Push to Drive'),
      ' saves your data to the deal Google Drive folder (25. Capex / Capex Builder Budget) for long-term, team-shared storage. Do this whenever you finish a round of edits.'
    )
  ));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '⬇'),
    el('span', {},
      el('strong', {}, 'Pull from Drive'),
      ' loads the latest saved copy back into the app so you — or a teammate on another device — can review and keep editing. Pull before you start, push when you are done.'
    )
  ));
  card.appendChild(sync);

  if (connected) {
    card.appendChild(el('button', { class: 'onb-connect-btn connected' }, '✓ Drive Connected'));
  } else {
    card.appendChild(el('button', {
      class: 'onb-connect-btn',
      onClick: async () => {
        try {
          await driveRequestToken({ silent: false });
          localStorage.setItem(DRIVE_EVER_CONNECTED_KEY, '1');
          updateDriveStatus();
          toast('Drive connected', 'success');
          try { await fetchCurrentUser({ force: true }); } catch (e) { console.warn('fetchCurrentUser failed', e); }
          renderHome();
          refreshHomeIndex().catch(() => {});
        } catch (e) {
          toast('Connect failed: ' + e.message, 'error');
        }
      },
    }, 'Connect Google Drive'));
  }

  card.appendChild(el('button', {
    class: 'onb-dismiss',
    onClick: () => {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1');
      renderHome();
    },
  }, connected ? 'Got it, dismiss this' : 'Skip for now'));

  return card;
}

// Set true once the on-load silent Drive-token refresh has resolved (success or
// fail). Until then, a previously-connected user sees "Reconnecting…" rather than
// the connect gate, avoiding a flash of the gate before the silent token lands.
let _driveSilentDone = false;

// Full-page gate shown on the home view when Drive is not connected. Cloud sync is
// mandatory (Drive is the source of truth), so the property list is blocked until
// the user connects their company Google account. The connect button is a real
// click (user gesture) so the OAuth popup isn't blocked by the browser.
function renderDriveGate() {
  const wrap = el('div', {
    style: 'max-width:460px;margin:48px auto 0;padding:30px 26px;background:var(--surface);border:1px solid var(--border);border-radius:12px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.06)'
  });
  wrap.appendChild(el('div', { style: 'font-size:42px;line-height:1;margin-bottom:10px' }, '🔒'));
  wrap.appendChild(el('h2', { style: 'margin:0 0 8px;font-size:19px;color:var(--primary)' }, 'Connect Google Drive'));
  wrap.appendChild(el('p', { style: 'margin:0 0 20px;font-size:14px;color:#475569;line-height:1.5' },
    'Capex Builder syncs every property through the SHIR Google Drive. Connect your company Google account to view and edit properties.'));
  // Returning user with a silent reconnect still in flight: show a spinner line —
  // but ALWAYS render the manual Connect button below it, so a hung/blocked silent
  // refresh (GIS prompt:'none' can never call back) never traps the user.
  if (!_driveSilentDone && localStorage.getItem(DRIVE_EVER_CONNECTED_KEY)) {
    wrap.appendChild(el('div', { style: 'font-size:13px;color:#64748b;margin-bottom:14px' }, '🔄 Reconnecting to Google Drive…'));
  }
  const btn = el('button', {
    class: 'home-new-btn', style: 'width:auto;padding:12px 24px',
    onClick: async () => {
      btn.disabled = true; btn.textContent = 'Connecting…';
      try { await driveConnect(); } catch (e) {}
      _driveSilentDone = true;
      if (getDriveToken()) renderHome(); else { btn.disabled = false; btn.textContent = '☁ Connect to Google Drive'; }
    }
  }, '☁ Connect to Google Drive');
  wrap.appendChild(btn);
  return wrap;
}

// ---- Home sort state (persisted) ----
let HOME_SORT_FIELD = localStorage.getItem('capex_home_sort_field') || 'modified'; // 'modified' | 'created' | 'name'
let HOME_SORT_DIR = localStorage.getItem('capex_home_sort_dir') || 'desc';          // 'asc' | 'desc'
function setHomeSort(field, dir) {
  HOME_SORT_FIELD = field; HOME_SORT_DIR = dir;
  localStorage.setItem('capex_home_sort_field', field);
  localStorage.setItem('capex_home_sort_dir', dir);
  renderHome();
}
function homeSortDirLabel() {
  if (HOME_SORT_FIELD === 'name') return HOME_SORT_DIR === 'asc' ? 'A → Z' : 'Z → A';
  return HOME_SORT_DIR === 'asc' ? '↑ Oldest' : '↓ Newest';
}
function entryDisplayName({ local, remote }) {
  return (local && (local.name || (local.phase1 && local.phase1.prop_name)))
    || (remote && remote.name) || 'Untitled';
}
function entryModifiedMs({ local, remote }) {
  const s = (remote && remote.lastModified) || (local && local.updated) || '';
  const t = Date.parse(s); return isFinite(t) ? t : 0;
}
function entryCreatedMs(e) {
  const { local, remote } = e;
  if (local && local.created) { const t = Date.parse(local.created); if (isFinite(t)) return t; }
  // Fallback: property ids are `p_<rand>_<base36 Date.now()>` — decode the time part.
  const id = (local && local.id) || (remote && remote.id) || '';
  const part = id.split('_')[2];
  if (part) { const t = parseInt(part, 36); if (isFinite(t) && t > 1e11) return t; }
  return entryModifiedMs(e);   // last resort
}
function sortHomeEntries(entries) {
  const dir = HOME_SORT_DIR === 'asc' ? 1 : -1;
  entries.sort((a, b) => {
    let cmp;
    if (HOME_SORT_FIELD === 'name') cmp = entryDisplayName(a).localeCompare(entryDisplayName(b), undefined, { sensitivity: 'base' });
    else if (HOME_SORT_FIELD === 'created') cmp = entryCreatedMs(a) - entryCreatedMs(b);
    else cmp = entryModifiedMs(a) - entryModifiedMs(b);
    return cmp * dir;
  });
}

function renderHome() {
  const main = $('#home-content');
  main.innerHTML = '';

  // Mandatory Drive connection — block the home content until connected.
  if (GOOGLE_CLIENT_ID && !getDriveToken()) {
    main.appendChild(renderDriveGate());
    return;
  }

  if (shouldShowOnboarding()) main.appendChild(renderOnboardingCard());

  // Merge local properties + manifest entries by id, then sort per the user's choice.
  const merged = new Map();
  Object.values(STORE.properties).forEach(p => merged.set(p.id, { local: p, remote: null }));
  if (MANIFEST_CACHE && MANIFEST_CACHE.data && Array.isArray(MANIFEST_CACHE.data.properties)) {
    MANIFEST_CACHE.data.properties.forEach(entry => {
      const cur = merged.get(entry.id) || { local: null, remote: null };
      cur.remote = entry;
      merged.set(entry.id, cur);
    });
  }
  const entries = Array.from(merged.values());
  sortHomeEntries(entries);

  // ---- Home header box: New Property + org index status + sort + icon legend ----
  // SHIR-navy box. Row 1 packs every control (New / status / sort / user / Refresh)
  // onto one wrapping line; the icon legend is the only second row.
  const box = el('div', {
    style: 'margin:6px 0 12px;background:var(--primary);border:1px solid var(--primary);border-radius:8px;padding:9px 12px;font-size:12px;color:#cbd5e1;display:flex;flex-direction:column;gap:8px'
  });

  const controls = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' });
  controls.appendChild(el('button', {
    style: 'background:#fff;color:var(--primary);border:none;border-radius:6px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap',
    onClick: () => promptNewProperty(),
  }, '+ New Property'));
  const statusText = HOME_INDEX_LOADING
    ? '🔄 Loading…'
    : (MANIFEST_CACHE
        ? `📋 Index · ${MANIFEST_CACHE.fetchedAt ? relativeTime(new Date(MANIFEST_CACHE.fetchedAt).toISOString()) : 'loaded'}`
        : '📋 Tap Refresh');
  controls.appendChild(el('span', { style: 'color:#e2e8f0;white-space:nowrap', title: 'Org index' }, statusText));
  if (entries.length) {
    controls.appendChild(el('span', { style: 'color:#94a3b8;white-space:nowrap' }, 'Sort:'));
    const sel = el('select', { style: 'font-size:12px;padding:3px 6px;border:1px solid var(--border);border-radius:5px;cursor:pointer;background:#fff;color:var(--primary)' });
    [['modified', 'Date Modified'], ['created', 'Date Created'], ['name', 'Name']].forEach(([v, l]) => {
      const o = el('option', { value: v }, l); if (HOME_SORT_FIELD === v) o.selected = true; sel.appendChild(o);
    });
    sel.addEventListener('change', () => setHomeSort(sel.value, HOME_SORT_DIR));
    controls.appendChild(sel);
    controls.appendChild(el('button', {
      style: 'font-size:12px;padding:3px 8px;border:1px solid var(--border);border-radius:5px;cursor:pointer;background:#fff;font-weight:600;color:var(--primary);white-space:nowrap',
      title: 'Toggle sort direction',
      onClick: () => setHomeSort(HOME_SORT_FIELD, HOME_SORT_DIR === 'asc' ? 'desc' : 'asc'),
    }, homeSortDirLabel()));
  }
  // Flexible spacer pushes the user + Refresh to the right edge of the row.
  controls.appendChild(el('span', { style: 'flex:1 1 auto;min-width:8px' }));
  if (CURRENT_USER && CURRENT_USER.email) controls.appendChild(el('span', { style: 'color:#94a3b8;white-space:nowrap', title: CURRENT_USER.email }, CURRENT_USER.email.split('@')[0]));
  controls.appendChild(el('button', {
    style: 'background:none;border:none;color:#fff;font-size:12px;cursor:pointer;font-weight:600;padding:0;white-space:nowrap',
    onClick: () => refreshHomeIndex(),
  }, '🔄 Refresh'));
  box.appendChild(controls);

  // Icon legend = the second row (collapsible), inside the same box.
  if (entries.length) box.appendChild(renderHomeLegend());

  main.appendChild(box);

  if (!entries.length) {
    main.appendChild(el('div', { class: 'home-empty' },
      'No properties yet. Tap "+ New Property" to start.'));
    return;
  }

  const list = el('div', { class: 'home-list' });
  entries.forEach(({ local, remote }) => list.appendChild(renderPropertyCard(local, remote)));
  main.appendChild(list);
}

// Collapsible legend explaining the per-property status icons + badges. Mirrors
// the symbols set in renderPropertyCard; keep the two in sync.
function renderHomeLegend() {
  const d = el('details', { class: 'home-legend',
    style: 'margin:0;background:var(--surface);border:1px solid var(--border);border-radius:6px;overflow:hidden' });
  d.appendChild(el('summary', {
    style: 'padding:9px 12px;cursor:pointer;font-size:12px;font-weight:600;color:#475569;user-select:none'
  }, 'ⓘ  What do the icons mean?'));
  const body = el('div', { style: 'padding:2px 12px 10px;font-size:12px;color:#475569' });
  const row = (icon, color, text) => {
    const r = el('div', { style: 'display:flex;align-items:flex-start;gap:9px;padding:3px 0;line-height:1.35' });
    r.appendChild(el('span', { style: `flex:0 0 18px;text-align:center;color:${color || 'inherit'};font-weight:700` }, icon));
    r.appendChild(el('span', {}, text));
    return r;
  };
  body.appendChild(row('●', 'var(--success)', 'Saved to Drive — edits sync automatically to the deal folder'));
  body.appendChild(row('⊘', '#94a3b8', 'No Drive deal folder linked yet'));
  body.appendChild(row('☁', '#1e3a8a', 'In the org index but not loaded on this device — tap the card to open it from Drive'));
  body.appendChild(row('⋮', '#64748b', 'Property menu — rename, link/change Drive folder, delete'));
  body.appendChild(row('📐', '#166534', '“survey” = survey processed (gray “no survey” = not yet)'));
  body.appendChild(row('🏠', '#166534', '“unit mix (N)” = N unit types imported (gray “no unit mix” = none)'));
  d.appendChild(body);
  return d;
}

// Render one property card. Either `local` or `remote` (or both) may be set.
// Local-only: classic flow. Manifest-only (no local copy): card click triggers
// openRemoteProperty(). Both set: live local card, but we also surface the
// remote `lastEditor` / `currentEditor` for awareness.
function renderPropertyCard(local, remote) {
  const p = local || {
    id: remote.id,
    name: remote.name,
    phase1: {},
    drive: { folderId: remote.dealFolderId },
    updated: remote.lastModified,
  };

  const subBits = [];
  if (p.phase1 && p.phase1.city) subBits.push(p.phase1.city);
  if (p.phase1 && p.phase1.mf_units) subBits.push(`${p.phase1.mf_units} units`);
  const ts = (remote && remote.lastModified) || p.updated;
  if (ts) subBits.push('updated ' + relativeTime(ts));
  if (remote && remote.lastEditor) subBits.push('by ' + remote.lastEditor);
  const subtitle = subBits.join(' · ') || 'No details yet';

  // Quick-status badges: survey processed + unit mix imported. Prefer manifest
  // values for remote-only entries, fall back to live local state for opened ones.
  const surveyOk = remote
    ? !!remote.surveyProcessed
    : !!(p.survey && p.survey.processed_at);
  const unitMixOk = remote
    ? !!remote.unitMixImported
    : (Array.isArray(p.unitMix) && p.unitMix.length > 0);
  const unitMixCount = remote
    ? (remote.unitMixTypeCount || 0)
    : (Array.isArray(p.unitMix) ? p.unitMix.length : 0);
  const statusBadges = el('div', { style: 'display:flex;gap:6px;margin-top:3px;flex-wrap:wrap' });
  statusBadges.appendChild(el('span', {
    title: surveyOk ? 'Survey processed' : 'No survey processed yet',
    style: `font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;background:${surveyOk ? '#dcfce7' : '#f1f5f9'};color:${surveyOk ? '#166534' : '#94a3b8'}`,
  }, surveyOk ? '📐 survey' : '📐 no survey'));
  statusBadges.appendChild(el('span', {
    title: unitMixOk ? `Unit mix imported (${unitMixCount} types)` : 'No unit mix imported',
    style: `font-size:10px;padding:1px 6px;border-radius:3px;font-weight:600;background:${unitMixOk ? '#dcfce7' : '#f1f5f9'};color:${unitMixOk ? '#166534' : '#94a3b8'}`,
  }, unitMixOk ? `🏠 unit mix${unitMixCount ? ` (${unitMixCount})` : ''}` : '🏠 no unit mix'));

  // Drive-authoritative: edits auto-save to Drive, so a linked property is simply
  // "on Drive" (no local-vs-remote dirty state). ☁ = in the org index but not yet
  // loaded on this device; ⊘ = no deal folder linked.
  let syncCls, syncIcon, syncTitle;
  if (!local) {
    syncCls = 'remote'; syncIcon = '☁'; syncTitle = 'In org index — tap to open from Drive';
  } else if (!p.drive.folderId) {
    syncCls = 'nolink'; syncIcon = '⊘'; syncTitle = 'No Drive folder linked';
  } else {
    syncCls = 'synced'; syncIcon = '●'; syncTitle = 'Saved to Drive';
  }

  // Active-editor badge: another teammate has a fresh heartbeat right now.
  let editorBadge = null;
  if (remote && remote.currentEditor && remote.currentEditorHeartbeatAt) {
    const beat = Date.parse(remote.currentEditorHeartbeatAt);
    const meEmail = (CURRENT_USER || {}).email;
    if (Date.now() - beat < HEARTBEAT_STALE_MS && remote.currentEditor !== meEmail) {
      editorBadge = el('div', {
        style: 'font-size:11px;color:#92400e;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-top:4px;display:inline-block;font-weight:600'
      }, `✏️ ${remote.currentEditor} editing now`);
    }
  }

  return el('div', { class: 'property-card', onClick: () => {
    if (local) openProperty(local.id);
    else openRemoteProperty(remote);
  } },
    el('div', { class: 'pc-main' },
      // Row 1: name + subtitle inline (subtitle ellipsizes); Row 2: status badges.
      el('div', { style: 'display:flex;align-items:baseline;gap:8px;min-width:0' },
        el('div', { class: 'pc-name', style: 'white-space:nowrap' }, p.name || (remote && remote.name) || '(unnamed)'),
        el('div', { class: 'pc-sub', style: 'margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, subtitle),
      ),
      statusBadges,
      editorBadge,
    ),
    el('div', { class: 'pc-actions' },
      el('span', { class: 'pc-sync ' + syncCls, title: syncTitle }, syncIcon),
      local ? el('button', { class: 'btn-icon pc-menu',
        onClick: (e) => { e.stopPropagation(); propertyMenu(local); } }, '⋮') : null,
    )
  );
}

function relativeTime(iso) {
  if (!iso) return '';
  const d = new Date(iso); const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  if (diff < 7 * 86400) return Math.floor(diff / 86400) + 'd ago';
  return d.toLocaleDateString();
}

// Find an existing property (on this device OR in the org index) that would
// duplicate the given name or deal folder. Returns {id,name,where,by} or null.
// Used to block accidental duplicate property records (a recurring problem —
// e.g. two "AUS TX - Crestwood" entries pointing at the same deal folder).
function findExistingProperty({ name, folderId, excludeId } = {}) {
  const wantName = name ? normalizeName(name) : '';
  const test = (id, nm, fId, where) => {
    if (excludeId && id === excludeId) return null;
    if (wantName && nm && normalizeName(nm) === wantName) return { id, name: nm, where, by: 'name' };
    if (folderId && fId && fId === folderId) return { id, name: nm, where, by: 'folder' };
    return null;
  };
  for (const p of Object.values(STORE.properties)) {
    const hit = test(p.id, p.name, p.drive && p.drive.folderId, 'on this device');
    if (hit) return hit;
  }
  const props = (MANIFEST_CACHE && MANIFEST_CACHE.data && Array.isArray(MANIFEST_CACHE.data.properties))
    ? MANIFEST_CACHE.data.properties : [];
  for (const e of props) {
    const hit = test(e.id, e.name, e.dealFolderId, 'in the org index');
    if (hit) return hit;
  }
  return null;
}

function promptNewProperty() {
  const name = prompt(`Property name? (max ${PROP_NAME_MAX} characters)`);
  if (name === null) return;
  const trimmed = (name || '').trim().slice(0, PROP_NAME_MAX);   // cap at 25
  if (!trimmed) { toast('Enter a property name', 'error'); return; }
  // Block duplicates: a property with the same name already exists locally or org-wide.
  const dup = findExistingProperty({ name: trimmed });
  if (dup) {
    alert(
      `⚠️ A property named "${dup.name}" already exists (${dup.where}).\n\n` +
      `To avoid duplicate records, open the existing one from the list instead of creating a new property.\n\n` +
      `If this really is a different deal, give it a distinct name (e.g. add the address, unit count, or phase).`
    );
    return;
  }
  const p = createProperty(trimmed);
  openProperty(p.id);
  // Right after creation, ask how to link the Drive deal folder.
  promptLinkDriveDuringSetup(p);
}

async function promptLinkDriveDuringSetup(p) {
  const choice = prompt(
    `Link a Google Drive deal folder for "${p.name}"?\n\n` +
    `1. Search pipelines by name (recommended)\n` +
    `2. Paste folder URL or ID\n` +
    `3. Skip for now (you can link later from ☰)\n\n` +
    `Enter 1-3:`,
    '1'
  );
  if (choice === null) return;
  const c = String(choice).trim();
  if (c === '2') {
    promptLinkFolder(p, () => renderShell());
    return;
  }
  if (c === '1') {
    // autoLinkDealFolder reads STATE.phase1.prop_name; createProperty already set this.
    STATE.drive.autoSearchAttempted = true; // suppress the on-leave-Basics auto-run
    try {
      const ok = await autoLinkDealFolder({ silent: false });
      if (!ok) {
        if (confirm('Want to paste the folder URL or ID manually instead?')) {
          promptLinkFolder(p, () => renderShell());
        }
      }
    } catch (e) {
      toast('Search failed: ' + e.message, 'error');
    }
  }
  // c === '3' or anything else → skip
}

function propertyMenu(p) {
  const choice = prompt(
    `"${p.name || '(unnamed)'}"\n\n` +
    `1. Open\n2. Rename\n3. Link Drive folder\n4. Delete\n\nEnter 1-4:`
  );
  if (choice === '1') openProperty(p.id);
  else if (choice === '2') {
    const n = prompt('New name?', p.name);
    if (n !== null && n.trim()) {
      p.name = n.trim();
      if (p.phase1) p.phase1.prop_name = p.name;
      saveState();
      renderHome();
    }
  } else if (choice === '3') {
    promptLinkFolder(p, () => renderHome());
  } else if (choice === '4') {
    if (confirm(`Delete "${p.name}"?\n\nThis only removes the local copy — the Drive folder and its files are NOT affected.`)) {
      deleteProperty(p.id);
      renderHome();
    }
  }
}

function extractFolderId(input) {
  if (!input) return '';
  const s = String(input).trim();
  const m = s.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
}

function promptLinkFolder(p, after) {
  const current = p.drive.folderId || '';
  const input = prompt(
    'Paste the Drive folder URL or ID for this property:\n\n' +
    'Either:\n' +
    '  • https://drive.google.com/drive/folders/ABC123…\n' +
    '  • or just the ID (ABC123…)\n\n' +
    'Leave blank to unlink.',
    current
  );
  if (input === null) return;
  const trimmed = input.trim();
  if (!trimmed) {
    p.drive.folderId = '';
    p.drive.fileId = '';
    p.drive.capexFolderId = '';
    saveState();
    if (after) after();
    toast('Folder unlinked');
    return;
  }
  const id = extractFolderId(trimmed);
  if (!id) { toast('Could not parse folder ID', 'error'); return; }
  // Block linking a folder already tied to another property (= duplicate deal).
  const dupF = findExistingProperty({ folderId: id, excludeId: p.id });
  if (dupF && !confirm(
    `⚠️ "${dupF.name}" (${dupF.where}) is already linked to this exact Drive folder.\n\n` +
    `Linking it here too creates a duplicate deal record. Link anyway?`
  )) return;
  p.drive.folderId = id;
  p.drive.fileId = '';        // reset; will be discovered on next push/pull
  p.drive.capexFolderId = ''; // reset cached nested folder id
  saveState();
  if (after) after();
  toast('Drive folder linked', 'success');
  // Folder linked -> write this property's Capex Builder link to its Asana deal task.
  syncCapexLinkToAsana(p, { interactive: true });
}

// Single Drive-authoritative status: setup / saving / error / saved.
function updateSyncBar() {
  const bar = $('#sync-bar');
  if (!STATE) { bar.classList.add('hidden'); return; }
  bar.onclick = null; bar.style.cursor = '';   // reset; the conflict branch re-arms these
  if (!STATE.drive.folderId) {
    bar.className = 'sync-bar warn';
    bar.textContent = 'Link a Drive folder to enable cloud sync — tap ☰ → Find or Link Drive Folder.';
    bar.classList.remove('hidden');
    return;
  }
  const lastPush = STATE.drive.lastPushed;
  const dirty = !lastPush || lastPush < STATE.updated;
  if (_syncState === 'conflict') {
    // Silent push refused to overwrite a newer Drive copy. Don't lie "Saving…" —
    // show an actionable bar so the user can resolve (load Drive vs. overwrite).
    bar.className = 'sync-bar warn';
    bar.textContent = '⚠ A newer version of this property is on Drive — click here to resolve';
    bar.style.cursor = 'pointer';
    bar.onclick = () => resolveSyncConflict();
  } else if (_syncState === 'error') {
    bar.className = 'sync-bar warn';
    bar.textContent = '⚠ Can’t reach Drive — retrying…' + (lastPush ? ' Last saved ' + relativeTime(lastPush) : '');
  } else if (_syncState === 'saving' || _autoPushTimer || dirty) {
    bar.className = 'sync-bar';
    bar.textContent = 'Saving to Drive…';
  } else {
    bar.className = 'sync-bar ok';
    bar.textContent = '✓ Saved to Drive' + (lastPush ? ' · ' + relativeTime(lastPush) : '');
  }
  bar.classList.remove('hidden');
}

// Invoked from the sync bar when a silent push detected a newer Drive copy.
// Offers a 2-way resolution: load the Drive version (discard unsynced local edits)
// or overwrite Drive with the local version. Either path clears the conflict.
async function resolveSyncConflict() {
  if (!STATE || !STATE.drive || !STATE.drive.folderId) return;
  const useRemote = confirm(
    'A newer version of this property is on Drive.\n\n' +
    'OK — Load the Drive version (your unsynced local edits will be replaced).\n\n' +
    'Cancel — Keep your local version and overwrite the Drive copy.'
  );
  try {
    if (useRemote) {
      await pullFromDrive({ auto: true });   // silent adopt: sets _syncState idle + re-renders
      toast('Loaded the Drive version', 'success');
    } else {
      const r = await pushToDrive({ force: true });   // override the newer-remote guard
      _syncState = (r === false) ? 'error' : 'idle';
      if (r !== false) toast('Overwrote the Drive copy with your local version', 'success');
    }
  } catch (e) {
    _syncState = 'error';
  }
  updateSyncBar();
}

function updateFolderStatus() {
  const el2 = $('#folder-status');
  if (!el2 || !STATE) return;
  el2.textContent = STATE.drive.folderId
    ? 'Linked: ' + STATE.drive.folderId.slice(0, 14) + '…'
    : 'Not linked';
  const ss = $('#sync-status');
  if (ss) {
    const bits = [];
    if (STATE.drive.lastPushed) bits.push('Pushed ' + relativeTime(STATE.drive.lastPushed));
    if (STATE.drive.lastPulled) bits.push('Pulled ' + relativeTime(STATE.drive.lastPulled));
    ss.textContent = bits.join(' · ') || 'Never synced';
  }
}

function bindShell() {
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    const wasPhase = CURRENT_PHASE;
    CURRENT_PHASE = Number(t.dataset.phase);
    renderApp();
    window.scrollTo(0, 0);
    // Leaving Phase 1 with a populated property name but no Drive folder linked yet?
    // Auto-search across the 5 pipelines (once per property — manual button can re-run).
    if (wasPhase === 1 && CURRENT_PHASE !== 1
        && STATE && !STATE.drive.folderId && !STATE.drive.autoSearchAttempted
        && STATE.phase1 && STATE.phase1.prop_name
        && GOOGLE_CLIENT_ID) {
      STATE.drive.autoSearchAttempted = true;
      saveState();
      autoLinkDealFolder({ silent: true });
    }
  }));
  $('#btn-back').addEventListener('click', () => closeProperty());
  // No manual Save button — edits auto-save to the local cache and auto-push to
  // Drive on a debounce (scheduleAutoPush). Drive is the source of truth.
  $('#btn-menu').addEventListener('click', () => $('#menu-drawer').classList.remove('hidden'));
  $('.drawer-close').addEventListener('click', () => $('#menu-drawer').classList.add('hidden'));

  const closeDrawer = () => $('#menu-drawer').classList.add('hidden');

  $('#btn-find-folder').addEventListener('click', () => {
    if (!STATE) return;
    closeDrawer();
    STATE.drive.autoSearchAttempted = false; // manual button always re-runs
    autoLinkDealFolder({ silent: false });
  });
  $('#btn-link-folder').addEventListener('click', () => {
    if (!STATE) return;
    promptLinkFolder(STATE, () => { renderShell(); });
    closeDrawer();
  });
  $('#btn-rename').addEventListener('click', () => {
    if (!STATE) return;
    const n = prompt('New property name?', STATE.name);
    if (n !== null && n.trim()) {
      STATE.name = n.trim();
      STATE.phase1.prop_name = STATE.name;
      saveState();
      renderShell();
    }
    closeDrawer();
  });
  $('#btn-delete').addEventListener('click', () => {
    if (!STATE) return;
    if (confirm(`Delete "${STATE.name}"?\n\nThis only removes the local copy — Drive files are NOT affected.`)) {
      deleteProperty(STATE.id);
      renderShell();
    }
    closeDrawer();
  });

  // Recovery only: re-pull the authoritative Drive copy (prompts if this device
  // has unsynced edits). Routine sync is automatic.
  $('#btn-resync').addEventListener('click', async () => { closeDrawer(); await pullFromDrive(); });

  $('#btn-export-xlsx').addEventListener('click', () => { exportXlsx(); closeDrawer(); });
  $('#btn-export-json').addEventListener('click', () => {
    if (!STATE) return;
    const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `capex_${(STATE.phase1.prop_name || 'property').replace(/[^a-z0-9]+/gi, '_')}.json`;
    a.click();
    closeDrawer();
  });

  $('#btn-drive-connect').addEventListener('click', driveConnect);
  $('#btn-import-options').addEventListener('click', () => $('#file-import-options').click());
  $('#file-import-options').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importOptionsXlsx(file);
    e.target.value = '';
  });
  $('#btn-reset-options').addEventListener('click', () => {
    if (confirm('Reset all dropdown options to defaults from the source spreadsheet?')) {
      resetOptionOverrides();
      updateOptionsStatus();
      if (CURRENT_VIEW === 'property') renderApp();
      toast('Options reset', 'success');
    }
  });
  $('#btn-set-anthropic-key').addEventListener('click', () => {
    const cur = getAnthropicKey();
    const entered = prompt(
      'Anthropic API key (stored in localStorage only).\n' +
      'Leave blank to clear the stored key.\n\n' +
      'Get one at console.anthropic.com → API Keys.',
      cur || ''
    );
    if (entered === null) return;
    const trimmed = entered.trim();
    if (!trimmed) {
      setAnthropicKey('');
      updateAnthropicKeyStatus();
      toast('API key cleared');
    } else if (!trimmed.startsWith('sk-ant-')) {
      toast('Key must start with sk-ant-', 'error');
    } else {
      setAnthropicKey(trimmed);
      updateAnthropicKeyStatus();
      toast('API key saved', 'success');
    }
    closeDrawer();
  });
  $('#btn-share-anthropic-key').addEventListener('click', () => {
    shareAnthropicKeyOrgWide();
    closeDrawer();
  });
  $('#btn-set-asana-token').addEventListener('click', () => {
    const cur = getAsanaToken();
    const entered = prompt(
      'Asana Personal Access Token (stored in localStorage only).\n' +
      'Leave blank to clear.\n\n' +
      'Get one at asana.com → My Settings → Apps → Developer → Personal access tokens.',
      cur || ''
    );
    if (entered === null) return;
    const trimmed = entered.trim();
    setAsanaToken(trimmed);
    updateAsanaTokenStatus();
    toast(trimmed ? 'Asana token saved' : 'Asana token cleared', trimmed ? 'success' : '');
    closeDrawer();
  });
  $('#btn-share-asana-token').addEventListener('click', () => {
    shareAsanaTokenOrgWide();
    closeDrawer();
  });
  $('#btn-link-asana').addEventListener('click', () => {
    if (!STATE) { toast('Open a property first', 'error'); return; }
    if (!STATE.drive.folderId &&
        !confirm('This property has no Drive folder linked yet. Write its Capex Builder link to Asana anyway?')) return;
    syncCapexLinkToAsana(STATE, { interactive: true });
    closeDrawer();
  });
  updateDriveStatus();
  updateOptionsStatus();
  updateAnthropicKeyStatus();
  updateAsanaTokenStatus();
}

function updateOptionsStatus() {
  const ov = loadOptionOverrides();
  const n = Object.keys(ov).length;
  const s = $('#options-status');
  if (s) s.textContent = n ? `${n} field${n === 1 ? '' : 's'} overridden` : 'Using defaults';
}

function importOptionsXlsx(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const ws = wb.Sheets['Dropdown Options'] || wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      // Header row: Phase | Section | Field Key | Field Label | Option 1 | Option 2 | ...
      const overrides = {};
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const fieldKey = row[2];
        if (!fieldKey) continue;
        const opts = row.slice(4)
          .map(v => v == null ? '' : String(v).trim())
          .filter(Boolean);
        if (opts.length) overrides[String(fieldKey).trim()] = opts;
      }
      if (!Object.keys(overrides).length) {
        toast('No options found in Excel (check column layout)', 'error');
        return;
      }
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(overrides));
      updateOptionsStatus();
      renderApp();
      toast(`Imported options for ${Object.keys(overrides).length} fields`, 'success');
    } catch (err) {
      toast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ---------- Google Drive ----------
// To enable: create OAuth client at console.cloud.google.com (Web App type),
// add the production origin (currently https://capex-builder.pages.dev) as an
// Authorized JavaScript origin, then paste the Client ID below. The current
// client also has the legacy https://egordonshir.github.io and
// https://capex-builder.netlify.app origins registered.
const GOOGLE_CLIENT_ID = '434286194253-gjfctl5vkdgvfk5vve9r272o7mr2n82q.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const STATE_FILENAME = 'capex_builder.json';

function getDriveToken() {
  const tok = localStorage.getItem(DRIVE_TOKEN_KEY);
  const exp = Number(localStorage.getItem(DRIVE_TOKEN_EXP_KEY) || 0);
  return tok && exp > Date.now() ? tok : null;
}
function clearDriveToken() {
  localStorage.removeItem(DRIVE_TOKEN_KEY);
  localStorage.removeItem(DRIVE_TOKEN_EXP_KEY);
}
function updateDriveStatus() {
  const status = $('#drive-status');
  if (!status) return;
  if (!GOOGLE_CLIENT_ID) { status.textContent = 'Add OAuth client ID to app.js to enable'; return; }
  status.textContent = getDriveToken() ? 'Connected' : 'Not connected';
}

function ensureGisLoaded() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

function driveRequestToken({ silent = false } = {}) {
  return new Promise(async (resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) { reject(new Error('Set GOOGLE_CLIENT_ID in app.js first')); return; }
    try { await ensureGisLoaded(); } catch (e) { reject(e); return; }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.access_token) {
          localStorage.setItem(DRIVE_TOKEN_KEY, resp.access_token);
          localStorage.setItem(DRIVE_TOKEN_EXP_KEY, String(Date.now() + ((resp.expires_in || 3600) - 60) * 1000));
          localStorage.setItem(DRIVE_EVER_CONNECTED_KEY, '1');
          updateDriveStatus();
          resolve(resp.access_token);
        } else {
          reject(new Error('OAuth failed'));
        }
      },
      error_callback: (err) => reject(new Error('OAuth error: ' + (err && err.type || 'unknown'))),
    });
    client.requestAccessToken(silent ? { prompt: 'none' } : {});
  });
}

async function driveAuthHeader() {
  let tok = getDriveToken();
  if (!tok) {
    // Try silent refresh first so we don't pop the Google account chooser
    // on every background call (close-property → releaseEditorLock,
    // refreshHomeIndex, syncTick, etc.). GIS will reuse the previously-
    // authorized account when possible. Only fall back to the interactive
    // chooser if silent fails (e.g. consent expired, account revoked).
    try {
      tok = await driveRequestToken({ silent: true });
    } catch {
      tok = await driveRequestToken({ silent: false });
    }
  }
  return 'Bearer ' + tok;
}

// Append the Shared-Drive params Google requires to see / download / write files
// that live in a Shared Drive (our deal folders do). Without supportsAllDrives=true,
// media downloads of Shared-Drive files 404 and list queries silently omit them;
// list queries additionally need includeItemsFromAllDrives=true (which itself requires
// supportsAllDrives=true). Centralized here so every Drive call inherits it.
function withSharedDriveParams(url) {
  if (!/googleapis\.com\/(?:upload\/)?drive\/v3\/files/.test(url)) return url;
  const join = url.includes('?') ? '&' : '?';
  const extra = [];
  if (!/[?&]supportsAllDrives=/.test(url)) extra.push('supportsAllDrives=true');
  // Only list endpoints take a `q=` query; give those includeItemsFromAllDrives too.
  if (/[?&]q=/.test(url) && !/[?&]includeItemsFromAllDrives=/.test(url)) {
    extra.push('includeItemsFromAllDrives=true');
  }
  return extra.length ? url + join + extra.join('&') : url;
}

async function driveFetch(url, opts = {}) {
  url = withSharedDriveParams(url);
  const auth = await driveAuthHeader();
  let r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: auth } });
  if (r.status === 401) {
    // Token was good locally but Google rejected it (rotated / revoked /
    // server-side expired). Try a silent refresh BEFORE the non-silent path,
    // otherwise every 401 surfaces the Google account chooser to the user.
    clearDriveToken();
    const auth2 = await driveAuthHeader();
    r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: auth2 } });
  }
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    throw new Error(`Drive ${r.status}: ${text.slice(0, 200)}`);
  }
  return r;
}

async function driveConnect() {
  try {
    await driveRequestToken({ silent: false });
    updateDriveStatus();
    // Fetch the signed-in user's identity so the manifest can record edits as
    // theirs, then load the org-wide index in the background. This also enforces
    // the company-domain allowlist — an unauthorized account is disconnected here.
    try {
      await fetchCurrentUser({ force: true });
    } catch (e) {
      if (e && e.code === 'ACCESS_DENIED') {
        updateDriveStatus();
        toast('Access denied', 'error');
        alert(e.message);
        return;
      }
      console.warn('fetchCurrentUser failed', e);
    }
    toast('Drive connected', 'success');
    if (CURRENT_VIEW === 'home') refreshHomeIndex().catch(() => {});
    else if (CURRENT_VIEW === 'property') startAutoSync();
  } catch (e) {
    toast('Connect failed: ' + e.message, 'error');
  }
}

async function driveFindFile(folderId, filename) {
  const q = `'${folderId}' in parents and name='${filename.replace(/'/g, "\\'")}' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=10`;
  const r = await driveFetch(url);
  const j = await r.json();
  return (j.files || [])[0] || null;
}

// Find or create a subfolder with the given name under parentId. Returns the subfolder id.
async function driveEnsureSubfolder(parentId, name) {
  const safeName = name.replace(/'/g, "\\'");
  const q = `'${parentId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10`;
  const listR = await driveFetch(listUrl);
  const listJ = await listR.json();
  if ((listJ.files || []).length) return listJ.files[0].id;
  // Create it.
  const createR = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const createJ = await createR.json();
  return createJ.id;
}

// Resolve (and cache) the nested target folder where all capex artifacts live:
//   <linked deal folder>/25. Capex/Capex Builder Budget/
async function resolveCapexFolder() {
  if (!STATE || !STATE.drive.folderId) throw new Error('No Drive folder linked');
  if (STATE.drive.capexFolderId) return STATE.drive.capexFolderId;
  const capexParent = await driveEnsureSubfolder(STATE.drive.folderId, '25. Capex');
  const budgetFolder = await driveEnsureSubfolder(capexParent, 'Capex Builder Budget');
  STATE.drive.capexFolderId = budgetFolder;
  saveState();
  return budgetFolder;
}

// ---------- Deal folder auto-discovery ----------
// Pipeline parent folders that contain individual deal folders, in priority order.
// Names/ids verified live against Google Drive 2026-06-30 — the old "Negotiating" /
// "Inv Comm. Offer" / "Initial Offer" folders no longer exist (consolidated into
// "1_PIPELINE (MAIN)"); the rest just picked up numeric prefixes.
const DEAL_PIPELINE_FOLDERS = [
  { name: '0_Under Contract',                  id: '1IrPlaRICRzdqN7SmG_ShDkSnCP0g7tHL' },
  { name: '1_PIPELINE (MAIN)',                 id: '104S0wT09iDs3EWnZoWQrf7IWaw6zqsbd' },
  { name: '4_Brokered Pipeline',                id: '1_t3k60rmSWJY3aXYAMIgn6SjFRE1tg-R' },
  { name: '4_ExStay Conv (Brokered) Pipeline',  id: '1_IiLYMEtGMptdzS50hFXRFz9nK5JB7f9' },
  { name: '4_PROSPECTS (OFF Mkt)',              id: '1xCcCTPP2qLhUapPiQT1h2TQxnLL3nAdH' },
];

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// List all subfolders under parentId (paginated, returns [{id,name}]).
async function listSubfolders(parentId) {
  const all = [];
  let pageToken = null;
  do {
    const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name),nextPageToken&pageSize=200`;
    if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
    const r = await driveFetch(url);
    const j = await r.json();
    all.push(...(j.files || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return all;
}

// Search all 5 pipelines in parallel. Returns ranked candidates with score + pipeline name.
async function searchDealFolder(propName, city, state) {
  const nProp = normalizeName(propName);
  if (!nProp) return [];
  const nCity = normalizeName(city);
  const nState = normalizeName(state);
  const propTokens = nProp.split(/\s+/).filter(t => t.length >= 3);

  const buckets = await Promise.all(
    DEAL_PIPELINE_FOLDERS.map(p =>
      listSubfolders(p.id).then(files => ({ pipeline: p.name, files })).catch(() => ({ pipeline: p.name, files: [] }))
    )
  );

  const candidates = [];
  for (const bucket of buckets) {
    for (const f of bucket.files) {
      const nf = normalizeName(f.name);
      let score = 0;
      // Full property name appears contiguously — strongest signal
      if (nProp.length >= 4 && nf.includes(nProp)) score += 50;
      // Each property token present
      for (const t of propTokens) if (nf.includes(t)) score += 10;
      // City / state boost
      if (nCity && nCity.length >= 3 && nf.includes(nCity)) score += 8;
      if (nState && nState.length >= 2) {
        const stateRe = new RegExp('(^|\\s)' + nState + '($|\\s)');
        if (stateRe.test(nf)) score += 4;
      }
      if (score > 0) candidates.push({ id: f.id, name: f.name, pipeline: bucket.pipeline, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// Look up the deal folder for the current property by name/city/state and link it.
// `silent` = called automatically (no toast on zero-match); otherwise show feedback.
async function autoLinkDealFolder({ silent = false } = {}) {
  if (!STATE) return false;
  if (STATE.drive.folderId) {
    if (!silent) toast('Folder already linked — unlink first to relink', 'error');
    return false;
  }
  const propName = STATE.phase1 && STATE.phase1.prop_name;
  if (!propName) {
    if (!silent) toast('Enter Property Name on the Basics tab first', 'error');
    return false;
  }
  if (!GOOGLE_CLIENT_ID) { if (!silent) toast('Set GOOGLE_CLIENT_ID first', 'error'); return false; }

  try {
    if (!silent) toast('Searching Drive pipelines…');
    const candidates = await searchDealFolder(propName, STATE.phase1.city, STATE.phase1.state);
    if (!candidates.length) {
      if (!silent) toast('No matching deal folder found', 'error');
      return false;
    }

    let chosen;
    const top = candidates[0];
    const second = candidates[1];
    // High-confidence single match: top score is meaningfully ahead of runner-up (or no runner-up).
    if (!second || top.score >= second.score + 20) {
      const ok = confirm(
        `Found deal folder:\n\n` +
        `📁 ${top.name}\n   in "${top.pipeline}"\n\n` +
        `Link it to this property and create 25. Capex/Capex Builder Budget?`
      );
      if (!ok) return false;
      chosen = top;
    } else {
      const top5 = candidates.slice(0, 5);
      const msg =
        `Multiple possible deal folders. Pick one:\n\n` +
        top5.map((c, i) => `${i + 1}. ${c.name}\n   (${c.pipeline})`).join('\n\n') +
        `\n\nEnter 1-${top5.length}, or blank to cancel:`;
      const pick = prompt(msg, '1');
      const idx = parseInt(pick, 10);
      if (!idx || idx < 1 || idx > top5.length) return false;
      chosen = top5[idx - 1];
    }

    // Guard against duplicate deals: if another property already links this
    // folder, skip silently on the auto-pass, or confirm on a manual search.
    const dupF = findExistingProperty({ folderId: chosen.id, excludeId: STATE.id });
    if (dupF) {
      if (silent) { console.warn('auto-link skipped: folder already linked by', dupF.name); return false; }
      if (!confirm(`⚠️ "${dupF.name}" is already linked to "${chosen.name}".\n\nLink it to this property too (creates a duplicate deal)?`)) return false;
    }
    STATE.drive.folderId = chosen.id;
    STATE.drive.fileId = '';
    STATE.drive.capexFolderId = '';
    saveState();
    // Eagerly create the nested target folder.
    try { await resolveCapexFolder(); } catch (e) { console.warn('resolveCapexFolder after auto-link failed', e); }
    renderShell();
    toast(`Linked: ${chosen.name}`, 'success');
    // Folder linked -> write the Capex Builder link to Asana. Silent auto-link
    // (leaving Basics) only writes on an EXACT name match + never prompts; a
    // manual "Find Drive Folder" run (silent=false) confirms/picks the task.
    syncCapexLinkToAsana(STATE, { interactive: !silent });
    return true;
  } catch (e) {
    if (!silent) toast('Search failed: ' + e.message, 'error');
    return false;
  }
}

function makeMultipartJsonBody(metadata, jsonPayload) {
  const boundary = '-------capexbuilder' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    JSON.stringify(jsonPayload) + `\r\n` +
    `--${boundary}--`;
  return { boundary, body };
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function driveUploadJson(folderId, filename, jsonData, existingFileId) {
  const existing = existingFileId
    ? { id: existingFileId }
    : await driveFindFile(folderId, filename);
  const metadata = existing
    ? { name: filename, mimeType: 'application/json' }
    : { name: filename, mimeType: 'application/json', parents: [folderId] };
  const { boundary, body } = makeMultipartJsonBody(metadata, jsonData);
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,webViewLink`;
  const r = await driveFetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return r.json();
}

async function driveDownloadJson(folderId, filename) {
  const file = await driveFindFile(folderId, filename);
  if (!file) return null;
  const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`);
  return { data: await r.json(), modifiedTime: file.modifiedTime, id: file.id };
}

async function driveUploadBinary(folderId, filename, blob, mimeType) {
  const existing = await driveFindFile(folderId, filename);
  const metadata = existing
    ? { name: filename, mimeType }
    : { name: filename, mimeType, parents: [folderId] };
  const arrayBuffer = await blob.arrayBuffer();
  const dataB64 = arrayBufferToBase64(arrayBuffer);
  const boundary = '-------capexbuilder' + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    dataB64 + `\r\n` +
    `--${boundary}--`;
  const url = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,webViewLink`;
  const r = await driveFetch(url, {
    method: existing ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return r.json();
}

async function pushToDrive(opts = {}) {
  const { silent = false, force = false } = opts;
  if (!STATE) return;
  if (!STATE.drive.folderId) { if (!silent) toast('Link a Drive folder first', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { if (!silent) toast('Set GOOGLE_CLIENT_ID in app.js first', 'error'); return; }
  try {
    if (!silent) toast('Pushing to Drive…');
    const targetFolder = await resolveCapexFolder();
    // Guard: don't clobber a Drive copy that's newer than our watermark (unless
    // force — the user explicitly chose "overwrite Drive" from the conflict bar).
    const existing = await driveFindFile(targetFolder, STATE_FILENAME);
    if (!force && existing && STATE.drive.remoteModifiedTime
        && existing.modifiedTime > STATE.drive.remoteModifiedTime
        && (!STATE.drive.lastPushed || existing.modifiedTime > STATE.drive.lastPushed)) {
      if (silent) {
        // Auto-sync mustn't silently clobber a newer remote. Signal a conflict so
        // the sync bar stops lying "Saving…" and offers the user a resolution
        // (load Drive vs. overwrite) via resolveSyncConflict(); retries next tick.
        console.warn('pushToDrive: remote newer than local — conflict (awaiting user resolve)');
        return 'conflict';
      }
      if (!confirm('The Drive copy was modified more recently than your last sync. Overwrite it with your local data?')) {
        return;
      }
    }
    const res = await driveUploadJson(targetFolder, STATE_FILENAME, STATE, existing && existing.id);
    STATE.drive.fileId = res.id;
    STATE.drive.lastPushed = new Date().toISOString();   // > STATE.updated (edit time) => not dirty
    STATE.drive.remoteModifiedTime = res.modifiedTime;
    // Persist the drive metadata WITHOUT saveState() — saveState bumps `updated`
    // and re-schedules a push, which would loop the auto-push.
    localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    updateSyncBar();
    updateFolderStatus();
    if (!silent) toast('Pushed to Drive', 'success');
    return true;
  } catch (e) {
    if (silent) console.warn('Silent push failed:', e);
    else toast('Push failed: ' + e.message, 'error');
    return false;
  }
}

async function pullFromDrive(opts = {}) {
  const { auto = false } = opts;   // auto = silent Drive-authoritative reconcile (no toasts / no prompt)
  if (!STATE) return;
  if (!STATE.drive.folderId) { if (!auto) toast('Link a Drive folder first', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { if (!auto) toast('Set GOOGLE_CLIENT_ID in app.js first', 'error'); return; }
  try {
    if (!auto) toast('Pulling from Drive…');
    const targetFolder = await resolveCapexFolder();
    const remote = await driveDownloadJson(targetFolder, STATE_FILENAME);
    if (!remote) { if (!auto) toast('No ' + STATE_FILENAME + ' found in 25. Capex/Capex Builder Budget', 'error'); return; }
    const dirty = !STATE.drive.lastPushed || STATE.drive.lastPushed < STATE.updated;
    if (dirty && !auto && !confirm('You have unpushed local changes. Replace them with the Drive copy?')) return;
    // Preserve local identity + drive metadata; overwrite content fields.
    const keep = { id: STATE.id, drive: { ...STATE.drive } };
    Object.keys(STATE).forEach(k => delete STATE[k]);
    Object.assign(STATE, remote.data);
    STATE.id = keep.id;
    STATE.updated = remote.modifiedTime || new Date().toISOString();
    STATE.drive = { ...keep.drive, fileId: remote.id, lastPulled: new Date().toISOString(), remoteModifiedTime: remote.modifiedTime, lastPushed: STATE.updated };
    // Local now matches remote (lastPushed == updated => not dirty). Persist WITHOUT
    // saveState() so `updated` isn't bumped (which would re-flag dirty + auto-push).
    localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    _syncState = 'idle';
    renderShell();
    if (!auto) toast('Pulled from Drive', 'success');
  } catch (e) {
    toast('Pull failed: ' + e.message, 'error');
  }
}

// ---------- Multi-device / multi-user sync (org-wide via central manifest) ----------
// Architecture: a single JSON manifest file lives in SYNC_FOLDER_ID. Every
// teammate's app reads + writes the same manifest, so the home screen shows
// an org-wide index of properties, the auto-sync timer pushes local edits to
// the deal folder every minute, and the heartbeat field surfaces a banner
// when another teammate is editing the same property simultaneously.
//
// Per-property payload still lives in <deal>/25. Capex/Capex Builder Budget/
// capex_builder.json — the manifest just indexes those files + carries
// presence info ({lastModified, lastEditor, currentEditor, heartbeatAt}).

// THE shared org-wide sync folder (provided by user 2026-06-07). All teammates
// must point at this same folder ID. Hardcoded so there is no per-machine setup.
const SYNC_FOLDER_ID = '1yUJKGpeDfzepdV-BjRwmPHe210dK4lDw';
const MANIFEST_FILENAME = 'capex_builder_manifest.json';
const MANIFEST_FILE_ID_KEY = 'capex_manifest_file_id';
const CURRENT_USER_KEY = 'capex_current_user';
const SYNC_INTERVAL_MS = 60_000;            // 1 minute between sync ticks
const HEARTBEAT_STALE_MS = 2.5 * 60_000;    // a heartbeat is "stale" after 2.5 min

let CURRENT_USER = null;            // { email, name, photoLink }
let SYNC_INTERVAL_ID = null;        // setInterval handle
let MANIFEST_CACHE = null;          // last fetched manifest, used by renderHome
let HOME_INDEX_LOADING = false;     // prevent overlapping fetches

// Hydrate cached user identity early so renderHome can paint user-aware UI
// before any network call resolves.
try {
  const cached = localStorage.getItem(CURRENT_USER_KEY);
  if (cached) CURRENT_USER = JSON.parse(cached);
} catch {}

// Access is restricted to SHIR Capital and affiliated domains. The Google OAuth
// consent screen ("Internal" user type) already limits sign-in to our Workspace,
// but we enforce the same allowlist here as defense-in-depth so a misconfigured
// consent screen can never grant access to an outside Google account.
const ALLOWED_EMAIL_DOMAINS = [
  'shircapital.com',
  'pghnexus.com',
  'signaturenexus.com',
  'avasconstruction.com',
];
function isAllowedEmail(email) {
  if (!email || email.indexOf('@') < 0) return false;
  const domain = email.split('@').pop().trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}
async function revokeDriveAccess() {
  const tok = localStorage.getItem(DRIVE_TOKEN_KEY);
  clearDriveToken();
  CURRENT_USER = null;
  try { localStorage.removeItem(CURRENT_USER_KEY); } catch {}
  if (tok && window.google && google.accounts && google.accounts.oauth2) {
    try { google.accounts.oauth2.revoke(tok); } catch {}
  }
  updateDriveStatus();
}

async function fetchCurrentUser({ force = false } = {}) {
  if (CURRENT_USER && !force) return CURRENT_USER;
  const r = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user');
  const j = await r.json();
  if (!j.user || !j.user.emailAddress) throw new Error('Could not read Drive user identity');
  if (!isAllowedEmail(j.user.emailAddress)) {
    await revokeDriveAccess();
    const err = new Error(
      'Access is restricted to SHIR Capital and affiliated domains (' +
      ALLOWED_EMAIL_DOMAINS.join(', ') + '). The account ' + j.user.emailAddress +
      ' is not authorized. Sign in with your company Google account.');
    err.code = 'ACCESS_DENIED';
    throw err;
  }
  CURRENT_USER = {
    email: j.user.emailAddress,
    name: j.user.displayName || j.user.emailAddress,
    photoLink: j.user.photoLink || '',
  };
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(CURRENT_USER));
  return CURRENT_USER;
}

// Find (or create) the manifest file in SYNC_FOLDER_ID. The file ID is cached
// locally so subsequent loads skip the Drive search.
async function resolveManifestFileId() {
  const cached = localStorage.getItem(MANIFEST_FILE_ID_KEY);
  if (cached) {
    try {
      const r = await driveFetch(`https://www.googleapis.com/drive/v3/files/${cached}?fields=id,trashed`);
      const j = await r.json();
      if (j.id && !j.trashed) return cached;
    } catch { /* fall through to search */ }
    localStorage.removeItem(MANIFEST_FILE_ID_KEY);
  }
  const file = await driveFindFile(SYNC_FOLDER_ID, MANIFEST_FILENAME);
  if (file) {
    localStorage.setItem(MANIFEST_FILE_ID_KEY, file.id);
    return file.id;
  }
  // First-time: create an empty manifest in the sync folder.
  const initial = { version: 1, updated: new Date().toISOString(), properties: [] };
  const res = await driveUploadJson(SYNC_FOLDER_ID, MANIFEST_FILENAME, initial);
  localStorage.setItem(MANIFEST_FILE_ID_KEY, res.id);
  return res.id;
}

async function fetchManifest() {
  const fileId = await resolveManifestFileId();
  const metaR = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,modifiedTime`);
  const meta = await metaR.json();
  const dataR = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  let data;
  try { data = await dataR.json(); } catch { data = null; }
  if (!data || typeof data !== 'object' || !Array.isArray(data.properties)) {
    data = { version: 1, updated: new Date().toISOString(), properties: [] };
  }
  MANIFEST_CACHE = { data, fileId, modifiedTime: meta.modifiedTime, fetchedAt: Date.now() };
  return MANIFEST_CACHE;
}

async function writeManifest(data) {
  const fileId = await resolveManifestFileId();
  data.updated = new Date().toISOString();
  const res = await driveUploadJson(SYNC_FOLDER_ID, MANIFEST_FILENAME, data, fileId);
  MANIFEST_CACHE = { data, fileId, modifiedTime: res.modifiedTime, fetchedAt: Date.now() };
  return res;
}

// Read-modify-write a single manifest entry. Race-prone (last writer wins) but
// acceptable for v1 since updates are sparse and small.
async function upsertManifestEntry(entry) {
  const { data } = await fetchManifest();
  const idx = data.properties.findIndex(p => p.id === entry.id);
  if (idx >= 0) data.properties[idx] = { ...data.properties[idx], ...entry };
  else data.properties.push({ ...entry });
  await writeManifest(data);
  return data;
}

async function removeManifestEntry(propertyId) {
  const { data } = await fetchManifest();
  const idx = data.properties.findIndex(p => p.id === propertyId);
  if (idx < 0) return data;
  data.properties.splice(idx, 1);
  await writeManifest(data);
  return data;
}

function buildManifestEntry({ asEditor }) {
  const me = (CURRENT_USER || {}).email || 'unknown';
  const survey = STATE.survey || {};
  const unitMix = Array.isArray(STATE.unitMix) ? STATE.unitMix : [];
  return {
    id: STATE.id,
    name: STATE.name || (STATE.phase1 && STATE.phase1.prop_name) || 'Untitled',
    dealFolderId: STATE.drive.folderId || '',
    capexFileId: STATE.drive.fileId || '',
    lastModified: STATE.updated,
    lastEditor: me,
    currentEditor: asEditor ? me : '',
    currentEditorHeartbeatAt: asEditor ? new Date().toISOString() : '',
    // Quick-status flags surfaced on the home-screen index. Auto-sync refreshes
    // these every minute so the org index stays current.
    surveyProcessed: !!survey.processed_at,
    unitMixImported: unitMix.length > 0,
    unitMixTypeCount: unitMix.length,
  };
}

// Open a property that is in the manifest but not yet on this device:
// resolve the deal folder, download capex_builder.json from
// <deal>/25. Capex/Capex Builder Budget/, then open it locally.
async function openRemoteProperty(entry) {
  if (!entry || !entry.dealFolderId) { toast('No deal folder linked for this property', 'error'); return; }
  if (!getDriveToken()) { try { await driveRequestToken({ silent: false }); } catch (e) { toast('Connect Drive first', 'error'); return; } }
  try {
    toast('Loading from Drive…');
    const capexParent = await driveEnsureSubfolder(entry.dealFolderId, '25. Capex');
    const budgetFolder = await driveEnsureSubfolder(capexParent, 'Capex Builder Budget');
    const remote = await driveDownloadJson(budgetFolder, STATE_FILENAME);
    if (!remote) { toast(`No ${STATE_FILENAME} found in deal folder`, 'error'); return; }
    const now = new Date().toISOString();
    const p = Object.assign(DEFAULT_PROPERTY(), remote.data, {
      id: entry.id,
      drive: {
        folderId: entry.dealFolderId,
        fileId: remote.id,
        capexFolderId: budgetFolder,
        lastPushed: now,
        lastPulled: now,
        remoteModifiedTime: remote.modifiedTime,
        autoSearchAttempted: true,
      },
    });
    STORE.properties[p.id] = p;
    STORE.currentPropertyId = p.id;
    STATE = p;
    maybeGuessMarketMSA();   // backfill an empty Market (MSA) — bumps + pushes only if it fills one
    // Freshly pulled from Drive = already in sync; persist WITHOUT bumping `updated`
    // (bumping would falsely mark it dirty and re-push identical data).
    localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
    CURRENT_PHASE = 1;
    CURRENT_VIEW = 'property';
    renderShell();
    startAutoSync();
    setHash(propertyHash(p));   // reflect the opened remote property in the URL
    toast('Opened from Drive', 'success');
  } catch (e) {
    toast('Open failed: ' + e.message, 'error');
  }
}

// ---------- Auto-sync timer ----------
function startAutoSync() {
  stopAutoSync();
  // Fire one immediately, then on an interval.
  syncTick().catch(() => {});
  SYNC_INTERVAL_ID = setInterval(() => { syncTick().catch(() => {}); }, SYNC_INTERVAL_MS);
}
function stopAutoSync() {
  if (SYNC_INTERVAL_ID) clearInterval(SYNC_INTERVAL_ID);
  SYNC_INTERVAL_ID = null;
}

// One sync pass: push if dirty, refresh heartbeat in the manifest, surface a
// banner when another teammate is editing. Best-effort — failures log and
// retry on the next tick. Called every SYNC_INTERVAL_MS while a property is open.
async function syncTick() {
  if (!STATE) return;
  if (!getDriveToken()) return;
  if (!CURRENT_USER) {
    try { await fetchCurrentUser(); } catch { return; }
  }
  if (!STATE.drive.folderId) return; // cannot sync property data without a deal folder
  try {
    // 1. Push local changes if dirty.
    const dirty = !STATE.drive.lastPushed || STATE.drive.lastPushed < STATE.updated;
    if (dirty) {
      const r = await pushToDrive({ silent: true });
      _syncState = (r === false) ? 'error' : (r === 'conflict') ? 'conflict' : 'idle';
    } else if (_syncState === 'conflict') {
      _syncState = 'idle';   // no longer dirty => the conflict was resolved elsewhere
    }
    // 2. Pull the manifest and check for a concurrent editor.
    const { data } = await fetchManifest();
    const meEmail = (CURRENT_USER || {}).email || '';
    const entry = data.properties.find(p => p.id === STATE.id);
    if (entry && entry.currentEditor && entry.currentEditor !== meEmail) {
      const beat = entry.currentEditorHeartbeatAt ? Date.parse(entry.currentEditorHeartbeatAt) : 0;
      if (Date.now() - beat < HEARTBEAT_STALE_MS) {
        showConcurrentEditBanner(entry.currentEditor, entry.currentEditorHeartbeatAt);
      } else {
        hideConcurrentEditBanner();
      }
    } else {
      hideConcurrentEditBanner();
    }
    // 3. Write our heartbeat + lastModified to the manifest.
    await upsertManifestEntry(buildManifestEntry({ asEditor: true }));
    updateSyncBar();
  } catch (e) {
    console.warn('syncTick failed:', e);
  }
}

// Release the editor lock when leaving a property. Best-effort.
// Skip silently when there's no Drive token — same gate as syncTick. Without
// this, the manifest call would force driveAuthHeader to request a token,
// which (until the silent-first refactor) was popping the Google account
// chooser every time the user exited a property.
async function releaseEditorLock() {
  if (!STATE) return;
  if (!getDriveToken()) return;
  try {
    await upsertManifestEntry(buildManifestEntry({ asEditor: false }));
  } catch (e) {
    console.warn('releaseEditorLock failed:', e);
  }
}

// ---------- Concurrent edit banner ----------
function showConcurrentEditBanner(email, heartbeatAt) {
  let b = $('#concurrent-edit-banner');
  if (!b) {
    b = el('div', {
      id: 'concurrent-edit-banner',
      style: 'background:#fef3c7;color:#92400e;padding:8px 14px;text-align:center;font-size:12px;font-weight:600;border-bottom:1px solid #fbbf24;line-height:1.4'
    });
    const target = $('#phase-content');
    if (target && target.parentElement) target.parentElement.insertBefore(b, target);
    else document.body.appendChild(b);
  }
  const ago = heartbeatAt ? relativeTime(heartbeatAt) : 'just now';
  b.textContent = `⚠️ ${email} is also editing this property (active ${ago}) — your edits may overwrite theirs.`;
  b.style.display = 'block';
}
function hideConcurrentEditBanner() {
  const b = $('#concurrent-edit-banner');
  if (b) b.style.display = 'none';
}

// ---------- Home screen org-wide index ----------
// Fetches the manifest in the background, then re-renders the home view with
// the merged list (local properties + remote-only properties from the manifest).
async function refreshHomeIndex() {
  if (HOME_INDEX_LOADING) return;
  if (!getDriveToken()) return;
  HOME_INDEX_LOADING = true;
  try {
    if (!CURRENT_USER) await fetchCurrentUser();
    await fetchManifest();
  } catch (e) {
    console.warn('refreshHomeIndex failed:', e);
  } finally {
    // Clear the flag BEFORE rendering so the status bar reads "loaded" (or the
    // tap-to-refresh hint), not a frozen "Loading org index…". renderHome reads
    // HOME_INDEX_LOADING synchronously, so rendering while it's still true was
    // leaving the label stuck even though the manifest had loaded fine.
    HOME_INDEX_LOADING = false;
    if (CURRENT_VIEW === 'home') renderHome();
    // A #/p/<id> deep link to a property not on this device opens once the
    // org manifest is available.
    if (_pendingDeepLink) tryOpenPendingDeepLink();
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  bindShell();
  // Unique-URL routing: react to back/forward + opened links.
  window.addEventListener('hashchange', routeFromHash);
  // Initial route. A #/prop/<slug> (or legacy #/p/<id>) deep link wins over the
  // localStorage last-open.
  const _parsed = parseHash();
  const _localProp = findLocalPropertyByHash(_parsed);
  if (_localProp) {
    STORE.currentPropertyId = _localProp.id;
    STATE = _localProp;
    CURRENT_PHASE = 1;
    CURRENT_VIEW = 'property';
    saveState();
    renderShell();
    setHash(propertyHash(STATE));
  } else if (_parsed) {
    // Deep link to a property not on this device yet — show home; it opens once
    // the org manifest loads (tryOpenPendingDeepLink). Keep the URL intact.
    _pendingDeepLink = _parsed;
    STATE = null; STORE.currentPropertyId = null; CURRENT_VIEW = 'home';
    renderShell();
  } else {
    // No deep link: render the localStorage last-open default and mirror it in the URL.
    renderShell();
    if (CURRENT_VIEW === 'property' && STATE) setHash(propertyHash(STATE));
  }
  // Try to silently refresh the Drive token on load so push/pull just works.
  // Either outcome flips _driveSilentDone + re-renders home so the connect gate
  // (renderDriveGate) shows only after silent auth has actually failed.
  if (GOOGLE_CLIENT_ID && !getDriveToken()) {
    // Safety net: GIS prompt:'none' can hang without ever calling back (no active
    // Google session / blocked 3p cookies). Flip the flag after 4s so the gate
    // stops saying "Reconnecting…" and surfaces the manual Connect button.
    const _silentTimer = setTimeout(() => {
      if (_driveSilentDone) return;
      _driveSilentDone = true;
      if (CURRENT_VIEW === 'home') renderHome();
    }, 4000);
    driveRequestToken({ silent: true })
      .then(async () => {
        clearTimeout(_silentTimer);
        _driveSilentDone = true;
        updateDriveStatus();
        try { await fetchCurrentUser(); } catch {}
        // Refresh the home index (if on home) or start sync (if on a property).
        if (CURRENT_VIEW === 'home') { renderHome(); refreshHomeIndex(); }
        else if (CURRENT_VIEW === 'property') startAutoSync();
      })
      .catch(() => { clearTimeout(_silentTimer); _driveSilentDone = true; if (CURRENT_VIEW === 'home') renderHome(); });
  } else if (getDriveToken()) {
    // Token already valid — fetch user + refresh / sync without re-prompting.
    fetchCurrentUser().catch(() => {});
    if (CURRENT_VIEW === 'home') refreshHomeIndex();
    else if (CURRENT_VIEW === 'property') startAutoSync();
  }
  // Best-effort lock release when the user closes the tab.
  window.addEventListener('beforeunload', () => {
    if (STATE) {
      // Fire-and-forget; some browsers cancel async work but the heartbeat
      // will go stale (>2.5 min) anyway, so the lock auto-releases.
      try { releaseEditorLock(); } catch {}
    }
    stopAutoSync();
  });
});
