import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import '../widgets/stats_view.dart';
import '../widgets/charts.dart';
import 'dialogs/item_edit_dialog.dart';

class ChecklistScreen extends StatefulWidget {
  const ChecklistScreen({super.key});

  @override
  State<ChecklistScreen> createState() => _ChecklistScreenState();
}

class _ChecklistScreenState extends State<ChecklistScreen> {
  String _viewMode = 'interactive'; // 'interactive' | 'stats'
  final Set<String> _expandedNotes = {};
  String? _statusPickerItemId;
  bool _showAddSection = false;
  final _sectionNameCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = context.read<AppState>();
      _viewMode = state.settings.defaultView == DefaultView.stats ? 'stats' : 'interactive';
    });
  }

  @override
  void dispose() {
    _sectionNameCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cl    = state.activeChecklist;
    final tc    = ThemeColors.of(context);

    if (cl == null) {
      return Scaffold(
        backgroundColor: tc.background,
        body: Center(child: Text('Select a checklist', style: TextStyle(color: tc.subtext))),
      );
    }

    final statuses   = cl.settings.itemStatuses;
    final useStatuses = statuses.isNotEmpty;
    final completed  = cl.items.where((i) {
      if (useStatuses && i.status != null) {
        return statuses.firstWhereOrNull((s) => s.id == i.status)?.isDone ?? false;
      }
      return i.checked;
    }).length;
    final total = cl.items.length;
    final pct   = total > 0 ? ((completed / total) * 100).round() : 0;
    final isFavorite   = cl.isFavorite;
    final canEdit      = cl.canEditStructure;
    final canCheck     = cl.canToggleChecks;

    final List<SegmentData> segData;
    if (useStatuses) {
      segData = statuses.map((st) => SegmentData(
        label: st.label,
        value: cl.items.where((i) => (i.status ?? statuses.first.id) == st.id).length,
        colorHex: st.color,
      )).toList();
    } else {
      segData = [
        SegmentData(label: 'Done', value: completed, colorHex: '#10B981'),
        SegmentData(label: 'Left', value: total - completed, colorHex: '#E5E7EB'),
      ];
    }

    return Scaffold(
      backgroundColor: tc.background,
      appBar: AppBar(
        backgroundColor: tc.card,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(cl.name, style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: tc.text), overflow: TextOverflow.ellipsis),
            Text('$completed/$total · $pct%', style: TextStyle(fontSize: 11, color: tc.subtext)),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(isFavorite ? Icons.star : Icons.star_border,
                color: isFavorite ? AppColors.warning : tc.subtext),
            tooltip: 'Favorite',
            onPressed: () => state.toggleChecklistFavorite(cl.id),
          ),
          IconButton(
            icon: Icon(
              _viewMode == 'interactive' ? Icons.bar_chart : Icons.list,
              color: tc.subtext,
            ),
            tooltip: _viewMode == 'interactive' ? 'View Stats' : 'View Interactive',
            onPressed: () => setState(() =>
                _viewMode = _viewMode == 'interactive' ? 'stats' : 'interactive'),
          ),
          if (canEdit)
            IconButton(
              icon: const Icon(Icons.add),
              tooltip: 'Add Item',
              onPressed: () => _showItemDialog(context, state, cl),
            ),
        ],
      ),
      body: _viewMode == 'stats'
          ? StatsView(checklistId: cl.id)
          : _buildInteractive(context, state, cl, tc, segData, useStatuses, statuses, canEdit, canCheck),
    );
  }

  Widget _buildInteractive(
    BuildContext context,
    AppState state,
    Checklist cl,
    ThemeColors tc,
    List<SegmentData> segData,
    bool useStatuses,
    List<ItemStatus> statuses,
    bool canEdit,
    bool canCheck,
  ) {
    final sortedSections = [...cl.sections]..sort((a, b) => a.order.compareTo(b.order));
    final noSectionItems  = cl.items.where((i) => i.sectionId == null).toList();

    return Column(
      children: [
        // Segmented bar
        Container(
          color: tc.card,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: Column(
            children: [
              SegmentedBar(segments: segData, height: 8),
              if (useStatuses)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: statuses.map((st) {
                      final cnt = cl.items.where((i) => (i.status ?? statuses.first.id) == st.id).length;
                      return _StatusChip(status: st, count: cnt, tc: tc);
                    }).toList(),
                  ),
                ),
            ],
          ),
        ),
        Divider(height: 1, color: tc.border),

        // Items list
        Expanded(
          child: ListView(
            padding: const EdgeInsets.only(bottom: 80),
            children: [
              // Unsectioned items
              if (noSectionItems.isNotEmpty) ...[
                _buildItemList(context, state, cl, noSectionItems, tc, useStatuses, statuses, canEdit, canCheck, null),
              ],
              // Sections
              ...sortedSections.map((sec) {
                final secItems = cl.items.where((i) => i.sectionId == sec.id).toList();
                return _buildSection(context, state, cl, sec, secItems, tc, useStatuses, statuses, canEdit, canCheck);
              }),
              // Add section button
              if (canEdit)
                _showAddSection
                    ? _buildAddSectionForm(context, state, cl, tc)
                    : Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add Section'),
                          onPressed: () => setState(() => _showAddSection = true),
                        ),
                      ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildAddSectionForm(BuildContext context, AppState state, Checklist cl, ThemeColors tc) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Expanded(child: TextField(
            controller: _sectionNameCtrl,
            autofocus: true,
            style: TextStyle(color: tc.text, fontSize: 14),
            decoration: const InputDecoration(hintText: 'Section name'),
          )),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: () {
              final name = _sectionNameCtrl.text.trim();
              if (name.isNotEmpty) {
                state.addSection(cl.id, name);
                _sectionNameCtrl.clear();
              }
              setState(() => _showAddSection = false);
            },
            child: const Text('Add'),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () { _sectionNameCtrl.clear(); setState(() => _showAddSection = false); },
            child: const Text('Cancel'),
          ),
        ],
      ),
    );
  }

  Widget _buildSection(
    BuildContext context,
    AppState state,
    Checklist cl,
    Section sec,
    List<ChecklistItem> secItems,
    ThemeColors tc,
    bool useStatuses,
    List<ItemStatus> statuses,
    bool canEdit,
    bool canCheck,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        InkWell(
          onTap: () => state.toggleSectionExpand(cl.id, sec.id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            color: tc.background,
            child: Row(
              children: [
                Icon(sec.expanded ? Icons.expand_less : Icons.expand_more,
                    size: 18, color: tc.subtext),
                const SizedBox(width: 6),
                Expanded(child: Text(sec.name,
                    style: TextStyle(fontWeight: FontWeight.w600, color: tc.text, fontSize: 13))),
                Text('${secItems.length}', style: TextStyle(fontSize: 12, color: tc.muted)),
                if (canEdit) ...[
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => _showItemDialog(context, state, cl, sectionId: sec.id),
                    child: Icon(Icons.add, size: 18, color: tc.subtext),
                  ),
                  const SizedBox(width: 4),
                  InkWell(
                    onTap: () => _confirmDeleteSection(context, state, cl, sec),
                    child: Icon(Icons.delete_outline, size: 18, color: tc.subtext),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (sec.expanded)
          _buildItemList(context, state, cl, secItems, tc, useStatuses, statuses, canEdit, canCheck, sec.id),
        Divider(height: 1, color: tc.border),
      ],
    );
  }

  Widget _buildItemList(
    BuildContext context,
    AppState state,
    Checklist cl,
    List<ChecklistItem> items,
    ThemeColors tc,
    bool useStatuses,
    List<ItemStatus> statuses,
    bool canEdit,
    bool canCheck,
    String? sectionId,
  ) {
    if (items.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Text('No items', style: TextStyle(fontSize: 12, color: tc.muted)),
      );
    }
    return Column(
      children: items.map((item) => _buildItem(context, state, cl, item, tc, useStatuses, statuses, canEdit, canCheck)).toList(),
    );
  }

  Widget _buildItem(
    BuildContext context,
    AppState state,
    Checklist cl,
    ChecklistItem item,
    ThemeColors tc,
    bool useStatuses,
    List<ItemStatus> statuses,
    bool canEdit,
    bool canCheck,
  ) {
    final isDone = useStatuses && item.status != null
        ? statuses.firstWhereOrNull((s) => s.id == item.status)?.isDone ?? false
        : item.checked;

    ItemStatus? currentStatus;
    if (useStatuses && statuses.isNotEmpty) {
      currentStatus = statuses.firstWhereOrNull((s) => s.id == (item.status ?? statuses.first.id));
    }

    final hasNotes = item.notes.isNotEmpty;
    final notesExpanded = _expandedNotes.contains(item.id);
    final isCompact = state.settings.density == Density.compact;

    return Dismissible(
      key: Key(item.id),
      direction: canEdit ? DismissDirection.endToStart : DismissDirection.none,
      background: Container(
        color: AppColors.danger,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.delete, color: Colors.white),
      ),
      confirmDismiss: (_) async {
        return await _confirmDeleteItem(context);
      },
      onDismissed: (_) => state.deleteItem(cl.id, item.id),
      child: Container(
        decoration: BoxDecoration(
          color: tc.card,
          border: Border(bottom: BorderSide(color: tc.border, width: 0.5)),
        ),
        child: Column(
          children: [
            InkWell(
              onTap: canCheck ? () => state.toggleItemCheck(cl.id, item.id) : null,
              onLongPress: canEdit ? () => _showItemDialog(context, state, cl, editItem: item) : null,
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: isCompact ? 8 : 12),
                child: Row(
                  children: [
                    // Status/check indicator
                    if (useStatuses && currentStatus != null)
                      GestureDetector(
                        onTap: canCheck ? () => setState(() => _statusPickerItemId = item.id) : null,
                        child: Container(
                          width: 14,
                          height: 14,
                          decoration: BoxDecoration(
                            color: hexColor(currentStatus.color),
                            shape: BoxShape.circle,
                          ),
                        ),
                      )
                    else
                      SizedBox(
                        width: 20,
                        height: 20,
                        child: Checkbox(
                          value: isDone,
                          onChanged: canCheck ? (_) => state.toggleItemCheck(cl.id, item.id) : null,
                          shape: const CircleBorder(),
                          activeColor: AppColors.success,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                      ),
                    const SizedBox(width: 12),
                    // Content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.name,
                            style: TextStyle(
                              fontSize: 14,
                              color: isDone ? tc.muted : tc.text,
                              decoration: isDone ? TextDecoration.lineThrough : null,
                            ),
                          ),
                          if (item.description.isNotEmpty && !isCompact)
                            Text(item.description,
                                style: TextStyle(fontSize: 12, color: tc.subtext),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),
                    // Quantity badge
                    if (cl.settings.enableQuantity && item.requiredQty > 1)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: tc.input,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('${item.ownedQty}/${item.requiredQty}',
                            style: TextStyle(fontSize: 11, color: tc.subtext)),
                      ),
                    // Category dot
                    Padding(
                      padding: const EdgeInsets.only(left: 6),
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: AppColors.forCategory(item.category),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                    // Notes toggle
                    if (hasNotes)
                      IconButton(
                        icon: Icon(notesExpanded ? Icons.notes : Icons.notes_outlined,
                            size: 16, color: tc.subtext),
                        onPressed: () => setState(() {
                          if (notesExpanded) _expandedNotes.remove(item.id);
                          else _expandedNotes.add(item.id);
                        }),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                      ),
                    if (canEdit)
                      IconButton(
                        icon: Icon(Icons.edit_outlined, size: 16, color: tc.muted),
                        onPressed: () => _showItemDialog(context, state, cl, editItem: item),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                      ),
                  ],
                ),
              ),
            ),
            // Notes expansion
            if (hasNotes && notesExpanded)
              Padding(
                padding: const EdgeInsets.fromLTRB(48, 0, 16, 10),
                child: Text(item.notes, style: TextStyle(fontSize: 12, color: tc.subtext, fontStyle: FontStyle.italic)),
              ),
            // Status picker
            if (_statusPickerItemId == item.id && useStatuses)
              Container(
                color: tc.input,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    ...statuses.map((st) => GestureDetector(
                      onTap: () {
                        state.setItemStatus(cl.id, item.id, st.id);
                        setState(() => _statusPickerItemId = null);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: hexColor(st.color),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(
                            color: (item.status ?? statuses.first.id) == st.id
                                ? Colors.white
                                : Colors.transparent,
                            width: 2,
                          ),
                        ),
                        child: Text(st.label, style: const TextStyle(fontSize: 12, color: Colors.white)),
                      ),
                    )),
                    GestureDetector(
                      onTap: () => setState(() => _statusPickerItemId = null),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(color: tc.border, borderRadius: BorderRadius.circular(8)),
                        child: Text('Cancel', style: TextStyle(fontSize: 12, color: tc.text)),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showItemDialog(BuildContext context, AppState state, Checklist cl,
      {ChecklistItem? editItem, String? sectionId}) {
    showDialog(
      context: context,
      builder: (_) => ItemEditDialog(
        checklist: cl,
        editItem: editItem,
        defaultSectionId: sectionId,
        onSave: (name, desc, cat, reqQty, notes, secId) {
          if (editItem != null) {
            state.updateItem(cl.id, editItem.id, (i) => i.copyWith(
              name: name, description: desc, category: cat,
              requiredQty: reqQty, notes: notes, sectionId: secId,
            ));
          } else {
            state.addItem(cl.id,
              name: name, description: desc, category: cat,
              requiredQty: reqQty, notes: notes, sectionId: secId,
            );
          }
        },
      ),
    );
  }

  Future<bool> _confirmDeleteItem(BuildContext context) async {
    return await showDialog<bool>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Delete Item?'),
            content: const Text('Are you sure you want to delete this item?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Delete'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _confirmDeleteSection(BuildContext context, AppState state, Checklist cl, Section sec) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Section?'),
        content: Text('Delete "${sec.name}"? Items will be moved to the unsectioned area.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () {
              Navigator.pop(context);
              state.deleteSection(cl.id, sec.id);
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final ItemStatus status;
  final int count;
  final ThemeColors tc;
  const _StatusChip({required this.status, required this.count, required this.tc});

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: hexColor(status.color, opacity: 0.15),
      borderRadius: BorderRadius.circular(8),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 6, height: 6, decoration: BoxDecoration(color: hexColor(status.color), shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text('${status.label} ($count)', style: TextStyle(fontSize: 11, color: tc.text)),
    ]),
  );
}
