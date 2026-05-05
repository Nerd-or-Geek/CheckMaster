import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../constants/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';
import 'status_editor_dialog.dart';

/// Dialog to configure checklist-level settings (features, chart override, statuses).
class ChecklistSettingsDialog extends StatefulWidget {
  final String checklistId;
  const ChecklistSettingsDialog({super.key, required this.checklistId});

  @override
  State<ChecklistSettingsDialog> createState() => _ChecklistSettingsDialogState();
}

class _ChecklistSettingsDialogState extends State<ChecklistSettingsDialog> {
  late ChecklistSettings _s;
  final _nameCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    final cl = context.read<AppState>().checklists
        .firstWhereOrNull((c) => c.id == widget.checklistId);
    _s = cl?.settings ?? const ChecklistSettings();
    _nameCtrl.text = cl?.name ?? '';
    _descCtrl.text = cl?.description ?? '';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  void _commit() {
    final state = context.read<AppState>();
    state.updateChecklist(widget.checklistId, (cl) => cl.copyWith(
      name: _nameCtrl.text.trim().isEmpty ? cl.name : _nameCtrl.text.trim(),
      description: _descCtrl.text.trim(),
      settings: _s,
    ));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    return AlertDialog(
      backgroundColor: tc.card,
      title: Text('Checklist Settings', style: TextStyle(color: tc.text)),
      content: SizedBox(
        width: 380,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Name / description ──────────────────────────────────────
              Text('Details', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tc.muted,
                  letterSpacing: 0.6)),
              const SizedBox(height: 6),
              TextField(controller: _nameCtrl, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(labelText: 'Name', isDense: true)),
              const SizedBox(height: 6),
              TextField(controller: _descCtrl, style: TextStyle(color: tc.text),
                  decoration: const InputDecoration(labelText: 'Description', isDense: true)),
              const SizedBox(height: 16),

              // ── Feature toggles ─────────────────────────────────────────
              Text('Features', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tc.muted,
                  letterSpacing: 0.6)),
              _toggle(tc, 'Enable Sections',  _s.enableSections,  (v) => setState(() => _s = _s.copyWith(enableSections:  v))),
              _toggle(tc, 'Enable Notes',     _s.enableNotes,     (v) => setState(() => _s = _s.copyWith(enableNotes:     v))),
              _toggle(tc, 'Enable Quantity',  _s.enableQuantity,  (v) => setState(() => _s = _s.copyWith(enableQuantity:  v))),
              _toggle(tc, 'Enable Images',    _s.enableImages,    (v) => setState(() => _s = _s.copyWith(enableImages:    v))),
              const SizedBox(height: 16),

              // ── Chart override ──────────────────────────────────────────
              Text('Chart Override', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tc.muted,
                  letterSpacing: 0.6)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String?>(
                value: _s.chartTypeOverride,
                dropdownColor: tc.card,
                style: TextStyle(color: tc.text, fontSize: 14),
                decoration: const InputDecoration(isDense: true, labelText: 'Chart Type'),
                items: const [
                  DropdownMenuItem(value: null,  child: Text('Use App Default')),
                  DropdownMenuItem(value: 'pie', child: Text('Pie Chart')),
                  DropdownMenuItem(value: 'bar', child: Text('Bar Chart')),
                ],
                onChanged: (v) => setState(() => _s = _s.copyWith(chartTypeOverride: v)),
              ),
              const SizedBox(height: 16),

              // ── Item Statuses ───────────────────────────────────────────
              Text('Item Statuses', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: tc.muted,
                  letterSpacing: 0.6)),
              const SizedBox(height: 6),
              Row(children: [
                Expanded(child: Text(
                  _s.itemStatuses.isEmpty
                      ? 'Using defaults (${kDefaultItemStatuses.length} statuses)'
                      : '${_s.itemStatuses.length} custom status${_s.itemStatuses.length == 1 ? '' : 'es'}',
                  style: TextStyle(fontSize: 13, color: tc.subtext),
                )),
                OutlinedButton(
                  onPressed: () async {
                    await showDialog(
                      context: context,
                      builder: (_) => StatusEditorDialog(checklistId: widget.checklistId),
                    );
                    // Refresh our copy after dialog saves
                    if (mounted) {
                      final cl = context.read<AppState>().checklists
                          .firstWhereOrNull((c) => c.id == widget.checklistId);
                      if (cl != null) setState(() => _s = cl.settings);
                    }
                  },
                  child: const Text('Edit Statuses'),
                ),
              ]),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        ElevatedButton(onPressed: _commit, child: const Text('Save')),
      ],
    );
  }

  Widget _toggle(ThemeColors tc, String label, bool value, ValueChanged<bool> onChanged) =>
      SwitchListTile.adaptive(
        dense: true,
        contentPadding: EdgeInsets.zero,
        title: Text(label, style: TextStyle(fontSize: 13, color: tc.text)),
        value: value,
        onChanged: onChanged,
      );
}
