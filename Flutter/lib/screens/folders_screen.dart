import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';

class FoldersScreen extends StatefulWidget {
  const FoldersScreen({super.key});

  @override
  State<FoldersScreen> createState() => _FoldersScreenState();
}

class _FoldersScreenState extends State<FoldersScreen> {
  final List<String?> _navStack = [null]; // null = root

  String? get _currentFolderId => _navStack.last;

  void _navigateInto(String folderId) => setState(() => _navStack.add(folderId));
  void _navigateBack() { if (_navStack.length > 1) setState(() => _navStack.removeLast()); }

  // Folder modal state
  bool _showCreateFolder = false;
  final _newFolderNameCtrl = TextEditingController();
  String _newFolderColor = kFolderColors[0];

  // Folder edit modal
  String? _editingFolderId;
  final _editFolderNameCtrl = TextEditingController();
  String _editFolderColor = kFolderColors[0];

  // Checklist modal state
  bool _showCreateChecklist = false;
  final _newClNameCtrl = TextEditingController();
  final _newClDescCtrl = TextEditingController();
  ChecklistType _newClType = ChecklistType.basic;

  // Import share
  bool _showImportShare = false;
  final _importPasteCtrl = TextEditingController();
  String? _importError;

  bool _isReorderMode = false;

  @override
  void dispose() {
    _newFolderNameCtrl.dispose();
    _editFolderNameCtrl.dispose();
    _newClNameCtrl.dispose();
    _newClDescCtrl.dispose();
    _importPasteCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state        = context.watch<AppState>();
    final tc           = ThemeColors.of(context);
    final childFolders = state.getFolderChildren(_currentFolderId);
    final clists       = _currentFolderId != null
        ? state.getFolderChecklists(_currentFolderId!)
        : <Checklist>[];
    final currentFolder = state.folders.firstWhereOrNull((f) => f.id == _currentFolderId);
    final isSystemFolder = _currentFolderId == kFavoritesId || _currentFolderId == kSharedId;

    return Scaffold(
      backgroundColor: tc.background,
      appBar: AppBar(
        backgroundColor: tc.card,
        leading: _navStack.length > 1
            ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: _navigateBack)
            : null,
        title: Row(children: [
          if (currentFolder != null) ...[
            Container(width: 10, height: 10, margin: const EdgeInsets.only(right: 8),
                decoration: BoxDecoration(color: hexColor(currentFolder.color), shape: BoxShape.circle)),
          ],
          Expanded(child: Text(
            currentFolder?.name ?? 'CheckMaster',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: tc.text),
            overflow: TextOverflow.ellipsis,
          )),
        ]),
        actions: [
          if (_currentFolderId != null && !isSystemFolder)
            IconButton(
              icon: Icon(_isReorderMode ? Icons.check : Icons.edit, color: tc.subtext),
              tooltip: _isReorderMode ? 'Done' : 'Reorder',
              onPressed: () => setState(() => _isReorderMode = !_isReorderMode),
            ),
          if (_currentFolderId != null && !isSystemFolder)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'New Checklist',
              onPressed: () => setState(() { _showCreateChecklist = true; }),
            ),
          if (_currentFolderId == null)
            IconButton(
              icon: const Icon(Icons.create_new_folder_outlined),
              tooltip: 'New Folder',
              onPressed: () => setState(() { _showCreateFolder = true; }),
            ),
        ],
      ),
      body: Stack(
        children: [
          Column(
            children: [
              Expanded(
                child: _currentFolderId == null
                    ? _buildFolderTree(context, state, childFolders, tc)
                    : _buildFolderContents(context, state, childFolders, clists, tc, isSystemFolder),
              ),
            ],
          ),

          // Create Folder overlay
          if (_showCreateFolder)
            _buildModalOverlay(context, tc, 'New Folder', [
              TextField(controller: _newFolderNameCtrl, autofocus: true, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(hintText: 'Folder name')),
              const SizedBox(height: 12),
              _colorPicker(kFolderColors, _newFolderColor, (c) => setState(() => _newFolderColor = c)),
            ], onConfirm: () {
              final name = _newFolderNameCtrl.text.trim();
              if (name.isEmpty) return;
              state.addFolder(name, _currentFolderId, _newFolderColor);
              _newFolderNameCtrl.clear();
              setState(() { _showCreateFolder = false; _newFolderColor = kFolderColors[0]; });
            }, onCancel: () {
              _newFolderNameCtrl.clear();
              setState(() => _showCreateFolder = false);
            }),

          // Edit Folder overlay
          if (_editingFolderId != null)
            _buildModalOverlay(context, tc, 'Edit Folder', [
              TextField(controller: _editFolderNameCtrl, autofocus: true, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(hintText: 'Folder name')),
              const SizedBox(height: 12),
              _colorPicker(kFolderColors, _editFolderColor, (c) => setState(() => _editFolderColor = c)),
            ], onConfirm: () {
              final id = _editingFolderId!;
              final name = _editFolderNameCtrl.text.trim();
              if (name.isEmpty) return;
              state.updateFolder(id, name: name, color: _editFolderColor);
              setState(() => _editingFolderId = null);
            }, onCancel: () => setState(() => _editingFolderId = null)),

          // Create Checklist overlay
          if (_showCreateChecklist)
            _buildModalOverlay(context, tc, 'New Checklist', [
              TextField(controller: _newClNameCtrl, autofocus: true, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(hintText: 'Checklist name')),
              const SizedBox(height: 8),
              TextField(controller: _newClDescCtrl, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(hintText: 'Description (optional)')),
              const SizedBox(height: 12),
              Text('Type', style: TextStyle(fontSize: 12, color: tc.subtext)),
              const SizedBox(height: 6),
              Wrap(spacing: 8, children: ChecklistType.values.map((t) =>
                ChoiceChip(
                  label: Text(t.name[0].toUpperCase() + t.name.substring(1)),
                  selected: _newClType == t,
                  onSelected: (_) => setState(() => _newClType = t),
                ),
              ).toList()),
            ], onConfirm: () {
              final name = _newClNameCtrl.text.trim();
              if (name.isEmpty || _currentFolderId == null) return;
              state.addChecklist(
                name: name,
                description: _newClDescCtrl.text.trim(),
                folderId: _currentFolderId!,
                type: _newClType,
              );
              _newClNameCtrl.clear();
              _newClDescCtrl.clear();
              setState(() { _showCreateChecklist = false; _newClType = ChecklistType.basic; });
            }, onCancel: () {
              _newClNameCtrl.clear();
              _newClDescCtrl.clear();
              setState(() => _showCreateChecklist = false);
            }),

          // Import Share overlay
          if (_showImportShare)
            _buildModalOverlay(context, tc, 'Import Shared Checklist', [
              Text('Paste the shared checklist text:', style: TextStyle(fontSize: 13, color: tc.text)),
              const SizedBox(height: 8),
              TextField(
                controller: _importPasteCtrl,
                maxLines: 6,
                style: TextStyle(color: tc.text, fontSize: 12),
                decoration: const InputDecoration(hintText: 'Paste shared checklist data here…'),
              ),
              if (_importError != null)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(_importError!, style: const TextStyle(color: AppColors.danger, fontSize: 12)),
                ),
            ], onConfirm: () {
              if (_currentFolderId == null) return;
              // Basic import: parse as JSON array of items
              final text = _importPasteCtrl.text.trim();
              // Try to parse CSV: Name,Category,Description
              try {
                final lines = text.split('\n').where((l) => l.trim().isNotEmpty).toList();
                if (lines.isEmpty) { setState(() => _importError = 'No content found'); return; }
                final items = lines.map((line) {
                  final parts = line.split(',');
                  return ChecklistItem(
                    id: '', name: parts[0].trim(),
                    category: parts.length > 1 ? parts[1].trim() : 'general',
                    description: parts.length > 2 ? parts.sublist(2).join(',').trim() : '',
                    createdAt: DateTime.now().millisecondsSinceEpoch,
                  );
                }).toList();
                final section = (name: 'Imported', items: items);
                state.importCSV(_currentFolderId!, [section]);
                _importPasteCtrl.clear();
                setState(() { _showImportShare = false; _importError = null; });
              } catch (e) {
                setState(() => _importError = 'Parse error: $e');
              }
            }, onCancel: () {
              _importPasteCtrl.clear();
              setState(() { _showImportShare = false; _importError = null; });
            }),
        ],
      ),
    );
  }

  // ── Root folder tree (all top-level folders) ──────────────────────────────

  Widget _buildFolderTree(BuildContext context, AppState state, List<Folder> folders, ThemeColors tc) {
    if (folders.isEmpty) {
      return Center(child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.folder_open, size: 64, color: tc.muted),
          const SizedBox(height: 12),
          Text('No folders yet', style: TextStyle(color: tc.subtext)),
          const SizedBox(height: 8),
          ElevatedButton.icon(
            icon: const Icon(Icons.add),
            label: const Text('Create Folder'),
            onPressed: () => setState(() => _showCreateFolder = true),
          ),
        ],
      ));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: folders.length,
      separatorBuilder: (_, __) => const SizedBox(height: 6),
      itemBuilder: (_, i) => _FolderTile(
        folder: folders[i],
        onTap: () => _navigateInto(folders[i].id),
        onEdit: folders[i].isSystemFolder ? null : () => _startEditFolder(folders[i]),
        onDelete: folders[i].isSystemFolder ? null : () => _confirmDeleteFolder(context, state, folders[i]),
        tc: tc,
      ),
    );
  }

  // ── Folder contents (sub-folders + checklists) ───────────────────────────

  Widget _buildFolderContents(
    BuildContext context,
    AppState state,
    List<Folder> childFolders,
    List<Checklist> checklists,
    ThemeColors tc,
    bool isSystemFolder,
  ) {
    if (childFolders.isEmpty && checklists.isEmpty) {
      return Center(child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.checklist_rtl, size: 64, color: tc.muted),
          const SizedBox(height: 12),
          Text('This folder is empty', style: TextStyle(color: tc.subtext)),
          if (!isSystemFolder) ...[
            const SizedBox(height: 8),
            ElevatedButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('New Checklist'),
              onPressed: () => setState(() => _showCreateChecklist = true),
            ),
          ],
        ],
      ));
    }

    return _isReorderMode
        ? _buildReorderableList(context, state, childFolders, checklists, tc, isSystemFolder)
        : ListView(
            padding: const EdgeInsets.all(12),
            children: [
              if (childFolders.isNotEmpty) ...[
                Text('Folders', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: tc.muted,
                    letterSpacing: 0.8)),
                const SizedBox(height: 6),
                ...childFolders.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _FolderTile(
                    folder: f,
                    onTap: () => _navigateInto(f.id),
                    onEdit: f.isSystemFolder ? null : () => _startEditFolder(f),
                    onDelete: f.isSystemFolder ? null : () => _confirmDeleteFolder(context, state, f),
                    tc: tc,
                  ),
                )),
                const SizedBox(height: 12),
              ],
              if (checklists.isNotEmpty) ...[
                Text('Checklists', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: tc.muted,
                    letterSpacing: 0.8)),
                const SizedBox(height: 6),
                ...checklists.map((cl) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: _ChecklistTile(
                    checklist: cl,
                    isActive: state.activeChecklistId == cl.id,
                    onTap: () {
                      state.setActiveChecklistId(cl.id);
                    },
                    onFavorite: () => state.toggleChecklistFavorite(cl.id),
                    onDelete: isSystemFolder ? null : () => _confirmDeleteChecklist(context, state, cl),
                    tc: tc,
                  ),
                )),
              ],
              if (!isSystemFolder) ...[
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.create_new_folder_outlined, size: 16),
                  label: const Text('New Sub-Folder'),
                  onPressed: () => setState(() => _showCreateFolder = true),
                ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.upload, size: 16),
                  label: const Text('Import CSV'),
                  onPressed: () => setState(() => _showImportShare = true),
                ),
              ],
            ],
          );
  }

  Widget _buildReorderableList(
    BuildContext context,
    AppState state,
    List<Folder> childFolders,
    List<Checklist> checklists,
    ThemeColors tc,
    bool isSystemFolder,
  ) {
    return ReorderableListView(
      padding: const EdgeInsets.all(12),
      onReorder: (oldIdx, newIdx) {
        // All items: folders first, then checklists
        final allIds = [
          ...childFolders.map((f) => f.id),
          ...checklists.map((c) => c.id),
        ];
        if (oldIdx < newIdx) newIdx--;
        final id = allIds.removeAt(oldIdx);
        allIds.insert(newIdx, id);
        // Determine if it's folder or checklist and reorder accordingly
        final folderIds    = allIds.where((id) => childFolders.any((f) => f.id == id)).toList();
        final checklistIds = allIds.where((id) => checklists.any((c) => c.id == id)).toList();
        state.reorderFolders(_currentFolderId, folderIds);
        if (_currentFolderId != null) state.reorderChecklists(_currentFolderId!, checklistIds);
      },
      children: [
        ...childFolders.map((f) => ListTile(
          key: Key('folder_${f.id}'),
          leading: Container(width: 14, height: 14,
              decoration: BoxDecoration(color: hexColor(f.color), shape: BoxShape.circle)),
          title: Text(f.name, style: TextStyle(color: tc.text)),
          trailing: const Icon(Icons.drag_handle),
        )),
        ...checklists.map((cl) => ListTile(
          key: Key('cl_${cl.id}'),
          leading: Icon(Icons.checklist_rtl, color: tc.subtext, size: 20),
          title: Text(cl.name, style: TextStyle(color: tc.text)),
          trailing: const Icon(Icons.drag_handle),
        )),
      ],
    );
  }

  void _startEditFolder(Folder folder) {
    _editFolderNameCtrl.text = folder.name;
    setState(() { _editingFolderId = folder.id; _editFolderColor = folder.color; });
  }

  void _confirmDeleteFolder(BuildContext context, AppState state, Folder folder) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Folder?'),
        content: Text('Delete "${folder.name}" and everything inside?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              Navigator.pop(context);
              state.deleteFolder(folder.id);
              // Pop nav stack if we deleted current or ancestor
              setState(() {
                while (_navStack.length > 1) { _navStack.removeLast(); }
              });
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteChecklist(BuildContext context, AppState state, Checklist cl) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Checklist?'),
        content: Text('Remove "${cl.name}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () { Navigator.pop(context); state.deleteChecklist(cl.id); },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }

  Widget _buildModalOverlay(
    BuildContext context,
    ThemeColors tc,
    String title,
    List<Widget> body, {
    required VoidCallback onConfirm,
    required VoidCallback onCancel,
  }) {
    return GestureDetector(
      onTap: onCancel,
      child: Container(
        color: Colors.black54,
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              margin: const EdgeInsets.all(20),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: tc.card,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Expanded(child: Text(title,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: tc.text))),
                    IconButton(icon: const Icon(Icons.close), onPressed: onCancel),
                  ]),
                  const SizedBox(height: 12),
                  ...body,
                  const SizedBox(height: 16),
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    TextButton(onPressed: onCancel, child: const Text('Cancel')),
                    const SizedBox(width: 8),
                    ElevatedButton(onPressed: onConfirm, child: const Text('Save')),
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _colorPicker(List<String> colors, String selected, ValueChanged<String> onSelect) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: colors.map((c) => GestureDetector(
        onTap: () => onSelect(c),
        child: Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: hexColor(c),
            shape: BoxShape.circle,
            border: Border.all(
              color: selected == c ? Colors.white : Colors.transparent,
              width: 3,
            ),
            boxShadow: selected == c
                ? [BoxShadow(color: hexColor(c).withOpacity(0.5), blurRadius: 4)]
                : null,
          ),
        ),
      )).toList(),
    );
  }
}

