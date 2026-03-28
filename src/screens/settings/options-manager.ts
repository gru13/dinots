import {
  CONFIG,
  addOptionItem
} from '../../modules/state';
import { events, EVENTS } from '../../modules/events';
import { renderOptionRows } from './options-manager/render';
import { handleOptionsActionClick } from './options-manager/actions';
import { bindOptionsDragAndDrop } from './options-manager/dnd';
import { pruneStaleInlineEditKeys } from './options-manager/utils';

let optionsManagerBound = false;
const editingOptionIds = new Set<string>();
const editingValueKeys = new Set<string>();
const editingSubValueKeys = new Set<string>();
const pendingDeleteOptionIds = new Set<string>();

export function bindOptionsManager() {
  const detailsEl = document.getElementById('settings-options-details') as HTMLDetailsElement | null;
  const addPanelEl = document.getElementById('settings-options-add-panel') as HTMLElement | null;
  const toggleAddBtn = document.getElementById('settings-options-toggle-add');
  const cancelAddBtn = document.getElementById('settings-options-add-cancel');
  const emojiEl = document.getElementById('settings-options-emoji') as HTMLInputElement | null;
  const keyEl = document.getElementById('settings-options-key') as HTMLInputElement | null;
  const labelEl = document.getElementById('settings-options-label') as HTMLInputElement | null;
  const addBtn = document.getElementById('settings-options-add');
  const listWrap = document.getElementById('settings-options-list') as HTMLElement | null;
  const keyPickWrap = document.getElementById('settings-options-key-list') as HTMLElement | null;

  if (optionsManagerBound) return;
  optionsManagerBound = true;

  const getReferencedOptionKeys = () => {
    const activityKeys = (Array.isArray(CONFIG.activities) ? CONFIG.activities : [])
      .map((a: any) => String(a?.optionsKey || '').trim())
      .filter((k: string) => k.length > 0);
    const quickKeys = (Array.isArray(CONFIG.quickActions) ? CONFIG.quickActions : [])
      .map((q: any) => String(q?.optionsKey || '').trim())
      .filter((k: string) => k.length > 0);
    return Array.from(new Set([...activityKeys, ...quickKeys]));
  };

  const getSuggestedKey = (referencedKeys: string[]) => {
    const existing = new Set(
      (Array.isArray(CONFIG.optionsItems) ? CONFIG.optionsItems : [])
        .map((o: any) => String(o?.key || '').trim())
        .filter((k: string) => k.length > 0)
    );
    return referencedKeys.find((k) => !existing.has(k)) || referencedKeys[0] || '';
  };

  const renderKeyPicker = () => {
    if (!keyPickWrap || !keyEl) return;
    const selected = keyEl.value.trim();
    const referencedKeys = getReferencedOptionKeys();
    if (referencedKeys.length === 0) {
      keyPickWrap.innerHTML = '<span class="settings-options-pick-empty">No keys found yet</span>';
      return;
    }

    keyPickWrap.innerHTML = referencedKeys.map((k) => {
      const active = selected === k ? 'active' : '';
      return `<button type="button" class="quick-chip settings-options-key-chip ${active}" data-opt-pick-key="${k.replace(/"/g, '&quot;')}">${k.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button>`;
    }).join('');
  };

  const syncKeySuggestions = (autoFillIfEmpty: boolean) => {
    if (!keyEl) return;
    const referencedKeys = getReferencedOptionKeys();
    if (autoFillIfEmpty && !keyEl.value.trim()) {
      const suggestion = getSuggestedKey(referencedKeys);
      if (suggestion) keyEl.value = suggestion;
    }
    renderKeyPicker();
  };

  const toggleAddPanel = () => {
    if (!addPanelEl) return;
    const shouldOpen = addPanelEl.style.display === 'none' || !addPanelEl.style.display;
    addPanelEl.style.display = shouldOpen ? 'flex' : 'none';
    if (shouldOpen && detailsEl && !detailsEl.open) detailsEl.open = true;
    if (shouldOpen) syncKeySuggestions(true);
    if (shouldOpen) labelEl?.focus();
  };

  toggleAddBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleAddPanel();
  });

  cancelAddBtn?.addEventListener('click', () => {
    if (addPanelEl) addPanelEl.style.display = 'none';
  });

  keyEl?.addEventListener('focus', () => syncKeySuggestions(false));
  keyEl?.addEventListener('input', () => renderKeyPicker());

  keyPickWrap?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest('[data-opt-pick-key]') as HTMLElement | null;
    if (!chip || !keyEl) return;
    const key = chip.getAttribute('data-opt-pick-key') || '';
    if (!key) return;
    keyEl.value = key;
    renderKeyPicker();
  });

  events.on(EVENTS.CONFIG_UPDATED, () => {
    syncKeySuggestions(false);
  });

  const submit = () => {
    const key = (keyEl?.value || '').trim();
    const label = (labelEl?.value || '').trim();
    if (!key || !label) return;
    addOptionItem({
      emoji: (emojiEl?.value || '📌').trim(),
      key,
      label,
      values: []
    });
    if (keyEl) keyEl.value = '';
    if (labelEl) labelEl.value = '';
    if (emojiEl) emojiEl.value = '📌';
    if (addPanelEl) addPanelEl.style.display = 'none';
  };

  addBtn?.addEventListener('click', submit);
  labelEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  listWrap?.addEventListener('click', (e) => {
    handleOptionsActionClick(e, {
      editingOptionIds,
      pendingDeleteOptionIds,
      editingValueKeys,
      editingSubValueKeys,
      renderOptionsManager
    });
  });

  bindOptionsDragAndDrop(listWrap);
}

export function renderOptionsManager() {
  const wrap = document.getElementById('settings-options-list');
  if (!wrap) return;

  const rows = Array.isArray(CONFIG.optionsItems) ? CONFIG.optionsItems : [];
  pruneStaleInlineEditKeys(rows, editingValueKeys, editingSubValueKeys);

  wrap.innerHTML = renderOptionRows(rows, editingOptionIds, pendingDeleteOptionIds, editingValueKeys, editingSubValueKeys);
}
