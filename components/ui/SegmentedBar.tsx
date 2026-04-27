import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface SegmentedBarSegment {
  label: string;
  value: number;
  color: string;
}

interface SegmentedBarProps {
  segments: SegmentedBarSegment[];
  height?: number;
  borderRadius?: number;
  showLabels?: boolean;
  textColor?: string;
  trackColor?: string;
}

export default function SegmentedBar({
  segments,
  height = 24,
  borderRadius = 8,
  showLabels = true,
  textColor = '#0F172A',
  trackColor = '#E2E8F0',
}: SegmentedBarProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <View>
        <View style={[styles.track, { height, borderRadius, backgroundColor: trackColor }]} />
        {showLabels ? (
          <View style={styles.legendRow}>
            <Text style={[styles.legendText, { color: textColor }]}>No items</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.track, { height, borderRadius, backgroundColor: trackColor }]}>
        {segments.map((seg, idx) => {
          if (seg.value <= 0) return null;
          const pct = (seg.value / total) * 100;
          return (
            <View
              key={idx}
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: seg.color,
                borderTopLeftRadius: idx === 0 ? borderRadius : 0,
                borderBottomLeftRadius: idx === 0 ? borderRadius : 0,
                borderTopRightRadius: idx === segments.length - 1 ? borderRadius : 0,
                borderBottomRightRadius: idx === segments.length - 1 ? borderRadius : 0,
              }}
            />
          );
        })}
      </View>
      {showLabels ? (
        <View style={styles.legendRow}>
          {segments.filter(s => s.value > 0).map((seg, idx) => (
            <View key={idx} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={[styles.legendText, { color: textColor }]}>
                {seg.label} {seg.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    overflow: 'hidden',
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
