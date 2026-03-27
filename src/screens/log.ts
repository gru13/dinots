import { addTimelineLog, setIntention, setBattery, STATE, CONFIG, resetForStartDay } from '../modules/state';
import { events, EVENTS } from '../modules/events';
import {
  setupOptionsModal as bindOptionsModal,
  showOptionsModal,
  rerenderOptionsIfOpen
} from './log/log-options';
import { setupQuickActions as bindQuickActions } from './log/log-quick';
import { renderTimeline as renderTimelineList } from './log/log-timeline';

// ---------- INTERNAL APP LOGIC ----------
let activeWheelId = 'wake';

let pendingWakeActivity: { id: string; emoji: string; label: string; type: 'instant' | 'duration' } | null = null;
const WHEEL_LOOP_COPIES = 3;

function getBatteryMeta(val: number) {
  if (val <= 20) return { color: 'var(--red)', label: 'Drained' };
  if (val <= 40) return { color: 'var(--amber)', label: 'Low' };
  if (val <= 60) return { color: '#D3D04F', label: 'Okay' };
  if (val <= 80) return { color: 'var(--teal)', label: 'Good' };
  return { color: 'var(--blue)', label: 'High' };
}

export function initLogScreen() {
  console.log('[SCREENS] Hooking up Log Screen interactions...');

  // 1. Intention Input
  const intInput = document.getElementById('daily-intention') as HTMLInputElement;
  if (intInput) {
    intInput.addEventListener('input', e => setIntention((e.target as HTMLInputElement).value));
    intInput.addEventListener('change', e => setIntention((e.target as HTMLInputElement).value));
  }

  // 2. Battery Slider
  const batSlider = document.getElementById('battery-slider') as HTMLInputElement;
  if (batSlider) {
    let lastCommittedBattery = Number.isFinite(STATE.battery) ? STATE.battery : 60;

    const applyBattery = (val: number, logEntry: boolean) => {
      updateBatteryDisplay(val);
      setBattery(val);

      // Log only when user commits a changed value to avoid timeline spam while dragging.
      if (logEntry && val !== lastCommittedBattery) {
        const meta = getBatteryMeta(val);
        addTimelineLog('battery', '🔋', `Battery ${meta.label}: ${val}%`, 'instant');
        lastCommittedBattery = val;
      }
    };

    const onBatteryInput = (e: Event) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      if (Number.isFinite(val)) applyBattery(val, false);
    };

    const onBatteryChange = (e: Event) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      if (Number.isFinite(val)) applyBattery(val, true);
    };

    batSlider.addEventListener('input', onBatteryInput);
    batSlider.addEventListener('change', onBatteryChange);

    events.on(EVENTS.STATE_READY, (state: any) => {
      lastCommittedBattery = state.battery || 60;
    });
  }

  // 3. Activity Dial
  const wheel = document.getElementById('wheel');
  if (wheel) {
    wheel.addEventListener('scroll', () => requestAnimationFrame(() => {
      normalizeInfiniteWheelScroll(wheel);
      updateWheel();
    }));
    enableHorizontalWheelScroll(wheel);
  }

  const legacyCustomBtn = document.getElementById('log-custom-trigger');
  if (legacyCustomBtn) legacyCustomBtn.remove();

  // 4. State Binding
  events.on(EVENTS.STATE_READY, (state: any) => {
    if (intInput) intInput.value = state.intention || '';
    if (batSlider) {
      batSlider.value = state.battery || 60;
      updateBatteryDisplay(state.battery || 60);
    }
  });

  events.on(EVENTS.TIMELINE_UPDATED, () => {
    renderActivities();
    renderTimeline();
    updateWheel();
  });
  
  events.on(EVENTS.CONFIG_UPDATED, () => {
    renderActivities();
    setupQuickActions();
    rerenderOptionsIfOpen();
  });

  // ---------- SETUP UI SECTIONS ----------
  renderActivities();
  renderTimeline();
  setupQuickActions();
  setupOptionsModal();
  setupStartSleepModals();
}

function enableHorizontalWheelScroll(el: HTMLElement) {
  // Let mouse wheel/trackpad vertical motion move horizontal chip rows naturally.
  el.addEventListener('wheel', (e: WheelEvent) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    el.scrollBy({ left: e.deltaY, behavior: 'auto' });
    e.preventDefault();
  }, { passive: false });
}

// ═══════════════════════════════════════════════
// DIAL & BATTERY LOGIC
// ═══════════════════════════════════════════════

