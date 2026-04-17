import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// For local testing:
// Android Emulator uses 10.0.2.2 to access the host's localhost
// iOS Simulator uses localhost
const publicBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
const BASE_URL = (publicBaseUrl || configuredBaseUrl || (
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'
    : 'http://localhost:8000/api/v1'
)).replace(/\/$/, '');

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token) => {
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common['Authorization'];
  }
};

export default client;
