import React, { useState, useCallback } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, Share, Platform, ScrollView,
  TextInput, Alert, ActivityIndicator, Clipboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeOut, SlideInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Checklist } from '../../services/mockData';
import { ShareGrant, encodeChecklistShare, generateShareSummary } from '../../services/checklistShare';
import { shareWithUser } from '../../services/serverSync';

interface ShareChecklistModalProps {
  visible: boolean;
  onClose: () => void;
  checklist: Checklist;
}

const GRANTS: { value: ShareGrant; label: string; desc: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'view', label: 'View only', desc: 'See items and progress', icon: 'visibility' },
  { value: 'check', label: 'Check items', desc: 'Can mark items done', icon: 'check-circle-outline' },
  { value: 'edit', label: 'Full edit', desc: 'Add, edit, delete items', icon: 'edit' },
];

type ShareMethod = 'username' | 'link';

export default function ShareChecklistModal({ visible, onClose, checklist }: ShareChecklistModalProps) {
  const { isDark, settings } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [grant, setGrant] = useState<ShareGrant>('view');
  const [method, setMethod] = useState<ShareMethod>('link');
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const isServerConnected = !!(settings.serverUrl && settings.serverApiKey && settings.serverUsername);

  const handleShareViaSystem = async () => {
    const encoded = encodeChecklistShare(grant, checklist);
    const human = generateShareSummary(grant, checklist);
    try {
      await Share.share({
        title: `Share: ${checklist.name}`,
        message: `${human}\n${encoded}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const handleCopyLink = () => {
    const encoded = encodeChecklistShare(grant, checklist);
    const human = generateShareSummary(grant, checklist);
    const fullText = `${human}\n${encoded}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(fullText);
      } else {
        Clipboard.setString(fullText);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert('Copy failed', 'Could not copy to clipboard.');
    }
  };

  const handleShareToUser = async () => {
    if (!username.trim()) {
      Alert.alert('Enter a username', 'Type the username of the person you want to share with.');
      return;
    }
    if (!isServerConnected) {
      Alert.alert('Not connected', 'Connect to a server in Settings to share by username.');
      return;
    }
    setSending(true);
    const encoded = encodeChecklistShare(grant, checklist);
    const result = await shareWithUser(
      settings.serverUrl,
      settings.serverApiKey,
      checklist.id,
      username.trim(),
      grant,
      encoded,
    );
    setSending(false);
    if (!result.ok) {
      Alert.alert('Share failed', result.error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setUsername('');
    }, 3000);
  };

  const handleClose = () => {
    setUsername('');
    setSent(false);
    setCopied(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <Animated.View
          entering={FadeInDown.duration(300).springify()}
          style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: theme.primaryBg }]}>
              <MaterialIcons name="share" size={22} color={theme.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>Share Checklist</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={1}>
                {checklist.name}
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: theme.backgroundSecondary }]}
            >
              <MaterialIcons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Permission selector */}
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>PERMISSION</Text>
            <View style={styles.grantRow}>
              {GRANTS.map(g => {
                const active = grant === g.value;
                return (
                  <Pressable
                    key={g.value}
                    style={[styles.grantBtn, {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primaryBg : theme.backgroundSecondary,
                    }]}
                    onPress={() => { Haptics.selectionAsync(); setGrant(g.value); }}
                  >
                    <MaterialIcons
                      name={g.icon}
                      size={20}
                      color={active ? theme.primary : theme.textTertiary}
                    />
                    <Text style={{
                      color: active ? theme.primary : theme.textPrimary,
                      fontSize: 13, fontWeight: '600', marginTop: 4,
                    }}>
                      {g.label}
                    </Text>
                    <Text style={{ color: theme.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 2 }}>
                      {g.desc}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Method toggle */}
            <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>SHARE VIA</Text>
            <View style={[styles.methodToggle, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              {([
                { key: 'link' as ShareMethod, label: 'Copy / Link', icon: 'link' as const },
                { key: 'username' as ShareMethod, label: 'Username', icon: 'person' as const },
              ]).map(m => (
                <Pressable
                  key={m.key}
                  style={[styles.methodBtn, {
                    backgroundColor: method === m.key ? theme.primary : 'transparent',
                  }]}
                  onPress={() => { Haptics.selectionAsync(); setMethod(m.key); }}
                >
                  <MaterialIcons
                    name={m.icon}
                    size={18}
                    color={method === m.key ? '#FFF' : theme.textSecondary}
                  />
                  <Text style={{
                    color: method === m.key ? '#FFF' : theme.textSecondary,
                    fontSize: 13, fontWeight: '600', marginLeft: 6,
                  }}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Method content */}
            {method === 'username' ? (
              <Animated.View entering={FadeIn.duration(200)}>
                {!isServerConnected ? (
                  <View style={[styles.warningBox, { backgroundColor: theme.warningBg, borderColor: theme.warning + '40' }]}>
                    <MaterialIcons name="warning" size={18} color={theme.warning} />
                    <Text style={{ color: theme.warning, fontSize: 13, flex: 1, marginLeft: 8 }}>
                      Connect to a server in Settings to share by username.
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.fieldLabel, { color: theme.textTertiary }]}>RECIPIENT USERNAME</Text>
                <View style={styles.usernameRow}>
                  <TextInput
                    style={[styles.usernameInput, {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                      opacity: isServerConnected ? 1 : 0.5,
                    }]}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Enter username"
                    placeholderTextColor={theme.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={isServerConnected}
                  />
                </View>
                {sent ? (
                  <Animated.View
                    entering={FadeIn.duration(250)}
                    style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}
                  >
                    <MaterialIcons name="check-circle" size={20} color={theme.success} />
                    <Text style={{ color: theme.success, fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
                      Sent to {username}
                    </Text>
                  </Animated.View>
                ) : null}
                <Pressable
                  style={[styles.actionBtn, {
                    backgroundColor: theme.primary,
                    opacity: username.trim() && isServerConnected && !sending ? 1 : 0.5,
                  }]}
                  onPress={handleShareToUser}
                  disabled={!username.trim() || !isServerConnected || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={18} color="#FFF" />
                      <Text style={styles.actionBtnText}>Send to User</Text>
                    </>
                  )}
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={styles.linkActions}>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                    onPress={handleCopyLink}
                  >
                    <MaterialIcons name={copied ? 'check' : 'content-copy'} size={18} color="#FFF" />
                    <Text style={styles.actionBtnText}>
                      {copied ? 'Copied' : 'Copy to Clipboard'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: theme.primaryBg, borderColor: theme.primary, borderWidth: 1 }]}
                    onPress={handleShareViaSystem}
                  >
                    <MaterialIcons name="share" size={18} color={theme.primary} />
                    <Text style={[styles.actionBtnText, { color: theme.primary }]}>
                      {Platform.OS === 'web' ? 'Share' : 'Share via...'}
                    </Text>
                  </Pressable>
                </View>
                {copied ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={[styles.successBanner, { backgroundColor: theme.successBg, borderColor: theme.success + '40' }]}
                  >
                    <MaterialIcons name="check-circle" size={18} color={theme.success} />
                    <Text style={{ color: theme.success, fontSize: 13, fontWeight: '600', marginLeft: 8 }}>
                      Copied to clipboard. Paste and send to anyone.
                    </Text>
                  </Animated.View>
                ) : null}
              </Animated.View>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20, maxHeight: 520 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  grantRow: { flexDirection: 'row', gap: 8 },
  grantBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 12, borderWidth: 1.5,
  },
  methodToggle: {
    flexDirection: 'row', borderRadius: 12, padding: 3, borderWidth: 1,
  },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 10,
  },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  usernameRow: { flexDirection: 'row', gap: 8 },
  usernameInput: {
    flex: 1, height: 48, borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, borderWidth: 1,
  },
  warningBox: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1, marginTop: 12,
  },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1, marginTop: 12,
  },
  linkActions: { gap: 10, marginTop: 16 },
  actionBtn: {
    height: 50, borderRadius: 14, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12,
  },
  actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
