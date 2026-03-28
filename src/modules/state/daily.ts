import { events, EVENTS } from '../events';
import { loadDay, saveDay, listDayKeys, saveConfig } from '../db';

import { addScheduledTask, CONFIG } from './config';
import { APP_VERSION, DailyState, TaskItem, TimelineItem, ScheduledTask } from './types';

export let STATE: DailyState = {
  date: _getTodayStr(),
  intention: '',
  battery: 60,
  timeline: [],
  expenses: [],
  tasks: [],
  v: APP_VERSION
};

export let IS_HISTORY_VIEW = false;

function _createEmptyState(date: string): DailyState {
  return {
    date,
    intention: '',
    battery: 60,
    timeline: [],
    expenses: [],
    tasks: [],
    v: APP_VERSION
  };
}

function _normalizeTasksForCurrentDate() {
  let changed = false;
  const date = STATE.date;
  STATE.tasks = (STATE.tasks || [])
    .map((t: any) => {
      const normalized: TaskItem = {
        id: String(t.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
        text: String(t.text || '').trim(),
        done: Boolean(t.done),
        timestamp: Number.isFinite(t.timestamp) ? Number(t.timestamp) : Date.now(),
        dueDate: typeof t.dueDate === 'string' ? t.dueDate : date,
        source: t.source === 'default' || t.source === 'scheduled' ? t.source : 'manual',
        templateKey: typeof t.templateKey === 'string' ? t.templateKey : undefined
      };

      if (!t.id || !Number.isFinite(t.timestamp) || typeof t.dueDate !== 'string') changed = true;
      return normalized;
    })
    .filter((t) => t.text.length > 0);

  return changed;
}

function _materializeTasksForToday() {
  const today = STATE.date;
  const weekday = String(new Date(`${today}T00:00:00`).getDay());
  const defaults: string[] = CONFIG.taskDefaultsByWeekday?.[weekday] || [];
  let stateChanged = false;
  let configChanged = false;

  defaults.forEach((text: string) => {
    const clean = String(text || '').trim();
    if (!clean) return;
    const templateKey = `${weekday}:${clean.toLowerCase()}`;
    const exists = STATE.tasks.some((t) => t.templateKey === templateKey && t.dueDate === today);
    if (!exists) {
      STATE.tasks.push({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: clean,
        done: false,
        timestamp: Date.now(),
        dueDate: today,
        source: 'default',
        templateKey
      });
      stateChanged = true;
    }
  });

  const remaining: ScheduledTask[] = [];
  (CONFIG.scheduledTasks as ScheduledTask[]).forEach((task) => {
    if (task.dueDate === today) {
      const exists = STATE.tasks.some((t) => t.templateKey === `scheduled:${task.id}` || (t.text === task.text && t.dueDate === today));
      if (!exists) {
        STATE.tasks.push({
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          text: task.text,
          done: false,
          timestamp: Date.now(),
          dueDate: today,
          source: 'scheduled',
          templateKey: `scheduled:${task.id}`
        });
      }
      stateChanged = true;
      configChanged = true;
    } else {
      remaining.push(task);
    }
  });

  if (configChanged) {
    CONFIG.scheduledTasks = remaining;
    saveConfig(CONFIG);
  }

  return stateChanged;
}

export async function bootstrapToday() {
  const todayStr = _getTodayStr();
  console.log(`[STATE] Bootstrapping day: ${todayStr}`);
  IS_HISTORY_VIEW = false;

  try {
    const cloudState = await loadDay(todayStr);

    if (cloudState) {
      STATE = { ...STATE, ...cloudState, date: todayStr };
    } else {
      STATE = _createEmptyState(todayStr);
    }

    const normalizedChanged = _normalizeTasksForCurrentDate();
    const materializedChanged = _materializeTasksForToday();
    if (normalizedChanged || materializedChanged) {
      _triggerSync();
    }

    events.emit(EVENTS.STATE_READY, STATE);
    events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
    events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  } catch (err) {
    console.error('[STATE] Failed to bootstrap today:', err);
  }
}

export function resetToTodayLocal() {
  const todayStr = _getTodayStr();
  IS_HISTORY_VIEW = false;
  STATE = _createEmptyState(todayStr);
  _materializeTasksForToday();
  events.emit(EVENTS.STATE_READY, STATE);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
}

export async function loadHistoricalDay(dateStr: string) {
  if (!dateStr || typeof dateStr !== 'string') return false;

  try {
    const cloudState = await loadDay(dateStr);

    if (cloudState) {
      STATE = {
        ...STATE,
        ...cloudState,
        date: dateStr,
        timeline: Array.isArray(cloudState.timeline) ? cloudState.timeline : [],
        expenses: Array.isArray(cloudState.expenses) ? cloudState.expenses : [],
        tasks: Array.isArray(cloudState.tasks) ? cloudState.tasks : []
      };
    } else {
      STATE = _createEmptyState(dateStr);
    }

    IS_HISTORY_VIEW = true;
    events.emit(EVENTS.STATE_READY, STATE);
    events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
    events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
    return true;
  } catch (err) {
    console.error(`[STATE] Failed to load historical day ${dateStr}:`, err);
    return false;
  }
}

export async function getAvailableLogDates(): Promise<string[]> {
  const keys = await listDayKeys();
  const merged = new Set<string>(keys);
  if (STATE?.date) merged.add(STATE.date);
  merged.add(_getTodayStr());
  return Array.from(merged).sort();
}

function _triggerSync(forceImmediate: boolean = false) {
  saveDay(STATE.date, STATE, forceImmediate);
}

export function addTimelineLog(baseId: string, emoji: string, label: string, type: 'instant' | 'duration', isPanic: boolean = false) {
  const now = Date.now();

  if (type === 'duration') {
    const ongoing = STATE.timeline.find((t) => t.baseId === baseId && t.type === 'duration' && !t.endTime);

    if (ongoing) {
      ongoing.endTime = now;
      if (label && label !== ongoing.label) {
        ongoing.label = label;
      }
      events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
      _triggerSync();
      return;
    }
  }

  const newItem: TimelineItem = {
    id: `tl_${now}`,
    baseId,
    emoji,
    label,
    type,
    startTime: now,
    endTime: type === 'duration' ? null : now,
    createdAt: now,
    isPanic
  };

  STATE.timeline.push(newItem);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  _triggerSync();
}

export function updateTimelineLabel(id: string, suffix: string) {
  const item = STATE.timeline.find((t) => t.id === id);
  if (item) {
    item.label += suffix;
    events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
    _triggerSync();
  }
}

export function deleteTimelineLog(id: string) {
  STATE.timeline = STATE.timeline.filter((t) => t.id !== id);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  _triggerSync(true);
}

export function setIntention(text: string) {
  STATE.intention = text;
  _triggerSync();
}

export function setBattery(level: number) {
  STATE.battery = level;
  _triggerSync();
}

export function hasStartedDayData(): boolean {
  const hasTimeline = Array.isArray(STATE.timeline) && STATE.timeline.length > 0;
  const hasExpenses = Array.isArray(STATE.expenses) && STATE.expenses.length > 0;
  const hasTaskProgress = Array.isArray(STATE.tasks) && STATE.tasks.some((t) => Boolean(t.done));
  return hasTimeline || hasExpenses || hasTaskProgress;
}

export function resetForStartDay(intention: string) {
  if (hasStartedDayData()) {
    return;
  }

  STATE.timeline = [];
  STATE.expenses = [];
  STATE.tasks = [];
  STATE.battery = 60;
  STATE.intention = intention;
  _materializeTasksForToday();

  events.emit(EVENTS.STATE_READY, STATE);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync(true);
}

export function clearAllLogs() {
  STATE.timeline = [];
  STATE.expenses = [];
  STATE.tasks = [];

  events.emit(EVENTS.STATE_READY, STATE);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync(true);
}

export function addExpense(amount: number, note: string, category: string) {
  STATE.expenses.push({ id: `exp_${Date.now()}`, amount, note, category, timestamp: Date.now() });
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  _triggerSync();
}

export function deleteExpense(id: string) {
  STATE.expenses = STATE.expenses.filter((e) => e.id !== id);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  _triggerSync(true);
}

export function addTask(text: string) {
  addTaskWithDate(text, STATE.date);
}

export function addTaskWithDate(text: string, dueDate: string, source: 'manual' | 'default' | 'scheduled' = 'manual') {
  const clean = (text || '').trim();
  if (!clean) return;

  if (dueDate === STATE.date) {
    STATE.tasks.push({ id: `task_${Date.now()}`, text: clean, done: false, timestamp: Date.now(), dueDate, source });
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
    _triggerSync();
    return;
  }

  addScheduledTask(clean, dueDate);
}

export function toggleTask(id: string) {
  const task = STATE.tasks.find((t) => t.id === id);
  if (task) {
    task.done = !task.done;
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
    _triggerSync(true);
  }
}

export function updateTaskText(id: string, text: string) {
  const clean = (text || '').trim();
  if (!clean) return;

  const task = STATE.tasks.find((t) => t.id === id);
  if (!task) return;

  task.text = clean;
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync(true);
}

export function deleteTask(id: string) {
  const before = STATE.tasks.length;
  STATE.tasks = STATE.tasks.filter((t) => t.id !== id);
  if (STATE.tasks.length === before) return;

  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync(true);
}

export function reorderTasksForDate(ids: string[], dueDate: string = STATE.date) {
  if (!Array.isArray(ids) || ids.length === 0) return;

  const dateTasks = STATE.tasks.filter((t) => t.dueDate === dueDate);
  if (dateTasks.length <= 1) return;

  const byId = new Map(dateTasks.map((t) => [t.id, t]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as TaskItem[];
  if (ordered.length === 0) return;

  const seen = new Set(ordered.map((t) => t.id));
  const leftovers = dateTasks.filter((t) => !seen.has(t.id));
  const nextForDate = [...ordered, ...leftovers];

  let cursor = 0;
  STATE.tasks = STATE.tasks.map((t) => {
    if (t.dueDate !== dueDate) return t;
    const next = nextForDate[cursor];
    cursor += 1;
    return next || t;
  });

  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync(true);
}

export function _getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}