import { addTask, toggleTask, STATE } from '../modules/state';
import { events, EVENTS } from '../modules/events';

export function initTasksScreen() {
  bindAddTask();

  events.on(EVENTS.STATE_READY, () => {
    renderTasks();
  });
  events.on(EVENTS.TASKS_UPDATED, () => {
    renderTasks();
  });

  renderTasks();
}

function bindAddTask() {
  const input = document.getElementById('task-input') as HTMLInputElement | null;
  const btn = document.getElementById('add-task-btn') as HTMLButtonElement | null;

  const submit = () => {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    addTask(text);
    input.value = '';
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

  const tasks = STATE.tasks || [];
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const left = total - done;

  if (statTotal) statTotal.textContent = String(total);
  if (statDone) statDone.textContent = String(done);
  if (statLeft) statLeft.textContent = String(left);

  if (!list) return;

  if (tasks.length === 0) {
    list.innerHTML = `<div style="font-size:12px; color: var(--text3); padding: 12px 0;">No tasks yet.</div>`;
    return;
  }

  const sorted = [...tasks].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  list.innerHTML = sorted.map(t => {
    return `
      <div class="task-item ${t.done ? 'done' : ''}" data-task-id="${escapeHtmlAttr(t.id)}">
        <div class="task-check"></div>
        <div class="task-text">${escapeHtml(t.text)}</div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-task-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).getAttribute('data-task-id');
      if (id) toggleTask(unescapeHtmlAttr(id));
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
