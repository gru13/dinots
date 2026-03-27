import { events, EVENTS } from './events';
import { loadDay, saveDay, loadConfig, saveConfig } from './db';
import { DEFAULT_CONFIG } from '../config';

const APP_VERSION = 'v1.0.0-beta';

// ═══════════════════════════════════════════════
// TYPES & SCHEMAS
// ═══════════════════════════════════════════════

export let CONFIG: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

function normalizePanicTriggers(triggerList: any): { triggers: string[]; changed: boolean } {
  const fallback = ['😵 Procrastination', '😰 Stress', '🥱 Boredom', '😴 Tiredness', '🙈 Avoidance', '🫨 Anxiety'];
  if (!Array.isArray(triggerList) || triggerList.length === 0) {
    return { triggers: fallback, changed: true };
  }

  const emojiMap: Record<string, string> = {
    procrastination: '😵 Procrastination',
    stress: '😰 Stress',
    boredom: '🥱 Boredom',
    tiredness: '😴 Tiredness',
    avoidance: '🙈 Avoidance',
    anxiety: '🫨 Anxiety'
  };

  let changed = false;
  const seen = new Set<string>();
  const normalized: string[] = [];

  triggerList.forEach((entry: any) => {
    if (typeof entry !== 'string') return;
    const trimmed = entry.trim();
    if (!trimmed) return;

    // Remove leading emoji/symbols so legacy and emoji labels dedupe together.
    const plain = trimmed.replace(/^[^A-Za-z]+\s*/u, '').trim();
    const key = plain.toLowerCase();
    const mapped = emojiMap[key] || trimmed;
    const dedupeKey = mapped.toLowerCase();

    if (mapped !== trimmed) changed = true;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      normalized.push(mapped);
    } else {
      changed = true;
    }
  });

  if (normalized.length === 0) {
    return { triggers: fallback, changed: true };
  }

  return { triggers: normalized, changed };
}

