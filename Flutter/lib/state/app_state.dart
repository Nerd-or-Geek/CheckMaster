import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http_pkg;
import 'package:shared_preferences/shared_preferences.dart';
import '../models/models.dart';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const _kFolders       = 'cm_folders';
const _kChecklists    = 'cm_checklists';
const _kSettings      = 'cm_settings';
const _kActiveChecklist = 'cm_active_checklist';

// ─── Special folder IDs ───────────────────────────────────────────────────────

const kFavoritesId = '__sys_favorites__';
const kSharedId    = '__sys_shared__';

bool _isSystemId(String? id) => id == kFavoritesId || id == kSharedId;

// ─── ID generator ─────────────────────────────────────────────────────────────

String _genId() {
  final ts = DateTime.now().millisecondsSinceEpoch.toRadixString(36);
  final rnd = Random().nextDouble().toString().replaceAll('0.', '').substring(0, 6);
  return '$ts$rnd';
}

// ─── AppState ─────────────────────────────────────────────────────────────────

class AppState extends ChangeNotifier {
  List<Folder>    _folders    = List.of(kInitialFolders);
  List<Checklist> _checklists = List.of(kInitialChecklists);
  AppSettings     _settings   = const AppSettings();
  String?         _activeChecklistId = 'cl1';
  bool            _loaded = false;

  List<Folder>    get folders    => List.unmodifiable(_folders);
  List<Checklist> get checklists => List.unmodifiable(_checklists);
  AppSettings     get settings   => _settings;
  String?         get activeChecklistId => _activeChecklistId;
  bool            get isLoaded   => _loaded;

  Checklist? get activeChecklist =>
      _activeChecklistId == null
          ? null
          : _checklists.firstWhereOrNull((c) => c.id == _activeChecklistId);

  bool get isServerConnected =>
      _settings.serverUrl.isNotEmpty && _settings.serverApiKey.isNotEmpty;

