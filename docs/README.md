# DINOTS — Project Documentation

> **DINOTS** = **D**aily **IN** **O**ut **T**racking **S**ystem  
> A personal app for tracking your daily ins and outs — activities, money, tasks, and mental energy.  
> Built with **TypeScript + Vite**, synced via **Firebase (Firestore)**, protected by **true End-to-End Encryption**.

---

## What This App Does

Guru's Tracker is a mobile-first daily life logger. Every day you:
- Log activities on a scroll-wheel dial (Wake Up → Commute → Office → Workout → Sleep)
- Track your mental "battery" (energy level 0–100%)
- Set a daily intention (your non-negotiable goal)
- Log expenses by category with a daily budget
- Manage a task list
- Hit the "Panic" button when you're in a doom scroll loop

All data is encrypted on your device before it ever reaches the cloud. Firebase sees only encrypted blobs — nothing readable.

---

## Documentation Index

| File | What it covers |
|------|---------------|
| [architecture.md](./architecture.md) | Tech stack, project structure, module overview |
| [patterns.md](./patterns.md) | All design patterns used — original + new |
| [database.md](./database.md) | Firestore schema, document structure, sync strategy |
| [e2ee.md](./e2ee.md) | End-to-End Encryption — how keys work, what gets encrypted |
| [firebase-setup.md](./firebase-setup.md) | Step-by-step Firebase project creation guide |
| [pwa.md](./pwa.md) | Progressive Web App — manifest, service worker, install flow |

---

## Quick Start (After Firebase Setup)

```bash
# Install dependencies
npm install

# Start dev server (localhost:5173)
npm run dev

# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy
```

---

## Key Principles

1. **Your data, your key** — encryption key is derived from your Google UID. Never stored anywhere.
2. **Works offline first** — sign-in required, but data is cached locally for offline use via service worker.
3. **Config is king** — the entire UI (labels, activities, theme) is driven by a single JSON config object.
4. **One lock per hour** — logged items auto-lock after 1 hour to protect data integrity.
5. **One blob per day** — all of today's sensitive data is encrypted as a single Firestore document.