function updateBatteryDisplay(val: number) {
  const display = document.getElementById('battery-val-display');
  const slider = document.getElementById('battery-slider');
  if (!display || !slider) return;

  const meta = getBatteryMeta(val);

  display.style.color = meta.color; 
  display.textContent = `(${meta.label}) 🔋 ${val}%`;
  slider.style.background = `linear-gradient(to right, var(--red) 0%, ${meta.color} ${val}%, var(--bg3) ${val}%)`;
}

function renderActivities() {
  const wheel = document.getElementById('wheel');
  if (!wheel) return;
  const activities = Array.isArray(CONFIG.activities) ? CONFIG.activities : [];
  if (activities.length === 0) {
    wheel.innerHTML = '';
    return;
  }

  if (!activities.some((a: any) => a.id === activeWheelId)) {
    activeWheelId = activities[0].id;
  }

  const allCopies: string[] = [];
  for (let copy = 0; copy < WHEEL_LOOP_COPIES; copy++) {
    const copyHtml = activities.map((a: any, idx: number) => {
      const isOngoing = STATE.timeline.find(t => t.baseId === a.id && t.type === 'duration' && !t.endTime);
      return `
      <div class="wheel-item" data-id="${a.id}" data-base-index="${idx}" data-loop-copy="${copy}" data-active="${a.id === activeWheelId}">
        ${isOngoing ? '<div class="wheel-ongoing-dot">•</div>' : ''}
        <div class="wheel-emoji">${a.emoji}</div>
        <div class="wheel-label">${a.label}</div>
        <div class="wheel-hint" id="hint-${a.id}-${copy}-${idx}">Tap to log</div>
      </div>
    `;
    }).join('');
    allCopies.push(copyHtml);
  }

  wheel.innerHTML = allCopies.join('');

  const firstInCopy0 = wheel.querySelector('.wheel-item[data-loop-copy="0"][data-base-index="0"]') as HTMLElement | null;
  const firstInCopy1 = wheel.querySelector('.wheel-item[data-loop-copy="1"][data-base-index="0"]') as HTMLElement | null;
  if (firstInCopy0 && firstInCopy1) {
    wheel.dataset.loopCycleWidth = String(firstInCopy1.offsetLeft - firstInCopy0.offsetLeft);
  }

  centerWheelOnActive();
  updateWheel();

  // Re-attach clicks
  document.querySelectorAll('.wheel-item').forEach(el => {
    el.addEventListener('click', () => {
      if (el.getAttribute('data-active') === "true") logSelectedActivity();
      else scrollToItem(el as HTMLElement);
    });
  });
}

function scrollToItem(el: HTMLElement) {
  const wheel = document.getElementById('wheel');
  if (wheel) wheel.scrollTo({ left: el.offsetLeft + el.offsetWidth/2 - wheel.clientWidth/2, behavior: 'smooth' });
}

function updateWheel() {
  const wheel = document.getElementById('wheel'); 
  if (!wheel) return;
  normalizeInfiniteWheelScroll(wheel);
  const items = document.querySelectorAll('.wheel-item') as NodeListOf<HTMLElement>;
  const center = wheel.scrollLeft + wheel.clientWidth / 2;
  let min = Infinity;
  let closest: string | null = null;

  items.forEach(item => {
    const dist = (item.offsetLeft + item.offsetWidth / 2) - center;
    const norm = Math.max(-1, Math.min(1, dist / (wheel.clientWidth / 1.5)));
    item.style.transform = `translateY(${Math.abs(norm)*25}px) rotate(${norm*30}deg) scale(${1-Math.abs(norm)*0.3})`;
    item.style.opacity = (1 - Math.abs(norm) * 0.7).toString();
    if (Math.abs(dist) < min) { min = Math.abs(dist); closest = item.getAttribute('data-id'); }
  });

  if (activeWheelId !== closest && closest !== null) {
    activeWheelId = closest;
    items.forEach(i => i.setAttribute('data-active', i.getAttribute('data-id') === closest ? "true" : "false"));
  }

  const act = CONFIG.activities.find((a: any) => a.id === activeWheelId);
  const marker = document.getElementById('dial-marker');
  if (act && marker) {
    let color = act.color || "var(--amber)";
    let text = act.actionText || "Tap to log";
    if (STATE.timeline.find(t => t.baseId === act.id && t.type === 'duration' && !t.endTime)) { 
      color = "var(--red)"; text = "🔴 Tap to Stop"; 
    }
    marker.style.borderColor = color; 
    marker.style.boxShadow = `0 0 20px ${color}33`;
    const activeItem = document.querySelector(`.wheel-item[data-active="true"]`) as HTMLElement | null;
    const hint = activeItem?.querySelector('.wheel-hint') as HTMLElement | null;
    if (hint) { hint.textContent = text; hint.style.color = color; }
  }
}

