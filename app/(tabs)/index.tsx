import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Modal, Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, categoryColors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Folder, Checklist } from '../../services/mockData';

const FOLDER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

export default function FoldersScreen() {
  const {
    settings, folders, checklists,
    getFolderChildren, getFolderChecklists,
    addFolder, deleteFolder, toggleFolderExpand,
    addChecklist, deleteChecklist,
    setActiveChecklistId, setCurrentFolderId,
  } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isMobile, contentPadding } = useResponsive();
  const router = useRouter();

  const [navStack, setNavStack] = useState<(string | null)[]>([null]);
  const currentFolderId = navStack[navStack.length - 1];

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showCreateChecklist, setShowCreateChecklist] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [newChecklistType, setNewChecklistType] = useState<'basic' | 'quantity' | 'full'>('basic');
  const [showMoveMenu, setShowMoveMenu] = useState<string | null>(null);

  const childFolders = getFolderChildren(currentFolderId);
  const currentChecklists = currentFolderId ? getFolderChecklists(currentFolderId) : [];
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const navigateInto = (folderId: string) => {
    Haptics.selectionAsync();
    setNavStack(prev => [...prev, folderId]);
  };

  const navigateBack = () => {
    if (navStack.length > 1) {
      Haptics.selectionAsync();
      setNavStack(prev => prev.slice(0, -1));
    }
  };

  const openChecklist = (cl: Checklist) => {
    Haptics.selectionAsync();
    setActiveChecklistId(cl.id);
    router.push('/(tabs)/checklist');
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    addFolder(newFolderName.trim(), currentFolderId, newFolderColor);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  const handleCreateChecklist = () => {
    if (!newChecklistName.trim() || !currentFolderId) return;
    addChecklist({
      name: newChecklistName.trim(),
      description: newChecklistDesc.trim(),
      folderId: currentFolderId,
      type: newChecklistType,
      sections: [],
      items: [],
      settings: {
        enableImages: false,
        enableNotes: true,
        enableQuantity: newChecklistType !== 'basic',
        enableSections: true,
        defaultCategory: 'general',
        chartTypeOverride: null,
      },
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setNewChecklistName('');
    setNewChecklistDesc('');
    setShowCreateChecklist(false);
  };

  const handleDeleteFolder = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteFolder(id);
  };

  const handleDeleteChecklist = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteChecklist(id);
  };

  const rootFolders = getFolderChildren(null);
  const totalChecklists = checklists.length;

  const getBreadcrumb = (): string[] => {
    const trail: string[] = [];
    let fId = currentFolderId;
    while (fId) {
      const f = folders.find(ff => ff.id === fId);
      if (f) { trail.unshift(f.name); fId = f.parentId; }
      else break;
    }
    return trail;
  };

  const breadcrumb = getBreadcrumb();

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        {navStack.length > 1 ? (
          <Pressable style={styles.backBtn} onPress={navigateBack} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={24} color={theme.textPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            {currentFolder?.name || 'Folders'}
          </Text>
          {breadcrumb.length > 1 && (
            <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 2 }}>
              {breadcrumb.join(' / ')}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: theme.primary }]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowCreateFolder(true);
          }}
          hitSlop={8}
        >
          <MaterialIcons name="create-new-folder" size={20} color="#FFF" />
        </Pressable>
      </View>

      {/* Summary bar at root */}
      {!currentFolderId && (
        <View style={[styles.summaryBar, { marginHorizontal: contentPadding, backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{rootFolders.length}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Folders</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.primary }]}>{totalChecklists}</Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Checklists</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: theme.success }]}>
              {checklists.reduce((sum, cl) => sum + cl.items.filter(i => i.checked).length, 0)}
            </Text>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Completed</Text>
          </View>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Subfolders */}
        {childFolders.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              {currentFolderId ? 'SUBFOLDERS' : 'FOLDERS'}
            </Text>
            {childFolders.map(folder => {
              const subCount = getFolderChildren(folder.id).length;
              const clCount = getFolderChecklists(folder.id).length;
              return (
                <Animated.View key={folder.id} entering={FadeIn.duration(200)} layout={Layout.springify()}>
                  <Pressable
                    style={[styles.folderCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => navigateInto(folder.id)}
                    onLongPress={() => handleDeleteFolder(folder.id)}
                  >
                    <View style={[styles.folderIcon, { backgroundColor: folder.color + '18' }]}>
                      <MaterialIcons name="folder" size={28} color={folder.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.folderName, { color: theme.textPrimary }]}>{folder.name}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                        {subCount > 0 ? `${subCount} subfolder${subCount > 1 ? 's' : ''} · ` : ''}{clCount} checklist{clCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={24} color={theme.textTertiary} />
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Checklists in current folder */}
        {currentFolderId && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>CHECKLISTS</Text>
              <Pressable
                style={[styles.addSmallBtn, { backgroundColor: theme.primaryBg }]}
                onPress={() => { Haptics.selectionAsync(); setShowCreateChecklist(true); }}
              >
                <MaterialIcons name="add" size={18} color={theme.primary} />
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>New</Text>
              </Pressable>
            </View>

            {currentChecklists.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <MaterialIcons name="playlist-add" size={48} color={theme.textTertiary} />
                <Text style={{ color: theme.textSecondary, fontSize: 15, marginTop: 8 }}>
                  No checklists yet
                </Text>
                <Pressable
                  style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
                  onPress={() => setShowCreateChecklist(true)}
                >
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Create Checklist</Text>
                </Pressable>
              </View>
            ) : (
              currentChecklists.map(cl => {
                const completed = cl.items.filter(i => i.checked).length;
                const total = cl.items.length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return (
                  <Animated.View key={cl.id} entering={FadeIn.duration(200)} layout={Layout.springify()}>
                    <Pressable
                      style={[styles.checklistCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      onPress={() => openChecklist(cl)}
                      onLongPress={() => handleDeleteChecklist(cl.id)}
                    >
                      <View style={styles.clCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.clName, { color: theme.textPrimary }]}>{cl.name}</Text>
                          {cl.description ? (
                            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                              {cl.description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={[styles.clBadge, { backgroundColor: pct === 100 ? theme.successBg : theme.primaryBg }]}>
                          <Text style={{ color: pct === 100 ? theme.success : theme.primary, fontSize: 13, fontWeight: '700' }}>
                            {pct}%
                          </Text>
                        </View>
                      </View>
                      <View style={styles.clCardBottom}>
                        <View style={[styles.clBar, { backgroundColor: theme.backgroundSecondary }]}>
                          <View style={[styles.clBarFill, {
                            width: `${pct}%`,
                            backgroundColor: pct === 100 ? theme.success : theme.primary,
                          }]} />
                        </View>
                        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                          {completed}/{total} items
                        </Text>
                      </View>
                      <View style={styles.clTags}>
                        {cl.sections.length > 0 && (
                          <View style={[styles.clTag, { backgroundColor: theme.backgroundSecondary }]}>
                            <MaterialIcons name="view-list" size={12} color={theme.textSecondary} />
                            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{cl.sections.length} sections</Text>
                          </View>
                        )}
                        <View style={[styles.clTag, { backgroundColor: theme.backgroundSecondary }]}>
                          <MaterialIcons name="category" size={12} color={theme.textSecondary} />
                          <Text style={{ color: theme.textSecondary, fontSize: 11, textTransform: 'capitalize' }}>{cl.type}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </View>
        )}

        {/* Root empty state */}
        {!currentFolderId && childFolders.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 40 }]}>
            <MaterialIcons name="folder-open" size={56} color={theme.textTertiary} />
            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 12 }}>
              No folders yet
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 4, textAlign: 'center' }}>
              Create a folder to start organizing your checklists
            </Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowCreateFolder(true)}
            >
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Create Folder</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Create Folder Modal */}
      <Modal visible={showCreateFolder} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Folder</Text>
              <Pressable onPress={() => setShowCreateFolder(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>FOLDER NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Enter folder name"
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>COLOR</Text>
              <View style={styles.colorRow}>
                {FOLDER_COLORS.map(c => (
                  <Pressable
                    key={c}
                    style={[styles.colorDot, {
                      backgroundColor: c,
                      borderWidth: newFolderColor === c ? 3 : 0,
                      borderColor: theme.textPrimary,
                    }]}
                    onPress={() => setNewFolderColor(c)}
                  />
                ))}
              </View>
              <Pressable
                style={[styles.createBtn, { backgroundColor: theme.primary, opacity: newFolderName.trim() ? 1 : 0.5 }]}
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Create Folder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Checklist Modal */}
      <Modal visible={showCreateChecklist} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New Checklist</Text>
              <Pressable onPress={() => setShowCreateChecklist(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={newChecklistName}
                onChangeText={setNewChecklistName}
                placeholder="Checklist name"
                placeholderTextColor={theme.textTertiary}
                autoFocus
              />
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={newChecklistDesc}
                onChangeText={setNewChecklistDesc}
                placeholder="Optional description"
                placeholderTextColor={theme.textTertiary}
              />
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TYPE</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                {([
                  { key: 'basic', label: 'Basic', desc: 'Name + Description' },
                  { key: 'quantity', label: 'Quantity', desc: 'Name + Quantity Tracking' },
                  { key: 'full', label: 'Full', desc: 'Name + Description + Quantity' },
                ] as const).map(t => (
                  <Pressable
                    key={t.key}
                    style={[styles.typeCard, {
                      backgroundColor: newChecklistType === t.key ? theme.primaryBg : theme.backgroundSecondary,
                      borderColor: newChecklistType === t.key ? theme.primary : theme.border,
                    }]}
                    onPress={() => setNewChecklistType(t.key)}
                  >
                    <MaterialIcons
                      name={newChecklistType === t.key ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={22}
                      color={newChecklistType === t.key ? theme.primary : theme.textTertiary}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>{t.label}</Text>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{t.desc}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <Pressable
                style={[styles.createBtn, { backgroundColor: theme.primary, opacity: newChecklistName.trim() ? 1 : 0.5 }]}
                onPress={handleCreateChecklist}
                disabled={!newChecklistName.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Create Checklist</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 8,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  summaryBar: {
    flexDirection: 'row', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700' },
  summaryLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryDivider: { width: 1, height: '100%' },
  section: { marginTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  folderCard: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14,
    marginBottom: 8, borderWidth: 1, gap: 12,
  },
  folderIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  folderName: { fontSize: 16, fontWeight: '600' },
  checklistCard: { padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1 },
  clCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  clName: { fontSize: 16, fontWeight: '600' },
  clBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  clCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  clBar: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  clBarFill: { height: 5, borderRadius: 3 },
  clTags: { flexDirection: 'row', gap: 8, marginTop: 8 },
  clTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  emptyCard: {
    alignItems: 'center', justifyContent: 'center', padding: 32, borderRadius: 16, borderWidth: 1,
  },
  emptyBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  addSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, borderWidth: 1, marginBottom: 16,
  },
  colorRow: { flexDirection: 'row', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  createBtn: {
    height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  typeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5 },
});
