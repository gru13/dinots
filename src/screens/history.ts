import { listDayKeys, loadDay } from '../modules/db';
import { CONFIG } from '../modules/state';

function formatTime(ts: number) {
  if (!Number.isFinite(ts)) return '--:--';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function renderEmpty(el: HTMLElement | null, text: string) {
  if (!el) return;
  el.innerHTML = `<div class="history-empty">${text}</div>`;
}

function setSummary(data: any, dateStr: string) {
  const timelineEl = document.getElementById('history-day-timeline');
  const expenseEl = document.getElementById('history-day-expense');
  const completedEl = document.getElementById('history-day-completed');
  if (!timelineEl || !expenseEl || !completedEl) return;

  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

  const totalExpense = expenses.reduce((sum: number, item: any) => sum + (Number(item?.amount) || 0), 0);
  const dayTasks = tasks.filter((task: any) => !task?.dueDate || task.dueDate === dateStr);
  const doneTasks = dayTasks.filter((task: any) => Boolean(task?.done)).length;
  const symbol = String(CONFIG.theme?.currencySymbol || '₹');

  timelineEl.textContent = String(timeline.length);
  expenseEl.textContent = `${symbol}${Math.round(totalExpense)}`;
  completedEl.textContent = `${doneTasks} / ${dayTasks.length}`;
}

function renderTimeline(data: any) {
  const wrap = document.getElementById('history-timeline-list');
  if (!wrap) return;

  const items = Array.isArray(data?.timeline) ? [...data.timeline] : [];
  if (items.length === 0) {
    renderEmpty(wrap, 'No timeline logs for this day.');
    return;
  }

  items.sort((a: any, b: any) => (Number(a?.startTime) || 0) - (Number(b?.startTime) || 0));
  wrap.innerHTML = items.map((item: any) => {
    const emoji = item?.emoji || '🧩';
    const label = item?.label || 'Log';
    const start = formatTime(Number(item?.startTime));
    return `<div class="history-row"><div class="history-row-main">${emoji} ${label}</div><div class="history-row-meta">${start}</div></div>`;
  }).join('');
}

function renderExpenses(data: any) {
  const wrap = document.getElementById('history-expense-list');
  if (!wrap) return;

  const items = Array.isArray(data?.expenses) ? [...data.expenses] : [];
  if (items.length === 0) {
    renderEmpty(wrap, 'No expenses for this day.');
    return;
  }

  items.sort((a: any, b: any) => (Number(b?.timestamp) || 0) - (Number(a?.timestamp) || 0));
  const symbol = String(CONFIG.theme?.currencySymbol || '₹');
  wrap.innerHTML = items.map((item: any) => {
    const amount = Math.round(Number(item?.amount) || 0);
    const note = item?.note ? String(item.note) : 'Expense';
    return `<div class="history-row"><div class="history-row-main">${note}</div><div class="history-row-meta">${symbol}${amount}</div></div>`;
  }).join('');
}

function renderCompletedTasks(data: any, dateStr: string) {
  const wrap = document.getElementById('history-task-list');
  if (!wrap) return;

  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const done = tasks.filter((task: any) => Boolean(task?.done) && (!task?.dueDate || task.dueDate === dateStr));
  if (done.length === 0) {
    renderEmpty(wrap, 'No completed tasks for this day.');
    return;
  }

  wrap.innerHTML = done.map((task: any) => {
    const text = task?.text ? String(task.text) : 'Task';
    return `<div class="history-row"><div class="history-row-main">✅ ${text}</div></div>`;
  }).join('');
}

// ── Single-Month Swipe Calendar ──

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sun-first

function pad2(n: number) { return n < 10 ? '0' + n : '' + n; }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Sunday = 0, Saturday = 6 (native JS weekday)
function getISOWeekday(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay();
}

export function initHistoryScreen() {
  const calendarWrap = document.getElementById('history-scroll-calendar');
  const selectedDateEl = document.getElementById('history-selected-date');
  const backLogBtn = document.getElementById('history-back-log');
  if (!calendarWrap || !selectedDateEl || !backLogBtn) return;

  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let selectedDate: string | null = null;
  let allowedDates = new Set<string>();

  // Touch tracking for swipe
  let touchStartY = 0;
  let touchStartX = 0;
  let swiping = false;

  const renderNoDataState = (label: string) => {
    setSummary({ timeline: [], expenses: [], tasks: [] }, _today());
    renderEmpty(document.getElementById('history-timeline-list'), label);
    renderEmpty(document.getElementById('history-expense-list'), label);
    renderEmpty(document.getElementById('history-task-list'), label);
  };

  const loadDate = async (dateStr: string) => {
    if (!dateStr) return;
    selectedDate = dateStr;
    selectedDateEl.textContent = dateStr;
    try {
      const data = await loadDay(dateStr);
      if (!data) {
        renderNoDataState('No saved data for selected day.');
        return;
      }
      setSummary(data, dateStr);
      renderTimeline(data);
      renderExpenses(data);
      renderCompletedTasks(data, dateStr);
    } catch {
      renderNoDataState('Sign in and unlock vault to view old data.');
    }
    renderCalendar();
  };

  const goMonth = (delta: number) => {
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  };

  const renderCalendar = () => {
    const todayStr = _today();
    const now = new Date();
    const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth();

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const daysInPrev = getDaysInMonth(viewYear, viewMonth - 1);
    const firstWeekday = getISOWeekday(viewYear, viewMonth, 1);

    // Header: "Select Date" + month/year pill
    let html = `
      <div class="hcal-header">
        <div class="hcal-title">Select Date</div>
        <div class="hcal-month-nav">
          <button class="hcal-nav-btn" id="hcal-prev" aria-label="Previous month">‹</button>
          <div class="hcal-month-pill">📅 ${SHORT_MONTHS[viewMonth]} ${viewYear}</div>
          <button class="hcal-nav-btn" id="hcal-next" aria-label="Next month">›</button>
        </div>
      </div>
    `;

    // Weekday labels
    html += `<div class="hcal-weekdays">`;
    DAY_LABELS.forEach((label, i) => {
      const isSun = i === 0;
      const isSat = i === 6;
      const cls = (isSat || isSun) ? 'hcal-wd hcal-wd--weekend' : 'hcal-wd';
      html += `<div class="${cls}">${label}</div>`;
    });
    html += `</div>`;

    // Day grid
    html += `<div class="hcal-grid" id="hcal-grid">`;

    // Previous month trailing days
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const day = daysInPrev - i;
      html += `<div class="hcal-day hcal-day--outside">${day}</div>`;
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(d)}`;
      const isToday = dateStr === todayStr;
      const isSelected = dateStr === selectedDate;
      const hasData = allowedDates.has(dateStr);

      let cls = 'hcal-day';
      if (isToday) cls += ' hcal-day--today';
      if (isSelected) cls += ' hcal-day--selected';
      if (hasData) cls += ' hcal-day--has-data';

      const dotHtml = hasData ? '<span class="hcal-dot"></span>' : '';
      const clickAttr = `data-date="${dateStr}"`;

      html += `<div class="${cls}" ${clickAttr}><span class="hcal-day-num">${d}</span>${dotHtml}</div>`;
    }

    // Next month leading days
    const totalCells = firstWeekday + daysInMonth;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="hcal-day hcal-day--outside">${d}</div>`;
    }

    html += `</div>`;

    // Current month indicator
    if (isCurrentMonth) {
      html += `<div class="hcal-current-badge">● Current Month</div>`;
    }

    calendarWrap.innerHTML = html;

    // Wire up nav buttons
    document.getElementById('hcal-prev')?.addEventListener('click', () => goMonth(-1));
    document.getElementById('hcal-next')?.addEventListener('click', () => goMonth(1));

    // Wire up day clicks
    calendarWrap.querySelectorAll('.hcal-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const ds = el.getAttribute('data-date');
        if (ds) loadDate(ds);
      });
    });

    // Touch/wheel for month navigation
    const grid = document.getElementById('hcal-grid');
    if (grid) {
      grid.addEventListener('wheel', (e: WheelEvent) => {
        e.preventDefault();
        if (Math.abs(e.deltaY) > 20) {
          goMonth(e.deltaY > 0 ? 1 : -1);
        }
      }, { passive: false });

      grid.addEventListener('touchstart', (e: TouchEvent) => {
        touchStartY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX;
        swiping = false;
      }, { passive: true });

      grid.addEventListener('touchmove', (e: TouchEvent) => {
        const dy = touchStartY - e.touches[0].clientY;
        const dx = Math.abs(touchStartX - e.touches[0].clientX);
        if (Math.abs(dy) > 30 && Math.abs(dy) > dx && !swiping) {
          swiping = true;
          goMonth(dy > 0 ? 1 : -1);
        }
      }, { passive: true });
    }
  };

  const preparePicker = async () => {
    const keys = await listDayKeys();
    if (!keys.length) {
      renderNoDataState('No old logs found yet.');
      renderCalendar();
      return;
    }

    allowedDates = new Set<string>(keys);

    const latest = [...keys].sort().reverse()[0];
    selectedDate = latest;
    selectedDateEl.textContent = latest;

    // Navigate to latest date's month
    const latestDate = new Date(`${latest}T00:00:00`);
    viewYear = latestDate.getFullYear();
    viewMonth = latestDate.getMonth();

    loadDate(latest);
    renderCalendar();
  };

  backLogBtn.addEventListener('click', () => {
    const logTab = document.querySelector('.nav-btn[data-target="log"]') as HTMLButtonElement | null;
    logTab?.click();
  });

  const historyTab = document.querySelector('.nav-btn[data-target="history"]') as HTMLButtonElement | null;
  historyTab?.addEventListener('click', () => {
    preparePicker();
  });

  renderNoDataState('Pick a date from calendar to view old info.');
  renderCalendar();
  preparePicker();
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}
