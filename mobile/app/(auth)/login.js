import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import useAuthStore from '../../src/store/authStore';

WebBrowser.maybeCompleteAuthSession();

const facebookDiscovery = {
  authorizationEndpoint: 'https://www.facebook.com/v20.0/dialog/oauth',
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState('');
  const [error, setError] = useState(null);
  const login = useAuthStore(state => state.login);
  const socialLogin = useAuthStore(state => state.socialLogin);
  const router = useRouter();
  const extra = Constants.expoConfig?.extra || {};

  const [googleRequest, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId || undefined,
    androidClientId: extra.googleAndroidClientId || undefined,
    iosClientId: extra.googleIosClientId || undefined,
  });

  const facebookRedirectUri = useMemo(() => makeRedirectUri({ scheme: 'mobile' }), []);
  const [facebookRequest, facebookResponse, promptFacebookAuth] = useAuthRequest(
    {
      clientId: extra.facebookAppId || '',
      redirectUri: facebookRedirectUri,
      responseType: ResponseType.Token,
      scopes: ['public_profile', 'email'],
    },
    facebookDiscovery
  );

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (googleResponse?.type !== 'success') {
        return;
      }
      const idToken = googleResponse.authentication?.idToken || googleResponse.params?.id_token;
      const accessToken = googleResponse.authentication?.accessToken || googleResponse.params?.access_token;
      if (!idToken && !accessToken) {
        setError('Google login did not return a usable token.');
        return;
      }

      setSocialLoading('google');
      setError(null);
      try {
        const data = await socialLogin({
          provider: 'google',
          id_token: idToken,
          access_token: accessToken,
        });
        if (data.user?.role === 'Vendor') router.replace('/(tabs)/vendor');
        else router.replace('/(tabs)/home');
      } catch (err) {
        setError(err.response?.data?.error || 'Google sign-in failed.');
      } finally {
        setSocialLoading('');
      }
    };

    handleGoogleResponse();
  }, [googleResponse]);

  useEffect(() => {
    const handleFacebookResponse = async () => {
      if (facebookResponse?.type !== 'success') {
        return;
      }
      const accessToken = facebookResponse.params?.access_token;
      if (!accessToken) {
        setError('Facebook login did not return an access token.');
        return;
      }

      setSocialLoading('facebook');
      setError(null);
      try {
        const data = await socialLogin({
          provider: 'facebook',
          access_token: accessToken,
        });
        if (data.user?.role === 'Vendor') router.replace('/(tabs)/vendor');
        else router.replace('/(tabs)/home');
      } catch (err) {
        setError(err.response?.data?.error || 'Facebook sign-in failed.');
      } finally {
        setSocialLoading('');
      }
    };

    handleFacebookResponse();
  }, [facebookResponse]);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      if (data.user?.role === 'Vendor') router.replace('/(tabs)/vendor');
      else router.replace('/(tabs)/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const isGoogleConfigured = Boolean(extra.googleWebClientId || extra.googleAndroidClientId || extra.googleIosClientId);
  const isFacebookConfigured = Boolean(extra.facebookAppId);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <Text style={styles.subtitle}>Log in to rate vendors, scan QR codes, and get live alerts.</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Sign In</Text>}
      </TouchableOpacity>

      <View style={styles.dividerWrap}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.divider} />
      </View>

      <TouchableOpacity
        style={[styles.socialBtn, !isGoogleConfigured && styles.socialBtnDisabled]}
        onPress={() => promptGoogleAuth()}
        disabled={!googleRequest || socialLoading === 'google' || !isGoogleConfigured}
      >
        <Text style={styles.socialBtnText}>
          {socialLoading === 'google' ? 'Connecting Google...' : 'Google'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.socialBtn, !isFacebookConfigured && styles.socialBtnDisabled]}
        onPress={() => promptFacebookAuth()}
        disabled={!facebookRequest || socialLoading === 'facebook' || !isFacebookConfigured}
      >
        <Text style={styles.socialBtnText}>
          {socialLoading === 'facebook' ? 'Connecting Facebook...' : 'Facebook'}
        </Text>
      </TouchableOpacity>

      {(!isGoogleConfigured || !isFacebookConfigured) && (
        <Text style={styles.hintText}>
          Add the social client IDs in `mobile/app.json` before using Google or Facebook login.
        </Text>
      )}

      <TouchableOpacity style={styles.linkBtn} onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={styles.linkText}>Forgot Password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnSecondary} onPress={() => router.push('/(auth)/register')}>
        <Text style={styles.btnSecondaryText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0f172a', padding: 24, justifyContent: 'center'
  },
  title: {
    fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 8
  },
  subtitle: {
    fontSize: 14, color: '#94a3b8', marginBottom: 32
  },
  input: {
    backgroundColor: '#1e293b', color: '#fff', padding: 16, borderRadius: 8, marginBottom: 16, borderWidth: 1, borderColor: '#334155'
  },
  btnPrimary: {
    backgroundColor: '#f97316', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 8
  },
  btnText: {
    color: '#fff', fontWeight: 'bold', fontSize: 16
  },
  dividerWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20
  },
  divider: {
    flex: 1, height: 1, backgroundColor: '#334155'
  },
  dividerText: {
    color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8
  },
  socialBtn: {
    borderWidth: 1, borderColor: '#334155', backgroundColor: '#111827', padding: 14, borderRadius: 10, alignItems: 'center', marginBottom: 12
  },
  socialBtnDisabled: {
    opacity: 0.45
  },
  socialBtnText: {
    color: '#fff', fontWeight: '700'
  },
  hintText: {
    color: '#64748b', fontSize: 12, marginBottom: 6
  },
  linkBtn: {
    marginTop: 16, alignItems: 'center'
  },
  linkText: {
    color: '#f97316', fontWeight: '600'
  },
  btnSecondary: {
    marginTop: 24, padding: 16, alignItems: 'center'
  },
  btnSecondaryText: {
    color: '#f97316', fontWeight: 'bold'
  },
  errorText: {
    color: '#ef4444', marginBottom: 16, textAlign: 'center'
  }
});
