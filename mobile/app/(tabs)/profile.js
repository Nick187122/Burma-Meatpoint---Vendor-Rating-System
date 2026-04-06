import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { LogOut, Star, Heart, Trash2 } from 'lucide-react-native';
import client from '../../src/api/client';
import useAuthStore from '../../src/store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('ratings');

  const { data: myRatings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ['mobile-my-ratings'],
    queryFn: async () => {
      const { data } = await client.get('/consumer/my-ratings/');
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: tab === 'ratings'
  });

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['mobile-favorites'],
    queryFn: async () => {
      const { data } = await client.get('/consumer/favorites/');
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: tab === 'favorites'
  });

  const removeFavorite = useMutation({
    mutationFn: (vendorId) => client.delete(`/consumer/favorites/${vendorId}/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-favorites'] }),
  });

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const renderRating = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Vendor #{item.vendor}</Text>
        <Star size={16} fill="#f97316" color="#f97316" />
      </View>
      <View style={styles.scoresRow}>
        <View style={styles.badge}><Text style={styles.badgeText}>H: {item.hygiene_score}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>F: {item.freshness_score}</Text></View>
        <View style={styles.badge}><Text style={styles.badgeText}>S: {item.service_score}</Text></View>
      </View>
      {item.comment ? <Text style={styles.comment}>"{item.comment}"</Text> : null}
      {item.vendor_reply && (
        <View style={styles.replyBox}>
          <Text style={styles.replyTitle}>Vendor Reply</Text>
          <Text style={styles.replyText}>{item.vendor_reply.text}</Text>
        </View>
      )}
    </View>
  );

  const renderFavorite = ({ item }) => {
    const vendor = item.vendor_details;
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/vendor/${vendor.id}`)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{vendor.shop_name}</Text>
          <TouchableOpacity onPress={() => removeFavorite.mutate(vendor.id)}>
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
        <Text style={styles.comment}>{vendor.location}</Text>
        <Text style={styles.replyText}>{vendor.meat_types}</Text>
        <Text style={styles.replyText}>Score: {Number(vendor.overall_score || 0).toFixed(1)} ? {vendor.total_ratings} ratings</Text>
      </TouchableOpacity>
    );
  };

  const loading = tab === 'ratings' ? ratingsLoading : favoritesLoading;
  const data = tab === 'ratings' ? myRatings : favorites;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, tab === 'ratings' && styles.tabBtnActive]} onPress={() => setTab('ratings')}>
          <Star size={16} color={tab === 'ratings' ? '#f97316' : '#94a3b8'} />
          <Text style={[styles.tabText, tab === 'ratings' && styles.tabTextActive]}>My Ratings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, tab === 'favorites' && styles.tabBtnActive]} onPress={() => setTab('favorites')}>
          <Heart size={16} color={tab === 'favorites' ? '#f97316' : '#94a3b8'} />
          <Text style={[styles.tabText, tab === 'favorites' && styles.tabTextActive]}>Favorites</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#f97316" />
      ) : (
        <FlatList
          data={data}
          keyExtractor={item => item.id.toString()}
          renderItem={tab === 'ratings' ? renderRating : renderFavorite}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>Nothing here yet.</Text></View>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  greeting: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  email: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8 },
  tabRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  tabBtnActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#f97316' },
  card: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { color: '#f97316', fontWeight: 'bold', fontSize: 16 },
  scoresRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { color: '#cbd5e1', fontSize: 12, fontWeight: 'bold' },
  comment: { color: '#94a3b8', fontStyle: 'italic', fontSize: 14, marginBottom: 12 },
  replyBox: { backgroundColor: 'rgba(249,115,22,0.05)', padding: 12, borderRadius: 8, borderLeftWidth: 2, borderLeftColor: '#f97316' },
  replyTitle: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  replyText: { color: '#cbd5e1', fontSize: 14 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 }
});
