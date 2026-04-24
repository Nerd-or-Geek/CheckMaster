import { Checklist, ChecklistItem, Section } from './mockData';

export type ShareGrant = 'view' | 'check' | 'edit';

export interface SharePayloadV1 {
  v: 1;
  grant: ShareGrant;
  exportedAt: number;
  snapshot: {
    name: string;
    description: string;
    type: Checklist['type'];
    sections: Section[];
    items: ChecklistItem[];
    settings: Checklist['settings'];
  };
}

const START = '---CHECKMASTER_SHARE_V1_START---';
const END = '---CHECKMASTER_SHARE_V1_END---';

function utf8ToB64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function b64ToUtf8(b: string): string {
  return decodeURIComponent(escape(atob(b)));
}

export function encodeChecklistShare(grant: ShareGrant, checklist: Checklist): string {
  const payload: SharePayloadV1 = {
    v: 1,
    grant,
    exportedAt: Date.now(),
    snapshot: {
      name: checklist.name,
      description: checklist.description,
      type: checklist.type,
      sections: checklist.sections.map(s => ({ ...s })),
      items: checklist.items.map(i => ({
        ...i,
        images: [...i.images],
      })),
      settings: { ...checklist.settings },
    },
  };
  const body = utf8ToB64(JSON.stringify(payload));
  return `${START}${body}${END}`;
}

export function decodeChecklistShare(text: string): SharePayloadV1 | null {
  const i = text.indexOf(START);
  const j = text.indexOf(END);
  if (i === -1 || j === -1 || j <= i) return null;
  const b64 = text.slice(i + START.length, j).trim();
  try {
    const raw = JSON.parse(b64ToUtf8(b64)) as SharePayloadV1;
    if (raw?.v !== 1 || !raw.snapshot || !['view', 'check', 'edit'].includes(raw.grant)) return null;
    if (!Array.isArray(raw.snapshot.sections) || !Array.isArray(raw.snapshot.items)) return null;
    return raw;
  } catch {
    return null;
  }
}
