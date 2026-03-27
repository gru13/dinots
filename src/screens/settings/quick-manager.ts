import { CONFIG, addQuickAction, updateQuickAction, removeQuickAction, reorderQuickActions } from '../../modules/state';
import { escapeHtml, escapeHtmlAttr, getPickerColor, getDisplayColor } from './utils';

let draggingQuickId = '';
const editingQuickIds = new Set<string>();
const pendingDeleteQuickIds = new Set<string>();

export function bindQuickManager() {
  const detailsEl = document.getElementById('settings-quick-details') as HTMLDetailsElement | null;
  const addPanelEl = document.getElementById('settings-quick-add-panel') as HTMLElement | null;
  const toggleAddBtn = document.getElementById('settings-quick-toggle-add');
  const cancelAddBtn = document.getElementById('settings-quick-add-cancel');
  const emojiEl = document.getElementById('settings-quick-emoji') as HTMLInputElement | null;
  const labelEl = document.getElementById('settings-quick-label') as HTMLInputElement | null;
  const typeEl = document.getElementById('settings-quick-type') as HTMLSelectElement | null;
  const optionsTypeEl = document.getElementById('settings-quick-options-type') as HTMLSelectElement | null;
  const optionsKeyEl = document.getElementById('settings-quick-options-key') as HTMLInputElement | null;
  const addBtn = document.getElementById('settings-quick-add');
  const listWrap = document.getElementById('settings-quick-list');

  const toggleAddPanel = () => {
    if (!addPanelEl) return;
    const shouldOpen = addPanelEl.style.display === 'none' || !addPanelEl.style.display;
    addPanelEl.style.display = shouldOpen ? 'flex' : 'none';
    if (shouldOpen && detailsEl && !detailsEl.open) detailsEl.open = true;
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

  const submit = () => {
    const label = (labelEl?.value || '').trim();
    if (!label) return;
    addQuickAction({
      emoji: (emojiEl?.value || '⚡').trim(),
      label,
      type: ((typeEl?.value as any) || 'instant'),
      ...(optionsTypeEl?.value ? { optionsType: optionsTypeEl.value as 'start' | 'end' | 'instant' } : {}),
      ...(optionsKeyEl?.value?.trim() ? { optionsKey: optionsKeyEl.value.trim() } : {})
    });
    if (labelEl) labelEl.value = '';
    if (optionsTypeEl) optionsTypeEl.value = '';
    if (optionsKeyEl) optionsKeyEl.value = '';
    if (addPanelEl) addPanelEl.style.display = 'none';
  };

  addBtn?.addEventListener('click', submit);
  labelEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });

  listWrap?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest('[data-qa-action]') as HTMLElement | null;
    const id = actionEl?.getAttribute('data-qa-id');
    const action = actionEl?.getAttribute('data-qa-action');
    if (!id || !action) return;

    if (action === 'del') {
      if (!pendingDeleteQuickIds.has(id)) {
        pendingDeleteQuickIds.add(id);
        renderQuickManager();
        return;
      }
      if (!window.confirm('Delete this quick item?')) return;
      removeQuickAction(id);
      pendingDeleteQuickIds.delete(id);
      editingQuickIds.delete(id);
      return;
    }
    if (action === 'edit') {
      if (editingQuickIds.has(id)) {
        editingQuickIds.delete(id);
        pendingDeleteQuickIds.delete(id);
      } else {
        editingQuickIds.add(id);
        pendingDeleteQuickIds.delete(id);
      }
      renderQuickManager();
      return;
    }
    if (action === 'cancel') {
      editingQuickIds.delete(id);
      pendingDeleteQuickIds.delete(id);
      renderQuickManager();
      return;
    }
    if (action === 'save') {
      if (!editingQuickIds.has(id)) return;
      const row = actionEl?.closest('[data-qa-row-id]') as HTMLElement | null;
      if (!row) return;

      const emoji = (row.querySelector('[data-edit-field="emoji"]') as HTMLInputElement | null)?.value ?? '';
      const label = (row.querySelector('[data-edit-field="label"]') as HTMLInputElement | null)?.value ?? '';
      const type = (row.querySelector('[data-edit-field="type"]') as HTMLSelectElement | null)?.value as 'instant' | 'duration';
      const color = (row.querySelector('[data-edit-field="color"]') as HTMLInputElement | null)?.value ?? '';
      const optionsType = (row.querySelector('[data-edit-field="optionsType"]') as HTMLSelectElement | null)?.value as 'start' | 'end' | 'instant' | '';
      const optionsKey = (row.querySelector('[data-edit-field="optionsKey"]') as HTMLInputElement | null)?.value ?? '';

      editingQuickIds.delete(id);
      pendingDeleteQuickIds.delete(id);
      updateQuickAction(id, { emoji, label, type, color, optionsType, optionsKey });
      return;
    }
  });

  listWrap?.addEventListener('dragstart', (e) => {
    const row = (e.target as HTMLElement).closest('[data-qa-row-id]') as HTMLElement | null;
    if (!row) return;
    draggingQuickId = row.getAttribute('data-qa-row-id') || '';
    row.classList.add('settings-draggable-row-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingQuickId);
    }
  });

  listWrap?.addEventListener('dragend', (e) => {
    const row = (e.target as HTMLElement).closest('[data-qa-row-id]') as HTMLElement | null;
    row?.classList.remove('settings-draggable-row-dragging');
    draggingQuickId = '';
  });

  listWrap?.addEventListener('dragover', (e) => {
    e.preventDefault();
    const targetRow = (e.target as HTMLElement).closest('[data-qa-row-id]') as HTMLElement | null;
    if (!targetRow) return;
    targetRow.classList.add('settings-draggable-row-over');
  });

  listWrap?.addEventListener('dragleave', (e) => {
    const targetRow = (e.target as HTMLElement).closest('[data-qa-row-id]') as HTMLElement | null;
    targetRow?.classList.remove('settings-draggable-row-over');
  });

  listWrap?.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetRow = (e.target as HTMLElement).closest('[data-qa-row-id]') as HTMLElement | null;
    if (!targetRow || !draggingQuickId) return;
    targetRow.classList.remove('settings-draggable-row-over');

    const targetId = targetRow.getAttribute('data-qa-row-id') || '';
    if (!targetId || targetId === draggingQuickId) return;

    const current = Array.isArray(CONFIG.quickActions) ? [...CONFIG.quickActions] : [];
    const from = current.findIndex((a: any) => a.id === draggingQuickId);
    const to = current.findIndex((a: any) => a.id === targetId);
    if (from < 0 || to < 0) return;

    const [item] = current.splice(from, 1);
    current.splice(to, 0, item);
    reorderQuickActions(current.map((a: any) => a.id));
  });
}

