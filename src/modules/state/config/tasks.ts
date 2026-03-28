import type { ScheduledTask } from '../types';

import { CONFIG, markSectionCustomized, emitConfigUpdated, persistConfig } from './store';

export function addTaskDefault(weekday: string, text: string) {
  const key = String(weekday);
  const clean = (text || '').trim();
  if (!clean || Number.isNaN(Number(key)) || Number(key) < 0 || Number(key) > 6) return;

  if (!Array.isArray(CONFIG.taskDefaultsByWeekday[key])) {
    CONFIG.taskDefaultsByWeekday[key] = [];
  }

  const exists = CONFIG.taskDefaultsByWeekday[key].some((t: string) => t.toLowerCase() === clean.toLowerCase());
  if (!exists) {
    CONFIG.taskDefaultsByWeekday[key].unshift(clean);
    markSectionCustomized('taskDefaultsByWeekday');
    emitConfigUpdated();
    persistConfig();
  }
}

export function removeTaskDefault(weekday: string, text: string) {
  const key = String(weekday);
  if (!Array.isArray(CONFIG.taskDefaultsByWeekday?.[key])) return;
  CONFIG.taskDefaultsByWeekday[key] = CONFIG.taskDefaultsByWeekday[key].filter((t: string) => t !== text);
  markSectionCustomized('taskDefaultsByWeekday');
  emitConfigUpdated();
  persistConfig();
}

export function applyTaskDefaultsPreset(mode: 'workweek' | 'fullweek') {
  const preset: Record<string, string[]> = mode === 'workweek'
    ? {
        '1': ['🗂️ Plan top 3 outcomes', '📚 Learn 30 mins'],
        '2': ['💧 Hydrate check', '🏃 Move body 20 mins'],
        '3': ['🧠 Deep work block', '🧾 Expense check'],
        '4': ['📞 Relationship check-in', '📚 Read 20 mins'],
        '5': ['📅 Weekly review', '🧹 Inbox zero 10 mins'],
        '0': [],
        '6': []
      }
    : {
        '0': ['🧹 Weekly reset', '🧠 Reflection 15 mins'],
        '1': ['🗂️ Plan top 3 outcomes', '📚 Learn 30 mins'],
        '2': ['💧 Hydrate check', '🏃 Move body 20 mins'],
        '3': ['🧠 Deep work block', '🧾 Expense check'],
        '4': ['📞 Relationship check-in', '📚 Read 20 mins'],
        '5': ['📅 Weekly review', '🧹 Inbox zero 10 mins'],
        '6': ['🛒 Life admin', '🌿 Long walk']
      };

  if (!CONFIG.taskDefaultsByWeekday || typeof CONFIG.taskDefaultsByWeekday !== 'object') {
    CONFIG.taskDefaultsByWeekday = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  }

  for (let i = 0; i < 7; i++) {
    const key = String(i);
    if (!Array.isArray(CONFIG.taskDefaultsByWeekday[key])) CONFIG.taskDefaultsByWeekday[key] = [];
  }

  Object.keys(preset).forEach((key) => {
    const existing = new Set((CONFIG.taskDefaultsByWeekday[key] || []).map((t: string) => t.toLowerCase()));
    preset[key].forEach((task) => {
      if (!existing.has(task.toLowerCase())) {
        CONFIG.taskDefaultsByWeekday[key].push(task);
        existing.add(task.toLowerCase());
      }
    });
  });

  markSectionCustomized('taskDefaultsByWeekday');
  emitConfigUpdated();
  persistConfig();
}

export function clearTaskDefaultsAll() {
  CONFIG.taskDefaultsByWeekday = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  markSectionCustomized('taskDefaultsByWeekday');
  emitConfigUpdated();
  persistConfig();
}

export function addScheduledTask(text: string, dueDate: string): string {
  const clean = (text || '').trim();
  if (!clean || !dueDate) return '';

  const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (!Array.isArray(CONFIG.scheduledTasks)) CONFIG.scheduledTasks = [];
  CONFIG.scheduledTasks.unshift({ id, text: clean, dueDate, createdAt: Date.now() });
  emitConfigUpdated();
  persistConfig();
  return id;
}

export function removeScheduledTask(id: string) {
  if (!Array.isArray(CONFIG.scheduledTasks)) return;
  CONFIG.scheduledTasks = CONFIG.scheduledTasks.filter((t: ScheduledTask) => t.id !== id);
  emitConfigUpdated();
  persistConfig();
}