import { CONFIG, STATE, bootstrapConfig, clearAllLogs } from '../../modules/state';
import { events, EVENTS } from '../../modules/events';
import { escapeHtml } from './utils';

function downloadLogBackup() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dinots_${STATE.date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function renderAppInfo() {
  const el = document.getElementById('app-version-info');
  if (!el) return;

  const budget = CONFIG.theme?.dailyBudget;
  const currency = CONFIG.theme?.currencySymbol;

  el.innerHTML = `
    <div style="margin-bottom: 6px;">Date: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(STATE.date)}</span></div>
    <div style="margin-bottom: 6px;">Budget: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(currency ?? '₹'))}${escapeHtml(String(budget ?? '—'))}</span></div>
  `;
}

export function bindImportExport() {
  const importUiBtn = document.getElementById('btn-import-ui');
  const exportUiBtn = document.getElementById('btn-export-ui');
  const resetUiBtn = document.getElementById('btn-reset-ui');
  const fileUi = document.getElementById('import-config-file') as HTMLInputElement | null;

  const exportLogBtn = document.getElementById('btn-export-log');
  const resetLogBtn = document.getElementById('btn-reset-log');
  const importLogBtn = document.getElementById('btn-import-log');
  const fileLog = document.getElementById('import-file') as HTMLInputElement | null;

  if (importUiBtn && fileUi) {
    importUiBtn.addEventListener('click', () => fileUi.click());
    fileUi.addEventListener('change', async () => {
      const file = fileUi.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!isValidConfig(parsed)) throw new Error('Invalid config');

        Object.assign(CONFIG, parsed);
        events.emit(EVENTS.CONFIG_UPDATED);
      } catch {
        alert('Invalid UI config JSON.');
      } finally {
        fileUi.value = '';
      }
    });
  }

  if (exportUiBtn) {
    exportUiBtn.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(CONFIG, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dinots_ui_config.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  if (resetUiBtn) {
    resetUiBtn.addEventListener('click', async () => {
      await bootstrapConfig();
      events.emit(EVENTS.CONFIG_UPDATED);
    });
  }

  if (exportLogBtn) {
    exportLogBtn.addEventListener('click', () => {
      downloadLogBackup();
    });
  }

  if (resetLogBtn) {
    resetLogBtn.addEventListener('click', () => {
      if (!window.confirm('Export logs and then delete all current logs?')) return;
      downloadLogBackup();
      clearAllLogs();
    });
  }

  if (importLogBtn && fileLog) {
    importLogBtn.addEventListener('click', () => fileLog.click());
    fileLog.addEventListener('change', async () => {
      const file = fileLog.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid');
        if (typeof parsed.intention === 'string') STATE.intention = parsed.intention;
        if (typeof parsed.battery === 'number') STATE.battery = parsed.battery;
        if (Array.isArray(parsed.timeline)) STATE.timeline = parsed.timeline;
        if (Array.isArray(parsed.expenses)) STATE.expenses = parsed.expenses;
        if (Array.isArray(parsed.tasks)) STATE.tasks = parsed.tasks;

        events.emit(EVENTS.STATE_READY, STATE);
        events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
        events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
        events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
      } catch {
        alert('Invalid log JSON.');
      } finally {
        fileLog.value = '';
      }
    });
  }
}

function isValidConfig(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.activities) || data.activities.length === 0) return false;
  if (!Array.isArray(data.categories) || data.categories.length === 0) return false;
  if (!Array.isArray(data.quickActions)) return false;
  if (data.activityOptions && typeof data.activityOptions !== 'object') return false;
  return true;
}
