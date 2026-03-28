import { addTimelineLog, CONFIG, addCustomQuickAction } from '../../modules/state';
import { showToast } from '../../modules/toast';

type ShowOptionsModal = (act: any, mode: 'start' | 'end' | 'instant') => void;
type HorizontalScrollBinder = (el: HTMLElement) => void;

const QUICK_LOOP_COPIES = 3;

export function setupQuickActions(bindHorizontalScroll: HorizontalScrollBinder, showOptionsModal: ShowOptionsModal) {
  const qaWrap = document.getElementById('qa-scroll-wrap');
  if (qaWrap) {
    bindHorizontalScroll(qaWrap);
    setupInfiniteQuickActions(qaWrap);

    qaWrap.querySelectorAll('.quick-chip[data-qa-custom]').forEach((chip) => {
      chip.addEventListener('click', () => showQuickActionCustomInput());
    });

    qaWrap.querySelectorAll('.quick-chip[data-qa-id]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.getAttribute('data-qa-id');
        const action = CONFIG.quickActions.find((q: any) => q.id === id);
        if (!action) return;

        const options = (action.optionsKey && (CONFIG.activityOptions as any)?.[action.optionsKey]) || [];
        if (action.optionsType && Array.isArray(options) && options.length > 0) {
          showOptionsModal(action, action.optionsType as 'start' | 'end' | 'instant');
        } else {
          addTimelineLog(action.id, action.emoji, action.label, action.type as any);
          showToast(`Logged: ${action.label}`);
        }
      });
    });

    document.getElementById('qa-close-btn')?.addEventListener('click', () => {
      document.getElementById('qa-input-wrap')!.style.display = 'none';
      qaWrap.style.display = 'flex';
      const emojiInput = document.getElementById('qa-emoji-input') as HTMLInputElement | null;
      const textInput = document.getElementById('qa-input') as HTMLInputElement | null;
      if (emojiInput) emojiInput.value = '🙂';
      if (textInput) textInput.value = '';
    });

    document.getElementById('qa-submit-btn')?.addEventListener('click', () => {
      const emoji = (document.getElementById('qa-emoji-input') as HTMLInputElement).value || '🙂';
      const label = (document.getElementById('qa-input') as HTMLInputElement).value.trim();
      const type = (document.getElementById('qa_type_val') as HTMLInputElement).value as 'instant' | 'duration';
      if (!label) return;

      const newId = addCustomQuickAction(label, emoji, type);
      addTimelineLog(newId, emoji, label, type);
      showToast(`Logged: ${label}`);

      document.getElementById('qa-input-wrap')!.style.display = 'none';
      qaWrap.style.display = 'flex';
      (document.getElementById('qa-emoji-input') as HTMLInputElement).value = '🙂';
      (document.getElementById('qa-input') as HTMLInputElement).value = '';
    });

    const bInst = document.getElementById('qa-btn-instant');
    const bDur = document.getElementById('qa-btn-duration');
    const tVal = document.getElementById('qa_type_val') as HTMLInputElement;
    bInst?.addEventListener('click', () => {
      bInst.classList.add('active');
      bDur?.classList.remove('active');
      if (tVal) tVal.value = 'instant';
    });
    bDur?.addEventListener('click', () => {
      bDur.classList.add('active');
      bInst?.classList.remove('active');
      if (tVal) tVal.value = 'duration';
    });
  }

  const panicBtn = document.getElementById('panic-main-btn');
  const panicWrap = document.getElementById('panic-triggers');
  if (panicBtn && panicWrap) {
    panicBtn.addEventListener('click', () => {
      panicWrap.style.display = 'block';
      panicBtn.style.display = 'none';
    });
    document.getElementById('panic-cancel-btn')?.addEventListener('click', () => {
      panicWrap.style.display = 'none';
      panicBtn.style.display = 'block';
    });

    const pChipsWrap = document.getElementById('panic-chips-wrap');
    if (pChipsWrap) {
      bindHorizontalScroll(pChipsWrap);

      const renderPanicChips = () => {
        const pHtml = CONFIG.panicTriggers.map((trig: any) => `<button class="quick-chip" data-panic="${trig}">${trig}</button>`).join('');
        pChipsWrap.innerHTML = pHtml;

        pChipsWrap.querySelectorAll('[data-panic]').forEach((chip) => {
          chip.addEventListener('click', () => {
            const val = chip.getAttribute('data-panic') || '';
            addTimelineLog('panic', '🚨', `Fatal Loop: ${val}`, 'instant', true);
            showToast('Logged: Fatal Loop');
            panicWrap.style.display = 'none';
            panicBtn.style.display = 'block';
            panicBtn.textContent = CONFIG.ui.buttons.panic;
          });
        });
      };

      renderPanicChips();
    }
  }
}

