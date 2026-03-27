import { addTimelineLog, setIntention, setBattery, deleteTimelineLog, STATE, TimelineItem, CONFIG, addCustomActivityOption, addCustomQuickAction } from '../modules/state';
import { events, EVENTS } from '../modules/events';

// ---------- INTERNAL APP LOGIC ----------
let activeWheelId = 'wake';

// Options Modal variables
let activeOptionsContext: { act: any, mode: 'start'|'end'|'instant', optionsKey: string } | null = null;
let selectedOptions = new Set<string>();
let optionsPath: string[] = [];

export function initLogScreen() {
  console.log('[SCREENS] Hooking up Log Screen interactions...');

  // 1. Intention Input
  const intInput = document.getElementById('daily-intention') as HTMLInputElement;
  if (intInput) intInput.addEventListener('change', e => setIntention((e.target as HTMLInputElement).value));

  // 2. Battery Slider
  const batSlider = document.getElementById('battery-slider') as HTMLInputElement;
  if (batSlider) {
    batSlider.addEventListener('change', e => setBattery(parseInt((e.target as HTMLInputElement).value)));
    batSlider.addEventListener('input', e => updateBatteryDisplay(parseInt((e.target as HTMLInputElement).value)));
  }

  // 3. Activity Dial
  const wheel = document.getElementById('wheel');
  if (wheel) wheel.addEventListener('scroll', () => requestAnimationFrame(updateWheel));

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
    if (document.getElementById('options-modal')?.style.display === 'flex') {
      renderOptionsChips();
    }
  });

  // ---------- SETUP UI SECTIONS ----------
  renderActivities();
  renderTimeline();
  setupQuickActions();
  setupOptionsModal();
}

// ═══════════════════════════════════════════════
// DIAL & BATTERY LOGIC
// ═══════════════════════════════════════════════

function updateBatteryDisplay(val: number) {
  const display = document.getElementById('battery-val-display');
  const slider = document.getElementById('battery-slider');
  if (!display || !slider) return;

  let c = 'var(--text)', l = 'Okay';
  if (val <= 20) { c = 'var(--red)'; l = 'Drained'; } 
  else if (val <= 40) { c = 'var(--amber)'; l = 'Low'; } 
  else if (val <= 60) { c = '#D3D04F'; l = 'Okay'; } 
  else if (val <= 80) { c = 'var(--teal)'; l = 'Good'; } 
  else { c = 'var(--blue)'; l = 'High'; }

  display.style.color = c; 
  display.textContent = `(${l}) 🔋 ${val}%`;
  slider.style.background = `linear-gradient(to right, var(--red) 0%, ${c} ${val}%, var(--bg3) ${val}%)`;
}

function renderActivities() {
  const wheel = document.getElementById('wheel');
  if (!wheel) return;
  
  const scroll = wheel.scrollLeft;
  wheel.innerHTML = CONFIG.activities.map((a: any) => {
    const isOngoing = STATE.timeline.find(t => t.baseId === a.id && t.type === 'duration' && !t.endTime);
    return `
      <div class="wheel-item" data-id="${a.id}" data-active="${a.id === activeWheelId}">
        ${isOngoing ? '<div class="wheel-ongoing-dot">•</div>' : ''}
        <div class="wheel-emoji">${a.emoji}</div>
        <div class="wheel-label">${a.label}</div>
        <div class="wheel-hint" id="hint-${a.id}">Tap to log</div>
      </div>
    `;
  }).join('');
  
  wheel.scrollLeft = scroll;
  updateWheel();

  // Re-attach clicks
  document.querySelectorAll('.wheel-item').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-id');
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
  const items = document.querySelectorAll('.wheel-item') as NodeListOf<HTMLElement>;
  const center = wheel.scrollLeft + wheel.clientWidth / 2;
  let min = Infinity, closest = null;

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
    const hint = document.getElementById('hint-' + act.id);
    if (hint) { hint.textContent = text; hint.style.color = color; }
  }
}

