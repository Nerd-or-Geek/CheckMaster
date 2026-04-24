import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform, TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { APP_NAME, APP_VERSION } from '../../constants/config';

export default function SettingsScreen() {
  const {
    settings, updateSettings, folders, checklists,
    testSyncServer, pushDataToServer, pullDataFromServer,
    registerServerProfile, loginServerProfile,
  } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { contentPadding } = useResponsive();
  const [serverBusy, setServerBusy] = useState(false);

  // Server connection modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [connectKey, setConnectKey] = useState('');
  const [connectStep, setConnectStep] = useState<'credentials' | 'auth'>('credentials');
  const [connectTested, setConnectTested] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplay, setAuthDisplay] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const isConnected = !!(settings.serverUrl && settings.serverApiKey);
  const hasProfile = !!(settings.serverUsername);

  const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
  const completedItems = checklists.reduce((sum, cl) => sum + cl.items.filter(i => i.checked).length, 0);

  const renderToggle = (value: boolean, onToggle: () => void) => (
    <Pressable
      style={[styles.toggleSwitch, { backgroundColor: value ? theme.primary : theme.backgroundSecondary }]}
      onPress={() => { Haptics.selectionAsync(); onToggle(); }}
    >
      <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
    </Pressable>
  );

  const renderOption = (label: string, isActive: boolean, onPress: () => void) => (
    <Pressable
      style={[styles.optionBtn, {
        backgroundColor: isActive ? theme.primaryBg : theme.backgroundSecondary,
        borderColor: isActive ? theme.primary : theme.border,
      }]}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
    >
      <Text style={{ color: isActive ? theme.primary : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  const handleOpenConnect = () => {
    setConnectUrl(settings.serverUrl || '');
    setConnectKey(settings.serverApiKey || '');
    setConnectStep('credentials');
    setConnectTested(false);
    setAuthUsername('');
    setAuthPassword('');
    setAuthDisplay('');
    setAuthMode(hasProfile ? 'login' : 'register');
    setShowConnectModal(true);
  };

  const handleTestAndNext = async () => {
    setServerBusy(true);
    const r = await testSyncServer();
    setServerBusy(false);
    if (!r.ok) { Alert.alert('Connection failed', r.error); return; }
    // Save URL + key so auth calls use them
    updateSettings({ serverUrl: connectUrl.trim(), serverApiKey: connectKey.trim() });
    setConnectTested(true);
    setConnectStep('auth');
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      Alert.alert('Required', 'Username and password cannot be empty.'); return;
    }
    setAuthBusy(true);
    const r = authMode === 'register'
      ? await registerServerProfile(authUsername, authPassword, authDisplay || undefined)
      : await loginServerProfile(authUsername, authPassword);
    setAuthBusy(false);
    if (!r.ok) { Alert.alert(authMode === 'register' ? 'Registration failed' : 'Login failed', r.error); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateSettings({ storageMode: 'cloud' });
    setShowConnectModal(false);
  };



  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingHorizontal: contentPadding }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Settings</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Summary */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{folders.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Folders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{checklists.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Checklists</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.success }]}>{completedItems}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Done</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>{totalItems}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
            </View>
          </View>
        </View>

        {/* Data Storage */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DATA STORAGE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            style={[styles.storageOption, {
              borderColor: settings.storageMode === 'local' ? theme.primary : theme.border,
              backgroundColor: settings.storageMode === 'local' ? theme.primaryBg : 'transparent',
            }]}
            onPress={() => { Haptics.selectionAsync(); updateSettings({ storageMode: 'local' }); }}
          >
            <MaterialIcons
              name={settings.storageMode === 'local' ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={22}
              color={settings.storageMode === 'local' ? theme.primary : theme.textTertiary}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Local</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Stored on this device only</Text>
            </View>
            <MaterialIcons name="phone-android" size={22} color={theme.textTertiary} />
          </Pressable>

          <Pressable
            style={[styles.storageOption, {
              borderColor: settings.storageMode === 'cloud' ? theme.primary : theme.border,
              backgroundColor: settings.storageMode === 'cloud' ? theme.primaryBg : 'transparent',
              marginTop: 8,
              opacity: isConnected ? 1 : 0.5,
            }]}
            onPress={() => {
              if (!isConnected) { Alert.alert('Not connected', 'Connect to a server first.'); return; }
              Haptics.selectionAsync();
              updateSettings({ storageMode: 'cloud' });
            }}
          >
            <MaterialIcons
              name={settings.storageMode === 'cloud' ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={22}
              color={settings.storageMode === 'cloud' ? theme.primary : theme.textTertiary}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Server</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Sync &amp; share across devices</Text>
            </View>
            <MaterialIcons name="cloud" size={22} color={theme.textTertiary} />
          </Pressable>
        </View>

        {/* Server / Profile */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SERVER</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {isConnected && hasProfile ? (
            // ── Logged-in profile card ──────────────────────────────────────
            <>
              <View style={[styles.profileRow, { borderBottomColor: theme.borderLight }]}>
                <View style={[styles.profileAvatar, { backgroundColor: theme.primaryBg }]}>
                  <MaterialIcons name="person" size={28} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '700' }}>
                    {settings.serverDisplayName || settings.serverUsername}
                  </Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13 }}>@{settings.serverUsername}</Text>
                  <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                    {settings.serverUrl}
                  </Text>
                </View>
                <View style={[styles.connectedDot, { backgroundColor: theme.success }]} />
              </View>
              <View style={{ gap: 8, padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[styles.cloudBtn, { backgroundColor: theme.primary, flex: 1 }]}
                    disabled={serverBusy}
                    onPress={async () => {
                      Haptics.selectionAsync();
                      setServerBusy(true);
                      const r = await pushDataToServer();
                      setServerBusy(false);
                      if (r.ok) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert('Uploaded', 'Data saved to server.'); }
                      else Alert.alert('Upload failed', r.error);
                    }}
                  >
                    {serverBusy ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialIcons name="cloud-upload" size={18} color="#FFF" />}
                    <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Upload</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cloudBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1, flex: 1 }]}
                    disabled={serverBusy}
                    onPress={() => {
                      Alert.alert('Replace this device?', 'Downloads will overwrite local data.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Download', style: 'destructive', onPress: async () => {
                          setServerBusy(true);
                          const r = await pullDataFromServer();
                          setServerBusy(false);
                          if (r.ok) Alert.alert('Downloaded', 'Data loaded from server.');
                          else Alert.alert('Download failed', r.error);
                        }},
                      ]);
                    }}
                  >
                    <MaterialIcons name="cloud-download" size={18} color={theme.textPrimary} />
                    <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '600' }}>Download</Text>
                  </Pressable>
                </View>
                <Text style={{ color: theme.textTertiary, fontSize: 12, textAlign: 'center' }}>
                  Last sync: {settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleString() : 'Never'}
                </Text>
                <Pressable
                  style={[styles.cloudBtn, { borderColor: theme.error, borderWidth: 1 }]}
                  onPress={() => {
                    Alert.alert('Disconnect?', 'You will stay in Local mode. Server data is not deleted.', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Disconnect', style: 'destructive', onPress: () => {
                        updateSettings({ serverUrl: '', serverApiKey: '', serverUsername: undefined, serverDisplayName: undefined, storageMode: 'local' });
                      }},
                    ]);
                  }}
                >
                  <MaterialIcons name="link-off" size={18} color={theme.error} />
                  <Text style={{ color: theme.error, fontSize: 13, fontWeight: '600' }}>Disconnect</Text>
                </Pressable>
              </View>
            </>
          ) : (
            // ── Not connected ───────────────────────────────────────────────
            <View style={{ padding: 20, alignItems: 'center', gap: 12 }}>
              <MaterialIcons name="cloud-off" size={40} color={theme.textTertiary} />
              <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Not connected</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
                Connect to your self-hosted CheckMaster server to sync across devices and share checklists.
              </Text>
              <Pressable
                style={[styles.cloudBtn, { backgroundColor: theme.primary, alignSelf: 'stretch' }]}
                onPress={handleOpenConnect}
              >
                <MaterialIcons name="add-link" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Connect to Server</Text>
              </Pressable>
              {isConnected && !hasProfile && (
                <Pressable
                  style={[styles.cloudBtn, { borderColor: theme.primary, borderWidth: 1, alignSelf: 'stretch' }]}
                  onPress={handleOpenConnect}
                >
                  <MaterialIcons name="person-add" size={20} color={theme.primary} />
                  <Text style={{ color: theme.primary, fontSize: 14, fontWeight: '600' }}>Create / Log in</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}>
            <MaterialIcons name={settings.darkMode ? 'dark-mode' : 'light-mode'} size={22} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary }]}>Dark Mode</Text>
            {renderToggle(settings.darkMode, () => updateSettings({ darkMode: !settings.darkMode }))}
          </View>
          <View style={styles.settingRow}>
            <MaterialIcons name="view-compact" size={22} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary }]}>UI Density</Text>
            <View style={styles.optionRow}>
              {renderOption('Compact', settings.density === 'compact', () => updateSettings({ density: 'compact' }))}
              {renderOption('Comfortable', settings.density === 'comfortable', () => updateSettings({ density: 'comfortable' }))}
            </View>
          </View>
        </View>

        {/* Defaults */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>DEFAULTS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.settingRow, { borderBottomColor: theme.borderLight }]}>
            <MaterialIcons name="visibility" size={22} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary }]}>Default View</Text>
            <View style={styles.optionRow}>
              {renderOption('Interactive', settings.defaultView === 'interactive', () => updateSettings({ defaultView: 'interactive' }))}
              {renderOption('Stats', settings.defaultView === 'stats', () => updateSettings({ defaultView: 'stats' }))}
            </View>
          </View>
          <View style={styles.settingRow}>
            <MaterialIcons name="pie-chart" size={22} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary }]}>Chart Type</Text>
            <View style={styles.optionRow}>
              {renderOption('Pie', settings.chartType === 'pie', () => updateSettings({ chartType: 'pie' }))}
              {renderOption('Bar', settings.chartType === 'bar', () => updateSettings({ chartType: 'bar' }))}
            </View>
          </View>
        </View>

        {/* Statistics */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STATISTICS</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <MaterialIcons name="pie-chart" size={22} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary }]}>Default Chart Type</Text>
            <View style={styles.optionRow}>
              {renderOption('Pie Chart', settings.chartType === 'pie', () => updateSettings({ chartType: 'pie' }))}
              {renderOption('Bar Chart', settings.chartType === 'bar', () => updateSettings({ chartType: 'bar' }))}
            </View>
          </View>
        </View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.aboutRow, { borderBottomColor: theme.borderLight }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>App</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>{APP_NAME}</Text>
          </View>
          <View style={[styles.aboutRow, { borderBottomColor: theme.borderLight }]}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Version</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>{APP_VERSION}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Storage</Text>
            <View style={[styles.storageBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                {isConnected && hasProfile ? 'Server' : 'Local'}
              </Text>
            </View>
          </View>
        </View>

        {/* Privacy */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>PRIVACY</Text>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ padding: 14 }}>
            <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Delete Account &amp; Data</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
              Permanently removes all your locally stored checklists, folders, and settings from this device. This cannot be undone.
            </Text>
            <Pressable
              style={[styles.deleteBtn, { backgroundColor: theme.errorBg, borderColor: theme.error }]}
              onPress={() => Alert.alert('Delete all data?', 'This will remove all local data. Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                  updateSettings({ storageMode: 'local', serverUrl: '', serverApiKey: '', serverUsername: undefined, serverDisplayName: undefined });
                }},
              ])}
            >
              <MaterialIcons name="delete-forever" size={20} color={theme.error} />
              <Text style={{ color: theme.error, fontSize: 14, fontWeight: '600' }}>Delete All Local Data</Text>
            </Pressable>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 20 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{APP_NAME} v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* ── Connect to Server Modal ───────────────────────────────────────── */}
      <Modal visible={showConnectModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {connectStep === 'credentials' ? 'Connect to Server' : (authMode === 'register' ? 'Create Account' : 'Log In')}
              </Text>
              <Pressable onPress={() => setShowConnectModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {connectStep === 'credentials' ? (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 }}>
                    Point CheckMaster at your own server to sync across devices and share checklists with other users.
                  </Text>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SERVER URL</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={connectUrl}
                    onChangeText={v => { setConnectUrl(v); setConnectTested(false); }}
                    placeholder="https://my-checkmaster-server.com"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>API KEY</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={connectKey}
                    onChangeText={v => { setConnectKey(v); setConnectTested(false); }}
                    placeholder="your-secret-api-key"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8, marginBottom: 16 }}>
                    <Pressable
                      style={[styles.modalBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1, flex: 1 }]}
                      disabled={serverBusy}
                      onPress={async () => {
                        setServerBusy(true);
                        // test with temp values
                        const { testServerConnection } = await import('../../services/serverSync');
                        const r = await testServerConnection(connectUrl.trim(), connectKey.trim());
                        setServerBusy(false);
                        if (r.ok) { setConnectTested(true); Alert.alert('Connected ✓', 'Server is reachable.'); }
                        else Alert.alert('Failed', r.error);
                      }}
                    >
                      {serverBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="wifi-tethering" size={18} color={theme.textPrimary} />}
                      <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>Test</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalBtn, { backgroundColor: theme.primary, flex: 2, opacity: connectUrl.trim() && connectKey.trim() ? 1 : 0.5 }]}
                      disabled={!connectUrl.trim() || !connectKey.trim()}
                      onPress={handleTestAndNext}
                    >
                      {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="arrow-forward" size={18} color="#FFF" />}
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Save &amp; Continue</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  {/* Mode tabs */}
                  <View style={[styles.authTabs, { backgroundColor: theme.backgroundSecondary, marginBottom: 20 }]}>
                    {(['register', 'login'] as const).map(m => (
                      <Pressable
                        key={m}
                        style={[styles.authTab, { backgroundColor: authMode === m ? theme.primary : 'transparent' }]}
                        onPress={() => setAuthMode(m)}
                      >
                        <Text style={{ color: authMode === m ? '#FFF' : theme.textSecondary, fontSize: 14, fontWeight: '600', textTransform: 'capitalize' }}>
                          {m === 'register' ? 'Create Account' : 'Log In'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>USERNAME</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={authUsername}
                    onChangeText={setAuthUsername}
                    placeholder="alice"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PASSWORD</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder="••••••••"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry
                  />
                  {authMode === 'register' && (
                    <>
                      <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>YOUR DISPLAY NAME (OPTIONAL)</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                        value={authDisplay}
                        onChangeText={setAuthDisplay}
                        placeholder="alice"
                        placeholderTextColor={theme.textTertiary}
                      />
                      <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: -10, marginBottom: 14 }}>
                        Used when sharing — others will see this name
                      </Text>
                    </>
                  )}

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                    <Pressable
                      style={[styles.modalBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1, flex: 1 }]}
                      onPress={() => setConnectStep('credentials')}
                    >
                      <MaterialIcons name="arrow-back" size={18} color={theme.textSecondary} />
                      <Text style={{ color: theme.textSecondary, fontSize: 14, fontWeight: '600' }}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.modalBtn, { backgroundColor: theme.primary, flex: 2, opacity: authUsername.trim() && authPassword.trim() ? 1 : 0.5 }]}
                      disabled={authBusy || !authUsername.trim() || !authPassword.trim()}
                      onPress={handleAuth}
                    >
                      {authBusy ? <ActivityIndicator size="small" color="#FFF" /> : <MaterialIcons name="check" size={18} color="#FFF" />}
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>
                        {authMode === 'register' ? 'Create Account' : 'Log In'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
