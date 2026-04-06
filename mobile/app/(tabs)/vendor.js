import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Image, TextInput } from 'react-native';
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Store, Star, LogOut, QrCode, MessageSquare, Settings, Flag } from 'lucide-react-native';
import client from '../../src/api/client';
import useAuthStore from '../../src/store/authStore';

export default function VendorDashboardScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [replyTexts, setReplyTexts] = useState({});
  const [flagReasons, setFlagReasons] = useState({});
  const [settingsForm, setSettingsForm] = useState({
    meat_types: '',
    price_range: '',
    latitude: '',
    longitude: '',
    new_name: '',
  });

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['mobile-vendor-analytics'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/dashboard/');
      return data;
    }
  });

  const { data: qrData } = useQuery({
    queryKey: ['mobile-vendor-qr'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/qr-code/');
      return data;
    }
  });

  const { data: ratingsResponse } = useQuery({
    queryKey: ['mobile-vendor-ratings'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/ratings/');
      return data;
    },
    enabled: activeTab === 'reviews'
  });

  const updateProfile = useMutation({
    mutationFn: (payload) => client.patch('/vendor/profile/', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor-analytics'] });
    }
  });

  const requestNameChange = useMutation({
    mutationFn: (newName) => client.post('/vendor/shop-name-request/', { new_name: newName })
  });

  const postReply = useMutation({
    mutationFn: ({ ratingId, replyText }) => client.post(`/vendor/ratings/${ratingId}/reply/`, { reply_text: replyText }),
    onSuccess: () => {
      setReplyTexts({});
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor-ratings'] });
    }
  });

  const flagReview = useMutation({
    mutationFn: ({ ratingId, reason }) => client.post(`/vendor/ratings/${ratingId}/flag/`, { reason }),
    onSuccess: () => {
      setFlagReasons({});
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor-ratings'] });
    }
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor-ratings'] }),
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor-qr'] }),
    ]);
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const analyticsVendor = analytics?.vendor;
  const scoreBreakdown = analytics?.score_breakdown;
  const benchmark = analytics?.benchmark;
  const ratings = useMemo(
    () => (Array.isArray(ratingsResponse) ? ratingsResponse : (ratingsResponse?.results || [])),
    [ratingsResponse]
  );

  const derivedSettings = {
    meat_types: settingsForm.meat_types || analyticsVendor?.meat_types || '',
    price_range: settingsForm.price_range || analyticsVendor?.price_range || '',
    latitude: settingsForm.latitude || String(analyticsVendor?.latitude || ''),
    longitude: settingsForm.longitude || String(analyticsVendor?.longitude || ''),
    new_name: settingsForm.new_name,
  };

  if (isLoading && !refreshing) {
    return <View style={styles.container}><Text style={styles.loadingText}>Loading dashboard...</Text></View>;
  }

  const handleSaveSettings = () => {
    updateProfile.mutate({
      meat_types: derivedSettings.meat_types,
      price_range: derivedSettings.price_range,
      latitude: derivedSettings.latitude || null,
      longitude: derivedSettings.longitude || null,
    });
  };

  const handleRequestNameChange = () => {
    if (!derivedSettings.new_name.trim()) return;
    requestNameChange.mutate(derivedSettings.new_name.trim(), {
      onSuccess: () => setSettingsForm((prev) => ({ ...prev, new_name: '' })),
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.shopName}>{analyticsVendor?.shop_name || 'My Shop'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TabButton icon={<Store size={16} color={activeTab === 'overview' ? '#f97316' : '#94a3b8'} />} label="Overview" active={activeTab === 'overview'} onPress={() => setActiveTab('overview')} />
          <TabButton icon={<MessageSquare size={16} color={activeTab === 'reviews' ? '#f97316' : '#94a3b8'} />} label="Reviews" active={activeTab === 'reviews'} onPress={() => setActiveTab('reviews')} />
          <TabButton icon={<Settings size={16} color={activeTab === 'settings' ? '#f97316' : '#94a3b8'} />} label="Settings" active={activeTab === 'settings'} onPress={() => setActiveTab('settings')} />
        </View>

        {activeTab === 'overview' && (
          <>
            <View style={styles.statsCardWrapper}>
              <View style={styles.statCard}>
                <Star color="#f97316" size={24} style={styles.statIcon} />
                <Text style={styles.statLabel}>Overall Score</Text>
                <Text style={styles.statValue}>{Number(scoreBreakdown?.overall || 0).toFixed(1)}/5.0</Text>
              </View>
              <View style={styles.statCard}>
                <Store color="#3b82f6" size={24} style={styles.statIcon} />
                <Text style={styles.statLabel}>Total Ratings</Text>
                <Text style={styles.statValue}>{scoreBreakdown?.total_ratings || 0}</Text>
              </View>
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.cardTitle}>Score Breakdown</Text>
              <Progress label="Hygiene & Cleanliness" value={scoreBreakdown?.hygiene} color="#4ade80" />
              <Progress label="Meat Freshness" value={scoreBreakdown?.freshness} color="#60a5fa" />
              <Progress label="Customer Service" value={scoreBreakdown?.service} color="#facc15" />
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>Area Benchmark</Text>
              <Text style={styles.infoText}>
                Area average is <Text style={styles.highlight}>{Number(benchmark?.area_average || 0).toFixed(1)}</Text>.
                Difference: <Text style={styles.highlight}>{benchmark?.difference >= 0 ? ` +${Number(benchmark?.difference || 0).toFixed(1)}` : ` ${Number(benchmark?.difference || 0).toFixed(1)}`}</Text>
              </Text>
            </View>

            {qrData?.qr_code_data_url && (
              <View style={styles.qrCard}>
                <View style={styles.qrHeader}>
                  <QrCode color="#f97316" size={22} />
                  <Text style={styles.cardTitle}>Shop QR Code</Text>
                </View>
                <Text style={styles.infoText}>Customers can scan this to open your public profile instantly.</Text>
                <View style={styles.qrImageWrap}>
                  <Image source={{ uri: qrData.qr_code_data_url }} style={styles.qrImage} />
                </View>
                <Text style={styles.qrLink}>{qrData.profile_url}</Text>
              </View>
            )}
          </>
        )}

        {activeTab === 'reviews' && (
          <View style={styles.sectionCard}>
            <Text style={styles.cardTitle}>Recent Reviews</Text>
            {ratings.length === 0 ? (
              <Text style={styles.emptyText}>No reviews yet.</Text>
            ) : (
              ratings.map((rating) => (
                <View key={rating.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <Text style={styles.reviewName}>{rating.consumer_name}</Text>
                    <Text style={styles.reviewDate}>{new Date(rating.timestamp).toLocaleDateString()}</Text>
                  </View>
                  <Text style={styles.reviewMeta}>
                    Hygiene {rating.hygiene_score} | Freshness {rating.freshness_score} | Service {rating.service_score}
                  </Text>
                  {rating.comment ? <Text style={styles.reviewComment}>{rating.comment}</Text> : null}

                  {rating.vendor_reply ? (
                    <View style={styles.replyBox}>
                      <Text style={styles.replyTitle}>Your Reply</Text>
                      <Text style={styles.replyText}>{rating.vendor_reply.text}</Text>
                    </View>
                  ) : (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Write a public reply"
                        placeholderTextColor="#64748b"
                        value={replyTexts[rating.id] || ''}
                        onChangeText={(text) => setReplyTexts((prev) => ({ ...prev, [rating.id]: text }))}
                      />
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        onPress={() => postReply.mutate({ ratingId: rating.id, replyText: replyTexts[rating.id] || '' })}
                        disabled={postReply.isPending || !replyTexts[rating.id]?.trim()}
                      >
                        <Text style={styles.primaryBtnText}>{postReply.isPending ? 'Posting...' : 'Post Reply'}</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {!rating.is_flagged && (
                    <>
                      <TextInput
                        style={styles.input}
                        placeholder="Reason to flag this review"
                        placeholderTextColor="#64748b"
                        value={flagReasons[rating.id] || ''}
                        onChangeText={(text) => setFlagReasons((prev) => ({ ...prev, [rating.id]: text }))}
                      />
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => flagReview.mutate({ ratingId: rating.id, reason: flagReasons[rating.id] || '' })}
                        disabled={flagReview.isPending || !flagReasons[rating.id]?.trim()}
                      >
                        <Flag size={15} color="#f97316" />
                        <Text style={styles.secondaryBtnText}>{flagReview.isPending ? 'Submitting...' : 'Flag for Review'}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'settings' && (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Store Settings</Text>
              <TextInput
                style={styles.input}
                placeholder="Meat types"
                placeholderTextColor="#64748b"
                value={derivedSettings.meat_types}
                onChangeText={(text) => setSettingsForm((prev) => ({ ...prev, meat_types: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Price range"
                placeholderTextColor="#64748b"
                value={derivedSettings.price_range}
                onChangeText={(text) => setSettingsForm((prev) => ({ ...prev, price_range: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Latitude"
                placeholderTextColor="#64748b"
                value={derivedSettings.latitude}
                onChangeText={(text) => setSettingsForm((prev) => ({ ...prev, latitude: text }))}
              />
              <TextInput
                style={styles.input}
                placeholder="Longitude"
                placeholderTextColor="#64748b"
                value={derivedSettings.longitude}
                onChangeText={(text) => setSettingsForm((prev) => ({ ...prev, longitude: text }))}
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveSettings} disabled={updateProfile.isPending}>
                <Text style={styles.primaryBtnText}>{updateProfile.isPending ? 'Saving...' : 'Save Store Settings'}</Text>
              </TouchableOpacity>
              {updateProfile.error && <Text style={styles.errorText}>{updateProfile.error?.response?.data?.error || 'Unable to save settings.'}</Text>}
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.cardTitle}>Request Shop Name Change</Text>
              <TextInput
                style={styles.input}
                placeholder="Requested new shop name"
                placeholderTextColor="#64748b"
                value={derivedSettings.new_name}
                onChangeText={(text) => setSettingsForm((prev) => ({ ...prev, new_name: text }))}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleRequestNameChange} disabled={requestNameChange.isPending || !derivedSettings.new_name.trim()}>
                <Text style={styles.secondaryBtnText}>{requestNameChange.isPending ? 'Submitting...' : 'Request Name Change'}</Text>
              </TouchableOpacity>
              {requestNameChange.error && <Text style={styles.errorText}>{requestNameChange.error?.response?.data?.error || 'Unable to request name change.'}</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function TabButton({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress}>
      {icon}
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Progress({ label, value, color }) {
  const safeValue = Number(value || 0);
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressLabelRow}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{safeValue.toFixed(1)}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { backgroundColor: color, width: `${(safeValue / 5) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingText: { color: '#94a3b8', textAlign: 'center', marginTop: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  shopName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  email: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8 },
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#111827' },
  tabBtnActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)' },
  tabText: { color: '#94a3b8', fontWeight: '600' },
  tabTextActive: { color: '#fdba74' },
  statsCardWrapper: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statIcon: { marginBottom: 8 },
  statLabel: { color: '#94a3b8', fontSize: 12, marginBottom: 4 },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  breakdownCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  sectionCard: { backgroundColor: '#1e293b', padding: 18, borderRadius: 12, marginBottom: 18, borderWidth: 1, borderColor: '#334155' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  progressRow: { marginBottom: 16 },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { color: '#cbd5e1', fontSize: 14 },
  progressValue: { color: '#fff', fontWeight: 'bold' },
  progressBarBg: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  infoCard: { backgroundColor: 'rgba(249,115,22,0.05)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.2)', marginBottom: 20 },
  infoText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22 },
  highlight: { color: '#f97316', fontWeight: 'bold' },
  qrCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  qrImageWrap: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginVertical: 16 },
  qrImage: { width: 220, height: 220 },
  qrLink: { color: '#94a3b8', fontSize: 12 },
  reviewCard: { padding: 14, borderRadius: 10, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 6 },
  reviewName: { color: '#fff', fontWeight: '700', flex: 1 },
  reviewDate: { color: '#64748b', fontSize: 12 },
  reviewMeta: { color: '#cbd5e1', fontSize: 12, marginBottom: 8 },
  reviewComment: { color: '#cbd5e1', marginBottom: 10 },
  replyBox: { backgroundColor: 'rgba(249,115,22,0.05)', padding: 12, borderLeftWidth: 2, borderLeftColor: '#f97316', borderRadius: 6, marginBottom: 10 },
  replyTitle: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  replyText: { color: '#cbd5e1' },
  input: { backgroundColor: '#111827', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10 },
  primaryBtn: { backgroundColor: '#f97316', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#fff', fontWeight: 'bold' },
  secondaryBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderColor: '#f97316', borderWidth: 1, paddingVertical: 13, borderRadius: 10, marginBottom: 10 },
  secondaryBtnText: { color: '#fdba74', fontWeight: '700' },
  errorText: { color: '#ef4444', fontSize: 13 },
  emptyText: { color: '#64748b', fontSize: 14 },
});
