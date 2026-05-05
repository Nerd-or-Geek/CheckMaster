// ─── ItemStatus ───────────────────────────────────────────────────────────────

class ItemStatus {
  final String id;
  final String label;
  final String color; // hex e.g. '#10B981'
  final bool isDone;

  const ItemStatus({
    required this.id,
    required this.label,
    required this.color,
    required this.isDone,
  });

  ItemStatus copyWith({String? id, String? label, String? color, bool? isDone}) =>
      ItemStatus(
        id: id ?? this.id,
        label: label ?? this.label,
        color: color ?? this.color,
        isDone: isDone ?? this.isDone,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'color': color,
        'isDone': isDone,
      };

  factory ItemStatus.fromJson(Map<String, dynamic> j) => ItemStatus(
        id: j['id'] as String,
        label: j['label'] as String,
        color: j['color'] as String,
        isDone: j['isDone'] as bool,
      );
}

const List<ItemStatus> kDefaultItemStatuses = [
  ItemStatus(id: 'none',   label: 'None',        color: '#6B7280', isDone: false),
  ItemStatus(id: 'need',   label: 'Need to get', color: '#F59E0B', isDone: false),
  ItemStatus(id: 'have',   label: 'Have',        color: '#3B82F6', isDone: false),
  ItemStatus(id: 'packed', label: 'Packed',      color: '#10B981', isDone: true),
];

// ─── Section ──────────────────────────────────────────────────────────────────

class Section {
  final String id;
  final String name;
  final bool expanded;
  final int order;

  const Section({
    required this.id,
    required this.name,
    this.expanded = true,
    this.order = 0,
  });

  Section copyWith({String? id, String? name, bool? expanded, int? order}) =>
      Section(
        id: id ?? this.id,
        name: name ?? this.name,
        expanded: expanded ?? this.expanded,
        order: order ?? this.order,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'expanded': expanded,
        'order': order,
      };

  factory Section.fromJson(Map<String, dynamic> j) => Section(
        id: j['id'] as String,
        name: j['name'] as String,
        expanded: (j['expanded'] as bool?) ?? true,
        order: (j['order'] as int?) ?? 0,
      );
}

// ─── ChecklistItem ────────────────────────────────────────────────────────────

class ChecklistItem {
  final String id;
  final String name;
  final String description;
  final String category;
  final bool checked;
  final String? status; // ItemStatus.id
  final int requiredQty;
  final int ownedQty;
  final List<String> images;
  final String notes;
  final String? sectionId;
  final int createdAt;

  const ChecklistItem({
    required this.id,
    required this.name,
    this.description = '',
    this.category = 'general',
    this.checked = false,
    this.status,
    this.requiredQty = 1,
    this.ownedQty = 0,
    this.images = const [],
    this.notes = '',
    this.sectionId,
    required this.createdAt,
  });

  ChecklistItem copyWith({
    String? id,
    String? name,
    String? description,
    String? category,
    bool? checked,
    Object? status = _sentinel,
    int? requiredQty,
    int? ownedQty,
    List<String>? images,
    String? notes,
    Object? sectionId = _sentinel,
    int? createdAt,
  }) =>
      ChecklistItem(
        id: id ?? this.id,
        name: name ?? this.name,
        description: description ?? this.description,
        category: category ?? this.category,
        checked: checked ?? this.checked,
        status: status == _sentinel ? this.status : status as String?,
        requiredQty: requiredQty ?? this.requiredQty,
        ownedQty: ownedQty ?? this.ownedQty,
        images: images ?? this.images,
        notes: notes ?? this.notes,
        sectionId: sectionId == _sentinel ? this.sectionId : sectionId as String?,
        createdAt: createdAt ?? this.createdAt,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'category': category,
        'checked': checked,
        'status': status,
        'requiredQty': requiredQty,
        'ownedQty': ownedQty,
        'images': images,
        'notes': notes,
        'sectionId': sectionId,
        'createdAt': createdAt,
      };

