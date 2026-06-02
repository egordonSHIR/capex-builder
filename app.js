// Capex Builder — single-property web app
// State lives in window.STATE, persisted to localStorage on every change.

const STORAGE_KEY = 'capex_builder_state_v1';
const DRIVE_TOKEN_KEY = 'capex_builder_drive_token';
const OPTIONS_KEY = 'capex_options_overrides_v1';

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

const DEFAULT_STATE = () => ({
  meta: { created: new Date().toISOString(), updated: new Date().toISOString(), version: 1 },
  phase1: {}, phase2: {}, phase3: {},
  phase4: { contingency_pct: 0.10, mgmt_fee_pct: 0.10, notes: '' },
});

let STATE = loadState();
let CURRENT_PHASE = 1;

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
function fmtMoney(n) { if (!isFinite(n)) return '$0'; return '$' + Math.round(n).toLocaleString(); }
function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  setTimeout(() => t.classList.add('hidden'), 2200);
}
function computeField(expr, bag) {
  try {
    const args = Object.values(bag).map(v => {
      if (v === '' || v === null || v === undefined) return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isFinite(n) && /^-?\d/.test(String(v)) ? n : v;
    });
    return Function(...Object.keys(bag), `return (${expr});`)(...args);
  } catch { return ''; }
}
function getEvalBag(bag) {
  const out = { ...bag };
  if (typeof STATE !== 'undefined' && STATE && STATE.phase1) {
    for (const k in STATE.phase1) out['p1_' + k] = STATE.phase1[k];
  }
  return out;
}

function formatNumber(v, decimals) {
  if (v === '' || v === null || v === undefined || !isFinite(v)) return '';
  if (decimals === 0) return String(Math.round(Number(v)));
  if (decimals > 0) return Number(v).toFixed(decimals);
  return String(v);
}

function renderField(field, value, onChange) {
  if (field.type === 'info') {
    const div = el('div', { class: 'field info-text' });
    div.setAttribute('data-key', field.key);
    div.textContent = '';
    return div;
  }
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
      const inGroup = wrap && wrap.closest && wrap.closest('.expansion-group');
      if (wrap && !inGroup) {
        const show = !!computeField(ff.show_if, eb);
        wrap.style.display = show ? '' : 'none';
      }
    }
  });
  body.querySelectorAll('.expansion-group[data-show-if]').forEach(grp => {
    const show = !!computeField(grp.getAttribute('data-show-if'), eb);
    grp.style.display = show ? '' : 'none';
  });
}

