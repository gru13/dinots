# Database — Firestore Schema & Sync Strategy

## Overview

Firestore is a **NoSQL document database**. Data is organised into **collections** of **documents**. Each document is a JSON-like object with named fields.

For this app, every user gets their own isolated subtree under `/users/{uid}/`.

---

## Full Schema

```
Firestore Database
│
└── users/                              ← collection
    └── {uid}/                          ← document (one per Google account)
        │
        ├── config/                     ← sub-collection
        │   └── prefs                   ← document
        │       ├── activities: Activity[]
        │       ├── activityOptions: Record<string, string[]>
        │       ├── quickActions: QuickAction[]
        │       ├── categories: string[]
        │       ├── categoryColors: Record<string, string>
        │       ├── panicTriggers: string[]
        │       ├── ui: UIConfig
        │       └── theme: ThemeConfig
        │
        └── days/                       ← sub-collection
            ├── 2026-03-27              ← document (today)
            │   ├── payload: string     ← AES-GCM encrypted AppState (base64)
            │   └── updatedAt: Timestamp
            │
            ├── 2026-03-26             ← document (yesterday, read-only)
            │   ├── payload: string
            │   └── updatedAt: Timestamp
            │
            └── ...                    ← one per day, forever
```

---

## Document Details

### `/users/{uid}` (root user document)

This document is mostly unused — the real data is in sub-collections. It may store lightweight metadata in future.

---

### `/users/{uid}/config/prefs` — User Configuration

**Not encrypted** — contains customisation preferences, not sensitive personal data.

| Field | Type | Description |
|-------|------|-------------|
| `activities` | `Activity[]` | The scroll-wheel items (id, emoji, label, type, color) |
| `activityOptions` | `Record<string, string[]>` | Composite drill-down options dictionary |
| `quickActions` | `QuickAction[]` | Quick-tap chips (Water, Coffee, Meds, etc.) |
| `categories` | `string[]` | Expense category labels (e.g. '🍛 Food') |
| `categoryColors` | `Record<string, string>` | CSS colour per category for distribution chart |
| `panicTriggers` | `string[]` | Predefined panic trigger labels |
| `ui` | `UIConfig` | Nav labels, section headers, button text, badge text |
| `theme` | `ThemeConfig` | Hex colours, border radius, daily budget, currency symbol |

**When written:** On first sign-in, or when user imports/resets config.
**When read:** On every app load (once, cached locally).

---

### `/users/{uid}/days/{YYYY-MM-DD}` — Daily Data

**Encrypted** — contains the entire day's sensitive activity and financial data.

| Field | Type | Description |
|-------|------|-------------|
| `payload` | `string` | Base64-encoded AES-GCM ciphertext of the full `AppState` |
| `updatedAt` | `Timestamp` | Server timestamp of last write (for conflict detection) |

**The decrypted `payload` contains:**
```typescript
interface AppState {
  intention: string;          // "Today's non-negotiable goal"
  batteryLevel: number;       // 0–100
  timelineItems: TimelineItem[];
  expenses: Expense[];
  tasks: Task[];
  quickActions: QuickAction[]; // user's current QA list (may differ from config)
  userCats: string[];          // user-added expense categories
  panicTriggers: string[];     // current panic trigger list (may have custom ones)
  activityOptions: Record<string, string[]>; // current options (may have custom)
}
```

**When written:** Debounced 2 seconds after any data change.
**When read:** Once on app load for today's date.

---

## Sync Strategy

### On Sign-In

```
1. Derive encryption key from uid (crypto.ts)
2. Load config from /users/{uid}/config/prefs (plaintext, fast)
3. Load today's day document from /users/{uid}/days/TODAY
4. Decrypt payload → hydrate app state
5. Merge with any local changes (local wins if newer)
```

### On Data Change (Every Save)

```
1. Immediately write to localStorage (instant, offline backup)
2. Schedule Firestore write (debounced 2 seconds)
   → encrypt full AppState
   → write to /users/{uid}/days/TODAY
   → update updatedAt timestamp
```

### New Day (Wake Up action)

```
1. User taps ☀️ Woke Up → confirm modal
2. Previous day's document: already closed (no more writes to yesterday)
3. Reset in-memory state (clear timeline, expenses, tasks)
4. Set new intention
5. Create fresh document at /users/{uid}/days/NEW_DATE
```

### Offline Behaviour

- Firestore SDK has built-in offline persistence
- Writes queue locally while offline, sync when connection resumes
- localStorage always has the latest state as a final fallback

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own data
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == uid;
    }

    // No access to anything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Key security properties:**
- ✅ User A cannot read User B's documents — even if they know the path
- ✅ Unauthenticated requests are rejected entirely
- ✅ Even if payload is intercepted — it's AES-GCM encrypted, unreadable
- ✅ Firebase admin/Google employees cannot read your data (E2EE)

---

## Why NoSQL + One Blob Per Day?

### Alternative Considered: One Document Per Timeline Item

```
/users/{uid}/days/2026-03-27/items/tl_123
/users/{uid}/days/2026-03-27/items/tl_124
/users/{uid}/days/2026-03-27/expenses/exp_456
```

**Why rejected:**
- Each item = one Firestore read/write = quota consumption
- 30 activities + 10 expenses + 10 tasks = 50 operations per day per user
- Encrypting individual items is complex and leaks metadata (document count, creation time)
- Harder to atomically encrypt and sync

### Chosen: One Encrypted Blob Per Day ✅

```
/users/{uid}/days/2026-03-27
  payload: "<everything encrypted as one string>"
```

**Why this wins:**
- 1 read on load + 1 write on save (regardless of how many items)
- True E2EE: no metadata leaks, no field names visible
- Simple, reliable, atomic
- Querying for the dashboard is just: fetch N day documents, decrypt each

---

## Dashboard Query Pattern (Future)

```typescript
// Fetch last 30 days of data
const snapshot = await getDocs(
  query(
    collection(db, `users/${uid}/days`),
    orderBy('updatedAt', 'desc'),
    limit(30)
  )
);

// Decrypt each day client-side
const days = await Promise.all(
  snapshot.docs.map(async doc => {
    const decrypted = await decrypt<AppState>(doc.data().payload, cryptoKey);
    return { date: doc.id, ...decrypted };
  })
);

// Aggregate: total spend per week, avg battery, etc.
```

All computation happens in the browser. No Cloud Functions needed.

---

## Storage Estimates

| Item | Size | Per User / Year |
|------|------|----------------|
| One day's encrypted payload | ~5–15 KB | ~3–5 MB |
| Config document | ~3 KB | Static |
| **Total per user / year** | — | **~5 MB** |

Firebase free tier: **1 GB storage** — supports ~200 users for a full year before any cost.