  factory ChecklistItem.fromJson(Map<String, dynamic> j) => ChecklistItem(
        id: j['id'] as String,
        name: j['name'] as String,
        description: (j['description'] as String?) ?? '',
        category: (j['category'] as String?) ?? 'general',
        checked: (j['checked'] as bool?) ?? false,
        status: j['status'] as String?,
        requiredQty: (j['requiredQty'] as int?) ?? 1,
        ownedQty: (j['ownedQty'] as int?) ?? 0,
        images: (j['images'] as List<dynamic>?)?.cast<String>() ?? [],
        notes: (j['notes'] as String?) ?? '',
        sectionId: j['sectionId'] as String?,
        createdAt: (j['createdAt'] as int?) ?? 0,
      );
}

// Sentinel for nullable copyWith args
const _sentinel = Object();

// ─── ChecklistSettings ────────────────────────────────────────────────────────

class ChecklistSettings {
  final bool enableImages;
  final bool enableNotes;
  final bool enableQuantity;
  final bool enableSections;
  final String defaultCategory;
  final String? chartTypeOverride; // 'pie' | 'bar' | null
  final List<ItemStatus> itemStatuses;

  const ChecklistSettings({
    this.enableImages = false,
    this.enableNotes = true,
    this.enableQuantity = false,
    this.enableSections = true,
    this.defaultCategory = 'general',
    this.chartTypeOverride,
    this.itemStatuses = const [],
  });

  ChecklistSettings copyWith({
    bool? enableImages,
    bool? enableNotes,
    bool? enableQuantity,
    bool? enableSections,
    String? defaultCategory,
    Object? chartTypeOverride = _sentinel,
    List<ItemStatus>? itemStatuses,
  }) =>
      ChecklistSettings(
        enableImages: enableImages ?? this.enableImages,
        enableNotes: enableNotes ?? this.enableNotes,
        enableQuantity: enableQuantity ?? this.enableQuantity,
        enableSections: enableSections ?? this.enableSections,
        defaultCategory: defaultCategory ?? this.defaultCategory,
        chartTypeOverride: chartTypeOverride == _sentinel
            ? this.chartTypeOverride
            : chartTypeOverride as String?,
        itemStatuses: itemStatuses ?? this.itemStatuses,
      );

  Map<String, dynamic> toJson() => {
        'enableImages': enableImages,
        'enableNotes': enableNotes,
        'enableQuantity': enableQuantity,
        'enableSections': enableSections,
        'defaultCategory': defaultCategory,
        'chartTypeOverride': chartTypeOverride,
        'itemStatuses': itemStatuses.map((s) => s.toJson()).toList(),
      };

