import {
  addTaskWithDate,
  toggleTask,
  updateTaskText,
  deleteTask,
  reorderTasksForDate,
  removeScheduledTask,
  CONFIG,
  STATE
} from '../modules/state';
import { events, EVENTS } from '../modules/events';

const editingTaskIds = new Set<string>();
const pendingDeleteTaskIds = new Set<string>();
let draggingTaskId = '';

export function initTasksScreen() {
  bindAddTask();
  bindTaskInteractions();

  events.on(EVENTS.STATE_READY, () => {
    renderTasks();
  });
  events.on(EVENTS.TASKS_UPDATED, () => {
    renderTasks();
  });
  events.on(EVENTS.CONFIG_UPDATED, () => {
    renderTasks();
  });

  renderTasks();
}

function bindAddTask() {
  const input = document.getElementById('task-input') as HTMLInputElement | null;
  const dateInput = document.getElementById('task-date-input') as HTMLInputElement | null;
  const btn = document.getElementById('add-task-btn') as HTMLButtonElement | null;

  const submit = () => {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    const dueDate = (dateInput?.value || STATE.date).trim();
    addTaskWithDate(text, dueDate);
    input.value = '';
    if (dateInput) dateInput.value = STATE.date;
  };

  if (btn) btn.addEventListener('click', submit);
  if (input) input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function bindTaskInteractions() {
  const list = document.getElementById('task-list');
  if (!list) return;

  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const actionEl = target.closest('[data-task-action]') as HTMLElement | null;
    if (actionEl) {
      const action = actionEl.getAttribute('data-task-action');
      const id = actionEl.getAttribute('data-task-id');
      if (!action || !id) return;

      if (action === 'toggle') {
        toggleTask(unescapeHtmlAttr(id));
        return;
      }

      if (action === 'edit') {
        const cleanId = unescapeHtmlAttr(id);
        if (editingTaskIds.has(cleanId)) {
          editingTaskIds.delete(cleanId);
          pendingDeleteTaskIds.delete(cleanId);
        } else {
          editingTaskIds.add(cleanId);
          pendingDeleteTaskIds.delete(cleanId);
        }
        renderTasks();
        return;
      }

      if (action === 'cancel') {
        const cleanId = unescapeHtmlAttr(id);
        editingTaskIds.delete(cleanId);
        pendingDeleteTaskIds.delete(cleanId);
        renderTasks();
        return;
      }

      if (action === 'save') {
        const cleanId = unescapeHtmlAttr(id);
        const row = actionEl.closest('[data-task-row-id]') as HTMLElement | null;
        const input = row?.querySelector('[data-task-edit-input]') as HTMLInputElement | null;
        const text = input?.value?.trim() || '';
        if (!text) return;
        editingTaskIds.delete(cleanId);
        pendingDeleteTaskIds.delete(cleanId);
        updateTaskText(cleanId, text);
        return;
      }

      if (action === 'del') {
        const cleanId = unescapeHtmlAttr(id);
        if (!pendingDeleteTaskIds.has(cleanId)) {
          pendingDeleteTaskIds.add(cleanId);
          renderTasks();
          return;
        }
        if (!window.confirm('Delete this task?')) return;
        pendingDeleteTaskIds.delete(cleanId);
        editingTaskIds.delete(cleanId);
        deleteTask(cleanId);
        return;
      }
    }

    const scheduledDel = target.closest('[data-scheduled-del]') as HTMLElement | null;
    if (scheduledDel) {
      e.stopPropagation();
      const id = scheduledDel.getAttribute('data-scheduled-del');
      if (id) removeScheduledTask(unescapeHtmlAttr(id));
    }
  });

  list.addEventListener('dragstart', (e) => {
    const row = (e.target as HTMLElement).closest('[data-task-row-id]') as HTMLElement | null;
    if (!row) return;
    const id = row.getAttribute('data-task-row-id') || '';
    const cleanId = unescapeHtmlAttr(id);
    if (!cleanId || editingTaskIds.has(cleanId)) return;

    draggingTaskId = cleanId;
    row.classList.add('task-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cleanId);
    }
  });

  list.addEventListener('dragend', (e) => {
    const row = (e.target as HTMLElement).closest('[data-task-row-id]') as HTMLElement | null;
    row?.classList.remove('task-dragging');
    list.querySelectorAll('.task-over').forEach((el) => el.classList.remove('task-over'));
    draggingTaskId = '';
  });

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('[data-task-row-id]') as HTMLElement | null;
    if (!row) return;
    list.querySelectorAll('.task-over').forEach((el) => el.classList.remove('task-over'));
    row.classList.add('task-over');
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    const row = (e.target as HTMLElement).closest('[data-task-row-id]') as HTMLElement | null;
    if (!row || !draggingTaskId) return;

    const targetId = unescapeHtmlAttr(row.getAttribute('data-task-row-id') || '');
    if (!targetId || targetId === draggingTaskId) return;

    const ids = Array.from(list.querySelectorAll('[data-task-row-id]'))
      .map((el) => unescapeHtmlAttr((el as HTMLElement).getAttribute('data-task-row-id') || ''))
      .filter(Boolean);

    const from = ids.indexOf(draggingTaskId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;

    const [item] = ids.splice(from, 1);
    ids.splice(to, 0, item);
    reorderTasksForDate(ids, STATE.date);
  });
}

