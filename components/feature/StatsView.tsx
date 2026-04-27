import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, categoryColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Checklist } from '../../services/mockData';
import ProgressRing from '../ui/ProgressRing';
import PieChart from '../ui/PieChart';
import BarChart from '../ui/BarChart';
import SegmentedBar from '../ui/SegmentedBar';

interface StatsViewProps {
  checklist: Checklist;
}

export default function StatsView({ checklist }: StatsViewProps) {
  const { settings, isDark, getChecklistStats } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const chartType = checklist.settings.chartTypeOverride || settings.chartType;

  const [selectedSection, setSelectedSection] = useState<string | null>(null);

  const allSections = [{ id: '__all__', name: 'All Sections' }, ...checklist.sections];

  const effectiveSectionId = selectedSection === '__all__' || selectedSection === null ? undefined : selectedSection;
  const stats = getChecklistStats(checklist.id, effectiveSectionId);

  const useStatuses = (checklist.settings.itemStatuses?.length ?? 0) > 0;
  const statuses = checklist.settings.itemStatuses ?? [];

  const statusBreakdown = useMemo(() => {
    if (!useStatuses) return null;
    const items = effectiveSectionId ? checklist.items.filter(i => i.sectionId === effectiveSectionId) : checklist.items;
    const counts = new Map<string, number>();
    for (const st of statuses) counts.set(st.id, 0);
    for (const item of items) {
      const sid = item.status ?? statuses[0]?.id;
      if (sid) counts.set(sid, (counts.get(sid) ?? 0) + 1);
    }
    return statuses.map(st => ({ id: st.id, label: st.label, color: st.color, isDone: st.isDone, count: counts.get(st.id) ?? 0 }));
  }, [checklist.items, statuses, useStatuses, effectiveSectionId]);

  const segmentData = useMemo(() => {
    if (statusBreakdown) return statusBreakdown.map(s => ({ label: s.label, value: s.count, color: s.color }));
    return [
      { label: 'Done', value: stats.completed, color: theme.success },
      { label: 'Remaining', value: stats.total - stats.completed, color: theme.border },
    ];
  }, [statusBreakdown, stats, theme]);

  const pieData = useMemo(() => {
    if (statusBreakdown) return statusBreakdown.filter(s => s.count > 0).map(s => ({ label: s.label, value: s.count, color: s.color }));
    return [
      { label: 'Completed', value: stats.completed, color: theme.success },
      { label: 'Remaining', value: stats.total - stats.completed, color: theme.border },
    ];
  }, [statusBreakdown, stats, theme]);

  const catEntries = Object.entries(stats.categoryBreakdown);

  return (
    <View style={{ flex: 1 }}>
      {checklist.sections.length > 0 ? (
        <View style={{ marginBottom: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
            {allSections.map(sec => {
              const isActive = (selectedSection || '__all__') === sec.id;
              return (
                <Pressable key={sec.id} style={[styles.sectionChip, { backgroundColor: isActive ? theme.primary : theme.surface, borderColor: isActive ? theme.primary : theme.border }]} onPress={() => setSelectedSection(sec.id)}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: isActive ? '#FFF' : theme.textSecondary }}>{sec.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Segmented bar overview */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Progress Overview</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 20, fontWeight: '700' }}>{stats.percentage}%</Text>
          </View>
          <SegmentedBar segments={segmentData} height={24} borderRadius={8} showLabels={true} textColor={theme.textSecondary} trackColor={theme.backgroundSecondary} />
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.success }} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Done {stats.completed}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.error }} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Remaining {stats.total - stats.completed}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary }} />
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Total {stats.total}</Text>
            </View>
          </View>
        </Animated.View>

        {/* Status breakdown */}
        {statusBreakdown ? (
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Status Breakdown</Text>
            {chartType === 'pie' ? (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <PieChart data={pieData} size={160} textColor={theme.textPrimary} />
              </View>
            ) : (
              <SegmentedBar segments={segmentData} height={28} borderRadius={8} showLabels={false} trackColor={theme.backgroundSecondary} />
            )}
            <View style={{ marginTop: 12, gap: 8 }}>
              {statusBreakdown.map((st, idx) => (
                <Animated.View key={st.id} entering={FadeIn.delay(idx * 40).duration(200)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color }} />
                  <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 }}>{st.label}</Text>
                  {st.isDone ? <View style={{ backgroundColor: theme.successBg, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}><Text style={{ color: theme.success, fontSize: 9, fontWeight: '700' }}>DONE</Text></View> : null}
                  <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700', width: 28, textAlign: 'right' }}>{st.count}</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 11, width: 36, textAlign: 'right' }}>{stats.total > 0 ? Math.round((st.count / stats.total) * 100) : 0}%</Text>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {/* Category breakdown */}
        {catEntries.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(statusBreakdown ? 150 : 100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{statusBreakdown ? 'Category Breakdown' : 'Categories'}</Text>
            {!statusBreakdown && chartType === 'pie' ? (
              <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                <PieChart data={pieData} size={160} textColor={theme.textPrimary} />
              </View>
            ) : null}
            {catEntries.map(([cat, data], idx) => {
              const catColor = categoryColors[cat] || categoryColors.general;
              const pctVal = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              return (
                <Animated.View key={cat} entering={FadeIn.delay(idx * 40).duration(200)} style={styles.catRow}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor.dot }} />
                  <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '500', width: 70, textTransform: 'capitalize' }}>{cat}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, width: 36, textAlign: 'center' }}>{data.completed}/{data.total}</Text>
                  <View style={[styles.catBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={{ height: 5, borderRadius: 3, width: `${pctVal}%`, backgroundColor: catColor.dot }} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, width: 32, textAlign: 'right' }}>{pctVal}%</Text>
                </Animated.View>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Section summary */}
        {checklist.sections.length > 0 && !effectiveSectionId ? (
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Sections</Text>
            {checklist.sections.map((sec, idx) => {
              const secStats = getChecklistStats(checklist.id, sec.id);
              return (
                <Pressable key={sec.id} style={[styles.secRow, { borderBottomColor: theme.borderLight }]} onPress={() => setSelectedSection(sec.id)}>
                  <View style={{ flex: 1 }}><Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '600' }}>{sec.name}</Text><Text style={{ color: theme.textSecondary, fontSize: 11 }}>{secStats.completed}/{secStats.total}</Text></View>
                  <View style={[styles.secBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={{ height: 5, borderRadius: 3, width: `${secStats.percentage}%`, backgroundColor: secStats.percentage === 100 ? theme.success : theme.primary }} />
                  </View>
                  <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' }}>{secStats.percentage}%</Text>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}

        {/* Partial items */}
        {stats.partialItems.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <MaterialIcons name="pending" size={18} color={theme.warning} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 0 }]}>Partial ({stats.partialItems.length})</Text>
            </View>
            {stats.partialItems.map((item, idx) => {
              const p = Math.round((item.ownedQty / item.requiredQty) * 100);
              return (
                <View key={item.id} style={[styles.partialRow, { borderBottomColor: theme.borderLight }]}>
                  <View style={{ flex: 1 }}><Text style={{ color: theme.textPrimary, fontSize: 13 }}>{item.name}</Text><Text style={{ color: theme.textSecondary, fontSize: 11 }}>{item.ownedQty}/{item.requiredQty}</Text></View>
                  <View style={[styles.partialBar, { backgroundColor: theme.backgroundSecondary }]}><View style={{ height: 5, borderRadius: 3, width: `${p}%`, backgroundColor: theme.warning }} /></View>
                </View>
              );
            })}
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catBar: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  secBar: { width: 50, height: 5, borderRadius: 3, overflow: 'hidden' },
  partialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1 },
  partialBar: { width: 50, height: 5, borderRadius: 3, overflow: 'hidden' },
});
