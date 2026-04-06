import { useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import useAuthStore from '../src/store/authStore';

export default function IndexScreen() {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // Redirect to main tabs when authenticated
        router.replace('/(tabs)/home');
      } else {
        // Render auth options or public home
        // Here we just keep them on index or redirect to auth
      }
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <ActivityIndicator style={{ flex: 1, backgroundColor: '#0f172a' }} size="large" color="#f97316" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BMAPoint</Text>
      <Text style={styles.subtitle}>Find & Rate the Best Fresh Meat Vendors near you</Text>
      
      <View style={styles.btnContainer}>
        <Button 
          title="Sign In / Register" 
          color="#f97316"
          onPress={() => router.push('/(auth)/login')} 
        />
      </View>
      <View style={styles.btnContainer}>
        <Button 
          title="Browse Vendors as Guest" 
          color="#334155"
          onPress={() => router.push('/(tabs)/home')} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 48,
    textAlign: 'center'
  },
  btnContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden'
  }
});
