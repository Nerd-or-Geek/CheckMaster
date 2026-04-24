import { AppSettings, Checklist, Folder } from './mockData';

export function normalizeServerBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export type ServerSnapshot = {
  folders: Folder[];
  checklists: Checklist[];
  settings: AppSettings;
  activeChecklistId: string | null;
  updatedAt: number;
};

export type ServerUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: number;
};

async function request(
  baseUrl: string,
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `${normalizeServerBaseUrl(baseUrl)}${path}`;
  const extra = (init?.headers ?? {}) as Record<string, string>;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey.trim()}`,
    ...extra,
  };
  if (init?.body != null) headers['Content-Type'] = 'application/json';
  return fetch(url, { ...init, headers });
}

export async function testServerConnection(baseUrl: string, apiKey: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = normalizeServerBaseUrl(baseUrl);
  if (!u) return { ok: false, error: 'Enter a server URL.' };
  if (!apiKey.trim()) return { ok: false, error: 'Enter the API key from your server install.' };
  try {
    const res = await request(u, apiKey, '/health', { method: 'GET' });
    if (!res.ok) return { ok: false, error: `Server returned ${res.status}` };
    const j = await res.json().catch(() => ({}));
    if (j?.ok !== true) return { ok: false, error: 'Unexpected health response' };
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function pullFromServer(
  baseUrl: string,
  apiKey: string,
): Promise<{ ok: true; data: ServerSnapshot } | { ok: false; error: string }> {
  const t = await testServerConnection(baseUrl, apiKey);
  if (!t.ok) return t;
  try {
    const res = await request(normalizeServerBaseUrl(baseUrl), apiKey, '/api/v1/data', { method: 'GET' });
    if (!res.ok) return { ok: false, error: `GET /api/v1/data failed: ${res.status}` };
    const data = await res.json();
    if (!Array.isArray(data.folders) || !Array.isArray(data.checklists) || !data.settings) {
      return { ok: false, error: 'Invalid data from server' };
    }
    return {
      ok: true,
      data: {
        folders: data.folders,
        checklists: data.checklists,
        settings: data.settings,
        activeChecklistId: data.activeChecklistId ?? null,
        updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : Date.now(),
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function pushToServer(
  baseUrl: string,
  apiKey: string,
  payload: Omit<ServerSnapshot, 'updatedAt'>,
): Promise<{ ok: true; updatedAt: number } | { ok: false; error: string }> {
  const t = await testServerConnection(baseUrl, apiKey);
  if (!t.ok) return t;
  try {
    const body = JSON.stringify({
      folders: payload.folders,
      checklists: payload.checklists,
      settings: payload.settings,
      activeChecklistId: payload.activeChecklistId,
    });
    const res = await request(normalizeServerBaseUrl(baseUrl), apiKey, '/api/v1/data', {
      method: 'PUT',
      body,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `Upload failed (${res.status}) ${errText}`.trim() };
    }
    const j = await res.json().catch(() => ({}));
    return { ok: true, updatedAt: typeof j.updatedAt === 'number' ? j.updatedAt : Date.now() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function registerOnServer(
  baseUrl: string,
  apiKey: string,
  username: string,
  password: string,
  displayName?: string,
): Promise<{ ok: true; user: ServerUser } | { ok: false; error: string }> {
  try {
    const res = await request(normalizeServerBaseUrl(baseUrl), apiKey, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim().toLowerCase(), password, displayName: displayName?.trim() || username.trim() }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error || `Server returned ${res.status}` };
    return { ok: true, user: j.user as ServerUser };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function loginOnServer(
  baseUrl: string,
  apiKey: string,
  username: string,
  password: string,
): Promise<{ ok: true; user: ServerUser } | { ok: false; error: string }> {
  try {
    const res = await request(normalizeServerBaseUrl(baseUrl), apiKey, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: j?.error || `Server returned ${res.status}` };
    return { ok: true, user: j.user as ServerUser };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
