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
import * as Haptics from 'expo-haptics';
import { colors, spacing, borderRadius, typography } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';
import { APP_NAME, APP_VERSION } from '../../constants/config';

export default function SettingsScreen() {
  const {
    settings,
    updateSettings,
    folders,
    checklists,
    testSyncServer,
    pushDataToServer,
    pullDataFromServer,
    registerServerProfile,
    loginServerProfile,
  } = useApp();

  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { contentPadding } = useResponsive();

  const [serverBusy, setServerBusy] = useState(false);

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
  const hasProfile = !!settings.serverUsername;

  const totalItems = checklists.reduce((sum, cl) => sum + cl.items.length, 0);
  const completedItems = checklists.reduce(
    (sum, cl) => sum + cl.items.filter(i => i.checked).length,
    0
  );

  const renderToggle = (value: boolean, onToggle: () => void) => (
    <Pressable
      style={[
        styles.toggleSwitch,
        {
          backgroundColor: value ? theme.primary : theme.backgroundSecondary,
          borderColor: value ? theme.primaryDark : theme.border,
          borderWidth: 1.5,
        },
      ]}
      onPress={() => {
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
            shadowColor: theme.shadowColor,
            shadowOpacity: 0.15,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
          },
        ]}
      >
        <MaterialCommunityIcons
          name={value ? 'weather-night' : 'white-balance-sunny'}
          size={16}
          color={value ? theme.primaryDark : theme.textTertiary}
        />
      </View>
    </Pressable>
  );

  const renderOption = (label: string, active: boolean, onPress: () => void) => (
    <Pressable
      style={[
        styles.optionBtn,
        {
          backgroundColor: active ? theme.primaryBg : theme.backgroundSecondary,
          borderColor: active ? theme.primary : theme.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <MaterialIcons
        name={label === 'Compact' ? 'view-compact' : 'view-comfy'}
        size={16}
        color={active ? theme.primary : theme.textTertiary}
      />
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

  const handleTestAndNext = async () => {
    setServerBusy(true);
    const r = await testSyncServer();
    setServerBusy(false);

    if (!r.ok) {
      Alert.alert('Connection failed', r.error);
      return;
    }

    updateSettings({
      serverUrl: connectUrl.trim(),
      serverApiKey: connectKey.trim(),
    });

    setConnectStep('auth');
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword.trim()) {
      Alert.alert('Missing fields', 'Username and password required.');
      return;
    }

    setAuthBusy(true);

    const r =
      authMode === 'register'
        ? await registerServerProfile(
            authUsername,
            authPassword,
            authDisplay || undefined
          )
        : await loginServerProfile(authUsername, authPassword);

    setAuthBusy(false);

    if (!r.ok) {
      Alert.alert('Auth failed', r.error);
      return;
    }

    updateSettings({ storageMode: 'cloud' });
    setShowConnectModal(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>


      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: contentPadding,
          paddingBottom: insets.bottom + 100,
        }}
      >
        {/* Stats */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{folders.length}</Text>
              <Text style={styles.statLabel}>Folders</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{checklists.length}</Text>
              <Text style={styles.statLabel}>Checklists</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedItems}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{totalItems}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Appearance */}
        <Text style={styles.sectionLabel}>APPEARANCE</Text>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <View style={styles.settingRow}>
            <Text style={styles.settingText}>Dark Mode</Text>
            {renderToggle(settings.darkMode, () =>
              updateSettings({ darkMode: !settings.darkMode })
            )}
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingText}>UI Density</Text>
            <View style={styles.optionRow}>
              {renderOption('Compact', settings.density === 'compact', () =>
                updateSettings({ density: 'compact' })
              )}
              {renderOption('Comfortable', settings.density === 'comfortable', () =>
                updateSettings({ density: 'comfortable' })
              )}
            </View>
          </View>
        </View>

        {/* Storage */}
        <Text style={styles.sectionLabel}>STORAGE</Text>

        <View style={styles.card}>
          <Pressable
            style={styles.storageOption}
            onPress={() => updateSettings({ storageMode: 'local' })}
          >
            <Text style={styles.settingText}>Local</Text>
          </Pressable>

          <Pressable
            style={styles.storageOption}
            onPress={() => updateSettings({ storageMode: 'cloud' })}
          >
            <Text style={styles.settingText}>Cloud</Text>
          </Pressable>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>ABOUT</Text>

        <View style={styles.card}>
          <Text style={styles.aboutRow}>{APP_NAME}</Text>
          <Text style={styles.aboutRow}>v{APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700' },

    card: {
      borderRadius: 16,
      marginBottom: 14,
      padding: 16,
      borderWidth: 1.5,
      backgroundColor: '#fff',
    },

  statsGrid: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 11 },

  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: '600',
  },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },

  settingText: { fontSize: 15, flex: 1 },

  optionRow: { flexDirection: 'row', gap: 6 },

    optionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1.5,
      marginRight: 4,
      minWidth: 90,
    },

    toggleSwitch: {
      width: 44,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: '#E2E8F0',
      backgroundColor: '#F1F5F9',
      padding: 2,
    },

    toggleKnob: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#fff',
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 2,
    },

  storageOption: {
    padding: 12,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
  },

  aboutRow: {
    paddingVertical: 6,
  },
});