import { CONFIG, setDailyBudget } from '../../modules/state';

export function bindBudgetSettings() {
  const input = document.getElementById('settings-budget-input') as HTMLInputElement | null;
  const saveBtn = document.getElementById('settings-budget-save');

  const submit = () => {
    const raw = Number(input?.value ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return;
    setDailyBudget(raw);
  };

  saveBtn?.addEventListener('click', submit);
  input?.addEventListener('wheel', (e) => {
    e.preventDefault();
    (e.currentTarget as HTMLInputElement).blur();
  }, { passive: false });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
}

export function renderBudgetSettings() {
  const input = document.getElementById('settings-budget-input') as HTMLInputElement | null;
  if (!input) return;
  const budget = Number(CONFIG.theme?.dailyBudget ?? 0);
  input.value = Number.isFinite(budget) ? String(Math.max(0, Math.round(budget))) : '0';
}
