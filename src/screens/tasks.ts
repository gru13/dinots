import { addTaskWithDate, toggleTask, removeScheduledTask, CONFIG, STATE } from '../modules/state';
import { events, EVENTS } from '../modules/events';

export function initTasksScreen() {
  bindAddTask();

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
        return `
          <div class="task-item ${t.done ? 'done' : ''}" data-task-id="${escapeHtmlAttr(t.id)}">
            <div class="task-check"></div>
            <div class="task-text">${escapeHtml(t.text)}</div>
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
        ${rows}
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-task-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).getAttribute('data-task-id');
      if (id) toggleTask(unescapeHtmlAttr(id));
    });
  });

  list.querySelectorAll('[data-scheduled-del]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (el as HTMLElement).getAttribute('data-scheduled-del');
      if (id) removeScheduledTask(unescapeHtmlAttr(id));
    });
  });
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
