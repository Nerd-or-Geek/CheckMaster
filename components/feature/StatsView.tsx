import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, categoryColors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Checklist, Section } from '../../services/mockData';
import ProgressRing from '../ui/ProgressRing';
import PieChart from '../ui/PieChart';
import BarChart from '../ui/BarChart';

interface StatsViewProps {
  checklist: Checklist;
}

export default function StatsView({ checklist }: StatsViewProps) {
  const { settings, isDark, getChecklistStats } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const chartType = checklist.settings.chartTypeOverride || settings.chartType;

  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const allSections = [
    { id: '__all__', name: 'All Sections' },
    ...checklist.sections,
  ];

  const effectiveSectionId = selectedSection === '__all__' || selectedSection === null
    ? undefined : selectedSection;
  const stats = getChecklistStats(checklist.id, effectiveSectionId);

  const catEntries = Object.entries(stats.categoryBreakdown);
  const pieData = [
    { label: 'Completed', value: stats.completed, color: theme.success },
    { label: 'Remaining', value: stats.total - stats.completed, color: theme.border },
  ];

  const barData = catEntries.map(([cat, data]) => ({
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    value: data.completed,
    maxValue: data.total,
    color: categoryColors[cat]?.dot || theme.primary,
  }));

  return (
    <View style={{ flex: 1 }}>
      {checklist.sections.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {allSections.map(sec => {
              const isActive = (selectedSection || '__all__') === sec.id;
              return (
                <Pressable
                  key={sec.id}
                  style={[styles.sectionChip, {
                    backgroundColor: isActive ? theme.primary : theme.surface,
                    borderColor: isActive ? theme.primary : theme.border,
                  }]}
                  onPress={() => setSelectedSection(sec.id)}
                >
                  <Text style={{
                    fontSize: 13, fontWeight: '600',
                    color: isActive ? '#FFF' : theme.textSecondary,
                  }}>
                    {sec.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Completion Overview</Text>
          <View style={styles.overviewRow}>
            <ProgressRing
              progress={stats.total > 0 ? stats.completed / stats.total : 0}
              size={110}
              strokeWidth={10}
              color={theme.primary}
              trackColor={theme.backgroundSecondary}
            >
              <Text style={[styles.ringPct, { color: theme.textPrimary }]}>{stats.percentage}%</Text>
            </ProgressRing>
            <View style={styles.overviewMetrics}>
              <View style={styles.metricRow}>
                <View style={[styles.metricDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Completed</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{stats.completed}</Text>
              </View>
              <View style={styles.metricRow}>
                <View style={[styles.metricDot, { backgroundColor: theme.error }]} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Remaining</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{stats.total - stats.completed}</Text>
              </View>
              <View style={styles.metricRow}>
                <View style={[styles.metricDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Items</Text>
                <Text style={[styles.metricValue, { color: theme.textPrimary }]}>{stats.total}</Text>
              </View>
            </View>
          </View>
        </View>

        {catEntries.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              {chartType === 'pie' ? 'Completion Distribution' : 'Category Progress'}
            </Text>
            <View style={styles.chartContainer}>
              {chartType === 'pie' ? (
                <PieChart data={pieData} size={170} textColor={theme.textPrimary} />
              ) : (
                <BarChart data={barData} height={180} textColor={theme.textPrimary} trackColor={theme.backgroundSecondary} />
              )}
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Category Breakdown</Text>
          {catEntries.length === 0 ? (
            <Text style={{ color: theme.textTertiary, fontSize: 14, textAlign: 'center', paddingVertical: 20 }}>No items yet</Text>
          ) : (
            catEntries.map(([cat, data]) => {
              const catColor = categoryColors[cat] || categoryColors.general;
              const pctVal = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              return (
                <View key={cat} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: catColor.dot }]} />
                  <Text style={[styles.catName, { color: theme.textPrimary }]}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                  <Text style={[styles.catCount, { color: theme.textSecondary }]}>
                    {data.completed}/{data.total}
                  </Text>
                  <View style={[styles.catBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.catBarFill, { width: `${pctVal}%`, backgroundColor: catColor.dot }]} />
                  </View>
                  <Text style={[styles.catPct, { color: theme.textSecondary }]}>{pctVal}%</Text>
                </View>
              );
            })
          )}
        </View>

        {checklist.sections.length > 0 && !effectiveSectionId ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Section Summary</Text>
            {checklist.sections.map(sec => {
              const secStats = getChecklistStats(checklist.id, sec.id);
              return (
                <Pressable
                  key={sec.id}
                  style={[styles.sectionStatRow, { borderBottomColor: theme.borderLight }]}
                  onPress={() => setSelectedSection(sec.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.secStatName, { color: theme.textPrimary }]}>{sec.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {secStats.completed} of {secStats.total} items
                    </Text>
                  </View>
                  <View style={[styles.secStatBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.secStatBarFill, {
                      width: `${secStats.percentage}%`,
                      backgroundColor: secStats.percentage === 100 ? theme.success : theme.primary,
                    }]} />
                  </View>
                  <Text style={[styles.secStatPct, { color: theme.textPrimary }]}>{secStats.percentage}%</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {stats.partialItems.length > 0 ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.partialHeader}>
              <MaterialIcons name="pending" size={20} color={theme.warning} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0, marginLeft: 8 }]}>
                Partially Complete ({stats.partialItems.length})
              </Text>
            </View>
            {stats.partialItems.map(item => {
              const pctVal = Math.round((item.ownedQty / item.requiredQty) * 100);
              return (
                <View key={item.id} style={[styles.partialRow, { borderBottomColor: theme.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {item.ownedQty} of {item.requiredQty} ({pctVal}%)
                    </Text>
                  </View>
                  <View style={[styles.partialBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.partialBarFill, { width: `${pctVal}%`, backgroundColor: theme.warning }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  ringPct: { fontSize: 26, fontWeight: '700' },
  overviewMetrics: { flex: 1, gap: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricLabel: { flex: 1, fontSize: 14 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  chartContainer: { alignItems: 'center', paddingVertical: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { fontSize: 14, fontWeight: '500', width: 80 },
  catCount: { fontSize: 12, width: 40, textAlign: 'center' },
  catBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: 6, borderRadius: 3 },
  catPct: { fontSize: 12, width: 36, textAlign: 'right' },
  sectionStatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  secStatName: { fontSize: 14, fontWeight: '600' },
  secStatBar: { width: 60, height: 6, borderRadius: 3, overflow: 'hidden' },
  secStatBarFill: { height: 6, borderRadius: 3 },
  secStatPct: { fontSize: 14, fontWeight: '700', width: 40, textAlign: 'right' },
  partialHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  partialRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1 },
  partialBar: { width: 60, height: 6, borderRadius: 3, overflow: 'hidden' },
  partialBarFill: { height: 6, borderRadius: 3 },
});
