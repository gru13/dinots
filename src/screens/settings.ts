import { events, EVENTS } from '../modules/events';
import { bindActivityManager, renderActivityManager } from './settings/activity-manager';
import { bindQuickManager, renderQuickManager } from './settings/quick-manager';
import { bindOptionsManager, renderOptionsManager } from './settings/options-manager';
import { bindTaskDefaults, renderTaskDefaults } from './settings/task-defaults';
import { bindBudgetSettings, renderBudgetSettings } from './settings/budget';
import { bindImportExport, renderAppInfo } from './settings/app-info';

export function initSettingsScreen() {
  renderAppInfo();
  renderBudgetSettings();
  bindImportExport();
  bindBudgetSettings();
  bindTaskDefaults();
  bindActivityManager();
  bindQuickManager();
  bindOptionsManager();
  renderTaskDefaults();
  renderActivityManager();
  renderQuickManager();
  renderOptionsManager();

  events.on(EVENTS.STATE_READY, () => {
    renderAppInfo();
    renderBudgetSettings();
  });

  events.on(EVENTS.CONFIG_UPDATED, () => {
    renderAppInfo();
    renderBudgetSettings();
    renderTaskDefaults();
    renderActivityManager();
    renderQuickManager();
    renderOptionsManager();
  });
}