  factory ChecklistSettings.fromJson(Map<String, dynamic> j) => ChecklistSettings(
        enableImages: (j['enableImages'] as bool?) ?? false,
        enableNotes: (j['enableNotes'] as bool?) ?? true,
        enableQuantity: (j['enableQuantity'] as bool?) ?? false,
        enableSections: (j['enableSections'] as bool?) ?? true,
        defaultCategory: (j['defaultCategory'] as String?) ?? 'general',
        chartTypeOverride: j['chartTypeOverride'] as String?,
        itemStatuses: (j['itemStatuses'] as List<dynamic>?)
                ?.map((e) => ItemStatus.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

enum ChecklistType { basic, quantity, full }

enum ShareRole { owner, view, check, edit }

ShareRole shareRoleFromString(String? s) {
  switch (s) {
    case 'view':  return ShareRole.view;
    case 'check': return ShareRole.check;
    case 'edit':  return ShareRole.edit;
    default:      return ShareRole.owner;
  }
}

String shareRoleToString(ShareRole r) {
  switch (r) {
    case ShareRole.view:  return 'view';
    case ShareRole.check: return 'check';
    case ShareRole.edit:  return 'edit';
    case ShareRole.owner: return 'owner';
  }
}

class Checklist {
  final String id;
  final String name;
  final String description;
  final String folderId;
  final int? order;
  final bool isFavorite;
  final ChecklistType type;
  final ShareRole shareRole;
  final List<Section> sections;
  final List<ChecklistItem> items;
  final ChecklistSettings settings;
  final int createdAt;
  final int updatedAt;

  const Checklist({
    required this.id,
    required this.name,
    this.description = '',
    required this.folderId,
    this.order,
    this.isFavorite = false,
    this.type = ChecklistType.basic,
    this.shareRole = ShareRole.owner,
    this.sections = const [],
    this.items = const [],
    this.settings = const ChecklistSettings(),
    required this.createdAt,
    required this.updatedAt,
  });

  Checklist copyWith({
    String? id,
    String? name,
    String? description,
    String? folderId,
    Object? order = _sentinel,
    bool? isFavorite,
    ChecklistType? type,
    ShareRole? shareRole,
    List<Section>? sections,
    List<ChecklistItem>? items,
    ChecklistSettings? settings,
    int? createdAt,
    int? updatedAt,
  }) =>
      Checklist(
        id: id ?? this.id,
        name: name ?? this.name,
        description: description ?? this.description,
        folderId: folderId ?? this.folderId,
        order: order == _sentinel ? this.order : order as int?,
        isFavorite: isFavorite ?? this.isFavorite,
        type: type ?? this.type,
        shareRole: shareRole ?? this.shareRole,
        sections: sections ?? this.sections,
        items: items ?? this.items,
        settings: settings ?? this.settings,
        createdAt: createdAt ?? this.createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
      );

  bool get canEditStructure =>
      shareRole == ShareRole.owner || shareRole == ShareRole.edit;
  bool get canEditItemFields =>
      shareRole == ShareRole.owner || shareRole == ShareRole.edit;
  bool get canToggleChecks =>
      shareRole == ShareRole.owner ||
      shareRole == ShareRole.edit ||
      shareRole == ShareRole.check;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'folderId': folderId,
        'order': order,
        'isFavorite': isFavorite,
        'type': type.name,
        'shareRole': shareRoleToString(shareRole),
        'sections': sections.map((s) => s.toJson()).toList(),
        'items': items.map((i) => i.toJson()).toList(),
        'settings': settings.toJson(),
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };

  factory Checklist.fromJson(Map<String, dynamic> j) => Checklist(
        id: j['id'] as String,
        name: j['name'] as String,
        description: (j['description'] as String?) ?? '',
        folderId: j['folderId'] as String,
        order: j['order'] as int?,
        isFavorite: (j['isFavorite'] as bool?) ?? false,
        type: ChecklistType.values.firstWhere(
          (e) => e.name == (j['type'] as String?),
          orElse: () => ChecklistType.basic,
        ),
        shareRole: shareRoleFromString(j['shareRole'] as String?),
        sections: (j['sections'] as List<dynamic>?)
                ?.map((e) => Section.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => ChecklistItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        settings: j['settings'] != null
            ? ChecklistSettings.fromJson(j['settings'] as Map<String, dynamic>)
            : const ChecklistSettings(),
        createdAt: (j['createdAt'] as int?) ?? 0,
        updatedAt: (j['updatedAt'] as int?) ?? 0,
      );
}

// ─── Folder ───────────────────────────────────────────────────────────────────

enum SystemFolderType { favorites, shared }

class Folder {
  final String id;
  final String name;
  final String? parentId;
  final int? order;
  final SystemFolderType? isSystem;
  final bool expanded;
  final String color;
  final int createdAt;

  const Folder({
    required this.id,
    required this.name,
    this.parentId,
    this.order,
    this.isSystem,
    this.expanded = false,
    required this.color,
    required this.createdAt,
  });

  Folder copyWith({
    String? id,
    String? name,
    Object? parentId = _sentinel,
    Object? order = _sentinel,
    Object? isSystem = _sentinel,
    bool? expanded,
    String? color,
    int? createdAt,
  }) =>
      Folder(
        id: id ?? this.id,
        name: name ?? this.name,
        parentId: parentId == _sentinel ? this.parentId : parentId as String?,
        order: order == _sentinel ? this.order : order as int?,
        isSystem: isSystem == _sentinel ? this.isSystem : isSystem as SystemFolderType?,
        expanded: expanded ?? this.expanded,
        color: color ?? this.color,
        createdAt: createdAt ?? this.createdAt,
      );

  bool get isSystemFolder => isSystem != null;

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'parentId': parentId,
        'order': order,
        'isSystem': isSystem?.name,
        'expanded': expanded,
        'color': color,
        'createdAt': createdAt,
      };

  factory Folder.fromJson(Map<String, dynamic> j) => Folder(
        id: j['id'] as String,
        name: j['name'] as String,
        parentId: j['parentId'] as String?,
        order: j['order'] as int?,
        isSystem: j['isSystem'] == null
            ? null
            : SystemFolderType.values.firstWhere(
                (e) => e.name == j['isSystem'],
                orElse: () => SystemFolderType.favorites,
              ),
        expanded: (j['expanded'] as bool?) ?? false,
        color: (j['color'] as String?) ?? '#3B82F6',
        createdAt: (j['createdAt'] as int?) ?? 0,
      );
}

// ─── AppSettings ──────────────────────────────────────────────────────────────

enum StorageMode { local, server, cloud }
enum DefaultView { interactive, stats }
enum ChartType { pie, bar }
enum Density { compact, comfortable }

class AppSettings {
  final bool darkMode;
  final bool systemDarkMode;
  final DefaultView defaultView;
  final ChartType chartType;
  final Density density;
  final StorageMode storageMode;
  final int? lastSyncTime;
  final String serverUrl;
  final String serverApiKey;
  final String? serverUsername;
  final String? serverDisplayName;

  const AppSettings({
    this.darkMode = false,
    this.systemDarkMode = true,
    this.defaultView = DefaultView.interactive,
    this.chartType = ChartType.pie,
    this.density = Density.comfortable,
    this.storageMode = StorageMode.local,
    this.lastSyncTime,
    this.serverUrl = '',
    this.serverApiKey = '',
    this.serverUsername,
    this.serverDisplayName,
  });

  AppSettings copyWith({
    bool? darkMode,
    bool? systemDarkMode,
    DefaultView? defaultView,
    ChartType? chartType,
    Density? density,
    StorageMode? storageMode,
    Object? lastSyncTime = _sentinel,
    String? serverUrl,
    String? serverApiKey,
    Object? serverUsername = _sentinel,
    Object? serverDisplayName = _sentinel,
  }) =>
      AppSettings(
        darkMode: darkMode ?? this.darkMode,
        systemDarkMode: systemDarkMode ?? this.systemDarkMode,
        defaultView: defaultView ?? this.defaultView,
        chartType: chartType ?? this.chartType,
        density: density ?? this.density,
        storageMode: storageMode ?? this.storageMode,
        lastSyncTime: lastSyncTime == _sentinel ? this.lastSyncTime : lastSyncTime as int?,
        serverUrl: serverUrl ?? this.serverUrl,
        serverApiKey: serverApiKey ?? this.serverApiKey,
        serverUsername: serverUsername == _sentinel ? this.serverUsername : serverUsername as String?,
        serverDisplayName: serverDisplayName == _sentinel ? this.serverDisplayName : serverDisplayName as String?,
      );

  Map<String, dynamic> toJson() => {
        'darkMode': darkMode,
        'systemDarkMode': systemDarkMode,
        'defaultView': defaultView.name,
        'chartType': chartType.name,
        'density': density.name,
        'storageMode': storageMode.name,
        'lastSyncTime': lastSyncTime,
        'serverUrl': serverUrl,
        'serverApiKey': serverApiKey,
        'serverUsername': serverUsername,
        'serverDisplayName': serverDisplayName,
      };

  factory AppSettings.fromJson(Map<String, dynamic> j) => AppSettings(
        darkMode: (j['darkMode'] as bool?) ?? false,
        systemDarkMode: (j['systemDarkMode'] as bool?) ?? true,
        defaultView: DefaultView.values.firstWhere(
          (e) => e.name == (j['defaultView'] as String?),
          orElse: () => DefaultView.interactive,
        ),
        chartType: ChartType.values.firstWhere(
          (e) => e.name == (j['chartType'] as String?),
          orElse: () => ChartType.pie,
        ),
        density: Density.values.firstWhere(
          (e) => e.name == (j['density'] as String?),
          orElse: () => Density.comfortable,
        ),
        storageMode: StorageMode.values.firstWhere(
          (e) => e.name == (j['storageMode'] as String?),
          orElse: () => StorageMode.local,
        ),
        lastSyncTime: j['lastSyncTime'] as int?,
        serverUrl: (j['serverUrl'] as String?) ?? '',
        serverApiKey: (j['serverApiKey'] as String?) ?? '',
        serverUsername: j['serverUsername'] as String?,
        serverDisplayName: j['serverDisplayName'] as String?,
      );
}

// ─── Seed data ────────────────────────────────────────────────────────────────

final int _now = DateTime.now().millisecondsSinceEpoch;
int _ago(int days) => _now - days * 86400000;

final List<Folder> kInitialFolders = [
  Folder(id: 'f1', name: 'Home',     parentId: null, expanded: true,  color: '#3B82F6', createdAt: _ago(10)),
  Folder(id: 'f2', name: 'Work',     parentId: null, expanded: false, color: '#F59E0B', createdAt: _ago(9)),
  Folder(id: 'f3', name: 'Kitchen',  parentId: 'f1', expanded: false, color: '#10B981', createdAt: _ago(8)),
  Folder(id: 'f4', name: 'Garage',   parentId: 'f1', expanded: false, color: '#8B5CF6', createdAt: _ago(7)),
  Folder(id: 'f5', name: 'Projects', parentId: 'f2', expanded: false, color: '#EC4899', createdAt: _ago(6)),
  Folder(id: 'f6', name: 'Meetings', parentId: 'f2', expanded: false, color: '#06B6D4', createdAt: _ago(5)),
  Folder(id: 'f7', name: 'Shopping', parentId: null, expanded: false, color: '#10B981', createdAt: _ago(4)),
  Folder(id: 'f8', name: 'Travel',   parentId: null, expanded: false, color: '#EF4444', createdAt: _ago(3)),
  Folder(id: 'f9', name: 'Pantry',   parentId: 'f3', expanded: false, color: '#F59E0B', createdAt: _ago(2)),
];

final List<Checklist> kInitialChecklists = [
  Checklist(
    id: 'cl1',
    name: 'Grocery Shopping',
    description: 'Weekly grocery run essentials',
    folderId: 'f7',
    type: ChecklistType.quantity,
    sections: [
      Section(id: 's1', name: 'Fruits & Vegetables', expanded: true,  order: 0),
      Section(id: 's2', name: 'Dairy & Eggs',        expanded: true,  order: 1),
      Section(id: 's3', name: 'Pantry Staples',      expanded: false, order: 2),
      Section(id: 's4', name: 'Beverages',           expanded: false, order: 3),
    ],
    items: [
      ChecklistItem(id: 'i1', name: 'Apples',       description: 'Gala or Fuji',    category: 'shopping', checked: true,  requiredQty: 6, ownedQty: 6, sectionId: 's1', createdAt: _now),
      ChecklistItem(id: 'i2', name: 'Bananas',      description: 'Ripe, yellow',    category: 'shopping', checked: false, requiredQty: 4, ownedQty: 2, notes: 'Check for spots', sectionId: 's1', createdAt: _now),
      ChecklistItem(id: 'i3', name: 'Spinach',      description: 'Baby spinach bag',category: 'health',   checked: true,  requiredQty: 2, ownedQty: 2, sectionId: 's1', createdAt: _now),
      ChecklistItem(id: 'i4', name: 'Tomatoes',     description: 'Roma tomatoes',   category: 'shopping', checked: false, requiredQty: 5, ownedQty: 0, sectionId: 's1', createdAt: _now),
      ChecklistItem(id: 'i5', name: 'Whole Milk',   description: '1-gallon',        category: 'shopping', checked: true,  requiredQty: 1, ownedQty: 1, sectionId: 's2', createdAt: _now),
      ChecklistItem(id: 'i6', name: 'Eggs',         description: 'Large, dozen',    category: 'shopping', checked: false, requiredQty: 2, ownedQty: 0, sectionId: 's2', createdAt: _now),
      ChecklistItem(id: 'i7', name: 'Greek Yogurt', description: 'Plain, 32oz',     category: 'health',   checked: false, requiredQty: 1, ownedQty: 0, sectionId: 's2', createdAt: _now),
      ChecklistItem(id: 'i8', name: 'Pasta',        description: 'Spaghetti 1lb',   category: 'shopping', checked: true,  requiredQty: 3, ownedQty: 3, sectionId: 's3', createdAt: _now),
    ],
    settings: ChecklistSettings(enableQuantity: true, enableSections: true, enableNotes: true),
    createdAt: _ago(4),
    updatedAt: _ago(1),
  ),
  Checklist(
    id: 'cl2',
    name: 'Home Maintenance',
    description: 'Monthly home upkeep tasks',
    folderId: 'f1',
    type: ChecklistType.basic,
    sections: [],
    items: [
      ChecklistItem(id: 'i20', name: 'Check smoke detectors', category: 'safety',    checked: true,  requiredQty: 1, ownedQty: 1, createdAt: _now),
      ChecklistItem(id: 'i21', name: 'Replace HVAC filter',   category: 'home',      checked: false, requiredQty: 1, ownedQty: 0, createdAt: _now),
      ChecklistItem(id: 'i22', name: 'Clean gutters',         category: 'home',      checked: false, requiredQty: 1, ownedQty: 0, createdAt: _now),
      ChecklistItem(id: 'i23', name: 'Test GFCI outlets',     category: 'safety',    checked: true,  requiredQty: 1, ownedQty: 1, createdAt: _now),
    ],
    settings: const ChecklistSettings(),
    createdAt: _ago(3),
    updatedAt: _ago(2),
  ),
  Checklist(
    id: 'cl3',
    name: 'Europe Trip Packing',
    description: '2-week Europe vacation',
    folderId: 'f8',
    type: ChecklistType.full,
    sections: [
      Section(id: 'st1', name: 'Clothing',   expanded: true,  order: 0),
      Section(id: 'st2', name: 'Documents',  expanded: true,  order: 1),
      Section(id: 'st3', name: 'Electronics',expanded: false, order: 2),
    ],
    items: [
      ChecklistItem(id: 'it1', name: 'Passport',      category: 'travel',      checked: true,  requiredQty: 1, ownedQty: 1, sectionId: 'st2', createdAt: _now),
      ChecklistItem(id: 'it2', name: 'Travel adapter', category: 'electronics', checked: false, requiredQty: 2, ownedQty: 0, sectionId: 'st3', createdAt: _now),
      ChecklistItem(id: 'it3', name: 'T-Shirts',       category: 'clothing',    checked: false, requiredQty: 7, ownedQty: 3, sectionId: 'st1', createdAt: _now),
      ChecklistItem(id: 'it4', name: 'Phone charger',  category: 'electronics', checked: true,  requiredQty: 1, ownedQty: 1, sectionId: 'st3', createdAt: _now),
    ],
    settings: ChecklistSettings(enableQuantity: true, enableSections: true, enableNotes: true, enableImages: true),
    createdAt: _ago(2),
    updatedAt: _ago(1),
  ),
  Checklist(
    id: 'cl4',
    name: 'Q2 Sprint Tasks',
    description: 'Developer sprint items',
    folderId: 'f5',
    type: ChecklistType.basic,
    sections: [],
    items: [
      ChecklistItem(id: 'iw1', name: 'Design review',   category: 'work', checked: true,  requiredQty: 1, ownedQty: 1, createdAt: _now),
      ChecklistItem(id: 'iw2', name: 'API integration', category: 'work', checked: false, requiredQty: 1, ownedQty: 0, createdAt: _now),
      ChecklistItem(id: 'iw3', name: 'Unit tests',      category: 'work', checked: false, requiredQty: 1, ownedQty: 0, createdAt: _now),
    ],
    settings: const ChecklistSettings(),
    createdAt: _ago(5),
    updatedAt: _ago(1),
  ),
];
