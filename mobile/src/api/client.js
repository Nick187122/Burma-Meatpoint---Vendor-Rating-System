import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// For local testing:
// Android Emulator uses 10.0.2.2 to access the host's localhost
// iOS Simulator uses localhost
const configuredBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
const BASE_URL = configuredBaseUrl || (
  Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'
    : 'http://localhost:8000/api/v1'
);

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
