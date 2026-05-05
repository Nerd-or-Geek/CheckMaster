import 'dart:math';
import 'package:flutter/material.dart';
import '../constants/theme.dart';

// ─── SegmentedBar ─────────────────────────────────────────────────────────────

class SegmentData {
  final String label;
  final int value;
  final String colorHex;

  const SegmentData({required this.label, required this.value, required this.colorHex});
}

class SegmentedBar extends StatelessWidget {
  final List<SegmentData> segments;
  final double height;

  const SegmentedBar({super.key, required this.segments, this.height = 8});

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<int>(0, (s, e) => s + e.value);
    if (total == 0) {
      return Container(height: height, decoration: BoxDecoration(
        color: Theme.of(context).dividerColor,
        borderRadius: BorderRadius.circular(height / 2),
      ));
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(height / 2),
      child: SizedBox(
        height: height,
        child: Row(
          children: segments.map((seg) {
            final flex = (seg.value / total * 1000).round();
            if (flex == 0) return const SizedBox.shrink();
            return Expanded(
              flex: flex,
              child: Container(color: hexColor(seg.colorHex)),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ─── PieChart ─────────────────────────────────────────────────────────────────

class PieChartWidget extends StatelessWidget {
  final List<SegmentData> segments;
  final double size;
  final String? centerLabel;
  final String? centerSubLabel;

  const PieChartWidget({
    super.key,
    required this.segments,
    this.size = 120,
    this.centerLabel,
    this.centerSubLabel,
  });

  @override
  Widget build(BuildContext context) {
    final total = segments.fold<int>(0, (s, e) => s + e.value);
    final tc = ThemeColors.of(context);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _PiePainter(
              segments: segments,
              total: total,
              backgroundColor: tc.border,
            ),
          ),
          if (centerLabel != null)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(centerLabel!, style: TextStyle(fontSize: size * 0.18, fontWeight: FontWeight.bold, color: tc.text)),
                if (centerSubLabel != null)
                  Text(centerSubLabel!, style: TextStyle(fontSize: size * 0.11, color: tc.subtext)),
              ],
            ),
        ],
      ),
    );
  }
}

class _PiePainter extends CustomPainter {
  final List<SegmentData> segments;
  final int total;
  final Color backgroundColor;

  _PiePainter({required this.segments, required this.total, required this.backgroundColor});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r  = (size.width / 2) * 0.95;
    final inner = r * 0.55;
    final paint = Paint()..style = PaintingStyle.fill;

    if (total == 0) {
      paint.color = backgroundColor;
      canvas.drawArc(Rect.fromCircle(center: Offset(cx, cy), radius: r),
          0, 2 * pi, true, paint);
      paint.color = backgroundColor.withOpacity(0);
      canvas.drawCircle(Offset(cx, cy), inner, paint..color = Colors.transparent);
      // draw hole
      paint.color = backgroundColor;
      canvas.drawCircle(Offset(cx, cy), inner, Paint()
        ..color = Colors.transparent
        ..blendMode = BlendMode.clear);
      return;
    }

    double startAngle = -pi / 2;
    for (final seg in segments) {
      if (seg.value == 0) continue;
      final sweep = (seg.value / total) * 2 * pi;
      paint.color = hexColor(seg.colorHex);
      canvas.drawArc(
        Rect.fromCircle(center: Offset(cx, cy), radius: r),
        startAngle,
        sweep,
        true,
        paint,
      );
      startAngle += sweep;
    }

    // Donut hole
    final holePaint = Paint()
      ..color = backgroundColor.withAlpha(0)
      ..blendMode = BlendMode.clear;
    canvas.drawCircle(Offset(cx, cy), inner, holePaint);
  }

  @override
  bool shouldRepaint(_PiePainter old) =>
      old.segments != segments || old.total != total;
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

class BarChartWidget extends StatelessWidget {
  final List<SegmentData> segments;
  final double maxHeight;

  const BarChartWidget({super.key, required this.segments, this.maxHeight = 120});

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    final maxVal = segments.fold<int>(0, (m, s) => s.value > m ? s.value : m);
    if (maxVal == 0) {
      return SizedBox(height: maxHeight, child: Center(
        child: Text('No data', style: TextStyle(color: tc.muted, fontSize: 12)),
      ));
    }
    return SizedBox(
      height: maxHeight + 32,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: segments.map((seg) {
          final barH = maxVal > 0 ? (seg.value / maxVal) * maxHeight : 0.0;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  if (seg.value > 0)
                    Text('${seg.value}', style: TextStyle(fontSize: 10, color: tc.subtext)),
                  const SizedBox(height: 2),
                  Container(
                    height: barH.toDouble(),
                    decoration: BoxDecoration(
                      color: hexColor(seg.colorHex),
                      borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    seg.label,
                    style: TextStyle(fontSize: 9, color: tc.subtext),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── ProgressRing ─────────────────────────────────────────────────────────────

class ProgressRing extends StatelessWidget {
  final int percentage;
  final double size;
  final Color? color;

  const ProgressRing({super.key, required this.percentage, this.size = 48, this.color});

  @override
  Widget build(BuildContext context) {
    final tc = ThemeColors.of(context);
    final clampedPct = percentage.clamp(0, 100);
    final ringColor = color ?? AppColors.primary;
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CircularProgressIndicator(
            value: clampedPct / 100,
            backgroundColor: tc.border,
            color: ringColor,
            strokeWidth: size * 0.1,
          ),
          Text(
            '$clampedPct%',
            style: TextStyle(fontSize: size * 0.22, fontWeight: FontWeight.bold, color: tc.text),
          ),
        ],
      ),
    );
  }
}
