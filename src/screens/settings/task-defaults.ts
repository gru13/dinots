import { CONFIG, addTaskDefault, removeTaskDefault } from '../../modules/state';
import { escapeHtml, escapeHtmlAttr, unescapeHtmlAttr } from './utils';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const selectedDefaultWeekdays = new Set<string>();

export function bindTaskDefaults() {
  const detailsEl = document.getElementById('task-default-details') as HTMLDetailsElement | null;
  const addPanelEl = document.getElementById('task-default-add-panel') as HTMLElement | null;
  const toggleAddBtn = document.getElementById('task-default-toggle-add');
  const cancelAddBtn = document.getElementById('task-default-add-cancel');
  const input = document.getElementById('task-default-input') as HTMLInputElement | null;
  const addBtn = document.getElementById('task-default-add');
  const dayChips = document.querySelectorAll('#task-default-days [data-weekday]');

  if (selectedDefaultWeekdays.size === 0) {
    selectedDefaultWeekdays.add(String(new Date().getDay()));
  }

  const syncDayChipState = () => {
    dayChips.forEach((chip) => {
      const weekday = (chip as HTMLElement).getAttribute('data-weekday');
      if (!weekday) return;
      if (selectedDefaultWeekdays.has(weekday)) chip.classList.add('active');
      else chip.classList.remove('active');
    });
  };

  dayChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const weekday = (chip as HTMLElement).getAttribute('data-weekday');
      if (!weekday) return;
      if (selectedDefaultWeekdays.has(weekday)) selectedDefaultWeekdays.delete(weekday);
      else selectedDefaultWeekdays.add(weekday);
      syncDayChipState();
    });
  });

  syncDayChipState();

  const toggleAddPanel = () => {
    if (!addPanelEl) return;
    const shouldOpen = addPanelEl.style.display === 'none' || !addPanelEl.style.display;
    addPanelEl.style.display = shouldOpen ? 'flex' : 'none';
    if (shouldOpen && detailsEl && !detailsEl.open) detailsEl.open = true;
    if (shouldOpen) input?.focus();
  };

  toggleAddBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAddPanel();
  });

  cancelAddBtn?.addEventListener('click', () => {
    if (addPanelEl) addPanelEl.style.display = 'none';
  });

  const submit = () => {
    const text = (input?.value || '').trim();
    if (!text) return;

    if (selectedDefaultWeekdays.size === 0) {
      selectedDefaultWeekdays.add(String(new Date().getDay()));
      syncDayChipState();
    }

    selectedDefaultWeekdays.forEach((weekday) => {
      addTaskDefault(weekday, text);
    });

    if (input) input.value = '';
    if (addPanelEl) addPanelEl.style.display = 'none';
  };

  addBtn?.addEventListener('click', submit);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function renderTaskDefaults() {
  const wrap = document.getElementById('task-default-list');
  if (!wrap) return;

  const defaults = CONFIG.taskDefaultsByWeekday || {};
  let html = '';

  for (let i = 0; i < 7; i++) {
    const key = String(i);
    const rows: string[] = Array.isArray(defaults[key]) ? defaults[key] : [];
    const chips = rows.length
      ? rows.map((t: string) => `<button class="quick-chip" data-def-del="${escapeHtmlAttr(`${key}|${t}`)}">${escapeHtml(t)} ×</button>`).join('')
      : `<span style="font-size:11px; color:var(--text3);">No defaults</span>`;

    html += `
      <div style="margin-bottom:10px; padding:10px; border:1px solid var(--border2); border-radius: var(--rs);">
        <div style="font-size:11px; color:var(--text3); text-transform:uppercase; letter-spacing:.08em; margin-bottom:6px;">${DAY_LABELS[i]}</div>
        <div class="quick-actions-row">${chips}</div>
      </div>
    `;
  }

  wrap.innerHTML = html;

  wrap.querySelectorAll('[data-def-del]').forEach((el) => {
    el.addEventListener('click', () => {
      const raw = (el as HTMLElement).getAttribute('data-def-del');
      if (!raw) return;
      const [weekday, text] = unescapeHtmlAttr(raw).split('|');
      if (!weekday || !text) return;
      removeTaskDefault(weekday, text);
    });
  });
}
