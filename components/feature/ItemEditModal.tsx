import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, categoryColors, spacing, borderRadius, typography } from '../../constants/theme';
import { DEFAULT_CATEGORIES } from '../../constants/config';
import { useApp } from '../../contexts/AppContext';
import { ChecklistItem, Section } from '../../services/mockData';

interface ItemEditModalProps {
  visible: boolean;
  onClose: () => void;
  checklistId: string;
  item?: ChecklistItem | null;
  sections: Section[];
  enableQuantity: boolean;
  enableNotes: boolean;
  enableImages: boolean;
  defaultCategory: string;
}

export default function ItemEditModal({
  visible, onClose, checklistId, item, sections,
  enableQuantity, enableNotes, enableImages, defaultCategory,
}: ItemEditModalProps) {
  const { settings, isDark, addItem, updateItem } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [requiredQty, setRequiredQty] = useState('0');
  const [ownedQty, setOwnedQty] = useState('0');
  const [notes, setNotes] = useState('');
  const [sectionId, setSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setDescription(item.description);
      setCategory(item.category);
      setRequiredQty(String(item.requiredQty));
      setOwnedQty(String(item.ownedQty));
      setNotes(item.notes);
      setSectionId(item.sectionId);
    } else {
      setName('');
      setDescription('');
      setCategory(defaultCategory);
      setRequiredQty('0');
      setOwnedQty('0');
      setNotes('');
      setSectionId(sections.length > 0 ? sections[0].id : null);
    }
  }, [item, visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    const data = {
      name: name.trim(),
      description: description.trim(),
      category,
      checked: item?.checked ?? false,
      requiredQty: parseInt(requiredQty) || 0,
      ownedQty: parseInt(ownedQty) || 0,
      images: item?.images ?? [],
      notes: notes.trim(),
      sectionId,
    };
    if (item) {
      updateItem(checklistId, item.id, data);
    } else {
      addItem(checklistId, data);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <KeyboardAvoidingView
          style={styles.modalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modal, {
            backgroundColor: theme.surface,
            paddingBottom: insets.bottom + 16,
          }]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {item ? 'Edit Item' : 'Add Item'}
              </Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={{ paddingBottom: 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.label, { color: theme.textTertiary }]}>NAME *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Item name"
                placeholderTextColor={theme.textTertiary}
              />

              <Text style={[styles.label, { color: theme.textTertiary }]}>DESCRIPTION</Text>
              <TextInput
                style={[styles.input, styles.multiline, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={2}
              />

              {sections.length > 0 ? (
                <>
                  <Text style={[styles.label, { color: theme.textTertiary }]}>SECTION</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    <View style={styles.chipRow}>
                      {sections.map(s => (
                        <Pressable
                          key={s.id}
                          style={[styles.chip, {
                            backgroundColor: sectionId === s.id ? theme.primary : theme.backgroundSecondary,
                            borderColor: sectionId === s.id ? theme.primary : theme.border,
                          }]}
                          onPress={() => setSectionId(s.id)}
                        >
                          <Text style={{ color: sectionId === s.id ? '#FFF' : theme.textPrimary, fontSize: 13, fontWeight: '600' }}>
                            {s.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              ) : null}

              <Text style={[styles.label, { color: theme.textTertiary }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={styles.chipRow}>
                  {DEFAULT_CATEGORIES.map(cat => {
                    const catColor = categoryColors[cat];
                    const isActive = category === cat;
                    return (
                      <Pressable
                        key={cat}
                        style={[styles.chip, {
                          backgroundColor: isActive ? catColor.dot : theme.backgroundSecondary,
                          borderColor: isActive ? catColor.dot : theme.border,
                        }]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text style={{ color: isActive ? '#FFF' : theme.textPrimary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                          {cat}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              {enableQuantity ? (
                <View style={styles.qtyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textTertiary }]}>REQUIRED QTY</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                      value={requiredQty}
                      onChangeText={setRequiredQty}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textTertiary}
                    />
                  </View>
                  <View style={{ width: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: theme.textTertiary }]}>OWNED QTY</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border }]}
                      value={ownedQty}
                      onChangeText={setOwnedQty}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textTertiary}
                    />
                  </View>
                </View>
              ) : null}

              {enableNotes ? (
                <>
                  <Text style={[styles.label, { color: theme.textTertiary }]}>NOTES</Text>
                  <TextInput
                    style={[styles.input, styles.multiline, { backgroundColor: theme.backgroundSecondary, color: theme.textPrimary, borderColor: theme.border, minHeight: 80 }]}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add notes..."
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    numberOfLines={3}
                  />
                </>
              ) : null}

              {enableImages ? (
                <>
                  <Text style={[styles.label, { color: theme.textTertiary }]}>IMAGES</Text>
                  <Pressable style={[styles.imageUpload, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}>
                    <MaterialIcons name="add-photo-alternate" size={32} color={theme.textTertiary} />
                    <Text style={{ color: theme.textTertiary, fontSize: 13, marginTop: 4 }}>Tap to upload images</Text>
                  </Pressable>
                </>
              ) : null}
            </ScrollView>

            <View style={styles.footer}>
              <Pressable style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={onClose}>
                <Text style={{ color: theme.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: name.trim() ? 1 : 0.5 }]}
                onPress={handleSave}
                disabled={!name.trim()}
              >
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '600' }}>
                  {item ? 'Update' : 'Add Item'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  modalWrap: { maxHeight: '92%' },
  modal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  body: { paddingHorizontal: 20 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    height: 48, borderRadius: 12, paddingHorizontal: 14,
    fontSize: 15, borderWidth: 1, marginBottom: 16,
  },
  multiline: { height: 'auto', minHeight: 60, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  qtyRow: { flexDirection: 'row' },
  imageUpload: {
    height: 100, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: {
    flex: 2, height: 48, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
});
