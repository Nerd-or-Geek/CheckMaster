import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'index') {
            return <MaterialIcons name="folder" size={size} color={color} />;
          }
          if (route.name === 'checklist') {
            return <MaterialIcons name="checklist" size={size} color={color} />;
          }
          if (route.name === 'settings') {
            return <MaterialIcons name="settings" size={size} color={color} />;
          }
          return null;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 60,
        },
        headerShown: false,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Folders' }} />
      <Tabs.Screen name="checklist" options={{ title: 'Checklist' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
