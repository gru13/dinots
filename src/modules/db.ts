import { getFirestore, doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { app } from "../config";
import { encryptData, decryptData, isVaultUnlocked } from "./crypto";
import { CURRENT_USER } from "./auth";

const db = getFirestore(app);

// In-memory cache to prevent redundant reads and handle debouncing
let __localCache: Record<string, any> = {};
let __saveTimeout: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 2000;

/**
 * Loads the encrypted blob for a specific day from Firestore,
 * decrypts it in memory, and returns the parsed JS object.
 */
export async function loadDay(dateStr: string): Promise<Record<string, any> | null> {
  if (!CURRENT_USER) throw new Error("Cannot load DB: No user signed in.");
  if (!isVaultUnlocked()) throw new Error("Cannot load DB: Vault is locked.");

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

  // Clear existing timeout
  if (__saveTimeout) clearTimeout(__saveTimeout);

  if (forceImmediate) {
    _performSave(dateStr, __localCache[dateStr]);
  } else {
    // Debounce the cloud write
    __saveTimeout = setTimeout(() => {
      _performSave(dateStr, __localCache[dateStr]);
    }, DEBOUNCE_MS);
  }
}

async function _performSave(dateStr: string, stateToSave: Record<string, any>) {
  if (!CURRENT_USER) return;
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
