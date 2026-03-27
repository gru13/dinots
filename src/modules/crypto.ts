// ═══════════════════════════════════════════════
// E2EE ENGINE (Web Crypto API)
// ═══════════════════════════════════════════════
// Derives keys and encrypts/decrypts data locally.
// ═══════════════════════════════════════════════

let __keyCache: CryptoKey | null = null;
const ITERATIONS = 310000;

/**
 * Derives a 256-bit AES-GCM CryptoKey using PBKDF2 from the user's stable UID.
 * The derived key is cached in memory (__keyCache) for the session runtime.
 */
export async function deriveKey(uid: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  
  // Create a base key material from the exact uid string
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(uid),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // We use a static salt because the secret (UID) is already high-entropy 
  // and user-unique, and we need the exact same derived key algorithmically
  // on every sign-in across any device without having a stored server salt.
  const salt = enc.encode("dinots_salt_" + uid);

  // Derive the actual encryption key
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // false = the key cannot be extracted from memory
    ["encrypt", "decrypt"]
  );

  __keyCache = derivedKey;
  console.log("🔒 [E2EE] Key derived successfully and securely loaded into memory.");
  return derivedKey;
}

/**
 * Indicates whether the cryptographic engine is armed and ready.
 */
export function isVaultUnlocked(): boolean {
  return __keyCache !== null;
}

/**
 * Clears the derived key from memory on logout.
 */
export function lockVault(): void {
  __keyCache = null;
  console.log("🔒 [E2EE] Vault locked. Keys wiped from memory.");
}

/**
 * Encrypts a JSON object into an AES-GCM ciphertext.
 * Returns { iv, ciphertext } Base64-encoded strings.
 */
export async function encryptData(data: Record<string, any>): Promise<{ iv: string, data: string }> {
  if (!__keyCache) throw new Error("Vault is locked! Cannot encrypt data.");

  const enc = new TextEncoder();
  const encodedText = enc.encode(JSON.stringify(data));
  
  // Generate a random 12-byte IV (Initialization Vector) for this specific payload
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    __keyCache,
    encodedText
  );

  return {
    iv: bufferToBase64(iv.buffer),
    data: bufferToBase64(cipherBuffer)
  };
}

/**
 * Decrypts AES-GCM ciphertext payload back into a JSON object.
 */
export async function decryptData(encryptedPayload: { iv: string, data: string }): Promise<Record<string, any>> {
  if (!__keyCache) throw new Error("Vault is locked! Cannot decrypt data.");

  const iv = base64ToBuffer(encryptedPayload.iv);
  const cipherBuffer = base64ToBuffer(encryptedPayload.data);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    __keyCache,
    cipherBuffer
  );

  const dec = new TextDecoder();
  const jsonString = dec.decode(decryptedBuffer);
  return JSON.parse(jsonString);
}


// --- Base64 Utility Helpers ---

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
