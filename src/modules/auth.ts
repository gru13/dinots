import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User } from "firebase/auth";
import { app } from "../config";
import { deriveKey, lockVault } from "./crypto";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export let CURRENT_USER: User | null = null;
export let IS_VAULT_OPEN: boolean = false;

import { bootstrapToday, bootstrapConfig } from "./state";

/**
 * Attaches DOM listeners and initializes auth state monitoring.
 * Should be called once during app startup in main.ts.
 */
export function initAuth() {
  const loginBtn = document.getElementById("login-btn");
  const gateLoginBtn = document.getElementById("gate-login-btn");

  const setAuthGate = (locked: boolean) => {
    const gate = document.getElementById("auth-gate");
    if (!gate) return;
    gate.style.display = locked ? "flex" : "none";
  };

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      if (CURRENT_USER) {
        // User is logged in, meaning this button acts as "Sign out"
        await handleLogout();
      } else {
        await handleLogin();
      }
    });
  }

  if (gateLoginBtn) {
    gateLoginBtn.addEventListener("click", async () => {
      await handleLogin();
    });
  }

  // Fail-safe default: block app until auth state is confirmed.
  setAuthGate(true);

  // Monitor Auth State
  onAuthStateChanged(auth, async (user) => {
    CURRENT_USER = user;
    if (user) {
      console.log(`[AUTH] Logged in as: ${user.email} (UID: ${user.uid})`);
      updateAuthUI(user);
      setAuthGate(false);
      
      // derive the E2EE key and unlock the vault automatically.
      await deriveKey(user.uid);
      IS_VAULT_OPEN = true;
      updateVaultUI(true);

      // 1. Fetch encrypted user configuration
      await bootstrapConfig();
      // 2. Trigger DB sync load for today
      await bootstrapToday();
    } else {
      console.log("[AUTH] Not logged in.");
      lockVault(); // Clear derived AES keys
      IS_VAULT_OPEN = false;
      updateAuthUI(null);
      updateVaultUI(false);
      setAuthGate(true);
    }
  });
}

function updateAuthUI(user: User | null) {
  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  const userPhotoEl = document.getElementById("user-photo");
  const loginBtn = document.getElementById("login-btn");
  const headerUserNameEl = document.getElementById("header-user-name");

  if (user) {
    const fullName = user.displayName?.trim() || "User";
    const firstName = fullName.split(/\s+/)[0] || fullName;

    if (userNameEl) userNameEl.textContent = fullName;
    if (headerUserNameEl) headerUserNameEl.textContent = firstName;
    if (userEmailEl) userEmailEl.textContent = user.email || "";
    if (userPhotoEl && user.photoURL) {
      userPhotoEl.innerHTML = `<img src="${user.photoURL}" alt="avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    }
    if (loginBtn) {
      loginBtn.textContent = "Sign out";
      loginBtn.style.background = "var(--rb)";
      loginBtn.style.borderColor = "var(--rbr)";
      loginBtn.style.color = "var(--red)";
    }
  } else {
    // Reset to generic defaults
    if (userNameEl) userNameEl.textContent = "Guest User";
    if (headerUserNameEl) headerUserNameEl.textContent = "Guest";
    if (userEmailEl) userEmailEl.textContent = "Not signed in";
    if (userPhotoEl) userPhotoEl.innerHTML = "👤";
    if (loginBtn) {
      loginBtn.textContent = "Sign in with Google";
      loginBtn.style.background = "var(--teal)";
      loginBtn.style.borderColor = "var(--tbr)";
      loginBtn.style.color = "#0D0D0B";
    }
  }
}

function updateVaultUI(unlocked: boolean) {
  const icon = document.getElementById("vault-status-icon");
  const title = document.getElementById("vault-status-title");
  const desc = document.getElementById("vault-status-desc");

  if (unlocked) {
    if (icon) icon.textContent = "🔓";
    if (title) title.textContent = "Vault Unlocked";
    if (title) title.style.color = "var(--teal)";
    if (desc) desc.textContent = "Your data is currently E2E encrypted locally.";
  } else {
    if (icon) icon.textContent = "🔒";
    if (title) title.textContent = "Vault Locked";
    if (title) title.style.color = "var(--text)";
    if (desc) desc.textContent = "Sign in to unlock your data.";
  }
}

async function handleLogin() {
  try {
    console.log("[AUTH] Triggering Google Sign-In popup...");
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    alert("Failed to sign in. Check the console for details.");
  }
}

async function handleLogout() {
  try {
    console.log("[AUTH] Signing out...");
    await signOut(auth);
    // Once signed out, onAuthStateChanged will automatically clear the keys.
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
  }
}
