import { addExpense, deleteExpense, addCustomCategory, CONFIG, STATE } from '../modules/state';
import { events, EVENTS } from '../modules/events';

let activeCategory: string | null = null;

export function initMoneyScreen() {
  renderCategories();
  bindAddExpense();
  bindCustomCategoryUI();

  events.on(EVENTS.STATE_READY, () => {
    renderCategories();
    renderMoney();
  });
  events.on(EVENTS.MONEY_UPDATED, () => {
    renderMoney();
  });
  events.on(EVENTS.CONFIG_UPDATED, () => {
    renderCategories();
    renderMoney();
  });

  renderMoney();
}

function bindCustomCategoryUI() {
  const wrap = document.getElementById('money-cat-custom-wrap');
  const input = document.getElementById('money-cat-input') as HTMLInputElement | null;
  const emojiInput = document.getElementById('money-cat-emoji-input') as HTMLInputElement | null;
  const submitBtn = document.getElementById('money-cat-submit-btn');
  const closeBtn = document.getElementById('money-cat-close-btn');

  const closeCustom = () => {
    if (wrap) wrap.style.display = 'none';
    if (input) input.value = '';
  };

  const submitCustom = () => {
    const label = (input?.value || '').trim();
    if (!label) return;
    const emoji = (emojiInput?.value || '').trim();
    const fullLabel = `${emoji}${emoji ? ' ' : ''}${label}`;
    const finalCategory = addCustomCategory(fullLabel);
    if (!finalCategory) return;

    activeCategory = finalCategory;
    closeCustom();
    renderCategories();
  };

  if (submitBtn) submitBtn.addEventListener('click', submitCustom);
  if (closeBtn) closeBtn.addEventListener('click', closeCustom);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCustom();
    });
  }
}

