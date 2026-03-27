# Firebase Setup Guide

## Step 1 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. **Project name:** `gurus-tracker` (or whatever you like — this is just a display name)
4. **Project ID:** Firebase will suggest one like `gurus-tracker-abc12` — you can customise this. This becomes your URL: `https://gurus-tracker-abc12.web.app`
5. **Google Analytics:** You can disable it — we don't need it
6. Click **"Create project"** → wait ~30 seconds

---

## Step 2 — Enable Google Authentication

1. In the Firebase console, go to **Build → Authentication** or search for it in "search for products"
2. Click **"Get started"**
3. Under **"Sign-in providers"**, click **Google**
4. Toggle **Enable** → ON
5. Set a **public-facing name** for your app (e.g. "Guru's Tracker") — this shows in the Google sign-in popup
6. Set a **support email** (your email)
7. Click **Save**

---

## Step 3 — Create Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** ← Important (we'll add our own rules)
4. Choose a **location** — pick the closest to you:
   - India: `asia-south1` (Mumbai) ← recommended
5. Click **"Create"**

> **Note:** Once you pick a location, you **cannot change it**. Pick wisely.

---

## Step 4 — Enable Firebase Hosting

1. Go to **Build → Hosting**
2. Click **"Get started"**
3. Follow the prompts — you'll finish setup via CLI (next steps below)

---

## Step 5 — Get Your Firebase Config

1. Go to **Project Settings** (gear icon ⚙️ next to "Project Overview")
2. Scroll to **"Your apps"** section
3. Click the **`</>`** (Web) icon to add a web app
4. **App nickname:** `dinots-web`
5. Check **"Also set up Firebase Hosting"**`
6. Click **"Register app"**
7. You'll see a config object like this — **copy it**:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "gurus-tracker-abc12.firebaseapp.com",
  projectId: "gurus-tracker-abc12",
  storageBucket: "gurus-tracker-abc12.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

8. This config goes into `src/config.ts` in the project (I'll add a placeholder — you replace it with yours)

---

## Step 6 — Install Firebase CLI

```bash
npm install -g firebase-tools
```

---

## Step 7 — Login to Firebase

```bash
firebase login
```

This opens a browser window — sign in with the same Google account you used to create the project.

---

## Step 8 — Link Project to CLI

Run this inside the `dinots/` folder:

```bash
firebase use --add
```

- Select your project from the list
- Give it alias: `default`

This creates `.firebaserc` which links the folder to your Firebase project.

---

## Step 9 — Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

This uploads `firestore.rules` to Firebase, securing your database.

---

## Step 10 — Deploy the App

```bash
npm run build          # Compile TypeScript → dist/
firebase deploy        # Upload to Firebase Hosting
```

Your app is now live at `https://gurus-tracker-abc12.web.app` 🚀

---

## Authorised Domains (Important for Google Sign-In)

For Google Sign-In to work, Firebase needs to know which domains are allowed to trigger the OAuth popup.

1. Go to **Authentication → Settings → Authorised domains**
2. `localhost` is already there (for development)
3. Your Firebase Hosting domain (`gurus-tracker-abc12.web.app`) is added automatically on first deploy
4. If you ever add a custom domain, add it here too

---

## Free Tier Limits Reference

| Service | Free Limit | Notes |
|---------|-----------|-------|
| Authentication | Unlimited sign-ins | No cost ever |
| Firestore Reads | 50,000 / day | Resets daily |
| Firestore Writes | 20,000 / day | Resets daily |
| Firestore Storage | 1 GB | Cumulative |
| Hosting Bandwidth | 360 MB / day | More than enough for a small app |
| Hosting Storage | 10 GB | For your built files |

For 10–30 users doing normal daily tracking, you'll use less than 2% of these limits.

---

## Project ID Reference

Once created, note your project details here:

```
Firebase Project ID : ________________________________
Firebase App URL    : https://_________________.web.app
Firestore Region    : ________________________________
```

You'll need the Project ID when running `firebase use --add`.
