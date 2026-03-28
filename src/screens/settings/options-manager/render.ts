import { CONFIG } from '../../../modules/state';
import { escapeHtml, escapeHtmlAttr } from '../utils';

function splitEmojiAndText(rawValue: string) {
  const value = String(rawValue || '').trim();
  if (!value) return { emoji: '', text: '' };

  const parts = value.split(/\s+/);
  if (parts.length < 2) return { emoji: '', text: value };

  const first = parts[0];
  if (!/[\p{Extended_Pictographic}]/u.test(first)) {
    return { emoji: '', text: value };
  }

  return {
    emoji: first,
    text: value.slice(first.length).trim()
  };
}

function renderValueDisplay(rawValue: string) {
  const parsed = splitEmojiAndText(rawValue);
  const emoji = parsed.emoji || '🙂';
  const emojiClass = parsed.emoji ? 'settings-option-value-emoji' : 'settings-option-value-emoji settings-option-value-emoji-fallback';
  const emojiPart = `<span class="${emojiClass}">${escapeHtml(emoji)}</span>`;
  const textPart = `<span class="settings-option-value-text">${escapeHtml(parsed.text || rawValue)}</span>`;
  return `<span class="settings-option-value-display">${emojiPart}${textPart}</span>`;
}

function renderOptionActionButtons(id: string, isDeletePending: boolean, isEditing: boolean) {
  if (isEditing) {
    return '<span class="quick-chip" style="opacity:.85; cursor:default;">Editing</span>';
  }

  return `
    <button type="button" class="quick-chip settings-action-btn settings-action-edit settings-action-icon-btn" title="Edit" aria-label="Edit" data-opt-action="edit" data-opt-id="${escapeHtmlAttr(id)}"><span class="settings-edit-icon">✏</span></button>
    <button type="button" class="quick-chip settings-action-btn settings-action-delete settings-action-icon-btn" title="Delete" aria-label="Delete" data-opt-action="del" data-opt-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? '⚠' : '🗑'}</button>
  `;
}

function renderOptionEditActions(id: string, isDeletePending: boolean, isEditing: boolean) {
  if (!isEditing) return '';

  return `
    <div class="settings-edit-actions">
      <button type="button" class="quick-chip settings-action-btn settings-action-save" data-opt-action="save" data-opt-id="${escapeHtmlAttr(id)}">✓ Save</button>
      <button type="button" class="quick-chip settings-action-btn settings-action-cancel" data-opt-action="cancel" data-opt-id="${escapeHtmlAttr(id)}">↺ Cancel</button>
      <button type="button" class="quick-chip settings-action-btn settings-action-delete" data-opt-action="del" data-opt-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? 'Confirm Delete' : '🗑 Delete'}</button>
    </div>
  `;
}

function renderSubValue(optionKey: string, parentValue: string, subValue: string, isEditing: boolean) {
  const parsed = splitEmojiAndText(subValue);
  return `
    <div class="settings-option-subitem" draggable="${isEditing ? 'false' : 'true'}" data-opt-sub-row="1" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(parentValue)}" data-opt-sub="${escapeHtmlAttr(subValue)}">
      ${isEditing ? `
      <div class="settings-option-inline-edit-row">
        <input class="form-input settings-option-emoji-input" data-edit-sub-value-emoji-input type="text" value="${escapeHtmlAttr(parsed.emoji || '🙂')}" placeholder="🙂" />
        <input class="form-input settings-option-input-compact" data-edit-sub-value-text-input type="text" value="${escapeHtmlAttr(parsed.text)}" placeholder="Sub text..." />
        <button type="button" class="quick-chip settings-action-btn settings-option-mini-btn" data-opt-action="save-sub-value" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(parentValue)}" data-opt-sub="${escapeHtmlAttr(subValue)}">Save</button>
        <button type="button" class="quick-chip settings-action-btn settings-option-mini-btn" data-opt-action="cancel-sub-value" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(parentValue)}" data-opt-sub="${escapeHtmlAttr(subValue)}">Cancel</button>
      </div>
      ` : `
      <span class="settings-option-subtext">${renderValueDisplay(subValue)}</span>
      <div class="settings-option-actions">
        <button type="button" class="quick-chip settings-action-btn settings-action-edit settings-action-icon-btn settings-option-icon-btn" data-opt-action="edit-sub-value" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(parentValue)}" data-opt-sub="${escapeHtmlAttr(subValue)}" title="Edit">✎</button>
        <button type="button" class="quick-chip settings-action-btn settings-action-delete settings-action-icon-btn settings-option-icon-btn" data-opt-action="del-sub-value" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(parentValue)}" data-opt-sub="${escapeHtmlAttr(subValue)}" title="Remove">🗑</button>
      </div>
      `}
    </div>
  `;
}

