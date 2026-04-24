import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Alert, Platform, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, Layout, SlideInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, categoryColors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { ChecklistItem, Section, ItemStatus, DEFAULT_ITEM_STATUSES } from '../../services/mockData';
import StatsView from '../../components/feature/StatsView';
import ItemEditModal from '../../components/feature/ItemEditModal';
import CSVImportModal from '../../components/feature/CSVImportModal';
import ShareChecklistModal from '../../components/feature/ShareChecklistModal';

export default function ChecklistScreen() {
  const {
    settings, viewMode, setViewMode,
    getActiveChecklist,
    toggleItemCheck, setItemStatus, deleteItem,
    addSection, deleteSection, toggleSectionExpand, updateSection,
    updateChecklist,
  } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isMobile, contentPadding, itemHeight } = useResponsive();

  const checklist = getActiveChecklist();

  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showChecklistSettings, setShowChecklistSettings] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [showStatusPicker, setShowStatusPicker] = useState<string | null>(null); // itemId
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState('#6B7280');
  const [newStatusIsDone, setNewStatusIsDone] = useState(false);

  const STATUS_COLORS = ['#6B7280','#F59E0B','#3B82F6','#10B981','#EF4444','#8B5CF6','#EC4899','#06B6D4'];

  const activeStatuses = checklist?.settings.itemStatuses ?? [];

  if (!checklist) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="checklist" size={64} color={theme.textTertiary} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No Checklist Selected</Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            Open a checklist from the Folders tab
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const useStatuses = activeStatuses.length > 0;
  const completedCount = checklist.items.filter(i => {
    if (useStatuses && i.status) return activeStatuses.find(s => s.id === i.status)?.isDone ?? false;
    return i.checked;
  }).length;
  const totalCount = checklist.items.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const shareRole = checklist.shareRole ?? 'owner';
  const isOwner = shareRole === 'owner';
  const canEditItems = isOwner || shareRole === 'edit';
  const canCheckItems = isOwner || shareRole === 'edit' || shareRole === 'check';
  const canStructure = isOwner || shareRole === 'edit';
  const canShare = isOwner || shareRole === 'edit';

  const shareBannerLabel =
    shareRole === 'view' ? 'View only — shared checklist' :
      shareRole === 'check' ? 'Check only — you can mark items done' :
        shareRole === 'edit' ? 'Edit access — shared checklist' : null;

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    addSection(checklist.id, newSectionName.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewSectionName('');
    setShowAddSection(false);
  };

  const renderItem = (item: ChecklistItem) => {
    const catColor = categoryColors[item.category] || categoryColors.general;
    const isPartial = checklist.settings.enableQuantity && item.requiredQty > 0 && item.ownedQty > 0 && item.ownedQty < item.requiredQty;
    const hasNotes = checklist.settings.enableNotes && item.notes;
    const notesExpanded = expandedNotes.has(item.id);

    // Status system
    const currentStatus: ItemStatus | undefined = useStatuses
      ? activeStatuses.find(s => s.id === (item.status ?? activeStatuses[0]?.id))
      : undefined;
    const isEffectivelyDone = currentStatus ? currentStatus.isDone : item.checked;

    return (
      <Animated.View key={item.id} entering={FadeIn.duration(200)} layout={Layout.springify()}>
        <Pressable
          style={[styles.itemCard, {
            backgroundColor: theme.surface,
            borderColor: isEffectivelyDone ? theme.success + '40' : theme.border,
            borderLeftColor: catColor.dot,
            borderLeftWidth: 4,
            minHeight: isMobile ? Math.min(itemHeight, 140) : 80,
          }]}
          onLongPress={() => {
            if (!canEditItems) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteItem(checklist.id, item.id);
          }}
        >
          <View style={styles.itemRow}>
            {useStatuses ? (
              // Status cycling button
              <Pressable
                style={[styles.statusBtn, { borderColor: currentStatus?.color ?? '#6B7280', opacity: canCheckItems ? 1 : 0.55 }]}
                onPress={() => {
                  if (!canCheckItems) return;
                  Haptics.selectionAsync();
                  toggleItemCheck(checklist.id, item.id);
                }}
                onLongPress={() => {
                  if (!canCheckItems) return;
                  Haptics.selectionAsync();
                  setShowStatusPicker(item.id);
                }}
              >
                <View style={[styles.statusDot, { backgroundColor: currentStatus?.color ?? '#6B7280' }]} />
                <Text style={{ color: currentStatus?.color ?? '#6B7280', fontSize: 10, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
                  {currentStatus?.label ?? activeStatuses[0]?.label ?? ''}
                </Text>
              </Pressable>
            ) : (
              // Plain checkbox
              <Pressable
                style={[styles.checkbox, {
                  backgroundColor: item.checked ? theme.success : 'transparent',
                  borderColor: item.checked ? theme.success : theme.textTertiary,
                  opacity: canCheckItems ? 1 : 0.55,
                }]}
                onPress={() => {
                  if (!canCheckItems) return;
                  Haptics.selectionAsync();
                  toggleItemCheck(checklist.id, item.id);
                }}
              >
                {item.checked && <MaterialIcons name="check" size={16} color="#FFF" />}
              </Pressable>
            )}

            <View style={styles.itemContent}>
              <View style={styles.itemNameRow}>
                <Text
                  style={[styles.itemName, {
                    color: isEffectivelyDone ? theme.textTertiary : theme.textPrimary,
                    textDecorationLine: isEffectivelyDone ? 'line-through' : 'none',
                  }]}
                  numberOfLines={2}
                >
                  {item.name}
                </Text>
                <View style={[styles.catBadge, { backgroundColor: catColor.bg }]}>
                  <View style={[styles.catBadgeDot, { backgroundColor: catColor.dot }]} />
                  <Text style={[styles.catBadgeText, { color: catColor.text }]}>{item.category}</Text>
                </View>
              </View>

              {item.description ? (
                <Text style={[styles.itemDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              {checklist.settings.enableQuantity && item.requiredQty > 0 && (
                <View style={styles.qtyRow}>
                  <View style={[styles.qtyBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.qtyBarFill, {
                      width: `${Math.min((item.ownedQty / item.requiredQty) * 100, 100)}%`,
                      backgroundColor: item.ownedQty >= item.requiredQty ? theme.success : isPartial ? theme.warning : theme.primary,
                    }]} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
                    {item.ownedQty}/{item.requiredQty}
                  </Text>
                </View>
              )}

              {hasNotes && (
                <Pressable
                  style={styles.notesToggle}
                  onPress={() => toggleNoteExpand(item.id)}
                >
                  <MaterialIcons
                    name={notesExpanded ? 'expand-less' : 'notes'}
                    size={16}
                    color={theme.textTertiary}
                  />
                  <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                    {notesExpanded ? 'Hide notes' : 'Notes'}
                  </Text>
                </Pressable>
              )}
              {hasNotes && notesExpanded && (
                <View style={[styles.notesBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18 }}>{item.notes}</Text>
                </View>
              )}
            </View>

            {canEditItems ? (
              <Pressable
                style={styles.editBtn}
                onPress={() => {
                  Haptics.selectionAsync();
                  setEditingItem(item);
                }}
                hitSlop={8}
              >
                <MaterialIcons name="edit" size={18} color={theme.textTertiary} />
              </Pressable>
            ) : (
              <View style={styles.editBtn} />
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSectionItems = (sectionId: string | null) => {
    return checklist.items
      .filter(i => i.sectionId === sectionId)
      .map(item => renderItem(item));
  };

  const renderSections = () => {
    if (!checklist.settings.enableSections || checklist.sections.length === 0) {
      return checklist.items.map(item => renderItem(item));
    }

    const unsectionedItems = checklist.items.filter(i => i.sectionId === null);

    return (
      <>
        {checklist.sections
          .sort((a, b) => a.order - b.order)
          .map(section => {
            const sectionItems = checklist.items.filter(i => i.sectionId === section.id);
            const secCompleted = sectionItems.filter(i => i.checked).length;
            const secTotal = sectionItems.length;
            const secPct = secTotal > 0 ? Math.round((secCompleted / secTotal) * 100) : 0;

            return (
              <View key={section.id} style={{ marginBottom: 4 }}>
                <Pressable
                  style={[styles.sectionHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => toggleSectionExpand(checklist.id, section.id)}
                  onLongPress={() => {
                    if (!canStructure) return;
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    deleteSection(checklist.id, section.id);
                  }}
                >
                  <MaterialIcons
                    name={section.expanded ? 'expand-more' : 'chevron-right'}
                    size={24}
                    color={theme.textSecondary}
                  />
                  <Text style={[styles.sectionName, { color: theme.textPrimary }]}>{section.name}</Text>
                  <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
                    {secCompleted}/{secTotal}
                  </Text>
                  <View style={[styles.sectionBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[styles.sectionBarFill, {
                      width: `${secPct}%`,
                      backgroundColor: secPct === 100 ? theme.success : theme.primary,
                    }]} />
                  </View>
                  <Text style={[styles.sectionPct, { color: secPct === 100 ? theme.success : theme.textSecondary }]}>
                    {secPct}%
                  </Text>
                </Pressable>
                {section.expanded && (
                  <Animated.View entering={FadeIn.duration(150)}>
                    {sectionItems.length === 0 ? (
                      <View style={[styles.sectionEmpty, { borderColor: theme.border }]}>
                        <Text style={{ color: theme.textTertiary, fontSize: 13 }}>No items in this section</Text>
                      </View>
                    ) : (
                      renderSectionItems(section.id)
                    )}
                  </Animated.View>
                )}
              </View>
            );
          })}

        {unsectionedItems.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <MaterialIcons name="inbox" size={20} color={theme.textSecondary} />
              <Text style={[styles.sectionName, { color: theme.textSecondary }]}>Unsorted</Text>
              <Text style={[styles.sectionCount, { color: theme.textTertiary }]}>{unsectionedItems.length}</Text>
            </View>
            {unsectionedItems.map(item => renderItem(item))}
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>{checklist.name}</Text>
          {checklist.description ? (
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 1 }} numberOfLines={1}>
              {checklist.description}
            </Text>
          ) : null}
        </View>
        {canShare ? (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowShareModal(true); }}
            hitSlop={8}
            style={{ marginRight: 4 }}
          >
            <MaterialIcons name="share" size={22} color={theme.primary} />
          </Pressable>
        ) : null}
        {canStructure ? (
          <Pressable
            onPress={() => { Haptics.selectionAsync(); setShowChecklistSettings(true); }}
            hitSlop={8}
          >
            <MaterialIcons name="tune" size={22} color={theme.textSecondary} />
          </Pressable>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {shareBannerLabel ? (
        <View style={[styles.shareBanner, { marginHorizontal: contentPadding, backgroundColor: theme.primaryBg, borderColor: theme.primary }]}>
          <MaterialIcons name="info-outline" size={18} color={theme.primary} />
          <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 8 }}>{shareBannerLabel}</Text>
        </View>
      ) : null}

      {/* Progress + View Toggle */}
      <View style={[styles.progressBar, { marginHorizontal: contentPadding }]}>
        <View style={styles.progressRow}>
          <View style={[styles.pctBadge, { backgroundColor: pct === 100 ? theme.successBg : theme.primaryBg }]}>
            <Text style={{ color: pct === 100 ? theme.success : theme.primary, fontSize: 15, fontWeight: '700' }}>
              {pct}%
            </Text>
          </View>
          <View style={[styles.pBar, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.pBarFill, {
              width: `${pct}%`,
              backgroundColor: pct === 100 ? theme.success : theme.primary,
            }]} />
          </View>
          <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>
            {completedCount}/{totalCount}
          </Text>
        </View>
        <View style={styles.toggleRow}>
          {(['interactive', 'stats'] as const).map(mode => (
            <Pressable
              key={mode}
              style={[styles.toggleBtn, {
                backgroundColor: viewMode === mode ? theme.primary : 'transparent',
              }]}
              onPress={() => { Haptics.selectionAsync(); setViewMode(mode); }}
            >
              <MaterialIcons
                name={mode === 'interactive' ? 'list' : 'bar-chart'}
                size={18}
                color={viewMode === mode ? '#FFF' : theme.textSecondary}
              />
              <Text style={{
                color: viewMode === mode ? '#FFF' : theme.textSecondary,
                fontSize: 13, fontWeight: '600', marginLeft: 4,
                textTransform: 'capitalize',
              }}>
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'stats' ? (
        <StatsView checklist={checklist} />
      ) : (
        <>
          {/* Action Bar */}
          {canStructure ? (
            <View style={[styles.actionBar, { paddingHorizontal: contentPadding }]}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                onPress={() => { Haptics.selectionAsync(); setShowAddItem(true); }}
              >
                <MaterialIcons name="add" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Add Item</Text>
              </Pressable>
              {checklist.settings.enableSections && (
                <Pressable
                  style={[styles.actionBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]}
                  onPress={() => { Haptics.selectionAsync(); setShowAddSection(true); }}
                >
                  <MaterialIcons name="playlist-add" size={18} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Section</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100 }}
            showsVerticalScrollIndicator={false}
          >
            {totalCount === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MaterialIcons name="add-task" size={48} color={theme.textTertiary} />
                <Text style={[styles.emptyTitle, { color: theme.textPrimary, fontSize: 16 }]}>
                  Start adding items
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
                  Tap "Add Item" above or import from CSV
                </Text>
              </View>
            ) : (
              renderSections()
            )}
          </ScrollView>
        </>
      )}

      {/* Add Section Modal */}
      <Modal visible={showAddSection} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.miniModal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.miniModalHeader}>
              <Text style={[styles.miniModalTitle, { color: theme.textPrimary }]}>New Section</Text>
              <Pressable onPress={() => setShowAddSection(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={newSectionName}
                onChangeText={setNewSectionName}
                placeholder="Section name"
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
              <Pressable
                style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: newSectionName.trim() ? 1 : 0.5 }]}
                onPress={handleAddSection}
                disabled={!newSectionName.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add Section</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Checklist Settings Modal */}
      <Modal visible={showChecklistSettings} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.miniModalHeader}>
              <Text style={[styles.miniModalTitle, { color: theme.textPrimary }]}>Checklist Settings</Text>
              <Pressable onPress={() => setShowChecklistSettings(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              {([
                { key: 'enableQuantity', label: 'Quantity Tracking', icon: 'tag' as const },
                { key: 'enableNotes', label: 'Notes per Item', icon: 'notes' as const },
                { key: 'enableImages', label: 'Image Uploads', icon: 'image' as const },
                { key: 'enableSections', label: 'Sections', icon: 'view-list' as const },
              ] as const).map(opt => (
                <Pressable
                  key={opt.key}
                  style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    updateChecklist(checklist.id, {
                      settings: { ...checklist.settings, [opt.key]: !checklist.settings[opt.key] },
                    });
                  }}
                >
                  <MaterialIcons name={opt.icon} size={22} color={theme.textSecondary} />
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>{opt.label}</Text>
                  <View style={[styles.toggleSwitch, {
                    backgroundColor: checklist.settings[opt.key] ? theme.primary : theme.backgroundSecondary,
                  }]}>
                    <View style={[styles.toggleKnob, {
                      transform: [{ translateX: checklist.settings[opt.key] ? 20 : 2 }],
                    }]} />
                  </View>
                </Pressable>
              ))}

              <Text style={[styles.settingSectionLabel, { color: theme.textSecondary }]}>CHART TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                {([null, 'pie', 'bar'] as const).map(ct => (
                  <Pressable
                    key={String(ct)}
                    style={[styles.chartTypeBtn, {
                      backgroundColor: checklist.settings.chartTypeOverride === ct ? theme.primaryBg : theme.backgroundSecondary,
                      borderColor: checklist.settings.chartTypeOverride === ct ? theme.primary : theme.border,
                    }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      updateChecklist(checklist.id, {
                        settings: { ...checklist.settings, chartTypeOverride: ct },
                      });
                    }}
                  >
                    <Text style={{
                      color: checklist.settings.chartTypeOverride === ct ? theme.primary : theme.textSecondary,
                      fontSize: 13, fontWeight: '600', textTransform: 'capitalize',
                    }}>
                      {ct || 'Default'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.settingSectionLabel, { color: theme.textSecondary }]}>TOOLS</Text>
              {canStructure ? (
                <Pressable
                  style={[styles.toolBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                  onPress={() => { setShowChecklistSettings(false); setShowCSVImport(true); }}
                >
                  <MaterialIcons name="upload-file" size={22} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Import CSV</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Bulk add items from CSV data</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                </Pressable>
              ) : null}

              <Text style={[styles.settingSectionLabel, { color: theme.textSecondary }]}>ITEM STATUSES</Text>
              {/* Enable / disable toggle */}
              <Pressable
                style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  const next = useStatuses ? [] : [...DEFAULT_ITEM_STATUSES];
                  updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: next } });
                }}
              >
                <MaterialIcons name="label" size={22} color={theme.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Custom Statuses</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                    {useStatuses ? 'Tap items to cycle through statuses' : 'Replace checkbox with custom states'}
                  </Text>
                </View>
                <View style={[styles.toggleSwitch, { backgroundColor: useStatuses ? theme.primary : theme.backgroundSecondary }]}>
                  <View style={[styles.toggleKnob, { transform: [{ translateX: useStatuses ? 20 : 2 }] }]} />
                </View>
              </Pressable>

              {useStatuses && (
                <View style={{ marginTop: 10, marginBottom: 4 }}>
                  {activeStatuses.map(st => (
                    <View key={st.id} style={[styles.statusRow, { borderColor: theme.border }]}>
                      <View style={[styles.statusDot, { backgroundColor: st.color, width: 12, height: 12 }]} />
                      <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1 }}>{st.label}</Text>
                      {st.isDone && (
                        <View style={[{ backgroundColor: theme.successBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 8 }]}>
                          <Text style={{ color: theme.success, fontSize: 11, fontWeight: '700' }}>DONE</Text>
                        </View>
                      )}
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          updateChecklist(checklist.id, {
                            settings: {
                              ...checklist.settings,
                              itemStatuses: activeStatuses.filter(s => s.id !== st.id),
                            },
                          });
                        }}
                        hitSlop={8}
                      >
                        <MaterialIcons name="remove-circle-outline" size={20} color={theme.error} />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    style={[styles.addStatusBtn, { borderColor: theme.primary }]}
                    onPress={() => {
                      setNewStatusLabel('');
                      setNewStatusColor(STATUS_COLORS[activeStatuses.length % STATUS_COLORS.length]);
                      setNewStatusIsDone(false);
                      setShowAddStatus(true);
                    }}
                  >
                    <MaterialIcons name="add" size={18} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Add Status</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ItemEditModal
        visible={showAddItem || !!editingItem}
        onClose={() => { setShowAddItem(false); setEditingItem(null); }}
        checklistId={checklist.id}
        item={editingItem}
        sections={checklist.sections}
        enableQuantity={checklist.settings.enableQuantity}
        enableNotes={checklist.settings.enableNotes}
        enableImages={checklist.settings.enableImages}
        defaultCategory={checklist.settings.defaultCategory}
      />

      {/* Status picker (long-press on a status button) */}
      <Modal visible={!!showStatusPicker} animationType="fade" transparent>
        <Pressable style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowStatusPicker(null)}>
          <View style={[styles.miniModal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, margin: 24, borderRadius: 20 }]}>
            <View style={styles.miniModalHeader}>
              <Text style={[styles.miniModalTitle, { color: theme.textPrimary }]}>Set Status</Text>
              <Pressable onPress={() => setShowStatusPicker(null)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, gap: 8 }}>
              {activeStatuses.map(st => {
                const itemId = showStatusPicker!;
                const item = checklist.items.find(i => i.id === itemId);
                const isActive = (item?.status ?? activeStatuses[0]?.id) === st.id;
                return (
                  <Pressable
                    key={st.id}
                    style={[styles.statusPickerRow, {
                      backgroundColor: isActive ? st.color + '22' : theme.backgroundSecondary,
                      borderColor: isActive ? st.color : theme.border,
                    }]}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setItemStatus(checklist.id, itemId, st.id);
                      setShowStatusPicker(null);
                    }}
                  >
                    <View style={[styles.statusDot, { backgroundColor: st.color, width: 12, height: 12 }]} />
                    <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600', flex: 1 }}>{st.label}</Text>
                    {st.isDone && <Text style={{ color: theme.success, fontSize: 12, fontWeight: '700' }}>✓ Done</Text>}
                    {isActive && <MaterialIcons name="check-circle" size={20} color={st.color} />}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Add new status mini-modal */}
      <Modal visible={showAddStatus} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.miniModal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.miniModalHeader}>
              <Text style={[styles.miniModalTitle, { color: theme.textPrimary }]}>New Status</Text>
              <Pressable onPress={() => setShowAddStatus(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={newStatusLabel}
                onChangeText={setNewStatusLabel}
                placeholder="Status label (e.g. Packed)"
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
              <Text style={[styles.miniStatusLabel, { color: theme.textSecondary }]}>COLOR</Text>
              <View style={styles.colorRow}>
                {STATUS_COLORS.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c, borderWidth: newStatusColor === c ? 3 : 0, borderColor: theme.textPrimary }]}
                    onPress={() => setNewStatusColor(c)}
                  />
                ))}
              </View>
              <Pressable
                style={[styles.settingRow, { borderBottomColor: theme.borderLight, marginBottom: 14 }]}
                onPress={() => setNewStatusIsDone(v => !v)}
              >
                <Text style={[styles.settingLabel, { color: theme.textPrimary }]}>Counts as completed</Text>
                <View style={[styles.toggleSwitch, { backgroundColor: newStatusIsDone ? theme.primary : theme.backgroundSecondary }]}>
                  <View style={[styles.toggleKnob, { transform: [{ translateX: newStatusIsDone ? 20 : 2 }] }]} />
                </View>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: newStatusLabel.trim() ? 1 : 0.5 }]}
                onPress={() => {
                  if (!newStatusLabel.trim()) return;
                  const id = newStatusLabel.trim().toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36);
                  updateChecklist(checklist.id, {
                    settings: {
                      ...checklist.settings,
                      itemStatuses: [...activeStatuses, { id, label: newStatusLabel.trim(), color: newStatusColor, isDone: newStatusIsDone }],
                    },
                  });
                  setShowAddStatus(false);
                }}
                disabled={!newStatusLabel.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add Status</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CSVImportModal
        visible={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        checklistId={checklist.id}
      />

      <ShareChecklistModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        checklist={checklist}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8 },
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  progressBar: { marginBottom: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  pBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  pBarFill: { height: 6, borderRadius: 3 },
  toggleRow: { flexDirection: 'row', gap: 4, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: 8 },
  actionBar: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  itemCard: { borderRadius: 12, marginBottom: 6, borderWidth: 1, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemContent: { flex: 1 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  itemName: { fontSize: 15, fontWeight: '600', flex: 1 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  catBadgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  itemDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  qtyBar: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  qtyBarFill: { height: 5, borderRadius: 3 },
  notesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  notesBox: { marginTop: 6, padding: 10, borderRadius: 8, borderWidth: 1 },
  editBtn: { padding: 6, borderRadius: 8, marginTop: 2 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    marginBottom: 4, borderWidth: 1,
  },
  sectionName: { fontSize: 14, fontWeight: '700', flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '600' },
  sectionBar: { width: 50, height: 4, borderRadius: 2, overflow: 'hidden' },
  sectionBarFill: { height: 4, borderRadius: 2 },
  sectionPct: { fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' },
  sectionEmpty: { paddingVertical: 16, alignItems: 'center', borderBottomWidth: 1, marginBottom: 4 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 12 },
  emptyDesc: { fontSize: 14, marginTop: 6, textAlign: 'center' },
  emptyState: { alignItems: 'center', padding: 32, borderRadius: 16, borderWidth: 1, marginTop: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  miniModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  miniModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  miniModalTitle: { fontSize: 18, fontWeight: '700' },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, marginBottom: 12,
  },
  saveBtn: {
    height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1,
  },
  settingLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  settingSectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  chartTypeBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  toolBtn: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderRadius: 12, borderWidth: 1, marginBottom: 20,
  },
  // Status system
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4,
    minWidth: 64, maxWidth: 90, marginTop: 2,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, marginBottom: 6,
  },
  statusPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1,
  },
  addStatusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4, marginBottom: 16,
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  miniStatusLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
});
