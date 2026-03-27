import {
  CONFIG,
  addOptionValue,
  updateOptionValue,
  removeOptionValue,
  addOptionSubValue,
  updateOptionSubValue,
  removeOptionSubValue,
  updateOptionItem,
  removeOptionItem
} from '../../../modules/state';
import {
  buildSubValueEditKey,
  buildValueEditKey,
  clearValueEditKeysForOption,
  hasCaseInsensitiveMatch,
  joinValueParts
} from './options-manager-utils';

type OptionsActionContext = {
  editingOptionIds: Set<string>;
  pendingDeleteOptionIds: Set<string>;
  editingValueKeys: Set<string>;
  editingSubValueKeys: Set<string>;
  renderOptionsManager: () => void;
};

export function handleOptionsActionClick(e: MouseEvent, ctx: OptionsActionContext) {
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

    const val = joinValueParts(emoji, text);
    const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
    if (item && Array.isArray(item.values) && hasCaseInsensitiveMatch(item.values, val)) return;

    addOptionValue(id, val);
    if (emojiInput) emojiInput.value = '🙂';
    if (textInput) textInput.value = '';
    return;
  }

  if (action === 'del-value' && id) {
    const value = actionEl.getAttribute('data-opt-value');
    if (!value) return;
    if (!window.confirm(`Remove "${value}"?`)) return;

    ctx.editingValueKeys.delete(buildValueEditKey(id, value));
    removeOptionValue(id, value);
    return;
  }

  if (action === 'edit-value' && id) {
    const value = actionEl.getAttribute('data-opt-value');
    if (!value) return;

    const valueKey = buildValueEditKey(id, value);
    if (ctx.editingValueKeys.has(valueKey)) {
      ctx.editingValueKeys.delete(valueKey);
    } else {
      ctx.editingValueKeys.add(valueKey);
    }
    ctx.renderOptionsManager();
    return;
  }

  if (action === 'cancel-value' && id) {
    const value = actionEl.getAttribute('data-opt-value');
    if (!value) return;

    ctx.editingValueKeys.delete(buildValueEditKey(id, value));
    ctx.renderOptionsManager();
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

    ctx.editingValueKeys.delete(buildValueEditKey(id, value));
    if (nextValue !== value) {
      updateOptionValue(id, value, nextValue);
    } else {
      ctx.renderOptionsManager();
    }
    return;
  }

  if (action === 'del-sub-value') {
    const optionKey = actionEl.getAttribute('data-opt-key');
    const parent = actionEl.getAttribute('data-opt-parent');
    const sub = actionEl.getAttribute('data-opt-sub');
    if (!optionKey || !parent || !sub) return;
    if (!window.confirm(`Remove "${sub}"?`)) return;

    ctx.editingSubValueKeys.delete(buildSubValueEditKey(optionKey, parent, sub));
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

    const val = joinValueParts(emoji, text);
    const existingSubValues = CONFIG.optionsNested?.[optionKey]?.[parent] || [];
    if (hasCaseInsensitiveMatch(existingSubValues, val)) return;

    addOptionSubValue(optionKey, parent, val);
    if (emojiInput) emojiInput.value = '🙂';
    if (textInput) textInput.value = '';
    return;
  }

  if (action === 'edit-sub-value') {
    const optionKey = actionEl.getAttribute('data-opt-key');
    const parent = actionEl.getAttribute('data-opt-parent');
    const sub = actionEl.getAttribute('data-opt-sub');
    if (!optionKey || !parent || !sub) return;

    const key = buildSubValueEditKey(optionKey, parent, sub);
    if (ctx.editingSubValueKeys.has(key)) {
      ctx.editingSubValueKeys.delete(key);
    } else {
      ctx.editingSubValueKeys.add(key);
    }
    ctx.renderOptionsManager();
    return;
  }

  if (action === 'cancel-sub-value') {
    const optionKey = actionEl.getAttribute('data-opt-key');
    const parent = actionEl.getAttribute('data-opt-parent');
    const sub = actionEl.getAttribute('data-opt-sub');
    if (!optionKey || !parent || !sub) return;

    ctx.editingSubValueKeys.delete(buildSubValueEditKey(optionKey, parent, sub));
    ctx.renderOptionsManager();
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

    ctx.editingSubValueKeys.delete(buildSubValueEditKey(optionKey, parent, sub));
    if (nextValue !== sub) {
      updateOptionSubValue(optionKey, parent, sub, nextValue);
    } else {
      ctx.renderOptionsManager();
    }
    return;
  }

  if (!id) return;

  if (action === 'del') {
    if (!ctx.pendingDeleteOptionIds.has(id)) {
      ctx.pendingDeleteOptionIds.add(id);
      ctx.renderOptionsManager();
      return;
    }
    if (!window.confirm('Delete this options item?')) return;

    removeOptionItem(id);
    ctx.pendingDeleteOptionIds.delete(id);
    ctx.editingOptionIds.delete(id);
    return;
  }

  if (action === 'edit') {
    if (ctx.editingOptionIds.has(id)) {
      ctx.editingOptionIds.delete(id);
      ctx.pendingDeleteOptionIds.delete(id);
    } else {
      ctx.editingOptionIds.add(id);
      ctx.pendingDeleteOptionIds.delete(id);
    }
    ctx.renderOptionsManager();
    return;
  }

  if (action === 'cancel') {
    ctx.editingOptionIds.delete(id);
    ctx.pendingDeleteOptionIds.delete(id);
    clearValueEditKeysForOption(ctx.editingValueKeys, id);
    ctx.renderOptionsManager();
    return;
  }

  if (action === 'save') {
    if (!ctx.editingOptionIds.has(id)) return;
    const row = actionEl.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!row) return;

    const emoji = (row.querySelector('[data-edit-field="emoji"]') as HTMLInputElement | null)?.value ?? '';
    const key = (row.querySelector('[data-edit-field="key"]') as HTMLInputElement | null)?.value ?? '';
    const label = (row.querySelector('[data-edit-field="label"]') as HTMLInputElement | null)?.value ?? '';

    ctx.editingOptionIds.delete(id);
    ctx.pendingDeleteOptionIds.delete(id);
    updateOptionItem(id, { emoji, key, label });
  }
}
