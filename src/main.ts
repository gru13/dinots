import './config';
import { initAuth } from './modules/auth';

import { initLogScreen } from './screens/log';

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

// 1. Initialize Authentication (This handles the login button and vault unlocking)
initAuth();

// 2. Initialize Core UI Interactors
initLogScreen();

// Next steps: Init State, DB, and UI modules...

// --- Temporary Basic Navigation so you can switch to Settings and test Login ---
const navBtns = document.querySelectorAll('.nav-btn');
const screens = document.querySelectorAll('.screen');

navBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
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
