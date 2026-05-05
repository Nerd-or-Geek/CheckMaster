import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../constants/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';

/// Dialog to manage the custom item status list for a checklist.
class StatusEditorDialog extends StatefulWidget {
  final String checklistId;
  const StatusEditorDialog({super.key, required this.checklistId});

  @override
  State<StatusEditorDialog> createState() => _StatusEditorDialogState();
}

class _StatusEditorDialogState extends State<StatusEditorDialog> {
  late List<ItemStatus> _statuses;
  final _uuid = const Uuid();

  // Editing state
  String? _editingId;  // '__new__' when adding
  final _labelCtrl = TextEditingController();
  String _color  = kStatusColors[0];
  bool   _isDone = false;

  @override
  void initState() {
    super.initState();
    final cl = context.read<AppState>().checklists
        .firstWhereOrNull((c) => c.id == widget.checklistId);
    _statuses = List<ItemStatus>.from(cl?.settings.itemStatuses ?? kDefaultItemStatuses);
  }

  @override
  void dispose() {
    _labelCtrl.dispose();
    super.dispose();
  }

  void _startAdd() {
    _labelCtrl.clear();
    setState(() { _editingId = '__new__'; _color = kStatusColors[0]; _isDone = false; });
  }

  void _startEdit(ItemStatus s) {
    _labelCtrl.text = s.label;
    setState(() { _editingId = s.id; _color = s.color; _isDone = s.isDone; });
  }

  void _saveEdit() {
    final label = _labelCtrl.text.trim();
    if (label.isEmpty) return;
    if (_editingId == '__new__') {
      _statuses.add(ItemStatus(
        id: _uuid.v4(),
        label: label,
        color: _color,
        isDone: _isDone,
      ));
    } else {
      final idx = _statuses.indexWhere((s) => s.id == _editingId);
      if (idx >= 0) {
        _statuses[idx] = _statuses[idx].copyWith(
          label: label,
          color: _color,
          isDone: _isDone,
        );
      }
    }
    setState(() => _editingId = null);
  }

  void _delete(String id) => setState(() => _statuses.removeWhere((s) => s.id == id));

  void _toggleDone(String id, bool isDone) {
    final idx = _statuses.indexWhere((s) => s.id == id);
    if (idx >= 0) setState(() => _statuses[idx] = _statuses[idx].copyWith(isDone: isDone));
  }

  void _commit() {
    context.read<AppState>().updateChecklist(widget.checklistId, (cl) =>
        cl.copyWith(settings: cl.settings.copyWith(itemStatuses: _statuses)));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    return AlertDialog(
      backgroundColor: tc.card,
      title: Text('Item Statuses', style: TextStyle(color: tc.text)),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Define statuses used to track item progress. Enable "Done" on statuses that count as completed.',
              style: TextStyle(fontSize: 12, color: tc.subtext),
            ),
            const SizedBox(height: 12),
            if (_statuses.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text('No statuses defined', style: TextStyle(color: tc.muted)),
              ),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 280),
              child: ReorderableListView(
                shrinkWrap: true,
                onReorder: (oldIdx, newIdx) {
                  setState(() {
                    if (oldIdx < newIdx) newIdx--;
                    final item = _statuses.removeAt(oldIdx);
                    _statuses.insert(newIdx, item);
                  });
                },
                children: _statuses.map((s) => _StatusRow(
                  key: Key(s.id),
                  status: s,
                  isEditing: _editingId == s.id,
                  tc: tc,
                  onEdit: () => _startEdit(s),
                  onDelete: () => _delete(s.id),
                  onToggleDone: (v) => _toggleDone(s.id, v),
                )).toList(),
              ),
            ),
            if (_editingId != null) ...[
              const Divider(),
              _buildEditForm(tc),
            ],
            const SizedBox(height: 8),
            if (_editingId == null)
              TextButton.icon(
                icon: const Icon(Icons.add),
                label: const Text('Add Status'),
                onPressed: _startAdd,
              ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(onPressed: _commit, child: const Text('Save')),
      ],
    );
  }

  Widget _buildEditForm(ThemeColors tc) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(_editingId == '__new__' ? 'New Status' : 'Edit Status',
            style: TextStyle(fontWeight: FontWeight.w600, color: tc.text, fontSize: 13)),
        const SizedBox(height: 8),
        TextField(
          controller: _labelCtrl,
          style: TextStyle(color: tc.text),
          decoration: const InputDecoration(labelText: 'Label', isDense: true),
          autofocus: true,
        ),
        const SizedBox(height: 8),
        Text('Color', style: TextStyle(fontSize: 11, color: tc.subtext)),
        const SizedBox(height: 4),
        Wrap(
          spacing: 6,
          children: kStatusColors.map((c) => GestureDetector(
            onTap: () => setState(() => _color = c),
            child: Container(
              width: 24, height: 24,
              decoration: BoxDecoration(
                color: hexColor(c),
                shape: BoxShape.circle,
                border: Border.all(color: _color == c ? Colors.white : Colors.transparent, width: 2.5),
              ),
            ),
          )).toList(),
        ),
        const SizedBox(height: 8),
        SwitchListTile.adaptive(
          dense: true,
          title: Text('Counts as Done', style: TextStyle(fontSize: 13, color: tc.text)),
          value: _isDone,
          onChanged: (v) => setState(() => _isDone = v),
          contentPadding: EdgeInsets.zero,
        ),
        const SizedBox(height: 4),
        Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          TextButton(onPressed: () => setState(() => _editingId = null), child: const Text('Cancel')),
          const SizedBox(width: 8),
          ElevatedButton(onPressed: _saveEdit, child: const Text('OK')),
        ]),
      ],
    );
  }
}

class _StatusRow extends StatelessWidget {
  final ItemStatus status;
  final bool isEditing;
  final ThemeColors tc;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final ValueChanged<bool> onToggleDone;

  const _StatusRow({
    super.key,
    required this.status,
    required this.isEditing,
    required this.tc,
    required this.onEdit,
    required this.onDelete,
    required this.onToggleDone,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 2),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isEditing ? AppColors.primary.withOpacity(0.06) : tc.input,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: isEditing ? AppColors.primary.withOpacity(0.3) : Colors.transparent),
      ),
      child: Row(children: [
        Container(width: 10, height: 10,
            decoration: BoxDecoration(color: hexColor(status.color), shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text(status.label, style: TextStyle(fontSize: 13, color: tc.text))),
        Tooltip(
          message: status.isDone ? 'Counts as done' : 'Not done',
          child: Switch.adaptive(
            value: status.isDone,
            onChanged: onToggleDone,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ),
        IconButton(icon: Icon(Icons.edit_outlined, size: 15, color: tc.subtext), onPressed: onEdit,
            padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28)),
        IconButton(icon: Icon(Icons.delete_outline, size: 15, color: tc.muted), onPressed: onDelete,
            padding: EdgeInsets.zero, constraints: const BoxConstraints(minWidth: 28, minHeight: 28)),
        const Icon(Icons.drag_handle, size: 16),
      ]),
    );
  }
}
