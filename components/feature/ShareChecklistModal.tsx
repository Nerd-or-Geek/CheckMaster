import React, { useState } from 'react';
import {
  View, Text, Pressable, Modal, StyleSheet, Share, Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { Checklist } from '../../services/mockData';
import { ShareGrant, encodeChecklistShare } from '../../services/checklistShare';

interface ShareChecklistModalProps {
  visible: boolean;
  onClose: () => void;
  checklist: Checklist;
}

const GRANTS: { value: ShareGrant; label: string; desc: string }[] = [
  { value: 'view', label: 'View only', desc: 'See items and progress. No checking or editing.' },
  { value: 'check', label: 'Check items', desc: 'Can mark items done. No adding, deleting, or editing details.' },
  { value: 'edit', label: 'Edit', desc: 'Full changes: items, sections, settings, and CSV import.' },
];

export default function ShareChecklistModal({ visible, onClose, checklist }: ShareChecklistModalProps) {
  const { settings } = useApp();
  const theme = settings.darkMode ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [grant, setGrant] = useState<ShareGrant>('view');

  const handleShare = async () => {
    const encoded = encodeChecklistShare(grant, checklist);
    const human = `CheckMaster: "${checklist.name}"\n\nHow to open: In Folders, open the folder where you want it, tap Import shared, and paste this entire message.\n\nPermission for the copy: ${GRANTS.find(g => g.value === grant)?.label ?? grant}`;
    try {
      await Share.share({
        title: `Share: ${checklist.name}`,
        message: `${human}\n\n${encoded}`,
      });
    } catch {
      /* user dismissed */
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Share checklist</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.intro, { color: theme.textSecondary }]}>
              Choose what someone can do with their copy after they import this share on their device.
            </Text>
            {GRANTS.map(g => (
              <Pressable
                key={g.value}
                style={[styles.option, {
                  borderColor: grant === g.value ? theme.primary : theme.border,
                  backgroundColor: grant === g.value ? theme.primaryBg : theme.backgroundSecondary,
                }]}
                onPress={() => setGrant(g.value)}
              >
                <MaterialIcons
                  name={grant === g.value ? 'radio-button-checked' : 'radio-button-unchecked'}
                  size={22}
                  color={grant === g.value ? theme.primary : theme.textTertiary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: theme.textPrimary, fontSize: 15, fontWeight: '700' }}>{g.label}</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{g.desc}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={[styles.footer, { paddingHorizontal: 20, paddingTop: 12 }]}>
            <Pressable
              style={[styles.shareBtn, { backgroundColor: theme.primary }]}
              onPress={handleShare}
            >
              <MaterialIcons name="share" size={20} color="#FFF" />
              <Text style={styles.shareBtnText}>
                {Platform.OS === 'web' ? 'Copy / share' : 'Share via…'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  body: { paddingHorizontal: 20, maxHeight: 420 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  footer: {},
  shareBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
