import { CONFIG } from '../../../modules/state';

export function joinValueParts(emoji: string, text: string) {
  const normalizedEmoji = String(emoji || '').trim();
  const normalizedText = String(text || '').trim();
  if (!normalizedText) return '';
  return normalizedEmoji ? `${normalizedEmoji} ${normalizedText}` : normalizedText;
}

export function hasCaseInsensitiveMatch(items: string[], candidate: string, except?: string) {
  const normalizedCandidate = candidate.trim().toLowerCase();
  const normalizedExcept = (except || '').trim().toLowerCase();
  return items.some((item) => {
    const current = String(item || '').trim().toLowerCase();
    if (!current) return false;
    if (normalizedExcept && current === normalizedExcept) return false;
    return current === normalizedCandidate;
  });
}

export function buildValueEditKey(id: string, value: string) {
  return `${id}::${value}`;
}

export function buildSubValueEditKey(optionKey: string, parentValue: string, subValue: string) {
  return `${optionKey}::${parentValue}::${subValue}`;
}

export function clearValueEditKeysForOption(editingValueKeys: Set<string>, optionId: string) {
  for (const valueKey of [...editingValueKeys]) {
    if (valueKey.startsWith(`${optionId}::`)) {
      editingValueKeys.delete(valueKey);
    }
  }
}

export function pruneStaleInlineEditKeys(rows: any[], editingValueKeys: Set<string>, editingSubValueKeys: Set<string>) {
  const validValueKeys = new Set<string>();
  const validSubValueKeys = new Set<string>();

  rows.forEach((item: any) => {
    const id = String(item?.id || '');
    const optionKey = String(item?.key || '');
    const values = Array.isArray(item?.values) ? item.values : [];

    values.forEach((value: string) => {
      validValueKeys.add(buildValueEditKey(id, value));
      const subValues = CONFIG.optionsNested?.[optionKey]?.[value] || [];
      subValues.forEach((subValue: string) => {
        validSubValueKeys.add(buildSubValueEditKey(optionKey, value, subValue));
      });
    });
  });

  for (const key of [...editingValueKeys]) {
    if (!validValueKeys.has(key)) editingValueKeys.delete(key);
  }

  for (const key of [...editingSubValueKeys]) {
    if (!validSubValueKeys.has(key)) editingSubValueKeys.delete(key);
  }
}
