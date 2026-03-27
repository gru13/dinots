import { CONFIG, addActivity, updateActivity, removeActivity, reorderActivities } from '../../modules/state';
import { escapeHtml, escapeHtmlAttr, getPickerColor, getDisplayColor } from './utils';

let draggingActivityId = '';
const editingActivityIds = new Set<string>();
const pendingDeleteActivityIds = new Set<string>();
const IMMUTABLE_ACTIVITY_IDS = new Set(['wake', 'sleep']);

export function bindActivityManager() {
  const detailsEl = document.getElementById('settings-activity-details') as HTMLDetailsElement | null;
  const addPanelEl = document.getElementById('settings-activity-add-panel') as HTMLElement | null;
  const toggleAddBtn = document.getElementById('settings-activity-toggle-add');
  const cancelAddBtn = document.getElementById('settings-activity-add-cancel');
  const emojiEl = document.getElementById('settings-activity-emoji') as HTMLInputElement | null;
  const labelEl = document.getElementById('settings-activity-label') as HTMLInputElement | null;
  const typeEl = document.getElementById('settings-activity-type') as HTMLSelectElement | null;
  const optionsTypeEl = document.getElementById('settings-activity-options-type') as HTMLSelectElement | null;
  const optionsKeyEl = document.getElementById('settings-activity-options-key') as HTMLInputElement | null;
  const addBtn = document.getElementById('settings-activity-add');
  const listWrap = document.getElementById('settings-activity-list');

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
    addActivity({
      emoji: (emojiEl?.value || '🧩').trim(),
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
    const actionEl = target.closest('[data-act-action]') as HTMLElement | null;
    const id = actionEl?.getAttribute('data-act-id');
    const action = actionEl?.getAttribute('data-act-action');
    if (!id || !action) return;

    const locked = IMMUTABLE_ACTIVITY_IDS.has(id);

    if (action === 'del') {
      if (locked) return;
      if (!pendingDeleteActivityIds.has(id)) {
        pendingDeleteActivityIds.add(id);
        renderActivityManager();
        return;
      }
      if (!window.confirm('Delete this log item?')) return;
      removeActivity(id);
      pendingDeleteActivityIds.delete(id);
      editingActivityIds.delete(id);
      return;
    }
    if (action === 'edit') {
      if (locked) return;
      if (editingActivityIds.has(id)) {
        editingActivityIds.delete(id);
        pendingDeleteActivityIds.delete(id);
      } else {
        editingActivityIds.add(id);
        pendingDeleteActivityIds.delete(id);
      }
      renderActivityManager();
      return;
    }
    if (action === 'cancel') {
      editingActivityIds.delete(id);
      pendingDeleteActivityIds.delete(id);
      renderActivityManager();
      return;
    }
    if (action === 'save') {
      if (locked || !editingActivityIds.has(id)) return;
      const row = actionEl?.closest('[data-act-row-id]') as HTMLElement | null;
      if (!row) return;

      const emoji = (row.querySelector('[data-edit-field="emoji"]') as HTMLInputElement | null)?.value ?? '';
      const label = (row.querySelector('[data-edit-field="label"]') as HTMLInputElement | null)?.value ?? '';
      const type = (row.querySelector('[data-edit-field="type"]') as HTMLSelectElement | null)?.value as 'instant' | 'duration';
      const color = (row.querySelector('[data-edit-field="color"]') as HTMLInputElement | null)?.value ?? '';
      const actionText = (row.querySelector('[data-edit-field="actionText"]') as HTMLInputElement | null)?.value ?? '';
      const optionsType = (row.querySelector('[data-edit-field="optionsType"]') as HTMLSelectElement | null)?.value as 'start' | 'end' | 'instant' | '';
      const optionsKey = (row.querySelector('[data-edit-field="optionsKey"]') as HTMLInputElement | null)?.value ?? '';

      editingActivityIds.delete(id);
      pendingDeleteActivityIds.delete(id);
      updateActivity(id, { emoji, label, type, color, actionText, optionsType, optionsKey });
      return;
    }
  });

  listWrap?.addEventListener('dragstart', (e) => {
    const row = (e.target as HTMLElement).closest('[data-act-row-id]') as HTMLElement | null;
    if (!row) return;
    if (row.getAttribute('data-act-locked') === '1') return;
    draggingActivityId = row.getAttribute('data-act-row-id') || '';
    row.classList.add('settings-draggable-row-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingActivityId);
    }
  });

  listWrap?.addEventListener('dragend', (e) => {
    const row = (e.target as HTMLElement).closest('[data-act-row-id]') as HTMLElement | null;
    row?.classList.remove('settings-draggable-row-dragging');
    draggingActivityId = '';
  });

  listWrap?.addEventListener('dragover', (e) => {
    e.preventDefault();
    const targetRow = (e.target as HTMLElement).closest('[data-act-row-id]') as HTMLElement | null;
    if (!targetRow) return;
    targetRow.classList.add('settings-draggable-row-over');
  });

  listWrap?.addEventListener('dragleave', (e) => {
    const targetRow = (e.target as HTMLElement).closest('[data-act-row-id]') as HTMLElement | null;
    targetRow?.classList.remove('settings-draggable-row-over');
  });

  listWrap?.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetRow = (e.target as HTMLElement).closest('[data-act-row-id]') as HTMLElement | null;
    if (!targetRow || !draggingActivityId) return;
    if (targetRow.getAttribute('data-act-locked') === '1') return;
    targetRow.classList.remove('settings-draggable-row-over');

    const targetId = targetRow.getAttribute('data-act-row-id') || '';
    if (!targetId || targetId === draggingActivityId) return;

    const current = Array.isArray(CONFIG.activities) ? [...CONFIG.activities] : [];
    const from = current.findIndex((a: any) => a.id === draggingActivityId);
    const to = current.findIndex((a: any) => a.id === targetId);
    if (from < 0 || to < 0) return;

    const [item] = current.splice(from, 1);
    current.splice(to, 0, item);
    reorderActivities(current.map((a: any) => a.id));
  });
}

