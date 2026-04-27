import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../constants/theme';
import { useApp } from '../../contexts/AppContext';
import { useResponsive } from '../../hooks/useResponsive';

export default function TabLayout() {
  const { isDark } = useApp();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();

  // On desktop, hide the tab bar — we use the three-panel layout instead
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'index') return <MaterialIcons name="folder" size={size} color={color} />;
          if (route.name === 'checklist') return <MaterialIcons name="checklist" size={size} color={color} />;
          if (route.name === 'settings') return <MaterialIcons name="settings" size={size} color={color} />;
          return null;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: isDesktop ? { display: 'none' } : {
          backgroundColor: theme.tabBar,
          borderTopWidth: 1,
          borderTopColor: theme.tabBarBorder,
          height: Platform.select({
            ios: insets.bottom + 60,
            android: insets.bottom + 60,
            default: 64,
          }),
          paddingTop: 6,
          paddingBottom: Platform.select({
            ios: insets.bottom + 6,
            android: insets.bottom + 6,
            default: 8,
          }),
        },
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Folders' }} />
      <Tabs.Screen name="checklist" options={{ title: 'Checklist' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
