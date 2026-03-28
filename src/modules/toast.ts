export function showToast(message: string, isError: boolean = false) {
  const toast = document.getElementById('toast-msg');
  if (!toast) return;

  toast.textContent = message;
  toast.style.background = isError ? 'var(--rb)' : 'var(--card2)';
  toast.style.color = isError ? 'var(--red)' : 'var(--text2)';
  toast.classList.add('show');

  window.setTimeout(() => {
    toast.classList.remove('show');
  }, 1400);
}
