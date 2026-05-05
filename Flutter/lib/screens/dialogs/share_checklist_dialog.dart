import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../constants/theme.dart';
import '../../models/models.dart';
import '../../state/app_state.dart';

/// Dialog to share a checklist by generating a text export.
class ShareChecklistDialog extends StatefulWidget {
  final String checklistId;
  const ShareChecklistDialog({super.key, required this.checklistId});

  @override
  State<ShareChecklistDialog> createState() => _ShareChecklistDialogState();
}

class _ShareChecklistDialogState extends State<ShareChecklistDialog> {
  late String _shareText;
  bool _copied = false;
  String _format = 'text'; // 'text' | 'csv'

  @override
  void initState() {
    super.initState();
    _buildShareText();
  }

  void _buildShareText() {
    final cl = context.read<AppState>().checklists
        .firstWhereOrNull((c) => c.id == widget.checklistId);
    if (cl == null) { _shareText = ''; return; }
    final statuses = cl.settings.itemStatuses;
    final useStatuses = statuses.isNotEmpty;

    if (_format == 'csv') {
      // CSV: Name,Category,Status,Notes
      final lines = ['Name,Category,Status,Notes'];
      for (final item in cl.items) {
        String status = '';
        if (useStatuses && item.status != null) {
          status = statuses.firstWhereOrNull((s) => s.id == item.status)?.label ?? '';
        } else {
          status = item.checked ? 'Done' : 'Pending';
        }
        lines.add('"${item.name}","${item.category}","$status","${item.notes ?? ''}"');
      }
      _shareText = lines.join('\n');
    } else {
      // Human-readable text format
      final buf = StringBuffer();
      buf.writeln('📋 ${cl.name}');
      if (cl.description.isNotEmpty) buf.writeln(cl.description);
      buf.writeln('');

      // Group by section
      if (cl.settings.enableSections && cl.sections.isNotEmpty) {
        for (final section in cl.sections) {
          buf.writeln('── ${section.name} ──');
          final items = cl.items.where((i) => i.sectionId == section.id).toList();
          for (final item in items) {
            final done = useStatuses && item.status != null
                ? (statuses.firstWhereOrNull((s) => s.id == item.status)?.isDone ?? item.checked)
                : item.checked;
            buf.writeln('${done ? '✅' : '☐'} ${item.name}');
            if (item.notes != null && item.notes!.isNotEmpty) buf.writeln('   ${item.notes}');
          }
          buf.writeln('');
        }
        // Items with no section
        final unsectioned = cl.items.where((i) => i.sectionId == null).toList();
        if (unsectioned.isNotEmpty) {
          for (final item in unsectioned) {
            final done = useStatuses && item.status != null
                ? (statuses.firstWhereOrNull((s) => s.id == item.status)?.isDone ?? item.checked)
                : item.checked;
            buf.writeln('${done ? '✅' : '☐'} ${item.name}');
          }
        }
      } else {
        for (final item in cl.items) {
          final done = useStatuses && item.status != null
              ? (statuses.firstWhereOrNull((s) => s.id == item.status)?.isDone ?? item.checked)
              : item.checked;
          buf.writeln('${done ? '✅' : '☐'} ${item.name}');
          if (item.notes != null && item.notes!.isNotEmpty) buf.writeln('   ${item.notes}');
        }
      }

      final done  = cl.items.where((i) => useStatuses && i.status != null
          ? (statuses.firstWhereOrNull((s) => s.id == i.status)?.isDone ?? i.checked)
          : i.checked).length;
      buf.writeln('');
      buf.writeln('Progress: $done/${cl.items.length} items');

      _shareText = buf.toString();
    }
  }

  Future<void> _copyToClipboard() async {
    await Clipboard.setData(ClipboardData(text: _shareText));
    setState(() => _copied = true);
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) setState(() => _copied = false);
  }

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    return AlertDialog(
      backgroundColor: tc.card,
      title: Text('Share Checklist', style: TextStyle(color: tc.text)),
      content: SizedBox(
        width: 400,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Format selector
            Row(children: [
              Text('Format:', style: TextStyle(fontSize: 13, color: tc.text)),
              const SizedBox(width: 12),
              ChoiceChip(
                label: const Text('Text'),
                selected: _format == 'text',
                onSelected: (_) => setState(() { _format = 'text'; _buildShareText(); }),
              ),
              const SizedBox(width: 8),
              ChoiceChip(
                label: const Text('CSV'),
                selected: _format == 'csv',
                onSelected: (_) => setState(() { _format = 'csv'; _buildShareText(); }),
              ),
            ]),
            const SizedBox(height: 12),
            Container(
              height: 220,
              decoration: BoxDecoration(
                color: tc.input,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: tc.border),
              ),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(10),
                child: SelectableText(
                  _shareText,
                  style: TextStyle(fontSize: 12, color: tc.text, fontFamily: 'monospace'),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Copy the text above to share this checklist.',
              style: TextStyle(fontSize: 11, color: tc.subtext),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        ElevatedButton.icon(
          icon: Icon(_copied ? Icons.check : Icons.copy, size: 16),
          label: Text(_copied ? 'Copied!' : 'Copy to Clipboard'),
          onPressed: _copyToClipboard,
        ),
      ],
    );
  }
}
