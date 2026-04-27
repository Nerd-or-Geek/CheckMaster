import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, TextInput, Modal, Platform,
  KeyboardAvoidingView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut, Layout } from 'react-native-reanimated';
import { colors, categoryColors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Folder, Checklist, ChecklistItem, ItemStatus, DEFAULT_ITEM_STATUSES } from '../../services/mockData';
import { APP_NAME, APP_VERSION } from '../../constants/config';
import PageHeader from '../../components/layout/PageHeader';
import StatsView from '../../components/feature/StatsView';
import ItemEditModal from '../../components/feature/ItemEditModal';
import CSVImportModal from '../../components/feature/CSVImportModal';
import ShareChecklistModal from '../../components/feature/ShareChecklistModal';
import SegmentedBar from '../../components/ui/SegmentedBar';
import { exportAsCSV, exportAsText } from '../../services/checklistExport';

const FOLDER_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const STATUS_COLORS = ['#6B7280', '#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

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

export default function FoldersScreen() {
  const {
    settings, isDark, folders, checklists, viewMode, setViewMode,
    getFolderChildren, getFolderChecklists,
    addFolder, updateFolder, deleteFolder, reorderFolders,
    addChecklist, deleteChecklist, updateChecklist,
    setActiveChecklistId, getActiveChecklist,
    toggleItemCheck, setItemStatus, deleteItem,
    addSection, deleteSection, toggleSectionExpand, reorderSections,
    importSharedChecklist, updateSettings,
    testSyncServer, pushDataToServer, pullDataFromServer,
    registerServerProfile, loginServerProfile, deleteAllData,
    addItem, updateItem, reorderItems,
  } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isMobile, isDesktop, isTablet, contentPadding, width } = useResponsive();
  const router = useRouter();

  // Navigation
  const [navStack, setNavStack] = useState<(string | null)[]>([null]);
  const currentFolderId = navStack[navStack.length - 1];

  // Folder modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string; color: string } | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderColor, setEditFolderColor] = useState(FOLDER_COLORS[0]);

  // Checklist modals
  const [showCreateChecklist, setShowCreateChecklist] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [newChecklistDesc, setNewChecklistDesc] = useState('');
  const [newChecklistType, setNewChecklistType] = useState<'basic' | 'quantity' | 'full'>('basic');
  const [showImportShare, setShowImportShare] = useState(false);
  const [importPasteText, setImportPasteText] = useState('');

  // Checklist editing
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

  // Export modal
  const [showExport, setShowExport] = useState(false);
  const [exportCopied, setExportCopied] = useState('');

  // Desktop: settings mode vs checklist
  const [desktopMode, setDesktopMode] = useState<'checklist' | 'settings'>('checklist');

  // Server settings
  const [serverBusy, setServerBusy] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectUrl, setConnectUrl] = useState(settings.serverUrl);
  const [connectKey, setConnectKey] = useState(settings.serverApiKey);
  const [connectStep, setConnectStep] = useState<'credentials' | 'auth'>('credentials');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplay, setAuthDisplay] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const checklist = getActiveChecklist();
  const childFolders = getFolderChildren(currentFolderId);
  const currentChecklists = currentFolderId ? getFolderChecklists(currentFolderId) : [];
  const currentFolder = folders.find(f => f.id === currentFolderId);

  const isServerConnected = !!(settings.serverUrl && settings.serverApiKey);
  const hasProfile = !!settings.serverUsername;

  // Navigation helpers
  const navigateInto = (folderId: string) => setNavStack(prev => [...prev, folderId]);
  const navigateBack = () => { if (navStack.length > 1) setNavStack(prev => prev.slice(0, -1)); };

  const openChecklist = (cl: Checklist) => {
    setActiveChecklistId(cl.id);
    setDesktopMode('checklist');
    if (!isDesktop) router.push('/(tabs)/checklist');
  };

  // Checklist computed
  const activeStatuses = checklist?.settings.itemStatuses ?? [];
  const useStatuses = activeStatuses.length > 0;
  const completedCount = checklist ? checklist.items.filter(i => {
    if (useStatuses && i.status) return activeStatuses.find(s => s.id === i.status)?.isDone ?? false;
    return i.checked;
  }).length : 0;
  const totalCount = checklist ? checklist.items.length : 0;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const shareRole = checklist?.shareRole ?? 'owner';
  const canEditItems = shareRole === 'owner' || shareRole === 'edit';
  const canCheckItems = shareRole === 'owner' || shareRole === 'edit' || shareRole === 'check';
  const canStructure = shareRole === 'owner' || shareRole === 'edit';
  const canShare = shareRole === 'owner' || shareRole === 'edit';

  // Segmented bar data
  const segmentData = useMemo(() => {
    if (!checklist) return [];
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

  // CRUD handlers
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    addFolder(newFolderName.trim(), currentFolderId, newFolderColor);
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  const handleEditFolder = () => {
    if (!editingFolder || !editFolderName.trim()) return;
    updateFolder(editingFolder.id, { name: editFolderName.trim(), color: editFolderColor });
    setEditingFolder(null);
  };

  const handleCreateChecklist = () => {
    if (!newChecklistName.trim() || !currentFolderId) return;
    addChecklist({
      name: newChecklistName.trim(), description: newChecklistDesc.trim(),
      folderId: currentFolderId, type: newChecklistType, sections: [], items: [],
      settings: { enableImages: false, enableNotes: true, enableQuantity: newChecklistType !== 'basic', enableSections: true, defaultCategory: 'general', chartTypeOverride: null },
    });
    setNewChecklistName(''); setNewChecklistDesc(''); setShowCreateChecklist(false);
  };

  const confirmDeleteFolder = (folder: { id: string; name: string }) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${folder.name}" and everything inside?`)) { deleteFolder(folder.id); setNavStack([null]); }
    } else {
      Alert.alert('Delete folder?', `"${folder.name}" and everything inside will be removed.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => { deleteFolder(folder.id); setNavStack([null]); } },
      ]);
    }
  };

  const confirmDeleteChecklist = (cl: Checklist) => {
    if (Platform.OS === 'web') {
      if (confirm(`Delete "${cl.name}"?`)) deleteChecklist(cl.id);
    } else {
      Alert.alert('Delete checklist?', `Remove "${cl.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteChecklist(cl.id) },
      ]);
    }
  };

  const handleImportShared = () => {
    if (!currentFolderId) return;
    const result = importSharedChecklist(currentFolderId, importPasteText);
    if (result.ok) { setImportPasteText(''); setShowImportShare(false); }
    else {
      if (Platform.OS === 'web') alert(result.error);
      else Alert.alert('Import failed', result.error);
    }
  };

  const handleAddSection = () => {
    if (!newSectionName.trim() || !checklist) return;
    addSection(checklist.id, newSectionName.trim());
    setNewSectionName(''); setShowAddSection(false);
  };

  const toggleNoteExpand = (id: string) => {
    setExpandedNotes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  // Export
  const handleExportCSV = () => {
    if (!checklist) return;
    const csv = exportAsCSV(checklist);
    copyToClipboard(csv);
    setExportCopied('csv');
    setTimeout(() => setExportCopied(''), 2000);
  };

  const handleExportText = () => {
    if (!checklist) return;
    const txt = exportAsText(checklist);
    copyToClipboard(txt);
    setExportCopied('text');
    setTimeout(() => setExportCopied(''), 2000);
  };

  // Server handlers
  const handleTestAndConnect = async () => {
    if (!connectUrl.trim() || !connectKey.trim()) return;
    setServerBusy(true);
    updateSettings({ serverUrl: connectUrl.trim(), serverApiKey: connectKey.trim() });
    await new Promise(r => setTimeout(r, 100));
    const r = await testSyncServer();
    setServerBusy(false);
    if (!r.ok) { if (Platform.OS === 'web') alert(r.error); else Alert.alert('Connection failed', r.error); return; }
    setConnectStep('auth');
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) return;
    setAuthBusy(true);
    const r = authMode === 'register'
      ? await registerServerProfile(authUsername, authPassword, authDisplay || undefined)
      : await loginServerProfile(authUsername, authPassword);
    setAuthBusy(false);
    if (!r.ok) { if (Platform.OS === 'web') alert(r.error); else Alert.alert('Auth failed', r.error); return; }
    updateSettings({ storageMode: 'server' });
    setShowConnectModal(false);
  };

  const handleDisconnectServer = () => {
    const doDisconnect = () => {
      updateSettings({ storageMode: 'local', serverUrl: '', serverApiKey: '', serverUsername: undefined, serverDisplayName: undefined });
    };
    if (Platform.OS === 'web') { if (confirm('Disconnect server?')) doDisconnect(); }
    else Alert.alert('Disconnect?', 'Your local data will be kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: doDisconnect }]);
  };

  const handleSync = async (direction: 'push' | 'pull') => {
    setServerBusy(true);
    const r = direction === 'push' ? await pushDataToServer() : await pullDataFromServer();
    setServerBusy(false);
    if (!r.ok) { if (Platform.OS === 'web') alert(r.error); else Alert.alert('Sync failed', r.error); }
    else { if (Platform.OS === 'web') alert(direction === 'push' ? 'Data uploaded.' : 'Data downloaded.'); else Alert.alert('Success', direction === 'push' ? 'Data uploaded.' : 'Data downloaded.'); }
  };

  const handleDeleteAllData = () => {
    const doDelete = () => deleteAllData();
    if (Platform.OS === 'web') { if (confirm('Delete all data? This cannot be undone.')) doDelete(); }
    else Alert.alert('Delete all data?', 'This cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]);
  };

  // Breadcrumb
  const getBreadcrumb = (): string[] => {
    const trail: string[] = [];
    let fId = currentFolderId;
    while (fId) { const f = folders.find(ff => ff.id === fId); if (f) { trail.unshift(f.name); fId = f.parentId; } else break; }
    return trail;
  };
  const breadcrumb = getBreadcrumb();

  // ============= RENDER ITEM (for center panel) =============
  const renderItem = (item: ChecklistItem, index: number) => {
    if (!checklist) return null;
    const catColor = categoryColors[item.category] || categoryColors.general;
    const currentStatus = useStatuses ? activeStatuses.find(s => s.id === (item.status ?? activeStatuses[0]?.id)) : undefined;
    const isEffectivelyDone = currentStatus ? currentStatus.isDone : item.checked;

    return (
      <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index * 20, 200)).duration(200)} layout={Layout.springify()}>
        <Pressable
          style={[s.itemCard, { backgroundColor: theme.surface, borderColor: isEffectivelyDone ? theme.success + '40' : theme.border, borderLeftColor: catColor.dot, borderLeftWidth: 4 }]}
        >
          <View style={s.itemRow}>
            {/* Status / Checkbox */}
            {useStatuses ? (
              <Pressable
                style={[s.statusDropdown, { borderColor: currentStatus?.color ?? '#6B7280' }]}
                onPress={() => { if (canCheckItems) setShowStatusPicker(item.id); }}
              >
                <View style={[s.statusDotSm, { backgroundColor: currentStatus?.color ?? '#6B7280' }]} />
                <Text style={{ color: currentStatus?.color ?? '#6B7280', fontSize: 11, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                  {currentStatus?.label ?? ''}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={16} color={currentStatus?.color ?? '#6B7280'} />
              </Pressable>
            ) : (
              <Pressable
                style={[s.checkbox, { backgroundColor: item.checked ? theme.success : 'transparent', borderColor: item.checked ? theme.success : theme.textTertiary, opacity: canCheckItems ? 1 : 0.55 }]}
                onPress={() => { if (canCheckItems) toggleItemCheck(checklist.id, item.id); }}
              >
                {item.checked ? <MaterialIcons name="check" size={16} color="#FFF" /> : null}
              </Pressable>
            )}

            <View style={{ flex: 1 }}>
              <View style={s.itemNameRow}>
                <Text style={[s.itemName, { color: isEffectivelyDone ? theme.textTertiary : theme.textPrimary, textDecorationLine: isEffectivelyDone ? 'line-through' : 'none' }]} numberOfLines={2}>
                  {item.name}
                </Text>
                <View style={[s.catBadge, { backgroundColor: catColor.bg }]}>
                  <View style={[s.catDotSm, { backgroundColor: catColor.dot }]} />
                  <Text style={{ color: catColor.text, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>{item.category}</Text>
                </View>
              </View>
              {item.description ? <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>{item.description}</Text> : null}
              {checklist.settings.enableQuantity && item.requiredQty > 0 ? (
                <View style={s.qtyRow}>
                  <View style={[s.qtyBar, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[s.qtyBarFill, { width: `${Math.min((item.ownedQty / item.requiredQty) * 100, 100)}%`, backgroundColor: item.ownedQty >= item.requiredQty ? theme.success : theme.warning }]} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{item.ownedQty}/{item.requiredQty}</Text>
                </View>
              ) : null}
              {checklist.settings.enableNotes && item.notes ? (
                <>
                  <Pressable style={s.notesToggle} onPress={() => toggleNoteExpand(item.id)}>
                    <MaterialIcons name={expandedNotes.has(item.id) ? 'expand-less' : 'notes'} size={16} color={theme.textTertiary} />
                    <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{expandedNotes.has(item.id) ? 'Hide' : 'Notes'}</Text>
                  </Pressable>
                  {expandedNotes.has(item.id) ? (
                    <Animated.View entering={FadeIn.duration(200)} style={[s.notesBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                      <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{item.notes}</Text>
                    </Animated.View>
                  ) : null}
                </>
              ) : null}
            </View>

            {canEditItems ? (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable style={s.editBtn} onPress={() => setEditingItem(item)} hitSlop={8}>
                  <MaterialIcons name="edit" size={16} color={theme.textTertiary} />
                </Pressable>
                <Pressable style={s.editBtn} onPress={() => { if (checklist) deleteItem(checklist.id, item.id); }} hitSlop={8}>
                  <MaterialIcons name="close" size={16} color={theme.error + '80'} />
                </Pressable>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  // ============= RENDER SECTIONS =============
  const renderSections = () => {
    if (!checklist) return null;
    if (!checklist.settings.enableSections || checklist.sections.length === 0) {
      return checklist.items.map((item, idx) => renderItem(item, idx));
    }
    const unsectioned = checklist.items.filter(i => !i.sectionId);
    return (
      <>
        {checklist.sections.sort((a, b) => a.order - b.order).map((section, secIdx) => {
          const sItems = checklist.items.filter(i => i.sectionId === section.id);
          const secDone = sItems.filter(i => {
            if (useStatuses && i.status) return activeStatuses.find(st => st.id === i.status)?.isDone ?? false;
            return i.checked;
          }).length;
          const secPct = sItems.length > 0 ? Math.round((secDone / sItems.length) * 100) : 0;
          return (
            <Animated.View key={section.id} entering={FadeInDown.delay(secIdx * 40).duration(200)} style={{ marginBottom: 4 }}>
              <Pressable
                style={[s.sectionHeader, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => toggleSectionExpand(checklist.id, section.id)}
              >
                <MaterialIcons name={section.expanded ? 'expand-more' : 'chevron-right'} size={22} color={theme.textSecondary} />
                <Text style={[s.sectionName, { color: theme.textPrimary }]}>{section.name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{secDone}/{sItems.length}</Text>
                <View style={[s.sectionBar, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={[s.sectionBarFill, { width: `${secPct}%`, backgroundColor: secPct === 100 ? theme.success : theme.primary }]} />
                </View>
                <Text style={{ color: secPct === 100 ? theme.success : theme.textSecondary, fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' }}>{secPct}%</Text>
                {canStructure ? (
                  <Pressable onPress={() => deleteSection(checklist.id, section.id)} hitSlop={8} style={{ marginLeft: 4 }}>
                    <MaterialIcons name="close" size={16} color={theme.error + '60'} />
                  </Pressable>
                ) : null}
              </Pressable>
              {section.expanded ? (
                <Animated.View entering={FadeIn.duration(200)}>
                  {sItems.length === 0 ? (
                    <View style={[s.sectionEmpty, { borderColor: theme.border }]}>
                      <Text style={{ color: theme.textTertiary, fontSize: 13 }}>No items</Text>
                    </View>
                  ) : sItems.map((item, idx) => renderItem(item, idx))}
                </Animated.View>
              ) : null}
            </Animated.View>
          );
        })}
        {unsectioned.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <View style={[s.sectionHeader, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <MaterialIcons name="inbox" size={18} color={theme.textSecondary} />
              <Text style={[s.sectionName, { color: theme.textSecondary }]}>Unsorted</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{unsectioned.length}</Text>
            </View>
            {unsectioned.map((item, idx) => renderItem(item, idx))}
          </View>
        ) : null}
      </>
    );
  };

  // ============= LEFT PANEL (folders) =============
  const renderFolderPanel = () => (
    <View style={[s.panel, { backgroundColor: theme.background, borderRightWidth: isDesktop ? 1 : 0, borderRightColor: theme.border, width: isDesktop ? 280 : '100%' }]}>
      {/* Panel header */}
      <View style={[s.panelHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        {currentFolderId ? (
          <Pressable onPress={navigateBack} hitSlop={8} style={{ marginRight: 8 }}>
            <MaterialIcons name="arrow-back" size={20} color={theme.textPrimary} />
          </Pressable>
        ) : null}
        <MaterialIcons name="folder" size={20} color={theme.primary} />
        <Text style={[s.panelTitle, { color: theme.textPrimary }]} numberOfLines={1}>
          {currentFolderId ? (currentFolder?.name ?? 'Folder') : 'Folders'}
        </Text>
        <Pressable onPress={() => setShowCreateFolder(true)} hitSlop={8}>
          <MaterialIcons name="create-new-folder" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {/* Breadcrumb */}
      {currentFolderId && breadcrumb.length > 1 ? (
        <View style={[s.breadcrumbBar, { borderBottomColor: theme.border }]}>
          <Pressable onPress={() => setNavStack([null])}><MaterialIcons name="home" size={14} color={theme.textTertiary} /></Pressable>
          {breadcrumb.map((seg, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="chevron-right" size={14} color={theme.textTertiary} />
              <Text style={{ color: idx === breadcrumb.length - 1 ? theme.textPrimary : theme.textTertiary, fontSize: 11, fontWeight: idx === breadcrumb.length - 1 ? '700' : '400' }} numberOfLines={1}>{seg}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} showsVerticalScrollIndicator={false}>
        {/* Subfolders */}
        {childFolders.map((folder, idx) => {
          const clCount = getFolderChecklists(folder.id).length;
          return (
            <Animated.View key={folder.id} entering={FadeInDown.delay(idx * 30).duration(200)}>
              <Pressable
                style={[s.folderRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => navigateInto(folder.id)}
              >
                <MaterialIcons name="folder" size={22} color={folder.color} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{folder.name}</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{clCount} lists</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable onPress={() => { setEditingFolder({ id: folder.id, name: folder.name, color: folder.color }); setEditFolderName(folder.name); setEditFolderColor(folder.color); }} hitSlop={6}>
                    <MaterialIcons name="edit" size={14} color={theme.textTertiary} />
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteFolder(folder)} hitSlop={6}>
                    <MaterialIcons name="delete-outline" size={14} color={theme.error + '80'} />
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Checklists in folder */}
        {currentFolderId ? (
          <>
            <View style={s.sectionLabelRow}>
              <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>CHECKLISTS</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={[s.smallBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]} onPress={() => setShowImportShare(true)}>
                  <MaterialIcons name="download" size={14} color={theme.textSecondary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '600' }}>Import</Text>
                </Pressable>
                <Pressable style={[s.smallBtn, { backgroundColor: theme.primaryBg }]} onPress={() => setShowCreateChecklist(true)}>
                  <MaterialIcons name="add" size={14} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '600' }}>New</Text>
                </Pressable>
              </View>
            </View>
            {currentChecklists.length === 0 ? (
              <View style={[s.emptySmall, { borderColor: theme.border }]}>
                <Text style={{ color: theme.textTertiary, fontSize: 12 }}>No checklists</Text>
              </View>
            ) : currentChecklists.map((cl, idx) => {
              const done = cl.items.filter(i => i.checked).length;
              const tot = cl.items.length;
              const p = tot > 0 ? Math.round((done / tot) * 100) : 0;
              const isActive = checklist?.id === cl.id;
              return (
                <Animated.View key={cl.id} entering={FadeInDown.delay(idx * 30).duration(200)}>
                  <Pressable
                    style={[s.clRow, { backgroundColor: isActive ? theme.primaryBg : theme.surface, borderColor: isActive ? theme.primary : theme.border }]}
                    onPress={() => openChecklist(cl)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{cl.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <View style={[s.miniBar, { backgroundColor: theme.backgroundSecondary }]}>
                          <View style={[s.miniBarFill, { width: `${p}%`, backgroundColor: p === 100 ? theme.success : theme.primary }]} />
                        </View>
                        <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{p}%</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => confirmDeleteChecklist(cl)} hitSlop={6}>
                      <MaterialIcons name="delete-outline" size={16} color={theme.error + '60'} />
                    </Pressable>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        ) : null}

        {/* Root empty */}
        {!currentFolderId && childFolders.length === 0 ? (
          <View style={[s.emptySmall, { borderColor: theme.border, marginTop: 20, padding: 24 }]}>
            <MaterialIcons name="folder-open" size={40} color={theme.textTertiary} />
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8 }}>No folders yet</Text>
            <Pressable style={[s.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateFolder(true)}>
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Create Folder</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Desktop: mode switch at bottom */}
      {isDesktop ? (
        <View style={[s.panelFooter, { borderTopColor: theme.border, backgroundColor: theme.surface }]}>
          <Pressable
            style={[s.modeBtn, desktopMode === 'settings' ? { backgroundColor: theme.primaryBg } : null]}
            onPress={() => setDesktopMode('settings')}
          >
            <MaterialIcons name="settings" size={18} color={desktopMode === 'settings' ? theme.primary : theme.textTertiary} />
            <Text style={{ color: desktopMode === 'settings' ? theme.primary : theme.textTertiary, fontSize: 12, fontWeight: '600' }}>Settings</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  // ============= CENTER PANEL (checklist or settings) =============
  const renderCenterPanel = () => {
    if (desktopMode === 'settings') return renderSettingsCenter();
    if (!checklist) return (
      <View style={[s.panel, { flex: 1, backgroundColor: theme.background }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <MaterialIcons name="checklist" size={56} color={theme.textTertiary} />
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 12 }}>No Checklist Selected</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 4 }}>Select a checklist from the left panel</Text>
        </View>
      </View>
    );

    return (
      <View style={[s.panel, { flex: 1, backgroundColor: theme.background }]}>
        {/* Center header */}
        <View style={[s.panelHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <MaterialIcons name="checklist" size={20} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{checklist.name}</Text>
            {checklist.description ? <Text style={{ color: theme.textSecondary, fontSize: 12 }} numberOfLines={1}>{checklist.description}</Text> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {canShare ? <Pressable onPress={() => setShowShareModal(true)} hitSlop={8} style={[s.iconBtn, { backgroundColor: theme.primaryBg }]}><MaterialIcons name="share" size={18} color={theme.primary} /></Pressable> : null}
            <Pressable onPress={() => setShowExport(true)} hitSlop={8} style={[s.iconBtn, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="file-download" size={18} color={theme.textSecondary} /></Pressable>
            {canStructure ? <Pressable onPress={() => setShowChecklistSettings(true)} hitSlop={8} style={[s.iconBtn, { backgroundColor: theme.backgroundSecondary }]}><MaterialIcons name="tune" size={18} color={theme.textSecondary} /></Pressable> : null}
          </View>
        </View>

        {/* Segmented progress bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
          <SegmentedBar segments={segmentData} height={20} borderRadius={6} showLabels={true} textColor={theme.textSecondary} trackColor={theme.backgroundSecondary} />
        </View>

        {/* View toggle */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <View style={[s.toggleRow, { backgroundColor: theme.backgroundSecondary }]}>
            {(['interactive', 'stats'] as const).map(mode => (
              <Pressable key={mode} style={[s.toggleBtn, { backgroundColor: viewMode === mode ? theme.primary : 'transparent' }]} onPress={() => setViewMode(mode)}>
                <MaterialIcons name={mode === 'interactive' ? 'list' : 'bar-chart'} size={16} color={viewMode === mode ? '#FFF' : theme.textSecondary} />
                <Text style={{ color: viewMode === mode ? '#FFF' : theme.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4, textTransform: 'capitalize' }}>{mode}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {viewMode === 'stats' ? (
          <StatsView checklist={checklist} />
        ) : (
          <>
            {canStructure ? (
              <View style={[s.actionBar, { paddingHorizontal: 16 }]}>
                <Pressable style={[s.actionBtn, { backgroundColor: theme.primary }]} onPress={() => setShowAddItem(true)}>
                  <MaterialIcons name="add" size={16} color="#FFF" />
                  <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Add Item</Text>
                </Pressable>
                {checklist.settings.enableSections ? (
                  <Pressable style={[s.actionBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={() => setShowAddSection(true)}>
                    <MaterialIcons name="playlist-add" size={16} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Section</Text>
                  </Pressable>
                ) : null}
                <Pressable style={[s.actionBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]} onPress={() => setShowCSVImport(true)}>
                  <MaterialIcons name="upload-file" size={16} color={theme.textSecondary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>CSV</Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 80 }} showsVerticalScrollIndicator={false}>
              {totalCount === 0 ? (
                <View style={[s.emptySmall, { borderColor: theme.border, marginTop: 20, padding: 24 }]}>
                  <MaterialIcons name="add-task" size={40} color={theme.textTertiary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 8 }}>Start adding items</Text>
                </View>
              ) : renderSections()}
            </ScrollView>
          </>
        )}
      </View>
    );
  };

  // ============= RIGHT PANEL (stats or server config) =============
  const renderRightPanel = () => {
    if (desktopMode === 'settings') return renderServerPanel();
    if (!checklist) return (
      <View style={[s.panel, { width: 320, backgroundColor: theme.background, borderLeftWidth: 1, borderLeftColor: theme.border }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <MaterialIcons name="bar-chart" size={48} color={theme.textTertiary} />
          <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' }}>Select a checklist to view statistics</Text>
        </View>
      </View>
    );
    return (
      <View style={[s.panel, { width: 320, backgroundColor: theme.background, borderLeftWidth: 1, borderLeftColor: theme.border }]}>
        <View style={[s.panelHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <MaterialIcons name="bar-chart" size={20} color={theme.primary} />
          <Text style={[s.panelTitle, { color: theme.textPrimary }]}>Statistics</Text>
        </View>
        <StatsView checklist={checklist} />
      </View>
    );
  };

  // ============= SETTINGS CENTER PANEL =============
  const renderSettingsCenter = () => {
    const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
    const completedItemsTotal = checklists.reduce((sum, cl) => sum + cl.items.filter(i => i.checked).length, 0);
    return (
      <View style={[s.panel, { flex: 1, backgroundColor: theme.background }]}>
        <View style={[s.panelHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <MaterialIcons name="settings" size={20} color={theme.primary} />
          <Text style={[s.panelTitle, { color: theme.textPrimary }]}>Settings</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ color: theme.textTertiary, fontSize: 12 }}>v{APP_VERSION}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {/* Stats summary */}
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row' }}>
              {[{ v: folders.length, l: 'Folders', c: theme.primary }, { v: checklists.length, l: 'Lists', c: theme.primary }, { v: completedItemsTotal, l: 'Done', c: theme.success }, { v: totalItems, l: 'Total', c: theme.textPrimary }].map((st, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '700', color: st.c }}>{st.v}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', marginTop: 2 }}>{st.l}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Appearance */}
          <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>APPEARANCE</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={s.settingRow}>
              <MaterialIcons name="brightness-auto" size={18} color={theme.textSecondary} />
              <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>Follow System Theme</Text>
              {renderToggle(settings.systemDarkMode, () => updateSettings({ systemDarkMode: !settings.systemDarkMode }))}
            </View>
            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
            <View style={s.settingRow}>
              <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={18} color={theme.textSecondary} />
              <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>Dark Mode</Text>
              {renderToggle(settings.darkMode, () => updateSettings({ darkMode: !settings.darkMode }), settings.systemDarkMode)}
            </View>
          </View>

          {/* Chart type */}
          <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>CHART TYPE</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['bar', 'pie'] as const).map(ct => (
                <Pressable key={ct} style={[s.optionBtn, { backgroundColor: settings.chartType === ct ? theme.primaryBg : theme.backgroundSecondary, borderColor: settings.chartType === ct ? theme.primary : theme.border }]}
                  onPress={() => updateSettings({ chartType: ct })}>
                  <MaterialIcons name={ct === 'bar' ? 'stacked-bar-chart' : 'pie-chart'} size={16} color={settings.chartType === ct ? theme.primary : theme.textTertiary} />
                  <Text style={{ color: settings.chartType === ct ? theme.primary : theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize', marginLeft: 6 }}>{ct === 'bar' ? 'Bar Mode' : 'Pie Mode'}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Sync */}
          {isServerConnected && hasProfile ? (
            <>
              <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>DEVICE SYNC</Text>
              <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[s.connBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
                  <MaterialIcons name="check-circle" size={16} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Connected as {settings.serverDisplayName || settings.serverUsername}</Text>
                </View>
                {settings.lastSyncTime ? <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 8 }}>Last synced: {new Date(settings.lastSyncTime).toLocaleString()}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable style={[s.syncBtn, { backgroundColor: theme.primary }]} onPress={() => handleSync('push')} disabled={serverBusy}>
                    {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="cloud-upload" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Push</Text></>}
                  </Pressable>
                  <Pressable style={[s.syncBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={() => handleSync('pull')} disabled={serverBusy}>
                    {serverBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <><MaterialIcons name="cloud-download" size={16} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Pull</Text></>}
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}

          {/* Privacy */}
          <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>PRIVACY & DATA</Text>
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} onPress={handleDeleteAllData}>
              <MaterialIcons name="delete-forever" size={20} color={theme.error} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.error, fontSize: 14, fontWeight: '600' }}>Delete All Data</Text>
                <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Remove everything from this device</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{APP_NAME} v{APP_VERSION}</Text>
          </View>
        </ScrollView>
      </View>
    );
  };

  // ============= SERVER PANEL (right panel when settings) =============
  const renderServerPanel = () => (
    <View style={[s.panel, { width: 320, backgroundColor: theme.background, borderLeftWidth: 1, borderLeftColor: theme.border }]}>
      <View style={[s.panelHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <MaterialIcons name="dns" size={20} color={theme.primary} />
        <Text style={[s.panelTitle, { color: theme.textPrimary }]}>Server</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
        {isServerConnected && hasProfile ? (
          <>
            <View style={[s.connBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
              <MaterialIcons name="check-circle" size={16} color={theme.success} />
              <Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', marginLeft: 6, flex: 1 }}>Connected</Text>
            </View>
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 12 }]}>
              <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Server URL</Text>
              <Text style={{ color: theme.textPrimary, fontSize: 13, marginTop: 2 }}>{settings.serverUrl}</Text>
              <View style={[s.divider, { backgroundColor: theme.borderLight, marginVertical: 10 }]} />
              <Text style={{ color: theme.textTertiary, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Account</Text>
              <Text style={{ color: theme.textPrimary, fontSize: 13, marginTop: 2 }}>{settings.serverDisplayName || settings.serverUsername}</Text>
            </View>
            <Pressable style={[s.dangerBtn, { borderColor: theme.error + '40', marginTop: 12 }]} onPress={handleDisconnectServer}>
              <MaterialIcons name="link-off" size={16} color={theme.error} />
              <Text style={{ color: theme.error, fontSize: 13, fontWeight: '600' }}>Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 16 }}>
              Connect to a server to sync lists between devices and share with others.
            </Text>
            <Text style={[s.inputLabel, { color: theme.textTertiary }]}>SERVER URL</Text>
            <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectUrl} onChangeText={setConnectUrl} placeholder="http://192.168.1.100:3847" placeholderTextColor={theme.textTertiary} autoCapitalize="none" autoCorrect={false} />
            <Text style={[s.inputLabel, { color: theme.textTertiary }]}>API KEY</Text>
            <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectKey} onChangeText={setConnectKey} placeholder="Your server API key" placeholderTextColor={theme.textTertiary} autoCapitalize="none" secureTextEntry />
            <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: connectUrl.trim() && connectKey.trim() ? 1 : 0.5 }]} onPress={handleTestAndConnect} disabled={!connectUrl.trim() || !connectKey.trim() || serverBusy}>
              {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Test & Connect</Text>}
            </Pressable>
            {connectStep === 'auth' ? (
              <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 16 }}>
                <View style={[s.connBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40', marginBottom: 12 }]}>
                  <MaterialIcons name="check-circle" size={16} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Server connected</Text>
                </View>
                <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                  {(['register', 'login'] as const).map(m => (
                    <Pressable key={m} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: authMode === m ? theme.primary : theme.backgroundSecondary }} onPress={() => setAuthMode(m)}>
                      <Text style={{ color: authMode === m ? '#FFF' : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{m === 'register' ? 'Sign Up' : 'Log In'}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authUsername} onChangeText={setAuthUsername} placeholder="Username" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authPassword} onChangeText={setAuthPassword} placeholder="Password" placeholderTextColor={theme.textTertiary} secureTextEntry />
                {authMode === 'register' ? <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authDisplay} onChangeText={setAuthDisplay} placeholder="Display name (optional)" placeholderTextColor={theme.textTertiary} /> : null}
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: authUsername.trim() && authPassword.trim() ? 1 : 0.5 }]} onPress={handleAuth} disabled={!authUsername.trim() || !authPassword.trim() || authBusy}>
                  {authBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{authMode === 'register' ? 'Create Account' : 'Log In'}</Text>}
                </Pressable>
              </Animated.View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );

  const renderToggle = (value: boolean, onToggle: () => void, disabled?: boolean) => (
    <Pressable style={[s.toggleSwitch, { backgroundColor: value ? theme.primary : theme.backgroundSecondary, opacity: disabled ? 0.5 : 1 }]} onPress={() => { if (!disabled) onToggle(); }}>
      <View style={[s.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
    </Pressable>
  );

  // ============= DESKTOP THREE-PANEL LAYOUT =============
  if (isDesktop) {
    return (
      <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: theme.background }]}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {renderFolderPanel()}
          {renderCenterPanel()}
          {renderRightPanel()}
        </View>

        {/* All modals */}
        {renderModals()}
      </SafeAreaView>
    );
  }

  // ============= MOBILE LAYOUT (folders only — checklist is separate tab) =============
  const rootFolders = getFolderChildren(null);
  const totalChecklistCount = checklists.length;

  return (
    <SafeAreaView edges={['top']} style={[{ flex: 1, backgroundColor: theme.background }]}>
      <PageHeader
        title={currentFolderId ? (currentFolder?.name ?? 'Folder') : 'Folders'}
        subtitle={currentFolderId ? `${currentChecklists.length} checklists` : `${rootFolders.length} folders`}
        icon="folder"
        leftAction={currentFolderId ? (
          <Pressable style={[s.backBtnMobile, { backgroundColor: theme.backgroundSecondary }]} onPress={navigateBack} hitSlop={8}>
            <MaterialIcons name="arrow-back" size={20} color={theme.textPrimary} />
          </Pressable>
        ) : undefined}
        rightAction={<Pressable style={[s.iconBtn, { backgroundColor: theme.primaryBg }]} onPress={() => setShowCreateFolder(true)} hitSlop={8}><MaterialIcons name="create-new-folder" size={20} color={theme.primary} /></Pressable>}
      />

      {currentFolderId && breadcrumb.length > 1 ? (
        <View style={[s.breadcrumbBar, { paddingHorizontal: contentPadding, borderBottomColor: theme.border }]}>
          <Pressable onPress={() => setNavStack([null])}><MaterialIcons name="home" size={14} color={theme.textTertiary} /></Pressable>
          {breadcrumb.map((seg, idx) => (
            <View key={idx} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="chevron-right" size={14} color={theme.textTertiary} />
              <Text style={{ color: idx === breadcrumb.length - 1 ? theme.textPrimary : theme.textTertiary, fontSize: 12, fontWeight: idx === breadcrumb.length - 1 ? '700' : '400' }}>{seg}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        {childFolders.map((folder, idx) => {
          const clCount = getFolderChecklists(folder.id).length;
          return (
            <Animated.View key={folder.id} entering={FadeInDown.delay(idx * 40).duration(200)}>
              <Pressable style={[s.folderCard, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => navigateInto(folder.id)}>
                <View style={[s.folderIconWrap, { backgroundColor: folder.color + '18' }]}><MaterialIcons name="folder" size={26} color={folder.color} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>{folder.name}</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{clCount} checklists</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Pressable onPress={() => { setEditingFolder({ id: folder.id, name: folder.name, color: folder.color }); setEditFolderName(folder.name); setEditFolderColor(folder.color); }} hitSlop={8}>
                    <MaterialIcons name="edit" size={16} color={theme.textTertiary} />
                  </Pressable>
                  <Pressable onPress={() => confirmDeleteFolder(folder)} hitSlop={8}>
                    <MaterialIcons name="delete-outline" size={16} color={theme.error + '80'} />
                  </Pressable>
                  <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
                </View>
              </Pressable>
            </Animated.View>
          );
        })}

        {currentFolderId ? (
          <>
            <View style={[s.sectionLabelRow, { marginTop: 12 }]}>
              <Text style={[s.sectionLabel, { color: theme.textTertiary }]}>CHECKLISTS</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable style={[s.smallBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]} onPress={() => setShowImportShare(true)}>
                  <MaterialIcons name="download" size={16} color={theme.textSecondary} />
                  <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>Import</Text>
                </Pressable>
                <Pressable style={[s.smallBtn, { backgroundColor: theme.primaryBg }]} onPress={() => setShowCreateChecklist(true)}>
                  <MaterialIcons name="add" size={16} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>New</Text>
                </Pressable>
              </View>
            </View>
            {currentChecklists.length === 0 ? (
              <View style={[s.emptySmall, { borderColor: theme.border, padding: 24, marginTop: 8 }]}>
                <MaterialIcons name="playlist-add" size={40} color={theme.textTertiary} />
                <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 8 }}>No checklists yet</Text>
                <Pressable style={[s.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateChecklist(true)}>
                  <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Create Checklist</Text>
                </Pressable>
              </View>
            ) : currentChecklists.map((cl, idx) => {
              const done = cl.items.filter(i => i.checked).length;
              const tot = cl.items.length;
              const p = tot > 0 ? Math.round((done / tot) * 100) : 0;
              return (
                <Animated.View key={cl.id} entering={FadeInDown.delay(idx * 40).duration(200)}>
                  <Pressable style={[s.clCardMobile, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={() => openChecklist(cl)}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>{cl.name}</Text>
                      {cl.description ? <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{cl.description}</Text> : null}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <View style={[s.miniBar, { backgroundColor: theme.backgroundSecondary, flex: 1, height: 5 }]}>
                          <View style={[s.miniBarFill, { width: `${p}%`, backgroundColor: p === 100 ? theme.success : theme.primary }]} />
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{p}% ({done}/{tot})</Text>
                      </View>
                    </View>
                    <Pressable onPress={() => confirmDeleteChecklist(cl)} hitSlop={8} style={{ marginLeft: 8 }}>
                      <MaterialIcons name="delete-outline" size={18} color={theme.error + '60'} />
                    </Pressable>
                  </Pressable>
                </Animated.View>
              );
            })}
          </>
        ) : null}

        {!currentFolderId && childFolders.length === 0 ? (
          <View style={[s.emptySmall, { borderColor: theme.border, marginTop: 40, padding: 32 }]}>
            <MaterialIcons name="folder-open" size={56} color={theme.textTertiary} />
            <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 12 }}>No folders yet</Text>
            <Pressable style={[s.emptyBtn, { backgroundColor: theme.primary }]} onPress={() => setShowCreateFolder(true)}>
              <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Create Folder</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {renderModals()}
    </SafeAreaView>
  );

  // ============= ALL MODALS =============
  function renderModals() {
    return (
      <>
        {/* Create Folder */}
        <Modal visible={showCreateFolder} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>New Folder</Text>
                <Pressable onPress={() => setShowCreateFolder(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={[s.inputLabel, { color: theme.textTertiary }]}>NAME</Text>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newFolderName} onChangeText={setNewFolderName} placeholder="Folder name" placeholderTextColor={theme.textTertiary} autoFocus />
                <Text style={[s.inputLabel, { color: theme.textTertiary }]}>COLOR</Text>
                <View style={s.colorRow}>{FOLDER_COLORS.map(c => <Pressable key={c} style={[s.colorDot, { backgroundColor: c, borderWidth: newFolderColor === c ? 3 : 0, borderColor: theme.textPrimary }]} onPress={() => setNewFolderColor(c)} />)}</View>
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: newFolderName.trim() ? 1 : 0.5 }]} onPress={handleCreateFolder} disabled={!newFolderName.trim()}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Edit Folder */}
        <Modal visible={!!editingFolder} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Edit Folder</Text>
                <Pressable onPress={() => setEditingFolder(null)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={editFolderName} onChangeText={setEditFolderName} autoFocus />
                <View style={s.colorRow}>{FOLDER_COLORS.map(c => <Pressable key={c} style={[s.colorDot, { backgroundColor: c, borderWidth: editFolderColor === c ? 3 : 0, borderColor: theme.textPrimary }]} onPress={() => setEditFolderColor(c)} />)}</View>
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: editFolderName.trim() ? 1 : 0.5 }]} onPress={handleEditFolder} disabled={!editFolderName.trim()}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Checklist */}
        <Modal visible={showCreateChecklist} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>New Checklist</Text>
                <Pressable onPress={() => setShowCreateChecklist(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newChecklistName} onChangeText={setNewChecklistName} placeholder="Checklist name" placeholderTextColor={theme.textTertiary} autoFocus />
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newChecklistDesc} onChangeText={setNewChecklistDesc} placeholder="Description (optional)" placeholderTextColor={theme.textTertiary} />
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {([{ key: 'basic', label: 'Basic', desc: 'Name + Description' }, { key: 'quantity', label: 'Quantity', desc: 'Name + Quantity Tracking' }, { key: 'full', label: 'Full', desc: 'All features' }] as const).map(t => (
                    <Pressable key={t.key} style={[s.typeCard, { backgroundColor: newChecklistType === t.key ? theme.primaryBg : theme.backgroundSecondary, borderColor: newChecklistType === t.key ? theme.primary : theme.border }]} onPress={() => setNewChecklistType(t.key)}>
                      <MaterialIcons name={newChecklistType === t.key ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={newChecklistType === t.key ? theme.primary : theme.textTertiary} />
                      <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>{t.label}</Text><Text style={{ color: theme.textSecondary, fontSize: 12 }}>{t.desc}</Text></View>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: newChecklistName.trim() ? 1 : 0.5 }]} onPress={handleCreateChecklist} disabled={!newChecklistName.trim()}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Create</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Import */}
        <Modal visible={showImportShare} animationType="slide" transparent>
          <KeyboardAvoidingView style={[s.modalOverlay, { backgroundColor: theme.overlay }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Import Shared</Text>
                <Pressable onPress={() => { setShowImportShare(false); setImportPasteText(''); }} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 12 }}>Paste the shared checklist message including CHECKMASTER markers.</Text>
                <TextInput style={[s.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={importPasteText} onChangeText={setImportPasteText} multiline textAlignVertical="top" placeholder="Paste here..." placeholderTextColor={theme.textTertiary} />
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: importPasteText.trim().length > 20 ? 1 : 0.45 }]} onPress={handleImportShared} disabled={importPasteText.trim().length < 21}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Import</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Add Section */}
        <Modal visible={showAddSection} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>New Section</Text>
                <Pressable onPress={() => setShowAddSection(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newSectionName} onChangeText={setNewSectionName} placeholder="Section name" placeholderTextColor={theme.textTertiary} autoFocus />
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: newSectionName.trim() ? 1 : 0.5 }]} onPress={handleAddSection} disabled={!newSectionName.trim()}>
                  <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Add Section</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Status picker dropdown */}
        <Modal visible={!!showStatusPicker} animationType="fade" transparent>
          <Pressable style={[s.modalOverlay, { backgroundColor: theme.overlay }]} onPress={() => setShowStatusPicker(null)}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, margin: 24, borderRadius: 20 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Set Status</Text>
                <Pressable onPress={() => setShowStatusPicker(null)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20, gap: 8 }}>
                {activeStatuses.map(st => {
                  const itemId = showStatusPicker!;
                  const item = checklist?.items.find(i => i.id === itemId);
                  const isActive = (item?.status ?? activeStatuses[0]?.id) === st.id;
                  return (
                    <Pressable key={st.id} style={[s.statusPickerRow, { backgroundColor: isActive ? st.color + '22' : theme.backgroundSecondary, borderColor: isActive ? st.color : theme.border }]}
                      onPress={() => { if (checklist) setItemStatus(checklist.id, itemId, st.id); setShowStatusPicker(null); }}>
                      <View style={[s.statusDotLg, { backgroundColor: st.color }]} />
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

        {/* Add Status */}
        <Modal visible={showAddStatus} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>New Status</Text>
                <Pressable onPress={() => setShowAddStatus(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20 }}>
                <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={newStatusLabel} onChangeText={setNewStatusLabel} placeholder="Status label" placeholderTextColor={theme.textTertiary} autoFocus />
                <View style={s.colorRow}>{STATUS_COLORS.map(c => <Pressable key={c} style={[s.colorDot, { backgroundColor: c, borderWidth: newStatusColor === c ? 3 : 0, borderColor: theme.textPrimary }]} onPress={() => setNewStatusColor(c)} />)}</View>
                <Pressable style={[s.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => setNewStatusIsDone(v => !v)}>
                  <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1 }}>Counts as completed</Text>
                  {renderToggle(newStatusIsDone, () => setNewStatusIsDone(v => !v))}
                </Pressable>
                <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary, opacity: newStatusLabel.trim() ? 1 : 0.5, marginTop: 12 }]} onPress={() => {
                  if (!newStatusLabel.trim() || !checklist) return;
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

        {/* Checklist Settings */}
        <Modal visible={showChecklistSettings} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, maxHeight: '80%' }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Checklist Settings</Text>
                <Pressable onPress={() => setShowChecklistSettings(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              {checklist ? (
                <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
                  {([{ key: 'enableQuantity', label: 'Quantity Tracking', icon: 'tag' as const }, { key: 'enableNotes', label: 'Notes', icon: 'notes' as const }, { key: 'enableImages', label: 'Images', icon: 'image' as const }, { key: 'enableSections', label: 'Sections', icon: 'view-list' as const }] as const).map(opt => (
                    <Pressable key={opt.key} style={[s.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => updateChecklist(checklist.id, { settings: { ...checklist.settings, [opt.key]: !checklist.settings[opt.key] } })}>
                      <MaterialIcons name={opt.icon} size={20} color={theme.textSecondary} />
                      <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>{opt.label}</Text>
                      {renderToggle(checklist.settings[opt.key], () => {})}
                    </Pressable>
                  ))}

                  <Text style={[s.sectionLabel, { color: theme.textTertiary, marginTop: 16 }]}>STATUSES</Text>
                  <Pressable style={[s.settingRow, { borderBottomColor: theme.borderLight }]} onPress={() => {
                    const next = useStatuses ? [] : [...DEFAULT_ITEM_STATUSES];
                    updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: next } });
                  }}>
                    <MaterialIcons name="label" size={20} color={theme.textSecondary} />
                    <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10 }}>Custom Statuses</Text>
                    {renderToggle(useStatuses, () => {})}
                  </Pressable>
                  {useStatuses ? (
                    <View style={{ marginTop: 8, marginBottom: 16 }}>
                      {activeStatuses.map(st => (
                        <View key={st.id} style={[s.statusEditRow, { borderColor: theme.border }]}>
                          <View style={[s.statusDotLg, { backgroundColor: st.color }]} />
                          <Text style={{ color: theme.textPrimary, fontSize: 13, flex: 1 }}>{st.label}</Text>
                          {st.isDone ? <View style={[s.doneBadge, { backgroundColor: theme.successBg }]}><Text style={{ color: theme.success, fontSize: 9, fontWeight: '700' }}>DONE</Text></View> : null}
                          <Pressable onPress={() => updateChecklist(checklist.id, { settings: { ...checklist.settings, itemStatuses: activeStatuses.filter(s2 => s2.id !== st.id) } })} hitSlop={8}>
                            <MaterialIcons name="remove-circle-outline" size={18} color={theme.error} />
                          </Pressable>
                        </View>
                      ))}
                      <Pressable style={[s.addStatusBtn, { borderColor: theme.primary }]} onPress={() => { setNewStatusLabel(''); setNewStatusColor(STATUS_COLORS[activeStatuses.length % STATUS_COLORS.length]); setNewStatusIsDone(false); setShowAddStatus(true); }}>
                        <MaterialIcons name="add" size={16} color={theme.primary} />
                        <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Add Status</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Export Modal */}
        <Modal visible={showExport} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>Export Checklist</Text>
                <Pressable onPress={() => setShowExport(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <View style={{ paddingHorizontal: 20, gap: 10 }}>
                <Pressable style={[s.exportBtn, { backgroundColor: theme.primary }]} onPress={handleExportCSV}>
                  <MaterialIcons name="table-chart" size={20} color="#FFF" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Copy as CSV</Text>
                    <Text style={{ color: '#FFF', fontSize: 11, opacity: 0.8 }}>Comma-separated values</Text>
                  </View>
                  {exportCopied === 'csv' ? <MaterialIcons name="check" size={20} color="#FFF" /> : <MaterialIcons name="content-copy" size={18} color="#FFF" />}
                </Pressable>
                <Pressable style={[s.exportBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={handleExportText}>
                  <MaterialIcons name="description" size={20} color={theme.primary} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>Copy as Text</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>Human-readable summary</Text>
                  </View>
                  {exportCopied === 'text' ? <MaterialIcons name="check" size={20} color={theme.primary} /> : <MaterialIcons name="content-copy" size={18} color={theme.primary} />}
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Connect to Server Modal (mobile) */}
        <Modal visible={showConnectModal} animationType="slide" transparent>
          <View style={[s.modalOverlay, { backgroundColor: theme.overlay }]}>
            <View style={[s.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16, maxHeight: '85%' }]}>
              <View style={s.modalHeader}>
                <Text style={[s.modalTitle, { color: theme.textPrimary }]}>{connectStep === 'credentials' ? 'Connect' : 'Account'}</Text>
                <Pressable onPress={() => setShowConnectModal(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
              </View>
              <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
                {connectStep === 'credentials' ? (
                  <>
                    <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectUrl} onChangeText={setConnectUrl} placeholder="Server URL" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
                    <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectKey} onChangeText={setConnectKey} placeholder="API Key" placeholderTextColor={theme.textTertiary} secureTextEntry autoCapitalize="none" />
                    <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleTestAndConnect} disabled={serverBusy}>
                      {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Test Connection</Text>}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                      {(['register', 'login'] as const).map(m => (
                        <Pressable key={m} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: authMode === m ? theme.primary : theme.backgroundSecondary }} onPress={() => setAuthMode(m)}>
                          <Text style={{ color: authMode === m ? '#FFF' : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{m === 'register' ? 'Sign Up' : 'Log In'}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authUsername} onChangeText={setAuthUsername} placeholder="Username" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
                    <TextInput style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authPassword} onChangeText={setAuthPassword} placeholder="Password" placeholderTextColor={theme.textTertiary} secureTextEntry />
                    <Pressable style={[s.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleAuth} disabled={authBusy}>
                      {authBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{authMode === 'register' ? 'Create Account' : 'Log In'}</Text>}
                    </Pressable>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Item edit */}
        {checklist ? (
          <>
            <ItemEditModal visible={showAddItem || !!editingItem} onClose={() => { setShowAddItem(false); setEditingItem(null); }} checklistId={checklist.id} item={editingItem} sections={checklist.sections} enableQuantity={checklist.settings.enableQuantity} enableNotes={checklist.settings.enableNotes} enableImages={checklist.settings.enableImages} defaultCategory={checklist.settings.defaultCategory} />
            <CSVImportModal visible={showCSVImport} onClose={() => setShowCSVImport(false)} checklistId={checklist.id} />
            <ShareChecklistModal visible={showShareModal} onClose={() => setShowShareModal(false)} checklist={checklist} />
          </>
        ) : null}
      </>
    );
  }
}

const s = StyleSheet.create({
  panel: { flexDirection: 'column' },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  panelTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  panelFooter: { borderTopWidth: 1, padding: 8 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 8 },
  breadcrumbBar: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  backBtnMobile: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Folder rows
  folderRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  folderCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  folderIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Checklist rows
  clRow: { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 6 },
  clCardMobile: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  miniBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 2 },

  // Section labels
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },

  // Items
  itemCard: { borderRadius: 10, marginBottom: 4, borderWidth: 1, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 10, gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  statusDropdown: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, minWidth: 70, maxWidth: 100, marginTop: 1 },
  statusDotSm: { width: 7, height: 7, borderRadius: 4 },
  statusDotLg: { width: 10, height: 10, borderRadius: 5 },
  itemNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemName: { fontSize: 14, fontWeight: '600', flex: 1 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  catDotSm: { width: 5, height: 5, borderRadius: 3 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  qtyBar: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  qtyBarFill: { height: 4, borderRadius: 2 },
  notesToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  notesBox: { marginTop: 4, padding: 8, borderRadius: 6, borderWidth: 1 },
  editBtn: { padding: 4, borderRadius: 6 },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, marginBottom: 4, borderWidth: 1 },
  sectionName: { fontSize: 13, fontWeight: '700', flex: 1 },
  sectionBar: { width: 40, height: 3, borderRadius: 2, overflow: 'hidden' },
  sectionBarFill: { height: 3, borderRadius: 2 },
  sectionEmpty: { paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, marginBottom: 4 },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 4, borderRadius: 10, padding: 3 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 8 },
  actionBar: { flexDirection: 'row', gap: 6, paddingVertical: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },

  // Empty
  emptySmall: { alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1 },
  emptyBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },

  // Cards & Settings
  card: { borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  divider: { height: 1, marginVertical: 2 },
  toggleSwitch: { width: 42, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },
  optionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
  connBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },

  // Status management
  statusEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, marginBottom: 4 },
  doneBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginRight: 4 },
  addStatusBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', marginTop: 4 },
  statusPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },

  // Export
  exportBtn: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12 },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4, textTransform: 'uppercase' },
  input: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, marginBottom: 12 },
  textArea: { minHeight: 120, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 13, marginBottom: 12 },
  primaryBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  typeCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5 },
});
