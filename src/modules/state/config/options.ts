import { CONFIG, markSectionCustomized, emitConfigUpdated, persistConfig } from './store';

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
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
}

export function removeOptionItem(id: string) {
  if (!Array.isArray(CONFIG.optionsItems)) return;
  CONFIG.optionsItems = CONFIG.optionsItems.filter((o: any) => o.id !== id);
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
}

export function reorderOptionItems(ids: string[]) {
  if (!Array.isArray(CONFIG.optionsItems) || !Array.isArray(ids) || ids.length === 0) return;
  const byId = new Map(CONFIG.optionsItems.map((o: any) => [o.id, o]));
  const next = ids.map((id) => byId.get(id)).filter(Boolean) as any[];
  const remaining = CONFIG.optionsItems.filter((o: any) => !ids.includes(o.id));
  CONFIG.optionsItems = [...next, ...remaining];
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
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

  markSectionCustomized('optionsItems');
  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
}

export function removeOptionValue(id: string, value: string) {
  const item = (CONFIG.optionsItems || []).find((o: any) => o.id === id);
  if (!item || !Array.isArray(item.values)) return;

  item.values = item.values.filter((v: string) => v !== value);

  const optionKey = String(item.key || '').trim();
  if (optionKey && CONFIG.optionsNested?.[optionKey]?.[value]) {
    delete CONFIG.optionsNested[optionKey][value];
  }
  markSectionCustomized('optionsItems');
  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
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

  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
}

export function removeOptionSubValue(optionKey: string, parentValue: string, subValue: string) {
  if (!CONFIG.optionsNested?.[optionKey]?.[parentValue]) return;

  CONFIG.optionsNested[optionKey][parentValue] = CONFIG.optionsNested[optionKey][parentValue].filter((v: string) => v !== subValue);

  if (CONFIG.optionsNested[optionKey][parentValue].length === 0) {
    delete CONFIG.optionsNested[optionKey][parentValue];
  }
  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
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

  item.values.forEach((v: string) => {
    if (!used.has(v)) {
      ordered.push(v);
    }
  });

  item.values = ordered;
  markSectionCustomized('optionsItems');
  emitConfigUpdated();
  persistConfig();
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
  markSectionCustomized('optionsNested');
  emitConfigUpdated();
  persistConfig();
}