export function renderQuickManager() {
  const wrap = document.getElementById('settings-quick-list');
  if (!wrap) return;
  const rows = Array.isArray(CONFIG.quickActions) ? CONFIG.quickActions : [];
  const renderRow = (a: any) => {
    const id = String(a.id || '');
    const isEditing = editingQuickIds.has(id);
    const colorValue = getPickerColor(a.color);
    const safeColor = getDisplayColor(a.color);
    const isDeletePending = pendingDeleteQuickIds.has(id);
    const actionsHtml = isEditing
      ? `<span class="quick-chip" style="opacity:.85; cursor:default;">Editing</span>`
      : `
        <button class="quick-chip settings-action-btn settings-action-edit settings-action-icon-btn" title="Edit" aria-label="Edit" data-qa-action="edit" data-qa-id="${escapeHtmlAttr(id)}"><span class="settings-edit-icon">✏</span></button>
        <button class="quick-chip settings-action-btn settings-action-delete settings-action-icon-btn" title="Delete" aria-label="Delete" data-qa-action="del" data-qa-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? '⚠' : '🗑'}</button>
      `;

    const editActionsHtml = isEditing
      ? `
        <div class="settings-edit-actions">
          <button class="quick-chip settings-action-btn settings-action-save" data-qa-action="save" data-qa-id="${escapeHtmlAttr(id)}">✓ Save</button>
          <button class="quick-chip settings-action-btn settings-action-cancel" data-qa-action="cancel" data-qa-id="${escapeHtmlAttr(id)}">↺ Cancel</button>
          <button class="quick-chip settings-action-btn settings-action-delete" data-qa-action="del" data-qa-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? 'Confirm Delete' : '🗑 Delete'}</button>
        </div>
      `
      : '';

    return `
    <div class="settings-draggable-row" style="border-color:${escapeHtmlAttr(safeColor)};" draggable="${isEditing ? 'false' : 'true'}" data-qa-row-id="${escapeHtmlAttr(id)}">
      <div class="settings-row-main">
        <div class="settings-drag-handle" title="Drag to reorder">↕</div>
        <div class="settings-inline-grid settings-inline-grid-compact" style="flex:1;">
          <div class="settings-pill-display settings-pill-emoji">${escapeHtml(a.emoji || '⚡')}</div>
          <div class="settings-pill-display">${escapeHtml(a.label || '')}</div>
        </div>
        <div class="settings-row-actions">${actionsHtml}</div>
      </div>
      ${isEditing ? `
      <div class="settings-edit-panel">
        <div class="settings-inline-grid settings-inline-grid-expanded-quick">
          <input class="form-input" data-edit-field="emoji" type="text" value="${escapeHtmlAttr(a.emoji || '⚡')}" placeholder="Emoji" />
          <input class="form-input" data-edit-field="label" type="text" value="${escapeHtmlAttr(a.label || '')}" placeholder="Label" />
          <select class="form-input" data-edit-field="type" style="max-width:120px;">
            <option value="instant" ${a.type === 'instant' ? 'selected' : ''}>Instant</option>
            <option value="duration" ${a.type === 'duration' ? 'selected' : ''}>Duration</option>
          </select>
          <input class="form-input settings-color-field" data-edit-field="color" type="color" value="${escapeHtmlAttr(colorValue)}" title="Pick color" />
          <select class="form-input" data-edit-field="optionsType">
            <option value="" ${!a.optionsType ? 'selected' : ''}>No options type</option>
            <option value="start" ${a.optionsType === 'start' ? 'selected' : ''}>start</option>
            <option value="end" ${a.optionsType === 'end' ? 'selected' : ''}>end</option>
            <option value="instant" ${a.optionsType === 'instant' ? 'selected' : ''}>instant</option>
          </select>
          <input class="form-input" data-edit-field="optionsKey" type="text" value="${escapeHtmlAttr(a.optionsKey || '')}" placeholder="Options key (optional)" />
        </div>
        ${editActionsHtml}
      </div>
      ` : ''}
    </div>
  `;
  };
  wrap.innerHTML = rows.map(renderRow).join('');
}
