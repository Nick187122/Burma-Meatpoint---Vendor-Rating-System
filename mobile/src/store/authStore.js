import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import client, { setAuthToken } from '../api/client';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');

      if (token && userStr) {
        setAuthToken(token);
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true, isLoading: false });

        client.get('/auth/me/')
          .then(async (res) => {
            await AsyncStorage.setItem('user', JSON.stringify(res.data));
            set({ user: res.data });
          })
          .catch(async () => {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setAuthToken(null);
            set({ user: null, isAuthenticated: false });
          });
      } else {
        set({ isLoading: false });
      }
    } catch (e) {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { data } = await client.post('/auth/login/', { email, password });
    await AsyncStorage.setItem('token', data.access);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setAuthToken(data.access);
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  socialLogin: async (payload) => {
    const { data } = await client.post('/auth/social-login/', payload);
    await AsyncStorage.setItem('token', data.access);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setAuthToken(data.access);
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  logout: async () => {
    try {
      await client.post('/auth/logout/');
    } catch (e) {
      // ignore and clear local state anyway
    }
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setAuthToken(null);
    set({ user: null, isAuthenticated: false });
  },

  register: async (userData) => {
    const { data } = await client.post('/auth/register/', userData);
    await AsyncStorage.setItem('token', data.access);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));
    setAuthToken(data.access);
    set({ user: data.user, isAuthenticated: true });
    return data;
  },

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  }
}));

export default useAuthStore;