function renderOptionValue(optionId: string, optionKey: string, value: string, isEditing: boolean, editingSubValueKeys: Set<string>) {
  const parsed = splitEmojiAndText(value);
  const subValues = CONFIG.optionsNested?.[optionKey]?.[value] || [];
  const subValuesHtml = subValues.map((subValue: string) => {
    const subKey = `${optionKey}::${value}::${subValue}`;
    return renderSubValue(optionKey, value, subValue, editingSubValueKeys.has(subKey));
  }).join('');

  return `
    <div class="settings-option-card" draggable="${isEditing ? 'false' : 'true'}" data-opt-value-row="1" data-opt-id="${escapeHtmlAttr(optionId)}" data-opt-value="${escapeHtmlAttr(value)}">
      ${isEditing ? `
      <div class="settings-option-inline-edit-row">
        <input class="form-input settings-option-emoji-input" data-edit-value-emoji-input type="text" value="${escapeHtmlAttr(parsed.emoji || '🙂')}" placeholder="🙂" />
        <input class="form-input settings-option-input-compact" data-edit-value-text-input type="text" value="${escapeHtmlAttr(parsed.text)}" placeholder="Option text..." />
        <button type="button" class="quick-chip settings-action-btn settings-option-mini-btn" data-opt-action="save-value" data-opt-id="${escapeHtmlAttr(optionId)}" data-opt-value="${escapeHtmlAttr(value)}">Save</button>
        <button type="button" class="quick-chip settings-action-btn settings-option-mini-btn" data-opt-action="cancel-value" data-opt-id="${escapeHtmlAttr(optionId)}" data-opt-value="${escapeHtmlAttr(value)}">Cancel</button>
      </div>
      ` : `
      <div class="settings-option-head">
        <span class="settings-option-name">${renderValueDisplay(value)}</span>
        <div class="settings-option-actions">
          <button type="button" class="quick-chip settings-action-btn settings-action-edit settings-action-icon-btn settings-option-icon-btn" data-opt-action="edit-value" data-opt-id="${escapeHtmlAttr(optionId)}" data-opt-value="${escapeHtmlAttr(value)}" title="Edit option">✎</button>
          <button type="button" class="quick-chip settings-action-btn settings-action-delete settings-action-icon-btn settings-option-icon-btn" data-opt-action="del-value" data-opt-id="${escapeHtmlAttr(optionId)}" data-opt-value="${escapeHtmlAttr(value)}" title="Remove option">🗑</button>
        </div>
      </div>
      `}
      <div class="settings-option-sublist">
        ${subValuesHtml}
      </div>
      <div class="settings-option-add-sub-row">
        <input class="form-input settings-option-emoji-input" data-add-sub-value-emoji-input data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(value)}" type="text" value="🙂" placeholder="🙂" />
        <input class="form-input settings-option-input-compact" data-add-sub-value-text-input data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(value)}" type="text" placeholder="Sub text..." />
        <button type="button" class="quick-chip settings-action-btn settings-option-mini-btn" data-opt-action="add-sub-value" data-opt-key="${escapeHtmlAttr(optionKey)}" data-opt-parent="${escapeHtmlAttr(value)}">+</button>
      </div>
    </div>
  `;
}

function renderOptionRow(
  optionItem: any,
  editingOptionIds: Set<string>,
  pendingDeleteOptionIds: Set<string>,
  editingValueKeys: Set<string>,
  editingSubValueKeys: Set<string>
) {
  const id = String(optionItem.id || '');
  const optionKey = String(optionItem.key || '');
  const isEditing = editingOptionIds.has(id);
  const isDeletePending = pendingDeleteOptionIds.has(id);

  const optionActions = renderOptionActionButtons(id, isDeletePending, isEditing);
  const optionEditActions = renderOptionEditActions(id, isDeletePending, isEditing);

  const valuesHtml = Array.isArray(optionItem.values)
    ? optionItem.values.map((value: string) => {
      const valueKey = `${id}::${value}`;
      return renderOptionValue(id, optionKey, value, editingValueKeys.has(valueKey), editingSubValueKeys);
    }).join('')
    : '';

  return `
    <div class="settings-draggable-row" draggable="${isEditing ? 'false' : 'true'}" data-opt-row-id="${escapeHtmlAttr(id)}">
      <div class="settings-row-main">
        <div class="settings-drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="settings-inline-grid settings-inline-grid-compact" style="flex:1;">
          <div class="settings-pill-display settings-pill-emoji">${escapeHtml(optionItem.emoji || '📌')}</div>
          <div class="settings-pill-display">${escapeHtml(optionItem.label || '')}</div>
        </div>
        <div class="settings-row-actions">${optionActions}</div>
      </div>
      ${isEditing ? `
      <div class="settings-edit-panel">
        <div class="settings-inline-grid settings-inline-grid-expanded">
          <input class="form-input" data-edit-field="emoji" type="text" value="${escapeHtmlAttr(optionItem.emoji || '📌')}" placeholder="Emoji" />
          <input class="form-input" data-edit-field="key" type="text" value="${escapeHtmlAttr(optionItem.key || '')}" placeholder="Key" />
          <input class="form-input" data-edit-field="label" type="text" value="${escapeHtmlAttr(optionItem.label || '')}" placeholder="Label" />
        </div>
        ${optionEditActions}
      </div>
      ` : ''}
      ${!isEditing && Array.isArray(optionItem.values) ? `
      <div class="settings-options-panel">
        <div class="settings-options-label">Options</div>
        <div class="settings-options-grid">
          ${valuesHtml}
        </div>
        <div class="settings-options-add-row">
          <input class="form-input settings-option-emoji-input" data-add-value-emoji-input type="text" value="🙂" placeholder="🙂" />
          <input class="form-input settings-option-input" data-add-value-text-input type="text" placeholder="Option text..." />
          <button type="button" class="quick-chip settings-action-btn settings-option-add-btn" data-opt-action="add-value" data-opt-id="${escapeHtmlAttr(id)}">Add</button>
        </div>
      </div>
      ` : ''}
    </div>
  `;
}

export function renderOptionRows(
  rows: any[],
  editingOptionIds: Set<string>,
  pendingDeleteOptionIds: Set<string>,
  editingValueKeys: Set<string>,
  editingSubValueKeys: Set<string>
) {
  return rows
    .map((optionItem: any) => renderOptionRow(optionItem, editingOptionIds, pendingDeleteOptionIds, editingValueKeys, editingSubValueKeys))
    .join('');
}
