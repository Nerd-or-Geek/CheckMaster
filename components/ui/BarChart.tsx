import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BarData {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  textColor?: string;
  trackColor?: string;
}

export default function BarChart({ data, height = 200, textColor = '#0F172A', trackColor = '#E2E8F0' }: BarChartProps) {
  const maxVal = Math.max(...data.map(d => d.maxValue), 1);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.barsRow}>
        {data.map((bar, idx) => {
          const barHeight = (bar.value / maxVal) * (height - 40);
          const fillHeight = (bar.maxValue > 0 ? bar.value / bar.maxValue : 0) * (height - 40);
          return (
            <View key={idx} style={styles.barCol}>
              <View style={[styles.barTrack, { height: height - 40, backgroundColor: trackColor }]}>
                <View
                  style={[
                    styles.barFill,
                    { height: Math.max(fillHeight, 4), backgroundColor: bar.color },
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, { color: textColor }]} numberOfLines={1}>
                {bar.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  barsRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '80%',
    maxWidth: 48,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: { width: '100%', borderRadius: 6 },
  barLabel: { fontSize: 10, fontWeight: '600', marginTop: 6, textAlign: 'center' },
});
