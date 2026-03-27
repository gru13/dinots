# End-to-End Encryption (E2EE)

## What "End-to-End Encrypted" Actually Means Here

Your data is encrypted on your device **before** it leaves for the cloud.
Firebase (Google's servers) only ever receives an opaque encrypted blob.

- ❌ Firebase admins **cannot** read your data
- ❌ Google **cannot** read your data
- ❌ Anyone who hacks Firestore **cannot** read your data
- ✅ **Only you** — using your Google account — can decrypt it

---

## What Gets Encrypted

| Data | Encrypted? | Why |
|------|-----------|-----|
| Timeline items (activities) | ✅ Yes | Personal daily behaviour |
| Expenses | ✅ Yes | Financial data |
| Tasks | ✅ Yes | Personal goals |
| Daily intention | ✅ Yes | Personal note |
| Battery level | ✅ Yes | Mental health data |
| Quick actions list | ✅ Yes | Bundled with daily state |
| Panic triggers | ✅ Yes | Bundled with daily state |
| UI Config (theme, activities list) | ❌ No | Not sensitive, needed for fast load |

---

## The Encryption Algorithm

We use **AES-GCM** (Advanced Encryption Standard — Galois/Counter Mode):

- **Key size:** 256 bits
- **Mode:** GCM (provides both encryption AND authentication — detects tampering)
- **IV:** 12 bytes, randomly generated for every single encrypt call
- **Output:** `IV (12 bytes) + Ciphertext` → base64-encoded string

AES-GCM is:
- The gold standard for symmetric encryption
- Used by TLS 1.3, Signal, WhatsApp
- Natively supported in all modern browsers via Web Crypto API
- Zero external dependencies required

---

## Key Derivation — How Your Key is Made

The encryption key is **never stored anywhere**. It is re-derived from scratch every time you sign in.

### Algorithm: PBKDF2

```
Key = PBKDF2(
  password : uid + "guru_tracker_v1",   ← your Google user ID + app salt
  salt     : "guru_tracker_salt_v1",    ← fixed app-level salt (public, in code)
  iterations: 310_000,                  ← slow by design (makes brute-force expensive)
  hash     : SHA-256,
  keyLength: 256 bits
)
```

### Why PBKDF2 with 310,000 iterations?

- **PBKDF2** = Password-Based Key Derivation Function 2
- The high iteration count means it takes ~300ms to derive the key on a normal device
- For you: barely noticeable (happens once at sign-in)
- For an attacker trying all possible UIDs: computationally infeasible
- 310,000 is the NIST-recommended minimum for 2024

### Why the Google UID as the "password"?

- Google UIDs are stable (don't change when you change email/password)
- They're unique to your account — no collision possible
- They are NOT publicly guessable (format: `105327849012345678901`)
- Re-signing with the same Google account → same UID → same key → same data

---

## Step-by-Step: What Happens When You Sign In

```
1. Firebase Auth: Google OAuth popup
   → Firebase gives us: uid, displayName, photoURL, email

2. Key Derivation (crypto.ts: deriveKey)
   → input = uid + "guru_tracker_v1"
   → PBKDF2 with 310,000 iterations
   → output = CryptoKey (256-bit AES-GCM key)
   → stored ONLY in memory (JS variable) — never in localStorage, never sent anywhere

3. Vault Unlocked 🔓
   → Firestore: read /users/{uid}/days/TODAY
   → payload = "aGVsbG8gd29ybGQ..." (base64 ciphertext)
   → crypto.ts: decrypt(payload, cryptoKey)
   → AppState { intention, batteryLevel, timelineItems, expenses, tasks, ... }
   → render UI

4. While using the app:
   → Every saveState() call → encrypt(appState, cryptoKey) → Firestore write
   → Firestore stores: "dGhpcyBpcyBhIHNlY3JldA..." (unreadable)
```

---

## Step-by-Step: What Happens When You Sign Out

```
1. cryptoKey variable = null (garbage collected by browser)
2. localStorage cleared of any sensitive cache
3. Firestore session ended
4. Vault shows 🔒 Locked
5. UI shows sign-in screen
```

The key is gone. Without signing back in with the same Google account, the data in Firestore is permanently inaccessible.

---

## The Encrypt Function

```typescript
// crypto.ts
export async function encrypt(data: unknown, key: CryptoKey): Promise<string> {
  // 1. Serialize
  const plaintext = JSON.stringify(data);
  const encoded = new TextEncoder().encode(plaintext);

  // 2. Generate a fresh random IV for this encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // 4. Combine IV + ciphertext and base64-encode
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return btoa(String.fromCharCode(...combined));
}
```

---

## The Decrypt Function

```typescript
// crypto.ts
export async function decrypt<T>(ciphertext: string, key: CryptoKey): Promise<T> {
  // 1. Base64 decode
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));

  // 2. Split IV (first 12 bytes) and actual ciphertext (rest)
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  // 3. Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  // 4. Decode and parse
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
```

---

## The Key Derivation Function

```typescript
// crypto.ts
export async function deriveKey(uid: string): Promise<CryptoKey> {
  const APP_SALT = 'guru_tracker_salt_v1';
  const password = uid + 'guru_tracker_v1';

  // Import the password as raw key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,           // non-extractable
    ['deriveKey']
  );

  // Derive the actual AES-GCM key
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(APP_SALT),
      iterations: 310_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,           // non-extractable — cannot be exported from browser
    ['encrypt', 'decrypt']
  );
}
```

**The `extractable: false` flag** means the raw key bytes can never be read from JavaScript — not even by our own code. The browser keeps it in a protected memory region.

---

## Security Properties Summary

| Property | Value |
|----------|-------|
| Algorithm | AES-GCM 256-bit |
| Key derivation | PBKDF2 SHA-256, 310,000 iterations |
| IV | 12 bytes, cryptographically random, unique per encrypt call |
| Key storage | In-memory only (never localStorage, never sent to server) |
| Key extractable | No (`extractable: false` in Web Crypto API) |
| What Firebase sees | Opaque base64 string |
| What an attacker with the DB gets | Unreadable ciphertext |
| Dependency | None — Web Crypto API is built into every browser |

---

## Limitations & Honest Notes

1. **If you lose access to your Google account**, the key cannot be re-derived. Your data in Firestore becomes permanently inaccessible. Export backups regularly.

2. **Device compromise**: If someone installs malware on your phone/computer that can read browser memory, they could extract the in-memory key while you're signed in. This is outside the threat model of any client-side E2EE system.

3. **Google UID as secret**: The PBKDF2 input isn't truly secret — Google knows your UID. But PBKDF2 with 310k iterations makes it computationally infeasible to brute-force even with partial knowledge. The real protection is that only your Google session can retrieve the UID.

4. **The salt is in the code**: The app-level salt (`guru_tracker_salt_v1`) is in the source code (public). This is acceptable — the salt's job is to prevent rainbow table attacks, not to be secret. The security comes from the UID + iteration count.
