import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { colors, categoryColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Checklist, ItemStatus } from '../../services/mockData';
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

  const useStatuses = (checklist.settings.itemStatuses?.length ?? 0) > 0;
  const statuses = checklist.settings.itemStatuses ?? [];

  // Build status breakdown data
  const statusBreakdown = useMemo(() => {
    if (!useStatuses) return null;
    const items = effectiveSectionId
      ? checklist.items.filter(i => i.sectionId === effectiveSectionId)
      : checklist.items;

    const counts = new Map<string, number>();
    for (const st of statuses) {
      counts.set(st.id, 0);
    }
    for (const item of items) {
      const sid = item.status ?? statuses[0]?.id;
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    return statuses.map(st => ({
      id: st.id,
      label: st.label,
      color: st.color,
      isDone: st.isDone,
      count: counts.get(st.id) ?? 0,
    }));
  }, [checklist.items, statuses, useStatuses, effectiveSectionId]);

  const catEntries = Object.entries(stats.categoryBreakdown);

  // Pie/bar data: use status breakdown when available, otherwise completion
  const pieData = useMemo(() => {
    if (statusBreakdown) {
      return statusBreakdown
        .filter(s => s.count > 0)
        .map(s => ({ label: s.label, value: s.count, color: s.color }));
    }
    return [
      { label: 'Completed', value: stats.completed, color: theme.success },
      { label: 'Remaining', value: stats.total - stats.completed, color: theme.border },
    ];
  }, [statusBreakdown, stats, theme]);

  const barData = useMemo(() => {
    if (statusBreakdown) {
      return statusBreakdown.map(s => ({
        label: s.label,
        value: s.count,
        maxValue: stats.total,
        color: s.color,
      }));
    }
    return catEntries.map(([cat, data]) => ({
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      value: data.completed,
      maxValue: data.total,
      color: categoryColors[cat]?.dot || theme.primary,
    }));
  }, [statusBreakdown, catEntries, stats, theme]);

  return (
    <View style={{ flex: 1 }}>
      {checklist.sections.length > 0 ? (
        <View style={{ marginBottom: 12 }}>
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
        {/* Completion Overview */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
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
        </Animated.View>

        {/* Status Breakdown — when custom statuses are enabled */}
        {statusBreakdown ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Status Breakdown</Text>
            <View style={styles.chartContainer}>
              {chartType === 'pie' ? (
                <PieChart data={pieData} size={170} textColor={theme.textPrimary} />
              ) : (
                <BarChart data={barData} height={180} textColor={theme.textPrimary} trackColor={theme.backgroundSecondary} />
              )}
            </View>
            {/* Status legend */}
            <View style={styles.statusLegend}>
              {statusBreakdown.map((st, idx) => (
                <Animated.View
                  key={st.id}
                  entering={FadeIn.delay(idx * 60).duration(200)}
                  style={styles.statusLegendRow}
                >
                  <View style={[styles.statusLegendDot, { backgroundColor: st.color }]} />
                  <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '500', flex: 1 }}>
                    {st.label}
                  </Text>
                  {st.isDone ? (
                    <View style={[styles.doneBadge, { backgroundColor: theme.successBg }]}>
                      <Text style={{ color: theme.success, fontSize: 10, fontWeight: '700' }}>DONE</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '700', minWidth: 28, textAlign: 'right' }}>
                    {st.count}
                  </Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 12, width: 40, textAlign: 'right' }}>
                    {stats.total > 0 ? Math.round((st.count / stats.total) * 100) : 0}%
                  </Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Category chart — shown when no custom statuses OR as secondary */}
        {catEntries.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(statusBreakdown ? 150 : 100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              {!statusBreakdown ? (chartType === 'pie' ? 'Completion Distribution' : 'Category Progress') : 'Category Breakdown'}
            </Text>
            {!statusBreakdown ? (
              <View style={styles.chartContainer}>
                {chartType === 'pie' ? (
                  <PieChart data={pieData} size={170} textColor={theme.textPrimary} />
                ) : (
                  <BarChart
                    data={catEntries.map(([cat, data]) => ({
                      label: cat.charAt(0).toUpperCase() + cat.slice(1),
                      value: data.completed,
                      maxValue: data.total,
                      color: categoryColors[cat]?.dot || theme.primary,
                    }))}
                    height={180}
                    textColor={theme.textPrimary}
                    trackColor={theme.backgroundSecondary}
                  />
                )}
              </View>
            ) : null}
            {catEntries.map(([cat, data], idx) => {
              const catColor = categoryColors[cat] || categoryColors.general;
              const pctVal = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              return (
                <Animated.View key={cat} entering={FadeIn.delay(idx * 50).duration(200)} style={styles.catRow}>
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
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Section summary */}
        {checklist.sections.length > 0 && !effectiveSectionId ? (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Section Summary</Text>
            {checklist.sections.map((sec, idx) => {
              const secStats = getChecklistStats(checklist.id, sec.id);
              return (
                <Animated.View key={sec.id} entering={FadeIn.delay(idx * 60).duration(200)}>
                  <Pressable
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
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Partial items */}
        {stats.partialItems.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.partialHeader}>
              <MaterialIcons name="pending" size={20} color={theme.warning} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0, marginLeft: 8 }]}>
                Partially Complete ({stats.partialItems.length})
              </Text>
            </View>
            {stats.partialItems.map((item, idx) => {
              const pctVal = Math.round((item.ownedQty / item.requiredQty) * 100);
              return (
                <Animated.View key={item.id} entering={FadeIn.delay(idx * 50).duration(200)} style={[styles.partialRow, { borderBottomColor: theme.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '500' }}>{item.name}</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                      {item.ownedQty} of {item.requiredQty} ({pctVal}%)
                    </Text>
                  </View>
                  <View style={[styles.partialBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.partialBarFill, { width: `${pctVal}%`, backgroundColor: theme.warning }]} />
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  ringPct: { fontSize: 26, fontWeight: '700' },
  overviewMetrics: { flex: 1, gap: 12 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricDot: { width: 10, height: 10, borderRadius: 5 },
  metricLabel: { flex: 1, fontSize: 14 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  chartContainer: { alignItems: 'center', paddingVertical: 8 },
  statusLegend: { marginTop: 12, gap: 8 },
  statusLegendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusLegendDot: { width: 12, height: 12, borderRadius: 6 },
  doneBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 4 },
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
