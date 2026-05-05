import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import {
  Folder, Checklist, ChecklistItem, Section, AppSettings, ChecklistShareRole, ItemStatus,
  DEFAULT_ITEM_STATUSES, defaultSettings, initialFolders, initialChecklists,
} from '../services/mockData';
import { decodeChecklistShare } from '../services/checklistShare';
import {
  pullFromServer, pushToServer, testServerConnection as httpPingServer,
  registerOnServer, loginOnServer,
} from '../services/serverSync';

function mergeLoadedSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return { ...defaultSettings };
  return { ...defaultSettings, ...(raw as AppSettings) };
}

function canEditStructure(c: Checklist): boolean {
  const r = c.shareRole ?? 'owner';
  return r === 'owner' || r === 'edit';
}

function canEditItemFields(c: Checklist): boolean {
  const r = c.shareRole ?? 'owner';
  return r === 'owner' || r === 'edit';
}

function canToggleChecks(c: Checklist): boolean {
  const r = c.shareRole ?? 'owner';
  return r === 'owner' || r === 'edit' || r === 'check';
}

export const SPECIAL_FOLDER_IDS = {
  favorites: '__sys_favorites__',
  shared: '__sys_shared__',
} as const;

function isSystemFolderId(id: string | null): boolean {
  return id === SPECIAL_FOLDER_IDS.favorites || id === SPECIAL_FOLDER_IDS.shared;
}

interface AppContextType {
  folders: Folder[];
  checklists: Checklist[];
  settings: AppSettings;
  activeChecklistId: string | null;
  currentFolderId: string | null;
  viewMode: 'interactive' | 'stats';
  isDark: boolean;

  setActiveChecklistId: (id: string | null) => void;
  setCurrentFolderId: (id: string | null) => void;
  setViewMode: (mode: 'interactive' | 'stats') => void;

  addFolder: (name: string, parentId: string | null, color: string) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpand: (id: string) => void;
  reorderFolders: (parentId: string | null, orderedIds: string[]) => void;

