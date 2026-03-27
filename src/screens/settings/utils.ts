export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, ' ');
}

export function unescapeHtmlAttr(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function getPickerColor(input: string | undefined): string {
  const fallback = '#888888';
  const raw = (input || '').trim();
  if (!raw) return fallback;

  const hex3or6 = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
  if (hex3or6.test(raw)) {
    if (raw.length === 4) {
      return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
    }
    return raw.toLowerCase();
  }

  const varMatch = raw.match(/^var\((--[^)]+)\)$/);
  if (varMatch) {
    const resolved = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim();
    if (hex3or6.test(resolved)) return resolved.toLowerCase();
  }

  return fallback;
}

export function getDisplayColor(input: string | undefined): string {
  const raw = (input || '').trim();
  if (!raw) return 'var(--text3)';

  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return raw;
  if (/^var\(--[a-zA-Z0-9_-]+\)$/.test(raw)) return raw;
  if (/^rgba?\([0-9\s.,%]+\)$/.test(raw)) return raw;
  return 'var(--text3)';
}
