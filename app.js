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
  phase3: {}, // Details: keyed `${gi}.${si}.${ii}` -> {qty, unit_type, unit_cost, notes, mf_linked, pct_group_id}
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
function saveState() {
  if (STATE) {
    STATE.updated = new Date().toISOString();
    // Keep displayed name in sync with phase1.prop_name when the user edits it on the form
    if (STATE.phase1 && STATE.phase1.prop_name) STATE.name = STATE.phase1.prop_name;
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(STORE));
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
  saveState();
  CURRENT_PHASE = 1;
  CURRENT_VIEW = 'property';
  renderShell();
  // Kick off the auto-sync loop for this property — pushes dirty changes,
  // refreshes our heartbeat, surfaces concurrent-editor banners.
  if (typeof startAutoSync === 'function') startAutoSync();
}
function closeProperty() {
  // Stop auto-sync and release our editor lock so teammates don't see a stale
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
}
function deleteProperty(id) {
  delete STORE.properties[id];
  if (STORE.currentPropertyId === id) {
    STORE.currentPropertyId = null;
    STATE = null;
    CURRENT_VIEW = 'home';
  }
  saveState();
  // Best-effort: remove from the org manifest too. If a teammate still has
  // the property locally, their next sync tick will recreate the entry —
  // which is what we want (delete = drop my local copy, not org-wide remove).
  if (typeof removeManifestEntry === 'function' && getDriveToken()) {
    removeManifestEntry(id).catch((e) => console.warn('removeManifestEntry failed', e));
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

function renderField(field, value, onChange) {
  // 'info' fields: italic gray summary text, no input.
  if (field.type === 'info') {
    const div = el('div', { class: 'field info-text' });
    div.setAttribute('data-key', field.key);
    div.textContent = '';
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

  const wrap = el('div', { class: 'field' + (field.computed ? ' computed' : '') });
  wrap.appendChild(el('label', {}, field.label + (field.required ? ' *' : '')));
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
    input.value = value || '';
  } else {
    input = el('input', { type: field.type || 'text' });
    if (field.pattern) input.pattern = field.pattern;
    if (field.min !== undefined) input.min = field.min;
    if (field.max !== undefined) input.max = field.max;
    if (field.step !== undefined) input.step = field.step;
    // Computed fields WITHOUT a partner are read-only (pure auto-calc).
    // Computed fields WITH a partner (e.g. land_sf <-> land_acres) remain editable.
    if (field.computed && !field.partner) input.readOnly = true;
    const initial = field.decimals !== undefined ? formatNumber(value, field.decimals) : (value !== undefined && value !== null ? value : '');
    input.value = initial;
  }

  input.addEventListener('input', () => onChange(input.value));
  input.addEventListener('change', () => onChange(input.value));
  if (field.type === 'number' && field.decimals !== undefined) {
    input.addEventListener('blur', () => {
      if (input.value === '') return;
      input.value = formatNumber(input.value, field.decimals);
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
    } else if (ff.computed) {
      const cv = computeField(ff.computed, eb);
      bag[ff.key] = cv;
      const inp = body.querySelector(`[data-key="${ff.key}"]`);
      if (inp) inp.value = ff.decimals !== undefined ? formatNumber(cv, ff.decimals) : (isFinite(cv) ? cv : '');
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
}

function renderSchemaForm(sections, bag, onUpdate) {
  const frag = document.createDocumentFragment();
  sections.forEach((sec, si) => {
    // Default to collapsed; preserve user's explicit choice during the session.
    const collapsed = window['_collapsed_' + sec.section] !== false;
    const body = el('div', { class: 'section-body' });

    let activeExpGroup = null;
    let activeExpExpr = null;

    sec.fields.forEach(f => {
      let value;
      if (f.type === 'info') value = '';
      else if (f.computed) { value = computeField(f.computed, getEvalBag(bag)); bag[f.key] = value; }
      else value = bag[f.key];

      const fieldNode = renderField(f, value, (v) => {
        bag[f.key] = (f.type === 'multiselect') ? (Array.isArray(v) ? v : [])
                   : (f.type === 'number') ? (v === '' ? '' : Number(v)) : v;
        if (f.partner && bag[f.key] !== '') {
          const pv = computeField(f.partner.expr, getEvalBag(bag));
          bag[f.partner.target] = pv;
          const pInp = body.querySelector(`[data-key="${f.partner.target}"]`);
          if (pInp) {
            const partnerField = sec.fields.find(x => x.key === f.partner.target);
            pInp.value = (partnerField && partnerField.decimals !== undefined) ? formatNumber(pv, partnerField.decimals) : (isFinite(pv) ? pv : '');
          }
        }
        refreshSection(sec, body, bag);
        saveState();
        onUpdate && onUpdate();
      });
      const inp = fieldNode.querySelector ? fieldNode.querySelector('input, select, textarea') : null;
      if (inp) inp.setAttribute('data-key', f.key);

      // Group consecutive same-show_if fields into an indented expansion-group container,
      // but ONLY when 2+ fields share the same show_if (single-field conditionals don't need a toggle).
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
        } else {
          // Single conditional field: render inline; refreshSection toggles its display.
          activeExpGroup = null;
          activeExpExpr = null;
          body.appendChild(fieldNode);
        }
      } else {
        activeExpGroup = null;
        activeExpExpr = null;
        body.appendChild(fieldNode);
      }
    });

    setTimeout(() => refreshSection(sec, body, bag), 0);

    const section = el('section', { class: 'section' + (collapsed ? ' collapsed' : '') },
      el('header', { class: 'section-header',
        onClick: (e) => {
          e.currentTarget.parentElement.classList.toggle('collapsed');
          window['_collapsed_' + sec.section] = e.currentTarget.parentElement.classList.contains('collapsed');
        }
      },
        el('span', {}, sec.section),
        el('span', { class: 'chev' }, '▼')
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
function renderExpandCollapseBar() {
  const btnStyle = 'padding:6px 10px;font-size:12px;font-weight:600;background:var(--surface);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--primary);white-space:nowrap';
  const bar = el('div', {
    class: 'expand-collapse-bar',
    style: 'display:flex;justify-content:flex-end;gap:6px;margin:0 0 10px'
  });
  bar.appendChild(el('button', {
    type: 'button', style: btnStyle, title: 'Expand all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section.collapsed')
        .forEach(s => s.classList.remove('collapsed'));
    },
  }, '▼ Expand all'));
  bar.appendChild(el('button', {
    type: 'button', style: btnStyle, title: 'Collapse all sections on this tab',
    onClick: () => {
      $('#phase-content').querySelectorAll('.section')
        .forEach(s => s.classList.add('collapsed'));
    },
  }, '▶ Collapse all'));
  return bar;
}

// ---------- Phase 1: Basics (identity + Physical characteristics folded in) ----------
function renderPhase1() {
  const root = el('div');
  root.appendChild(renderExpandCollapseBar());
  root.appendChild(renderSchemaForm(SCHEMA.phase1, STATE.phase1));

  // Inject the Unit Mix block into the "Units & Area" schema section so the
  // unit-by-unit breakdown lives next to the totals it feeds. Sums (mf_units,
  // mf_rsf) auto-populate the Units & Area inputs via syncUnitMixSumsToPhase1.
  const sections = root.querySelectorAll('section.section');
  for (const sec of sections) {
    const hdr = sec.querySelector('.section-header span');
    if (hdr && hdr.textContent.trim() === 'Units & Area') {
      const body = sec.querySelector('.section-body');
      if (body) body.appendChild(renderUnitMix());
      break;
    }
  }

  // Survey block (per-building breakdown + Import/Process buttons) follows the
  // flat "Survey-Derived Site Specs" schema section.
  root.appendChild(renderSurveyBlock());
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
// ignored so they don't clobber a user's manual entries.
function syncUnitMixSumsToPhase1() {
  if (!STATE || !STATE.phase1) return;
  const rows = getUnitMix();
  const totalUnits = rows.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const totalRSF = rows.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.sqft) || 0), 0);
  if (totalUnits > 0) STATE.phase1.mf_units = totalUnits;
  if (totalRSF > 0)   STATE.phase1.mf_rsf   = totalRSF;
  // Reflect the new values in the visible inputs (no-op if Phase 1 isn't on screen).
  const setVal = (key, val) => {
    const inp = document.querySelector(`[data-key="${key}"]`);
    if (inp) inp.value = val ? val : '';
  };
  if (totalUnits > 0) setVal('mf_units', totalUnits);
  if (totalRSF > 0)   setVal('mf_rsf', totalRSF);
  // overall_rsf is computed (mf_rsf + commercial_rsf + common_sf); recompute its display.
  const commRsf  = Number(STATE.phase1.commercial_rsf) || 0;
  const commonSf = Number(STATE.phase1.common_sf) || 0;
  const mfRsf    = Number(STATE.phase1.mf_rsf) || 0;
  const overall  = Math.round(mfRsf + commRsf + commonSf);
  const overallInp = document.querySelector('[data-key="overall_rsf"]');
  if (overallInp) overallInp.value = overall || '';
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
      el('strong', {}, '☁ Pull from Drive'),
      ' finds the latest “Full AI UW” file in this deal’s 2. UW-Analysis folder (you confirm it first), or use ',
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

function renderUnitRow(r, i, rebuild) {
  const wrap = el('div', { class: 'unit-row' });
  wrap.style.cssText = 'border:1px solid #e5e7eb;border-radius:8px;margin:6px 16px;background:#fff;overflow:hidden';

  // Collapsed summary bar — shows type · count · sqft only. Click to expand.
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
    r.type || '(unnamed)');
  const metaText = (rr) => {
    const bb = (rr.beds !== '' && rr.beds != null && rr.baths !== '' && rr.baths != null)
      ? `${rr.beds}×${rr.baths} · ` : '';
    return `${bb}${rr.count || 0} units${rr.sqft ? ' · ' + rr.sqft + ' sf' : ''}`;
  };
  const metaSpan = el('span', { style: 'color:#64748b;font-size:13px;white-space:nowrap' }, metaText(r));
  summaryBar.appendChild(chev);
  summaryBar.appendChild(nameSpan);
  summaryBar.appendChild(metaSpan);
  wrap.appendChild(summaryBar);

  // Expanded form — hidden by default.
  const details = el('div', { style: 'display:none;padding:10px 12px;border-top:1px solid #e5e7eb' });
  wrap.appendChild(details);

  const typeInput = el('input', { type: 'text', placeholder: 'Unit type (e.g. 1BR / 1BA – Plan A)' });
  typeInput.value = r.type || '';
  typeInput.addEventListener('input', () => {
    updateUnitRow(i, { type: typeInput.value });
    nameSpan.textContent = typeInput.value || '(unnamed)';
  });
  details.appendChild(el('div', { class: 'unit-row-top' },
    typeInput,
    el('button', { class: 'unit-remove', title: 'Remove unit type',
      onClick: (e) => { e.stopPropagation(); removeUnitRow(i); rebuild(); } }, '✕')
  ));

  const updateMeta = () => { metaSpan.textContent = metaText(r); };

  const numField = (label, key) => el('div', { class: 'field' },
    el('label', {}, label),
    (() => {
      const inp = el('input', { type: 'number', min: 0, step: 'any' });
      inp.value = r[key] ?? '';
      inp.addEventListener('input', () => {
        const v = inp.value === '' ? '' : Number(inp.value);
        updateUnitRow(i, { [key]: v });
        r[key] = v;
        updateMeta();
      });
      return inp;
    })()
  );

  const statusField = el('div', { class: 'field' },
    el('label', {}, 'Status'),
    (() => {
      const s = el('select');
      s.appendChild(el('option', { value: '' }, '—'));
      UNIT_STATUS.forEach(o => {
        const op = el('option', { value: o }, o);
        if (r.status === o) op.selected = true;
        s.appendChild(op);
      });
      s.addEventListener('change', () => updateUnitRow(i, { status: s.value }));
      return s;
    })()
  );

  details.appendChild(el('div', { class: 'unit-grid' },
    numField('# Units', 'count'),
    numField('Beds', 'beds'),
    numField('Baths', 'baths'),
    numField('SqFt', 'sqft'),
    statusField
  ));
  return wrap;
}

// ---------- Survey-derived site specs (Per-building breakdown + Import / Process) ----------
// The flat survey fields (perimeter, parking lot SF, roof/facade totals, fencing notes,
// landscaping_sf, etc.) are part of phase1[Survey-Derived Site Specs] and render as a
// regular schema section above this block. This section adds:
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
  // Start collapsed by default — most users don't need to see the per-building
  // breakdown unless they're importing a survey.
  const section = el('section', { class: 'section collapsed' });
  section.appendChild(el('header', { class: 'section-header',
    onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
    el('span', {}, 'Per-Building Survey Breakdown'),
    el('span', { class: 'chev' }, '▼')
  ));
  const body = el('div', { class: 'section-body' });
  section.appendChild(body);

  function rebuild() {
    body.innerHTML = '';
    const s = ensureSurveyState();
    const blds = s.buildings;

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

    // Action buttons row — same nowrap-scroll pattern as Unit Mix.
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
        onClick: () => toast('Coming in Push 2 — for now, run the survey-breakdown-specs skill in Claude, then click Import Survey.', 'success') }, '🛰 Process Survey'),
      fileInput
    );
    body.appendChild(actions);

    blds.forEach((b, i) => body.appendChild(renderSurveyBuildingRow(b, i, rebuild)));

    body.appendChild(el('div', { class: 'um-note' },
      el('strong', {}, 'Populating these fields: '),
      'click ', el('strong', {}, '📥 Import Survey'), ' to load the latest ',
      el('em', {}, '*_SurveyBreakdownSpecs_*.xlsx'),
      ' from this deal’s ', el('em', {}, '7. Title_Survey/Reports/'),
      ' folder, or ', el('strong', {}, '⬆ Upload XLSX'),
      ' to pick a file manually. Each import overwrites the flat fields above ',
      '(perimeter, parking lot SF, roof/facade totals, fencing notes, landscaping SF) ',
      'and replaces the buildings list with the Site-Total values from the workbook.'
    ));
    return body;
  }
  rebuild();
  return section;
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
    (() => {
      const inp = el('input', { type: 'number', min: 0, step: step || 'any' });
      inp.value = b[key] ?? '';
      inp.addEventListener('input', () => {
        const v = inp.value === '' ? '' : Number(inp.value);
        updateSurveyBuilding(i, { [key]: v });
        b[key] = v;
        updateMeta();
      });
      return inp;
    })()
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
  let currentSection = null;   // '7' | '8' | '9' — which item we're inside
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

// Find and import the latest *_SurveyBreakdownSpecs_*.xlsx from this deal's
// 7. Title_Survey/Reports/ folder (with legacy SurveyLayoutSpecs fallback).
async function importSurveyFromDrive(rebuild) {
  if (!STATE) return;
  if (!STATE.drive.folderId) { toast('Link this property to a Drive deal folder first (☰ → Find/Link).', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { toast('Connect Google Drive first', 'error'); return; }
  try {
    toast('Searching for survey report in Drive…');
    // 1) Locate 7. Title_Survey subfolder.
    const subs = await listSubfolders(STATE.drive.folderId);
    const ts = subs.find(f => /^\s*7\.?\s*title[\s_\-]*survey/i.test(f.name))
            || subs.find(f => /title[\s_\-]*survey/i.test(f.name));
    if (!ts) { toast('No “7. Title_Survey” folder under this deal.', 'error'); return; }
    // 2) Locate Reports subfolder (created by the skill).
    const tsSubs = await listSubfolders(ts.id);
    const reports = tsSubs.find(f => /^reports?$/i.test(f.name));
    if (!reports) { toast('No “Reports” subfolder inside 7. Title_Survey — run the skill first.', 'error'); return; }
    // 3) List xlsx candidates matching *SurveyBreakdownSpecs* or *SurveyLayoutSpecs* (legacy).
    const files = await driveListFilesInFolder(reports.id);
    const matches = files.filter(f =>
      /\.xlsx?$/i.test(f.name) &&
      /survey(breakdown|layout)specs/i.test(f.name.replace(/[\s_\-]/g, ''))
    );
    if (!matches.length) { toast('No SurveyBreakdownSpecs workbook found in 7. Title_Survey/Reports/.', 'error'); return; }
    // 4) Sort by date in filename (YYYY-MM-DD) desc, then by modifiedTime.
    const dateOf = (name) => {
      const m = String(name || '').match(/(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : '';
    };
    matches.sort((a, b) => {
      const dd = dateOf(b.name).localeCompare(dateOf(a.name));
      if (dd !== 0) return dd;
      return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
    });
    // 5) Confirm pick (with next-best walk, same UX as proforma import).
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

// Secondary parser: raw per-unit rent roll — aggregate one row per unit by
// (Unit Type Name + Reno/Unreno status). Header must have both a "Unit Type Name"
// column and a per-unit "Unit #" column to be recognized.
function parseProformaRR(wb) {
  // Scan RR / rent-roll sheets first.
  const sheets = wb.SheetNames.slice().sort((a, b) =>
    (/^rr$|rent\s*roll/i.test(b) ? 1 : 0) - (/^rr$|rent\s*roll/i.test(a) ? 1 : 0));
  for (const sn of sheets) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, blankrows: false });
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

// Fallback parser: a simple unit-mix summary table (one row per unit type) on any sheet.
function parseGenericUnitMix(wb) {
  const sheetName = wb.SheetNames.find(n => /unit\s*mix/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, blankrows: false });
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
  if (headerIdx < 0) return null;
  const out = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const get = (idx) => (idx >= 0 ? row[idx] : '');
    const typeVal = String(get(cols.type) || '').trim();
    if (!typeVal) continue;
    out.push({ type: typeVal, count: umNum(get(cols.count)), beds: umNum(get(cols.beds)), baths: umNum(get(cols.baths)), sqft: umNum(get(cols.sqft)), status: umStatus(get(cols.status)) });
  }
  return out.length ? out : null;
}

// Import unit mix from the deal proforma. Reads the SHIR "RR" rent roll first,
// falling back to a generic unit-mix summary table.
function importProformaUnitMix(file, rebuild) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const out = parseSHIRSummaryRR(wb) || parseProformaRR(wb) || parseGenericUnitMix(wb);
      if (!out || !out.length) {
        toast('Could not find unit-mix data (looked for the RR rent roll — see the note).', 'error');
        return;
      }
      if (getUnitMix().length && !confirm(`Replace the current ${getUnitMix().length} unit type(s) with ${out.length} from the proforma?`)) return;
      STATE.unitMix = out;
      saveState();
      rebuild();
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

// Pull the proforma straight from the linked deal folder: find 2. UW-Analysis →
// the latest "Full AI UW" workbook, confirm it (with created/modified dates), then import.
async function pullProformaFromDrive(rebuild) {
  if (!STATE) return;
  if (!STATE.drive.folderId) { toast('Link this property to a Drive deal folder first (☰ → Find/Link).', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { toast('Connect Google Drive first', 'error'); return; }
  try {
    toast('Finding the proforma in Drive…');
    // 1) Locate the "2. UW-Analysis" subfolder of the deal folder.
    const subs = await listSubfolders(STATE.drive.folderId);
    const uw = subs.find(f => /uw[\s\-_.]*analysis/i.test(f.name))
            || subs.find(f => /uw/i.test(f.name) && /analy/i.test(f.name));
    if (!uw) { toast('No “2. UW-Analysis” folder found in the deal folder.', 'error'); return; }

    // 2) Files with "Full AI UW" in the name (xlsx or Google Sheet).
    const files = await driveListFilesInFolder(uw.id);
    const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const needle = norm('Full AI UW');
    const matches = files.filter(f =>
      norm(f.name).includes(needle) &&
      (/\.xlsx?$/i.test(f.name) ||
       f.mimeType === 'application/vnd.google-apps.spreadsheet' ||
       f.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    );
    if (!matches.length) { toast('No “Full AI UW” spreadsheet found in 2. UW-Analysis.', 'error'); return; }

    // 3) Sort by version number desc (v3.5 > v3 > v2.5 > v2 > v1), with
    //    modifiedTime as a tiebreaker for files without a version tag.
    const extractVersion = (name) => {
      const m = String(name || '').match(/[vV](\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) : -1;
    };
    matches.sort((a, b) => {
      const vDiff = extractVersion(b.name) - extractVersion(a.name);
      if (vDiff !== 0) return vDiff;
      return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
    });
    const fmtD = (iso) => iso ? new Date(iso).toLocaleString() : 'unknown';
    const labelFor = (mf) => {
      const v = extractVersion(mf.name);
      return v >= 0 ? `v${v}` : `(no version tag)`;
    };

    // Detect a tie at the top: multiple files share the highest version number.
    // When that happens, the version-only sort isn't decisive (modifiedTime
    // tiebreaker is arbitrary), so let the user pick from a numbered list.
    const topVersion = extractVersion(matches[0].name);
    const tiedAtTop = matches.filter(m => extractVersion(m.name) === topVersion);

    let f = null;
    if (tiedAtTop.length > 1) {
      const versionLabel = topVersion >= 0 ? `v${topVersion}` : '(no version tag)';
      const msg =
        `Multiple proforma files share the highest version (${versionLabel}).\n` +
        `Pick one:\n\n` +
        tiedAtTop.map((c, i) =>
          `${i + 1}. ${c.name}\n` +
          `   Modified: ${fmtD(c.modifiedTime)}`
        ).join('\n\n') +
        `\n\nEnter 1-${tiedAtTop.length} (or blank to cancel):`;
      const pick = prompt(msg, '1');
      const idx = parseInt(pick, 10);
      if (!idx || idx < 1 || idx > tiedAtTop.length) return;
      f = tiedAtTop[idx - 1];
    } else {
      // Unique highest version — confirm it, with OK/Cancel walk through the
      // rest of the sorted list as a fallback if the user rejects.
      for (let idx = 0; idx < matches.length; idx++) {
        const candidate = matches[idx];
        const remaining = matches.length - idx - 1;
        const nextHint = remaining > 0
          ? `\n\n[OK = use this · Cancel = see next best (${remaining} more)]`
          : `\n\n[OK = use this · Cancel = abort (no more candidates)]`;
        const ok = confirm(
          `Import unit mix from this proforma?\n\n` +
          `📄 ${candidate.name}\n` +
          `Version:  ${labelFor(candidate)}\n` +
          `Created:  ${fmtD(candidate.createdTime)}\n` +
          `Modified: ${fmtD(candidate.modifiedTime)}` +
          nextHint
        );
        if (ok) { f = candidate; break; }
        // Cancelled: if no more candidates, abort entirely.
        if (remaining === 0) return;
      }
      if (!f) return;
    }

    // 4) Download (export if it's a native Google Sheet) and parse.
    toast('Downloading proforma…');
    const isGSheet = f.mimeType === 'application/vnd.google-apps.spreadsheet';
    const url = isGSheet
      ? `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=${encodeURIComponent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}`
      : `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`;
    const r = await driveFetch(url);
    const buf = await r.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const out = parseSHIRSummaryRR(wb) || parseProformaRR(wb) || parseGenericUnitMix(wb);
    if (!out || !out.length) { toast('Found the file but could not parse a unit mix from its RR tab.', 'error'); return; }
    if (getUnitMix().length && !confirm(`Replace the current ${getUnitMix().length} unit type(s) with ${out.length} from ${f.name}?`)) return;
    STATE.unitMix = out;
    saveState();
    rebuild();
    toast(`Imported ${out.length} unit row(s) from ${f.name}`, 'success');
  } catch (e) {
    toast('Proforma pull failed: ' + e.message, 'error');
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
  'Amenities/Common Areas': '#242852',
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
function groupHeader(groupName) {
  const color = GROUP_COLORS[groupName];
  const txt = color ? textOn(color) : null;
  const headerAttrs = {
    class: 'section-header group-header',
    onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed'),
  };
  if (color) headerAttrs.style = `background:${color};color:${txt};border-bottom-color:rgba(0,0,0,0.12)`;
  return el('header', headerAttrs,
    el('span', { style: 'font-size:15px;font-weight:700' + (txt ? `;color:${txt}` : '') }, groupName.toUpperCase()),
    el('span', { class: 'chev', style: txt ? `color:${txt}` : '' }, '▼')
  );
}

// ---------- Phase 2: Questionnaire (CAPEX checklist — checkboxes only) ----------
function renderPhase2() {
  const root = el('div');
  root.appendChild(renderExpandCollapseBar());
  const summary = el('div', { class: 'summary-totals' },
    el('div', { class: 'summary-row grand' },
      el('span', { class: 'label' }, 'Items selected'),
      el('span', { class: 'value', 'data-checked-count': true }, String(countChecked())))
  );
  root.appendChild(summary);
  root.appendChild(el('div', { class: 'muted small', style: 'margin:-8px 2px 14px' },
    'Check every capex item this property needs. Selected items appear in the Details tab for pricing.'));

  const refreshCount = () => {
    const n = root.querySelector('[data-checked-count]');
    if (n) n.textContent = String(countChecked());
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
      // so clicking them doesn't also collapse the section via the header.
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
      const secNode = el('section', { class: 'section' },
        el('header', { class: 'section-header', style: secHeaderStyle,
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
          el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1' }, sec.name),
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
    const groupNode = el('section', { class: 'section group-section' }, groupHeader(group.name), groupBody);
    root.appendChild(groupNode);
  });
  return root;
}

// ---------- Phase 3: Details (checked items only — # units, unit type, $/unit) ----------
// '%' is a special type: the row's $/Qty becomes a read-only display of
// (selected CAPEX Group total) / 100, and the row's $ Amt = (qty / 100) ×
// group total. A sub-row appears below the line item to pick the group.
const UNIT_TYPES = ['Each', 'SF', 'LF', 'SY', 'CY', 'LS', 'Unit', 'Allowance', 'Hour', 'Day', '%'];

function getP3(gi, si, ii) {
  return STATE.phase3[ckKey(gi, si, ii)] || { qty: '', unit_type: '', unit_cost: '', notes: '', mf_linked: false, pct_group_id: '' };
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
  // Clear any phase3 rows that referenced this group so they don't dangle.
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
    total += (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
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
  return qty * (Number(v.unit_cost) || 0);
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
      if (costInp) costInp.value = grpTotal ? (grpTotal / 100).toFixed(2) : '';
      const grpTotEl = wrap.querySelector('[data-pct-grouptotal]');
      if (grpTotEl) grpTotEl.textContent = grpTotal ? `(group: ${fmtMoney(grpTotal)})` : '';
    }
    renderDetailTotals(wrap, gi, si, ii);
  });
  if (summaryNode) updateDetailSummary(summaryNode);
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

// Shared 6-col grid for the Details page: item name | =MF checkbox | # Qty |
// Qty Type | $/Qty | $ Amt. Used by both the sticky column header and each
// line-item row so columns line up cleanly.
const DETAIL_GRID_COLS = 'minmax(0,1fr) 44px 64px 78px 72px 84px';
const DETAIL_GRID_BASE = `display:grid;grid-template-columns:${DETAIL_GRID_COLS};align-items:center;gap:6px;padding:6px 10px`;

function renderPhase3() {
  const root = el('div');
  root.appendChild(renderExpandCollapseBar());
  const totals = computeTotals();

  // Sticky top panel: summary (items priced + running subtotal) + column header.
  // Pinned just below the global app-header (top 60px) + phase-tabs (~41px) so the
  // main nav tabs stay visible at all times. z-index 8 stays under the app-header (10)
  // and phase-tabs (9).
  const sticky = el('div', { style: 'position:sticky;top:101px;z-index:8;background:#fff;border-bottom:1px solid #cbd5e1;box-shadow:0 2px 4px rgba(0,0,0,0.05);margin:0 -16px 0' });
  const summary = el('div', { class: 'summary-totals', style: 'margin:0' },
    el('div', { class: 'summary-row' },
      el('span', { class: 'label' }, 'Items priced'),
      el('span', { class: 'value' }, String(totals.itemCount))),
    el('div', { class: 'summary-row grand' },
      el('span', { class: 'label' }, 'Running Subtotal'),
      el('span', { class: 'value' }, fmtMoney(totals.subtotal)))
  );
  sticky.appendChild(summary);
  // Column header row — same grid template as data rows so cells align.
  const colHdr = el('div', {
    style: DETAIL_GRID_BASE + ';font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;background:#f8fafc;border-top:1px solid #e5e7eb'
  },
    el('div', {}, 'Item'),
    el('div', { style: 'text-align:center' }, '=MF'),
    el('div', { style: 'text-align:right' }, '# Qty'),
    el('div', {}, 'Qty Type'),
    el('div', { style: 'text-align:right' }, '$/Qty'),
    el('div', { style: 'text-align:right' }, '$ Amt'),
  );
  sticky.appendChild(colHdr);
  root.appendChild(sticky);

  if (countChecked() === 0) {
    root.appendChild(el('div', { class: 'home-empty' },
      'No items selected yet. Check items on the Questionnaire tab and they’ll appear here for pricing.'));
    return root;
  }

  SCHEMA.phase3.forEach((group, gi) => {
    if (!group.sections.length) return;
    const groupBody = el('div', { class: 'section-body group-body' });
    let groupHasChecked = false;
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
        secBody.appendChild(renderDetailItem(gi, si, ii, item, summary, { rowIdleBg, rowPricedBg }));
      });
      const secHeaderStyle = subHeaderBg
        ? `background:${subHeaderBg};color:${subHeaderTxt}`
        : '';
      const secNode = el('section', { class: 'section' },
        el('header', { class: 'section-header', style: secHeaderStyle,
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
          el('span', {}, sec.name),
          el('span', { class: 'chev', style: subHeaderTxt ? `color:${subHeaderTxt}` : '' }, '▼')
        ),
        secBody
      );
      groupBody.appendChild(secNode);
    });
    if (!groupHasChecked) return;
    const groupNode = el('section', { class: 'section group-section' }, groupHeader(group.name), groupBody);
    root.appendChild(groupNode);
  });
  // CAPEX Groups manager — user-defined buckets used by any % line item.
  root.appendChild(renderCapexGroupsSection(summary));
  return root;
}

function renderDetailItem(gi, si, ii, item, summaryNode, tints) {
  const v = getP3(gi, si, ii);
  // If this row is linked to MF Units (=MF checkbox on), force its qty to
  // match the current Basics → Units & Area mf_units value before rendering.
  if (v.mf_linked) {
    const mf = Number(STATE.phase1.mf_units) || 0;
    if (mf > 0 && v.qty !== mf) {
      setP3(gi, si, ii, { qty: mf });
    }
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

  // Inputs are declared up front so the =MF and type-change handlers can flip
  // qty/cost readonly state.
  const qtyInp = el('input', {
    type: 'number', min: 0, step: 'any',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box'
  });
  qtyInp.value = v.qty;
  if (v.mf_linked) { qtyInp.readOnly = true; qtyInp.style.background = '#f1f5f9'; }
  qtyInp.addEventListener('input', () => {
    if (qtyInp.readOnly) return;
    setP3(gi, si, ii, { qty: qtyInp.value === '' ? '' : Number(qtyInp.value) });
    recomputePctRowsAndSummary(summaryNode);
  });

  // Col 2: =MF Units checkbox
  const mfCb = el('input', { type: 'checkbox', style: 'width:16px;height:16px;cursor:pointer' });
  mfCb.checked = !!v.mf_linked;
  mfCb.title = '=MF Units (auto-fill # Qty from Basics → Number of MF Units)';
  mfCb.addEventListener('change', () => {
    const linked = mfCb.checked;
    if (linked) {
      const mf = Number(STATE.phase1.mf_units) || 0;
      setP3(gi, si, ii, { mf_linked: true, qty: mf });
      qtyInp.value = mf || '';
      qtyInp.readOnly = true;
      qtyInp.style.background = '#f1f5f9';
    } else {
      setP3(gi, si, ii, { mf_linked: false });
      qtyInp.readOnly = false;
      qtyInp.style.background = '';
    }
    recomputePctRowsAndSummary(summaryNode);
  });
  itemWrap.appendChild(el('div', { style: 'text-align:center' }, mfCb));

  // Col 3: # Qty (interpreted as the percentage value when unit_type === '%')
  itemWrap.appendChild(qtyInp);

  // Col 4: Qty Type
  // If the schema carries a default_qty_type for this item (from column G of
  // Capex_Builder_Line_Items_Control.xlsx) and the user hasn't picked one yet,
  // pre-select the default. Users can still override to anything in the list,
  // and selecting "—" effectively means "fall back to the default on next render."
  const effectiveUT = v.unit_type || item.default_qty_type || '';
  const utSel = el('select', { style: 'width:100%;padding:3px 4px;font-size:12px;box-sizing:border-box' });
  utSel.appendChild(el('option', { value: '' }, '—'));
  UNIT_TYPES.forEach(u => {
    const o = el('option', { value: u }, u);
    if (effectiveUT === u) o.selected = true;
    utSel.appendChild(o);
  });
  utSel.addEventListener('change', () => {
    setP3(gi, si, ii, { unit_type: utSel.value });
    syncTypeRelatedUI();
    recomputePctRowsAndSummary(summaryNode);
  });
  itemWrap.appendChild(utSel);

  // Col 5: $/Qty — becomes a read-only display (group total ÷ 100) when type === '%'.
  const costInp = el('input', {
    type: 'number', min: 0, step: 'any', placeholder: item.default_cost_per_item ?? '',
    style: 'width:100%;padding:4px 6px;font-size:13px;text-align:right;box-sizing:border-box'
  });
  costInp.setAttribute('data-cost-input', '');
  costInp.value = v.unit_cost !== '' ? v.unit_cost : '';
  costInp.addEventListener('input', () => {
    if (costInp.readOnly) return;
    setP3(gi, si, ii, { unit_cost: costInp.value === '' ? '' : Number(costInp.value) });
    recomputePctRowsAndSummary(summaryNode);
  });
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
    if (cur.unit_type === '%') {
      subRow.style.display = 'flex';
      const grpTotal = getCapexGroupTotal(cur.pct_group_id);
      costInp.value = grpTotal ? (grpTotal / 100).toFixed(2) : '';
      costInp.readOnly = true;
      costInp.style.background = '#f1f5f9';
      costInp.title = 'Auto-computed: selected CAPEX Group total ÷ 100';
      grpTotEl.textContent = grpTotal ? `(group: ${fmtMoney(grpTotal)})` : '(no group total yet)';
    } else {
      subRow.style.display = 'none';
      costInp.readOnly = false;
      costInp.style.background = '';
      costInp.title = '';
      costInp.value = cur.unit_cost !== '' ? cur.unit_cost : '';
    }
  }
  syncTypeRelatedUI();

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
  const vals = node.querySelectorAll('.value');
  if (vals[0]) vals[0].textContent = String(totals.itemCount);
  if (vals[1]) vals[1].textContent = fmtMoney(totals.subtotal);
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
  // Auto-save name keystrokes so users don't lose work; the % dropdowns and
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
    style: 'white-space:nowrap;font-size:12px;font-weight:600;padding:6px 10px;background:#1e3a8a;color:#fff;border:none;border-radius:4px;cursor:pointer',
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
        ? 'No items yet — use + Add Item to pick from your Details rows.'
        : 'Type a name above, then use + Add Item to pick rows.'
    ));
  } else {
    grp.itemKeys.forEach((key, idx) => {
      const it = getSchemaItemByKey(key);
      const v = STATE.phase3[key] || {};
      const itemTotal = (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
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
  const cont = subtotal * (Number(STATE.phase4.contingency_pct) || 0);
  const fee = subtotal * (Number(STATE.phase4.mgmt_fee_pct) || 0);
  const grand = subtotal + cont + fee;
  const units = Number(STATE.phase1.mf_units) || 0;
  const perUnit = units > 0 ? grand / units : 0;
  return { subtotal, cont, fee, grand, perUnit, itemCount, byGroup };
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

  if (warnings.length) {
    const wrap = el('div', { class: 'section' },
      el('header', { class: 'section-header', style: 'color:#dc2626' }, 'Sanity Check'),
      el('div', { class: 'section-body' })
    );
    const body = wrap.querySelector('.section-body');
    warnings.forEach(w => body.appendChild(el('div', { class: 'field' }, w)));
    root.appendChild(wrap);
  }

  // Adjustments — these flow into the exported Excel as the contingency/mgmt-fee multipliers
  const adj = el('section', { class: 'section collapsed' },
    el('header', { class: 'section-header', onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
      el('span', {}, 'Adjustments (used in Excel export)'), el('span', { class: 'chev' }, '▼')),
    el('div', { class: 'section-body' },
      renderField({ key: 'contingency_pct', label: 'Contingency %', type: 'number', step: 0.01, min: 0, max: 1, hint: 'Decimal (0.10 = 10%)' },
        STATE.phase4.contingency_pct, (v) => { STATE.phase4.contingency_pct = Number(v) || 0; saveState(); }),
      renderField({ key: 'mgmt_fee_pct', label: 'Construction Mgmt Fee %', type: 'number', step: 0.01, min: 0, max: 1, hint: 'Decimal' },
        STATE.phase4.mgmt_fee_pct, (v) => { STATE.phase4.mgmt_fee_pct = Number(v) || 0; saveState(); }),
      renderField({ key: 'notes', label: 'Overall Notes', type: 'textarea' },
        STATE.phase4.notes, (v) => { STATE.phase4.notes = v; saveState(); }),
    )
  );
  root.appendChild(adj);

  // Hint card
  const hint = el('div', { class: 'summary-totals', style: 'background:#f0f9ff;border-color:#bfdbfe' },
    el('div', { style: 'font-size:14px;color:#0f172a;line-height:1.5' },
      el('strong', {}, 'Capex line items are entered in the exported Excel.'),
      el('div', { style: 'margin-top:6px;color:#475569' },
        'Tap Export below. You’ll get a workbook with three sheets: Property Basics, Physical, and a full Capex Budget template. ' +
        'In the Capex Budget sheet, fill in # Items and $/Item for the relevant rows. Section subtotals, group totals, contingency, mgmt fee, and grand total all recalculate live in Excel.'
      )
    )
  );
  root.appendChild(hint);

  // Big Export button
  root.appendChild(el('button', {
    style: 'width:100%;padding:18px;background:#1e3a8a;color:white;border:none;border-radius:8px;font-size:17px;font-weight:600;margin-top:8px;cursor:pointer',
    onClick: exportXlsx
  }, '⬇  Export to Excel'));

  return root;
}

// ---------- Excel export ----------
async function exportXlsx() {
  if (typeof ExcelJS === 'undefined') { toast('ExcelJS not loaded yet, try again', 'error'); return; }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Capex Builder';
  workbook.created = new Date();
  const propName = STATE.phase1.prop_name || '';
  const units = Number(STATE.phase1.mf_units) || 0;
  const contPct = Number(STATE.phase4.contingency_pct) || 0;
  const feePct = Number(STATE.phase4.mgmt_fee_pct) || 0;
  const NAVY = 'FF1E3A8A', LIGHT = 'FFF1F5F9', BORDER_LIGHT = 'FFD1D5DB';
  const styleCurrency = (cell) => { cell.numFmt = '"$"#,##0'; };
  const stylePct = (cell) => { cell.numFmt = '0%'; };

  // ===== Main "Capex Budget" sheet =====
  const ws = workbook.addWorksheet('Capex Budget', { views: [{ state: 'frozen', xSplit: 0, ySplit: 7 }] });
  ws.columns = [
    { width: 52 }, { width: 10 }, { width: 13 },
    { width: 11 }, { width: 11 }, { width: 11 },
    { width: 15 }, { width: 30 }, { width: 42 },
  ];

  const titleRow = ws.addRow(['CAPEX BUDGET']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleRow.height = 24;
  titleRow.alignment = { vertical: 'middle' };
  ws.mergeCells(`A${titleRow.number}:I${titleRow.number}`);

  const propRow = ws.addRow(['Property:', propName]); propRow.getCell(1).font = { bold: true };
  const unitsRow = ws.addRow(['# Units:', units]); unitsRow.getCell(1).font = { bold: true };
  const yrRow = ws.addRow(['Year Built:', STATE.phase1.year_built || '']); yrRow.getCell(1).font = { bold: true };
  ws.addRow([]);

  const colHeaderRow = ws.addRow(['', '# Items', '$/Item', '% Original', '% Partial', '% Reno', 'Total', 'Notes', 'GL Account']);
  colHeaderRow.font = { bold: true };
  colHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  colHeaderRow.eachCell((c) => {
    c.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
    c.alignment = { horizontal: 'center' };
  });
  ws.addRow([]);

  // Build full template: every group, subsection, line item.
  // # Items and $/Item are blank for user to fill in Excel; Total is a live formula =B*C.
  // Section subtotals and group subtotals use SUM ranges so totals update as user types.
  const groupSubtotalAddrs = []; // Cell addresses like "G42" for the final grand-sum formula.

  SCHEMA.phase3.forEach((group, gi) => {
    if (!group.sections.length) return;
    const isInterior = group.name === 'Interior';

    // Group header (total will be SUM of all items in the group)
    const gh = ws.addRow([group.name.toUpperCase(), '', '', '', '', '', '', '', '']);
    gh.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    gh.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    gh.height = 20;
    gh.alignment = { vertical: 'middle' };
    styleCurrency(gh.getCell(7));

    let firstItemRowInGroup = null;
    let lastItemRowInGroup = null;

    group.sections.forEach((sec) => {
      if (!sec.items.length) return;
      const sr = ws.addRow(['  ' + sec.name, '', '', '', '', '', '', '', '']);
      sr.font = { bold: true, italic: true };
      sr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };

      const sectionFirstRow = sr.number + 1; // first item row is next
      sec.items.forEach((it) => {
        const r = ws.addRow([
          '      ' + it.name, '', '', '', '', '',
          '', // total filled by formula below
          '', it.gl_account || '',
        ]);
        // Live total formula: =B{n}*C{n}
        r.getCell(7).value = { formula: `B${r.number}*C${r.number}`, result: 0 };
        styleCurrency(r.getCell(3));
        styleCurrency(r.getCell(7));
        stylePct(r.getCell(4)); stylePct(r.getCell(5)); stylePct(r.getCell(6));
        r.getCell(7).font = { bold: true };
        r.eachCell({ includeEmpty: false }, (c) => { c.border = { bottom: { style: 'hair', color: { argb: BORDER_LIGHT } } }; });

        if (firstItemRowInGroup === null) firstItemRowInGroup = r.number;
        lastItemRowInGroup = r.number;
      });
      const sectionLastRow = lastItemRowInGroup;
      // Update section header total cell to SUM its items
      sr.getCell(7).value = { formula: `SUM(G${sectionFirstRow}:G${sectionLastRow})`, result: 0 };
      styleCurrency(sr.getCell(7));
    });

    // Group subtotal row spans all items in the group
    const subr = ws.addRow([`${group.name} Subtotal`, '', '', '', '', '', '', '', '']);
    subr.font = { bold: true };
    subr.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: 'thin', color: { argb: NAVY } } }; });
    if (firstItemRowInGroup !== null) {
      subr.getCell(7).value = { formula: `SUM(G${firstItemRowInGroup}:G${lastItemRowInGroup})`, result: 0 };
      // Group header total = same range
      gh.getCell(7).value = { formula: `SUM(G${firstItemRowInGroup}:G${lastItemRowInGroup})`, result: 0 };
      groupSubtotalAddrs.push(`G${subr.number}`);
    }
    styleCurrency(subr.getCell(7));
    ws.addRow([]);
  });

  // Final totals (live formulas)
  ws.addRow([]);
  const stRow = ws.addRow(['SUBTOTAL', '', '', '', '', '', '', '', '']);
  stRow.font = { bold: true };
  styleCurrency(stRow.getCell(7));
  if (groupSubtotalAddrs.length) {
    stRow.getCell(7).value = { formula: groupSubtotalAddrs.join('+'), result: 0 };
  }

  const contRow = ws.addRow([`Contingency (${Math.round(contPct * 100)}%)`, '', '', '', '', '', '', '', '']);
  styleCurrency(contRow.getCell(7));
  contRow.getCell(7).value = { formula: `G${stRow.number}*${contPct}`, result: 0 };

  const feeRow = ws.addRow([`Construction Mgmt Fee (${Math.round(feePct * 100)}%)`, '', '', '', '', '', '', '', '']);
  styleCurrency(feeRow.getCell(7));
  feeRow.getCell(7).value = { formula: `G${stRow.number}*${feePct}`, result: 0 };

  const grandRow = ws.addRow(['TOTAL CAPEX', '', '', '', '', '', '', '', '']);
  grandRow.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  grandRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  grandRow.height = 22;
  styleCurrency(grandRow.getCell(7));
  grandRow.getCell(7).value = { formula: `G${stRow.number}+G${contRow.number}+G${feeRow.number}`, result: 0 };

  if (units > 0) {
    const puRow = ws.addRow(['$ / Unit', '', '', '', '', '', '', '', '']);
    puRow.font = { italic: true, bold: true };
    styleCurrency(puRow.getCell(7));
    puRow.getCell(7).value = { formula: `G${grandRow.number}/${units}`, result: 0 };
  }

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
        if (f.type === 'info') return;
        const v = state[f.key];
        const displayVal = Array.isArray(v) ? v.join(', ') : (v ?? '');
        w.addRow([f.label, displayVal]);
      });
      w.addRow([]);
    });
  });

  const filename = `Capex_${(propName || 'property').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (!STATE || !STATE.drive.folderId) {
    // No linked folder — fall back to local download so the user isn't stuck.
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('Downloaded (no Drive folder linked)', 'success');
    return;
  }

  try {
    toast('Uploading Excel to Drive…');
    const targetFolder = await resolveCapexFolder();
    const res = await driveUploadBinary(
      targetFolder,
      filename,
      blob,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    toast('Excel uploaded to 25. Capex/Capex Builder Budget', 'success');
    if (res.webViewLink) window.open(res.webViewLink, '_blank');
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
  $$('.tab').forEach(t => t.classList.toggle('active', Number(t.dataset.phase) === CURRENT_PHASE));
}

function renderShell() {
  // Top-level router between Home and Property views.
  const inProp = CURRENT_VIEW === 'property' && STATE;
  $('#home-content').classList.toggle('hidden', inProp);
  $('#phase-content').classList.toggle('hidden', !inProp);
  $('#phase-tabs').classList.toggle('hidden', !inProp);
  $('#btn-back').classList.toggle('hidden', !inProp);
  $('#btn-save').classList.toggle('hidden', !inProp);
  // Header Push/Pull buttons are now hidden by default — auto-sync handles
  // routine pushes every minute. Manual force-sync remains available via the
  // ☰ drawer (#btn-push-drawer / #btn-pull-drawer).
  $('#btn-pull').classList.add('hidden');
  $('#btn-push').classList.add('hidden');
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
    'Capture tour notes, sync to the deal’s Google Drive folder, and hand off to Excel ' +
    'when you’re ready to finalize the budget.'
  ));

  const steps = el('ol', { class: 'onboarding-steps' });
  steps.appendChild(el('li', {}, 'Connect your Google Drive account (one tap below).'));
  steps.appendChild(el('li', {}, 'Tap "+ New Property" and fill in name, city, state on the Basics tab.'));
  steps.appendChild(el('li', {}, 'Leave Basics for the Questionnaire tab — the app finds the matching deal folder across your pipelines and links it automatically.'));
  steps.appendChild(el('li', {}, 'Check items on the Questionnaire, price them on Details, then sync to Drive (see below).'));
  card.appendChild(steps);

  // Push / Pull explainer — the core save-and-retrieve workflow.
  const sync = el('div', { class: 'onb-sync' });
  sync.appendChild(el('div', { class: 'onb-sync-title' }, 'Saving & retrieving your work'));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '💾'),
    el('span', {},
      el('strong', {}, 'Save'),
      ' stores your work on this device only (your browser). It does NOT upload to Google Drive — it’s just a quick local save so you don’t lose progress between sessions on this device.'
    )
  ));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '⬆'),
    el('span', {},
      el('strong', {}, 'Push to Drive'),
      ' saves your data to the deal’s Google Drive folder (25. Capex / Capex Builder Budget) for long-term, team-shared storage. Do this whenever you finish a round of edits.'
    )
  ));
  sync.appendChild(el('div', { class: 'onb-sync-row' },
    el('span', { class: 'onb-sync-icon' }, '⬇'),
    el('span', {},
      el('strong', {}, 'Pull from Drive'),
      ' loads the latest saved copy back into the app so you — or a teammate on another device — can review and keep editing. Pull before you start, push when you’re done.'
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

function renderHome() {
  const main = $('#home-content');
  main.innerHTML = '';

  if (shouldShowOnboarding()) main.appendChild(renderOnboardingCard());

  main.appendChild(el('button', { class: 'home-new-btn', onClick: () => promptNewProperty() },
    '+ New Property'));

  // Org-wide index status bar (only if Drive is connected — otherwise no index).
  if (getDriveToken()) {
    const driveToken = !!getDriveToken();
    const statusBar = el('div', {
      style: 'padding:8px 12px;margin:6px 0 10px;background:#f1f5f9;border-radius:6px;font-size:12px;color:#475569;display:flex;align-items:center;justify-content:space-between;gap:8px'
    });
    const statusText = HOME_INDEX_LOADING
      ? '🔄 Loading org index…'
      : (MANIFEST_CACHE
          ? `📋 Org index loaded ${MANIFEST_CACHE.fetchedAt ? '(' + relativeTime(new Date(MANIFEST_CACHE.fetchedAt).toISOString()) + ')' : ''}`
          : '📋 Tap Refresh to load org index');
    statusBar.appendChild(el('span', {}, statusText));
    const meBits = el('span', { style: 'display:flex;align-items:center;gap:8px' });
    if (CURRENT_USER && CURRENT_USER.email) {
      meBits.appendChild(el('span', { style: 'color:#64748b' }, CURRENT_USER.email));
    }
    meBits.appendChild(el('button', {
      style: 'background:none;border:none;color:#1e3a8a;font-size:12px;cursor:pointer;font-weight:600;padding:0',
      onClick: () => refreshHomeIndex(),
    }, '🔄 Refresh'));
    statusBar.appendChild(meBits);
    main.appendChild(statusBar);
  }

  // Merge local properties + manifest entries by id.
  const merged = new Map();
  Object.values(STORE.properties).forEach(p => merged.set(p.id, { local: p, remote: null }));
  if (MANIFEST_CACHE && MANIFEST_CACHE.data && Array.isArray(MANIFEST_CACHE.data.properties)) {
    MANIFEST_CACHE.data.properties.forEach(entry => {
      const cur = merged.get(entry.id) || { local: null, remote: null };
      cur.remote = entry;
      merged.set(entry.id, cur);
    });
  }

  // Sort by latest activity (manifest lastModified preferred, fall back to local updated).
  const entries = Array.from(merged.values()).sort((a, b) => {
    const aTime = (a.remote && a.remote.lastModified) || (a.local && a.local.updated) || '';
    const bTime = (b.remote && b.remote.lastModified) || (b.local && b.local.updated) || '';
    return bTime.localeCompare(aTime);
  });

  if (!entries.length) {
    main.appendChild(el('div', { class: 'home-empty' },
      'No properties yet. Tap "+ New Property" to start.'));
    return;
  }

  const list = el('div', { class: 'home-list' });
  entries.forEach(({ local, remote }) => list.appendChild(renderPropertyCard(local, remote)));
  main.appendChild(list);
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

  let syncCls, syncIcon, syncTitle;
  if (!local) {
    syncCls = 'remote'; syncIcon = '☁'; syncTitle = 'In org index — tap to open from Drive';
  } else if (!p.drive.folderId) {
    syncCls = 'nolink'; syncIcon = '⊘'; syncTitle = 'No Drive folder linked';
  } else {
    const inSync = p.drive.lastPushed && p.drive.lastPushed >= p.updated;
    syncCls = inSync ? 'synced' : 'dirty';
    syncIcon = inSync ? '●' : '○';
    syncTitle = inSync
      ? 'Synced with Drive (last push: ' + relativeTime(p.drive.lastPushed) + ')'
      : 'Local changes — next auto-sync within 1 min';
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
      el('div', { class: 'pc-name' }, p.name || (remote && remote.name) || '(unnamed)'),
      el('div', { class: 'pc-sub' }, subtitle),
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

function promptNewProperty() {
  const name = prompt('Property name?');
  if (name === null) return;
  const p = createProperty(name);
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
  p.drive.folderId = id;
  p.drive.fileId = '';        // reset; will be discovered on next push/pull
  p.drive.capexFolderId = ''; // reset cached nested folder id
  saveState();
  if (after) after();
  toast('Drive folder linked', 'success');
}

function updateSyncBar() {
  const bar = $('#sync-bar');
  if (!STATE) { bar.classList.add('hidden'); return; }
  if (!STATE.drive.folderId) {
    bar.className = 'sync-bar warn';
    bar.textContent = 'No Drive folder linked — tap ☰ → Find or Link Drive Folder to enable cloud sync.';
    bar.classList.remove('hidden');
    return;
  }
  const lastPush = STATE.drive.lastPushed;
  const dirty = !lastPush || lastPush < STATE.updated;
  if (dirty) {
    bar.className = 'sync-bar warn';
    bar.textContent = 'Local changes — auto-sync within 1 min.' +
      (lastPush ? ' Last push: ' + relativeTime(lastPush) : '');
  } else {
    bar.className = 'sync-bar ok';
    bar.textContent = 'Auto-synced with Drive (last push ' + relativeTime(lastPush) + ').';
  }
  bar.classList.remove('hidden');
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
    // Auto-search across the 7 pipelines (once per property — manual button can re-run).
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
  $('#btn-save').addEventListener('click', () => { saveState(); toast('Saved on this device (use ⬆ Push to save to Drive)', 'success'); updateSyncBar(); });
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

  $('#btn-push').addEventListener('click', () => pushToDrive());
  $('#btn-pull').addEventListener('click', () => pullFromDrive());
  $('#btn-push-drawer').addEventListener('click', () => { pushToDrive(); closeDrawer(); });
  $('#btn-pull-drawer').addEventListener('click', () => { pullFromDrive(); closeDrawer(); });

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
  updateDriveStatus();
  updateOptionsStatus();
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
  if (!tok) tok = await driveRequestToken({ silent: false });
  return 'Bearer ' + tok;
}

async function driveFetch(url, opts = {}) {
  const auth = await driveAuthHeader();
  let r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: auth } });
  if (r.status === 401) {
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
    toast('Drive connected', 'success');
    // Fetch the signed-in user's identity so the manifest can record edits as
    // theirs, then load the org-wide index in the background.
    try { await fetchCurrentUser({ force: true }); } catch (e) { console.warn('fetchCurrentUser failed', e); }
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
const DEAL_PIPELINE_FOLDERS = [
  { name: 'Under Contract',                id: '1IrPlaRICRzdqN7SmG_ShDkSnCP0g7tHL' },
  { name: 'Negotiating',                   id: '104S0wT09iDs3EWnZoWQrf7IWaw6zqsbd' },
  { name: 'Inv Comm. Offer',               id: '1QcDvJE3JbtlzDTtkrJuFsA6qJrowlvJB' },
  { name: 'Initial Offer',                 id: '1pCHdxhVXPx_PZ163Wj1YxK27FN5BeAWL' },
  { name: 'Brokered Pipeline',             id: '1_t3k60rmSWJY3aXYAMIgn6SjFRE1tg-R' },
  { name: 'ExStay Conv (Brokered) Pipeline', id: '1_IiLYMEtGMptdzS50hFXRFz9nK5JB7f9' },
  { name: 'OFF Market Deals',              id: '1xCcCTPP2qLhUapPiQT1h2TQxnLL3nAdH' },
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

// Search all 7 pipelines in parallel. Returns ranked candidates with score + pipeline name.
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

    STATE.drive.folderId = chosen.id;
    STATE.drive.fileId = '';
    STATE.drive.capexFolderId = '';
    saveState();
    // Eagerly create the nested target folder.
    try { await resolveCapexFolder(); } catch (e) { console.warn('resolveCapexFolder after auto-link failed', e); }
    renderShell();
    toast(`Linked: ${chosen.name}`, 'success');
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
  const { silent = false } = opts;
  if (!STATE) return;
  if (!STATE.drive.folderId) { if (!silent) toast('Link a Drive folder first', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { if (!silent) toast('Set GOOGLE_CLIENT_ID in app.js first', 'error'); return; }
  try {
    if (!silent) toast('Pushing to Drive…');
    const targetFolder = await resolveCapexFolder();
    // Warn if remote is newer than what we last pulled.
    const existing = await driveFindFile(targetFolder, STATE_FILENAME);
    if (existing && STATE.drive.remoteModifiedTime
        && existing.modifiedTime > STATE.drive.remoteModifiedTime
        && (!STATE.drive.lastPushed || existing.modifiedTime > STATE.drive.lastPushed)) {
      if (silent) {
        // Auto-sync mustn't silently clobber a newer remote. Skip this tick;
        // the concurrent-editor banner (driven by the manifest) already warns
        // the user, and the next tick can retry after they reconcile.
        console.warn('pushToDrive: remote newer than local — skipping silent push');
        return;
      }
      if (!confirm('The Drive copy was modified more recently than your last sync. Overwrite it with your local data?')) {
        return;
      }
    }
    const res = await driveUploadJson(targetFolder, STATE_FILENAME, STATE, existing && existing.id);
    STATE.drive.fileId = res.id;
    STATE.drive.lastPushed = new Date().toISOString();
    STATE.drive.remoteModifiedTime = res.modifiedTime;
    saveState();
    updateSyncBar();
    updateFolderStatus();
    if (!silent) toast('Pushed to Drive', 'success');
  } catch (e) {
    if (silent) console.warn('Silent push failed:', e);
    else toast('Push failed: ' + e.message, 'error');
  }
}

async function pullFromDrive() {
  if (!STATE) return;
  if (!STATE.drive.folderId) { toast('Link a Drive folder first', 'error'); return; }
  if (!GOOGLE_CLIENT_ID) { toast('Set GOOGLE_CLIENT_ID in app.js first', 'error'); return; }
  try {
    toast('Pulling from Drive…');
    const targetFolder = await resolveCapexFolder();
    const remote = await driveDownloadJson(targetFolder, STATE_FILENAME);
    if (!remote) { toast('No ' + STATE_FILENAME + ' found in 25. Capex/Capex Builder Budget', 'error'); return; }
    const dirty = !STATE.drive.lastPushed || STATE.drive.lastPushed < STATE.updated;
    if (dirty && !confirm('You have unpushed local changes. Replace them with the Drive copy?')) return;
    // Preserve local identity + drive metadata; overwrite content fields.
    const keep = { id: STATE.id, drive: { ...STATE.drive } };
    Object.keys(STATE).forEach(k => delete STATE[k]);
    Object.assign(STATE, remote.data);
    STATE.id = keep.id;
    STATE.drive = { ...keep.drive, fileId: remote.id, lastPulled: new Date().toISOString(), remoteModifiedTime: remote.modifiedTime, lastPushed: new Date().toISOString() };
    // After pulling, local matches remote — mark pushed time so it's not flagged dirty.
    STATE.updated = remote.modifiedTime || STATE.updated;
    saveState();
    renderShell();
    toast('Pulled from Drive', 'success');
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
// must point at this same folder ID. Hardcoded so there's no per-machine setup.
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

async function fetchCurrentUser({ force = false } = {}) {
  if (CURRENT_USER && !force) return CURRENT_USER;
  const r = await driveFetch('https://www.googleapis.com/drive/v3/about?fields=user');
  const j = await r.json();
  if (!j.user || !j.user.emailAddress) throw new Error('Could not read Drive user identity');
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

// Open a property that's in the manifest but not yet on this device:
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
    saveState();
    CURRENT_PHASE = 1;
    CURRENT_VIEW = 'property';
    renderShell();
    startAutoSync();
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
  if (!STATE.drive.folderId) return; // can't sync property data without a deal folder
  try {
    // 1. Push local changes if dirty.
    const dirty = !STATE.drive.lastPushed || STATE.drive.lastPushed < STATE.updated;
    if (dirty) {
      await pushToDrive({ silent: true });
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
async function releaseEditorLock() {
  if (!STATE) return;
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
    if (CURRENT_VIEW === 'home') renderHome();
  } catch (e) {
    console.warn('refreshHomeIndex failed:', e);
    if (CURRENT_VIEW === 'home') renderHome();
  } finally {
    HOME_INDEX_LOADING = false;
  }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  bindShell();
  renderShell();
  // Try to silently refresh the Drive token on load so push/pull just works.
  if (GOOGLE_CLIENT_ID && !getDriveToken()) {
    driveRequestToken({ silent: true })
      .then(async () => {
        updateDriveStatus();
        try { await fetchCurrentUser(); } catch {}
        // Refresh the home index (if on home) or start sync (if on a property).
        if (CURRENT_VIEW === 'home') refreshHomeIndex();
        else if (CURRENT_VIEW === 'property') startAutoSync();
      })
      .catch(() => {});
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
