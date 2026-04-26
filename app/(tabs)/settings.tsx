import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { APP_NAME, APP_VERSION } from '../../constants/config';
import PageHeader from '../../components/layout/PageHeader';

export default function SettingsScreen() {
  const {
    settings,
    isDark,
    updateSettings,
    folders,
    checklists,
    testSyncServer,
    pushDataToServer,
    pullDataFromServer,
    registerServerProfile,
    loginServerProfile,
    deleteAllData,
  } = useApp();

  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { contentPadding } = useResponsive();

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

  const isConnected = !!(settings.serverUrl && settings.serverApiKey);
  const hasProfile = !!settings.serverUsername;

  const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
  const completedItems = checklists.reduce(
    (sum, cl) => sum + cl.items.filter(i => i.checked).length,
    0
  );

  const renderToggle = (value: boolean, onToggle: () => void, disabled?: boolean) => (
    <Pressable
      style={[
        styles.toggleSwitch,
        {
          backgroundColor: value ? theme.primary : theme.backgroundSecondary,
          borderColor: value ? theme.primaryDark : theme.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={() => {
        if (disabled) return;
        Haptics.selectionAsync();
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <View
        style={[
          styles.toggleKnob,
          {
            transform: [{ translateX: value ? 20 : 2 }],
            backgroundColor: '#fff',
          },
        ]}
      />
    </Pressable>
  );

  const renderOption = (label: string, active: boolean, onPress: () => void, icon?: string) => (
    <Pressable
      style={[
        styles.optionBtn,
        {
          backgroundColor: active ? theme.primaryBg : theme.backgroundSecondary,
          borderColor: active ? theme.primary : theme.border,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      {icon ? <MaterialIcons name={icon as any} size={16} color={active ? theme.primary : theme.textTertiary} /> : null}
      <Text
        style={{
          color: active ? theme.primary : theme.textSecondary,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );

  const handleTestAndConnect = async () => {
    if (!connectUrl.trim() || !connectKey.trim()) {
      Alert.alert('Missing fields', 'Enter both server URL and API key.');
      return;
    }
    setServerBusy(true);
    updateSettings({ serverUrl: connectUrl.trim(), serverApiKey: connectKey.trim() });
    await new Promise(r => setTimeout(r, 100));
    const r = await testSyncServer();
    setServerBusy(false);
    if (!r.ok) {
      Alert.alert('Connection failed', r.error);
      return;
    }
    setConnectStep('auth');
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      Alert.alert('Missing fields', 'Username and password are required.');
      return;
    }
    setAuthBusy(true);
    const r =
      authMode === 'register'
        ? await registerServerProfile(authUsername, authPassword, authDisplay || undefined)
        : await loginServerProfile(authUsername, authPassword);
    setAuthBusy(false);
    if (!r.ok) {
      Alert.alert('Auth failed', r.error);
      return;
    }
    updateSettings({ storageMode: 'server' });
    setShowConnectModal(false);
  };

  const handleDisconnectServer = () => {
    Alert.alert(
      'Disconnect server?',
      'Your local data will be kept. You can reconnect later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => {
            updateSettings({
              storageMode: 'local',
              serverUrl: '',
              serverApiKey: '',
              serverUsername: undefined,
              serverDisplayName: undefined,
            });
          },
        },
      ],
    );
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      'Delete all data?',
      'This will permanently remove all folders, checklists, and settings from this device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteAllData();
          },
        },
      ],
    );
  };

  const handleSync = async (direction: 'push' | 'pull') => {
    setServerBusy(true);
    const r = direction === 'push' ? await pushDataToServer() : await pullDataFromServer();
    setServerBusy(false);
    if (!r.ok) {
      Alert.alert('Sync failed', r.error);
    } else {
      Alert.alert('Success', direction === 'push' ? 'Data uploaded to server.' : 'Data downloaded from server.');
    }
  };

  const storageMode = settings.storageMode;

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Page Header */}
      <PageHeader
        title="Settings"
        subtitle={`v${APP_VERSION}`}
        icon="settings"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: contentPadding,
          paddingBottom: insets.bottom + 100,
          paddingTop: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{folders.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Folders</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.primary }]}>{checklists.length}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Lists</Text>
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
        </Animated.View>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>APPEARANCE</Text>
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <MaterialIcons name="brightness-auto" size={20} color={theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.settingText, { color: theme.textPrimary }]}>Follow System Theme</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>Matches device dark/light mode</Text>
            </View>
            {renderToggle(settings.systemDarkMode, () =>
              updateSettings({ systemDarkMode: !settings.systemDarkMode })
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.settingRow}>
            <MaterialCommunityIcons
              name={isDark ? 'weather-night' : 'white-balance-sunny'}
              size={20}
              color={theme.textSecondary}
            />
            <Text style={[styles.settingText, { color: theme.textPrimary, flex: 1, marginLeft: 12 }]}>
              Dark Mode
            </Text>
            {renderToggle(settings.darkMode, () =>
              updateSettings({ darkMode: !settings.darkMode }),
              settings.systemDarkMode
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

          <View style={styles.settingRow}>
            <MaterialIcons name="view-compact" size={20} color={theme.textSecondary} />
            <Text style={[styles.settingText, { color: theme.textPrimary, flex: 1, marginLeft: 12 }]}>
              UI Density
            </Text>
            <View style={styles.optionRow}>
              {renderOption('Compact', settings.density === 'compact', () =>
                updateSettings({ density: 'compact' }), 'view-compact'
              )}
              {renderOption('Comfy', settings.density === 'comfortable', () =>
                updateSettings({ density: 'comfortable' }), 'view-comfy'
              )}
            </View>
          </View>
        </Animated.View>

        {/* Storage & Sync */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>STORAGE & SYNC</Text>
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
            Sync your lists between devices or share with friends, family, and coworkers.
          </Text>

          {/* Local */}
          <Pressable
            style={[styles.storageCard, {
              borderColor: storageMode === 'local' ? theme.primary : theme.border,
              backgroundColor: storageMode === 'local' ? theme.primaryBg : theme.backgroundSecondary,
            }]}
            onPress={() => {
              Haptics.selectionAsync();
              updateSettings({ storageMode: 'local' });
            }}
          >
            <MaterialIcons name="phone-android" size={24} color={storageMode === 'local' ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>Local Only</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Data stays on this device</Text>
            </View>
            <MaterialIcons
              name={storageMode === 'local' ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={22}
              color={storageMode === 'local' ? theme.primary : theme.textTertiary}
            />
          </Pressable>

          {/* Custom Server */}
          <Pressable
            style={[styles.storageCard, {
              borderColor: storageMode === 'server' ? theme.primary : theme.border,
              backgroundColor: storageMode === 'server' ? theme.primaryBg : theme.backgroundSecondary,
            }]}
            onPress={() => {
              Haptics.selectionAsync();
              if (!isConnected) {
                setConnectStep('credentials');
                setConnectUrl(settings.serverUrl);
                setConnectKey(settings.serverApiKey);
                setShowConnectModal(true);
              } else {
                updateSettings({ storageMode: 'server' });
              }
            }}
          >
            <MaterialIcons name="dns" size={24} color={storageMode === 'server' ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>Custom Server</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
                {isConnected && hasProfile
                  ? `Connected as ${settings.serverUsername}`
                  : 'Self-hosted sync server'}
              </Text>
            </View>
            <MaterialIcons
              name={storageMode === 'server' ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={22}
              color={storageMode === 'server' ? theme.primary : theme.textTertiary}
            />
          </Pressable>

          {/* Gledhill Cloud */}
          <Pressable
            style={[styles.storageCard, {
              borderColor: storageMode === 'cloud' ? theme.primary : theme.border,
              backgroundColor: storageMode === 'cloud' ? theme.primaryBg : theme.backgroundSecondary,
            }]}
            onPress={() => {
              Haptics.selectionAsync();
              Alert.alert(
                'Gledhill Cloud',
                'Gledhill Cloud is a paid service that provides automatic sync across all your devices with zero setup.\n\nComing soon. You will be able to subscribe and start syncing instantly.',
              );
            }}
          >
            <MaterialIcons name="cloud" size={24} color={storageMode === 'cloud' ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.storageTitle, { color: theme.textPrimary }]}>Gledhill Cloud</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Paid \u2014 automatic sync, no setup</Text>
            </View>
            <View style={[styles.comingSoonBadge, { backgroundColor: theme.warningBg }]}>
              <Text style={{ color: theme.warning, fontSize: 10, fontWeight: '700' }}>SOON</Text>
            </View>
          </Pressable>

          {/* Server actions when connected */}
          {isConnected && storageMode === 'server' ? (
            <Animated.View entering={FadeIn.duration(250)} style={{ marginTop: 12, gap: 8 }}>
              {hasProfile ? (
                <View style={[styles.connectedBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
                  <MaterialIcons name="check-circle" size={18} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: 13, fontWeight: '600', flex: 1, marginLeft: 8 }}>
                    Signed in as {settings.serverDisplayName || settings.serverUsername}
                  </Text>
                </View>
              ) : null}

              {settings.lastSyncTime ? (
                <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                  Last synced: {new Date(settings.lastSyncTime).toLocaleString()}
                </Text>
              ) : null}

              <View style={styles.syncBtnRow}>
                <Pressable
                  style={[styles.syncBtn, { backgroundColor: theme.primary }]}
                  onPress={() => handleSync('push')}
                  disabled={serverBusy}
                >
                  {serverBusy ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="cloud-upload" size={18} color="#FFF" />
                      <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '600' }}>Push</Text>
                    </>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.syncBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]}
                  onPress={() => handleSync('pull')}
                  disabled={serverBusy}
                >
                  {serverBusy ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <>
                      <MaterialIcons name="cloud-download" size={18} color={theme.primary} />
                      <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>Pull</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Pressable
                style={[styles.disconnectBtn, { borderColor: theme.error + '40' }]}
                onPress={handleDisconnectServer}
              >
                <MaterialIcons name="link-off" size={16} color={theme.error} />
                <Text style={{ color: theme.error, fontSize: 13, fontWeight: '600' }}>Disconnect Server</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Privacy & Data */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>PRIVACY & DATA</Text>
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable
            style={[styles.dangerRow]}
            onPress={handleDeleteAllData}
          >
            <MaterialIcons name="delete-forever" size={22} color={theme.error} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.error, fontSize: 15, fontWeight: '600' }}>Delete All Data</Text>
              <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                Remove all folders, checklists, and settings from this device
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color={theme.textTertiary} />
          </Pressable>
        </Animated.View>

        {/* About */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>ABOUT</Text>
        <Animated.View entering={FadeInDown.delay(250).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.aboutRow}>
            <MaterialIcons name="checklist-rtl" size={20} color={theme.primary} />
            <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600', marginLeft: 12, flex: 1 }}>
              {APP_NAME}
            </Text>
            <Text style={{ color: theme.textTertiary, fontSize: 13 }}>v{APP_VERSION}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Connect to Server Modal */}
      <Modal visible={showConnectModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
                {connectStep === 'credentials' ? 'Connect to Server' : 'Create Account'}
              </Text>
              <Pressable onPress={() => setShowConnectModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {connectStep === 'credentials' ? (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
                    Enter the URL and API key from your self-hosted Gledhill Lists server. This lets you sync between your phone and computer, or share lists with others.
                  </Text>
                  <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>SERVER URL</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={connectUrl}
                    onChangeText={setConnectUrl}
                    placeholder="http://192.168.1.100:3847"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>API KEY</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={connectKey}
                    onChangeText={setConnectKey}
                    placeholder="Your server API key"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    secureTextEntry
                  />
                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: connectUrl.trim() && connectKey.trim() ? 1 : 0.5 }]}
                    onPress={handleTestAndConnect}
                    disabled={!connectUrl.trim() || !connectKey.trim() || serverBusy}
                  >
                    {serverBusy ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>Test Connection</Text>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={[styles.connectedBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40', marginBottom: 16 }]}>
                    <MaterialIcons name="check-circle" size={18} color={theme.success} />
                    <Text style={{ color: theme.success, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>
                      Server connected
                    </Text>
                  </View>

                  <View style={styles.authToggleRow}>
                    <Pressable
                      style={[styles.authToggleBtn, {
                        backgroundColor: authMode === 'register' ? theme.primary : 'transparent',
                        borderColor: theme.primary,
                      }]}
                      onPress={() => setAuthMode('register')}
                    >
                      <Text style={{ color: authMode === 'register' ? '#FFF' : theme.primary, fontSize: 14, fontWeight: '600' }}>
                        Sign Up
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.authToggleBtn, {
                        backgroundColor: authMode === 'login' ? theme.primary : 'transparent',
                        borderColor: theme.primary,
                      }]}
                      onPress={() => setAuthMode('login')}
                    >
                      <Text style={{ color: authMode === 'login' ? '#FFF' : theme.primary, fontSize: 14, fontWeight: '600' }}>
                        Log In
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>USERNAME</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={authUsername}
                    onChangeText={setAuthUsername}
                    placeholder="Username"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>PASSWORD</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                    value={authPassword}
                    onChangeText={setAuthPassword}
                    placeholder="Password"
                    placeholderTextColor={theme.textTertiary}
                    secureTextEntry
                  />
                  {authMode === 'register' ? (
                    <>
                      <Text style={[styles.inputLabel, { color: theme.textTertiary }]}>DISPLAY NAME (OPTIONAL)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                        value={authDisplay}
                        onChangeText={setAuthDisplay}
                        placeholder="How others see you"
                        placeholderTextColor={theme.textTertiary}
                      />
                    </>
                  ) : null}

                  <Pressable
                    style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: authUsername.trim() && authPassword.trim() ? 1 : 0.5 }]}
                    onPress={handleAuth}
                    disabled={!authUsername.trim() || !authPassword.trim() || authBusy}
                  >
                    {authBusy ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '600' }}>
                        {authMode === 'register' ? 'Create Account' : 'Log In'}
                      </Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={{ alignItems: 'center', paddingVertical: 12 }}
                    onPress={() => setConnectStep('credentials')}
                  >
                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Change server</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
  },
  statsGrid: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 32 },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  settingText: { fontSize: 15, fontWeight: '500' },
  divider: { height: 1, marginVertical: 2 },
  optionRow: { flexDirection: 'row', gap: 6 },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
      android: { elevation: 2 },
    }),
  },
  storageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  storageTitle: { fontSize: 15, fontWeight: '600' },
  comingSoonBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  connectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  syncBtnRow: { flexDirection: 'row', gap: 8 },
  syncBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 16,
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  authToggleRow: {
    flexDirection: 'row',
    gap: 0,
    marginBottom: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  authToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
});
