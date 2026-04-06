import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react-native';
import client from '../../src/api/client';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-notifications'],
    queryFn: async () => {
      const { data } = await client.get('/notifications/');
      return Array.isArray(data) ? data : data.results || [];
    },
    refetchInterval: 20000,
  });

  const markRead = useMutation({
    mutationFn: (id) => client.post(`/notifications/${id}/read/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => client.post('/notifications/read-all/'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['mobile-notifications'] }),
  });

  const notifications = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Live updates for ratings, approvals, replies, and moderation actions.</Text>
        </View>
        <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllRead.mutate()} disabled={markAllRead.isPending}>
          <CheckCheck size={16} color="#fdba74" />
          <Text style={styles.markAllText}>{markAllRead.isPending ? 'Working...' : 'Mark All'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#f97316" />}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.is_read && styles.cardRead]}
            onPress={() => !item.is_read && markRead.mutate(item.id)}
            activeOpacity={0.85}
          >
            <View style={styles.cardHeader}>
              <View style={styles.kindBadge}>
                <Bell size={14} color="#f97316" />
                <Text style={styles.kindText}>{item.kind.replace(/_/g, ' ')}</Text>
              </View>
              {!item.is_read && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMessage}>{item.message}</Text>
            <Text style={styles.cardMeta}>{new Date(item.created_at).toLocaleString()}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4, maxWidth: 250 },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#f97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(249,115,22,0.08)' },
  markAllText: { color: '#fdba74', fontWeight: '700' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#334155' },
  cardRead: { opacity: 0.72 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  kindBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kindText: { color: '#fdba74', fontSize: 12, textTransform: 'capitalize', fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#f97316' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardMessage: { color: '#cbd5e1', lineHeight: 20 },
  cardMeta: { color: '#64748b', marginTop: 10, fontSize: 12 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16 },
});
