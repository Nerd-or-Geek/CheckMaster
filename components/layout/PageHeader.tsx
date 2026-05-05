import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  rightAction?: React.ReactNode;
  leftAction?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, icon, rightAction, leftAction }: PageHeaderProps) {
  const { isDark } = useApp();
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      <View style={styles.leftSlot}>
        {leftAction ? leftAction : null}
      </View>
      <View style={styles.titleArea}>
        {icon ? (
          <MaterialIcons name={icon} size={22} color={theme.primary} style={{ marginRight: 8 }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rightSlot}>
        {rightAction ? rightAction : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  leftSlot: {
    minWidth: 36,
    alignItems: 'flex-start',
  },
  titleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  rightSlot: {
    minWidth: 36,
    maxWidth: '48%',
    alignItems: 'flex-end',
    flexShrink: 0,
  },
});
