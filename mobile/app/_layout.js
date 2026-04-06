import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from '../src/store/authStore';
import { ActivityIndicator, View } from 'react-native';
import usePushNotifications from '../src/hooks/usePushNotifications';

const queryClient = new QueryClient();

export default function RootLayout() {
  const { initialize, isLoading, isAuthenticated } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  usePushNotifications(isAuthenticated);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ 
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: '#0f172a' }
      }}>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ title: 'Scan QR Code' }} />
        <Stack.Screen name="vendor/[id]" options={{ title: 'Vendor Profile' }} />
      </Stack>
    </QueryClientProvider>
  );
}
