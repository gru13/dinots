import {
  CONFIG,
  reorderOptionItems,
  reorderOptionSubValues,
  reorderOptionValues
} from '../../../modules/state';

type DragSubValueMeta = {
  optionKey: string;
  parentValue: string;
  subValue: string;
};

type DragValueMeta = {
  id: string;
  value: string;
};

export function bindOptionsDragAndDrop(listWrap: HTMLElement | null) {
  if (!listWrap) return;

  let draggingOptionId = '';
  let draggingOptionValueMeta: DragValueMeta | null = null;
  let draggingOptionSubValueMeta: DragSubValueMeta | null = null;

  const clearNestedDragOverState = () => {
    listWrap.querySelectorAll('.settings-option-card-over').forEach((el) => el.classList.remove('settings-option-card-over'));
    listWrap.querySelectorAll('.settings-option-subitem-over').forEach((el) => el.classList.remove('settings-option-subitem-over'));
  };

  const finishDrag = () => {
    clearNestedDragOverState();
    listWrap.querySelectorAll('.settings-option-card-dragging').forEach((el) => el.classList.remove('settings-option-card-dragging'));
    listWrap.querySelectorAll('.settings-option-subitem-dragging').forEach((el) => el.classList.remove('settings-option-subitem-dragging'));
    listWrap.querySelectorAll('.settings-draggable-row-dragging').forEach((el) => el.classList.remove('settings-draggable-row-dragging'));
    draggingOptionId = '';
    draggingOptionValueMeta = null;
    draggingOptionSubValueMeta = null;
  };

  listWrap.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select')) return;

    const subRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
    if (subRow) {
      const optionKey = subRow.getAttribute('data-opt-key') || '';
      const parentValue = subRow.getAttribute('data-opt-parent') || '';
      const subValue = subRow.getAttribute('data-opt-sub') || '';
      if (!optionKey || !parentValue || !subValue) return;

      draggingOptionSubValueMeta = { optionKey, parentValue, subValue };
      subRow.classList.add('settings-option-subitem-dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      return;
    }

    const valueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
    if (valueRow) {
      const valueId = valueRow.getAttribute('data-opt-id') || '';
      const value = valueRow.getAttribute('data-opt-value') || '';
      if (!valueId || !value) return;

      draggingOptionValueMeta = { id: valueId, value };
      valueRow.classList.add('settings-option-card-dragging');
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      return;
    }

    const row = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!row) return;

    draggingOptionId = row.getAttribute('data-opt-row-id') || '';
    row.classList.add('settings-draggable-row-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggingOptionId);
    }
  });

  listWrap.addEventListener('dragend', () => {
    finishDrag();
  });

  listWrap.addEventListener('dragover', (e) => {
    const target = e.target as HTMLElement;

    if (draggingOptionSubValueMeta) {
      const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
      if (!targetSubRow) return;
      const optionKey = targetSubRow.getAttribute('data-opt-key') || '';
      const parentValue = targetSubRow.getAttribute('data-opt-parent') || '';
      if (optionKey !== draggingOptionSubValueMeta.optionKey || parentValue !== draggingOptionSubValueMeta.parentValue) {
        return;
      }
      e.preventDefault();
      clearNestedDragOverState();
      targetSubRow.classList.add('settings-option-subitem-over');
      return;
    }

    if (draggingOptionValueMeta) {
      const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
      if (!targetValueRow) return;
      const valueId = targetValueRow.getAttribute('data-opt-id') || '';
      if (valueId !== draggingOptionValueMeta.id) return;
      e.preventDefault();
      clearNestedDragOverState();
      targetValueRow.classList.add('settings-option-card-over');
      return;
    }

    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!targetRow) return;
    e.preventDefault();
    targetRow.classList.add('settings-draggable-row-over');
  });

  listWrap.addEventListener('dragleave', (e) => {
    const target = e.target as HTMLElement;
    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    targetRow?.classList.remove('settings-draggable-row-over');

    const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
    targetValueRow?.classList.remove('settings-option-card-over');

    const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
    targetSubRow?.classList.remove('settings-option-subitem-over');
  });

  listWrap.addEventListener('drop', (e) => {
    e.preventDefault();
    const target = e.target as HTMLElement;

    if (draggingOptionSubValueMeta) {
      const targetSubRow = target.closest('[data-opt-sub-row="1"]') as HTMLElement | null;
      if (!targetSubRow) {
        finishDrag();
        return;
      }

      const optionKey = targetSubRow.getAttribute('data-opt-key') || '';
      const parentValue = targetSubRow.getAttribute('data-opt-parent') || '';
      const targetSubValue = targetSubRow.getAttribute('data-opt-sub') || '';
      const { subValue } = draggingOptionSubValueMeta;

      if (!optionKey || !parentValue || !targetSubValue || targetSubValue === subValue) {
        finishDrag();
        return;
      }

      if (optionKey !== draggingOptionSubValueMeta.optionKey || parentValue !== draggingOptionSubValueMeta.parentValue) {
        finishDrag();
        return;
      }

      const current = [...(CONFIG.optionsNested?.[optionKey]?.[parentValue] || [])];
      const from = current.findIndex((v: string) => v === subValue);
      const to = current.findIndex((v: string) => v === targetSubValue);
      if (from >= 0 && to >= 0) {
        const [item] = current.splice(from, 1);
        current.splice(to, 0, item);
        reorderOptionSubValues(optionKey, parentValue, current);
      }
      finishDrag();
      return;
    }

    if (draggingOptionValueMeta) {
      const targetValueRow = target.closest('[data-opt-value-row="1"]') as HTMLElement | null;
      if (!targetValueRow) {
        finishDrag();
        return;
      }

      const valueId = targetValueRow.getAttribute('data-opt-id') || '';
      const targetValue = targetValueRow.getAttribute('data-opt-value') || '';
      const { id: sourceId, value: sourceValue } = draggingOptionValueMeta;

      if (!valueId || !targetValue || valueId !== sourceId || targetValue === sourceValue) {
        finishDrag();
        return;
      }

      const optionItem = (CONFIG.optionsItems || []).find((o: any) => o.id === valueId);
      const current = Array.isArray(optionItem?.values) ? [...optionItem.values] : [];
      const from = current.findIndex((v: string) => v === sourceValue);
      const to = current.findIndex((v: string) => v === targetValue);
      if (from >= 0 && to >= 0) {
        const [item] = current.splice(from, 1);
        current.splice(to, 0, item);
        reorderOptionValues(valueId, current);
      }
      finishDrag();
      return;
    }

    const targetRow = target.closest('[data-opt-row-id]') as HTMLElement | null;
    if (!targetRow || !draggingOptionId) {
      finishDrag();
      return;
    }
    targetRow.classList.remove('settings-draggable-row-over');

    const targetId = targetRow.getAttribute('data-opt-row-id') || '';
    if (!targetId || targetId === draggingOptionId) {
      finishDrag();
      return;
    }

    const current = Array.isArray(CONFIG.optionsItems) ? [...CONFIG.optionsItems] : [];
    const from = current.findIndex((o: any) => o.id === draggingOptionId);
    const to = current.findIndex((o: any) => o.id === targetId);
    if (from >= 0 && to >= 0) {
      const [item] = current.splice(from, 1);
      current.splice(to, 0, item);
      reorderOptionItems(current.map((o: any) => o.id));
    }

    finishDrag();
  });
}
