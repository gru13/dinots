# Architecture

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Language | **TypeScript** | Type safety, catches bugs at compile time, better IDE support |
| Bundler | **Vite** | Instant Hot Module Replacement, native TS support, fast builds |
| Auth | **Firebase Auth v9** | Google OAuth2 popup, typed modular SDK |
| Database | **Cloud Firestore v9** | NoSQL, real-time capable, offline caching, free tier |
| Hosting | **Firebase Hosting** | Free HTTPS, global CDN, single command deploy |
| Encryption | **Web Crypto API** | Native browser crypto — no external dependencies |
| Styling | **Vanilla CSS** | Full control, CSS variables for theming, no framework overhead |

---

## Project File Structure

```
dinots/
│
├── index.html                  ← Vite entry point (app shell HTML)
├── vite.config.ts              ← Vite build config (output → dist/)
├── tsconfig.json               ← TypeScript compiler config
├── package.json                ← Dependencies + scripts
│
├── firebase.json               ← Firebase Hosting config (serves dist/)
├── .firebaserc                 ← Firebase project alias (links CLI to project)
├── firestore.rules             ← Firestore security rules
├── firestore.indexes.json      ← Firestore composite indexes
│
├── src/
│   ├── main.ts                 ← Entry point — initialises and wires all modules
│   ├── config.ts               ← DEFAULT_CONFIG + SYSTEM_DEFAULTS (typed constants)
│   │
│   ├── types/
│   │   └── index.ts            ← All shared TypeScript interfaces and types
│   │
│   ├── modules/
│   │   ├── crypto.ts           ← E2EE engine (key derivation + AES-GCM encrypt/decrypt)
│   │   ├── auth.ts             ← Firebase Auth (Google Sign-In, sign-out, state listener)
│   │   ├── db.ts               ← Firestore sync (read/write encrypted daily documents)
│   │   ├── state.ts            ← App state object, saveState(), loadState()
│   │   └── events.ts           ← Typed custom event bus (auth:ready, vault:unlocked, etc.)
│   │
│   ├── screens/
│   │   ├── log.ts              ← Log screen (wheel dial, quick actions, panic, timeline)
│   │   ├── money.ts            ← Money screen (expenses, categories, distribution chart)
│   │   ├── tasks.ts            ← Tasks screen (add, toggle, stats)
│   │   └── settings.ts         ← Settings screen (auth, vault status, config import/export)
│   │
│   └── styles/
│       └── app.css             ← All styles (CSS variables, components, animations)
│
└── dist/                       ← Vite build output (auto-generated, deployed to Firebase)
```

---

## Module Dependency Graph

```
main.ts
  ├── auth.ts          ← depends on: firebase/auth, events.ts
  ├── crypto.ts        ← depends on: Web Crypto API (no imports)
  ├── db.ts            ← depends on: firebase/firestore, crypto.ts
  ├── state.ts         ← depends on: types/, config.ts
  ├── events.ts        ← no dependencies (pure event bus)
  │
  ├── screens/log.ts       ← depends on: state.ts, events.ts
  ├── screens/money.ts     ← depends on: state.ts
  ├── screens/tasks.ts     ← depends on: state.ts
  └── screens/settings.ts  ← depends on: auth.ts, state.ts, events.ts
```

---

## Data Flow

### On App Load
```
main.ts init()
  → auth.ts: initAuth()
      → Firebase detects session
      → if signed in: emit "auth:signed-in" event
  → crypto.ts: deriveKey(uid)
      → 256-bit AES-GCM key derived (never stored)
      → emit "vault:unlocked"
  → db.ts: loadToday(uid, cryptoKey)
      → Firestore: read /users/{uid}/days/TODAY
      → decrypt payload
      → state.ts: hydrate(decryptedData)
  → all screens: render()
```

### On Every Data Change
```
user action (log activity, add expense, etc.)
  → screen module updates state
  → state.ts: saveState()
      → localStorage: save (immediate, offline backup)
      → db.ts: scheduleSyncToCloud() [debounced 2 seconds]
          → crypto.ts: encrypt(state)
          → Firestore: write /users/{uid}/days/TODAY
```

---

## Screens

| Screen ID | Nav Icon | File | Purpose |
|-----------|----------|------|---------|
| `log` | 📓 | `screens/log.ts` | Primary screen — activity wheel, battery, quick actions, panic, timeline |
| `money` | 💰 | `screens/money.ts` | Expense tracker with category distribution |
| `tasks` | ✅ | `screens/tasks.ts` | Daily task list with completion stats |
| `settings` | ⚙️ | `screens/settings.ts` | Google login, vault status, config import/export |

---

## Build vs Dev

| Command | What happens |
|---------|-------------|
| `npm run dev` | Vite starts dev server at `localhost:5173` with HMR |
| `npm run build` | TypeScript compiled → `dist/` (minified, tree-shaken) |
| `firebase serve` | Serves `dist/` locally to preview production build |
| `firebase deploy` | Uploads `dist/` + rules to Firebase, live at `https://PROJECT.web.app` |
