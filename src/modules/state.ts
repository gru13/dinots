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
  STATE.battery = 60;
  STATE.intention = intention;

  events.emit(EVENTS.STATE_READY, STATE);
  events.emit(EVENTS.TIMELINE_UPDATED, STATE.timeline);
  events.emit(EVENTS.MONEY_UPDATED, STATE.expenses);
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
  STATE.tasks.push({ id: `task_${Date.now()}`, text, done: false, timestamp: Date.now() });
  events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
  _triggerSync();
}

export function toggleTask(id: string) {
  const task = STATE.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    events.emit(EVENTS.TASKS_UPDATED, STATE.tasks);
    _triggerSync();
  }
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