export function renderActivityManager() {
  const wrap = document.getElementById('settings-activity-list');
  if (!wrap) return;
  const rows = Array.isArray(CONFIG.activities) ? CONFIG.activities : [];
  const renderRow = (a: any) => {
    const id = String(a.id || '');
    const locked = IMMUTABLE_ACTIVITY_IDS.has(id);
    const isEditing = editingActivityIds.has(id) && !locked;
    const colorValue = getPickerColor(a.color);
    const safeColor = getDisplayColor(a.color);
    const isDeletePending = pendingDeleteActivityIds.has(id);
    const actionsHtml = locked
      ? `<span class="quick-chip" style="opacity:.7; cursor:default;">Locked</span>`
      : isEditing
        ? `<span class="quick-chip" style="opacity:.85; cursor:default;">Editing</span>`
        : `
          <button class="quick-chip settings-action-btn settings-action-edit settings-action-icon-btn" title="Edit" aria-label="Edit" data-act-action="edit" data-act-id="${escapeHtmlAttr(id)}"><span class="settings-edit-icon">✏</span></button>
          <button class="quick-chip settings-action-btn settings-action-delete settings-action-icon-btn" title="Delete" aria-label="Delete" data-act-action="del" data-act-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? '⚠' : '🗑'}</button>
        `;

    const editActionsHtml = isEditing
      ? `
        <div class="settings-edit-actions">
          <button class="quick-chip settings-action-btn settings-action-save" data-act-action="save" data-act-id="${escapeHtmlAttr(id)}">✓ Save</button>
          <button class="quick-chip settings-action-btn settings-action-cancel" data-act-action="cancel" data-act-id="${escapeHtmlAttr(id)}">↺ Cancel</button>
          <button class="quick-chip settings-action-btn settings-action-delete" data-act-action="del" data-act-id="${escapeHtmlAttr(id)}" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? 'Confirm Delete' : '🗑 Delete'}</button>
        </div>
      `
      : '';

    return `
    <div class="settings-draggable-row" style="border-color:${escapeHtmlAttr(safeColor)};" draggable="${locked || isEditing ? 'false' : 'true'}" data-act-locked="${locked ? '1' : '0'}" data-act-row-id="${escapeHtmlAttr(id)}">
      <div class="settings-row-main">
        <div class="settings-drag-handle" title="Drag to reorder">↕</div>
        <div class="settings-inline-grid settings-inline-grid-compact" style="flex:1;">
          <div class="settings-pill-display settings-pill-emoji">${escapeHtml(a.emoji || '🧩')}</div>
          <div class="settings-pill-display">${escapeHtml(a.label || '')}</div>
        </div>
        <div class="settings-row-actions">${actionsHtml}</div>
      </div>
      ${isEditing ? `
      <div class="settings-edit-panel">
        <div class="settings-inline-grid settings-inline-grid-expanded">
          <input class="form-input" data-edit-field="emoji" type="text" value="${escapeHtmlAttr(a.emoji || '🧩')}" placeholder="Emoji" />
          <input class="form-input" data-edit-field="label" type="text" value="${escapeHtmlAttr(a.label || '')}" placeholder="Label" />
          <select class="form-input" data-edit-field="type" style="max-width:120px;">
            <option value="instant" ${a.type === 'instant' ? 'selected' : ''}>Instant</option>
            <option value="duration" ${a.type === 'duration' ? 'selected' : ''}>Duration</option>
          </select>
          <input class="form-input settings-color-field" data-edit-field="color" type="color" value="${escapeHtmlAttr(colorValue)}" title="Pick color" />
          <input class="form-input" data-edit-field="actionText" type="text" value="${escapeHtmlAttr(a.actionText || '')}" placeholder="Action text (optional)" />
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
