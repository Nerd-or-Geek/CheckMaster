import React, { useState } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, Switch, Platform, TextInput, Alert, ActivityIndicator,
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
  } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { contentPadding } = useResponsive();
  const [serverBusy, setServerBusy] = useState(false);

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

        {/* Storage */}
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>STORAGE</Text>
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
              <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Local Storage</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Data saved on this device only</Text>
            </View>
            <MaterialIcons name="phone-android" size={22} color={theme.textTertiary} />
          </Pressable>

          <Pressable
            style={[styles.storageOption, {
              borderColor: settings.storageMode === 'cloud' ? theme.primary : theme.border,
              backgroundColor: settings.storageMode === 'cloud' ? theme.primaryBg : 'transparent',
              marginTop: 8,
            }]}
            onPress={() => { Haptics.selectionAsync(); updateSettings({ storageMode: 'cloud' }); }}
          >
            <MaterialIcons
              name={settings.storageMode === 'cloud' ? 'radio-button-checked' : 'radio-button-unchecked'}
              size={22}
              color={settings.storageMode === 'cloud' ? theme.primary : theme.textTertiary}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '600' }}>Cloud Sync</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Sync across all your devices</Text>
            </View>
            <MaterialIcons name="cloud" size={22} color={theme.textTertiary} />
          </Pressable>
        </View>

        {/* Self-hosted server sync */}
        {settings.storageMode === 'cloud' && (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: 8 }]}>
            <Text style={[styles.sectionInnerTitle, { color: theme.textPrimary }]}>
              Your sync server
            </Text>
            <Text style={[styles.serverHint, { color: theme.textSecondary }]}>
              On Ubuntu, run the install script from the repo’s{' '}
              <Text style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>server/</Text>
              {' '}folder. It prints an API key. Use your server’s URL (include port), e.g. http://192.168.1.10:3847
            </Text>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SERVER URL</Text>
            <TextInput
              style={[styles.serverInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
              value={settings.serverUrl}
              onChangeText={v => updateSettings({ serverUrl: v })}
              placeholder="http://your-server:3847"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>API KEY</Text>
            <TextInput
              style={[styles.serverInput, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
              value={settings.serverApiKey}
              onChangeText={v => updateSettings({ serverApiKey: v })}
              placeholder="Paste key from server install"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={styles.cloudHeader}>
              <View style={[styles.syncDot, { backgroundColor: theme.success }]} />
              <Text style={{ color: theme.textSecondary, fontSize: 13, flex: 1 }}>
                Last sync: {settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleString() : 'Never'}
              </Text>
            </View>

            <View style={{ gap: 8, marginTop: 8, paddingHorizontal: 14, paddingBottom: 8 }}>
              <Pressable
                style={[styles.cloudBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]}
                disabled={serverBusy}
                onPress={async () => {
                  Haptics.selectionAsync();
                  setServerBusy(true);
                  const r = await testSyncServer();
                  setServerBusy(false);
                  if (r.ok) Alert.alert('Connected', 'Server responded OK.');
                  else Alert.alert('Connection failed', r.error);
                }}
              >
                {serverBusy ? <ActivityIndicator color={theme.primary} /> : <MaterialIcons name="wifi-tethering" size={20} color={theme.textPrimary} />}
                <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>Test connection</Text>
              </Pressable>

              <Pressable
                style={[styles.cloudBtn, { backgroundColor: theme.primary }]}
                disabled={serverBusy}
                onPress={async () => {
                  Haptics.selectionAsync();
                  setServerBusy(true);
                  const r = await pushDataToServer();
                  setServerBusy(false);
                  if (r.ok) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert('Uploaded', 'This device’s data was saved to the server.');
                  } else Alert.alert('Upload failed', r.error);
                }}
              >
                <MaterialIcons name="cloud-upload" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>Upload to server</Text>
              </Pressable>

              <Pressable
                style={[styles.cloudBtn, { backgroundColor: theme.warningBg, borderColor: theme.warning, borderWidth: 1 }]}
                disabled={serverBusy}
                onPress={() => {
                  Haptics.selectionAsync();
                  Alert.alert(
                    'Replace this device?',
                    'Download will overwrite folders, checklists, and settings on this device with the server copy. Your server URL and API key here are kept.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Download',
                        style: 'destructive',
                        onPress: async () => {
                          setServerBusy(true);
                          const r = await pullDataFromServer();
                          setServerBusy(false);
                          if (r.ok) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert('Downloaded', 'Data was loaded from the server.');
                          } else Alert.alert('Download failed', r.error);
                        },
                      },
                    ],
                  );
                }}
              >
                <MaterialIcons name="cloud-download" size={20} color={theme.warning} />
                <Text style={{ color: theme.warning, fontSize: 14, fontWeight: '600' }}>Download from server</Text>
              </Pressable>
            </View>
          </View>
        )}

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
            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>Items Tracked</Text>
            <Text style={{ color: theme.textPrimary, fontSize: 14, fontWeight: '600' }}>{totalItems}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 20 }}>
          <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
            {APP_NAME} v{APP_VERSION}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  statsGrid: { flexDirection: 'row', padding: 16 },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: '100%' },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    marginTop: 16, marginBottom: 8, textTransform: 'uppercase',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  settingText: { fontSize: 15, fontWeight: '500', flex: 1 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  optionRow: { flexDirection: 'row', gap: 6 },
  optionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  storageOption: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5,
    marginHorizontal: 12, marginTop: 4,
  },
  sectionInnerTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 16, paddingTop: 14 },
  serverHint: { fontSize: 13, lineHeight: 19, paddingHorizontal: 16, marginBottom: 12 },
  inputLabel: {
    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
    marginTop: 8, marginBottom: 6, paddingHorizontal: 16, textTransform: 'uppercase',
  },
  serverInput: {
    marginHorizontal: 16,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: 1,
    marginBottom: 4,
  },
  cloudHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  cloudBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 44, borderRadius: 10, marginHorizontal: 14,
  },
  aboutRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
});
