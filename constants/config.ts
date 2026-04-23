export const APP_NAME = 'CheckMaster';
export const APP_VERSION = '1.0.0';

export const STORAGE_KEYS = {
  FOLDERS: '@checkmaster_folders',
  CHECKLISTS: '@checkmaster_checklists',
  SETTINGS: '@checkmaster_settings',
  ACTIVE_CHECKLIST: '@checkmaster_active_checklist',
  NAV_STATE: '@checkmaster_nav_state',
};

export const DEFAULT_CATEGORIES = [
  'general',
  'urgent',
  'important',
  'personal',
  'work',
  'shopping',
  'health',
  'education',
];

export const CHART_TYPES = ['pie', 'bar'] as const;
export const VIEW_MODES = ['interactive', 'stats'] as const;
export const DENSITY_MODES = ['compact', 'comfortable'] as const;
export const STORAGE_MODES = ['local', 'cloud'] as const;
