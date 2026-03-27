# DINOTS — Daily IN Out Tracking System

> A mobile-first personal life-OS for tracking your daily ins and outs — activities, money, tasks, and mental energy.  
> Built with **TypeScript + Vite**, synced via **Firebase (Firestore)**, protected by **true End-to-End Encryption**.

![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)
![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%2B%20Firestore-orange)
![PWA](https://img.shields.io/badge/PWA-installable-purple)

---

## Features

- 📓 **Activity Logger** — scroll-wheel dial to log daily activities with duration tracking
- 🔋 **Mental Battery** — track your energy level throughout the day
- 💰 **Expense Tracker** — categorised spending with daily budget and distribution chart
- ✅ **Task List** — daily to-do with completion stats
- 🚨 **Panic Button** — log doom-scroll loops with trigger categorisation
- 🔐 **True E2EE** — data encrypted on your device before reaching Firebase (AES-GCM 256-bit)
- ☁️ **Firebase Sync** — automatic cloud backup, works across devices
- 📱 **PWA** — installable on Android/iOS, works offline
- 🎨 **Fully Configurable** — activities, categories, theme all driven by importable JSON config

---

## Tech Stack

| | Technology |
|-|-----------|
| Language | TypeScript |
| Bundler | Vite |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Cloud Firestore |
| Hosting | Firebase Hosting |
| Encryption | Web Crypto API (PBKDF2 + AES-GCM) |
| Styling | Vanilla CSS |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- A Google account (to create a Firebase project)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/dinots.git
cd dinots
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Firebase

You need your own Firebase project. Follow the step-by-step guide in **[docs/firebase-setup.md](./docs/firebase-setup.md)**.

It covers:
- Creating a Firebase project (free)
- Enabling Google Authentication
- Creating a Firestore database
- Getting your Firebase config keys

### 4. Configure environment variables

Copy the example env file and fill in your Firebase config:

```bash
cp .env.example .env.local
```

Open `.env.local` and replace the placeholder values with your Firebase project's config:

```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **These are your keys — never share `.env.local` publicly.**  
> The `.env.local` file is listed in `.gitignore` and will not be committed.

### 5. Deploy Firestore Security Rules

```bash
firebase use --add       # link CLI to your Firebase project
firebase deploy --only firestore:rules
```

### 6. Run locally

```bash
npm run dev              # starts at http://localhost:5173
```

### 7. Deploy to Firebase Hosting

```bash
npm run build            # compile TypeScript → dist/
firebase deploy          # upload to Firebase
```

Your app is now live at `https://YOUR_PROJECT_ID.web.app` 🚀

---

## How E2EE Works

Every user's data is encrypted on their own device before it reaches Firebase:

1. You sign in with Google → we get your stable Google UID
2. A 256-bit AES-GCM key is derived from your UID using PBKDF2 (310,000 iterations)
3. Your daily data (activities, expenses, tasks) is encrypted with this key
4. Only the ciphertext is sent to Firestore — Firebase sees nothing readable
5. On next sign-in, the same key is re-derived and your data decrypts automatically

**The key is never stored anywhere.** If you lose your Google account, data cannot be recovered.  
→ Use the **Export Logs** feature regularly as a backup.

Full details: [docs/e2ee.md](./docs/e2ee.md)

---

## Project Structure

```
dinots/
├── src/
│   ├── main.ts              ← entry point
│   ├── config.ts            ← DEFAULT_CONFIG
│   ├── types/index.ts       ← TypeScript interfaces
│   ├── modules/
│   │   ├── crypto.ts        ← E2EE engine
│   │   ├── auth.ts          ← Firebase Auth
│   │   ├── db.ts            ← Firestore sync
│   │   ├── state.ts         ← app state
│   │   └── events.ts        ← event bus
│   ├── screens/
│   │   ├── log.ts
│   │   ├── money.ts
│   │   ├── tasks.ts
│   │   └── settings.ts
│   └── styles/app.css
├── docs/                    ← full documentation
├── public/                  ← PWA icons, manifest
├── .env.example             ← env variable template
├── firebase.json            ← hosting config
├── firestore.rules          ← security rules
└── vite.config.ts
```

---

## Documentation

| Doc | Contents |
|-----|---------|
| [docs/architecture.md](./docs/architecture.md) | Tech stack, file structure, data flow |
| [docs/patterns.md](./docs/patterns.md) | All 15 design patterns explained |
| [docs/database.md](./docs/database.md) | Firestore schema, sync strategy, security rules |
| [docs/e2ee.md](./docs/e2ee.md) | Encryption deep dive — algorithms, key derivation |
| [docs/firebase-setup.md](./docs/firebase-setup.md) | Firebase project creation guide |
| [docs/pwa.md](./docs/pwa.md) | PWA manifest, service worker, install guide |

---

## Contributing

Pull requests are welcome. For major changes, please open an issue first.

---

## License

[MIT](./LICENSE) © 2026 Guru

---

> **DINOTS** — *Daily IN Out Tracking System*