  addChecklist: (checklist: Omit<Checklist, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateChecklist: (id: string, updates: Partial<Checklist>) => void;
  deleteChecklist: (id: string) => void;
  moveChecklist: (checklistId: string, targetFolderId: string) => void;
  reorderChecklists: (folderId: string, orderedIds: string[]) => void;
  toggleChecklistFavorite: (checklistId: string) => void;

  addSection: (checklistId: string, name: string) => void;
  updateSection: (checklistId: string, sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (checklistId: string, sectionId: string) => void;
  toggleSectionExpand: (checklistId: string, sectionId: string) => void;
  reorderSections: (checklistId: string, orderedIds: string[]) => void;

  addItem: (checklistId: string, item: Omit<ChecklistItem, 'id' | 'createdAt'>) => void;
  updateItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => void;
  deleteItem: (checklistId: string, itemId: string) => void;
  toggleItemCheck: (checklistId: string, itemId: string) => void;
  setItemStatus: (checklistId: string, itemId: string, statusId: string) => void;
  reorderItems: (checklistId: string, sectionId: string | null, orderedIds: string[]) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;
  importCSV: (checklistId: string, sections: { name: string; items: Omit<ChecklistItem, 'id' | 'createdAt'>[] }[]) => void;
  importSharedChecklist: (folderId: string, pastedText: string) => { ok: true } | { ok: false; error: string };

  deleteAllData: () => Promise<void>;

  testSyncServer: () => Promise<{ ok: true } | { ok: false; error: string }>;
  pushDataToServer: () => Promise<{ ok: true } | { ok: false; error: string }>;
  pullDataFromServer: () => Promise<{ ok: true } | { ok: false; error: string }>;
  registerServerProfile: (username: string, password: string, displayName?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  loginServerProfile: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;

  getActiveChecklist: () => Checklist | null;
  getFolderChildren: (parentId: string | null) => Folder[];
  getFolderChecklists: (folderId: string) => Checklist[];
  getChecklistStats: (checklistId: string, sectionId?: string | null) => {
    total: number;
    completed: number;
    percentage: number;
    categoryBreakdown: Record<string, { total: number; completed: number }>;
    partialItems: ChecklistItem[];
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [checklists, setChecklists] = useState<Checklist[]>(initialChecklists);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>('cl1');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'stats'>('interactive');

  const isDark = settings.systemDarkMode
    ? systemScheme === 'dark'
    : settings.darkMode;

  useEffect(() => {
    (async () => {
      try {
        const [fData, cData, sData, aData] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.FOLDERS),
          AsyncStorage.getItem(STORAGE_KEYS.CHECKLISTS),
          AsyncStorage.getItem(STORAGE_KEYS.SETTINGS),
          AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_CHECKLIST),
        ]);
        if (fData) setFolders(JSON.parse(fData));
        if (cData) setChecklists(JSON.parse(cData));
        if (sData) setSettings(mergeLoadedSettings(JSON.parse(sData)));
        if (aData) setActiveChecklistId(aData);
      } catch {}
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders)).catch(() => {}); }, [folders]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists)).catch(() => {}); }, [checklists]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)).catch(() => {}); }, [settings]);
  useEffect(() => {
    if (activeChecklistId) AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHECKLIST, activeChecklistId).catch(() => {});
    else AsyncStorage.removeItem(STORAGE_KEYS.ACTIVE_CHECKLIST).catch(() => {});
  }, [activeChecklistId]);

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- Folders ----------
  const addFolder = useCallback((name: string, parentId: string | null, color: string) => {
    if (isSystemFolderId(parentId)) return;
    setFolders(prev => [...prev, { id: genId(), name, parentId, expanded: false, color, createdAt: Date.now() }]);
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Folder>) => {
    if (isSystemFolderId(id)) return;
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    if (isSystemFolderId(id)) return;
    let toDelete: Set<string> = new Set();
    setFolders(prev => {
      const getDescendants = (fid: string): string[] => {
        const ch = prev.filter(f => f.parentId === fid);
        return [fid, ...ch.flatMap(c => getDescendants(c.id))];
      };
      toDelete = new Set(getDescendants(id));
      return prev.filter(f => !toDelete.has(f.id));
    });
    setChecklists(prev => prev.filter(c => !toDelete.has(c.folderId)));
  }, []);

  const toggleFolderExpand = useCallback((id: string) => {
    if (isSystemFolderId(id)) return;
    setFolders(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
  }, []);

  const reorderFolders = useCallback((parentId: string | null, orderedIds: string[]) => {
    if (isSystemFolderId(parentId)) return;
    setFolders(prev => {
      const others = prev.filter(f => f.parentId !== parentId);
      const reordered = orderedIds
        .map((id, idx) => {
          const found = prev.find(f => f.id === id);
          return found ? { ...found, order: idx } : null;
        })
        .filter(Boolean) as Folder[];
      return [...others, ...reordered];
    });
  }, []);

  // ---------- Checklists ----------
  const addChecklist = useCallback((checklist: Omit<Checklist, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (isSystemFolderId(checklist.folderId)) return;
    const newCl: Checklist = {
      ...checklist,
      id: genId(),
      order: checklists.filter(c => c.folderId === checklist.folderId).length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChecklists(prev => [...prev, newCl]);
    setActiveChecklistId(newCl.id);
  }, [checklists]);

  const updateChecklist = useCallback((id: string, updates: Partial<Checklist>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== id) return c;
      if (!canEditStructure(c)) return c;
      return { ...c, ...updates, updatedAt: Date.now() };
    }));
  }, []);

  const deleteChecklist = useCallback((id: string) => {
    setChecklists(prev => prev.filter(c => c.id !== id));
    setActiveChecklistId(prev => prev === id ? null : prev);
  }, []);

  const moveChecklist = useCallback((checklistId: string, targetFolderId: string) => {
    if (isSystemFolderId(targetFolderId)) return;
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      if (!canEditStructure(c)) return c;
      return { ...c, folderId: targetFolderId, updatedAt: Date.now() };
    }));
  }, []);

  const reorderChecklists = useCallback((folderId: string, orderedIds: string[]) => {
    setChecklists(prev => prev.map(c => {
      let inGroup = false;
      if (folderId === SPECIAL_FOLDER_IDS.favorites) inGroup = !!c.isFavorite;
      else if (folderId === SPECIAL_FOLDER_IDS.shared) inGroup = (c.shareRole ?? 'owner') !== 'owner';
      else inGroup = c.folderId === folderId;
      if (!inGroup) return c;
      const idx = orderedIds.indexOf(c.id);
      if (idx < 0) return c;
      return { ...c, order: idx, updatedAt: Date.now() };
    }));
  }, []);

  const toggleChecklistFavorite = useCallback((checklistId: string) => {
    setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, isFavorite: !c.isFavorite, updatedAt: Date.now() } : c));
  }, []);

  // ---------- Sections ----------
  const addSection = useCallback((checklistId: string, name: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      const newSection: Section = { id: genId(), name, expanded: true, order: c.sections.length };
      return { ...c, sections: [...c.sections, newSection], updatedAt: Date.now() };
    }));
  }, []);

  const updateSection = useCallback((checklistId: string, sectionId: string, updates: Partial<Section>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      return { ...c, sections: c.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s), updatedAt: Date.now() };
    }));
  }, []);

  const deleteSection = useCallback((checklistId: string, sectionId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      return {
        ...c,
        sections: c.sections.filter(s => s.id !== sectionId),
        items: c.items.map(i => i.sectionId === sectionId ? { ...i, sectionId: null } : i),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const toggleSectionExpand = useCallback((checklistId: string, sectionId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      return { ...c, sections: c.sections.map(s => s.id === sectionId ? { ...s, expanded: !s.expanded } : s) };
    }));
  }, []);

  const reorderSections = useCallback((checklistId: string, orderedIds: string[]) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      const newSections = orderedIds
        .map((id, idx) => {
          const sec = c.sections.find(s => s.id === id);
          return sec ? { ...sec, order: idx } : null;
        })
        .filter(Boolean) as Section[];
      return { ...c, sections: newSections, updatedAt: Date.now() };
    }));
  }, []);

  // ---------- Items ----------
  const addItem = useCallback((checklistId: string, item: Omit<ChecklistItem, 'id' | 'createdAt'>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      const newItem: ChecklistItem = { ...item, id: genId(), createdAt: Date.now() };
      return { ...c, items: [...c.items, newItem], updatedAt: Date.now() };
    }));
  }, []);

  const updateItem = useCallback((checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditItemFields(c)) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i), updatedAt: Date.now() };
    }));
  }, []);

  const deleteItem = useCallback((checklistId: string, itemId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      return { ...c, items: c.items.filter(i => i.id !== itemId), updatedAt: Date.now() };
    }));
  }, []);

  const toggleItemCheck = useCallback((checklistId: string, itemId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canToggleChecks(c)) return c;
      const statuses = c.settings.itemStatuses;
      if (statuses && statuses.length > 0) {
        return {
          ...c,
          items: c.items.map(i => {
            if (i.id !== itemId) return i;
            const currentIdx = statuses.findIndex(s => s.id === (i.status ?? statuses[0].id));
            const nextStatus = statuses[(currentIdx + 1) % statuses.length];
            return { ...i, status: nextStatus.id, checked: nextStatus.isDone };
          }),
          updatedAt: Date.now(),
        };
      }
      return {
        ...c,
        items: c.items.map(i => {
          if (i.id !== itemId) return i;
          const nc = !i.checked;
          if (c.settings.enableQuantity && i.requiredQty > 0) {
            return { ...i, checked: nc, ownedQty: nc ? i.requiredQty : 0 };
          }
          return { ...i, checked: nc };
        }),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const setItemStatus = useCallback((checklistId: string, itemId: string, statusId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canToggleChecks(c)) return c;
      const statuses = c.settings.itemStatuses ?? [];
      const isDoneVal = statuses.find(s => s.id === statusId)?.isDone ?? false;
      return {
        ...c,
        items: c.items.map(i => i.id !== itemId ? i : { ...i, status: statusId, checked: isDoneVal }),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const reorderItems = useCallback((checklistId: string, sectionId: string | null, orderedIds: string[]) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      const sectionItems = orderedIds
        .map(id => c.items.find(i => i.id === id))
        .filter(Boolean) as ChecklistItem[];
      const otherItems = c.items.filter(i => i.sectionId !== sectionId);
      return { ...c, items: [...otherItems, ...sectionItems], updatedAt: Date.now() };
    }));
  }, []);

  // ---------- Settings ----------
  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const importSharedChecklist = useCallback((folderId: string, pastedText: string) => {
    const payload = decodeChecklistShare(pastedText.trim());
    if (!payload) return { ok: false as const, error: 'Could not read shared checklist. Paste the full message including the markers.' };
    const sectionIdMap = new Map<string, string>();
    const newSections: Section[] = payload.snapshot.sections.map((s, idx) => {
      const id = genId();
      sectionIdMap.set(s.id, id);
      return { ...s, id, order: idx };
    });
    const newItems: ChecklistItem[] = payload.snapshot.items.map(i => ({
      ...i, id: genId(),
      sectionId: i.sectionId ? (sectionIdMap.get(i.sectionId) ?? null) : null,
      createdAt: Date.now(),
    }));
    const newCl: Checklist = {
      id: genId(), name: payload.snapshot.name, description: payload.snapshot.description,
      folderId, type: payload.snapshot.type, shareRole: payload.grant,
      sections: newSections, items: newItems,
      settings: { ...payload.snapshot.settings },
      createdAt: Date.now(), updatedAt: Date.now(),
    };
    setChecklists(prev => [...prev, newCl]);
    setActiveChecklistId(newCl.id);
    return { ok: true as const };
  }, []);

  const importCSV = useCallback((checklistId: string, sections: { name: string; items: Omit<ChecklistItem, 'id' | 'createdAt'>[] }[]) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId || !canEditStructure(c)) return c;
      const newSections: Section[] = sections.map((s, idx) => ({
        id: genId(), name: s.name, expanded: true, order: c.sections.length + idx,
      }));
      const newItems: ChecklistItem[] = [];
      sections.forEach((s, sIdx) => {
        s.items.forEach(item => {
          newItems.push({ ...item, id: genId(), sectionId: newSections[sIdx].id, createdAt: Date.now() });
        });
      });
      return {
        ...c,
        sections: [...c.sections, ...newSections],
        items: [...c.items, ...newItems],
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const deleteAllData = useCallback(async () => {
    setFolders([]);
    setChecklists([]);
    setActiveChecklistId(null);
    setSettings({ ...defaultSettings });
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.FOLDERS, STORAGE_KEYS.CHECKLISTS,
        STORAGE_KEYS.SETTINGS, STORAGE_KEYS.ACTIVE_CHECKLIST,
      ]);
    } catch {}
  }, []);

  // ---------- Server ----------
  const testSyncServer = useCallback(async () => {
    return httpPingServer(settings.serverUrl, settings.serverApiKey);
  }, [settings.serverUrl, settings.serverApiKey]);

  const registerServerProfile = useCallback(async (username: string, password: string, displayName?: string) => {
    const url = settings.serverUrl.trim();
    const key = settings.serverApiKey.trim();
    if (!url || !key) return { ok: false as const, error: 'Set server URL and API key first.' };
    const result = await registerOnServer(url, key, username, password, displayName);
    if (!result.ok) return result;
    setSettings(prev => ({ ...prev, serverUsername: result.user.username, serverDisplayName: result.user.displayName }));
    return { ok: true as const };
  }, [settings.serverUrl, settings.serverApiKey]);

  const loginServerProfile = useCallback(async (username: string, password: string) => {
    const url = settings.serverUrl.trim();
    const key = settings.serverApiKey.trim();
    if (!url || !key) return { ok: false as const, error: 'Set server URL and API key first.' };
    const result = await loginOnServer(url, key, username, password);
    if (!result.ok) return result;
    setSettings(prev => ({ ...prev, serverUsername: result.user.username, serverDisplayName: result.user.displayName }));
    return { ok: true as const };
  }, [settings.serverUrl, settings.serverApiKey]);

  const pushDataToServer = useCallback(async () => {
    const url = settings.serverUrl.trim();
    const key = settings.serverApiKey.trim();
    if (!url || !key) return { ok: false as const, error: 'Set server URL and API key first.' };
    const remoteSettings = { ...settings, serverUrl: '', serverApiKey: '' };
    const result = await pushToServer(url, key, { folders, checklists, settings: remoteSettings, activeChecklistId });
    if (!result.ok) return result;
    setSettings(prev => ({ ...prev, lastSyncTime: Date.now() }));
    return { ok: true as const };
  }, [folders, checklists, settings, activeChecklistId]);

  const pullDataFromServer = useCallback(async () => {
    const url = settings.serverUrl.trim();
    const key = settings.serverApiKey.trim();
    if (!url || !key) return { ok: false as const, error: 'Set server URL and API key first.' };
    const result = await pullFromServer(url, key);
    if (!result.ok) return result;
    const { folders: f, checklists: c, settings: s, activeChecklistId: a } = result.data;
    setFolders(f);
    setChecklists(c);
    setActiveChecklistId(a);
    setSettings(prev => ({
      ...mergeLoadedSettings(s),
      serverUrl: prev.serverUrl,
      serverApiKey: prev.serverApiKey,
      lastSyncTime: Date.now(),
    }));
    return { ok: true as const };
  }, [settings.serverUrl, settings.serverApiKey]);

  // ---------- Getters ----------
  const getActiveChecklist = useCallback(() => {
    return checklists.find(c => c.id === activeChecklistId) || null;
  }, [checklists, activeChecklistId]);

  const getFolderChildren = useCallback((parentId: string | null) => {
    const normalize = (list: Folder[]) => [...list].sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.createdAt - b.createdAt;
    });

    const normalChildren = normalize(folders.filter(f => f.parentId === parentId));
    if (parentId !== null) return normalChildren;

    const root: Folder[] = [
      {
        id: SPECIAL_FOLDER_IDS.favorites,
        name: 'Favorites',
        parentId: null,
        expanded: true,
        color: '#F59E0B',
        createdAt: 0,
        isSystem: 'favorites',
        order: -2,
      },
    ];

    if (settings.serverUrl && settings.serverApiKey && settings.serverUsername) {
      root.push({
        id: SPECIAL_FOLDER_IDS.shared,
        name: 'Shared',
        parentId: null,
        expanded: true,
        color: '#06B6D4',
        createdAt: 1,
        isSystem: 'shared',
        order: -1,
      });
    }

    return [...root, ...normalChildren];
  }, [folders, settings.serverUrl, settings.serverApiKey, settings.serverUsername]);

  const getFolderChecklists = useCallback((folderId: string) => {
    const sortChecklists = (list: Checklist[]) => [...list].sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return b.updatedAt - a.updatedAt;
    });

    if (folderId === SPECIAL_FOLDER_IDS.favorites) {
      return sortChecklists(checklists.filter(c => !!c.isFavorite));
    }
    if (folderId === SPECIAL_FOLDER_IDS.shared) {
      return sortChecklists(checklists.filter(c => (c.shareRole ?? 'owner') !== 'owner'));
    }

    return sortChecklists(checklists.filter(c => c.folderId === folderId));
  }, [checklists]);

  const getChecklistStats = useCallback((checklistId: string, sectionId?: string | null) => {
    const cl = checklists.find(c => c.id === checklistId);
    if (!cl) return { total: 0, completed: 0, percentage: 0, categoryBreakdown: {}, partialItems: [] };
    let items = cl.items;
    if (sectionId !== undefined && sectionId !== null) items = items.filter(i => i.sectionId === sectionId);
    const statuses = cl.settings.itemStatuses;
    const isItemDone = (i: ChecklistItem): boolean => {
      if (statuses && statuses.length > 0 && i.status) return statuses.find(s => s.id === i.status)?.isDone ?? false;
      return i.checked;
    };
    const total = items.length;
    const completed = items.filter(isItemDone).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const categoryBreakdown: Record<string, { total: number; completed: number }> = {};
    items.forEach(i => {
      if (!categoryBreakdown[i.category]) categoryBreakdown[i.category] = { total: 0, completed: 0 };
      categoryBreakdown[i.category].total++;
      if (isItemDone(i)) categoryBreakdown[i.category].completed++;
    });
    const partialItems = items.filter(i => cl.settings.enableQuantity && i.requiredQty > 0 && i.ownedQty > 0 && i.ownedQty < i.requiredQty);
    return { total, completed, percentage, categoryBreakdown, partialItems };
  }, [checklists]);

  return (
    <AppContext.Provider value={{
      folders, checklists, settings, activeChecklistId, currentFolderId, viewMode, isDark,
      setActiveChecklistId, setCurrentFolderId, setViewMode,
      addFolder, updateFolder, deleteFolder, toggleFolderExpand, reorderFolders,
      addChecklist, updateChecklist, deleteChecklist, moveChecklist, reorderChecklists, toggleChecklistFavorite,
      addSection, updateSection, deleteSection, toggleSectionExpand, reorderSections,
      addItem, updateItem, deleteItem, toggleItemCheck, setItemStatus, reorderItems,
      updateSettings, importCSV, importSharedChecklist, deleteAllData,
      testSyncServer, pushDataToServer, pullDataFromServer, registerServerProfile, loginServerProfile,
      getActiveChecklist, getFolderChildren, getFolderChecklists, getChecklistStats,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
