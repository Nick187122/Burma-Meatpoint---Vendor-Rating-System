import { Tabs } from 'expo-router';
import { Bell, Shield, Home, User, Store } from 'lucide-react-native';
import useAuthStore from '../../src/store/authStore';

export default function TabLayout() {
  const { user, isAuthenticated } = useAuthStore();

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: '#f97316',
      tabBarInactiveTintColor: '#94a3b8',
      headerStyle: { backgroundColor: '#0f172a' },
      headerTitleStyle: { color: '#fff' },
      tabBarStyle: { backgroundColor: '#0f172a', borderTopColor: '#334155' }
    }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Home color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'My Profile',
          href: isAuthenticated && user?.role === 'Consumer' ? '/(tabs)/profile' : null,
          tabBarIcon: ({ color }) => <User color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          href: isAuthenticated ? '/(tabs)/notifications' : null,
          tabBarIcon: ({ color }) => <Bell color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="vendor"
        options={{
          title: 'Dashboard',
          href: isAuthenticated && user?.role === 'Vendor' ? '/(tabs)/vendor' : null,
          tabBarIcon: ({ color }) => <Store color={color} size={24} />
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAuthenticated && user?.role === 'Admin' ? '/(tabs)/admin' : null,
          tabBarIcon: ({ color }) => <Shield color={color} size={24} />
        }}
      />
    </Tabs>
  );
}
