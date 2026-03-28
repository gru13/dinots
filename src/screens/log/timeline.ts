import { deleteTimelineLog, STATE, TimelineItem } from '../../modules/state';
import { showToast } from '../../modules/toast';

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getLockReferenceTime(item: TimelineItem): number | null {
  const timestamps = [item.createdAt, item.startTime, item.endTime]
    .filter((value): value is number => Number.isFinite(value as number));
  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function isLocked(item: TimelineItem) {
  const ref = getLockReferenceTime(item);
  if (!ref) return false;
  return Date.now() - ref > 3600000;
}

export function renderTimeline() {
  const list = document.getElementById('timeline-list');
  const label = document.getElementById('tl-label');
  const wrap = document.getElementById('timeline-wrap');
  if (!list || !label || !wrap) return;

  const items = STATE.timeline;
  if (items.length === 0) {
    label.style.display = 'none';
    wrap.style.display = 'none';
    return;
  }

  label.style.display = 'block';
  wrap.style.display = 'block';
  const sorted = [...items].sort((a, b) => a.startTime - b.startTime);
  const activeDurations: TimelineItem[] = [];
  const itemDepths = new Map<string, number>();

  sorted.forEach((item) => {
    for (let i = activeDurations.length - 1; i >= 0; i--) {
      if (activeDurations[i].endTime && activeDurations[i].endTime! <= item.startTime) activeDurations.splice(i, 1);
    }
    itemDepths.set(item.id, activeDurations.length);
    if (item.type === 'duration') activeDurations.push(item);
  });

  let html = '';
  let lastTime: number | null = null;
  sorted.forEach((item, i) => {
    const depth = itemDepths.get(item.id) || 0;
    if (lastTime && depth === 0) {
      const gap = Math.floor((item.startTime - lastTime) / 60000);
      if (gap >= 30) html += `<div class="timeline-gap" style="opacity:0.5; font-size:10px; padding-left:55px;">⚠️ ${Math.floor(gap / 60)}h ${gap % 60}m unlogged gap</div>`;
    }
    const locked = isLocked(item);
    let durHtml = '';
    if (item.type === 'duration' && item.endTime) durHtml = `<div class="tl-duration">${Math.max(1, Math.round((item.endTime - item.startTime) / 60000))} mins</div>`;

    html += `
    <div class="timeline-item ${depth > 0 ? 'nested' : ''}" style="${depth > 0 ? `margin-left: ${depth * 14}px;` : ''}">
      <div class="tl-time ${(item.type === 'duration' && !item.endTime) ? 'ongoing' : ''}">${formatTime(item.startTime)}</div>
      <div class="tl-dot-wrap"><div class="tl-dot"></div>${i < sorted.length - 1 ? '<div class="tl-line"></div>' : ''}</div>
      <div class="tl-content">
        <div class="tl-label"><span class="tl-emoji">${item.emoji}</span>${item.label}</div>
        ${durHtml}
      </div>
      ${locked ? '<div class="tl-action-icon locked">🔒</div>' : `<div class="tl-action-icon del" data-tl-del="${item.id}">×</div>`}
    </div>`;

    if (depth === 0) lastTime = (item.type === 'duration' && !item.endTime) ? null : (item.endTime || item.startTime);
  });

  list.innerHTML = html;
  list.querySelectorAll('.tl-action-icon.del').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTimelineLog(btn.getAttribute('data-tl-del') || '');
  }));
  list.querySelectorAll('.tl-action-icon.locked').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showToast('Can delete only within 1 hour of the latest log time.', true);
  }));
}
