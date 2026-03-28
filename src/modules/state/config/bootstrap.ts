import { loadConfig } from '../../db';
import { DEFAULT_CONFIG, DEFAULT_CONFIG_VERSION } from '../../../config';

import { CONFIG, replaceConfig, ensureDefaultsMeta, emitConfigUpdated, persistConfig } from './store';

function cloneDefaults(value: any) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value: any): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeSection(key: string, fallback: any, type: 'array' | 'object'): boolean {
  ensureDefaultsMeta();
  const versionKey = `${key}Version`;
  const pristineKey = `${key}Pristine`;
  const current = (CONFIG as any)[key];
  const fallbackClone = cloneDefaults(fallback);

  if (type === 'array') {
    if (!Array.isArray(current)) {
      (CONFIG as any)[key] = fallbackClone;
      CONFIG._defaults[versionKey] = DEFAULT_CONFIG_VERSION;
      CONFIG._defaults[pristineKey] = true;
      return true;
    }
  } else {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      (CONFIG as any)[key] = fallbackClone;
      CONFIG._defaults[versionKey] = DEFAULT_CONFIG_VERSION;
      CONFIG._defaults[pristineKey] = true;
      return true;
    }
  }

  let changed = false;
  if (typeof CONFIG._defaults[pristineKey] !== 'boolean') {
    CONFIG._defaults[pristineKey] = stableStringify(current) === stableStringify(fallback);
    changed = true;
  }

  const pristine = CONFIG._defaults[pristineKey] === true;
  const version = typeof CONFIG._defaults[versionKey] === 'string' ? CONFIG._defaults[versionKey] : '';
  if (pristine && (version !== DEFAULT_CONFIG_VERSION || stableStringify(current) !== stableStringify(fallback))) {
    (CONFIG as any)[key] = fallbackClone;
    CONFIG._defaults[versionKey] = DEFAULT_CONFIG_VERSION;
    return true;
  }

  return changed;
}

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

function normalizeActivityOptionBindings(): boolean {
  let changed = false;

  if (!Array.isArray(CONFIG.activities)) return false;

  const stretch = CONFIG.activities.find((a: any) => a && a.id === 'stretch');
  if (stretch) {
    if (!stretch.optionsKey) {
      stretch.optionsKey = 'stretch';
      changed = true;
    }
    if (!stretch.optionsType) {
      stretch.optionsType = 'start';
      changed = true;
    }
  }

  const play = CONFIG.activities.find((a: any) => a && a.id === 'play');
  if (play) {
    if (!play.optionsKey) {
      play.optionsKey = 'play';
      changed = true;
    }
    if (!play.optionsType) {
      play.optionsType = 'start';
      changed = true;
    }
  }

  if (!CONFIG.activityOptions || typeof CONFIG.activityOptions !== 'object') {
    CONFIG.activityOptions = {};
    changed = true;
  }

  if (!Array.isArray(CONFIG.activityOptions.play) || CONFIG.activityOptions.play.length === 0) {
    CONFIG.activityOptions.play = ['♟️ Chess', '🪀 Carrom'];
    changed = true;
  }

  if (!Array.isArray(CONFIG.activityOptions.stretch) || CONFIG.activityOptions.stretch.length === 0) {
    CONFIG.activityOptions.stretch = ['🧘 Mobility', '🦵 Legs', '🧍 Full Body'];
    changed = true;
  }

  return changed;
}

function normalizeLegacyQuickActions(): boolean {
  if (!Array.isArray(CONFIG.quickActions)) return false;

  const before = CONFIG.quickActions.length;
  CONFIG.quickActions = CONFIG.quickActions.filter((q: any) => {
    const id = String(q?.id || '').toLowerCase();
    const label = String(q?.label || '').trim().toLowerCase();
    return id !== 'qa_stretch' && label !== 'stretch';
  });

  return CONFIG.quickActions.length !== before;
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
      replaceConfig({ ...CONFIG, ...cloudConfig });
      console.log('[STATE] Merged remote User Config.');
    } else {
      console.log('[STATE] No remote config found. Using defaults.');
      configChanged = true;
    }

    if (normalizeSection('ui', DEFAULT_CONFIG.ui, 'object')) configChanged = true;
    if (normalizeSection('theme', DEFAULT_CONFIG.theme, 'object')) configChanged = true;
    if (normalizeSection('activities', DEFAULT_CONFIG.activities, 'array')) configChanged = true;
    if (normalizeSection('activityOptions', DEFAULT_CONFIG.activityOptions, 'object')) configChanged = true;
    if (normalizeSection('categories', DEFAULT_CONFIG.categories, 'array')) configChanged = true;
    if (normalizeSection('categoryColors', DEFAULT_CONFIG.categoryColors, 'object')) configChanged = true;
    if (normalizeSection('quickActions', DEFAULT_CONFIG.quickActions, 'array')) configChanged = true;
    if (normalizeSection('optionsItems', DEFAULT_CONFIG.optionsItems, 'array')) configChanged = true;
    if (normalizeSection('optionsNested', DEFAULT_CONFIG.optionsNested, 'object')) configChanged = true;
    if (normalizeSection('panicTriggers', DEFAULT_CONFIG.panicTriggers, 'array')) configChanged = true;
    if (normalizeSection('taskDefaultsByWeekday', DEFAULT_CONFIG.taskDefaultsByWeekday, 'object')) configChanged = true;

    const normalized = normalizePanicTriggers(CONFIG.panicTriggers);
    CONFIG.panicTriggers = normalized.triggers;
    if (normalized.changed) configChanged = true;

    if (normalizeActivityOptionBindings()) configChanged = true;
    if (normalizeLegacyQuickActions()) configChanged = true;

    if (normalizeTaskPlannerConfig()) configChanged = true;

    if (configChanged) {
      persistConfig();
    }
  } catch (err) {
    console.error('[STATE] Failed to bootstrap config:', err);
  } finally {
    applyThemeVariables(CONFIG.theme || DEFAULT_CONFIG.theme);
    emitConfigUpdated(CONFIG);
  }
}