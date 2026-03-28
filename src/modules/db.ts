import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { app } from "../config";
import { encryptData, decryptData, isVaultUnlocked } from "./crypto";
import { CURRENT_USER } from "./auth";
import { events, EVENTS } from "./events";

const db = getFirestore(app);

// In-memory cache to prevent redundant reads and handle debouncing
let __localCache: Record<string, any> = {};
let __saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;
const RETRY_BASE_MS = 1200;
const RETRY_MAX_MS = 15000;

const __pendingDates = new Set<string>();
let __savePumpRunning = false;
const __retryAttempts: Record<string, number> = {};
const __retryTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};

type SyncStatus = 'idle' | 'scheduled' | 'saving' | 'saved' | 'retrying' | 'error';

function _emitSyncStatus(status: SyncStatus, dateStr?: string, retryInMs?: number) {
  events.emit(EVENTS.DB_SYNC_STATUS, { status, dateStr, retryInMs, at: Date.now() });
}

/**
 * Loads the encrypted blob for a specific day from Firestore,
 * decrypts it in memory, and returns the parsed JS object.
 */
export async function loadDay(dateStr: string): Promise<Record<string, any> | null> {
  if (!CURRENT_USER) throw new Error("Cannot load DB: No user signed in.");
  if (!isVaultUnlocked()) throw new Error("Cannot load DB: Vault is locked.");

  // Prefer local cache so recent edits (including deletions) are reflected immediately
  // while a debounced cloud write is still pending.
  if (__localCache[dateStr]) {
    return __localCache[dateStr];
  }

  const docRef = doc(db, "users", CURRENT_USER.uid, "days", dateStr);
  
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      console.log(`[DB] No cloud data found for ${dateStr}. Starting fresh.`);
      return null;
    }

    const payload = docSnap.data() as { iv: string, data: string };
    const decryptedState = await decryptData(payload);
    
    // Store in cache
    __localCache[dateStr] = decryptedState;
    console.log(`[DB] Successfully loaded and decrypted data for ${dateStr}.`);
    
    return decryptedState;
  } catch (err) {
    console.error(`[DB] Failed to load data for ${dateStr}:`, err);
    throw err;
  }
}

/**
 * Encrypts the application state in memory, then queues a write to Firestore.
 * Automatically debounced to prevent hammering the DB on every button click.
 */
export function saveDay(dateStr: string, stateUpdate: Record<string, any>, forceImmediate: boolean = false) {
  if (!CURRENT_USER || !isVaultUnlocked()) {
    console.warn("[DB] Cannot save data yet. Not logged in or vault locked.");
    return;
  }

  // Update local unencrypted cache immediately
  __localCache[dateStr] = { ...__localCache[dateStr], ...stateUpdate };
  __pendingDates.add(dateStr);

  if (forceImmediate) {
    if (__saveTimeout) {
      clearTimeout(__saveTimeout);
      __saveTimeout = null;
    }
    _kickSavePump();
  } else {
    _emitSyncStatus('scheduled', dateStr);
    _scheduleDebouncedFlush();
  }
}

function _scheduleDebouncedFlush() {
  if (__saveTimeout) clearTimeout(__saveTimeout);
  __saveTimeout = setTimeout(() => {
    __saveTimeout = null;
    _kickSavePump();
  }, DEBOUNCE_MS);
}

function _kickSavePump() {
  if (__savePumpRunning) return;
  void _runSavePump();
}

async function _runSavePump() {
  __savePumpRunning = true;
  try {
    while (__pendingDates.size > 0) {
      const next = __pendingDates.values().next();
      const dateStr = String(next.value || '');
      if (!dateStr) break;
      __pendingDates.delete(dateStr);

      const stateToSave = __localCache[dateStr];
      if (!stateToSave) continue;

      _emitSyncStatus('saving', dateStr);
      try {
        await _performSave(dateStr, stateToSave);
        __retryAttempts[dateStr] = 0;
        _emitSyncStatus('saved', dateStr);
      } catch (err) {
        console.error(`[DB] Save failed for ${dateStr}; scheduling retry.`, err);
        _emitSyncStatus('error', dateStr);
        _scheduleRetry(dateStr);
      }
    }
  } finally {
    __savePumpRunning = false;
    if (__pendingDates.size === 0) {
      _emitSyncStatus('idle');
    }
    if (__pendingDates.size > 0) {
      _kickSavePump();
    }
  }
}