function bindAddExpense() {
  const addBtn = document.getElementById('add-exp-btn') as HTMLButtonElement | null;
  const amountEl = document.getElementById('exp-amount') as HTMLInputElement | null;
  const noteEl = document.getElementById('exp-note') as HTMLInputElement | null;

  const submit = () => {
    if (!amountEl) return;
    const amount = Number(amountEl.value);
    if (!Number.isFinite(amount) || amount <= 0) return;

    const category = activeCategory || (CONFIG.categories?.[0] ?? 'Other');
    const note = (noteEl?.value || '').trim();

    addExpense(amount, note, category);
    amountEl.value = '';
    if (noteEl) noteEl.value = '';
  };

  if (addBtn) addBtn.addEventListener('click', submit);
  if (amountEl) amountEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  if (noteEl) noteEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

function renderCategories() {
  const wrap = document.getElementById('money-cat-list');
  if (!wrap) return;

  const cats: string[] = CONFIG.categories || [];
  if (!activeCategory) activeCategory = cats[0] ?? null;
  if (activeCategory && !cats.includes(activeCategory)) activeCategory = cats[0] ?? null;

  let html = `<button class="quick-chip" id="money-cat-custom" style="justify-content:flex-start; width:100%; border-radius: var(--rs);">+ Custom</button>`;
  html += cats.map((c) => {
    const isActive = c === activeCategory;
    return `<button class="quick-chip ${isActive ? 'active' : ''}" data-cat="${escapeHtmlAttr(c)}" style="justify-content:flex-start; width:100%; border-radius: var(--rs);">${escapeHtml(c)}</button>`;
  }).join('');

  wrap.innerHTML = html;

  wrap.querySelectorAll('[data-cat]').forEach((el) => {
    el.addEventListener('click', () => {
      const cat = (el as HTMLElement).getAttribute('data-cat');
      if (!cat) return;
      activeCategory = unescapeHtmlAttr(cat);
      renderCategories();
    });
  });

  const customBtn = document.getElementById('money-cat-custom');
  customBtn?.addEventListener('click', () => {
    const customWrap = document.getElementById('money-cat-custom-wrap');
    const input = document.getElementById('money-cat-input') as HTMLInputElement | null;
    if (customWrap) customWrap.style.display = 'block';
    input?.focus();
  });
}

function renderMoney() {
  const totalEl = document.getElementById('money-total');
  const leftEl = document.getElementById('money-left');
  const hero = document.getElementById('money-hero-card');
  const dist = document.getElementById('dist-graph');
  const list = document.getElementById('expense-list');

  const currency = CONFIG.theme?.currencySymbol ?? '₹';
  const budget = Number(CONFIG.theme?.dailyBudget ?? 0);

  const expenses = STATE.expenses || [];
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  if (totalEl) totalEl.textContent = `${currency}${Math.round(total)}`;

  if (leftEl) {
    if (Number.isFinite(budget) && budget > 0) {
      const remaining = budget - total;
      leftEl.textContent = remaining >= 0
        ? `${currency}${Math.round(remaining)} left of ${currency}${Math.round(budget)}`
        : `${currency}${Math.round(Math.abs(remaining))} over ${currency}${Math.round(budget)}`;
    } else {
      leftEl.textContent = `${currency}${Math.round(total)} spent`;
    }
  }

  if (hero) {
    if (Number.isFinite(budget) && budget > 0 && total > budget) hero.classList.add('over-budget');
    else hero.classList.remove('over-budget');
  }

  if (dist) dist.innerHTML = renderDistribution(expenses, currency);
  if (list) list.innerHTML = renderExpenseList(expenses, currency);
}

function renderDistribution(expenses: any[], currency: string): string {
  const byCat: Record<string, number> = {};
  for (const e of expenses) {
    const cat = e.category || 'Other';
    byCat[cat] = (byCat[cat] || 0) + (Number(e.amount) || 0);
  }

  const rows = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1]);

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 1;

  if (rows.length === 0) {
    return `<div style="font-size:12px; color: var(--text3); padding: 8px 0;">No expenses yet.</div>`;
  }

  return rows.map(([cat, amt]) => {
    const pct = Math.max(0, Math.min(100, (amt / total) * 100));
    const color = CONFIG.categoryColors?.[cat] ?? 'var(--amber)';
    return `
      <div class="dist-row">
        <div style="min-width: 110px; font-size: 12px; color: var(--text);">${escapeHtml(cat)}</div>
        <div class="dist-bar-wrap"><div class="dist-bar" style="width:${pct.toFixed(0)}%; background:${escapeHtmlAttr(color)}"></div></div>
        <div style="min-width: 72px; text-align: right; font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text3);">${currency}${Math.round(amt)}</div>
      </div>
    `;
  }).join('');
}

function renderExpenseList(expenses: any[], currency: string): string {
  const sorted = [...expenses].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  if (sorted.length === 0) {
    return `<div style="font-size:12px; color: var(--text3); padding: 12px 0;">No expenses logged.</div>`;
  }

  // Bind delete clicks after insertion
  queueMicrotask(() => {
    document.querySelectorAll('[data-exp-del]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).getAttribute('data-exp-del');
        if (id) deleteExpense(id);
      });
    });
  });

  return sorted.map((e) => {
    const when = e.timestamp ? new Date(e.timestamp) : null;
    const time = when ? when.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
    const amount = Math.round(Number(e.amount) || 0);
    return `
      <div class="timeline-item">
        <div class="tl-time">${escapeHtml(time)}</div>
        <div class="tl-dot-wrap"><div class="tl-dot"></div></div>
        <div class="tl-content">
          <div class="tl-label"><span class="tl-emoji">💸</span>${escapeHtml(e.category || 'Other')} ${escapeHtml(e.note ? `— ${e.note}` : '')}</div>
          <div class="tl-duration">${currency}${amount}</div>
        </div>
        <div class="tl-action-icon del" data-exp-del="${escapeHtmlAttr(e.id)}">×</div>
      </div>
    `;
  }).join('');
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/\n/g, ' ');
}

function unescapeHtmlAttr(s: string): string {
  // Only used for our own escaped values; keep it minimal.
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
