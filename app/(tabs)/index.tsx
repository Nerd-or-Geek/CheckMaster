import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Modal, Platform, Alert,
  KeyboardAvoidingView, Animated as RNAnimated, PanResponder,
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

const ACTION_BTN_W = 52;
const ACTION_GAP = 8;

/** Row wrapper that reveals action buttons on hover (desktop) or swipe-left (mobile). Tablet always shows them. */
function RevealActionsRow({
  isMobile, isDesktop, actionSlots, children,
}: {
  isMobile: boolean;
  isDesktop: boolean;
  actionSlots: React.ReactNode[];
  children: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const revealed = useRef(false);
  const revealWidth = actionSlots.length * ACTION_BTN_W + (actionSlots.length - 1) * ACTION_GAP;
  const translateX = useRef(new RNAnimated.Value(0)).current;

  const snapTo = useCallback((target: number) => {
    revealed.current = target !== 0;
    RNAnimated.spring(translateX, { toValue: target, useNativeDriver: true, friction: 8 }).start();
  }, [translateX]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => {
      const start = revealed.current ? -revealWidth : 0;
      translateX.setValue(Math.min(0, Math.max(-revealWidth, start + g.dx)));
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -30) snapTo(-revealWidth);
      else if (g.dx > 20) snapTo(0);
      else snapTo(revealed.current ? -revealWidth : 0);
    },
  })).current;

  if (isDesktop) {
    return (
      <Pressable
        style={{ flexDirection: 'row', alignItems: 'stretch', gap: ACTION_GAP }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
      >
        <View style={{ flex: 1 }}>{children}</View>
        {hovered && (
          <Animated.View entering={FadeIn.duration(120)} style={{ flexDirection: 'row', gap: ACTION_GAP }}>
            {actionSlots}
          </Animated.View>
        )}
      </Pressable>
    );
  }

  if (!isMobile) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: ACTION_GAP }}>
        <View style={{ flex: 1 }}>{children}</View>
        <View style={{ flexDirection: 'row', gap: ACTION_GAP }}>{actionSlots}</View>
      </View>
    );
  }

  // Mobile: swipe left to reveal
  return (
    <View style={{ position: 'relative' }}>
      <View style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        flexDirection: 'row', gap: ACTION_GAP, alignItems: 'center',
        width: revealWidth,
      }}>
        {actionSlots}
      </View>
      <RNAnimated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </RNAnimated.View>
    </View>
  );
}