function centerWheelOnActive() {
  const wheel = document.getElementById('wheel');
  if (!wheel) return;

  const activeInMiddle = wheel.querySelector(`.wheel-item[data-id="${activeWheelId}"][data-loop-copy="1"]`) as HTMLElement | null;
  if (!activeInMiddle) return;

  wheel.scrollLeft = activeInMiddle.offsetLeft + activeInMiddle.offsetWidth / 2 - wheel.clientWidth / 2;
}

function normalizeInfiniteWheelScroll(wheel: HTMLElement) {
  const cycleWidth = Number(wheel.dataset.loopCycleWidth || 0);
  if (!Number.isFinite(cycleWidth) || cycleWidth <= 0) return;

  const left = wheel.scrollLeft;
  const lowerBound = cycleWidth * 0.75;
  const upperBound = cycleWidth * 2.25;
  if (left < lowerBound || left > upperBound) {
    const normalized = ((left % cycleWidth) + cycleWidth) % cycleWidth;
    wheel.scrollLeft = normalized + cycleWidth;
  }
}

function logSelectedActivity() {
  const act = CONFIG.activities.find((a: any) => a.id === activeWheelId);
  if (!act) return;

  // Special flow from stater: wake starts a fresh day modal, sleep triggers wrap-up modal.
  if (act.id === 'sleep') {
    showEndDayModal();
    return;
  }
  if (act.id === 'wake') {
    showStartDayModal(act);
    return;
  }

  const isOngoing = STATE.timeline.find(t => t.baseId === act.id && t.type === 'duration' && !t.endTime);

  if (act.optionsType === 'end' && isOngoing) {
    showOptionsModal(act, 'end');
  } else if (act.optionsType === 'start' && !isOngoing) {
    showOptionsModal(act, 'start');
  } else if (act.optionsType && !isOngoing && act.type === 'instant') {
    showOptionsModal(act, 'instant');
  } else {
    addTimelineLog(act.id, act.emoji, act.label, act.type as any);
  }
}

function setupStartSleepModals() {
  document.getElementById('btn-eod-missed')?.addEventListener('click', () => finishDay(false));
  document.getElementById('btn-eod-crushed')?.addEventListener('click', () => finishDay(true));
  document.getElementById('btn-sd-cancel')?.addEventListener('click', cancelStartDay);
  document.getElementById('btn-sd-start')?.addEventListener('click', confirmStartDay);
}

function showEndDayModal() {
  const intention = (document.getElementById('daily-intention') as HTMLInputElement | null)?.value?.trim() || 'No One Thing set';
  const text = document.getElementById('eod-intention-text');
  const modal = document.getElementById('eod-modal');
  if (text) text.textContent = intention;
  if (modal) modal.style.display = 'flex';
}

function finishDay(crushed: boolean) {
  addTimelineLog('sleep', '🌙', crushed ? 'Goal Crushed' : 'Goal Missed', 'instant');
  const modal = document.getElementById('eod-modal');
  if (modal) modal.style.display = 'none';
}

function showStartDayModal(act: any) {
  pendingWakeActivity = { id: act.id, emoji: act.emoji, label: act.label, type: act.type as 'instant' | 'duration' };
  const goalInput = document.getElementById('new-day-intention') as HTMLInputElement | null;
  const currentIntention = (document.getElementById('daily-intention') as HTMLInputElement | null)?.value || '';
  if (goalInput) goalInput.value = currentIntention;
  const modal = document.getElementById('start-day-modal');
  if (modal) modal.style.display = 'flex';
}

function confirmStartDay() {
  if (!pendingWakeActivity) return;

  const goalInput = document.getElementById('new-day-intention') as HTMLInputElement | null;
  const newIntention = goalInput?.value?.trim() || '';

  resetForStartDay(newIntention);
  addTimelineLog(pendingWakeActivity.id, pendingWakeActivity.emoji, pendingWakeActivity.label, pendingWakeActivity.type);

  if (goalInput) goalInput.value = '';
  const modal = document.getElementById('start-day-modal');
  if (modal) modal.style.display = 'none';
  pendingWakeActivity = null;
}

function cancelStartDay() {
  const modal = document.getElementById('start-day-modal');
  if (modal) modal.style.display = 'none';
  pendingWakeActivity = null;
}

// ═══════════════════════════════════════════════
// MODULARIZED SECTIONS
// ═══════════════════════════════════════════════

function setupOptionsModal() {
  bindOptionsModal();
}

function setupQuickActions() {
  bindQuickActions(enableHorizontalWheelScroll, showOptionsModal);
}

function renderTimeline() {
  renderTimelineList();
}