function renderSchemaForm(sections, bag, onUpdate) {
  const frag = document.createDocumentFragment();
  sections.forEach((sec, si) => {
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
      if (f.show_if) {
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

function renderPhase1() { const root = el('div'); root.appendChild(renderSchemaForm(SCHEMA.phase1, STATE.phase1)); return root; }
function renderPhase2() { const root = el('div'); root.appendChild(renderSchemaForm(SCHEMA.phase2, STATE.phase2)); return root; }

function renderPhase4() {
  const root = el('div');
  const warnings = [];
  if (!STATE.phase1.prop_name) warnings.push('Property name is missing (Phase 1).');
  if (!STATE.phase1.mf_units) warnings.push('# of MF Units is missing (Phase 1) — per-unit metric will be $0.');
  const p2Filled = Object.values(STATE.phase2).filter(v => Array.isArray(v) ? v.length : Boolean(v)).length;
  if (p2Filled === 0) warnings.push('Physical characteristics (Phase 2) appear empty.');
  if (warnings.length) {
    const wrap = el('div', { class: 'section' },
      el('header', { class: 'section-header', style: 'color:#dc2626' }, 'Sanity Check'),
      el('div', { class: 'section-body' })
    );
    const body = wrap.querySelector('.section-body');
    warnings.forEach(w => body.appendChild(el('div', { class: 'field' }, w)));
    root.appendChild(wrap);
  }
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

  // Build full template with live Excel formulas (=B*C for each item, SUM ranges for subtotals).
  const groupSubtotalAddrs = [];

  SCHEMA.phase3.forEach((group, gi) => {
    if (!group.sections.length) return;
    const isInterior = group.name === 'Interior';

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
      const sectionFirstRow = sr.number + 1;
      sec.items.forEach((it) => {
        const r = ws.addRow([
          '      ' + it.name, '', '', '', '', '',
          '',
          '', it.gl_account || '',
        ]);
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
      sr.getCell(7).value = { formula: `SUM(G${sectionFirstRow}:G${sectionLastRow})`, result: 0 };
      styleCurrency(sr.getCell(7));
    });

    const subr = ws.addRow([`${group.name} Subtotal`, '', '', '', '', '', '', '', '']);
    subr.font = { bold: true };
    subr.eachCell({ includeEmpty: true }, (c) => { c.border = { top: { style: 'thin', color: { argb: NAVY } } }; });
    if (firstItemRowInGroup !== null) {
      subr.getCell(7).value = { formula: `SUM(G${firstItemRowInGroup}:G${lastItemRowInGroup})`, result: 0 };
      gh.getCell(7).value = { formula: `SUM(G${firstItemRowInGroup}:G${lastItemRowInGroup})`, result: 0 };
      groupSubtotalAddrs.push(`G${subr.number}`);
    }
    styleCurrency(subr.getCell(7));
    ws.addRow([]);
  });

  ws.addRow([]);
  const stRow = ws.addRow(['SUBTOTAL', '', '', '', '', '', '', '', '']);
  stRow.font = { bold: true }; styleCurrency(stRow.getCell(7));
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
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast('Excel exported', 'success');
}

function renderApp() {
  const main = $('#phase-content');
  main.innerHTML = '';
  let view;
  if (CURRENT_PHASE === 1) view = renderPhase1();
  else if (CURRENT_PHASE === 2) view = renderPhase2();
  else view = renderPhase4();
  main.appendChild(view);
  $$('.tab').forEach(t => t.classList.toggle('active', Number(t.dataset.phase) === CURRENT_PHASE));
}

function bindShell() {
  $$('.tab').forEach(t => t.addEventListener('click', () => { CURRENT_PHASE = Number(t.dataset.phase); renderApp(); window.scrollTo(0, 0); }));
  $('#btn-save').addEventListener('click', () => { saveState(); toast('Saved', 'success'); });
  $('#btn-menu').addEventListener('click', () => $('#menu-drawer').classList.remove('hidden'));
  $('.drawer-close').addEventListener('click', () => $('#menu-drawer').classList.add('hidden'));
  $('#btn-new').addEventListener('click', () => {
    if (confirm('Start a new property? Current data will be cleared (export first if needed).')) {
      STATE = DEFAULT_STATE(); saveState(); CURRENT_PHASE = 1; renderApp();
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
      try { STATE = Object.assign(DEFAULT_STATE(), JSON.parse(reader.result)); saveState(); renderApp(); toast('Imported', 'success'); }
      catch (err) { toast('Import failed: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
  });
  $('#btn-export-xlsx').addEventListener('click', exportXlsx);
  $('#btn-drive-connect').addEventListener('click', driveConnect);
  $('#btn-import-options').addEventListener('click', () => $('#file-import-options').click());
  $('#file-import-options').addEventListener('change', (e) => { const file = e.target.files[0]; if (file) importOptionsXlsx(file); e.target.value = ''; });
  $('#btn-reset-options').addEventListener('click', () => {
    if (confirm('Reset all dropdown options to defaults from the source spreadsheet?')) {
      resetOptionOverrides(); updateOptionsStatus(); renderApp(); toast('Options reset', 'success');
    }
  });
  updateDriveStatus(); updateOptionsStatus();
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
      const overrides = {};
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const fieldKey = row[2];
        if (!fieldKey) continue;
        const opts = row.slice(4).map(v => v == null ? '' : String(v).trim()).filter(Boolean);
        if (opts.length) overrides[String(fieldKey).trim()] = opts;
      }
      if (!Object.keys(overrides).length) { toast('No options found in Excel (check column layout)', 'error'); return; }
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(overrides));
      updateOptionsStatus(); renderApp();
      toast(`Imported options for ${Object.keys(overrides).length} fields`, 'success');
    } catch (err) { toast('Import failed: ' + err.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

const GOOGLE_CLIENT_ID = '';
function updateDriveStatus() {
  const status = $('#drive-status');
  if (!GOOGLE_CLIENT_ID) { status.textContent = 'Add OAuth client ID to enable'; return; }
  const token = localStorage.getItem(DRIVE_TOKEN_KEY);
  status.textContent = token ? 'Connected' : 'Not connected';
}
function driveConnect() {
  if (!GOOGLE_CLIENT_ID) { toast('Set GOOGLE_CLIENT_ID in app.js first', 'error'); return; }
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => { if (resp.access_token) { localStorage.setItem(DRIVE_TOKEN_KEY, resp.access_token); updateDriveStatus(); toast('Drive connected', 'success'); } },
    });
    client.requestAccessToken();
  };
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => { bindShell(); renderApp(); });
