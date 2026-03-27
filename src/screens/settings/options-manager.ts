import {
  CONFIG,
  addOptionItem,
  updateOptionItem,
  removeOptionItem,
  reorderOptionItems,
  reorderOptionValues,
  reorderOptionSubValues,
  addOptionValue,
  updateOptionValue,
  removeOptionValue,
  addOptionSubValue,
  updateOptionSubValue,
  removeOptionSubValue
} from '../../modules/state';
import { events, EVENTS } from '../../modules/events';
import { renderOptionRows } from './options-manager-render';

let draggingOptionId = '';
let draggingOptionValueMeta: { id: string; value: string } | null = null;
let draggingOptionSubValueMeta: { optionKey: string; parentValue: string; subValue: string } | null = null;
let optionsManagerBound = false;
const editingOptionIds = new Set<string>();
const editingValueKeys = new Set<string>();
const editingSubValueKeys = new Set<string>();
const pendingDeleteOptionIds = new Set<string>();

function joinValueParts(emoji: string, text: string) {
  const normalizedEmoji = String(emoji || '').trim();
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return '';
  return normalizedEmoji ? `${normalizedEmoji} ${normalizedText}` : normalizedText;
}

function hasCaseInsensitiveMatch(items: string[], candidate: string, except?: string) {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedExcept = (except || '').trim().toLowerCase();
  return items.some((item) => {
    const current = String(item || '').trim().toLowerCase();
    if (!current) return false;
    if (normalizedExcept && current === normalizedExcept) return false;
    return current === normalizedCandidate;
  });
}

function clearNestedDragOverState(listWrap: HTMLElement | null) {
  if (!listWrap) return;
  listWrap.querySelectorAll('.settings-option-card-over').forEach((el) => el.classList.remove('settings-option-card-over'));
  listWrap.querySelectorAll('.settings-option-subitem-over').forEach((el) => el.classList.remove('settings-option-subitem-over'));
}

