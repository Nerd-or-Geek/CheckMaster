import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/stats_view.dart';
import 'folders_screen.dart';
import 'checklist_screen.dart';
import 'settings_screen.dart';

/// Breakpoint at which the three-panel desktop layout activates.
const double kDesktopBreakpoint = 900;

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _tabIndex = 0;

  // Desktop panel mode
  String _desktopPanel = 'checklist'; // 'checklist' | 'stats' | 'settings'

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width >= kDesktopBreakpoint;

    if (isDesktop) {
      return _buildDesktop(context);
    } else {
      return _buildMobile(context);
    }
  }

  // ─────────────────────────────────────────── DESKTOP ──────────────────────

  Widget _buildDesktop(BuildContext context) {
    final tc    = ThemeColors.of(context);
    final state = context.watch<AppState>();
    final cl    = state.activeChecklist;

    return Scaffold(
      backgroundColor: tc.background,
      body: Row(
        children: [
          // Left panel: folders/nav (fixed 300px)
          SizedBox(
            width: 300,
            child: Column(
              children: [
                Container(
                  height: 56,
                  color: tc.card,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Text('CheckMaster',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: tc.text)),
                      const Spacer(),
                      IconButton(
                        icon: Icon(Icons.settings, color: tc.subtext, size: 20),
                        onPressed: () => setState(() => _desktopPanel = 'settings'),
                      ),
                    ],
                  ),
                ),
                Divider(height: 1, color: tc.border),
                const Expanded(child: _DesktopFoldersPanel()),
              ],
            ),
          ),
          VerticalDivider(width: 1, color: tc.border),

          // Center panel: checklist / settings
          Expanded(
            flex: 3,
            child: _desktopPanel == 'settings'
                ? Stack(children: [
                    const SettingsScreen(),
                    Positioned(
                      top: 8, right: 8,
                      child: IconButton(
                        icon: Icon(Icons.close, color: tc.subtext),
                        onPressed: () => setState(() => _desktopPanel = 'checklist'),
                      ),
                    ),
                  ])
                : Column(
                    children: [
                      // Header row
                      Container(
                        height: 56,
                        color: tc.card,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          children: [
                            Expanded(
                              child: cl != null
                                  ? Text(cl.name,
                                      style: TextStyle(fontWeight: FontWeight.bold, color: tc.text, fontSize: 15),
                                      overflow: TextOverflow.ellipsis)
                                  : Text('No checklist selected', style: TextStyle(color: tc.subtext)),
                            ),
                            if (cl != null) ...[
                              IconButton(
                                icon: Icon(cl.isFavorite ? Icons.star : Icons.star_border,
                                    color: cl.isFavorite ? AppColors.warning : tc.subtext, size: 20),
                                onPressed: () => state.toggleChecklistFavorite(cl.id),
                              ),
                              IconButton(
                                icon: Icon(
                                  _desktopPanel == 'checklist' ? Icons.bar_chart : Icons.list,
                                  color: tc.subtext, size: 20,
                                ),
                                tooltip: _desktopPanel == 'checklist' ? 'Stats' : 'Interactive',
                                onPressed: () => setState(() =>
                                    _desktopPanel = _desktopPanel == 'checklist' ? 'stats_panel' : 'checklist'),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Divider(height: 1, color: tc.border),
                      Expanded(
                        child: cl == null
                            ? Center(child: Text('Select a checklist from the left panel',
                                style: TextStyle(color: tc.subtext)))
                            : (_desktopPanel == 'stats_panel'
                                ? StatsView(checklistId: cl.id)
                                : const ChecklistScreen()),
                      ),
                    ],
                  ),
          ),

          // Right panel: stats (280px, only when checklist shown)
          if (_desktopPanel == 'checklist' && cl != null) ...[
            VerticalDivider(width: 1, color: tc.border),
            SizedBox(
              width: 280,
              child: Column(
                children: [
                  Container(
                    height: 56,
                    color: tc.card,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(children: [
                      Text('Stats', style: TextStyle(fontWeight: FontWeight.w600, color: tc.text)),
                    ]),
                  ),
                  Divider(height: 1, color: tc.border),
                  Expanded(child: StatsView(checklistId: cl.id)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─────────────────────────────────────────── MOBILE ───────────────────────

  Widget _buildMobile(BuildContext context) {
    final tc = ThemeColors.of(context);
    final screens = [
      const FoldersScreen(),
      const ChecklistScreen(),
      const SettingsScreen(),
    ];
    return Scaffold(
      body: screens[_tabIndex],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        backgroundColor: tc.card,
        indicatorColor: AppColors.primary.withOpacity(0.15),
        onDestinationSelected: (i) => setState(() => _tabIndex = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.folder_outlined), selectedIcon: Icon(Icons.folder), label: 'Folders'),
          NavigationDestination(icon: Icon(Icons.checklist_rtl_outlined), selectedIcon: Icon(Icons.checklist_rtl), label: 'Checklist'),
          NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ─── Desktop-only folders panel (no AppBar, embedded in left panel) ───────────

class _DesktopFoldersPanel extends StatefulWidget {
  const _DesktopFoldersPanel();

  @override
  State<_DesktopFoldersPanel> createState() => _DesktopFoldersPanelState();
}

class _DesktopFoldersPanelState extends State<_DesktopFoldersPanel> {
  final List<String?> _navStack = [null];
  String? get _currentFolderId => _navStack.last;

  bool _showCreateFolder  = false;
  bool _showCreateChecklist = false;
  final _folderNameCtrl = TextEditingController();
  String _folderColor   = kFolderColors[0];
  final _clNameCtrl     = TextEditingController();
  final _clDescCtrl     = TextEditingController();
  ChecklistType _clType = ChecklistType.basic;

  @override
  void dispose() {
    _folderNameCtrl.dispose();
    _clNameCtrl.dispose();
    _clDescCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state   = context.watch<AppState>();
    final tc      = ThemeColors.of(context);
    final folders = state.getFolderChildren(_currentFolderId);
    final clists  = _currentFolderId != null ? state.getFolderChecklists(_currentFolderId!) : <Checklist>[];
    final isSystem = _currentFolderId == kFavoritesId || _currentFolderId == kSharedId;

    return Column(
      children: [
        // Navigation breadcrumb
        if (_navStack.length > 1)
          Container(
            color: tc.input,
            child: ListTile(
              dense: true,
              leading: const Icon(Icons.arrow_back, size: 18),
              title: Text(
                _currentFolderId != null
                    ? (state.folders.firstWhereOrNull((f) => f.id == _currentFolderId)?.name ?? '')
                    : 'Root',
                style: TextStyle(fontSize: 13, color: tc.text),
              ),
              onTap: () => setState(() => _navStack.removeLast()),
            ),
          ),
        // Action row
        if (!isSystem)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                Expanded(child: TextButton.icon(
                  icon: const Icon(Icons.create_new_folder_outlined, size: 16),
                  label: const Text('Folder', style: TextStyle(fontSize: 12)),
                  onPressed: () => setState(() => _showCreateFolder = true),
                )),
                if (_currentFolderId != null)
                  Expanded(child: TextButton.icon(
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Checklist', style: TextStyle(fontSize: 12)),
                    onPressed: () => setState(() => _showCreateChecklist = true),
                  )),
              ],
            ),
          ),

        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            children: [
              ...folders.map((f) => _DesktopFolderRow(
                folder: f,
                onTap: () => setState(() => _navStack.add(f.id)),
                tc: tc,
              )),
              const SizedBox(height: 4),
              ...clists.map((cl) => _DesktopChecklistRow(
                checklist: cl,
                isActive: state.activeChecklistId == cl.id,
                onTap: () => state.setActiveChecklistId(cl.id),
                onFavorite: () => state.toggleChecklistFavorite(cl.id),
                tc: tc,
              )),            ],
          ),
        ),

        // Inline forms
        if (_showCreateFolder)
          _InlineForm(
            title: 'New Folder',
            tc: tc,
            fields: [
              TextField(controller: _folderNameCtrl, autofocus: true,
                  style: TextStyle(color: tc.text, fontSize: 13),
                  decoration: const InputDecoration(hintText: 'Folder name', isDense: true)),
              const SizedBox(height: 8),
              Wrap(spacing: 6, children: kFolderColors.map((c) => GestureDetector(
                onTap: () => setState(() => _folderColor = c),
                child: Container(width: 22, height: 22,
                    decoration: BoxDecoration(color: hexColor(c), shape: BoxShape.circle,
                        border: Border.all(color: _folderColor == c ? Colors.white : Colors.transparent, width: 2))),
              )).toList()),
            ],
            onSave: () {
              final name = _folderNameCtrl.text.trim();
              if (name.isEmpty) return;
              context.read<AppState>().addFolder(name, _currentFolderId, _folderColor);
              _folderNameCtrl.clear();
              setState(() => _showCreateFolder = false);
            },
            onCancel: () { _folderNameCtrl.clear(); setState(() => _showCreateFolder = false); },
          ),

        if (_showCreateChecklist && _currentFolderId != null)
          _InlineForm(
            title: 'New Checklist',
            tc: tc,
            fields: [
              TextField(controller: _clNameCtrl, autofocus: true,
                  style: TextStyle(color: tc.text, fontSize: 13),
                  decoration: const InputDecoration(hintText: 'Name', isDense: true)),
              const SizedBox(height: 6),
              TextField(controller: _clDescCtrl,
                  style: TextStyle(color: tc.text, fontSize: 13),
                  decoration: const InputDecoration(hintText: 'Description', isDense: true)),
            ],
            onSave: () {
              final name = _clNameCtrl.text.trim();
              if (name.isEmpty) return;
              context.read<AppState>().addChecklist(
                name: name, description: _clDescCtrl.text.trim(),
                folderId: _currentFolderId!, type: _clType,
              );
              _clNameCtrl.clear(); _clDescCtrl.clear();
              setState(() => _showCreateChecklist = false);
            },
            onCancel: () { _clNameCtrl.clear(); _clDescCtrl.clear(); setState(() => _showCreateChecklist = false); },
          ),
      ],
    );
  }
}

class _DesktopFolderRow extends StatelessWidget {
  final Folder folder;
  final VoidCallback onTap;
  final ThemeColors tc;
  const _DesktopFolderRow({required this.folder, required this.onTap, required this.tc});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 8),
      leading: Container(width: 10, height: 10,
          decoration: BoxDecoration(color: hexColor(folder.color), shape: BoxShape.circle)),
      title: Text(folder.name, style: TextStyle(fontSize: 13, color: tc.text)),
      trailing: Icon(Icons.chevron_right, size: 16, color: tc.muted),
      onTap: onTap,
    );
  }
}

class _DesktopChecklistRow extends StatelessWidget {
  final Checklist checklist;
  final bool isActive;
  final VoidCallback onTap;
  final VoidCallback onFavorite;
  final ThemeColors tc;

  const _DesktopChecklistRow({
    required this.checklist,
    required this.isActive,
    required this.onTap,
    required this.onFavorite,
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

    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: isActive ? AppColors.primary.withOpacity(0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isActive ? AppColors.primary.withOpacity(0.3) : Colors.transparent),
      ),
      child: ListTile(
        dense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        leading: Icon(Icons.checklist_rtl_outlined, size: 16, color: isActive ? AppColors.primary : tc.subtext),
        title: Text(cl.name, style: TextStyle(fontSize: 13, color: tc.text, fontWeight: isActive ? FontWeight.w600 : FontWeight.normal)),
        subtitle: Text('$done/$total · $pct%', style: TextStyle(fontSize: 11, color: tc.muted)),
        trailing: IconButton(
          icon: Icon(cl.isFavorite ? Icons.star : Icons.star_border,
              size: 15, color: cl.isFavorite ? AppColors.warning : tc.muted),
          onPressed: onFavorite,
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
        ),
        onTap: onTap,
      ),
    );
  }
}

class _InlineForm extends StatelessWidget {
  final String title;
  final ThemeColors tc;
  final List<Widget> fields;
  final VoidCallback onSave;
  final VoidCallback onCancel;

  const _InlineForm({
    required this.title,
    required this.tc,
    required this.fields,
    required this.onSave,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) => Container(
    color: tc.input,
    padding: const EdgeInsets.all(12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(title, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tc.text)),
        const SizedBox(height: 8),
        ...fields,
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: ElevatedButton(onPressed: onSave,
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 6)),
              child: const Text('Save', style: TextStyle(fontSize: 12)))),
          const SizedBox(width: 8),
          Expanded(child: OutlinedButton(onPressed: onCancel,
              style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 6)),
              child: const Text('Cancel', style: TextStyle(fontSize: 12)))),
        ]),
      ],
    ),
  );
}
