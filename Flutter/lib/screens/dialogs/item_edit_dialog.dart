import 'package:flutter/material.dart';
import '../../constants/theme.dart';
import '../../models/models.dart';

class ItemEditDialog extends StatefulWidget {
  final Checklist checklist;
  final ChecklistItem? editItem;
  final String? defaultSectionId;
  final void Function(
    String name,
    String description,
    String category,
    int requiredQty,
    String notes,
    String? sectionId,
  ) onSave;

  const ItemEditDialog({
    super.key,
    required this.checklist,
    this.editItem,
    this.defaultSectionId,
    required this.onSave,
  });

  @override
  State<ItemEditDialog> createState() => _ItemEditDialogState();
}

class _ItemEditDialogState extends State<ItemEditDialog> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _descCtrl;
  late final TextEditingController _notesCtrl;
  late final TextEditingController _qtyCtrl;
  late String _category;
  late String? _sectionId;

  static const List<String> _categories = [
    'general', 'shopping', 'health', 'work', 'travel', 'home', 'safety', 'clothing', 'electronics',
  ];

  @override
  void initState() {
    super.initState();
    final item = widget.editItem;
    _nameCtrl  = TextEditingController(text: item?.name ?? '');
    _descCtrl  = TextEditingController(text: item?.description ?? '');
    _notesCtrl = TextEditingController(text: item?.notes ?? '');
    _qtyCtrl   = TextEditingController(text: (item?.requiredQty ?? 1).toString());
    _category  = item?.category ?? widget.checklist.settings.defaultCategory;
    _sectionId = item?.sectionId ?? widget.defaultSectionId;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _descCtrl.dispose();
    _notesCtrl.dispose();
    _qtyCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final tc      = ThemeColors.of(context);
    final cl      = widget.checklist;
    final isEdit  = widget.editItem != null;
    final sections = [...cl.sections]..sort((a, b) => a.order.compareTo(b.order));

    return AlertDialog(
      backgroundColor: tc.card,
      title: Text(isEdit ? 'Edit Item' : 'Add Item', style: TextStyle(color: tc.text)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _label('Name *', tc),
            TextField(
              controller: _nameCtrl,
              autofocus: true,
              style: TextStyle(color: tc.text),
              decoration: const InputDecoration(hintText: 'Item name'),
            ),
            const SizedBox(height: 10),
            _label('Description', tc),
            TextField(
              controller: _descCtrl,
              style: TextStyle(color: tc.text),
              decoration: const InputDecoration(hintText: 'Optional description'),
            ),
            if (cl.settings.enableNotes) ...[
              const SizedBox(height: 10),
              _label('Notes', tc),
              TextField(
                controller: _notesCtrl,
                maxLines: 3,
                style: TextStyle(color: tc.text),
                decoration: const InputDecoration(hintText: 'Optional notes'),
              ),
            ],
            if (cl.settings.enableQuantity) ...[
              const SizedBox(height: 10),
              _label('Required Quantity', tc),
              TextField(
                controller: _qtyCtrl,
                keyboardType: TextInputType.number,
                style: TextStyle(color: tc.text),
                decoration: const InputDecoration(hintText: '1'),
              ),
            ],
            const SizedBox(height: 10),
            _label('Category', tc),
            DropdownButtonFormField<String>(
              value: _categories.contains(_category) ? _category : 'general',
              dropdownColor: tc.card,
              style: TextStyle(color: tc.text, fontSize: 14),
              decoration: InputDecoration(filled: true, fillColor: tc.input),
              items: _categories.map((c) => DropdownMenuItem(
                value: c,
                child: Row(children: [
                  Container(width: 10, height: 10, decoration: BoxDecoration(
                    color: AppColors.forCategory(c), shape: BoxShape.circle,
                  )),
                  const SizedBox(width: 8),
                  Text(c[0].toUpperCase() + c.substring(1)),
                ]),
              )).toList(),
              onChanged: (v) => setState(() => _category = v ?? 'general'),
            ),
            if (cl.settings.enableSections && sections.isNotEmpty) ...[
              const SizedBox(height: 10),
              _label('Section', tc),
              DropdownButtonFormField<String?>(
                value: _sectionId,
                dropdownColor: tc.card,
                style: TextStyle(color: tc.text, fontSize: 14),
                decoration: InputDecoration(filled: true, fillColor: tc.input),
                items: [
                  DropdownMenuItem<String?>(value: null, child: Text('None', style: TextStyle(color: tc.subtext))),
                  ...sections.map((s) => DropdownMenuItem<String?>(value: s.id, child: Text(s.name))),
                ],
                onChanged: (v) => setState(() => _sectionId = v),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () {
            final name = _nameCtrl.text.trim();
            if (name.isEmpty) return;
            widget.onSave(
              name,
              _descCtrl.text.trim(),
              _category,
              int.tryParse(_qtyCtrl.text) ?? 1,
              _notesCtrl.text.trim(),
              _sectionId,
            );
            Navigator.pop(context);
          },
          child: Text(isEdit ? 'Save' : 'Add'),
        ),
      ],
    );
  }

  Widget _label(String text, ThemeColors tc) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Text(text, style: TextStyle(fontSize: 12, color: tc.subtext, fontWeight: FontWeight.w500)),
  );
}
