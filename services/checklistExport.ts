import { Checklist, ChecklistItem } from './mockData';

/** Export checklist as CSV text */
export function exportAsCSV(checklist: Checklist): string {
  const hasQty = checklist.settings.enableQuantity;
  const hasSections = checklist.settings.enableSections && checklist.sections.length > 0;
  const headers: string[] = [];
  if (hasSections) headers.push('Section');
  headers.push('Item', 'Status');
  if (hasQty) headers.push('Required', 'Owned');
  headers.push('Category', 'Description');

  const lines: string[] = [headers.join(',')];

  const getSectionName = (sId: string | null): string => {
    if (!sId) return '';
    const sec = checklist.sections.find(s => s.id === sId);
    return sec ? sec.name : '';
  };

  const escape = (s: string) => {
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const statuses = checklist.settings.itemStatuses ?? [];
  const getStatusLabel = (item: ChecklistItem): string => {
    if (statuses.length > 0 && item.status) {
      const st = statuses.find(s => s.id === item.status);
      return st ? st.label : (item.checked ? 'Done' : 'Pending');
    }
    return item.checked ? 'Done' : 'Pending';
  };

  for (const item of checklist.items) {
    const row: string[] = [];
    if (hasSections) row.push(escape(getSectionName(item.sectionId)));
    row.push(escape(item.name), escape(getStatusLabel(item)));
    if (hasQty) row.push(String(item.requiredQty), String(item.ownedQty));
    row.push(escape(item.category), escape(item.description));
    lines.push(row.join(','));
  }

  return lines.join('\n');
}

/** Export as human-readable plain text */
export function exportAsText(checklist: Checklist): string {
  const lines: string[] = [];
  lines.push(checklist.name);
  if (checklist.description) lines.push(checklist.description);
  lines.push('');

  const statuses = checklist.settings.itemStatuses ?? [];
  const hasSections = checklist.settings.enableSections && checklist.sections.length > 0;

  const getStatusMark = (item: ChecklistItem): string => {
    if (statuses.length > 0 && item.status) {
      const st = statuses.find(s => s.id === item.status);
      return st ? `[${st.label}]` : (item.checked ? '[x]' : '[ ]');
    }
    return item.checked ? '[x]' : '[ ]';
  };

  const formatItem = (item: ChecklistItem): string => {
    let line = `  ${getStatusMark(item)} ${item.name}`;
    if (checklist.settings.enableQuantity && item.requiredQty > 0) {
      line += ` (${item.ownedQty}/${item.requiredQty})`;
    }
    return line;
  };

  if (hasSections) {
    for (const section of checklist.sections.sort((a, b) => a.order - b.order)) {
      const sectionItems = checklist.items.filter(i => i.sectionId === section.id);
      lines.push(`${section.name} (${sectionItems.filter(i => i.checked).length}/${sectionItems.length})`);
      for (const item of sectionItems) {
        lines.push(formatItem(item));
      }
      lines.push('');
    }
    const unsorted = checklist.items.filter(i => !i.sectionId);
    if (unsorted.length > 0) {
      lines.push(`Unsorted (${unsorted.filter(i => i.checked).length}/${unsorted.length})`);
      for (const item of unsorted) {
        lines.push(formatItem(item));
      }
    }
  } else {
    for (const item of checklist.items) {
      lines.push(formatItem(item));
    }
  }

  const total = checklist.items.length;
  const done = checklist.items.filter(i => i.checked).length;
  lines.push('');
  lines.push(`Progress: ${done}/${total} (${total > 0 ? Math.round((done / total) * 100) : 0}%)`);

  return lines.join('\n');
}