function renderTasks() {
  const list = document.getElementById('task-list');
  const statTotal = document.getElementById('stat-total');
  const statDone = document.getElementById('stat-done');
  const statLeft = document.getElementById('stat-left');
  const dateInput = document.getElementById('task-date-input') as HTMLInputElement | null;

  if (dateInput && !dateInput.value) dateInput.value = STATE.date;

  const tasksToday = (STATE.tasks || []).filter(t => t.dueDate === STATE.date);
  const total = tasksToday.length;
  const done = tasksToday.filter(t => t.done).length;
  const left = total - done;

  if (statTotal) statTotal.textContent = String(total);
  if (statDone) statDone.textContent = String(done);
  if (statLeft) statLeft.textContent = String(left);

  if (!list) return;

  const scheduled = Array.isArray(CONFIG.scheduledTasks) ? CONFIG.scheduledTasks : [];
  if (tasksToday.length === 0 && scheduled.length === 0) {
    list.innerHTML = `<div style="font-size:12px; color: var(--text3); padding: 12px 0;">No tasks yet.</div>`;
    return;
  }

  const groups: Record<string, Array<{ type: 'today' | 'scheduled'; id: string; text: string; done?: boolean }>> = {};

  tasksToday.forEach((t) => {
    if (!groups[STATE.date]) groups[STATE.date] = [];
    groups[STATE.date].push({ type: 'today', id: t.id, text: t.text, done: t.done });
  });

  scheduled.forEach((t: any) => {
    if (!groups[t.dueDate]) groups[t.dueDate] = [];
    groups[t.dueDate].push({ type: 'scheduled', id: t.id, text: t.text });
  });

  const sortedDates = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  list.innerHTML = sortedDates.map((date) => {
    const label = date === STATE.date ? `Today · ${date}` : date;
    const rows = groups[date].map((t) => {
      if (t.type === 'today') {
        const cleanId = t.id;
        const isEditing = editingTaskIds.has(cleanId);
        const isDeletePending = pendingDeleteTaskIds.has(cleanId);
        return `
          <div class="task-item ${t.done ? 'done' : ''}" draggable="${isEditing ? 'false' : 'true'}" data-task-row-id="${escapeHtmlAttr(cleanId)}">
            <div class="task-drag-handle" title="Drag to reorder">↕</div>
            <button type="button" class="task-check" data-task-action="toggle" data-task-id="${escapeHtmlAttr(cleanId)}"></button>
            <div class="task-main" style="flex:1; min-width:0;">
              <div class="task-text">${escapeHtml(t.text)}</div>
              ${isEditing ? `
                <div class="task-edit-panel">
                  <input class="form-input" data-task-edit-input type="text" value="${escapeHtmlAttr(t.text)}" />
                  <div class="task-edit-actions">
                    <button type="button" class="quick-chip" data-task-action="save" data-task-id="${escapeHtmlAttr(cleanId)}" title="Save" aria-label="Save">✓</button>
                    <button type="button" class="quick-chip" data-task-action="cancel" data-task-id="${escapeHtmlAttr(cleanId)}" title="Cancel" aria-label="Cancel">✕</button>
                    <button type="button" class="quick-chip" data-task-action="del" data-task-id="${escapeHtmlAttr(cleanId)}" title="Delete" aria-label="Delete" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? '⚠' : '🗑'}</button>
                  </div>
                </div>
              ` : ''}
            </div>
            <div class="task-actions">
              <button type="button" class="quick-chip task-action-btn" data-task-action="edit" data-task-id="${escapeHtmlAttr(cleanId)}" title="Edit" aria-label="Edit">${isEditing ? '✓' : '<span class="task-edit-icon">✏</span>'}</button>
              ${!isEditing ? `<button type="button" class="quick-chip task-action-btn" data-task-action="del" data-task-id="${escapeHtmlAttr(cleanId)}" title="Delete" aria-label="Delete" style="${isDeletePending ? 'background: var(--rb); border-color: var(--rbr); color: var(--red);' : ''}">${isDeletePending ? '⚠' : '🗑'}</button>` : ''}
            </div>
          </div>
        `;
      }
      return `
        <div class="task-item" data-scheduled-id="${escapeHtmlAttr(t.id)}">
          <div class="task-check" style="border-color: var(--amber);"></div>
          <div class="task-text">📅 ${escapeHtml(t.text)}</div>
          <div class="tl-action-icon" style="position: static; margin-left: 8px;" data-scheduled-del="${escapeHtmlAttr(t.id)}">×</div>
        </div>
      `;
    }).join('');

    return `
      <div class="dist-card" style="margin-bottom:10px;">
        <div class="sec-label" style="margin-top:0; margin-bottom:8px;">${escapeHtml(label)}</div>
        <div data-task-group="${date === STATE.date ? 'today' : 'future'}">${rows}</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, ' ');
}

function unescapeHtmlAttr(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
