import { View, Text, StyleSheet } from 'react-native';

export default function AdminPlaceholderScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Portal</Text>
      <Text style={styles.subtitle}>Use the web dashboard for moderation, analytics, and configuration tasks.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
