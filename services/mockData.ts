export interface ChecklistItem {
  id: string;
  name: string;
  description: string;
  category: string;
  checked: boolean;
  requiredQty: number;
  ownedQty: number;
  images: string[];
  notes: string;
  sectionId: string | null;
  createdAt: number;
}

export interface Section {
  id: string;
  name: string;
  expanded: boolean;
  order: number;
}

export interface Checklist {
  id: string;
  name: string;
  description: string;
  folderId: string;
  type: 'basic' | 'quantity' | 'full';
  sections: Section[];
  items: ChecklistItem[];
  settings: {
    enableImages: boolean;
    enableNotes: boolean;
    enableQuantity: boolean;
    enableSections: boolean;
    defaultCategory: string;
    chartTypeOverride: 'pie' | 'bar' | null;
  };
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  expanded: boolean;
  color: string;
  createdAt: number;
}

export interface AppSettings {
  darkMode: boolean;
  defaultView: 'interactive' | 'stats';
  chartType: 'pie' | 'bar';
  density: 'compact' | 'comfortable';
  storageMode: 'local' | 'cloud';
  lastSyncTime: number | null;
}

export const defaultSettings: AppSettings = {
  darkMode: false,
  defaultView: 'interactive',
  chartType: 'pie',
  density: 'comfortable',
  storageMode: 'local',
  lastSyncTime: null,
};

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const initialFolders: Folder[] = [
  { id: 'f1', name: 'Home', parentId: null, expanded: true, color: '#3B82F6', createdAt: Date.now() - 86400000 * 10 },
  { id: 'f2', name: 'Work', parentId: null, expanded: false, color: '#F59E0B', createdAt: Date.now() - 86400000 * 9 },
  { id: 'f3', name: 'Kitchen', parentId: 'f1', expanded: false, color: '#10B981', createdAt: Date.now() - 86400000 * 8 },
  { id: 'f4', name: 'Garage', parentId: 'f1', expanded: false, color: '#8B5CF6', createdAt: Date.now() - 86400000 * 7 },
  { id: 'f5', name: 'Projects', parentId: 'f2', expanded: false, color: '#EC4899', createdAt: Date.now() - 86400000 * 6 },
  { id: 'f6', name: 'Meetings', parentId: 'f2', expanded: false, color: '#06B6D4', createdAt: Date.now() - 86400000 * 5 },
  { id: 'f7', name: 'Shopping', parentId: null, expanded: false, color: '#10B981', createdAt: Date.now() - 86400000 * 4 },
  { id: 'f8', name: 'Travel', parentId: null, expanded: false, color: '#EF4444', createdAt: Date.now() - 86400000 * 3 },
  { id: 'f9', name: 'Pantry', parentId: 'f3', expanded: false, color: '#F59E0B', createdAt: Date.now() - 86400000 * 2 },
];