// ─── Folder tile ──────────────────────────────────────────────────────────────

class _FolderTile extends StatelessWidget {
  final Folder folder;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final ThemeColors tc;

  const _FolderTile({
    required this.folder,
    required this.onTap,
    this.onEdit,
    this.onDelete,
    required this.tc,
  });

  @override
  Widget build(BuildContext context) {
    final isSystem = folder.isSystemFolder;
    return Material(
      color: tc.card,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            border: Border.all(color: tc.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Container(
                width: 14,
                height: 14,
                decoration: BoxDecoration(color: hexColor(folder.color), shape: BoxShape.circle),
              ),
              const SizedBox(width: 10),
              Icon(
                isSystem
                    ? (folder.isSystem == SystemFolderType.favorites ? Icons.star : Icons.people)
                    : Icons.folder,
                size: 18,
                color: hexColor(folder.color),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(folder.name,
                    style: TextStyle(fontWeight: FontWeight.w500, color: tc.text, fontSize: 14)),
              ),
              if (!isSystem && onEdit != null)
                IconButton(
                  icon: Icon(Icons.edit_outlined, size: 16, color: tc.muted),
                  onPressed: onEdit,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                ),
              if (!isSystem && onDelete != null)
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 16, color: tc.muted),
                  onPressed: onDelete,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                ),
              Icon(Icons.chevron_right, color: tc.muted, size: 18),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Checklist tile ───────────────────────────────────────────────────────────

class _ChecklistTile extends StatelessWidget {
  final Checklist checklist;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onFavorite;
  final VoidCallback? onDelete;
  final ThemeColors tc;

  const _ChecklistTile({
    required this.checklist,
    required this.isActive,
    required this.onTap,
    required this.onFavorite,
    this.onDelete,
    required this.tc,
  });

  @override
  Widget build(BuildContext context) {
    final cl = checklist;
    final statuses = cl.settings.itemStatuses;
    final useStatuses = statuses.isNotEmpty;
    final total = cl.items.length;
    final done  = cl.items.where((i) {
      if (useStatuses && i.status != null) {
        return statuses.firstWhereOrNull((s) => s.id == i.status)?.isDone ?? false;
      }
      return i.checked;
    }).length;
    final pct = total > 0 ? ((done / total) * 100).round() : 0;

    return Material(
      color: isActive ? AppColors.primary.withOpacity(0.08) : tc.card,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            border: Border.all(color: isActive ? AppColors.primary.withOpacity(0.4) : tc.border),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Icon(Icons.checklist_rtl, size: 18, color: isActive ? AppColors.primary : tc.subtext),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(cl.name,
                        style: TextStyle(fontWeight: FontWeight.w500, color: tc.text, fontSize: 14)),
                    if (cl.description.isNotEmpty)
                      Text(cl.description,
                          style: TextStyle(fontSize: 11, color: tc.subtext),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 4),
                    Row(children: [
                      Text('$done/$total · $pct%',
                          style: TextStyle(fontSize: 11, color: tc.muted)),
                      const SizedBox(width: 8),
                      Expanded(child: ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value: total > 0 ? done / total : 0,
                          minHeight: 4,
                          backgroundColor: tc.border,
                          color: AppColors.success,
                        ),
                      )),
                    ]),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: Icon(
                  cl.isFavorite ? Icons.star : Icons.star_border,
                  size: 18,
                  color: cl.isFavorite ? AppColors.warning : tc.muted,
                ),
                onPressed: onFavorite,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              ),
              if (onDelete != null)
                IconButton(
                  icon: Icon(Icons.delete_outline, size: 16, color: tc.muted),
                  onPressed: onDelete,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
