import { events, EVENTS } from '../../events';
import { saveConfig } from '../../db';
import { DEFAULT_CONFIG } from '../../../config';

export let CONFIG: any = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

export function replaceConfig(nextConfig: any) {
  CONFIG = nextConfig;
}

export function ensureDefaultsMeta() {
  if (!CONFIG._defaults || typeof CONFIG._defaults !== 'object') {
    CONFIG._defaults = {};
  }
}

export function markSectionCustomized(key: string) {
  ensureDefaultsMeta();
  CONFIG._defaults[`${key}Pristine`] = false;
}

export function emitConfigUpdated(payload?: any) {
  events.emit(EVENTS.CONFIG_UPDATED, payload);
}

export function persistConfig() {
  saveConfig(CONFIG);
}