function _scheduleRetry(dateStr: string) {
  const attempt = (__retryAttempts[dateStr] || 0) + 1;
  __retryAttempts[dateStr] = attempt;

  if (__retryTimers[dateStr]) {
    return;
  }

  const retryInMs = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt - 1)));
  _emitSyncStatus('retrying', dateStr, retryInMs);

  __retryTimers[dateStr] = setTimeout(() => {
    __retryTimers[dateStr] = null;
    __pendingDates.add(dateStr);
    _kickSavePump();
  }, retryInMs);
}

async function _performSave(dateStr: string, stateToSave: Record<string, any>) {
  if (!CURRENT_USER) throw new Error('No user signed in while attempting save.');
  const docRef = doc(db, "users", CURRENT_USER.uid, "days", dateStr);

  try {
    const startObj = Date.now();
    
    // 1. Encrypt the data
    const encryptedPayload = await encryptData(stateToSave);
    const encTime = Date.now() - startObj;

    // 2. Transmit to Firestore
    await setDoc(docRef, encryptedPayload);
    
    const writeTime = Date.now() - startObj - encTime;
    console.log(`☁️ [DB] Auto-saved ${dateStr} (Lock: ${encTime}ms, Cloud: ${writeTime}ms)`);
  } catch (err) {
    console.error(`[DB] Critical Error Auto-saving ${dateStr}:`, err);
    throw err;
  }
}

// ═══════════════════════════════════════════════
// CONFIG SYNC
// ═══════════════════════════════════════════════

export async function loadConfig(): Promise<any | null> {
  if (!CURRENT_USER || !isVaultUnlocked()) return null;
  const docRef = doc(db, "users", CURRENT_USER.uid, "settings", "config");
  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return await decryptData(snap.data() as { iv: string, data: string });
  } catch (err) {
    console.error("[DB] Failed to load config:", err);
    return null;
  }
}

let __configSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function saveConfig(configData: any) {
  if (!CURRENT_USER || !isVaultUnlocked()) return;
  if (__configSaveTimeout) clearTimeout(__configSaveTimeout);
  
  __configSaveTimeout = setTimeout(async () => {
    if (!CURRENT_USER) return;
    try {
      const docRef = doc(db, "users", CURRENT_USER.uid, "settings", "config");
      const start = Date.now();
      const enc = await encryptData(configData);
      await setDoc(docRef, enc);
      console.log(`☁️ [DB] Config auto-saved securely. (Lock: ${Date.now() - start}ms)`);
    } catch (err) {
      console.error("[DB] Failed to save config:", err);
    }
  }, DEBOUNCE_MS);
}

export async function listDayKeys(): Promise<string[]> {
  if (!CURRENT_USER || !isVaultUnlocked()) return [];

  try {
    const daysRef = collection(db, "users", CURRENT_USER.uid, "days");
    const snap = await getDocs(daysRef);
    return snap.docs.map((d) => d.id).filter((id) => /^\d{4}-\d{2}-\d{2}$/.test(id));
  } catch (err) {
    console.error('[DB] Failed to list day keys:', err);
    return [];
  }
}

export async function upsertUserPresence(profile: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}) {
  if (!CURRENT_USER) return;
  const cleanEmail = String(profile.email || '').trim();
  if (!cleanEmail) return;

  const docRef = doc(db, "app_users", profile.uid);
  try {
    await setDoc(docRef, {
      uid: profile.uid,
      email: cleanEmail,
      displayName: String(profile.displayName || '').trim(),
      photoURL: String(profile.photoURL || '').trim(),
      lastSeenAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error('[DB] Failed to upsert user presence:', err);
  }
}

export async function listRegisteredUsers(): Promise<Array<{
  uid: string;
  email: string;
  displayName?: string;
  lastSeenAt?: number;
}>> {
  if (!CURRENT_USER) return [];

  try {
    const snap = await getDocs(collection(db, "app_users"));
    const users = snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          uid: String(data?.uid || d.id),
          email: String(data?.email || '').trim(),
          displayName: String(data?.displayName || '').trim(),
          lastSeenAt: Number(data?.lastSeenAt) || 0
        };
      })
      .filter((u) => u.email.length > 0)
      .sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));

    return users;
  } catch (err) {
    console.error('[DB] Failed to list registered users:', err);
    return [];
  }
}
