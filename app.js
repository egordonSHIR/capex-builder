// Capex Builder — single-property web app
// State lives in window.STATE, persisted to localStorage on every change.

const STORAGE_KEY = 'capex_builder_state_v1';
const DRIVE_TOKEN_KEY = 'capex_builder_drive_token';

const DEFAULT_STATE = () => ({
  meta: { created: new Date().toISOString(), updated: new Date().toISOString(), version: 1 },
  phase1: {},
  phase2: {},
  phase3: {}, // keyed by `${groupIdx}.${sectionIdx}.${itemIdx}` -> {qty, unit_cost, notes}
  phase4: { contingency_pct: 0.10, mgmt_fee_pct: 0.10, notes: '' },
});

let STATE = loadState();
let CURRENT_PHASE = 1;

// ---------- Storage ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return Object.assign(DEFAULT_STATE(), JSON.parse(raw));
  } catch (e) { console.warn('loadState failed', e); }
  return DEFAULT_STATE();
}
function saveState() {
  STATE.meta.updated = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
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
    return Function(...Object.keys(bag), `return (${expr});`)(...Object.values(bag).map(v => Number(v) || 0));
  } catch { return ''; }
}

// ---------- Render: generic form ----------
function renderField(field, value, onChange) {
  const wrap = el('div', { class: 'field' + (field.computed ? ' computed' : '') });
  wrap.appendChild(el('label', {}, field.label + (field.required ? ' *' : '')));
  if (field.hint) wrap.appendChild(el('div', { class: 'hint' }, field.hint));

  let input;
  if (field.type === 'select') {
    input = el('select');
    input.appendChild(el('option', { value: '' }, '—'));
    field.options.forEach(opt => {
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
    if (field.computed) input.readOnly = true;
    input.value = value !== undefined && value !== null ? value : '';
  }

  input.addEventListener('input', () => onChange(input.value));
  input.addEventListener('change', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

function renderSchemaForm(sections, bag, onUpdate) {
  const frag = document.createDocumentFragment();
  sections.forEach((sec, si) => {
    const collapsed = window['_collapsed_' + sec.section] === true;
    const body = el('div', { class: 'section-body' });
    sec.fields.forEach(f => {
      const value = f.computed ? computeField(f.computed, bag) : bag[f.key];
      if (f.computed) bag[f.key] = value;
      const fieldNode = renderField(f, value, (v) => {
        bag[f.key] = (f.type === 'number') ? (v === '' ? '' : Number(v)) : v;
        // Recompute computed fields in same section
        sec.fields.forEach(ff => {
          if (ff.computed) {
            const cv = computeField(ff.computed, bag);
            bag[ff.key] = cv;
            const inp = body.querySelector(`[data-key="${ff.key}"]`);
            if (inp) inp.value = isFinite(cv) ? cv : '';
          }
        });
        saveState();
        onUpdate && onUpdate();
      });
      // tag this field's input with its key so computed re-fill can find it
      const inp = fieldNode.querySelector('input, select, textarea');
      if (inp) inp.setAttribute('data-key', f.key);
      body.appendChild(fieldNode);
    });

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

// ---------- Phase 1 & 2 ----------
function renderPhase1() {
  const root = el('div');
  root.appendChild(renderSchemaForm(SCHEMA.phase1, STATE.phase1));
  return root;
}
function renderPhase2() {
  const root = el('div');
  root.appendChild(renderSchemaForm(SCHEMA.phase2, STATE.phase2));
  return root;
}

// ---------- Phase 3: Capex line items ----------
function p3Key(gi, si, ii) { return `${gi}.${si}.${ii}`; }
function getP3(gi, si, ii) {
  return STATE.phase3[p3Key(gi, si, ii)] || { qty: '', unit_cost: '', notes: '' };
}
function setP3(gi, si, ii, patch) {
  const k = p3Key(gi, si, ii);
  STATE.phase3[k] = Object.assign(getP3(gi, si, ii), patch);
  saveState();
}

function renderPhase3() {
  const root = el('div');
  const totals = computeTotals();
  const summary = el('div', { class: 'summary-totals' },
    el('div', { class: 'summary-row' },
      el('span', { class: 'label' }, 'Line items entered'),
      el('span', { class: 'value' }, String(totals.itemCount))),
    el('div', { class: 'summary-row grand' },
      el('span', { class: 'label' }, 'Running Subtotal'),
      el('span', { class: 'value' }, fmtMoney(totals.subtotal)))
  );
  root.appendChild(summary);

  SCHEMA.phase3.forEach((group, gi) => {
    const groupBody = el('div');
    group.sections.forEach((sec, si) => {
      const secBody = el('div', { class: 'section-body' });
      sec.items.forEach((item, ii) => {
        const v = getP3(gi, si, ii);
        const hasValue = (Number(v.qty) || 0) > 0 && (Number(v.unit_cost) || 0) > 0;
        const itemWrap = el('div', { class: 'capex-item' + (hasValue ? ' has-value' : '') });

        const header = el('div', { class: 'capex-item-header' },
          el('div', {},
            el('div', { class: 'capex-item-name' }, item.name),
            item.notes ? el('div', { class: 'capex-item-notes' }, item.notes) : null,
            item.gl_account ? el('div', { class: 'capex-item-gl' }, item.gl_account) : null,
          ),
        );
        itemWrap.appendChild(header);

        const total = (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
        const row = el('div', { class: 'capex-row' });

        const qtyField = el('div', { class: 'field' },
          el('label', {}, '# Items'),
          (() => {
            const i = el('input', { type: 'number', min: 0, step: 'any' });
            i.value = v.qty;
            i.addEventListener('input', () => {
              setP3(gi, si, ii, { qty: i.value === '' ? '' : Number(i.value) });
              renderTotals(itemWrap, gi, si, ii);
              updatePhase3Summary(summary);
            });
            return i;
          })()
        );
        const costField = el('div', { class: 'field' },
          el('label', {}, '$/Item'),
          (() => {
            const i = el('input', { type: 'number', min: 0, step: 'any', placeholder: item.default_cost_per_item ?? '' });
            i.value = v.unit_cost !== '' ? v.unit_cost : '';
            i.addEventListener('input', () => {
              setP3(gi, si, ii, { unit_cost: i.value === '' ? '' : Number(i.value) });
              renderTotals(itemWrap, gi, si, ii);
              updatePhase3Summary(summary);
            });
            return i;
          })()
        );
        const totalEl = el('div', { class: 'total', 'data-total': true }, fmtMoney(total));
        const notesField = el('div', { class: 'field' },
          el('label', {}, 'Notes'),
          (() => {
            const i = el('input', { type: 'text' });
            i.value = v.notes || '';
            i.addEventListener('input', () => setP3(gi, si, ii, { notes: i.value }));
            return i;
          })()
        );
        row.appendChild(qtyField);
        row.appendChild(costField);
        row.appendChild(totalEl);
        row.appendChild(notesField);
        itemWrap.appendChild(row);

        secBody.appendChild(itemWrap);
      });
      const secNode = el('section', { class: 'section collapsed' },
        el('header', { class: 'section-header',
          onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
          el('span', {}, sec.name),
          el('span', { class: 'chev' }, '▼')
        ),
        secBody
      );
      groupBody.appendChild(secNode);
    });

    const groupNode = el('section', { class: 'section' },
      el('header', { class: 'section-header',
        onClick: (e) => e.currentTarget.parentElement.classList.toggle('collapsed') },
        el('span', { style: 'font-size:15px' }, group.name.toUpperCase()),
        el('span', { class: 'chev' }, '▼')
      ),
      groupBody
    );
    root.appendChild(groupNode);
  });
  return root;
}
function renderTotals(itemWrap, gi, si, ii) {
  const v = getP3(gi, si, ii);
  const total = (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
  const t = itemWrap.querySelector('[data-total]');
  if (t) t.textContent = fmtMoney(total);
  itemWrap.classList.toggle('has-value', total > 0);
}
function updatePhase3Summary(node) {
  const totals = computeTotals();
  node.querySelectorAll('.value')[0].textContent = String(totals.itemCount);
  node.querySelectorAll('.value')[1].textContent = fmtMoney(totals.subtotal);
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
        const v = getP3(gi, si, ii);
        const t = (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
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
  const t = computeTotals();

  const warnings = [];
  if (!STATE.phase1.prop_name) warnings.push('Property name is missing (Phase 1).');
  if (!STATE.phase1.mf_units) warnings.push('# of MF Units is missing (Phase 1) — per-unit metrics will be $0.');
  if (t.itemCount === 0) warnings.push('No capex line items have quantities and costs entered (Phase 3).');
  if (Object.values(STATE.phase2).filter(Boolean).length === 0) warnings.push('Physical characteristics (Phase 2) appear empty.');

  if (warnings.length) {
    const wrap = el('div', { class: 'section' },
      el('header', { class: 'section-header', style: 'color:#dc2626' }, 'Sanity Check'),
      el('div', { class: 'section-body' })
    );
    const body = wrap.querySelector('.section-body');
    warnings.forEach(w => body.appendChild(el('div', { class: 'field' }, w)));
    root.appendChild(wrap);
  }

  const adj = el('section', { class: 'section' },
    el('header', { class: 'section-header' }, el('span', {}, 'Adjustments'), el('span', { class: 'chev' }, '▼')),
    el('div', { class: 'section-body' },
      renderField({ key: 'contingency_pct', label: 'Contingency %', type: 'number', step: 0.01, min: 0, max: 1, hint: 'Decimal (0.10 = 10%)' },
        STATE.phase4.contingency_pct, (v) => { STATE.phase4.contingency_pct = Number(v) || 0; saveState(); renderApp(); }),
      renderField({ key: 'mgmt_fee_pct', label: 'Construction Mgmt Fee %', type: 'number', step: 0.01, min: 0, max: 1, hint: 'Decimal' },
        STATE.phase4.mgmt_fee_pct, (v) => { STATE.phase4.mgmt_fee_pct = Number(v) || 0; saveState(); renderApp(); }),
      renderField({ key: 'notes', label: 'Overall Notes', type: 'textarea' },
        STATE.phase4.notes, (v) => { STATE.phase4.notes = v; saveState(); }),
    )
  );
  root.appendChild(adj);

  const totalsCard = el('div', { class: 'summary-totals' });
  totalsCard.appendChild(el('div', { class: 'summary-row' },
    el('span', { class: 'label' }, 'Subtotal'),
    el('span', { class: 'value' }, fmtMoney(t.subtotal))));
  totalsCard.appendChild(el('div', { class: 'summary-row' },
    el('span', { class: 'label' }, `Contingency (${Math.round((STATE.phase4.contingency_pct||0)*100)}%)`),
    el('span', { class: 'value' }, fmtMoney(t.cont))));
  totalsCard.appendChild(el('div', { class: 'summary-row' },
    el('span', { class: 'label' }, `Construction Mgmt Fee (${Math.round((STATE.phase4.mgmt_fee_pct||0)*100)}%)`),
    el('span', { class: 'value' }, fmtMoney(t.fee))));
  totalsCard.appendChild(el('div', { class: 'summary-row grand' },
    el('span', { class: 'label' }, 'TOTAL CAPEX'),
    el('span', { class: 'value' }, fmtMoney(t.grand))));
  totalsCard.appendChild(el('div', { class: 'summary-row' },
    el('span', { class: 'label' }, '$ / Unit'),
    el('span', { class: 'value' }, fmtMoney(t.perUnit))));
  root.appendChild(totalsCard);

  const byGroupCard = el('section', { class: 'section' },
    el('header', { class: 'section-header' }, el('span', {}, 'Breakdown by Group'), el('span', { class: 'chev' }, '▼')),
    el('div', { class: 'section-body' })
  );
  const gbody = byGroupCard.querySelector('.section-body');
  Object.entries(t.byGroup).forEach(([name, val]) => {
    gbody.appendChild(el('div', { class: 'summary-row', style: 'padding:8px 16px' },
      el('span', { class: 'label' }, name),
      el('span', { class: 'value' }, fmtMoney(val))));
  });
  root.appendChild(byGroupCard);

  root.appendChild(el('button', {
    style: 'width:100%;padding:14px;background:#1e3a8a;color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;margin-top:16px;cursor:pointer',
    onClick: exportXlsx
  }, 'Export to Excel'));

  return root;
}

// ---------- Excel export ----------
function exportXlsx() {
  const wb = XLSX.utils.book_new();

  const p1Rows = [['PROPERTY BASICS', '']];
  SCHEMA.phase1.forEach(sec => {
    p1Rows.push([sec.section, '']);
    sec.fields.forEach(f => p1Rows.push([f.label, STATE.phase1[f.key] ?? '']));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p1Rows), 'Property Basics');

  const p2Rows = [['PHYSICAL CHARACTERISTICS', '']];
  SCHEMA.phase2.forEach(sec => {
    p2Rows.push([sec.section, '']);
    sec.fields.forEach(f => p2Rows.push([f.label, STATE.phase2[f.key] ?? '']));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p2Rows), 'Physical');

  const p3Rows = [['Group', 'Section', 'Category', 'Item', '# Items', '$/Item', 'Total', 'Notes', 'GL Account']];
  SCHEMA.phase3.forEach((g, gi) => {
    g.sections.forEach((s, si) => {
      s.items.forEach((it, ii) => {
        const v = getP3(gi, si, ii);
        const total = (Number(v.qty) || 0) * (Number(v.unit_cost) || 0);
        if (total > 0) {
          p3Rows.push([g.name, s.name, it.category, it.name, Number(v.qty) || 0, Number(v.unit_cost) || 0, total, v.notes || '', it.gl_account || '']);
        }
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p3Rows), 'Capex Line Items');

  const t = computeTotals();
  const sumRows = [
    ['Property', STATE.phase1.prop_name || ''],
    ['Units', STATE.phase1.mf_units || 0],
    [],
    ['Subtotal', t.subtotal],
    [`Contingency (${Math.round((STATE.phase4.contingency_pct||0)*100)}%)`, t.cont],
    [`Construction Mgmt Fee (${Math.round((STATE.phase4.mgmt_fee_pct||0)*100)}%)`, t.fee],
    ['TOTAL CAPEX', t.grand],
    ['$ / Unit', t.perUnit],
    [],
    ['Notes', STATE.phase4.notes || ''],
    [],
    ['By Group', ''],
    ...Object.entries(t.byGroup).map(([n, v]) => [n, v]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumRows), 'Summary');

  const filename = `Capex_${(STATE.phase1.prop_name || 'property').replace(/[^a-z0-9]+/gi, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  toast('Excel exported', 'success');
}

// ---------- App shell ----------
function renderApp() {
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

function bindShell() {
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    CURRENT_PHASE = Number(t.dataset.phase);
    renderApp();
    window.scrollTo(0, 0);
  }));
  $('#btn-save').addEventListener('click', () => { saveState(); toast('Saved', 'success'); });
  $('#btn-menu').addEventListener('click', () => $('#menu-drawer').classList.remove('hidden'));
  $('.drawer-close').addEventListener('click', () => $('#menu-drawer').classList.add('hidden'));
  $('#btn-new').addEventListener('click', () => {
    if (confirm('Start a new property? Current data will be cleared (export first if needed).')) {
      STATE = DEFAULT_STATE();
      saveState();
      CURRENT_PHASE = 1;
      renderApp();
      $('#menu-drawer').classList.add('hidden');
      toast('New property started');
    }
  });
  $('#btn-export-json').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `capex_${(STATE.phase1.prop_name || 'property').replace(/[^a-z0-9]+/gi, '_')}.json`;
    a.click();
  });
  $('#btn-import-json').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        STATE = Object.assign(DEFAULT_STATE(), JSON.parse(reader.result));
        saveState();
        renderApp();
        toast('Imported', 'success');
      } catch (err) { toast('Import failed: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  });
  $('#btn-export-xlsx').addEventListener('click', exportXlsx);
  $('#btn-drive-connect').addEventListener('click', driveConnect);
  updateDriveStatus();
}

// ---------- Google Drive (stub) ----------
const GOOGLE_CLIENT_ID = ''; // <-- paste OAuth Web Client ID here
function updateDriveStatus() {
  const status = $('#drive-status');
  if (!GOOGLE_CLIENT_ID) { status.textContent = 'Add OAuth client ID to enable'; return; }
  const token = localStorage.getItem(DRIVE_TOKEN_KEY);
  status.textContent = token ? 'Connected' : 'Not connected';
}
function driveConnect() {
  if (!GOOGLE_CLIENT_ID) {
    toast('Set GOOGLE_CLIENT_ID in app.js first', 'error');
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.access_token) {
          localStorage.setItem(DRIVE_TOKEN_KEY, resp.access_token);
          updateDriveStatus();
          toast('Drive connected', 'success');
        }
      },
    });
    client.requestAccessToken();
  };
  document.head.appendChild(script);
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  bindShell();
  renderApp();
});