function logSelectedActivity() {
  const act = CONFIG.activities.find((a: any) => a.id === activeWheelId);
  if (!act) return;

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

// ═══════════════════════════════════════════════
// OPTIONS MODAL (LAYERED ARCHITECTURE)
// ═══════════════════════════════════════════════

function setupOptionsModal() {
  document.getElementById('opt-close-btn')?.addEventListener('click', hideCustomOption);
  document.getElementById('opt-skip-btn')?.addEventListener('click', skipOptionsLog);
  document.getElementById('opt-save-btn')?.addEventListener('click', saveOptionsLog);
  document.getElementById('opt-cancel-btn')?.addEventListener('click', () => {
    document.getElementById('options-modal')!.style.display = 'none';
  });
  document.getElementById('opt-submit-btn')?.addEventListener('click', submitCustomOption);
}

function showOptionsModal(act: any, mode: 'start'|'end'|'instant') {
  activeOptionsContext = { act, mode, optionsKey: act.optionsKey };
  selectedOptions.clear();
  optionsPath = []; // Reset sub-level breadcrumbs
  
  const titleEl = document.getElementById('lbl-options-modal');
  if (titleEl) {
    if (mode === 'start') titleEl.textContent = CONFIG.ui.sections.optionsModalStartTitle;
    else if (mode === 'instant') titleEl.textContent = CONFIG.ui.sections.optionsModalInstantTitle;
    else titleEl.textContent = CONFIG.ui.sections.optionsModalEndTitle;
  }

  const mBtns = document.getElementById('options-multi-btns');
  const sBtns = document.getElementById('options-single-btns');
  if (mBtns) mBtns.style.display = (mode === 'instant') ? 'none' : 'flex';
  if (sBtns) sBtns.style.display = (mode === 'instant') ? 'flex' : 'none';

  hideCustomOption();
  renderOptionsChips();
  document.getElementById('options-modal')!.style.display = 'flex';
}

function renderOptionsChips() {
  const wrap = document.getElementById('options-chips-wrap');
  if (!wrap || !activeOptionsContext) return;

  const currentKey = optionsPath.length > 0 ? optionsPath[optionsPath.length - 1] : activeOptionsContext.optionsKey;
  const currentList = (CONFIG.activityOptions as any)[currentKey] || [];
  
  let html = '';
  // Show a back button if in a nested layer
  if (optionsPath.length > 0) {
    html += `<button class="quick-chip" style="background:var(--bg3); color:var(--text3); border-color:var(--border);" data-options-action="back">🔙 Back</button>`;
  }

  const prefix = optionsPath.length > 0 ? optionsPath.join(' • ') + ' • ' : '';
  
  currentList.forEach((o: string) => {
    const safeVal = o.replace(/'/g, "\\'");
    const fullPathVal = prefix + o;
    
    // Core Composite logic: Is this string a key pointing to another array layer?
    if ((CONFIG.activityOptions as any)[o] && Array.isArray((CONFIG.activityOptions as any)[o])) {
       html += `<button class="quick-chip" style="border-color:var(--teal); color:var(--teal);" data-options-folder="${safeVal}">${o} ▾</button>`;
    } else {
       if (activeOptionsContext!.mode === 'instant') {
         html += `<button class="quick-chip" data-options-instant="${fullPathVal}">${o}</button>`;
       } else {
         const isActive = selectedOptions.has(fullPathVal) ? 'active' : '';
         html += `<button class="quick-chip ${isActive}" data-options-toggle="${fullPathVal}">${o}</button>`;
       }
    }
  });

  html += `<button class="quick-chip" id="options-custom-trigger">+ Custom</button>`;
  wrap.innerHTML = html;

  // Events for dynamic chips
  wrap.querySelectorAll('[data-options-action="back"]').forEach(e => e.addEventListener('click', () => {
    optionsPath.pop(); renderOptionsChips();
  }));
  wrap.querySelectorAll('[data-options-folder]').forEach(e => e.addEventListener('click', (el) => {
    optionsPath.push(e.getAttribute('data-options-folder')!); renderOptionsChips();
  }));
  wrap.querySelectorAll('[data-options-instant]').forEach(e => e.addEventListener('click', () => {
    logInstantOption(e.getAttribute('data-options-instant')!);
  }));
  wrap.querySelectorAll('[data-options-toggle]').forEach(e => e.addEventListener('click', () => {
    const val = e.getAttribute('data-options-toggle')!;
    if (selectedOptions.has(val)) selectedOptions.delete(val);
    else selectedOptions.add(val);
    renderOptionsChips();
  }));
  document.getElementById('options-custom-trigger')?.addEventListener('click', showCustomOption);
}

function showCustomOption() {
  document.getElementById('options-chips-wrap')!.style.display = 'none';
  document.getElementById('options-custom-wrap')!.style.display = 'flex';
}
function hideCustomOption() {
  const cw = document.getElementById('options-custom-wrap');
  if (cw) cw.style.display = 'none';
  document.getElementById('options-chips-wrap')!.style.display = 'flex';
}
function submitCustomOption() {
  const eIn = document.getElementById('options-emoji-input') as HTMLInputElement;
  const oIn = document.getElementById('options-input') as HTMLInputElement;
  const label = oIn.value.trim();
  if (label && activeOptionsContext) {
    const text = (eIn.value || '') + (eIn.value ? ' ' : '') + label;
    const prefix = optionsPath.length > 0 ? optionsPath.join(' • ') + ' • ' : '';
    const fullVal = prefix + text;
    
    // Auto-save the custom option layer statically using state mutator
    const currentKey = optionsPath.length > 0 ? optionsPath[optionsPath.length - 1] : activeOptionsContext.optionsKey;
    addCustomActivityOption(currentKey, text); // <--- Hooks into state config save!

    if (activeOptionsContext.mode === 'instant') logInstantOption(fullVal);
    else { selectedOptions.add(fullVal); renderOptionsChips(); hideCustomOption(); }
    oIn.value = '';
  }
}
function logInstantOption(val: string) {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  addTimelineLog(act.id, act.emoji, act.label + ` (${val})`, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
  activeOptionsContext = null;
}
function skipOptionsLog() {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  addTimelineLog(act.id, act.emoji, act.label, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
}
function saveOptionsLog() {
  if (!activeOptionsContext) return;
  const act = activeOptionsContext.act;
  const suffix = selectedOptions.size > 0 ? ` (${Array.from(selectedOptions).join(', ')})` : '';
  addTimelineLog(act.id, act.emoji, act.label + suffix, act.type);
  document.getElementById('options-modal')!.style.display = 'none';
}


// ═══════════════════════════════════════════════
// QUICK ACTIONS & PANIC
// ═══════════════════════════════════════════════

function setupQuickActions() {
  const qaWrap = document.getElementById('qa-scroll-wrap');
  if (qaWrap) {
    // Note: requested by user to put `+ Custom` first.
    let html = `<button class="quick-chip" id="qa-custom-trigger">+ Custom</button>`;
    html += CONFIG.quickActions.map((qa: any) => `<button class="quick-chip" data-qa-id="${qa.id}">${qa.emoji} ${qa.label}</button>`).join('');
    qaWrap.innerHTML = html;

    qaWrap.querySelectorAll('.quick-chip[data-qa-id]').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-qa-id');
        const action = CONFIG.quickActions.find((q: any) => q.id === id);
        if (!action) return;

        if (action.optionsType) {
          showOptionsModal(action, action.optionsType as any);
        } else {
          addTimelineLog(action.id, action.emoji, action.label, action.type as any);
        }
      });
    });

    document.getElementById('qa-custom-trigger')?.addEventListener('click', () => {
      document.getElementById('qa-input-wrap')!.style.display = 'flex';
      qaWrap.style.display = 'none';
    });
    document.getElementById('qa-close-btn')?.addEventListener('click', () => {
      document.getElementById('qa-input-wrap')!.style.display = 'none';
      qaWrap.style.display = 'flex';
    });
    document.getElementById('qa-submit-btn')?.addEventListener('click', () => {
      const emoji = (document.getElementById('qa-emoji-input') as HTMLInputElement).value || '📌';
      const label = (document.getElementById('qa-input') as HTMLInputElement).value.trim();
      const type = (document.getElementById('qa_type_val') as HTMLInputElement).value as 'instant'|'duration';
      if (label) {
        // Auto-save customized quick action to permanent config FIRST to get the DB-synced ID
        const newId = addCustomQuickAction(label, emoji, type);

        // Log to timeline explicitly using the newly generated ID, so clicking it again toggles it off!
        addTimelineLog(newId, emoji, label, type);
        
        document.getElementById('qa-input-wrap')!.style.display = 'none';
        qaWrap.style.display = 'flex';
        (document.getElementById('qa-input') as HTMLInputElement).value = '';
      }
    });

    const bInst = document.getElementById('qa-btn-instant');
    const bDur = document.getElementById('qa-btn-duration');
    const tVal = document.getElementById('qa_type_val') as HTMLInputElement;
    bInst?.addEventListener('click', () => { bInst.classList.add('active'); bDur?.classList.remove('active'); if(tVal) tVal.value='instant'; });
    bDur?.addEventListener('click', () => { bDur.classList.add('active'); bInst?.classList.remove('active'); if(tVal) tVal.value='duration'; });
  }

  // Panic Logic
  const panicBtn = document.getElementById('panic-main-btn');
  const panicWrap = document.getElementById('panic-triggers');
  if (panicBtn && panicWrap) {
    panicBtn.addEventListener('click', () => { panicWrap.style.display = 'block'; panicBtn.style.display = 'none'; });
    document.getElementById('panic-cancel-btn')?.addEventListener('click', () => { panicWrap.style.display = 'none'; panicBtn.style.display = 'block'; });

    const pChipsWrap = document.getElementById('panic-chips-wrap');
    if (pChipsWrap) {
      let pHtml = `<button class="quick-chip" id="panic-custom-trigger">+ Custom</button>`;
      pHtml += CONFIG.panicTriggers.map((trig: any) => `<button class="quick-chip" data-panic="${trig}">${trig}</button>`).join('');
      pChipsWrap.innerHTML = pHtml;

      pChipsWrap.querySelectorAll('[data-panic]').forEach(chip => {
        chip.addEventListener('click', () => {
          const val = chip.getAttribute('data-panic')!;
          addTimelineLog('panic', '🚨', `Fatal Loop: ${val}`, 'duration', true);
          panicWrap.style.display = 'none'; panicBtn.style.display = 'block';
          panicBtn.textContent = "🔴 Stop Loop (Ongoing)";
        });
      });
      // TODO: Custom Panic Modal Mutator
    }
  }
}

