import React, { useState, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, Layout } from 'react-native-reanimated';
import { colors, categoryColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { ChecklistItem, ItemStatus, DEFAULT_ITEM_STATUSES } from '../../services/mockData';
import StatsView from '../../components/feature/StatsView';
import ItemEditModal from '../../components/feature/ItemEditModal';
import CSVImportModal from '../../components/feature/CSVImportModal';
import ShareChecklistModal from '../../components/feature/ShareChecklistModal';
import PageHeader from '../../components/layout/PageHeader';
import SegmentedBar from '../../components/ui/SegmentedBar';
import { exportAsCSV, exportAsText } from '../../services/checklistExport';
import { Modal, TextInput, Alert } from 'react-native';

function copyToClipboard(text: string) {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const { Clipboard } = require('react-native');
      Clipboard?.setString?.(text);
    }
  } catch {}
}

export default function ChecklistScreen() {
  const {
    settings, isDark, viewMode, setViewMode,
    getActiveChecklist,
    toggleItemCheck, setItemStatus, deleteItem,
    addSection, deleteSection, toggleSectionExpand,
    updateChecklist, addItem, updateItem,
  } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isMobile, isDesktop, contentPadding } = useResponsive();

  const checklist = getActiveChecklist();

  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showChecklistSettings, setShowChecklistSettings] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showStatusPicker, setShowStatusPicker] = useState<string | null>(null);
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6B7280');
  const [newStatusIsDone, setNewStatusIsDone] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportCopied, setExportCopied] = useState('');

  const STATUS_COLORS = ['#6B7280', '#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

  // On desktop, this screen is hidden (everything is in index.tsx three-panel)
  // This screen is only for mobile

  if (!checklist) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <PageHeader title="Checklist" icon="checklist" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <MaterialIcons name="checklist" size={56} color={theme.textTertiary} />
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 12 }}>No Checklist Selected</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' }}>Open a checklist from the Folders tab</Text>
        </View>
      </SafeAreaView>
    );
  }

  const activeStatuses = checklist.settings.itemStatuses ?? [];
  const useStatuses = activeStatuses.length > 0;
  const completedCount = checklist.items.filter(i => {
    if (useStatuses && i.status) return activeStatuses.find(st => st.id === i.status)?.isDone ?? false;
    return i.checked;
  }).length;
  const totalCount = checklist.items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const shareRole = checklist.shareRole ?? 'owner';
  const canEditItems = shareRole === 'owner' || shareRole === 'edit';
  const canCheckItems = shareRole === 'owner' || shareRole === 'edit' || shareRole === 'check';
  const canStructure = shareRole === 'owner' || shareRole === 'edit';
  const canShare = shareRole === 'owner' || shareRole === 'edit';

  const segmentData = useMemo(() => {
    if (useStatuses) {
      return activeStatuses.map(st => ({
        label: st.label,
        value: checklist.items.filter(i => (i.status ?? activeStatuses[0]?.id) === st.id).length,
        color: st.color,
      }));
    }
    return [
      { label: 'Done', value: completedCount, color: theme.success },
      { label: 'Remaining', value: totalCount - completedCount, color: theme.border },
    ];
  }, [checklist, useStatuses, activeStatuses, completedCount, totalCount, theme]);

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    addSection(checklist.id, newSectionName.trim());
    setNewSectionName(''); setShowAddSection(false);
  };

  const handleExportCSV = () => {
    copyToClipboard(exportAsCSV(checklist));
    setExportCopied('csv'); setTimeout(() => setExportCopied(''), 2000);
  };

  const handleExportText = () => {
    copyToClipboard(exportAsText(checklist));
    setExportCopied('text'); setTimeout(() => setExportCopied(''), 2000);
  };

  const renderToggle = (value: boolean, onToggle: () => void) => (
    <Pressable style={[styles.toggleSwitch, { backgroundColor: value ? theme.primary : theme.backgroundSecondary }]} onPress={onToggle}>
      <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
    </Pressable>
  );

  const renderItem = (item: ChecklistItem, index: number) => {
    const catColor = categoryColors[item.category] || categoryColors.general;
    const currentStatus = useStatuses ? activeStatuses.find(st => st.id === (item.status ?? activeStatuses[0]?.id)) : undefined;
    const isEffectivelyDone = currentStatus ? currentStatus.isDone : item.checked;

    return (
      <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index * 20, 200)).duration(200)} layout={Layout.springify()}>
        <Pressable style={[styles.itemCard, { backgroundColor: theme.surface, borderColor: isEffectivelyDone ? theme.success + '40' : theme.border, borderLeftColor: catColor.dot, borderLeftWidth: 4 }]}>
          <View style={styles.itemRow}>
            {useStatuses ? (
              <Pressable style={[styles.statusDropdown, { borderColor: currentStatus?.color ?? '#6B7280' }]} onPress={() => { if (canCheckItems) setShowStatusPicker(item.id); }}>
                <View style={[styles.statusDotSm, { backgroundColor: currentStatus?.color ?? '#6B7280' }]} />
                <Text style={{ color: currentStatus?.color ?? '#6B7280', fontSize: 11, fontWeight: '700', flex: 1 }} numberOfLines={1}>{currentStatus?.label ?? ''}</Text>
                <MaterialIcons name="arrow-drop-down" size={16} color={currentStatus?.color ?? '#6B7280'} />
              </Pressable>
            ) : (
              <Pressable style={[styles.checkbox, { backgroundColor: item.checked ? theme.success : 'transparent', borderColor: item.checked ? theme.success : theme.textTertiary, opacity: canCheckItems ? 1 : 0.55 }]}
                onPress={() => { if (canCheckItems) toggleItemCheck(checklist.id, item.id); }}>
                {item.checked ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.itemNameRow}>
                <Text style={[styles.itemName, { color: isEffectivelyDone ? theme.textTertiary : theme.textPrimary, textDecorationLine: isEffectivelyDone ? 'line-through' : 'none' }]} numberOfLines={2}>{item.name}</Text>
                <View style={[styles.catBadge, { backgroundColor: catColor.bg }]}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: catColor.dot }} />
                  <Text style={{ color: catColor.text, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>{item.category}</Text>
                </View>
              </View>
              {item.description ? <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{item.description}</Text> : null}
              {checklist.settings.enableQuantity && item.requiredQty > 0 ? (
                <View style={styles.qtyRow}>
                  <View style={[styles.qtyBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={{ height: 4, borderRadius: 2, width: `${Math.min((item.ownedQty / item.requiredQty) * 100, 100)}%`, backgroundColor: item.ownedQty >= item.requiredQty ? theme.success : theme.warning }} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{item.ownedQty}/{item.requiredQty}</Text>
                </View>
              ) : null}
              {checklist.settings.enableNotes && item.notes ? (
                <>
                  <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }} onPress={() => toggleNoteExpand(item.id)}>
                    <MaterialIcons name={expandedNotes.has(item.id) ? 'expand-less' : 'notes'} size={14} color={theme.textTertiary} />
                    <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{expandedNotes.has(item.id) ? 'Hide' : 'Notes'}</Text>
                  </Pressable>
                  {expandedNotes.has(item.id) ? (
                    <Animated.View entering={FadeIn.duration(200)} style={[styles.notesBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{item.notes}</Text>
                    </Animated.View>
                  ) : null}
                </>
              ) : null}
            </View>
            {canEditItems ? (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable style={{ padding: 4 }} onPress={() => setEditingItem(item)} hitSlop={8}><MaterialIcons name="edit" size={16} color={theme.textTertiary} /></Pressable>
                <Pressable style={{ padding: 4 }} onPress={() => deleteItem(checklist.id, item.id)} hitSlop={8}><MaterialIcons name="close" size={16} color={theme.error + '80'} /></Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSections = () => {
    if (!checklist.settings.enableSections || checklist.sections.length === 0) {
      return checklist.items.map((item, idx) => renderItem(item, idx));
    }
    const unsectioned = checklist.items.filter(i => !i.sectionId);
    return (
      <>
        {checklist.sections.sort((a, b) => a.order - b.order).map((sec, secIdx) => {
          const sItems = checklist.items.filter(i => i.sectionId === sec.id);
          const secDone = sItems.filter(i => { if (useStatuses && i.status) return activeStatuses.find(st => st.id === i.status)?.isDone ?? false; return i.checked; }).length;
          const secPct = sItems.length > 0 ? Math.round((secDone / sItems.length) * 100) : 0;
          return (
            <Animated.View key={sec.id} entering={FadeInDown.delay(secIdx * 40).duration(200)} style={{ marginBottom: 4 }}>
              <Pressable style={[styles.sectionHeader, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => toggleSectionExpand(checklist.id, sec.id)}>
                <MaterialIcons name={sec.expanded ? 'expand-more' : 'chevron-right'} size={22} color={theme.textSecondary} />
                <Text style={[styles.sectionName, { color: theme.textPrimary }]}>{sec.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{secDone}/{sItems.length}</Text>
                <View style={[styles.secBar, { backgroundColor: theme.backgroundSecondary }]}><View style={{ height: 3, borderRadius: 2, width: `${secPct}%`, backgroundColor: secPct === 100 ? theme.success : theme.primary }} /></View>
                <Text style={{ color: secPct === 100 ? theme.success : theme.textSecondary, fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' }}>{secPct}%</Text>
                {canStructure ? <Pressable onPress={() => deleteSection(checklist.id, sec.id)} hitSlop={8}><MaterialIcons name="close" size={16} color={theme.error + '60'} /></Pressable> : null}
              </Pressable>
              {sec.expanded ? (
                <Animated.View entering={FadeIn.duration(200)}>
                  {sItems.length === 0 ? <View style={[styles.secEmpty, { borderColor: theme.border }]}><Text style={{ color: theme.textTertiary, fontSize: 13 }}>No items</Text></View> : sItems.map((item, idx) => renderItem(item, idx))}
                </Animated.View>
              ) : null}
            </Animated.View>
          );
        })}
        {unsectioned.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <MaterialIcons name="inbox" size={18} color={theme.textSecondary} />
              <Text style={[styles.sectionName, { color: theme.textSecondary }]}>Unsorted</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{unsectioned.length}</Text>
            </View>
            {unsectioned.map((item, idx) => renderItem(item, idx))}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <PageHeader
        title={checklist.name}
        subtitle={checklist.description || `${completedCount}/${totalCount} items`}
        icon="checklist"
        rightAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {canShare ? <Pressable onPress={() => setShowShareModal(true)} hitSlop={8} style={[styles.hdrBtn, { backgroundColor: theme.primaryBg }]}><MaterialIcons name="share" size={18} color={theme.primary} /></Pressable> : null}
            <Pressable onPress={() => setShowExport(true)} hitSlop={8} style={[styles.hdrBtn, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="file-download" size={18} color={theme.textSecondary} /></Pressable>
            {canStructure ? <Pressable onPress={() => setShowChecklistSettings(true)} hitSlop={8} style={[styles.hdrBtn, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="tune" size={18} color={theme.textSecondary} /></Pressable> : null}
          </View>
        }
      />

      {/* Segmented bar */}
      <View style={{ paddingHorizontal: contentPadding, paddingTop: 10, paddingBottom: 4 }}>
        <SegmentedBar segments={segmentData} height={20} borderRadius={6} showLabels={true} textColor={theme.textSecondary} trackColor={theme.backgroundSecondary} />
      </View>

      {/* View toggle */}
      <View style={{ paddingHorizontal: contentPadding, paddingTop: 6 }}>
        <View style={[styles.toggleRow, { backgroundColor: theme.backgroundSecondary }]}>
          {(['interactive', 'stats'] as const).map(mode => (
            <Pressable key={mode} style={[styles.toggleBtn, { backgroundColor: viewMode === mode ? theme.primary : 'transparent' }]} onPress={() => setViewMode(mode)}>
              <MaterialIcons name={mode === 'interactive' ? 'list' : 'bar-chart'} size={16} color={viewMode === mode ? '#FFF' : theme.textSecondary} />
              <Text style={{ color: viewMode === mode ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4, textTransform: 'capitalize' }}>{mode}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {viewMode === 'stats' ? <StatsView checklist={checklist} /> : (
        <>
          {canStructure ? (
            <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: contentPadding, paddingVertical: 8 }}>
              <Pressable style={[styles.actBtn, { backgroundColor: theme.primary }]} onPress={() => setShowAddItem(true)}>
                <MaterialIcons name="add" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Add Item</Text>
              </Pressable>
              {checklist.settings.enableSections ? (
                <Pressable style={[styles.actBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={() => setShowAddSection(true)}>
                  <MaterialIcons name="playlist-add" size={16} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Section</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.actBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setShowCSVImport(true)}>
                <MaterialIcons name="upload-file" size={16} color={theme.textSecondary} /><Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>CSV</Text>
              </Pressable>
            </View>
          ) : null}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
            {totalCount === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 20 }]}>
                <MaterialIcons name="add-task" size={48} color={theme.textTertiary} />
                <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600', marginTop: 12 }}>Start adding items</Text>
              </View>
            ) : renderSections()}
          </ScrollView>
        </>
      )}

      {/* Add Section Modal */}
      <Modal visible={showAddSection} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Section</Text><Pressable onPress={() => setShowAddSection(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable></View>
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newSectionName} onChangeText={setNewSectionName} placeholder="Section name" placeholderTextColor={theme.textTertiary} autoFocus />
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: newSectionName.trim() ? 1 : 0.5 }]} onPress={handleAddSection} disabled={!newSectionName.trim()}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add Section</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status picker */}
      <Modal visible={!!showStatusPicker} animationType="fade" transparent>
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowStatusPicker(null)}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, margin: 24, borderRadius: 20 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Set Status</Text><Pressable onPress={() => setShowStatusPicker(null)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable></View>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {activeStatuses.map(st => {
                const itemId = showStatusPicker!;
                const item = checklist.items.find(i => i.id === itemId);
                const isActive = (item?.status ?? activeStatuses[0]?.id) === st.id;
                return (
                  <Pressable key={st.id} style={[styles.statusPickerRow, { backgroundColor: isActive ? st.color + '22' : theme.backgroundSecondary, borderColor: isActive ? st.color : theme.border }]}
                    onPress={() => { setItemStatus(checklist.id, itemId, st.id); setShowStatusPicker(null); }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color }} />
                    <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 }}>{st.label}</Text>
                    {st.isDone ? <Text style={{ color: theme.success, fontSize: 11, fontWeight: '700' }}>Done</Text> : null}
                    {isActive ? <MaterialIcons name="check-circle" size={18} color={st.color} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Checklist settings */}
      <Modal visible={showChecklistSettings} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, maxHeight: '80%' }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Settings</Text><Pressable onPress={() => setShowChecklistSettings(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable></View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {([{ key: 'enableQuantity', label: 'Quantity', icon: 'tag' as const }, { key: 'enableNotes', label: 'Notes', icon: 'notes' as const }, { key: 'enableImages', label: 'Images', icon: 'image' as const }, { key: 'enableSections', label: 'Sections', icon: 'view-list' as const }] as const).map(opt => (
                <Pressable key={opt.key} style={[styles.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => updateChecklist(checklist.id, { settings: { ...checklist.settings, [opt.key]: !checklist.settings[opt.key] } })}>
                  <MaterialIcons name={opt.icon} size={20} color={theme.textSecondary} />
                  <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>{opt.label}</Text>
                  {renderToggle(checklist.settings[opt.key], () => {})}
                </Pressable>
              ))}
              <Pressable style={[styles.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => { const next = useStatuses ? [] : [...DEFAULT_ITEM_STATUSES]; updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: next } }); }}>
                <MaterialIcons name="label" size={20} color={theme.textSecondary} />
                <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>Custom Statuses</Text>
                {renderToggle(useStatuses, () => {})}
              </Pressable>
              {useStatuses ? (
                <View style={{ marginTop: 8, marginBottom: 16 }}>
                  {activeStatuses.map(st => (
                    <View key={st.id} style={[styles.statusEditRow, { borderColor: theme.border }]}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: st.color }} />
                      <Text style={{ color: theme.textPrimary, fontSize: 13, flex: 1 }}>{st.label}</Text>
                      {st.isDone ? <View style={[styles.doneBadge, { backgroundColor: theme.successBg }]}><Text style={{ color: theme.success, fontSize: 9, fontWeight: '700' }}>DONE</Text></View> : null}
                      <Pressable onPress={() => updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: activeStatuses.filter(x => x.id !== st.id) } })} hitSlop={8}>
                        <MaterialIcons name="remove-circle-outline" size={18} color={theme.error} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable style={[styles.addStatusBtn, { borderColor: theme.primary }]} onPress={() => { setNewStatusLabel(''); setNewStatusColor(STATUS_COLORS[activeStatuses.length % STATUS_COLORS.length]); setNewStatusIsDone(false); setShowAddStatus(true); }}>
                    <MaterialIcons name="add" size={16} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Add Status</Text>
                  </Pressable>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Status */}
      <Modal visible={showAddStatus} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Status</Text><Pressable onPress={() => setShowAddStatus(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable></View>
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newStatusLabel} onChangeText={setNewStatusLabel} placeholder="Status label" placeholderTextColor={theme.textTertiary} autoFocus />
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>{STATUS_COLORS.map(c => <Pressable key={c} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: newStatusColor === c ? 3 : 0, borderColor: theme.textPrimary }} onPress={() => setNewStatusColor(c)} />)}</View>
              <Pressable style={[styles.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => setNewStatusIsDone(v => !v)}>
                <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1 }}>Counts as completed</Text>
                {renderToggle(newStatusIsDone, () => setNewStatusIsDone(v => !v))}
              </Pressable>
              <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: newStatusLabel.trim() ? 1 : 0.5, marginTop: 12 }]} onPress={() => {
                if (!newStatusLabel.trim()) return;
                const id = newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36);
                updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: [...activeStatuses, { id, label: newStatusLabel.trim(), color: newStatusColor, isDone: newStatusIsDone }] } });
                setShowAddStatus(false);
              }} disabled={!newStatusLabel.trim()}>
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add Status</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Export */}
      <Modal visible={showExport} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Export</Text><Pressable onPress={() => setShowExport(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable></View>
            <View style={{ paddingHorizontal: 20, gap: 10 }}>
              <Pressable style={[styles.exportBtn, { backgroundColor: theme.primary }]} onPress={handleExportCSV}>
                <MaterialIcons name="table-chart" size={20} color="#FFF" />
                <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Copy as CSV</Text></View>
                {exportCopied === 'csv' ? <MaterialIcons name="check" size={20} color="#FFF" /> : <MaterialIcons name="content-copy" size={18} color="#FFF" />}
              </Pressable>
              <Pressable style={[styles.exportBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={handleExportText}>
                <MaterialIcons name="description" size={20} color={theme.primary} />
                <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>Copy as Text</Text></View>
                {exportCopied === 'text' ? <MaterialIcons name="check" size={20} color={theme.primary} /> : <MaterialIcons name="content-copy" size={18} color={theme.primary} />}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ItemEditModal visible={showAddItem || !!editingItem} onClose={() => { setShowAddItem(false); setEditingItem(null); }} checklistId={checklist.id} item={editingItem} sections={checklist.sections} enableQuantity={checklist.settings.enableQuantity} enableNotes={checklist.settings.enableNotes} enableImages={checklist.settings.enableImages} defaultCategory={checklist.settings.defaultCategory} />
      <CSVImportModal visible={showCSVImport} onClose={() => setShowCSVImport(false)} checklistId={checklist.id} />
      <ShareChecklistModal visible={showShareModal} onClose={() => setShowShareModal(false)} checklist={checklist} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hdrBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  toggleRow: { flexDirection: 'row', gap: 4, borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  itemCard: { borderRadius: 10, marginBottom: 4, borderWidth: 1, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  statusDropdown: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, minWidth: 70, maxWidth: 100, marginTop: 1 },
  statusDotSm: { width: 7, height: 7, borderRadius: 4 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemName: { fontSize: 14, fontWeight: '600', flex: 1 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  qtyBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  notesBox: { marginTop: 4, padding: 8, borderRadius: 6, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 4, borderWidth: 1 },
  sectionName: { fontSize: 13, fontWeight: '700', flex: 1 },
  secBar: { width: 40, height: 3, borderRadius: 2, overflow: 'hidden' },
  secEmpty: { paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, marginBottom: 4 },
  emptyCard: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  toggleSwitch: { width: 42, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },
  statusEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  doneBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginRight: 4 },
  addStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  statusPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  input: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, marginBottom: 12 },
  primaryBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