  // ── Load / save ──────────────────────────────────────────────────────────────

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    try {
      final fStr = prefs.getString(_kFolders);
      final cStr = prefs.getString(_kChecklists);
      final sStr = prefs.getString(_kSettings);
      final aStr = prefs.getString(_kActiveChecklist);

      if (fStr != null) {
        _folders = (jsonDecode(fStr) as List)
            .map((e) => Folder.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      if (cStr != null) {
        _checklists = (jsonDecode(cStr) as List)
            .map((e) => Checklist.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      if (sStr != null) {
        final loaded = AppSettings.fromJson(jsonDecode(sStr) as Map<String, dynamic>);
        _settings = loaded;
      }
      if (aStr != null) _activeChecklistId = aStr;
    } catch (_) {}
    _loaded = true;
    notifyListeners();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setString(_kFolders, jsonEncode(_folders.map((f) => f.toJson()).toList()));
    prefs.setString(_kChecklists, jsonEncode(_checklists.map((c) => c.toJson()).toList()));
    prefs.setString(_kSettings, jsonEncode(_settings.toJson()));
    if (_activeChecklistId != null) {
      prefs.setString(_kActiveChecklist, _activeChecklistId!);
    } else {
      prefs.remove(_kActiveChecklist);
    }
  }

  void _notify() {
    notifyListeners();
    _save();
  }

  // ── Active checklist ─────────────────────────────────────────────────────────

  void setActiveChecklistId(String? id) {
    _activeChecklistId = id;
    _notify();
  }

  // ── Folder accessors ─────────────────────────────────────────────────────────

  List<Folder> getFolderChildren(String? parentId) {
    final children = _folders
        .where((f) => f.parentId == parentId)
        .toList()
      ..sort((a, b) => (a.order ?? 0).compareTo(b.order ?? 0));

    if (parentId == null) {
      // Inject system folders at the top
      final sys = <Folder>[
        Folder(
          id: kFavoritesId,
          name: 'Favorites',
          color: '#F59E0B',
          createdAt: 0,
          isSystem: SystemFolderType.favorites,
        ),
        if (isServerConnected)
          Folder(
            id: kSharedId,
            name: 'Shared with me',
            color: '#06B6D4',
            createdAt: 0,
            isSystem: SystemFolderType.shared,
          ),
      ];
      return [...sys, ...children];
    }
    return children;
  }

  List<Checklist> getFolderChecklists(String folderId) {
    List<Checklist> result;
    if (folderId == kFavoritesId) {
      result = _checklists.where((c) => c.isFavorite).toList();
    } else if (folderId == kSharedId) {
      result = _checklists.where((c) => c.shareRole != ShareRole.owner).toList();
    } else {
      result = _checklists.where((c) => c.folderId == folderId).toList();
    }
    result.sort((a, b) => (a.order ?? 0).compareTo(b.order ?? 0));
    return result;
  }

  ChecklistStats getChecklistStats(String checklistId, {String? sectionId}) {
    final cl = _checklists.firstWhereOrNull((c) => c.id == checklistId);
    if (cl == null) return ChecklistStats.empty();
    final statuses = cl.settings.itemStatuses;
    final useStatuses = statuses.isNotEmpty;
    final items = sectionId == null
        ? cl.items
        : cl.items.where((i) => i.sectionId == sectionId).toList();

    final total = items.length;
    int completed = 0;
    final catBreakdown = <String, ({int total, int completed})>{};
    final partial = <ChecklistItem>[];

    for (final item in items) {
      bool done;
      if (useStatuses && item.status != null) {
        done = statuses.firstWhereOrNull((s) => s.id == item.status)?.isDone ?? false;
      } else {
        done = item.checked;
      }
      if (done) completed++;
      if (cl.settings.enableQuantity &&
          item.requiredQty > 0 &&
          item.ownedQty > 0 &&
          item.ownedQty < item.requiredQty) {
        partial.add(item);
      }
      final cat = item.category;
      final prev = catBreakdown[cat] ?? (total: 0, completed: 0);
      catBreakdown[cat] = (total: prev.total + 1, completed: prev.completed + (done ? 1 : 0));
    }

    return ChecklistStats(
      total: total,
      completed: completed,
      percentage: total > 0 ? ((completed / total) * 100).round() : 0,
      categoryBreakdown: catBreakdown,
      partialItems: partial,
    );
  }

  // ── Folder CRUD ───────────────────────────────────────────────────────────────

  void addFolder(String name, String? parentId, String color) {
    if (_isSystemId(parentId)) return;
    _folders = [..._folders, Folder(id: _genId(), name: name, parentId: parentId, color: color, createdAt: _ts())];
    _notify();
  }

  void updateFolder(String id, {String? name, String? color, bool? expanded}) {
    if (_isSystemId(id)) return;
    _folders = _folders.map((f) {
      if (f.id != id) return f;
      return f.copyWith(name: name ?? f.name, color: color ?? f.color, expanded: expanded ?? f.expanded);
    }).toList();
    _notify();
  }

  void deleteFolder(String id) {
    if (_isSystemId(id)) return;
    final toDelete = <String>{};
    void collect(String fid) {
      toDelete.add(fid);
      for (final child in _folders.where((f) => f.parentId == fid)) {
        collect(child.id);
      }
    }
    collect(id);
    _folders = _folders.where((f) => !toDelete.contains(f.id)).toList();
    _checklists = _checklists.where((c) => !toDelete.contains(c.folderId)).toList();
    if (toDelete.contains(_activeChecklistId)) _activeChecklistId = null;
    _notify();
  }

  void toggleFolderExpand(String id) {
    if (_isSystemId(id)) return;
    _folders = _folders.map((f) => f.id == id ? f.copyWith(expanded: !f.expanded) : f).toList();
    _notify();
  }

  void reorderFolders(String? parentId, List<String> orderedIds) {
    if (_isSystemId(parentId)) return;
    final others = _folders.where((f) => f.parentId != parentId).toList();
    final reordered = orderedIds
        .asMap()
        .entries
        .map((e) {
          final found = _folders.firstWhereOrNull((f) => f.id == e.value);
          return found?.copyWith(order: e.key);
        })
        .whereType<Folder>()
        .toList();
    _folders = [...others, ...reordered];
    _notify();
  }

  // ── Checklist CRUD ────────────────────────────────────────────────────────────

  void addChecklist({
    required String name,
    String description = '',
    required String folderId,
    ChecklistType type = ChecklistType.basic,
    ChecklistSettings? settings,
  }) {
    if (_isSystemId(folderId)) return;
    final now = _ts();
    final order = _checklists.where((c) => c.folderId == folderId).length;
    final newCl = Checklist(
      id: _genId(),
      name: name,
      description: description,
      folderId: folderId,
      type: type,
      order: order,
      settings: settings ??
          ChecklistSettings(
            enableQuantity: type != ChecklistType.basic,
            enableSections: true,
          ),
      createdAt: now,
      updatedAt: now,
    );
    _checklists = [..._checklists, newCl];
    _activeChecklistId = newCl.id;
    _notify();
  }

  void updateChecklist(String id, Checklist Function(Checklist) updater) {
    _checklists = _checklists.map((c) {
      if (c.id != id || !c.canEditStructure) return c;
      return updater(c).copyWith(updatedAt: _ts());
    }).toList();
    _notify();
  }

  void deleteChecklist(String id) {
    _checklists = _checklists.where((c) => c.id != id).toList();
    if (_activeChecklistId == id) _activeChecklistId = null;
    _notify();
  }

  void moveChecklist(String checklistId, String targetFolderId) {
    if (_isSystemId(targetFolderId)) return;
    _checklists = _checklists.map((c) {
      if (c.id != checklistId || !c.canEditStructure) return c;
      return c.copyWith(folderId: targetFolderId, updatedAt: _ts());
    }).toList();
    _notify();
  }

  void reorderChecklists(String folderId, List<String> orderedIds) {
    _checklists = _checklists.map((c) {
      bool inGroup;
      if (folderId == kFavoritesId) inGroup = c.isFavorite;
      else if (folderId == kSharedId) inGroup = c.shareRole != ShareRole.owner;
      else inGroup = c.folderId == folderId;
      if (!inGroup) return c;
      final idx = orderedIds.indexOf(c.id);
      if (idx < 0) return c;
      return c.copyWith(order: idx, updatedAt: _ts());
    }).toList();
    _notify();
  }

  void toggleChecklistFavorite(String id) {
    _checklists = _checklists
        .map((c) => c.id == id ? c.copyWith(isFavorite: !c.isFavorite, updatedAt: _ts()) : c)
        .toList();
    _notify();
  }

  // ── Sections ──────────────────────────────────────────────────────────────────

  void addSection(String checklistId, String name) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      final s = Section(id: _genId(), name: name, expanded: true, order: c.sections.length);
      return c.copyWith(sections: [...c.sections, s]);
    });
  }

