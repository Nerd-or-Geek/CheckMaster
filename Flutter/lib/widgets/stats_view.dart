import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../constants/theme.dart';
import '../models/models.dart';
import '../state/app_state.dart';
import 'charts.dart';

class StatsView extends StatelessWidget {
  final String checklistId;

  const StatsView({super.key, required this.checklistId});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final cl = state.checklists.firstWhereOrNull((c) => c.id == checklistId);
    if (cl == null) {
      return const Center(child: Text('No checklist selected'));
    }
    final stats = state.getChecklistStats(checklistId);
    final tc = ThemeColors.of(context);
    final settings = cl.settings;
    final chartOverride = settings.chartTypeOverride;
    final globalChart = state.settings.chartType;
    final isPie = chartOverride != null ? chartOverride == 'pie' : globalChart == ChartType.pie;

    // Build status/segment data
    final statuses = settings.itemStatuses;
    final useStatuses = statuses.isNotEmpty;

    final List<SegmentData> statusSegments;
    if (useStatuses) {
      statusSegments = statuses.map((st) {
        final count = cl.items
            .where((i) => (i.status ?? statuses.first.id) == st.id)
            .length;
        return SegmentData(label: st.label, value: count, colorHex: st.color);
      }).toList();
    } else {
      statusSegments = [
        SegmentData(label: 'Done', value: stats.completed, colorHex: '#10B981'),
        SegmentData(label: 'Remaining', value: stats.total - stats.completed, colorHex: '#E5E7EB'),
      ];
    }

    final catSegments = stats.categoryBreakdown.entries.map((e) {
      final catColor = AppColors.forCategory(e.key);
      return SegmentData(label: e.key, value: e.value.total, colorHex: '#${catColor.value.toRadixString(16).substring(2)}');
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Expanded(
                child: Text(
                  cl.name,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: tc.text),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${stats.percentage}%',
                  style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar
          SegmentedBar(segments: statusSegments, height: 10),
          const SizedBox(height: 6),
          Text(
            '${stats.completed} / ${stats.total} items complete',
            style: TextStyle(fontSize: 12, color: tc.subtext),
          ),
          const SizedBox(height: 20),

          // Status Breakdown card
          _Card(
            tc: tc,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Status Breakdown', style: TextStyle(fontWeight: FontWeight.w600, color: tc.text)),
                    const Spacer(),
                    if (isPie)
                      Text('${stats.percentage}%',
                          style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold, fontSize: 13)),
                  ],
                ),
                const SizedBox(height: 12),
                if (isPie)
                  Center(
                    child: PieChartWidget(
                      segments: statusSegments,
                      size: 140,
                      centerLabel: '${stats.percentage}%',
                      centerSubLabel: 'done',
                    ),
                  )
                else
                  BarChartWidget(segments: statusSegments, maxHeight: 100),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: statusSegments.map((s) => _LegendDot(label: '${s.label} (${s.value})', colorHex: s.colorHex)).toList(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Category breakdown (only in pie mode)
          if (isPie && catSegments.isNotEmpty)
            _Card(
              tc: tc,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Category Breakdown', style: TextStyle(fontWeight: FontWeight.w600, color: tc.text)),
                  const SizedBox(height: 12),
                  Center(
                    child: PieChartWidget(segments: catSegments, size: 120),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: catSegments.map((s) => _LegendDot(label: '${s.label} (${s.value})', colorHex: s.colorHex)).toList(),
                  ),
                ],
              ),
            ),

          if (catSegments.isNotEmpty && !isPie) ...[
            const SizedBox(height: 12),
            _Card(
              tc: tc,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Category Breakdown', style: TextStyle(fontWeight: FontWeight.w600, color: tc.text)),
                  const SizedBox(height: 12),
                  BarChartWidget(segments: catSegments, maxHeight: 80),
                ],
              ),
            ),
          ],

          // Partial items
          if (stats.partialItems.isNotEmpty) ...[
            const SizedBox(height: 12),
            _Card(
              tc: tc,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Partially Collected', style: TextStyle(fontWeight: FontWeight.w600, color: tc.text)),
                  const SizedBox(height: 8),
                  ...stats.partialItems.map((item) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(child: Text(item.name, style: TextStyle(fontSize: 13, color: tc.text))),
                        Text('${item.ownedQty}/${item.requiredQty}',
                            style: TextStyle(fontSize: 12, color: tc.subtext)),
                      ],
                    ),
                  )),
                ],
              ),
            ),
          ],

          // Summary counts
          const SizedBox(height: 12),
          _Card(
            tc: tc,
            child: Row(
              children: [
                _StatTile(label: 'Total', value: '${stats.total}', tc: tc),
                _Divider(tc: tc),
                _StatTile(label: 'Done', value: '${stats.completed}', tc: tc, color: AppColors.success),
                _Divider(tc: tc),
                _StatTile(label: 'Left', value: '${stats.total - stats.completed}', tc: tc),
                _Divider(tc: tc),
                _StatTile(label: 'Sections', value: '${cl.sections.length}', tc: tc),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  final ThemeColors tc;
  final Widget child;
  const _Card({required this.tc, required this.child});

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: tc.card,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: tc.border),
    ),
    child: child,
  );
}

class _LegendDot extends StatelessWidget {
  final String label;
  final String colorHex;
  const _LegendDot({required this.label, required this.colorHex});

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: hexColor(colorHex), shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: TextStyle(fontSize: 11, color: tc.subtext)),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  final String label;
  final String value;
  final ThemeColors tc;
  final Color? color;
  const _StatTile({required this.label, required this.value, required this.tc, this.color});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color ?? tc.text)),
        Text(label, style: TextStyle(fontSize: 11, color: tc.subtext)),
      ],
    ),
  );
}

class _Divider extends StatelessWidget {
  final ThemeColors tc;
  const _Divider({required this.tc});

  @override
  Widget build(BuildContext context) => Container(width: 1, height: 32, color: tc.border, margin: const EdgeInsets.symmetric(horizontal: 4));
}
