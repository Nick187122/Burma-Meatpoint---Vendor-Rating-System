import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import client from '../../src/api/client';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async () => {
    if (!email) {
      setError('Enter your email address');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await client.post('/auth/password-reset/request/', { email });
      setMessage(data.message || 'Password reset email sent.');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>
      <Text style={styles.subtitle}>Request a reset link for your account.</Text>
      {message ? <Text style={styles.success}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TouchableOpacity style={styles.btnPrimary} onPress={handleSubmit} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send Reset Link</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
        <Text style={styles.btnSecondaryText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 24 },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  btnPrimary: { backgroundColor: '#f97316', padding: 16, borderRadius: 8, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: { marginTop: 16, alignItems: 'center' },
  btnSecondaryText: { color: '#f97316', fontWeight: 'bold' },
  success: { color: '#4ade80', marginBottom: 12 },
  error: { color: '#ef4444', marginBottom: 12 }
});