export default function FoldersScreen() {
  const {
    settings, folders, checklists,
    getFolderChildren, getFolderChecklists,
    addFolder, updateFolder, deleteFolder, toggleFolderExpand,
    addChecklist, deleteChecklist,
    setActiveChecklistId, setCurrentFolderId,
    importSharedChecklist,
  } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isMobile, isDesktop, contentPadding } = useResponsive();
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
  const [showImportShare, setShowImportShare] = useState(false);
  const [importPasteText, setImportPasteText] = useState('');
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState(FOLDER_COLORS[0]);

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

  const confirmDeleteFolder = (folder: { id: string; name: string }) => {
    Alert.alert(
      'Delete folder?',
      `"${folder.name}" and everything inside it (subfolders and checklists) will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteFolder(folder.id);
            setNavStack([null]);
          },
        },
      ],
    );
  };

  const confirmDeleteChecklist = (cl: Checklist) => {
    Alert.alert(
      'Delete checklist?',
      `Remove "${cl.name}" and all of its items? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            deleteChecklist(cl.id);
          },
        },
      ],
    );
  };

  const handleImportShared = () => {
    if (!currentFolderId) return;
    const result = importSharedChecklist(currentFolderId, importPasteText);
    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setImportPasteText('');
      setShowImportShare(false);
      router.push('/(tabs)/checklist');
    } else {
      Alert.alert('Import failed', result.error);
    }
  };

  const handleEditFolder = () => {
    if (!editingFolder || !editFolderName.trim()) return;
    updateFolder(editingFolder.id, { name: editFolderName.trim(), color: editFolderColor });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditingFolder(null);
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
                  <RevealActionsRow
                    isMobile={isMobile}
                    isDesktop={isDesktop}
                    actionSlots={[
                      <Pressable
                        key="edit"
                        style={[styles.actionBtn, { borderColor: folder.color + '60', backgroundColor: folder.color + '14' }]}
                        onPress={() => {
                          setEditingFolder({ id: folder.id, name: folder.name, color: folder.color });
                          setEditFolderName(folder.name);
                          setEditFolderColor(folder.color);
                        }}
                        hitSlop={8}
                      >
                        <MaterialIcons name="edit" size={20} color={folder.color} />
                      </Pressable>,
                      <Pressable
                        key="delete"
                        style={[styles.actionBtn, { borderColor: '#EF444460', backgroundColor: '#EF444414' }]}
                        onPress={() => confirmDeleteFolder(folder)}
                        hitSlop={8}
                      >
                        <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                      </Pressable>,
                    ]}
                  >
                    <Pressable
                      style={[styles.folderCard, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 }]}
                      onPress={() => navigateInto(folder.id)}
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
                  </RevealActionsRow>
                  <View style={{ height: 8 }} />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  style={[styles.addSmallBtn, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border }]}
                  onPress={() => { Haptics.selectionAsync(); setShowImportShare(true); }}
                >
                  <MaterialIcons name="download" size={18} color={theme.textSecondary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600' }}>Import</Text>
                </Pressable>
                <Pressable
                  style={[styles.addSmallBtn, { backgroundColor: theme.primaryBg }]}
                  onPress={() => { Haptics.selectionAsync(); setShowCreateChecklist(true); }}
                >
                  <MaterialIcons name="add" size={18} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>New</Text>
                </Pressable>
              </View>
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
                    <RevealActionsRow
                      isMobile={isMobile}
                      isDesktop={isDesktop}
                      actionSlots={[
                        <Pressable
                          key="delete"
                          style={[styles.actionBtn, { borderColor: '#EF444460', backgroundColor: '#EF444414' }]}
                          onPress={() => confirmDeleteChecklist(cl)}
                          hitSlop={8}
                        >
                          <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                        </Pressable>,
                      ]}
                    >
                      <Pressable
                        style={[styles.checklistCard, { backgroundColor: theme.surface, borderColor: theme.border, marginBottom: 0 }]}
                        onPress={() => openChecklist(cl)}
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
                        {cl.shareRole && cl.shareRole !== 'owner' && (
                          <View style={[styles.clTag, { backgroundColor: theme.primaryBg }]}>
                            <MaterialIcons name="people" size={12} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>
                              {cl.shareRole === 'view' ? 'View' : cl.shareRole === 'check' ? 'Check' : 'Edit'}
                            </Text>
                          </View>
                        )}
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
                    </RevealActionsRow>
                    <View style={{ height: 8 }} />
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

      {/* Edit Folder Modal */}
      <Modal visible={!!editingFolder} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit Folder</Text>
              <Pressable onPress={() => setEditingFolder(null)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>FOLDER NAME</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={editFolderName}
                onChangeText={setEditFolderName}
                placeholder="Folder name"
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
                      borderWidth: editFolderColor === c ? 3 : 0,
                      borderColor: theme.textPrimary,
                    }]}
                    onPress={() => setEditFolderColor(c)}
                  />
                ))}
              </View>
              <Pressable
                style={[styles.createBtn, { backgroundColor: theme.primary, opacity: editFolderName.trim() ? 1 : 0.5 }]}
                onPress={handleEditFolder}
                disabled={!editFolderName.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Save Changes</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Import shared checklist */}
      <Modal visible={showImportShare} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Import shared</Text>
              <Pressable onPress={() => { setShowImportShare(false); setImportPasteText(''); }} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20 }}>
              <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
                Paste the entire message you received (including the lines with CHECKMASTER markers). The checklist will be added to this folder.
              </Text>
              <TextInput
                style={[styles.importTextArea, {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                }]}
                value={importPasteText}
                onChangeText={setImportPasteText}
                placeholder="Paste shared checklist…"
                placeholderTextColor={theme.textTertiary}
                multiline
                textAlignVertical="top"
              />
              <Pressable
                style={[styles.createBtn, {
                  backgroundColor: theme.primary,
                  opacity: importPasteText.trim().length > 20 ? 1 : 0.45,
                }]}
                onPress={handleImportShared}
                disabled={importPasteText.trim().length < 21}
              >
                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Import checklist</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  listRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  deleteIconBtn: {
    width: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  editIconBtn: {
    width: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  actionBtn: {
    width: ACTION_BTN_W, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
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
  importTextArea: {
    minHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 13,
    marginBottom: 16,
  },
});
