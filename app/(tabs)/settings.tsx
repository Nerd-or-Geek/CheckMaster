import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Platform, TextInput, Alert,
  ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { APP_NAME, APP_VERSION } from '../../constants/config';
import PageHeader from '../../components/layout/PageHeader';

export default function SettingsScreen() {
  const {
    settings, isDark, updateSettings, folders, checklists,
    testSyncServer, pushDataToServer, pullDataFromServer,
    registerServerProfile, loginServerProfile, deleteAllData,
  } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { contentPadding, isDesktop } = useResponsive();

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
  const completedItems = checklists.reduce((sum, cl) => sum + cl.items.filter(i => i.checked).length, 0);

  // On desktop, settings is in the three-panel layout. This screen is for mobile only.

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web') alert(`${title}: ${msg}`);
    else Alert.alert(title, msg);
  };

  const showConfirm = (title: string, msg: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') { if (confirm(`${title}\n${msg}`)) onConfirm(); }
    else Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: onConfirm }]);
  };

  const renderToggle = (value: boolean, onToggle: () => void, disabled?: boolean) => (
    <Pressable style={[styles.toggleSwitch, { backgroundColor: value ? theme.primary : theme.backgroundSecondary, opacity: disabled ? 0.5 : 1 }]}
      onPress={() => { if (!disabled) onToggle(); }}>
      <View style={[styles.toggleKnob, { transform: [{ translateX: value ? 20 : 2 }] }]} />
    </Pressable>
  );

  const handleTestAndConnect = async () => {
    if (!connectUrl.trim() || !connectKey.trim()) return;
    setServerBusy(true);
    updateSettings({ serverUrl: connectUrl.trim(), serverApiKey: connectKey.trim() });
    await new Promise(r => setTimeout(r, 100));
    const r = await testSyncServer();
    setServerBusy(false);
    if (!r.ok) { showAlert('Connection failed', r.error); return; }
    setConnectStep('auth');
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) return;
    setAuthBusy(true);
    const r = authMode === 'register'
      ? await registerServerProfile(authUsername, authPassword, authDisplay || undefined)
      : await loginServerProfile(authUsername, authPassword);
    setAuthBusy(false);
    if (!r.ok) { showAlert('Auth failed', r.error); return; }
    updateSettings({ storageMode: 'server' });
    setShowConnectModal(false);
  };

  const handleDisconnect = () => {
    showConfirm('Disconnect?', 'Local data will be kept.', () => {
      updateSettings({ storageMode: 'local', serverUrl: '', serverApiKey: '', serverUsername: undefined, serverDisplayName: undefined });
    });
  };

  const handleSync = async (dir: 'push' | 'pull') => {
    setServerBusy(true);
    const r = dir === 'push' ? await pushDataToServer() : await pullDataFromServer();
    setServerBusy(false);
    if (!r.ok) showAlert('Sync failed', r.error);
    else showAlert('Success', dir === 'push' ? 'Data uploaded.' : 'Data downloaded.');
  };

  const handleDeleteAll = () => {
    showConfirm('Delete all data?', 'This cannot be undone.', () => deleteAllData());
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>
      <PageHeader title="Settings" subtitle={`v${APP_VERSION}`} icon="settings" />

      <ScrollView contentContainerStyle={{ paddingHorizontal: contentPadding, paddingBottom: insets.bottom + 100, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row' }}>
            {[{ v: folders.length, l: 'Folders', c: theme.primary }, { v: checklists.length, l: 'Lists', c: theme.primary }, { v: completedItems, l: 'Done', c: theme.success }, { v: totalItems, l: 'Total', c: theme.textPrimary }].map((st, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: st.c }}>{st.v}</Text>
                <Text style={{ fontSize: 10, fontWeight: '600', color: theme.textSecondary, textTransform: 'uppercase', marginTop: 2 }}>{st.l}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Appearance */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>APPEARANCE</Text>
        <Animated.View entering={FadeInDown.delay(100).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.settingRow}>
            <MaterialIcons name="brightness-auto" size={18} color={theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '500' }}>Follow System</Text><Text style={{ color: theme.textTertiary, fontSize: 11 }}>Match device theme</Text></View>
            {renderToggle(settings.systemDarkMode, () => updateSettings({ systemDarkMode: !settings.systemDarkMode }))}
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
          <View style={styles.settingRow}>
            <MaterialCommunityIcons name={isDark ? 'weather-night' : 'white-balance-sunny'} size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10, fontWeight: '500' }}>Dark Mode</Text>
            {renderToggle(settings.darkMode, () => updateSettings({ darkMode: !settings.darkMode }), settings.systemDarkMode)}
          </View>
          <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
          <View style={styles.settingRow}>
            <MaterialIcons name="stacked-bar-chart" size={18} color={theme.textSecondary} />
            <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1, marginLeft: 10, fontWeight: '500' }}>Chart Type</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {(['bar', 'pie'] as const).map(ct => (
                <Pressable key={ct} style={[styles.optionBtn, { backgroundColor: settings.chartType === ct ? theme.primaryBg : theme.backgroundSecondary, borderColor: settings.chartType === ct ? theme.primary : theme.border }]}
                  onPress={() => updateSettings({ chartType: ct })}>
                  <Text style={{ color: settings.chartType === ct ? theme.primary : theme.textSecondary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{ct}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Storage & Sync */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>STORAGE & SYNC</Text>
        <Animated.View entering={FadeInDown.delay(150).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Local */}
          <Pressable style={[styles.storageCard, { borderColor: settings.storageMode === 'local' ? theme.primary : theme.border, backgroundColor: settings.storageMode === 'local' ? theme.primaryBg : theme.backgroundSecondary }]}
            onPress={() => updateSettings({ storageMode: 'local' })}>
            <MaterialIcons name="phone-android" size={22} color={settings.storageMode === 'local' ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>Local Only</Text><Text style={{ color: theme.textSecondary, fontSize: 11 }}>Data stays on device</Text></View>
            <MaterialIcons name={settings.storageMode === 'local' ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={settings.storageMode === 'local' ? theme.primary : theme.textTertiary} />
          </Pressable>
          {/* Custom Server */}
          <Pressable style={[styles.storageCard, { borderColor: settings.storageMode === 'server' ? theme.primary : theme.border, backgroundColor: settings.storageMode === 'server' ? theme.primaryBg : theme.backgroundSecondary }]}
            onPress={() => { if (!isConnected) { setConnectStep('credentials'); setConnectUrl(settings.serverUrl); setConnectKey(settings.serverApiKey); setShowConnectModal(true); } else updateSettings({ storageMode: 'server' }); }}>
            <MaterialIcons name="dns" size={22} color={settings.storageMode === 'server' ? theme.primary : theme.textSecondary} />
            <View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>Custom Server</Text><Text style={{ color: theme.textSecondary, fontSize: 11 }}>{isConnected && hasProfile ? `Connected as ${settings.serverUsername}` : 'Self-hosted sync'}</Text></View>
            <MaterialIcons name={settings.storageMode === 'server' ? 'radio-button-checked' : 'radio-button-unchecked'} size={20} color={settings.storageMode === 'server' ? theme.primary : theme.textTertiary} />
          </Pressable>

          {isConnected && settings.storageMode === 'server' ? (
            <Animated.View entering={FadeIn.duration(250)} style={{ marginTop: 10, gap: 8 }}>
              {hasProfile ? (
                <View style={[styles.connBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}>
                  <MaterialIcons name="check-circle" size={16} color={theme.success} />
                  <Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', flex: 1, marginLeft: 6 }}>Signed in as {settings.serverDisplayName || settings.serverUsername}</Text>
                </View>
              ) : null}
              {settings.lastSyncTime ? <Text style={{ color: theme.textTertiary, fontSize: 11 }}>Last synced: {new Date(settings.lastSyncTime).toLocaleString()}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable style={[styles.syncBtn, { backgroundColor: theme.primary }]} onPress={() => handleSync('push')} disabled={serverBusy}>
                  {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <><MaterialIcons name="cloud-upload" size={16} color="#FFF" /><Text style={{ color: '#FFF', fontSize: 12, fontWeight: '600' }}>Push</Text></>}
                </Pressable>
                <Pressable style={[styles.syncBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]} onPress={() => handleSync('pull')} disabled={serverBusy}>
                  {serverBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <><MaterialIcons name="cloud-download" size={16} color={theme.primary} /><Text style={{ color: theme.primary, fontSize: 12, fontWeight: '600' }}>Pull</Text></>}
                </Pressable>
              </View>
              <Pressable style={[styles.disconnectBtn, { borderColor: theme.error + '40' }]} onPress={handleDisconnect}>
                <MaterialIcons name="link-off" size={14} color={theme.error} /><Text style={{ color: theme.error, fontSize: 12, fontWeight: '600' }}>Disconnect</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </Animated.View>

        {/* Privacy */}
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>PRIVACY & DATA</Text>
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} onPress={handleDeleteAll}>
            <MaterialIcons name="delete-forever" size={20} color={theme.error} />
            <View style={{ flex: 1 }}><Text style={{ color: theme.error, fontSize: 14, fontWeight: '600' }}>Delete All Data</Text><Text style={{ color: theme.textTertiary, fontSize: 11 }}>Remove everything from this device</Text></View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textTertiary} />
          </Pressable>
        </Animated.View>

        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 11 }}>{APP_NAME} v{APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* Connect Modal */}
      <Modal visible={showConnectModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{connectStep === 'credentials' ? 'Connect' : 'Account'}</Text>
              <Pressable onPress={() => setShowConnectModal(false)} hitSlop={12}><MaterialIcons name="close" size={24} color={theme.textSecondary} /></Pressable>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              {connectStep === 'credentials' ? (
                <>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 14 }}>Enter server URL and API key to connect.</Text>
                  <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectUrl} onChangeText={setConnectUrl} placeholder="http://192.168.1.100:3847" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
                  <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={connectKey} onChangeText={setConnectKey} placeholder="API Key" placeholderTextColor={theme.textTertiary} secureTextEntry autoCapitalize="none" />
                  <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: connectUrl.trim() && connectKey.trim() ? 1 : 0.5 }]} onPress={handleTestAndConnect} disabled={serverBusy || !connectUrl.trim() || !connectKey.trim()}>
                    {serverBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>Test Connection</Text>}
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={[styles.connBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40', marginBottom: 12 }]}>
                    <MaterialIcons name="check-circle" size={16} color={theme.success} /><Text style={{ color: theme.success, fontSize: 12, fontWeight: '600', marginLeft: 6 }}>Server connected</Text>
                  </View>
                  <View style={{ flexDirection: 'row', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                    {(['register', 'login'] as const).map(m => (
                      <Pressable key={m} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: authMode === m ? theme.primary : theme.backgroundSecondary }} onPress={() => setAuthMode(m)}>
                        <Text style={{ color: authMode === m ? '#FFF' : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{m === 'register' ? 'Sign Up' : 'Log In'}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authUsername} onChangeText={setAuthUsername} placeholder="Username" placeholderTextColor={theme.textTertiary} autoCapitalize="none" />
                  <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authPassword} onChangeText={setAuthPassword} placeholder="Password" placeholderTextColor={theme.textTertiary} secureTextEntry />
                  {authMode === 'register' ? <TextInput style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]} value={authDisplay} onChangeText={setAuthDisplay} placeholder="Display name (optional)" placeholderTextColor={theme.textTertiary} /> : null}
                  <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary, opacity: authUsername.trim() && authPassword.trim() ? 1 : 0.5 }]} onPress={handleAuth} disabled={authBusy || !authUsername.trim() || !authPassword.trim()}>
                    {authBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>{authMode === 'register' ? 'Create Account' : 'Log In'}</Text>}
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
  card: { borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1 },
  sectionLabel: { marginTop: 14, marginBottom: 6, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, marginVertical: 2 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  toggleSwitch: { width: 42, height: 22, borderRadius: 11, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FFF' },
  storageCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 6 },
  connBanner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  syncBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 10 },
  disconnectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  input: { height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, borderWidth: 1, marginBottom: 12 },
  primaryBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
});
