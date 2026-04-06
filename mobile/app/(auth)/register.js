import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import useAuthStore from '../../src/store/authStore';

export default function RegisterScreen() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const register = useAuthStore(state => state.register);
  const router = useRouter();

  const handleRegister = async () => {
    if (!form.name || !form.email || !form.password) {
      setError('Please fill required fields');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await register(form);
      if (data.user?.role === 'Vendor') router.replace('/(tabs)/vendor');
      else router.replace('/(tabs)/home');
    } catch (err) {
      setError(
        err.response?.data?.email?.[0] ||
        err.response?.data?.password?.[0] ||
        err.response?.data?.error ||
        'Registration failed'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join as a Consumer</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#64748b" value={form.name} onChangeText={text => setForm({ ...form, name: text })} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={text => setForm({ ...form, email: text })} />
      <TextInput style={styles.input} placeholder="Phone Number (Optional)" placeholderTextColor="#64748b" keyboardType="phone-pad" value={form.phone} onChangeText={text => setForm({ ...form, phone: text })} />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748b" secureTextEntry value={form.password} onChangeText={text => setForm({ ...form, password: text })} />
      <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#64748b" secureTextEntry value={form.confirm_password} onChangeText={text => setForm({ ...form, confirm_password: text })} />

      <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign Up</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.btnSecondaryText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 32 },
  input: { backgroundColor: '#1e293b', color: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  btnPrimary: { backgroundColor: '#f97316', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnSecondary: { marginTop: 24, padding: 16, alignItems: 'center' },
  btnSecondaryText: { color: '#f97316', fontWeight: 'bold' },
  errorText: { color: '#ef4444', marginBottom: 16, textAlign: 'center' }
});
