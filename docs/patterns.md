# Design Patterns

This document explains every architectural and UI pattern used in the app — both those from the original `stater.html` and new ones introduced in the TypeScript rewrite.

---

## Patterns from the Original Starter

### 1. JSON-Driven Configuration

**Where:** `config.ts` → `DEFAULT_CONFIG`

**What it is:** The entire app — its activities, categories, UI labels, theme colors, quick actions, panic triggers — is driven by a single `DEFAULT_CONFIG` object. No hardcoded strings in the UI.

**Why it matters:** A user can import a custom `.json` config file and the entire app rebrands instantly. Different people can have completely different activity sets, budgets, and languages without changing a line of code.

```typescript
// The entire UI is reskinnable via this object
const DEFAULT_CONFIG: AppConfig = {
  ui: { topBadge: "Phase 0 · Week 1", topEmoji: "🔥", nav: { ... }, sections: { ... } },
  theme: { bg: "#0D0D0B", amber: "#E8A830", dailyBudget: 500, currencySymbol: "₹" },
  activities: [ { id: 'wake', emoji: '☀️', label: 'Woke Up', type: 'instant' }, ... ],
  categories: ['🍛 Food', '🚌 Transport', '☕ Chai', ...],
  quickActions: [ ... ],
  panicTriggers: [ ... ]
}
```

---

### 2. Composite Pattern — Infinite Drill-Down Options

**Where:** `activityOptions` in config, `screens/log.ts` → `renderOptionsChips()`

**What it is:** `activityOptions` is a flat dictionary. An option string can itself be a key to another array of sub-options. This creates infinite nesting depth without any recursive data structures.

**Why it matters:** You can log `Phone → 📸 Insta → Reels` without predicting the depth at design time. Users can add sub-options to sub-options without touching any code.

```typescript
activityOptions: {
  'phone':      ['📞 Call', '📸 Insta', '▶️ YouTube', '💬 WhatsApp'],
  '📸 Insta':   ['Feed', 'Reels', 'DMs', 'Explore'],        // Insta is itself a key!
  '▶️ YouTube': ['Shorts', 'Long Form', 'Educational'],      // YouTube too!
  'workout':    ['🏃 Cardio', '🏋️ Weights', '🧘 Yoga'],
  '🏃 Cardio':  ['Treadmill', 'Cycling', 'Running outside']  // Cardio too!
}

// Core logic: if an option string exists as a key → it's a "folder", show ▾
// if it doesn't → it's a leaf, select it
```

**Navigation:** `optionsPath[]` array acts as breadcrumb stack. `enterOptionsFolder(key)` pushes to it; `optionsGoBack()` pops from it. Purely flat data, feels like a tree.

---

### 3. CSS Variable Design System

**Where:** `src/styles/app.css` → `:root { ... }`

**What it is:** Every color, spacing value, and border radius is a CSS custom property. The TypeScript `applyThemeVariables()` function sets these at runtime via `document.documentElement.style.setProperty()`.

**Why it matters:** Theme switching (including per-user customisation) is a one-liner. No CSS class toggling, no style tags injected. Runtime theming with zero flicker.

```css
:root {
  --bg: #0D0D0B;       /* main background */
  --amber: #E8A830;    /* primary accent */
  --teal: #2DC98A;     /* success/positive */
  --red: #E86060;      /* danger/ongoing */
  --r: 12px;           /* border radius */
}
```

---

### 4. Intent Comments

**Where:** Throughout all source files

**What it is:** Comments formatted as `// INTENT: ...` or `/* INTENT: ... */` explain **why** a piece of code exists, not what it does. The code itself shows what it does.

**Why it matters:** Future contributors (and future you) understand the reasoning behind non-obvious decisions without having to reverse-engineer them.

```typescript
// INTENT: Debounce cloud sync — we don't want a Firestore write on every
// keystroke of the intention input. 2 seconds gives a natural pause window.
let syncTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSyncToCloud() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncToCloud(), 2000);
}
```

---

### 5. 1-Hour Lock Window

**Where:** `state.ts` → `isLocked(createdAt: Date)`

**What it is:** Any timeline item or expense created more than 1 hour ago becomes locked — it shows a 🔒 icon instead of a delete button and cannot be removed.

**Why it matters:** Prevents accidental deletion of past logs. Once time has passed, the record is considered meaningful history. Users can still export/import data for full access.

```typescript
function isLocked(createdAt: Date): boolean {
  return (Date.now() - createdAt.getTime()) > 3_600_000; // 1 hour in ms
}
```

---

### 6. Scroll-Wheel Dial (Parallax CSS + JS)

**Where:** `screens/log.ts` → `updateWheel()`

**What it is:** A horizontal scroll-snap container where each item's distance from center is calculated to apply `translateY`, `rotate`, and `scale` transforms — creating a 3D rolling wheel effect without any 3D CSS or canvas.

