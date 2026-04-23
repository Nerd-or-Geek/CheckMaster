import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
  size?: number;
  innerRadius?: number;
  textColor?: string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export default function PieChart({ data, size = 180, innerRadius = 55, textColor = '#0F172A' }: PieChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Path
            d={describeArc(size / 2, size / 2, (size - 10) / 2, 0, 359.99)}
            stroke="#E2E8F0"
            strokeWidth={size / 2 - innerRadius}
            fill="none"
          />
        </Svg>
        <View style={[styles.centerLabel, { width: innerRadius * 2, height: innerRadius * 2 }]}>
          <Text style={[styles.centerValue, { color: textColor }]}>0%</Text>
        </View>
      </View>
    );
  }

  let cumAngle = 0;
  const outerR = (size - 4) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const thickness = outerR - innerRadius;

  const paths = data.filter(d => d.value > 0).map((slice, idx) => {
    const sliceAngle = (slice.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += sliceAngle;
    const endAngle = cumAngle;
    const midR = innerRadius + thickness / 2;

    if (sliceAngle >= 359.9) {
      const d1 = describeArc(cx, cy, midR, 0, 179.99);
      const d2 = describeArc(cx, cy, midR, 180, 359.99);
      return (
        <G key={idx}>
          <Path d={d1} stroke={slice.color} strokeWidth={thickness} fill="none" />
          <Path d={d2} stroke={slice.color} strokeWidth={thickness} fill="none" />
        </G>
      );
    }

    const d = describeArc(cx, cy, midR, startAngle, endAngle - 0.5);
    return (
      <Path
        key={idx}
        d={d}
        stroke={slice.color}
        strokeWidth={thickness}
        strokeLinecap="round"
        fill="none"
      />
    );
  });

  const completedSlice = data.find(d => d.label === 'Completed');
  const pct = completedSlice ? Math.round((completedSlice.value / total) * 100) : 0;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>{paths}</Svg>
      <View style={[styles.centerLabel, { width: innerRadius * 2 - 8, height: innerRadius * 2 - 8 }]}>
        <Text style={[styles.centerValue, { color: textColor }]}>{pct}%</Text>
        <Text style={styles.centerCaption}>done</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  centerLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  centerValue: { fontSize: 28, fontWeight: '700' },
  centerCaption: { fontSize: 12, fontWeight: '500', color: '#94A3B8', marginTop: -2 },
});