function finishDrag(listWrap: HTMLElement | null) {
  clearNestedDragOverState(listWrap);
  listWrap?.querySelectorAll('.settings-option-card-dragging').forEach((el) => el.classList.remove('settings-option-card-dragging'));
  listWrap?.querySelectorAll('.settings-option-subitem-dragging').forEach((el) => el.classList.remove('settings-option-subitem-dragging'));
  listWrap?.querySelectorAll('.settings-draggable-row-dragging').forEach((el) => el.classList.remove('settings-draggable-row-dragging'));
  draggingOptionId = '';
  draggingOptionValueMeta = null;
  draggingOptionSubValueMeta = null;
}

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
    const target = e.target as HTMLElement;
    const actionEl = target.closest('[data-opt-action]') as HTMLElement | null;
    const id = actionEl?.getAttribute('data-opt-id') || '';
    const action = actionEl?.getAttribute('data-opt-action') || '';

    if (!actionEl || !action) return;

    if (action === 'add-value' && id) {
      const row = actionEl.closest('[data-opt-row-id]') as HTMLElement | null;
      if (!row) return;
      const emojiInput = row.querySelector('[data-add-value-emoji-input]') as HTMLInputElement | null;
      const textInput = row.querySelector('[data-add-value-text-input]') as HTMLInputElement | null;
      const emoji = (emojiInput?.value || '').trim();
      const text = (textInput?.value || '').trim();
      if (!text) return;
      const val = emoji ? `${emoji} ${text}` : text;
      const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
      if (item && Array.isArray(item.values) && hasCaseInsensitiveMatch(item.values, val)) return;
      addOptionValue(id, val);
      if (emojiInput) emojiInput.value = '';
      if (textInput) textInput.value = '';
      return;
    }

    if (action === 'del-value' && id) {
      const value = actionEl.getAttribute('data-opt-value');
      if (!value) return;
      if (!window.confirm(`Remove "${value}"?`)) return;
      editingValueKeys.delete(`${id}::${value}`);
      removeOptionValue(id, value);
      return;
    }

    if (action === 'edit-value' && id) {
      const value = actionEl.getAttribute('data-opt-value');
      if (!value) return;
      const valueKey = `${id}::${value}`;
      if (editingValueKeys.has(valueKey)) {
        editingValueKeys.delete(valueKey);
      } else {
        editingValueKeys.add(valueKey);
      }
      renderOptionsManager();
      return;
    }

    if (action === 'cancel-value' && id) {
      const value = actionEl.getAttribute('data-opt-value');
      if (!value) return;
      editingValueKeys.delete(`${id}::${value}`);
      renderOptionsManager();
      return;
    }

    if (action === 'save-value' && id) {
      const value = actionEl.getAttribute('data-opt-value');
      if (!value) return;
      const valueRow = actionEl.closest('[data-opt-value-row="1"]') as HTMLElement | null;
      if (!valueRow) return;

      const emoji = (valueRow.querySelector('[data-edit-value-emoji-input]') as HTMLInputElement | null)?.value || '';
      const text = (valueRow.querySelector('[data-edit-value-text-input]') as HTMLInputElement | null)?.value || '';
      const nextValue = joinValueParts(emoji, text);
      if (!nextValue) return;

      const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
      if (item && Array.isArray(item.values) && hasCaseInsensitiveMatch(item.values, nextValue, value)) return;

      editingValueKeys.delete(`${id}::${value}`);
      if (nextValue !== value) {
        updateOptionValue(id, value, nextValue);
      } else {
        renderOptionsManager();
      }
      return;
    }

    if (action === 'del-sub-value') {
      const optionKey = actionEl.getAttribute('data-opt-key');
      const parent = actionEl.getAttribute('data-opt-parent');
      const sub = actionEl.getAttribute('data-opt-sub');
      if (!optionKey || !parent || !sub) return;
      if (!window.confirm(`Remove "${sub}"?`)) return;
      editingSubValueKeys.delete(`${optionKey}::${parent}::${sub}`);
      removeOptionSubValue(optionKey, parent, sub);
      return;
    }

    if (action === 'add-sub-value') {
      const optionKey = actionEl.getAttribute('data-opt-key');
      const parent = actionEl.getAttribute('data-opt-parent');
      if (!optionKey || !parent) return;
      const parentRow = actionEl.parentElement;
      const emojiInput = parentRow?.querySelector('[data-add-sub-value-emoji-input]') as HTMLInputElement | null;
      const textInput = parentRow?.querySelector('[data-add-sub-value-text-input]') as HTMLInputElement | null;
      const emoji = (emojiInput?.value || '').trim();
      const text = (textInput?.value || '').trim();
      if (!text) return;
      const val = emoji ? `${emoji} ${text}` : text;
      const existingSubValues = CONFIG.optionsNested?.[optionKey]?.[parent] || [];
      if (hasCaseInsensitiveMatch(existingSubValues, val)) return;
      addOptionSubValue(optionKey, parent, val);
      if (emojiInput) emojiInput.value = '';
      if (textInput) textInput.value = '';
      return;
    }

    if (action === 'edit-sub-value') {
      const optionKey = actionEl.getAttribute('data-opt-key');
      const parent = actionEl.getAttribute('data-opt-parent');
      const sub = actionEl.getAttribute('data-opt-sub');
      if (!optionKey || !parent || !sub) return;
      const key = `${optionKey}::${parent}::${sub}`;
      if (editingSubValueKeys.has(key)) {
        editingSubValueKeys.delete(key);
      } else {
        editingSubValueKeys.add(key);
      }
      renderOptionsManager();
      return;
    }

    if (action === 'cancel-sub-value') {
      const optionKey = actionEl.getAttribute('data-opt-key');
      const parent = actionEl.getAttribute('data-opt-parent');
      const sub = actionEl.getAttribute('data-opt-sub');
      if (!optionKey || !parent || !sub) return;
      editingSubValueKeys.delete(`${optionKey}::${parent}::${sub}`);
      renderOptionsManager();
      return;
    }

    if (action === 'save-sub-value') {
      const optionKey = actionEl.getAttribute('data-opt-key');
      const parent = actionEl.getAttribute('data-opt-parent');
      const sub = actionEl.getAttribute('data-opt-sub');
      if (!optionKey || !parent || !sub) return;

      const subRow = actionEl.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
      if (!subRow) return;
      const emoji = (subRow.querySelector('[data-edit-sub-value-emoji-input]') as HTMLInputElement | null)?.value || '';
      const text = (subRow.querySelector('[data-edit-sub-value-text-input]') as HTMLInputElement | null)?.value || '';
      const nextValue = joinValueParts(emoji, text);
      if (!nextValue) return;

      const existingSubValues = CONFIG.optionsNested?.[optionKey]?.[parent] || [];
      if (hasCaseInsensitiveMatch(existingSubValues, nextValue, sub)) return;

      editingSubValueKeys.delete(`${optionKey}::${parent}::${sub}`);
      if (nextValue !== sub) {
        updateOptionSubValue(optionKey, parent, sub, nextValue);
      } else {
        renderOptionsManager();
      }
      return;
    }

    if (!id) return;

    if (action === 'del') {
      if (!pendingDeleteOptionIds.has(id)) {
        pendingDeleteOptionIds.add(id);
        renderOptionsManager();
        return;
      }
      if (!window.confirm('Delete this options item?')) return;
      removeOptionItem(id);
      pendingDeleteOptionIds.delete(id);
      editingOptionIds.delete(id);
      return;
    }

    if (action === 'edit') {
      if (editingOptionIds.has(id)) {
        editingOptionIds.delete(id);
        pendingDeleteOptionIds.delete(id);
      } else {
        editingOptionIds.add(id);
        pendingDeleteOptionIds.delete(id);
      }
      renderOptionsManager();
      return;
    }

    if (action === 'cancel') {
      editingOptionIds.delete(id);
      pendingDeleteOptionIds.delete(id);
      for (const value of [...editingValueKeys]) {
        if (value.startsWith(`${id}::`)) editingValueKeys.delete(value);
      }
      renderOptionsManager();
      return;
    }

    if (action === 'save') {
      if (!editingOptionIds.has(id)) return;
      const row = actionEl.closest('[data-opt-row-id]') as HTMLElement | null;
      if (!row) return;

      const emoji = (row.querySelector('[data-edit-field="emoji"]') as HTMLInputElement | null)?.value ?? '';
      const key = (row.querySelector('[data-edit-field="key"]') as HTMLInputElement | null)?.value ?? '';
      const label = (row.querySelector('[data-edit-field="label"]') as HTMLInputElement | null)?.value ?? '';

      editingOptionIds.delete(id);
      pendingDeleteOptionIds.delete(id);
      updateOptionItem(id, { emoji, key, label });
    }
  });

  listWrap?.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select')) return;

    const subRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
    if (subRow) {
      const optionKey = subRow.getAttribute('data-opt-key') || '';
      const parentValue = subRow.getAttribute('data-opt-parent') || '';
      const subValue = subRow.getAttribute('data-opt-sub') || '';
      if (!optionKey || !parentValue || !subValue) return;
      draggingOptionSubValueMeta = { optionKey, parentValue, subValue };
      subRow.classList.add('settings-option-subitem-dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      return;
    }

    const valueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
    if (valueRow) {
      const valueId = valueRow.getAttribute('data-opt-id') || '';
      const value = valueRow.getAttribute('data-opt-value') || '';
      if (!valueId || !value) return;
      draggingOptionValueMeta = { id: valueId, value };
      valueRow.classList.add('settings-option-card-dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      return;
    }

    const row = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!row) return;
    draggingOptionId = row.getAttribute('data-opt-row-id') || '';
    row.classList.add('settings-draggable-row-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingOptionId);
    }
  });

  listWrap?.addEventListener('dragend', () => {
    finishDrag(listWrap);
  });

  listWrap?.addEventListener('dragover', (e) => {
    const target = e.target as HTMLElement;

    if (draggingOptionSubValueMeta) {
      const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
      if (!targetSubRow) return;
      const optionKey = targetSubRow.getAttribute('data-opt-key') || '';
      const parentValue = targetSubRow.getAttribute('data-opt-parent') || '';
      if (optionKey !== draggingOptionSubValueMeta.optionKey || parentValue !== draggingOptionSubValueMeta.parentValue) {
        return;
      }
      e.preventDefault();
      clearNestedDragOverState(listWrap);
      targetSubRow.classList.add('settings-option-subitem-over');
      return;
    }

    if (draggingOptionValueMeta) {
      const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
      if (!targetValueRow) return;
      const valueId = targetValueRow.getAttribute('data-opt-id') || '';
      if (valueId !== draggingOptionValueMeta.id) return;
      e.preventDefault();
      clearNestedDragOverState(listWrap);
      targetValueRow.classList.add('settings-option-card-over');
      return;
    }

    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!targetRow) return;
    e.preventDefault();
    targetRow.classList.add('settings-draggable-row-over');
  });

  listWrap?.addEventListener('dragleave', (e) => {
    const target = e.target as HTMLElement;
    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    targetRow?.classList.remove('settings-draggable-row-over');

    const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
    targetValueRow?.classList.remove('settings-option-card-over');

    const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
    targetSubRow?.classList.remove('settings-option-subitem-over');
  });

  listWrap?.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;

    if (draggingOptionSubValueMeta) {
      const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
      if (!targetSubRow) {
        finishDrag(listWrap);
        return;
      }

      const optionKey = targetSubRow.getAttribute('data-opt-key') || '';
      const parentValue = targetSubRow.getAttribute('data-opt-parent') || '';
      const targetSubValue = targetSubRow.getAttribute('data-opt-sub') || '';
      const { subValue } = draggingOptionSubValueMeta;

      if (!optionKey || !parentValue || !targetSubValue || targetSubValue === subValue) {
        finishDrag(listWrap);
        return;
      }

      if (optionKey !== draggingOptionSubValueMeta.optionKey || parentValue !== draggingOptionSubValueMeta.parentValue) {
        finishDrag(listWrap);
        return;
      }

      const current = [...(CONFIG.optionsNested?.[optionKey]?.[parentValue] || [])];
      const from = current.findIndex((v: string) => v === subValue);
      const to = current.findIndex((v: string) => v === targetSubValue);
      if (from >= 0 && to >= 0) {
        const [item] = current.splice(from, 1);
        current.splice(to, 0, item);
        reorderOptionSubValues(optionKey, parentValue, current);
      }
      finishDrag(listWrap);
      return;
    }

    if (draggingOptionValueMeta) {
      const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
      if (!targetValueRow) {
        finishDrag(listWrap);
        return;
      }

      const valueId = targetValueRow.getAttribute('data-opt-id') || '';
      const targetValue = targetValueRow.getAttribute('data-opt-value') || '';
      const { id: sourceId, value: sourceValue } = draggingOptionValueMeta;

      if (!valueId || !targetValue || valueId !== sourceId || targetValue === sourceValue) {
        finishDrag(listWrap);
        return;
      }

      const optionItem = (CONFIG.optionsItems || []).find((o: any) => o.id === valueId);
      const current = Array.isArray(optionItem?.values) ? [...optionItem.values] : [];
      const from = current.findIndex((v: string) => v === sourceValue);
      const to = current.findIndex((v: string) => v === targetValue);
      if (from >= 0 && to >= 0) {
        const [item] = current.splice(from, 1);
        current.splice(to, 0, item);
        reorderOptionValues(valueId, current);
      }
      finishDrag(listWrap);
      return;
    }

    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!targetRow || !draggingOptionId) {
      finishDrag(listWrap);
      return;
    }
    targetRow.classList.remove('settings-draggable-row-over');

    const targetId = targetRow.getAttribute('data-opt-row-id') || '';
    if (!targetId || targetId === draggingOptionId) {
      finishDrag(listWrap);
      return;
    }

    const current = Array.isArray(CONFIG.optionsItems) ? [...CONFIG.optionsItems] : [];
    const from = current.findIndex((o: any) => o.id === draggingOptionId);
    const to = current.findIndex((o: any) => o.id === targetId);
    if (from >= 0 && to >= 0) {
      const [item] = current.splice(from, 1);
      current.splice(to, 0, item);
      reorderOptionItems(current.map((o: any) => o.id));
    }

    finishDrag(listWrap);
  });
}

export function renderOptionsManager() {
  const wrap = document.getElementById('settings-options-list');
  if (!wrap) return;

  const rows = Array.isArray(CONFIG.optionsItems) ? CONFIG.optionsItems : [];
  const validValueKeys = new Set<string>();
  const validSubValueKeys = new Set<string>();

  rows.forEach((item: any) => {
    const id = String(item?.id || '');
    const optionKey = String(item?.key || '');
    const values = Array.isArray(item?.values) ? item.values : [];
    values.forEach((value: string) => {
      validValueKeys.add(`${id}::${value}`);
      const subValues = CONFIG.optionsNested?.[optionKey]?.[value] || [];
      subValues.forEach((subValue: string) => {
        validSubValueKeys.add(`${optionKey}::${value}::${subValue}`);
      });
    });
  });

  for (const key of [...editingValueKeys]) {
    if (!validValueKeys.has(key)) editingValueKeys.delete(key);
  }
  for (const key of [...editingSubValueKeys]) {
    if (!validSubValueKeys.has(key)) editingSubValueKeys.delete(key);
  }

  wrap.innerHTML = renderOptionRows(rows, editingOptionIds, pendingDeleteOptionIds, editingValueKeys, editingSubValueKeys);
}