function normalizeTaskPlannerConfig(): boolean {
  let changed = false;

  if (!CONFIG.taskDefaultsByWeekday || typeof CONFIG.taskDefaultsByWeekday !== 'object') {
    CONFIG.taskDefaultsByWeekday = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
    changed = true;
  }

  for (let i = 0; i < 7; i++) {
    const key = String(i);
    if (!Array.isArray(CONFIG.taskDefaultsByWeekday[key])) {
      CONFIG.taskDefaultsByWeekday[key] = [];
      changed = true;
    }
  }

  if (!Array.isArray(CONFIG.scheduledTasks)) {
    CONFIG.scheduledTasks = [];
    changed = true;
  }

  CONFIG.scheduledTasks = CONFIG.scheduledTasks
    .filter((t: any) => t && typeof t.text === 'string' && typeof t.dueDate === 'string')
    .map((t: any) => {
      const normalized = {
        id: String(t.id || `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
        text: String(t.text).trim(),
        dueDate: String(t.dueDate),
        createdAt: Number.isFinite(t.createdAt) ? Number(t.createdAt) : Date.now()
      };
      if (!t.id || !Number.isFinite(t.createdAt)) changed = true;
      return normalized;
    })
    .filter((t: any) => t.text.length > 0);

  return changed;
}

function applyThemeVariables(theme: any) {
  if (!theme) return;
  for (const key in theme) {
    if (key === 'radius') document.documentElement.style.setProperty('--r', theme[key]);
    else document.documentElement.style.setProperty(`--${key}`, theme[key]);
  }
}

export async function bootstrapConfig() {
  try {
    const cloudConfig = await loadConfig();
    let configChanged = false;

    if (cloudConfig) {
      CONFIG = { ...CONFIG, ...cloudConfig };
      console.log('[STATE] Merged remote User Config.');
    } else {
      console.log('[STATE] No remote config found. Using defaults.');
      configChanged = true;
    }

    const normalized = normalizePanicTriggers(CONFIG.panicTriggers);
    CONFIG.panicTriggers = normalized.triggers;
    if (normalized.changed) configChanged = true;

    if (normalizeTaskPlannerConfig()) configChanged = true;

    if (configChanged) {
      // Save normalized/default config so cloud config is always consistent.
      saveConfig(CONFIG);
    }
  } catch (err) {
    console.error('[STATE] Failed to bootstrap config:', err);
  } finally {
    // Apply dynamic theming
    applyThemeVariables(CONFIG.theme || DEFAULT_CONFIG.theme);
  }
}

export function addCustomQuickAction(label: string, emoji: string, type: 'instant' | 'duration'): string {
  const id = 'qa_' + Date.now();
  CONFIG.quickActions.unshift({ id, emoji, label, type });
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return id;
}

export function addActivity(activity: {
  id?: string;
  emoji: string;
  label: string;
  type: 'instant' | 'duration';
  color?: string;
  actionText?: string;
  optionsType?: 'start' | 'end' | 'instant';
  optionsKey?: string;
}) {
  const label = (activity.label || '').trim();
  if (!label) return '';

  if (!Array.isArray(CONFIG.activities)) CONFIG.activities = [];
  const id = activity.id?.trim() || `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  CONFIG.activities.push({
    id,
    emoji: (activity.emoji || '🧩').trim(),
    label,
    type: activity.type || 'instant',
    ...(activity.color ? { color: activity.color.trim() } : {}),
    ...(activity.actionText ? { actionText: activity.actionText.trim() } : {}),
    ...(activity.optionsType ? { optionsType: activity.optionsType } : {}),
    ...(activity.optionsKey ? { optionsKey: activity.optionsKey.trim() } : {})
  });
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return id;
}

export function updateActivity(
  id: string,
  patch: {
    emoji?: string;
    label?: string;
    type?: 'instant' | 'duration';
    color?: string;
    actionText?: string;
    optionsType?: 'start' | 'end' | 'instant' | '';
    optionsKey?: string;
  }
) {
  const item = (CONFIG.activities || []).find((a: any) => a.id === id);
  if (!item) return;
  if (typeof patch.emoji === 'string') item.emoji = patch.emoji.trim() || item.emoji;
  if (typeof patch.label === 'string') item.label = patch.label.trim() || item.label;
  if (patch.type === 'instant' || patch.type === 'duration') item.type = patch.type;
  if (typeof patch.color === 'string') {
    const next = patch.color.trim();
    if (next) item.color = next;
    else delete item.color;
  }
  if (typeof patch.actionText === 'string') {
    const next = patch.actionText.trim();
    if (next) item.actionText = next;
    else delete item.actionText;
  }
  if (patch.optionsType === 'start' || patch.optionsType === 'end' || patch.optionsType === 'instant') {
    item.optionsType = patch.optionsType;
  } else if (patch.optionsType === '') {
    delete item.optionsType;
  }
  if (typeof patch.optionsKey === 'string') {
    const next = patch.optionsKey.trim();
    if (next) item.optionsKey = next;
    else delete item.optionsKey;
  }
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function removeActivity(id: string) {
  if (!Array.isArray(CONFIG.activities)) return;
  CONFIG.activities = CONFIG.activities.filter((a: any) => a.id !== id);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function moveActivity(id: string, direction: 'up' | 'down') {
  if (!Array.isArray(CONFIG.activities)) return;
  const idx = CONFIG.activities.findIndex((a: any) => a.id === id);
  if (idx < 0) return;
  const to = direction === 'up' ? idx - 1 : idx + 1;
  if (to < 0 || to >= CONFIG.activities.length) return;
  const [item] = CONFIG.activities.splice(idx, 1);
  CONFIG.activities.splice(to, 0, item);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function reorderActivities(ids: string[]) {
  if (!Array.isArray(CONFIG.activities) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.activities.map((a: any) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.activities.filter((a: any) => !ids.includes(a.id));
  CONFIG.activities = [...next, ...remaining];
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addQuickAction(action: {
  id?: string;
  emoji: string;
  label: string;
  type: 'instant' | 'duration';
  color?: string;
  optionsType?: 'start' | 'end' | 'instant';
  optionsKey?: string;
}) {
  const label = (action.label || '').trim();
  if (!label) return '';

  if (!Array.isArray(CONFIG.quickActions)) CONFIG.quickActions = [];
  const id = action.id?.trim() || `qa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  CONFIG.quickActions.push({
    id,
    emoji: (action.emoji || '⚡').trim(),
    label,
    type: action.type || 'instant',
    ...(action.color ? { color: action.color.trim() } : {}),
    ...(action.optionsType ? { optionsType: action.optionsType } : {}),
    ...(action.optionsKey ? { optionsKey: action.optionsKey.trim() } : {})
  });
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return id;
}

export function updateQuickAction(
  id: string,
  patch: {
    emoji?: string;
    label?: string;
    type?: 'instant' | 'duration';
    color?: string;
    optionsType?: 'start' | 'end' | 'instant' | '';
    optionsKey?: string;
  }
) {
  const item = (CONFIG.quickActions || []).find((a: any) => a.id === id);
  if (!item) return;
  if (typeof patch.emoji === 'string') item.emoji = patch.emoji.trim() || item.emoji;
  if (typeof patch.label === 'string') item.label = patch.label.trim() || item.label;
  if (patch.type === 'instant' || patch.type === 'duration') item.type = patch.type;
  if (typeof patch.color === 'string') {
    const next = patch.color.trim();
    if (next) item.color = next;
    else delete item.color;
  }
  if (patch.optionsType === 'start' || patch.optionsType === 'end' || patch.optionsType === 'instant') {
    item.optionsType = patch.optionsType;
  } else if (patch.optionsType === '') {
    delete item.optionsType;
  }
  if (typeof patch.optionsKey === 'string') {
    const next = patch.optionsKey.trim();
    if (next) item.optionsKey = next;
    else delete item.optionsKey;
  }
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function removeQuickAction(id: string) {
  if (!Array.isArray(CONFIG.quickActions)) return;
  CONFIG.quickActions = CONFIG.quickActions.filter((a: any) => a.id !== id);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function moveQuickAction(id: string, direction: 'up' | 'down') {
  if (!Array.isArray(CONFIG.quickActions)) return;
  const idx = CONFIG.quickActions.findIndex((a: any) => a.id === id);
  if (idx < 0) return;
  const to = direction === 'up' ? idx - 1 : idx + 1;
  if (to < 0 || to >= CONFIG.quickActions.length) return;
  const [item] = CONFIG.quickActions.splice(idx, 1);
  CONFIG.quickActions.splice(to, 0, item);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function reorderQuickActions(ids: string[]) {
  if (!Array.isArray(CONFIG.quickActions) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.quickActions.map((a: any) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.quickActions.filter((a: any) => !ids.includes(a.id));
  CONFIG.quickActions = [...next, ...remaining];
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addCustomActivityOption(optionsKey: string, text: string) {
  if (!CONFIG.activityOptions[optionsKey]) {
    CONFIG.activityOptions[optionsKey] = [];
  }
  CONFIG.activityOptions[optionsKey].unshift(text);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addCustomPanicTrigger(text: string) {
  if (!text) return;
  if (!Array.isArray(CONFIG.panicTriggers)) {
    CONFIG.panicTriggers = [];
  }

  const exists = CONFIG.panicTriggers.some((t: string) => t.toLowerCase() === text.toLowerCase());
  if (!exists) {
    CONFIG.panicTriggers.unshift(text);
    events.emit(EVENTS.CONFIG_UPDATED);
    saveConfig(CONFIG);
  }
}

export function addCustomCategory(text: string, color: string = 'var(--amber)'): string {
  const category = (text || '').trim();
  if (!category) return '';

  if (!Array.isArray(CONFIG.categories)) {
    CONFIG.categories = [];
  }
  if (!CONFIG.categoryColors || typeof CONFIG.categoryColors !== 'object') {
    CONFIG.categoryColors = {};
  }

  const existing = CONFIG.categories.find((c: string) => c.toLowerCase() === category.toLowerCase());
  const finalCategory = existing || category;

  if (!existing) {
    CONFIG.categories.unshift(finalCategory);
  }
  if (!CONFIG.categoryColors[finalCategory]) {
    CONFIG.categoryColors[finalCategory] = color;
  }

  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return finalCategory;
}

export function setDailyBudget(amount: number) {
  if (!CONFIG.theme || typeof CONFIG.theme !== 'object') {
    CONFIG.theme = {};
  }

  const normalized = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
  CONFIG.theme.dailyBudget = normalized;
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addOptionItem(params: {
  id?: string;
  key: string;
  emoji: string;
  label: string;
  values?: string[];
}) {
  const key = (params.key || '').trim();
  const label = (params.label || '').trim();
  
  if (!key || !label) return '';

  if (!Array.isArray(CONFIG.optionsItems)) CONFIG.optionsItems = [];
  
  const id = params.id?.trim() || `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  CONFIG.optionsItems.push({
    id,
    key,
    emoji: (params.emoji || '📌').trim(),
    label,
    values: Array.isArray(params.values) ? params.values : []
  });
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return id;
}

export function updateOptionItem(
  id: string,
  patch: {
    key?: string;
    emoji?: string;
    label?: string;
  }
) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item) return;
  
  if (typeof patch.key === 'string') {
    const next = patch.key.trim();
    if (next) item.key = next;
  }
  if (typeof patch.emoji === 'string') {
    const next = patch.emoji.trim();
    if (next) item.emoji = next;
  }
  if (typeof patch.label === 'string') {
    const next = patch.label.trim();
    if (next) item.label = next;
  }
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function removeOptionItem(id: string) {
  if (!Array.isArray(CONFIG.optionsItems)) return;
  CONFIG.optionsItems = CONFIG.optionsItems.filter((o: any) => o.id !== id);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function reorderOptionItems(ids: string[]) {
  if (!Array.isArray(CONFIG.optionsItems) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.optionsItems.map((o: any) => [o.id, o]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.optionsItems.filter((o: any) => !ids.includes(o.id));
  CONFIG.optionsItems = [...next, ...remaining];
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addOptionValue(id: string, value: string) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item) return;
  
  const val = (value || '').trim();
  if (!val) return;
  
  if (!Array.isArray(item.values)) item.values = [];
  if (!item.values.some((v: string) => String(v).toLowerCase() === val.toLowerCase())) {
    item.values.unshift(val);
  }
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function updateOptionValue(id: string, oldValue: string, newValue: string) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item || !Array.isArray(item.values)) return;

  const next = (newValue || '').trim();
  if (!next) return;

  const oldIndex = item.values.findIndex((v: string) => v === oldValue);
  if (oldIndex < 0) return;
  if (item.values.some((v: string, i: number) => i !== oldIndex && String(v).toLowerCase() === next.toLowerCase())) {
    return;
  }

  item.values[oldIndex] = next;

  const optionKey = String(item.key || '').trim();
  if (optionKey && CONFIG.optionsNested?.[optionKey]?.[oldValue]) {
    const existing = CONFIG.optionsNested[optionKey][oldValue];
    delete CONFIG.optionsNested[optionKey][oldValue];
    CONFIG.optionsNested[optionKey][next] = Array.isArray(existing) ? [...existing] : [];
  }

  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function removeOptionValue(id: string, value: string) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item || !Array.isArray(item.values)) return;
  
  item.values = item.values.filter((v: string) => v !== value);

  const optionKey = String(item.key || '').trim();
  if (optionKey && CONFIG.optionsNested?.[optionKey]?.[value]) {
    delete CONFIG.optionsNested[optionKey][value];
  }
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addOptionSubValue(optionKey: string, parentValue: string, subValue: string) {
  if (!CONFIG.optionsNested) CONFIG.optionsNested = {};
  if (!CONFIG.optionsNested[optionKey]) CONFIG.optionsNested[optionKey] = {};
  if (!CONFIG.optionsNested[optionKey][parentValue]) CONFIG.optionsNested[optionKey][parentValue] = [];
  
  const val = (subValue || '').trim();
  if (!val) return;
  
  if (!CONFIG.optionsNested[optionKey][parentValue].some((v: string) => String(v).toLowerCase() === val.toLowerCase())) {
    CONFIG.optionsNested[optionKey][parentValue].unshift(val);
  }
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function updateOptionSubValue(optionKey: string, parentValue: string, oldSubValue: string, newSubValue: string) {
  const list = CONFIG.optionsNested?.[optionKey]?.[parentValue];
  if (!Array.isArray(list)) return;

  const next = (newSubValue || '').trim();
  if (!next) return;

  const oldIndex = list.findIndex((v: string) => v === oldSubValue);
  if (oldIndex < 0) return;
  if (list.some((v: string, i: number) => i !== oldIndex && String(v).toLowerCase() === next.toLowerCase())) {
    return;
  }

  list[oldIndex] = next;

  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function removeOptionSubValue(optionKey: string, parentValue: string, subValue: string) {
  if (!CONFIG.optionsNested?.[optionKey]?.[parentValue]) return;
  
  CONFIG.optionsNested[optionKey][parentValue] = CONFIG.optionsNested[optionKey][parentValue].filter((v: string) => v !== subValue);
  
  if (CONFIG.optionsNested[optionKey][parentValue].length === 0) {
    delete CONFIG.optionsNested[optionKey][parentValue];
  }
  
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function reorderOptionValues(id: string, values: string[]) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item || !Array.isArray(values)) return;
  
  const byValue = new Map(item.values.map((v: string, i: number) => [v, i]));
  const ordered: string[] = [];
  const used = new Set<string>();
  
  values.forEach((v: string) => {
    if (byValue.has(v) && !used.has(v)) {
      ordered.push(v);
      used.add(v);
    }
  });
  
  // Add any remaining values not in the reorder list
  item.values.forEach((v: string) => {
    if (!used.has(v)) {
      ordered.push(v);
    }
  });
  
  item.values = ordered;
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function reorderOptionSubValues(optionKey: string, parentValue: string, values: string[]) {
  const list = CONFIG.optionsNested?.[optionKey]?.[parentValue];
  if (!Array.isArray(list) || !Array.isArray(values)) return;

  const byValue = new Map(list.map((v: string) => [v, true]));
  const ordered: string[] = [];
  const used = new Set<string>();

  values.forEach((v: string) => {
    if (byValue.has(v) && !used.has(v)) {
      ordered.push(v);
      used.add(v);
    }
  });

  list.forEach((v: string) => {
    if (!used.has(v)) {
      ordered.push(v);
    }
  });

  CONFIG.optionsNested[optionKey][parentValue] = ordered;
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export interface TimelineItem {
  id: string; // Unique ID (e.g., tl_123456789)
  baseId: string; // The activity ID (e.g., 'commute', 'workout')
  emoji: string;
  label: string; // "Workout", or "Workout (Upper Body)"
  type: 'instant' | 'duration';
  startTime: number; // Unix timestamp
  endTime?: number | null; // Unix timestamp, null if ongoing
  createdAt: number; // Unix timestamp (for lock logic)
  isPanic?: boolean;
}

export interface ExpenseItem {
  id: string;
  amount: number;
  note: string;
  category: string;
  timestamp: number;
}

export interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  timestamp: number;
  dueDate: string;
  source?: 'manual' | 'default' | 'scheduled';
  templateKey?: string;
}

export interface ScheduledTask {
  id: string;
  text: string;
  dueDate: string;
  createdAt: number;
}

export interface DailyState {
  date: string; // YYYY-MM-DD format
  intention: string;
  battery: number;
  timeline: TimelineItem[];
  expenses: ExpenseItem[];
  tasks: TaskItem[];
  v?: string; // Schema tracking version
}

// ═══════════════════════════════════════════════
// IN-MEMORY STATE STORE
// ═══════════════════════════════════════════════

export let STATE: DailyState = {
  date: _getTodayStr(),
  intention: '',
  battery: 60,
  timeline: [],
  expenses: [],
  tasks: [],
  v: APP_VERSION
};

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
  STATE.tasks = (STATE.tasks || []).map((t: any) => {
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
  }).filter((t) => t.text.length > 0);

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
    const exists = STATE.tasks.some(t => t.templateKey === templateKey && t.dueDate === today);
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
      const exists = STATE.tasks.some(t => t.templateKey === `scheduled:${task.id}` || (t.text === task.text && t.dueDate === today));
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

// ═══════════════════════════════════════════════
// LIFECYCLE & SYNC ACTIONS
// ═══════════════════════════════════════════════

export async function bootstrapToday() {
  const todayStr = _getTodayStr();
  console.log(`[STATE] Bootstrapping day: ${todayStr}`);

  try {
    const cloudState = await loadDay(todayStr);

    if (cloudState) {
      STATE = { ...STATE, ...cloudState, date: todayStr };
    } else {
      // First sign in today. Reset state to blank template.
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
    console.error(`[STATE] Failed to bootstrap today:`, err);
  }
}

export function resetToTodayLocal() {
  const todayStr = _getTodayStr();
  STATE = _createEmptyState(todayStr);
  _materializeTasksForToday();
  events.emit(EVENTS.STATE_READY, STATE);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
}

/**
 * Syncs the specific slice of state directly to the DB without fully overriding 
 * the local block until the debounce fires.
 */
function _triggerSync() {
  saveDay(STATE.date, STATE);
}


// ═══════════════════════════════════════════════
// TIMELINE LOGIC
// ═══════════════════════════════════════════════

export function addTimelineLog(baseId: string, emoji: string, label: string, type: 'instant' | 'duration', isPanic: boolean = false) {
  const now = Date.now();
  
  if (type === 'duration') {
    // Check for an ongoing item of the SAME baseId
    const ongoing = STATE.timeline.find(t => t.baseId === baseId && t.type === 'duration' && !t.endTime);
    
    if (ongoing) {
      // Stop the ongoing activity
      ongoing.endTime = now;
      // If caller passed a decorated label (e.g. with selected options), persist it on stop.
      if (label && label !== ongoing.label) {
        ongoing.label = label;
      }
      events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
      _triggerSync();
      return;
    }
  }

  // Create a new log entry
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
  const item = STATE.timeline.find(t => t.id === id);
  if (item) {
    item.label += suffix;
    events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
    _triggerSync();
  }
}

export function deleteTimelineLog(id: string) {
  STATE.timeline = STATE.timeline.filter(t => t.id !== id);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  _triggerSync();
}

// ═══════════════════════════════════════════════
// OTHER LOGIC (Intention, Battery, Money, Task)
// ═══════════════════════════════════════════════

export function setIntention(text: string) {
  STATE.intention = text;
  _triggerSync();
}

export function setBattery(level: number) {
  STATE.battery = level;
  _triggerSync();
}

export function resetForStartDay(intention: string) {
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
  _triggerSync();
}

export function addExpense(amount: number, note: string, category: string) {
  STATE.expenses.push({ id: `exp_${Date.now()}`, amount, note, category, timestamp: Date.now() });
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  _triggerSync();
}

export function deleteExpense(id: string) {
  STATE.expenses = STATE.expenses.filter(e => e.id !== id);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
  _triggerSync();
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
  const task = STATE.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
    _triggerSync();
  }
}

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
    events.emit(EVENTS.CONFIG_UPDATED);
    saveConfig(CONFIG);
  }
}

export function removeTaskDefault(weekday: string, text: string) {
  const key = String(weekday);
  if (!Array.isArray(CONFIG.taskDefaultsByWeekday?.[key])) return;
  CONFIG.taskDefaultsByWeekday[key] = CONFIG.taskDefaultsByWeekday[key].filter((t: string) => t !== text);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
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

  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function clearTaskDefaultsAll() {
  CONFIG.taskDefaultsByWeekday = { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] };
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}

export function addScheduledTask(text: string, dueDate: string): string {
  const clean = (text || '').trim();
  if (!clean || !dueDate) return '';

  const id = `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (!Array.isArray(CONFIG.scheduledTasks)) CONFIG.scheduledTasks = [];
  CONFIG.scheduledTasks.unshift({ id, text: clean, dueDate, createdAt: Date.now() });
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
  return id;
}

export function removeScheduledTask(id: string) {
  if (!Array.isArray(CONFIG.scheduledTasks)) return;
  CONFIG.scheduledTasks = CONFIG.scheduledTasks.filter((t: ScheduledTask) => t.id !== id);
  events.emit(EVENTS.CONFIG_UPDATED);
  saveConfig(CONFIG);
}


// ═══════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════

export function _getTodayStr(): string {
  const d = new Date();
  
  // Create YYYY-MM-DD local string instead of UTC.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${y}-${m}-${day}`;
}
