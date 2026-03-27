import './config';
import { initAuth, CURRENT_USER, IS_VAULT_OPEN } from './modules/auth';

import { initLogScreen } from './screens/log';
import { initMoneyScreen } from './screens/money';
import { initTasksScreen } from './screens/tasks';
import { initSettingsScreen } from './screens/settings';
import { bootstrapConfig, bootstrapToday, resetToTodayLocal, _getTodayStr } from './modules/state';

console.log('DINOTS initialized. Bootstrapping modules...');

// Set up the Top Date format
function updateTopDate() {
  const dateEl = document.getElementById('top-date');
  if (dateEl) {
    const d = new Date();
    dateEl.textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
updateTopDate();
setInterval(updateTopDate, 60000);

let lastSeenDate = _getTodayStr();

function handleDayRollover() {
  const today = _getTodayStr();
  if (today === lastSeenDate) return;

  lastSeenDate = today;
  console.log(`[MAIN] Day rollover detected: ${today}`);

  if (CURRENT_USER && IS_VAULT_OPEN) {
    bootstrapToday();
  } else {
    resetToTodayLocal();
  }
}

setInterval(handleDayRollover, 60000);

// 1. Initialize Authentication (This handles the login button and vault unlocking)
initAuth();

// 2. Initialize Core UI Interactors
initLogScreen();
initMoneyScreen();
initTasksScreen();
initSettingsScreen();

// 3. Apply default theme/labels immediately for guests (auth bootstraps cloud config on sign-in)
bootstrapConfig();

// Next steps: Init State, DB, and UI modules...

// --- Temporary Basic Navigation so you can switch to Settings and test Login ---
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    
    // Reset all tabs
    navBtns.forEach(b => {
      b.classList.remove('active');
      const dot = b.querySelector('.nav-dot') as HTMLElement;
      if (dot) dot.style.opacity = '0';
    });
    screens.forEach(s => s.classList.remove('active'));
    
    // Activate target
    btn.classList.add('active');
    const dot = btn.querySelector('.nav-dot') as HTMLElement;
    if (dot) dot.style.opacity = '1';
    
    const screen = document.getElementById(`screen-${target}`);
    if (screen) screen.classList.add('active');
  });
});
