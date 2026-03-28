/**
 * Simple Publish/Subscribe Event Bus.
 * Used to decouple state unmutations from UI rendering.
 */

type EventHandler = (data?: any) => void;

class EventBus {
  private listeners: Record<string, EventHandler[]> = {};

  /**
   * Subscribe to an event topic.
   */
  on(event: string, callback: EventHandler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Unsubscribe from an event topic.
   */
  off(event: string, callback: EventHandler) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * Publish an event with optional payload data.
   */
  emit(event: string, data?: any) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[EventBus] Error in listener for event '${event}':`, e);
      }
    });
  }
}

export const events = new EventBus();

// --- Standard Event Types Data Dictionary ---
export const EVENTS = {
  STATE_READY: 'state:ready',       // Fired when the state for today is loaded from Cloud/Local
  TIMELINE_UPDATED: 'state:timeline', // Fired when a log is added or removed
  MONEY_UPDATED: 'state:money',       // Fired when an expense is added
  TASKS_UPDATED: 'state:tasks',       // Fired when tasks change
  CONFIG_UPDATED: 'state:config',     // Fired when user adds custom items
  DB_SYNC_STATUS: 'db:sync:status',   // Fired when persistence state changes
  VAULT_UNLOCKED: 'plugin:vault:open',// Fired when E2EE keys are derived
  VAULT_LOCKED: 'plugin:vault:close', // Fired when user signs out
};