  void updateSection(String checklistId, String sectionId, {String? name, bool? expanded}) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      return c.copyWith(
        sections: c.sections.map((s) {
          if (s.id != sectionId) return s;
          return s.copyWith(name: name ?? s.name, expanded: expanded ?? s.expanded);
        }).toList(),
      );
    });
  }

  void deleteSection(String checklistId, String sectionId) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      return c.copyWith(
        sections: c.sections.where((s) => s.id != sectionId).toList(),
        items: c.items
            .map((i) => i.sectionId == sectionId ? i.copyWith(sectionId: null) : i)
            .toList(),
      );
    });
  }

  void toggleSectionExpand(String checklistId, String sectionId) {
    _mutate(checklistId, (c) => c.copyWith(
      sections: c.sections.map((s) =>
          s.id == sectionId ? s.copyWith(expanded: !s.expanded) : s).toList(),
    ));
  }

  void reorderSections(String checklistId, List<String> orderedIds) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      final reordered = orderedIds
          .asMap()
          .entries
          .map((e) {
            final found = c.sections.firstWhereOrNull((s) => s.id == e.value);
            return found?.copyWith(order: e.key);
          })
          .whereType<Section>()
          .toList();
      return c.copyWith(sections: reordered);
    });
  }

  // ── Items ─────────────────────────────────────────────────────────────────────

  void addItem(String checklistId, {
    required String name,
    String description = '',
    String category = 'general',
    int requiredQty = 1,
    String? sectionId,
    String? notes,
  }) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      final item = ChecklistItem(
        id: _genId(),
        name: name,
        description: description,
        category: category,
        requiredQty: requiredQty,
        notes: notes ?? '',
        sectionId: sectionId,
        createdAt: _ts(),
      );
      return c.copyWith(items: [...c.items, item]);
    });
  }

  void updateItem(String checklistId, String itemId, ChecklistItem Function(ChecklistItem) updater) {
    _mutate(checklistId, (c) {
      if (!c.canEditItemFields) return c;
      return c.copyWith(items: c.items.map((i) => i.id == itemId ? updater(i) : i).toList());
    });
  }

  void deleteItem(String checklistId, String itemId) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      return c.copyWith(items: c.items.where((i) => i.id != itemId).toList());
    });
  }

  void toggleItemCheck(String checklistId, String itemId) {
    _mutate(checklistId, (c) {
      if (!c.canToggleChecks) return c;
      final statuses = c.settings.itemStatuses;
      if (statuses.isNotEmpty) {
        return c.copyWith(
          items: c.items.map((i) {
            if (i.id != itemId) return i;
            final curIdx = statuses.indexWhere((s) => s.id == (i.status ?? statuses.first.id));
            final nextStatus = statuses[(curIdx + 1) % statuses.length];
            return i.copyWith(status: nextStatus.id, checked: nextStatus.isDone);
          }).toList(),
        );
      }
      return c.copyWith(
        items: c.items.map((i) {
          if (i.id != itemId) return i;
          final nc = !i.checked;
          if (c.settings.enableQuantity && i.requiredQty > 0) {
            return i.copyWith(checked: nc, ownedQty: nc ? i.requiredQty : 0);
          }
          return i.copyWith(checked: nc);
        }).toList(),
      );
    });
  }

  void setItemStatus(String checklistId, String itemId, String statusId) {
    _mutate(checklistId, (c) {
      if (!c.canToggleChecks) return c;
      final isDoneVal = c.settings.itemStatuses
          .firstWhereOrNull((s) => s.id == statusId)
          ?.isDone ?? false;
      return c.copyWith(
        items: c.items.map((i) =>
            i.id == itemId ? i.copyWith(status: statusId, checked: isDoneVal) : i
        ).toList(),
      );
    });
  }

  void reorderItems(String checklistId, String? sectionId, List<String> orderedIds) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      final sectionItems = orderedIds
          .map((id) => c.items.firstWhereOrNull((i) => i.id == id))
          .whereType<ChecklistItem>()
          .toList();
      final otherItems = c.items.where((i) => i.sectionId != sectionId).toList();
      return c.copyWith(items: [...otherItems, ...sectionItems]);
    });
  }

  // ── Settings ──────────────────────────────────────────────────────────────────

  void updateSettings(AppSettings Function(AppSettings) updater) {
    _settings = updater(_settings);
    _notify();
  }

  // ── CSV Import ────────────────────────────────────────────────────────────────

  void importCSV(String checklistId, List<({String name, List<ChecklistItem> items})> sections) {
    _mutate(checklistId, (c) {
      if (!c.canEditStructure) return c;
      final newSections = <Section>[];
      final newItems = <ChecklistItem>[];
      for (final sec in sections) {
        final sid = _genId();
        newSections.add(Section(id: sid, name: sec.name, expanded: true, order: c.sections.length + newSections.length));
        for (final item in sec.items) {
          newItems.add(item.copyWith(id: _genId(), sectionId: sid, createdAt: _ts()));
        }
      }
      return c.copyWith(
        sections: [...c.sections, ...newSections],
        items: [...c.items, ...newItems],
      );
    });
  }

  // ── Delete all data ───────────────────────────────────────────────────────────

  Future<void> deleteAllData() async {
    _folders    = List.of(kInitialFolders);
    _checklists = List.of(kInitialChecklists);
    _settings   = const AppSettings();
    _activeChecklistId = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    notifyListeners();
  }

  // ── Server sync (HTTP) ────────────────────────────────────────────────────────

  Future<({bool ok, String? error})> testSyncServer() async {
    try {
      final http = _makeHttp();
      final resp = await http.get(
        Uri.parse('${_settings.serverUrl}/api/ping'),
        headers: {'X-API-Key': _settings.serverApiKey},
      ).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) return (ok: true, error: null);
      return (ok: false, error: 'Server returned ${resp.statusCode}');
    } catch (e) {
      return (ok: false, error: e.toString());
    }
  }

  Future<({bool ok, String? error})> pushDataToServer() async {
    try {
      final http = _makeHttp();
      final body = jsonEncode({
        'folders':    _folders.map((f) => f.toJson()).toList(),
        'checklists': _checklists.map((c) => c.toJson()).toList(),
      });
      final resp = await http.post(
        Uri.parse('${_settings.serverUrl}/api/sync/push'),
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': _settings.serverApiKey,
          if (_settings.serverUsername != null) 'X-Username': _settings.serverUsername!,
        },
        body: body,
      ).timeout(const Duration(seconds: 30));
      if (resp.statusCode == 200) {
        updateSettings((s) => s.copyWith(lastSyncTime: _ts()));
        return (ok: true, error: null);
      }
      return (ok: false, error: 'Server returned ${resp.statusCode}');
    } catch (e) {
      return (ok: false, error: e.toString());
    }
  }

  Future<({bool ok, String? error})> pullDataFromServer() async {
    try {
      final http = _makeHttp();
      final resp = await http.get(
        Uri.parse('${_settings.serverUrl}/api/sync/pull'),
        headers: {
          'X-API-Key': _settings.serverApiKey,
          if (_settings.serverUsername != null) 'X-Username': _settings.serverUsername!,
        },
      ).timeout(const Duration(seconds: 30));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        if (data['folders'] != null) {
          _folders = (data['folders'] as List)
              .map((e) => Folder.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        if (data['checklists'] != null) {
          _checklists = (data['checklists'] as List)
              .map((e) => Checklist.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        updateSettings((s) => s.copyWith(lastSyncTime: _ts()));
        _notify();
        return (ok: true, error: null);
      }
      return (ok: false, error: 'Server returned ${resp.statusCode}');
    } catch (e) {
      return (ok: false, error: e.toString());
    }
  }

  Future<({bool ok, String? error})> registerServerProfile(
      String username, String password, {String? displayName}) async {
    try {
      final http = _makeHttp();
      final resp = await http.post(
        Uri.parse('${_settings.serverUrl}/api/auth/register'),
        headers: {'Content-Type': 'application/json', 'X-API-Key': _settings.serverApiKey},
        body: jsonEncode({'username': username, 'password': password, 'displayName': displayName}),
      ).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200 || resp.statusCode == 201) {
        updateSettings((s) => s.copyWith(serverUsername: username, serverDisplayName: displayName));
        return (ok: true, error: null);
      }
      return (ok: false, error: 'Server returned ${resp.statusCode}');
    } catch (e) {
      return (ok: false, error: e.toString());
    }
  }

  Future<({bool ok, String? error})> loginServerProfile(
      String username, String password) async {
    try {
      final http = _makeHttp();
      final resp = await http.post(
        Uri.parse('${_settings.serverUrl}/api/auth/login'),
        headers: {'Content-Type': 'application/json', 'X-API-Key': _settings.serverApiKey},
        body: jsonEncode({'username': username, 'password': password}),
      ).timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body) as Map<String, dynamic>;
        updateSettings((s) => s.copyWith(
          serverUsername: username,
          serverDisplayName: data['displayName'] as String?,
        ));
        return (ok: true, error: null);
      }
      return (ok: false, error: 'Server returned ${resp.statusCode}');
    } catch (e) {
      return (ok: false, error: e.toString());
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  void _mutate(String checklistId, Checklist Function(Checklist) fn) {
    _checklists = _checklists.map((c) {
      if (c.id != checklistId) return c;
      return fn(c).copyWith(updatedAt: _ts());
    }).toList();
    _notify();
  }

  int _ts() => DateTime.now().millisecondsSinceEpoch;

  _HttpClient _makeHttp() => _HttpClient();
}

// ─── Thin HTTP client wrapper (uses dart:io / package:http) ───────────────────

class _HttpClient {
  Future<http_pkg.Response> get(Uri uri, {Map<String, String>? headers}) =>
      http_pkg.get(uri, headers: headers);

  Future<http_pkg.Response> post(Uri uri, {Map<String, String>? headers, Object? body}) =>
      http_pkg.post(uri, headers: headers, body: body);
}

// ─── ChecklistStats ───────────────────────────────────────────────────────────

class ChecklistStats {
  final int total;
  final int completed;
  final int percentage;
  final Map<String, ({int total, int completed})> categoryBreakdown;
  final List<ChecklistItem> partialItems;

  const ChecklistStats({
    required this.total,
    required this.completed,
    required this.percentage,
    required this.categoryBreakdown,
    required this.partialItems,
  });

  factory ChecklistStats.empty() => const ChecklistStats(
        total: 0,
        completed: 0,
        percentage: 0,
        categoryBreakdown: {},
        partialItems: [],
      );
}

// ─── Extension helpers ─────────────────────────────────────────────────────────

extension ListWhereOrNull<T> on Iterable<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    for (final e in this) {
      if (test(e)) return e;
    }
    return null;
  }
}
