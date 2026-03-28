import { CONFIG, STATE, clearAllLogs, replaceConfig, persistConfig } from '../../modules/state';
import { events, EVENTS } from '../../modules/events';
import { escapeHtml } from './utils';
import { DEFAULT_CONFIG } from '../../config';

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

function downloadUiConfigBackup(fileName: string = 'dinots_ui_config.json') {
  const blob = new Blob([JSON.stringify(CONFIG, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
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
  const defaultsMeta = (CONFIG && typeof CONFIG === 'object' ? CONFIG._defaults : null) as Record<string, any> | null;

  const timelineCount = Array.isArray(STATE.timeline) ? STATE.timeline.length : 0;
  const expenseCount = Array.isArray(STATE.expenses) ? STATE.expenses.length : 0;
  const taskList = Array.isArray(STATE.tasks) ? STATE.tasks : [];
  const doneTaskCount = taskList.filter((t: any) => Boolean(t?.done)).length;
  const dataEntryCount = timelineCount + expenseCount + taskList.length;
  const dataMode = dataEntryCount > 0 ? 'Active' : 'Empty';
  const dataModeColor = dataEntryCount > 0 ? 'var(--teal)' : 'var(--text3)';

  const activitiesCount = Array.isArray(CONFIG.activities) ? CONFIG.activities.length : 0;
  const quickActionsCount = Array.isArray(CONFIG.quickActions) ? CONFIG.quickActions.length : 0;
  const optionsItemsCount = Array.isArray(CONFIG.optionsItems) ? CONFIG.optionsItems.length : 0;
  const categoriesCount = Array.isArray(CONFIG.categories) ? CONFIG.categories.length : 0;

  let configMode = 'Unknown';
  let configModeColor = 'var(--text3)';
  let customizedSections = 0;
  let trackedSections = 0;
  if (defaultsMeta && typeof defaultsMeta === 'object') {
    const pristineFlags = Object.keys(defaultsMeta)
      .filter((k) => k.endsWith('Pristine'))
      .map((k) => defaultsMeta[k] === true);

    trackedSections = pristineFlags.length;
    customizedSections = pristineFlags.filter((isPristine) => !isPristine).length;

    if (pristineFlags.length > 0 && pristineFlags.every(Boolean)) {
      configMode = 'Default';
      configModeColor = 'var(--teal)';
    } else {
      configMode = 'Customized';
      configModeColor = 'var(--amber)';
    }
  }

  el.innerHTML = `
    <div style="margin-bottom: 8px; color: var(--text2); font-weight: 600;">Config Summary</div>
    <div style="margin-bottom: 6px;">Config: <span style="font-family: 'DM Mono', monospace; color: ${configModeColor};">${escapeHtml(configMode)}</span></div>
    <div style="margin-bottom: 6px;">Sections changed: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(customizedSections))}/${escapeHtml(String(trackedSections || 0))}</span></div>
    <div style="margin-bottom: 6px;">Activities: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(activitiesCount))}</span></div>
    <div style="margin-bottom: 6px;">Quick items: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(quickActionsCount))}</span></div>
    <div style="margin-bottom: 6px;">Options items: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(optionsItemsCount))}</span></div>
    <div style="margin-bottom: 10px;">Categories: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(categoriesCount))}</span></div>

    <div style="margin-bottom: 8px; color: var(--text2); font-weight: 600;">Data Summary</div>
    <div style="margin-bottom: 6px;">Date: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(STATE.date)}</span></div>
    <div style="margin-bottom: 6px;">Data: <span style="font-family: 'DM Mono', monospace; color: ${dataModeColor};">${escapeHtml(dataMode)}</span></div>
    <div style="margin-bottom: 6px;">Timeline logs: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(timelineCount))}</span></div>
    <div style="margin-bottom: 6px;">Expenses: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(expenseCount))}</span></div>
    <div style="margin-bottom: 6px;">Tasks done: <span style="font-family: 'DM Mono', monospace;">${escapeHtml(String(doneTaskCount))}/${escapeHtml(String(taskList.length))}</span></div>
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
      downloadUiConfigBackup('dinots_ui_config.json');
    });
  }

  if (resetUiBtn) {
    resetUiBtn.addEventListener('click', async () => {
      const ok = window.confirm('Switch to default UI config? Your current config will be exported as a backup first.');
      if (!ok) return;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadUiConfigBackup(`dinots_ui_config_backup_before_reset_${timestamp}.json`);

      // Hard reset to shipped defaults, then persist over existing cloud config.
      replaceConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
      persistConfig();
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
