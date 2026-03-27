# Progressive Web App (PWA)

## What is a PWA?

A Progressive Web App (PWA) is a website that the browser can "install" to behave like a native app:

- **Install to home screen** on Android/iOS — gets its own app icon
- **Launches full-screen** — no browser address bar
- **Works offline** — service worker caches assets
- **Loads instantly** — even on slow connections
- **Shows in Android app drawer** — feels native

Users visiting the site will see an **"Add to Home Screen"** prompt (on Android/Chrome it's automatic; on iOS it's via the Share menu).

---

## PWA Components

### 1. Web App Manifest (`/public/manifest.json`)

Tells the browser how to install and display the app.

```json
{
  "name": "Guru's Tracker",
  "short_name": "Tracker",
  "description": "Your personal life-OS — activities, money, tasks, energy.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0D0D0B",
  "theme_color": "#E8A830",
  "orientation": "portrait",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**Key fields:**

| Field | Value | What it does |
|-------|-------|-------------|
| `display: "standalone"` | — | Hides browser chrome (feels native) |
| `theme_color` | `#E8A830` (amber) | Colours the Android status bar |
| `background_color` | `#0D0D0B` (dark) | Colour shown while app loads |
| `start_url` | `/` | What URL opens when launched from home screen |
| `orientation` | `portrait` | Locks to portrait mode |

---

### 2. App Icons

Two sizes required:
- `icon-192.png` — Android home screen
- `icon-512.png` — Android splash screen, iOS, PWA install dialog

Icons should be:
- Square with transparent or dark background matching the app theme
- The amber 🔥 or a minimal tracker-style icon works well

---

### 3. Service Worker (`/public/sw.js`)

The service worker runs in the background and intercepts network requests. It caches the app shell (HTML, CSS, JS) so the app loads instantly on repeat visits — even offline.

**Caching Strategy: Cache First, Network Fallback**

```
Request comes in
  → Is it in cache? → Yes → Return cached version instantly
                   → No  → Fetch from network → Cache it → Return it
```

**What gets cached:**
- `index.html` — the app shell
- `assets/*.js` — compiled TypeScript (Vite bundles this)
- `assets/*.css` — compiled styles
- App icons

**What does NOT get cached:**
- Firestore requests (handled by Firestore SDK's own offline persistence)
- Google Auth requests (always need network)

---

### 4. `index.html` Registration

```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#E8A830">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Tracker">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
```

The `apple-*` meta tags are needed because iOS Safari doesn't fully support the Web App Manifest spec.

---

## Install Experience

### Android (Chrome)
1. Visit the app URL
2. Chrome shows an **"Add to Home Screen"** banner automatically (after a few visits)
3. Or: Chrome menu (⋮) → "Add to Home Screen"
4. App appears in the Android launcher like a native app

### iOS (Safari)
1. Visit the app URL in Safari
2. Tap the **Share button** (box with arrow)
3. Tap **"Add to Home Screen"**
4. Tap **"Add"**
5. App appears on home screen, launches full-screen

### Desktop (Chrome/Edge)
1. Visit the app URL
2. Click the **install icon** in the address bar (looks like a ⊕ or monitor with arrow)
3. App installs as a desktop app with its own window

---

## Offline Mode

Since sign-in is **required** to use this app, "offline mode" works like this:

1. **First visit:** Must be online — Firebase Auth needs a network connection to sign in
2. **Subsequent visits:** App loads from service worker cache instantly
3. **Firestore offline:** Firebase SDK has built-in offline persistence — the last loaded data is available offline. Writes queue and sync when back online.
4. **Cannot sign in offline:** Google OAuth requires a network roundtrip. Already signed-in sessions persist.

---

## Vite PWA Plugin

We use `vite-plugin-pwa` to automatically generate the service worker from Vite's build:

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default {
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: { /* same as manifest.json */ },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
}
```

This means:
- No need to manually write a service worker
- Workbox (Google's SW library) handles caching strategies
- `registerType: 'autoUpdate'` means when you deploy a new version, users get it automatically on next load

---

## Update Flow

When you deploy a new version of the app:

1. Service worker detects the new build (via a version hash)
2. On the user's next page load: old SW stays active, new SW installs in background
3. On the page load after that: new SW takes over, user gets the new version

This means deploys are **zero-downtime** — no one gets a broken experience during an update.