**How it works:**
```typescript
const norm = Math.max(-1, Math.min(1, dist / (wheel.clientWidth / 1.5)));
item.style.transform = `translateY(${Math.abs(norm) * 25}px) rotate(${norm * 30}deg) scale(${1 - Math.abs(norm) * 0.3})`;
item.style.opacity = String(1 - Math.abs(norm) * 0.7);
```
- `norm` = normalised distance from center (-1 to 1)
- Items far from center: translated down, rotated, shrunk, faded
- Center item: no transform, full opacity, glowing border

---

### 7. Timeline Nesting Algorithm

**Where:** `screens/log.ts` → `renderTimeline()`

**What it is:** The timeline detects concurrent (overlapping) duration activities and renders them indented. Items that start while another duration item is still open are shown as nested children.

**How it works:**
```typescript
// Pass 1: calculate depth of each item
const activeDurations: TimelineItem[] = [];
sorted.forEach(item => {
  // Remove any durations that ended before this item started
  activeDurations.filter(d => d.endTime && d.endTime <= item.startTime);
  itemDepths.set(item.id, activeDurations.length); // depth = how many are still open
  if (item.type === 'duration') activeDurations.push(item);
});

// Pass 2: render with margin-left: depth * 14px
```

---

### 8. Context-Aware Generic Modal

**Where:** `screens/log.ts` → `showOptionsModal(act, mode)`

**What it is:** One modal component handles three completely different flows by switching its `mode`:
- `'instant'` — single select, logs immediately on tap, shows Cancel button
- `'start'` — multi-select before starting a duration, shows Skip + Save Log
- `'end'` — multi-select when ending a duration, appends details to the log entry

**Why it matters:** No duplicate modal HTML. All contexts share the same chip rendering, custom input, and breadcrumb navigation logic.

---

### 9. Gap Detection

**Where:** `screens/log.ts` → `renderTimeline()`

**What it is:** While rendering the timeline, if the gap between two adjacent top-level items exceeds 30 minutes, a warning row is automatically inserted showing the unaccounted time.

```typescript
const gap = Math.floor((item.startTime - lastTime) / 60_000);
if (gap >= 30) {
  // Insert: "⚠️ 1h 15m gap"
}
```

---

### 10. Battery Metaphor

**Where:** `screens/log.ts` → `updateBatteryDisplay()`

**What it is:** Mental energy is represented as a battery percentage (0–100) with 5 named states, each with its own color. The slider track itself is a live gradient showing the current level color.

| Range | Label | Color |
|-------|-------|-------|
| 0–20 | Drained | `--red` |
| 21–40 | Low | `--amber` |
| 41–60 | Okay | Yellow-ish |
| 61–80 | Good | `--teal` |
| 81–100 | High | `--blue` |

---

### 11. Panic / Fatal Loop System

**Where:** `screens/log.ts` → `togglePanic()`, `logPanic()`

**What it is:** A dedicated button for when you're caught in a procrastination/doom scroll loop. Tapping it opens a chip menu of predefined triggers (Procrastination, Stress, Boredom...) plus custom entry. Selecting a trigger logs a `duration` item with `isPanic: true` — which shows in the timeline in red.

**Why it matters:** Normalises the experience of being in a loop. Instead of shame, it's data. You can see patterns over time when building the dashboard.

---

## New Patterns Added in TypeScript Rewrite

### 12. Typed Event Bus

**Where:** `modules/events.ts`

**What it is:** A typed `EventEmitter`-style bus for cross-module communication. Instead of tight coupling between modules, they communicate through named events with typed payloads.

```typescript
type AppEvents = {
  'auth:signed-in': { uid: string; displayName: string; photoURL: string };
  'auth:signed-out': void;
  'vault:unlocked': { cryptoKey: CryptoKey };
  'state:saved': { date: string };
};

// auth.ts emits → settings.ts listens
events.emit('auth:signed-in', { uid, displayName, photoURL });
events.on('auth:signed-in', ({ uid }) => deriveKey(uid));
```

---

### 13. Debounced Cloud Sync

**Where:** `modules/db.ts` → `scheduleSyncToCloud()`

**What it is:** Every call to `saveState()` schedules a Firestore write — but resets the timer if called again within 2 seconds. This prevents a Firestore write on every single keystroke or slider drag.

```typescript
// Every keystroke in the intention input calls saveState()
// Without debounce: 20 Firestore writes per sentence typed
// With debounce: 1 Firestore write 2 seconds after you stop typing
```

---

### 14. Key Derivation (PBKDF2)

**Where:** `modules/crypto.ts` → `deriveKey(uid)`

**What it is:** The encryption key is never stored — it's re-derived from scratch on every sign-in using PBKDF2 with 310,000 iterations. This means even if Firestore is breached, data cannot be decrypted without the user's Google account.

See [e2ee.md](./e2ee.md) for full details.

---

### 15. Historical Day Documents

**Where:** `modules/db.ts`, Firestore `/users/{uid}/days/{YYYY-MM-DD}`

**What it is:** Each calendar day gets its own Firestore document. The current day is written on every save. Past days are read-only. This pattern enables the future analytics dashboard to query any date range.

```typescript
// New day starts when user logs "Wake Up"
// Previous day's document is closed, new document created for today
const todayRef = doc(db, `users/${uid}/days/${getDateKey()}`);
```