export const initialChecklists: Checklist[] = [
  {
    id: 'cl1',
    name: 'Grocery Shopping',
    description: 'Weekly grocery run essentials',
    folderId: 'f7',
    type: 'quantity',
    sections: [
      { id: 's1', name: 'Fruits & Vegetables', expanded: true, order: 0 },
      { id: 's2', name: 'Dairy & Eggs', expanded: true, order: 1 },
      { id: 's3', name: 'Pantry Staples', expanded: false, order: 2 },
      { id: 's4', name: 'Beverages', expanded: false, order: 3 },
    ],
    items: [
      { id: 'i1', name: 'Apples', description: 'Gala or Fuji', category: 'shopping', checked: true, requiredQty: 6, ownedQty: 6, images: [], notes: '', sectionId: 's1', createdAt: Date.now() },
      { id: 'i2', name: 'Bananas', description: 'Ripe, yellow', category: 'shopping', checked: false, requiredQty: 4, ownedQty: 2, images: [], notes: 'Check for spots', sectionId: 's1', createdAt: Date.now() },
      { id: 'i3', name: 'Spinach', description: 'Baby spinach bag', category: 'health', checked: true, requiredQty: 2, ownedQty: 2, images: [], notes: '', sectionId: 's1', createdAt: Date.now() },
      { id: 'i4', name: 'Tomatoes', description: 'Roma tomatoes', category: 'shopping', checked: false, requiredQty: 5, ownedQty: 0, images: [], notes: '', sectionId: 's1', createdAt: Date.now() },
      { id: 'i5', name: 'Carrots', description: 'Organic baby carrots', category: 'health', checked: false, requiredQty: 2, ownedQty: 1, images: [], notes: '', sectionId: 's1', createdAt: Date.now() },
      { id: 'i6', name: 'Whole Milk', description: '1 gallon', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: 's2', createdAt: Date.now() },
      { id: 'i7', name: 'Eggs', description: 'Free range, large', category: 'shopping', checked: false, requiredQty: 12, ownedQty: 4, images: [], notes: 'Check expiry date', sectionId: 's2', createdAt: Date.now() },
      { id: 'i8', name: 'Greek Yogurt', description: 'Plain, full-fat', category: 'health', checked: false, requiredQty: 3, ownedQty: 0, images: [], notes: '', sectionId: 's2', createdAt: Date.now() },
      { id: 'i9', name: 'Cheddar Cheese', description: 'Sharp, block', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: 's2', createdAt: Date.now() },
      { id: 'i10', name: 'Rice', description: 'Jasmine, 2lb bag', category: 'shopping', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: '', sectionId: 's3', createdAt: Date.now() },
      { id: 'i11', name: 'Olive Oil', description: 'Extra virgin', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: 's3', createdAt: Date.now() },
      { id: 'i12', name: 'Pasta', description: 'Penne, whole wheat', category: 'shopping', checked: false, requiredQty: 2, ownedQty: 1, images: [], notes: '', sectionId: 's3', createdAt: Date.now() },
      { id: 'i13', name: 'Canned Beans', description: 'Black beans', category: 'shopping', checked: false, requiredQty: 3, ownedQty: 0, images: [], notes: '', sectionId: 's3', createdAt: Date.now() },
      { id: 'i14', name: 'Orange Juice', description: 'No pulp', category: 'shopping', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: '', sectionId: 's4', createdAt: Date.now() },
      { id: 'i15', name: 'Coffee', description: 'Medium roast, ground', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: 'Colombian blend preferred', sectionId: 's4', createdAt: Date.now() },
      { id: 'i16', name: 'Green Tea', description: 'Matcha bags', category: 'health', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: '', sectionId: 's4', createdAt: Date.now() },
    ],
    settings: { enableImages: false, enableNotes: true, enableQuantity: true, enableSections: true, defaultCategory: 'shopping', chartTypeOverride: null },
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: 'cl2',
    name: 'Office Supplies',
    description: 'Quarterly restocking list',
    folderId: 'f2',
    type: 'quantity',
    sections: [
      { id: 's5', name: 'Stationery', expanded: true, order: 0 },
      { id: 's6', name: 'Tech', expanded: true, order: 1 },
    ],
    items: [
      { id: 'i17', name: 'Pens', description: 'Blue ink, ballpoint', category: 'work', checked: false, requiredQty: 20, ownedQty: 8, images: [], notes: '', sectionId: 's5', createdAt: Date.now() },
      { id: 'i18', name: 'Notebooks', description: 'A4, lined', category: 'work', checked: false, requiredQty: 10, ownedQty: 3, images: [], notes: '', sectionId: 's5', createdAt: Date.now() },
      { id: 'i19', name: 'Sticky Notes', description: 'Assorted colors', category: 'work', checked: true, requiredQty: 5, ownedQty: 5, images: [], notes: '', sectionId: 's5', createdAt: Date.now() },
      { id: 'i20', name: 'Paper Clips', description: 'Small, metal', category: 'work', checked: false, requiredQty: 100, ownedQty: 45, images: [], notes: '', sectionId: 's5', createdAt: Date.now() },
      { id: 'i21', name: 'USB-C Cables', description: '6ft braided', category: 'work', checked: false, requiredQty: 5, ownedQty: 2, images: [], notes: '', sectionId: 's6', createdAt: Date.now() },
      { id: 'i22', name: 'Webcam', description: '1080p HD', category: 'work', checked: true, requiredQty: 2, ownedQty: 2, images: [], notes: '', sectionId: 's6', createdAt: Date.now() },
      { id: 'i23', name: 'Mouse Pads', description: 'Large, black', category: 'work', checked: false, requiredQty: 5, ownedQty: 1, images: [], notes: '', sectionId: 's6', createdAt: Date.now() },
      { id: 'i24', name: 'HDMI Cables', description: '3ft', category: 'work', checked: false, requiredQty: 3, ownedQty: 0, images: [], notes: '', sectionId: 's6', createdAt: Date.now() },
    ],
    settings: { enableImages: false, enableNotes: true, enableQuantity: true, enableSections: true, defaultCategory: 'work', chartTypeOverride: null },
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 7200000,
  },
  {
    id: 'cl3',
    name: 'Vacation Packing',
    description: 'Beach trip essentials',
    folderId: 'f8',
    type: 'basic',
    sections: [
      { id: 's7', name: 'Clothing', expanded: true, order: 0 },
      { id: 's8', name: 'Toiletries', expanded: true, order: 1 },
      { id: 's9', name: 'Documents', expanded: false, order: 2 },
    ],
    items: [
      { id: 'i25', name: 'Swimsuit', description: '', category: 'personal', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's7', createdAt: Date.now() },
      { id: 'i26', name: 'Sunglasses', description: 'UV protection', category: 'personal', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's7', createdAt: Date.now() },
      { id: 'i27', name: 'Light Jacket', description: 'For evenings', category: 'personal', checked: false, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's7', createdAt: Date.now() },
      { id: 'i28', name: 'Sandals', description: 'Water-resistant', category: 'personal', checked: false, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's7', createdAt: Date.now() },
      { id: 'i29', name: 'T-Shirts', description: '4-5 casual shirts', category: 'personal', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's7', createdAt: Date.now() },
      { id: 'i30', name: 'Sunscreen', description: 'SPF 50+', category: 'health', checked: false, requiredQty: 0, ownedQty: 0, images: [], notes: 'Reef-safe brand', sectionId: 's8', createdAt: Date.now() },
      { id: 'i31', name: 'Toothbrush', description: '', category: 'health', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's8', createdAt: Date.now() },
      { id: 'i32', name: 'Shampoo', description: 'Travel size', category: 'health', checked: false, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's8', createdAt: Date.now() },
      { id: 'i33', name: 'Passport', description: 'Check expiry', category: 'urgent', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: 'Expires Dec 2026', sectionId: 's9', createdAt: Date.now() },
      { id: 'i34', name: 'Travel Insurance', description: 'Print confirmation', category: 'important', checked: false, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's9', createdAt: Date.now() },
      { id: 'i35', name: 'Hotel Booking', description: 'Confirmation email', category: 'important', checked: true, requiredQty: 0, ownedQty: 0, images: [], notes: '', sectionId: 's9', createdAt: Date.now() },
    ],
    settings: { enableImages: false, enableNotes: true, enableQuantity: false, enableSections: true, defaultCategory: 'personal', chartTypeOverride: null },
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 1800000,
  },
  {
    id: 'cl4',
    name: 'Pantry Inventory',
    description: 'Track what we have at home',
    folderId: 'f9',
    type: 'quantity',
    sections: [],
    items: [
      { id: 'i36', name: 'Flour', description: 'All-purpose', category: 'shopping', checked: false, requiredQty: 2, ownedQty: 1, images: [], notes: '', sectionId: null, createdAt: Date.now() },
      { id: 'i37', name: 'Sugar', description: 'Granulated', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: null, createdAt: Date.now() },
      { id: 'i38', name: 'Salt', description: 'Sea salt', category: 'shopping', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: null, createdAt: Date.now() },
      { id: 'i39', name: 'Baking Soda', description: '', category: 'shopping', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: '', sectionId: null, createdAt: Date.now() },
      { id: 'i40', name: 'Cinnamon', description: 'Ground', category: 'shopping', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: 'Running low', sectionId: null, createdAt: Date.now() },
    ],
    settings: { enableImages: false, enableNotes: true, enableQuantity: true, enableSections: false, defaultCategory: 'shopping', chartTypeOverride: null },
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 600000,
  },
  {
    id: 'cl5',
    name: 'Project Alpha Tasks',
    description: 'Sprint deliverables tracking',
    folderId: 'f5',
    type: 'full',
    sections: [
      { id: 's10', name: 'Design Phase', expanded: true, order: 0 },
      { id: 's11', name: 'Development', expanded: true, order: 1 },
      { id: 's12', name: 'QA Testing', expanded: false, order: 2 },
    ],
    items: [
      { id: 'i41', name: 'Wireframes', description: 'Low-fidelity for all screens', category: 'work', checked: true, requiredQty: 8, ownedQty: 8, images: [], notes: 'Approved by PM', sectionId: 's10', createdAt: Date.now() },
      { id: 'i42', name: 'UI Mockups', description: 'High-fidelity Figma files', category: 'work', checked: false, requiredQty: 8, ownedQty: 5, images: [], notes: 'Dashboard and reports pending', sectionId: 's10', createdAt: Date.now() },
      { id: 'i43', name: 'Design System', description: 'Component library', category: 'important', checked: false, requiredQty: 1, ownedQty: 0, images: [], notes: '', sectionId: 's10', createdAt: Date.now() },
      { id: 'i44', name: 'API Endpoints', description: 'REST API implementation', category: 'work', checked: false, requiredQty: 12, ownedQty: 7, images: [], notes: 'Auth endpoints done', sectionId: 's11', createdAt: Date.now() },
      { id: 'i45', name: 'Frontend Pages', description: 'React components', category: 'work', checked: false, requiredQty: 8, ownedQty: 3, images: [], notes: '', sectionId: 's11', createdAt: Date.now() },
      { id: 'i46', name: 'Database Schema', description: 'PostgreSQL migrations', category: 'important', checked: true, requiredQty: 1, ownedQty: 1, images: [], notes: '', sectionId: 's11', createdAt: Date.now() },
      { id: 'i47', name: 'Unit Tests', description: 'Backend coverage', category: 'work', checked: false, requiredQty: 50, ownedQty: 18, images: [], notes: '', sectionId: 's12', createdAt: Date.now() },
      { id: 'i48', name: 'Integration Tests', description: 'End-to-end flows', category: 'urgent', checked: false, requiredQty: 10, ownedQty: 2, images: [], notes: 'Critical path only', sectionId: 's12', createdAt: Date.now() },
    ],
    settings: { enableImages: true, enableNotes: true, enableQuantity: true, enableSections: true, defaultCategory: 'work', chartTypeOverride: 'bar' },
    createdAt: Date.now() - 86400000 * 7,
    updatedAt: Date.now() - 900000,
  },
];
