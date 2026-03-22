import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import client from '../api/client';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      // Actions
      setToken: (token) => set({ token }),
      
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user 
      }),

      login: async (credentials) => {
        const res = await client.post('/auth/login/', credentials);
        set({
          user: res.data.user,
          token: res.data.access,
          isAuthenticated: true,
        });
        return res.data;
      },

      register: async (data) => {
        const res = await client.post('/auth/register/', data);
        set({
          user: res.data.user,
          token: res.data.access,
          isAuthenticated: true,
        });
        return res.data;
      },

      logout: async () => {
        try {
          await client.post('/auth/logout/');
        } catch (e) {
          console.error('Logout API failed, clearing local state anyway', e);
        }
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Fetch latest profile data
      fetchProfile: async () => {
        if (!get().token) return;
        try {
          const res = await client.get('/auth/me/');
          set({ user: res.data, isAuthenticated: true });
        } catch (e) {
          // Handled by axios interceptor if 401
          console.error('Failed to fetch profile', e);
        }
      }
    }),
    {
      name: 'bmp-auth', // sessionStorage key
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

export default useAuthStore;
