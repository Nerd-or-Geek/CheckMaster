import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Platform,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface CSVImportModalProps {
  visible: boolean;
  onClose: () => void;
  checklistId: string;
}

type ColumnMapping = 'section' | 'item' | 'quantity' | 'description' | 'ignore';

export default function CSVImportModal({ visible, onClose, checklistId }: CSVImportModalProps) {
  const { isDark, importCSV } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const sheetHeight = Math.min(
    Dimensions.get('window').height * 0.9,
    Dimensions.get('window').height - insets.top - 24,
  );

  const [step, setStep] = useState<'input' | 'mapping' | 'preview'>('input');
  const [csvText, setCsvText] = useState('');
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<{ name: string; items: { name: string; qty: number; desc: string }[] }[]>([]);

  const parseCSV = () => {
    const lines = csvText.trim().split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '')));
    if (lines.length < 2) return;
    const hdrs = lines[0];
    const rows = lines.slice(1).filter(r => r.length === hdrs.length);
    setHeaders(hdrs);
    setParsedRows(rows);

    const autoMap: ColumnMapping[] = hdrs.map(h => {
      const hl = h.toLowerCase();
      if (hl.includes('section') || hl.includes('group') || hl.includes('category')) return 'section';
      if (hl.includes('item') || hl.includes('name') || hl.includes('product')) return 'item';
      if (hl.includes('qty') || hl.includes('quantity') || hl.includes('amount') || hl.includes('count')) return 'quantity';
      if (hl.includes('desc') || hl.includes('note') || hl.includes('detail')) return 'description';
      return 'ignore';
    });
    if (!autoMap.includes('section')) autoMap[0] = 'section';
    if (!autoMap.includes('item')) autoMap[Math.min(1, hdrs.length - 1)] = 'item';
    setMappings(autoMap);
    setStep('mapping');
  };

  const generatePreview = () => {
    const secIdx = mappings.indexOf('section');
    const itemIdx = mappings.indexOf('item');
    const qtyIdx = mappings.indexOf('quantity');
    const descIdx = mappings.indexOf('description');

    if (secIdx === -1 || itemIdx === -1) return;

    const sectionMap: Record<string, { name: string; qty: number; desc: string }[]> = {};
    parsedRows.forEach(row => {
      const sec = row[secIdx] || 'Unsorted';
      const item = row[itemIdx] || '';
      if (!item) return;
      if (!sectionMap[sec]) sectionMap[sec] = [];
      sectionMap[sec].push({
        name: item,
        qty: qtyIdx >= 0 ? (parseInt(row[qtyIdx]) || 0) : 0,
        desc: descIdx >= 0 ? (row[descIdx] || '') : '',
      });
    });

    const preview = Object.entries(sectionMap).map(([name, items]) => ({ name, items }));
    setPreviewData(preview);
    setStep('preview');
  };

  const confirmImport = () => {
    const sections = previewData.map(s => ({
      name: s.name,
      items: s.items.map(it => ({
        name: it.name,
        description: it.desc,
        category: 'general',
        checked: false,
        requiredQty: it.qty,
        ownedQty: 0,
        images: [] as string[],
        notes: '',
        sectionId: null,
      })),
    }));
    importCSV(checklistId, sections);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('input');
    setCsvText('');
    setParsedRows([]);
    setHeaders([]);
    setMappings([]);
    setPreviewData([]);
    onClose();
  };

  const mappingOptions: { value: ColumnMapping; label: string }[] = [
    { value: 'section', label: 'Section' },
    { value: 'item', label: 'Item' },
    { value: 'quantity', label: 'Quantity' },
    { value: 'description', label: 'Description' },
    { value: 'ignore', label: 'Ignore' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={[styles.overlay, { backgroundColor: theme.overlay }]}>
        <KeyboardAvoidingView
          style={[styles.modalWrap, { height: sheetHeight }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[
            styles.modal,
            {
              backgroundColor: theme.surface,
              height: sheetHeight,
              paddingBottom: insets.bottom + 12,
            },
          ]}>
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                {step === 'input' ? 'Import CSV' : step === 'mapping' ? 'Map Columns' : 'Preview Import'}
              </Text>
              <Pressable onPress={resetAndClose} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step === 'input' && (
                <>
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    Paste your CSV data below. First row should be column headers.
                  </Text>
                  <TextInput
                    style={[styles.csvInput, {
                      backgroundColor: theme.backgroundSecondary,
                      color: theme.textPrimary,
                      borderColor: theme.border,
                    }]}
                    value={csvText}
                    onChangeText={setCsvText}
                    placeholder={'Section,Item,Quantity,Description\nFruits,Apple,5,Red apples\nFruits,Banana,3,\nDairy,Milk,1,Whole milk'}
                    placeholderTextColor={theme.textTertiary}
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                  />
                </>
              )}

              {step === 'mapping' && (
                <>
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    Map each column to the correct field. Section and Item are required.
                  </Text>
                  {headers.map((h, idx) => (
                    <View key={idx} style={[styles.mappingRow, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.mappingHeader, { color: theme.textPrimary }]}>{h}</Text>
                        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>
                          e.g. "{parsedRows[0]?.[idx] || ''}"
                        </Text>
                      </View>
                      <View style={styles.mappingBtns}>
                        {mappingOptions.map(opt => (
                          <Pressable
                            key={opt.value}
                            style={[styles.mappingChip, {
                              backgroundColor: mappings[idx] === opt.value ? theme.primary : 'transparent',
                              borderColor: mappings[idx] === opt.value ? theme.primary : theme.border,
                            }]}
                            onPress={() => {
                              const newMappings = [...mappings];
                              newMappings[idx] = opt.value;
                              setMappings(newMappings);
                            }}
                          >
                            <Text style={{
                              fontSize: 11, fontWeight: '600',
                              color: mappings[idx] === opt.value ? '#FFF' : theme.textSecondary,
                            }}>
                              {opt.label}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              )}

              {step === 'preview' && (
                <>
                  <Text style={[styles.hint, { color: theme.textSecondary }]}>
                    {previewData.reduce((sum, s) => sum + s.items.length, 0)} items in {previewData.length} sections will be imported.
                  </Text>
                  {previewData.map((sec, sIdx) => (
                    <View key={sIdx} style={[styles.previewSection, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                      <View style={styles.previewSecHeader}>
                        <MaterialIcons name="folder" size={18} color={theme.primary} />
                        <Text style={[styles.previewSecName, { color: theme.textPrimary }]}>{sec.name}</Text>
                        <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{sec.items.length} items</Text>
                      </View>
                      {sec.items.map((it, iIdx) => (
                        <View key={iIdx} style={[styles.previewItem, { borderTopColor: theme.border }]}>
                          <Text style={{ color: theme.textPrimary, fontSize: 14, flex: 1 }}>{it.name}</Text>
                          {it.qty > 0 && (
                            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>×{it.qty}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: theme.border }]}>
              {step !== 'input' && (
                <Pressable
                  style={[styles.backBtn, { borderColor: theme.border }]}
                  onPress={() => setStep(step === 'preview' ? 'mapping' : 'input')}
                >
                  <Text style={{ color: theme.textSecondary, fontSize: 15, fontWeight: '600' }}>Back</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.nextBtn, {
                  backgroundColor: step === 'preview' ? theme.success : theme.primary,
                  opacity: (step === 'input' && !csvText.trim()) ? 0.5 : 1,
                }]}
                onPress={() => {
                  if (step === 'input') parseCSV();
                  else if (step === 'mapping') generatePreview();
                  else confirmImport();
                }}
                disabled={step === 'input' && !csvText.trim()}
              >
                <MaterialIcons
                  name={step === 'preview' ? 'check-circle' : 'arrow-forward'}
                  size={20}
                  color="#FFF"
                  style={{ marginRight: step === 'preview' ? 6 : 0 }}
                />
                <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '700' }}>
                  {step === 'preview' ? 'Apply import' : 'Next'}
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
  modalWrap: { width: '100%' },
  modal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  bodyScroll: { flex: 1, minHeight: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 16, flexGrow: 1 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  csvInput: {
    borderRadius: 12, borderWidth: 1, padding: 14, fontSize: 14,
    minHeight: 180, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  mappingRow: {
    borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1,
  },
  mappingHeader: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  mappingBtns: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  mappingChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1,
  },
  previewSection: { borderRadius: 12, marginBottom: 10, borderWidth: 1, overflow: 'hidden' },
  previewSecHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
  },
  previewSecName: { fontSize: 15, fontWeight: '600', flex: 1 },
  previewItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  backBtn: {
    flex: 1, height: 50, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  nextBtn: {
    flex: 2,
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
