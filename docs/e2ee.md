# End-to-End Encryption (E2EE)

This document reflects the current implementation in the app code.

## What Is Encrypted

Encrypted at rest in Firestore:

- users/{uid}/days/{yyyy-mm-dd}
- users/{uid}/settings/config

Both are stored as an encrypted payload object with this shape:

- iv: base64 IV
- data: base64 ciphertext

Not encrypted in Firestore:

- app_users/{uid} directory entries (email, displayName, photoURL, lastSeenAt)

## Current Crypto Design

Algorithm and primitives:

- AES-GCM, 256-bit key
- PBKDF2-SHA256 for key derivation
- Iterations: 310000
- Random IV per encryption: 12 bytes
- Key marked non-extractable in Web Crypto

## How Key Is Created

On sign-in, auth flow calls deriveKey(uid).

Implementation details:

1. Import raw key material from UTF-8 bytes of uid
2. Compute salt as dinots_salt_ + uid
3. Derive AES-GCM key with PBKDF2:
   - hash: SHA-256
   - iterations: 310000
   - length: 256
4. Cache derived CryptoKey in memory (__keyCache)

Key lifecycle:

- Created after login
- Used for encrypt/decrypt during session
- Cleared on logout (lockVault sets __keyCache to null)
- Not persisted to localStorage/sessionStorage/Firestore

## Encrypt/Decrypt Flow

Encrypt:

1. Serialize object to JSON bytes
2. Generate random 12-byte IV
3. AES-GCM encrypt with in-memory key
4. Base64 encode IV and ciphertext
5. Save to Firestore as { iv, data }

Decrypt:

1. Read { iv, data } from Firestore
2. Base64 decode
3. AES-GCM decrypt with in-memory key
4. Parse JSON into runtime state

## Security Properties

What this design protects well:

- Firestore data dump without active signed-in browser key cannot be read easily as plaintext
- Encrypted docs include authentication (AES-GCM integrity)
- Key is not directly exportable from Web Crypto API

What this design does not fully protect against:

- A fully compromised signed-in browser/device session
- An attacker who can reproduce the same derivation inputs (uid-based derivation means no extra user-held secret)

## Important Limitation (Current Model)

Current key derivation is based on uid-derived material and deterministic salt. This means the scheme is closer to app-managed encryption than strict user-secret E2EE.

If you need stronger E2EE guarantees, migrate to passphrase-based key derivation (or device-bound key wrapping) plus key versioning and migration support.

## Notes About Runtime Caching

- The DB module keeps a local in-memory state cache for responsiveness
- This cache is not a persisted disk cache by design
- Saving pipeline may debounce or force immediate flush depending on action type

## Source of Truth

For exact behavior, refer to:

- src/modules/crypto.ts
- src/modules/auth.ts
- src/modules/db.ts