function setupInfiniteQuickActions(qaWrap: HTMLElement) {
  const actions = Array.isArray(CONFIG.quickActions) ? CONFIG.quickActions : [];
  const copies: string[] = [];

  for (let copy = 0; copy < QUICK_LOOP_COPIES; copy++) {
    let html = `<button class="quick-chip" data-qa-custom="1" data-qa-loop-copy="${copy}">+ Custom</button>`;
    html += actions.map((qa: any) => {
      return `<button class="quick-chip" data-qa-id="${qa.id}" data-qa-loop-copy="${copy}">${qa.emoji} ${qa.label}</button>`;
    }).join('');
    copies.push(html);
  }

  qaWrap.innerHTML = copies.join('');

  const firstCopy0 = qaWrap.querySelector('.quick-chip[data-qa-loop-copy="0"]') as HTMLElement | null;
  const firstCopy1 = qaWrap.querySelector('.quick-chip[data-qa-loop-copy="1"]') as HTMLElement | null;
  if (firstCopy0 && firstCopy1) {
    qaWrap.dataset.loopCycleWidth = String(firstCopy1.offsetLeft - firstCopy0.offsetLeft);
  }

  if (qaWrap.dataset.quickLoopBound !== '1') {
    qaWrap.addEventListener('scroll', () => requestAnimationFrame(() => normalizeInfiniteQuickRowScroll(qaWrap)));
    qaWrap.dataset.quickLoopBound = '1';
  }

  centerInfiniteQuickRow(qaWrap);
}

function centerInfiniteQuickRow(qaWrap: HTMLElement) {
  const cycleWidth = Number(qaWrap.dataset.loopCycleWidth || 0);
  if (!Number.isFinite(cycleWidth) || cycleWidth <= 0) return;
  qaWrap.scrollLeft = cycleWidth;
}

function normalizeInfiniteQuickRowScroll(qaWrap: HTMLElement) {
  const cycleWidth = Number(qaWrap.dataset.loopCycleWidth || 0);
  if (!Number.isFinite(cycleWidth) || cycleWidth <= 0) return;

  const left = qaWrap.scrollLeft;
  const lowerBound = cycleWidth * 0.75;
  const upperBound = cycleWidth * 2.25;
  if (left < lowerBound || left > upperBound) {
    const normalized = ((left % cycleWidth) + cycleWidth) % cycleWidth;
    qaWrap.scrollLeft = normalized + cycleWidth;
  }
}

function showQuickActionCustomInput() {
  const qaWrap = document.getElementById('qa-scroll-wrap');
  const inputWrap = document.getElementById('qa-input-wrap');
  const emojiInput = document.getElementById('qa-emoji-input') as HTMLInputElement | null;
  const textInput = document.getElementById('qa-input') as HTMLInputElement | null;
  if (!qaWrap || !inputWrap) return;

  inputWrap.style.display = 'flex';
  qaWrap.style.display = 'none';
  if (emojiInput && !emojiInput.value.trim()) emojiInput.value = '🙂';
  if (textInput) textInput.value = '';
  inputWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
