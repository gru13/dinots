import { CONFIG, addTimelineLog } from '../../modules/state';

type OptionsMode = 'start' | 'end' | 'instant';
type ActiveOptionsContext = { act: any; mode: OptionsMode; optionsKey: string };

let activeOptionsContext: ActiveOptionsContext | null = null;
let selectedOptions = new Set<string>();
let optionsPath: string[] = [];

function hasLeadingEmoji(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return false;
  const token = value.split(/\s+/)[0] || '';
  return /[\p{Extended_Pictographic}]/u.test(token);
}

function renderOptionChipLabel(raw: string) {
  const value = String(raw || '').trim();
  if (!value) return '🙂';
  if (hasLeadingEmoji(value)) return value;
  return `🙂 ${value}`;
}

export function setupOptionsModal() {
  document.getElementById('opt-skip-btn')?.addEventListener('click', skipOptionsLog);
  document.getElementById('opt-save-btn')?.addEventListener('click', saveOptionsLog);
  document.getElementById('opt-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('options-modal')!.style.display = 'none';
  });
}

export function showOptionsModal(act: any, mode: OptionsMode) {
  activeOptionsContext = { act, mode, optionsKey: act.optionsKey };
  selectedOptions.clear();
  optionsPath = [];

  const titleEl = document.getElementById('lbl-options-modal');
  if (titleEl) {
    if (mode === 'start') titleEl.textContent = CONFIG.ui.sections.optionsModalStartTitle;
    else if (mode === 'instant') titleEl.textContent = CONFIG.ui.sections.optionsModalInstantTitle;
    else titleEl.textContent = CONFIG.ui.sections.optionsModalEndTitle;
  }

  const mBtns = document.getElementById('options-multi-btns');
  const sBtns = document.getElementById('options-single-btns');
  if (mBtns) mBtns.style.display = mode === 'instant' ? 'none' : 'flex';
  if (sBtns) sBtns.style.display = mode === 'instant' ? 'flex' : 'none';

  renderOptionsChips();
  document.getElementById('options-modal')!.style.display = 'flex';
}

export function rerenderOptionsIfOpen() {
  if (document.getElementById('options-modal')?.style.display === 'flex') {
    renderOptionsChips();
  }
}

function renderOptionsChips() {
  const wrap = document.getElementById('options-chips-wrap');
  if (!wrap || !activeOptionsContext) return;

  const currentKey = optionsPath.length > 0 ? optionsPath[optionsPath.length - 1] : activeOptionsContext.optionsKey;
  const currentList = ((CONFIG.activityOptions as any)[currentKey] || []).filter((o: string) => {
    const normalized = String(o || '').trim().toLowerCase();
    return normalized !== '+ custom' && normalized !== 'custom';
  });

  let html = '';
  if (optionsPath.length > 0) {
    html += '<button class="quick-chip" style="background:var(--bg3); color:var(--text3); border-color:var(--border);" data-options-action="back">🔙 Back</button>';
  }

  const prefix = optionsPath.length > 0 ? optionsPath.join(' • ') + ' • ' : '';

  currentList.forEach((o: string) => {
    const safeVal = o.replace(/'/g, "\\'");
    const fullPathVal = prefix + o;

    if ((CONFIG.activityOptions as any)[o] && Array.isArray((CONFIG.activityOptions as any)[o])) {
      html += `<button class="quick-chip" style="border-color:var(--teal); color:var(--teal);" data-options-folder="${safeVal}">${renderOptionChipLabel(o)} ▾</button>`;
      return;
    }

    if (activeOptionsContext!.mode === 'instant') {
      html += `<button class="quick-chip" data-options-instant="${fullPathVal}">${renderOptionChipLabel(o)}</button>`;
      return;
    }

    const isActive = selectedOptions.has(fullPathVal) ? 'active' : '';
    html += `<button class="quick-chip ${isActive}" data-options-toggle="${fullPathVal}">${renderOptionChipLabel(o)}</button>`;
  });

  wrap.innerHTML = html;

  wrap.querySelectorAll('[data-options-action="back"]').forEach((el) => el.addEventListener('click', () => {
    optionsPath.pop();
    renderOptionsChips();
  }));

  wrap.querySelectorAll('[data-options-folder]').forEach((el) => el.addEventListener('click', () => {
    optionsPath.push(el.getAttribute('data-options-folder') || '');
    renderOptionsChips();
  }));

  wrap.querySelectorAll('[data-options-instant]').forEach((el) => el.addEventListener('click', () => {
    logInstantOption(el.getAttribute('data-options-instant') || '');
  }));

  wrap.querySelectorAll('[data-options-toggle]').forEach((el) => el.addEventListener('click', () => {
    const val = el.getAttribute('data-options-toggle') || '';
    if (!val) return;
    if (selectedOptions.has(val)) selectedOptions.delete(val);
    else selectedOptions.add(val);
    renderOptionsChips();
  }));
}

function logInstantOption(val: string) {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  addTimelineLog(act.id, act.emoji, `${act.label} (${val})`, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
  activeOptionsContext = null;
}

function skipOptionsLog() {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  addTimelineLog(act.id, act.emoji, act.label, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
}

function saveOptionsLog() {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  const suffix = selectedOptions.size > 0 ? ` (${Array.from(selectedOptions).join(' • ')})` : '';
  addTimelineLog(act.id, act.emoji, act.label + suffix, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
  activeOptionsContext = null;
}
