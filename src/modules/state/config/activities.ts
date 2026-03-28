import { CONFIG, markSectionCustomized, emitConfigUpdated, persistConfig } from './store';

export function addCustomQuickAction(label: string, emoji: string, type: 'instant' | 'duration'): string {
  const id = 'qa_' + Date.now();
  CONFIG.quickActions.unshift({ id, emoji, label, type });
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('activities');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('activities');
  emitConfigUpdated();
  persistConfig();
}

export function removeActivity(id: string) {
  if (!Array.isArray(CONFIG.activities)) return;
  CONFIG.activities = CONFIG.activities.filter((a: any) => a.id !== id);
  markSectionCustomized('activities');
  emitConfigUpdated();
  persistConfig();
}

export function moveActivity(id: string, direction: 'up' | 'down') {
  if (!Array.isArray(CONFIG.activities)) return;
  const idx = CONFIG.activities.findIndex((a: any) => a.id === id);
  if (idx < 0) return;
  const to = direction === 'up' ? idx - 1 : idx + 1;
  if (to < 0 || to >= CONFIG.activities.length) return;
  const [item] = CONFIG.activities.splice(idx, 1);
  CONFIG.activities.splice(to, 0, item);
  markSectionCustomized('activities');
  emitConfigUpdated();
  persistConfig();
}

export function reorderActivities(ids: string[]) {
  if (!Array.isArray(CONFIG.activities) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.activities.map((a: any) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.activities.filter((a: any) => !ids.includes(a.id));
  CONFIG.activities = [...next, ...remaining];
  markSectionCustomized('activities');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
}

export function removeQuickAction(id: string) {
  if (!Array.isArray(CONFIG.quickActions)) return;
  CONFIG.quickActions = CONFIG.quickActions.filter((a: any) => a.id !== id);
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
}

export function moveQuickAction(id: string, direction: 'up' | 'down') {
  if (!Array.isArray(CONFIG.quickActions)) return;
  const idx = CONFIG.quickActions.findIndex((a: any) => a.id === id);
  if (idx < 0) return;
  const to = direction === 'up' ? idx - 1 : idx + 1;
  if (to < 0 || to >= CONFIG.quickActions.length) return;
  const [item] = CONFIG.quickActions.splice(idx, 1);
  CONFIG.quickActions.splice(to, 0, item);
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
}

export function reorderQuickActions(ids: string[]) {
  if (!Array.isArray(CONFIG.quickActions) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.quickActions.map((a: any) => [a.id, a]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.quickActions.filter((a: any) => !ids.includes(a.id));
  CONFIG.quickActions = [...next, ...remaining];
  markSectionCustomized('quickActions');
  emitConfigUpdated();
  persistConfig();
}

export function addCustomActivityOption(optionsKey: string, text: string) {
  if (!CONFIG.activityOptions || typeof CONFIG.activityOptions !== 'object') {
    CONFIG.activityOptions = {};
  }
  if (!CONFIG.activityOptions[optionsKey]) {
    CONFIG.activityOptions[optionsKey] = [];
  }
  CONFIG.activityOptions[optionsKey].unshift(text);
  markSectionCustomized('activityOptions');
  emitConfigUpdated();
  persistConfig();
}

export function addCustomPanicTrigger(text: string) {
  if (!text) return;
  if (!Array.isArray(CONFIG.panicTriggers)) {
    CONFIG.panicTriggers = [];
  }

  const exists = CONFIG.panicTriggers.some((t: string) => t.toLowerCase() === text.toLowerCase());
  if (!exists) {
    CONFIG.panicTriggers.unshift(text);
    markSectionCustomized('panicTriggers');
    emitConfigUpdated();
    persistConfig();
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

  markSectionCustomized('categories');
  markSectionCustomized('categoryColors');
  emitConfigUpdated();
  persistConfig();
  return finalCategory;
}

export function setDailyBudget(amount: number) {
  if (!CONFIG.theme || typeof CONFIG.theme !== 'object') {
    CONFIG.theme = {};
  }

  const normalized = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
  CONFIG.theme.dailyBudget = normalized;
  markSectionCustomized('theme');
  emitConfigUpdated();
  persistConfig();
}