// ═══════════════════════════════════════════════
// TIMELINE LOGIC 
// ═══════════════════════════════════════════════

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function isLocked(createdAt: number) { return (Date.now() - createdAt) > 3600000; }

function renderTimeline() {
  const list = document.getElementById('timeline-list');
  const label = document.getElementById('tl-label');
  const wrap = document.getElementById('timeline-wrap');
  if (!list || !label || !wrap) return;

  const items = STATE.timeline;
  if (items.length === 0) { label.style.display = 'none'; wrap.style.display = 'none'; return; }
  
  label.style.display = 'block'; wrap.style.display = 'block';
  const sorted = [...items].sort((a,b) => a.startTime - b.startTime);
  const activeDurations: TimelineItem[] = []; 
  const itemDepths = new Map<string, number>();

  sorted.forEach(item => {
    for (let i = activeDurations.length - 1; i >= 0; i--) { 
      if (activeDurations[i].endTime && activeDurations[i].endTime! <= item.startTime) activeDurations.splice(i, 1);
    }
    itemDepths.set(item.id, activeDurations.length);
    if (item.type === 'duration') activeDurations.push(item);
  });

  let html = '', lastTime: number | null = null;
  sorted.forEach((item, i) => {
    const depth = itemDepths.get(item.id) || 0;
    if (lastTime && depth === 0) { 
      const gap = Math.floor((item.startTime - lastTime) / 60000); 
      if (gap >= 30) html += `<div class="timeline-gap" style="opacity:0.5; font-size:10px; padding-left:55px;">⚠️ ${Math.floor(gap/60)}h ${gap%60}m unlogged gap</div>`; 
    }
    const locked = isLocked(item.createdAt);
    let durHtml = '';
    if (item.type === 'duration' && item.endTime) durHtml = `<div class="tl-duration">${Math.max(1, Math.round((item.endTime - item.startTime) / 60000))} mins</div>`;

    html += `
    <div class="timeline-item ${depth > 0 ? 'nested' : ''}" style="${depth > 0 ? `margin-left: ${depth * 14}px;` : ''}">
      <div class="tl-time ${(item.type === 'duration' && !item.endTime) ? 'ongoing' : ''}">${formatTime(item.startTime)}</div>
      <div class="tl-dot-wrap"><div class="tl-dot"></div>${i < sorted.length - 1 ? '<div class="tl-line"></div>' : ''}</div>
      <div class="tl-content">
        <div class="tl-label" style="${item.isPanic ? 'color:var(--red);font-weight:600' : ''}"><span class="tl-emoji">${item.emoji}</span>${item.label}</div>
        ${durHtml}
      </div>
      ${locked ? '<div class="tl-action-icon locked">🔒</div>' : `<div class="tl-action-icon del" data-tl-del="${item.id}">×</div>`}
    </div>`;
    if (depth === 0) lastTime = (item.type === 'duration' && !item.endTime) ? null : (item.endTime || item.startTime);
  });

  list.innerHTML = html;
  list.querySelectorAll('.tl-action-icon.del').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation(); deleteTimelineLog(btn.getAttribute('data-tl-del')!);
  }));
}
