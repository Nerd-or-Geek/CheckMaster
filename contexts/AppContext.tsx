import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import {
  Folder, Checklist, ChecklistItem, Section, AppSettings,
  defaultSettings, initialFolders, initialChecklists,
} from '../services/mockData';

interface AppContextType {
  folders: Folder[];
  checklists: Checklist[];
  settings: AppSettings;
  activeChecklistId: string | null;
  currentFolderId: string | null;
  viewMode: 'interactive' | 'stats';

  setActiveChecklistId: (id: string | null) => void;
  setCurrentFolderId: (id: string | null) => void;
  setViewMode: (mode: 'interactive' | 'stats') => void;

  addFolder: (name: string, parentId: string | null, color: string) => void;
  updateFolder: (id: string, updates: Partial<Folder>) => void;
  deleteFolder: (id: string) => void;
  toggleFolderExpand: (id: string) => void;

  addChecklist: (checklist: Omit<Checklist, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateChecklist: (id: string, updates: Partial<Checklist>) => void;
  deleteChecklist: (id: string) => void;
  moveChecklist: (checklistId: string, targetFolderId: string) => void;

  addSection: (checklistId: string, name: string) => void;
  updateSection: (checklistId: string, sectionId: string, updates: Partial<Section>) => void;
  deleteSection: (checklistId: string, sectionId: string) => void;
  toggleSectionExpand: (checklistId: string, sectionId: string) => void;

  addItem: (checklistId: string, item: Omit<ChecklistItem, 'id' | 'createdAt'>) => void;
  updateItem: (checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => void;
  deleteItem: (checklistId: string, itemId: string) => void;
  toggleItemCheck: (checklistId: string, itemId: string) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;
  importCSV: (checklistId: string, sections: { name: string; items: Omit<ChecklistItem, 'id' | 'createdAt'>[] }[]) => void;

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
  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [checklists, setChecklists] = useState<Checklist[]>(initialChecklists);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>('cl1');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'stats'>('interactive');

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
        if (sData) setSettings(JSON.parse(sData));
        if (aData) setActiveChecklistId(aData);
      } catch {}
    })();
  }, []);

  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders)); }, [folders]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.CHECKLISTS, JSON.stringify(checklists)); }, [checklists]);
  useEffect(() => { AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (activeChecklistId) AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_CHECKLIST, activeChecklistId);
  }, [activeChecklistId]);

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const addFolder = useCallback((name: string, parentId: string | null, color: string) => {
    setFolders(prev => [...prev, { id: genId(), name, parentId, expanded: false, color, createdAt: Date.now() }]);
  }, []);

  const updateFolder = useCallback((id: string, updates: Partial<Folder>) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders(prev => {
      const getDescendants = (fid: string): string[] => {
        const children = prev.filter(f => f.parentId === fid);
        return [fid, ...children.flatMap(c => getDescendants(c.id))];
      };
      const toDelete = new Set(getDescendants(id));
      return prev.filter(f => !toDelete.has(f.id));
    });
    setChecklists(prev => prev.filter(c => c.folderId !== id));
  }, []);

  const toggleFolderExpand = useCallback((id: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
  }, []);

  const addChecklist = useCallback((checklist: Omit<Checklist, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCl: Checklist = { ...checklist, id: genId(), createdAt: Date.now(), updatedAt: Date.now() };
    setChecklists(prev => [...prev, newCl]);
    setActiveChecklistId(newCl.id);
  }, []);

  const updateChecklist = useCallback((id: string, updates: Partial<Checklist>) => {
    setChecklists(prev => prev.map(c => c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c));
  }, []);

  const deleteChecklist = useCallback((id: string) => {
    setChecklists(prev => prev.filter(c => c.id !== id));
    setActiveChecklistId(prev => prev === id ? null : prev);
  }, []);

  const moveChecklist = useCallback((checklistId: string, targetFolderId: string) => {
    setChecklists(prev => prev.map(c => c.id === checklistId ? { ...c, folderId: targetFolderId, updatedAt: Date.now() } : c));
  }, []);

  const addSection = useCallback((checklistId: string, name: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      const newSection: Section = { id: genId(), name, expanded: true, order: c.sections.length };
      return { ...c, sections: [...c.sections, newSection], updatedAt: Date.now() };
    }));
  }, []);

  const updateSection = useCallback((checklistId: string, sectionId: string, updates: Partial<Section>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      return { ...c, sections: c.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s), updatedAt: Date.now() };
    }));
  }, []);

  const deleteSection = useCallback((checklistId: string, sectionId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
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

  const addItem = useCallback((checklistId: string, item: Omit<ChecklistItem, 'id' | 'createdAt'>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      const newItem: ChecklistItem = { ...item, id: genId(), createdAt: Date.now() };
      return { ...c, items: [...c.items, newItem], updatedAt: Date.now() };
    }));
  }, []);

  const updateItem = useCallback((checklistId: string, itemId: string, updates: Partial<ChecklistItem>) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      return { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i), updatedAt: Date.now() };
    }));
  }, []);

  const deleteItem = useCallback((checklistId: string, itemId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      return { ...c, items: c.items.filter(i => i.id !== itemId), updatedAt: Date.now() };
    }));
  }, []);

  const toggleItemCheck = useCallback((checklistId: string, itemId: string) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      return {
        ...c,
        items: c.items.map(i => {
          if (i.id !== itemId) return i;
          const newChecked = !i.checked;
          if (c.settings.enableQuantity && i.requiredQty > 0) {
            return { ...i, checked: newChecked, ownedQty: newChecked ? i.requiredQty : 0 };
          }
          return { ...i, checked: newChecked };
        }),
        updatedAt: Date.now(),
      };
    }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const importCSV = useCallback((checklistId: string, sections: { name: string; items: Omit<ChecklistItem, 'id' | 'createdAt'>[] }[]) => {
    setChecklists(prev => prev.map(c => {
      if (c.id !== checklistId) return c;
      const newSections: Section[] = sections.map((s, idx) => ({
        id: genId(),
        name: s.name,
        expanded: true,
        order: c.sections.length + idx,
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

  const getActiveChecklist = useCallback(() => {
    return checklists.find(c => c.id === activeChecklistId) || null;
  }, [checklists, activeChecklistId]);

  const getFolderChildren = useCallback((parentId: string | null) => {
    return folders.filter(f => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
  }, [folders]);

  const getFolderChecklists = useCallback((folderId: string) => {
    return checklists.filter(c => c.folderId === folderId).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [checklists]);

  const getChecklistStats = useCallback((checklistId: string, sectionId?: string | null) => {
    const cl = checklists.find(c => c.id === checklistId);
    if (!cl) return { total: 0, completed: 0, percentage: 0, categoryBreakdown: {}, partialItems: [] };

    let items = cl.items;
    if (sectionId !== undefined && sectionId !== null) {
      items = items.filter(i => i.sectionId === sectionId);
    } else if (sectionId === null) {
      // null means unsectioned items
    }

    const total = items.length;
    const completed = items.filter(i => i.checked).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const categoryBreakdown: Record<string, { total: number; completed: number }> = {};
    items.forEach(i => {
      if (!categoryBreakdown[i.category]) categoryBreakdown[i.category] = { total: 0, completed: 0 };
      categoryBreakdown[i.category].total++;
      if (i.checked) categoryBreakdown[i.category].completed++;
    });

    const partialItems = items.filter(i =>
      cl.settings.enableQuantity && i.requiredQty > 0 && i.ownedQty > 0 && i.ownedQty < i.requiredQty
    );

    return { total, completed, percentage, categoryBreakdown, partialItems };
  }, [checklists]);

  return (
    <AppContext.Provider value={{
      folders, checklists, settings, activeChecklistId, currentFolderId, viewMode,
      setActiveChecklistId, setCurrentFolderId, setViewMode,
      addFolder, updateFolder, deleteFolder, toggleFolderExpand,
      addChecklist, updateChecklist, deleteChecklist, moveChecklist,
      addSection, updateSection, deleteSection, toggleSectionExpand,
      addItem, updateItem, deleteItem, toggleItemCheck,
      updateSettings, importCSV,
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
