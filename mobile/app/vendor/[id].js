import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, TextInput, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Star, CheckCircle, Heart, Navigation } from 'lucide-react-native';
import client from '../../src/api/client';
import useAuthStore from '../../src/store/authStore';

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

export default function VendorDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [scores, setScores] = useState({ hygiene: 0, freshness: 0, service: 0 });
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ['mobile-vendor', id],
    queryFn: async () => {
      const { data } = await client.get(`/vendors/${id}/`);
      return data;
    }
  });

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['mobile-ratings', id],
    queryFn: async () => {
      const { data } = await client.get(`/vendors/${id}/ratings/`);
      return data;
    }
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['mobile-favorites'],
    queryFn: async () => {
      const { data } = await client.get('/consumer/favorites/');
      return Array.isArray(data) ? data : data.results || [];
    },
    enabled: isAuthenticated && user?.role === 'Consumer'
  });

  const submitRating = useMutation({
    mutationFn: (payload) => client.post('/ratings/', payload),
    onSuccess: () => {
      setScores({ hygiene: 0, freshness: 0, service: 0 });
      setComment('');
      setAnonymous(false);
      queryClient.invalidateQueries({ queryKey: ['mobile-vendor', id] });
      queryClient.invalidateQueries({ queryKey: ['mobile-ratings', id] });
    }
  });

  const toggleFavorite = useMutation({
    mutationFn: async (isFavorited) => {
      if (isFavorited) {
        return client.delete(`/consumer/favorites/${id}/`);
      }
      return client.post(`/consumer/favorites/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mobile-favorites'] });
    }
  });

  if (vendorLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  if (!vendor) {
    return <View style={styles.center}><Text style={styles.errorText}>Vendor not found</Text></View>;
  }

  const ratings = Array.isArray(ratingsData) ? ratingsData : (ratingsData?.results || []);
  const canRate = isAuthenticated && user?.role === 'Consumer';
  const isFavorited = favorites.some((favorite) => favorite.vendor === Number(id) || favorite.vendor_details?.id === Number(id));

  const handleSubmit = () => {
    if (!scores.hygiene || !scores.freshness || !scores.service) return;
    submitRating.mutate({
      vendor: id,
      hygiene_score: scores.hygiene,
      freshness_score: scores.freshness,
      service_score: scores.service,
      comment,
      anonymous_mode: anonymous,
    });
  };

  const openInMaps = () => {
    const query = encodeURIComponent(`${vendor.shop_name}, ${vendor.location}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Image style={styles.headerImage} source={{ uri: vendor.profile_image || 'https://via.placeholder.com/400x200?text=No+Photo' }} />

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.shopName}>{vendor.shop_name}</Text>
          <View style={styles.scoreBadge}>
            <Star color="#f97316" size={16} fill="#f97316" />
            <Text style={styles.scoreText}>{Number(vendor.overall_score).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <MapPin color="#94a3b8" size={14} />
          <Text style={styles.metaText}>{vendor.location}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={openInMaps}>
            <Navigation color="#60a5fa" size={16} />
            <Text style={styles.actionText}>Open in Maps</Text>
          </TouchableOpacity>
          {canRate && (
            <TouchableOpacity
              style={[styles.actionBtn, isFavorited && styles.actionBtnActive]}
              onPress={() => toggleFavorite.mutate(isFavorited)}
              disabled={toggleFavorite.isPending}
            >
              <Heart color={isFavorited ? '#f97316' : '#94a3b8'} size={16} fill={isFavorited ? '#f97316' : 'transparent'} />
              <Text style={[styles.actionText, isFavorited && styles.actionTextActive]}>
                {toggleFavorite.isPending ? 'Saving...' : (isFavorited ? 'Saved' : 'Save Vendor')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{vendor.meat_types}</Text></View>
          {vendor.price_range && <View style={styles.tagGreen}><Text style={styles.tagGreenText}>{vendor.price_range}</Text></View>}
        </View>

        {canRate && (
          <View style={styles.rateCard}>
            <Text style={styles.sectionTitle}>Submit Rating</Text>
            <ScorePicker label="Hygiene" value={scores.hygiene} onChange={(value) => setScores((prev) => ({ ...prev, hygiene: value }))} />
            <ScorePicker label="Freshness" value={scores.freshness} onChange={(value) => setScores((prev) => ({ ...prev, freshness: value }))} />
            <ScorePicker label="Service" value={scores.service} onChange={(value) => setScores((prev) => ({ ...prev, service: value }))} />
            <TextInput
              style={styles.textarea}
              multiline
              placeholder="Share your experience..."
              placeholderTextColor="#64748b"
              value={comment}
              onChangeText={setComment}
            />
            <TouchableOpacity style={styles.checkboxRow} onPress={() => setAnonymous((value) => !value)}>
              <View style={[styles.checkbox, anonymous && styles.checkboxChecked]}>
                {anonymous && <CheckCircle size={14} color="#fff" />}
              </View>
              <Text style={styles.metaText}>Post anonymously</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitRating.isPending || !scores.hygiene || !scores.freshness || !scores.service}>
              <Text style={styles.submitText}>{submitRating.isPending ? 'Submitting...' : 'Submit Rating'}</Text>
            </TouchableOpacity>
            {submitRating.error && <Text style={styles.errorText}>{submitRating.error?.response?.data?.error || 'Failed to submit rating.'}</Text>}
          </View>
        )}

        <Text style={styles.sectionTitle}>Reviews ({vendor.total_ratings})</Text>

        {ratingsLoading ? (
          <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
        ) : ratings.length === 0 ? (
          <View style={styles.emptyState}><Text style={styles.emptyText}>No reviews yet.</Text></View>
        ) : (
          ratings.map(rating => (
            <View key={rating.id} style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{rating.consumer_name[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewerName}>{rating.consumer_name} {rating.anonymous_mode && '(Anon)'}</Text>
                  <Text style={styles.reviewDate}>{new Date(rating.timestamp).toLocaleDateString()}</Text>
                </View>
              </View>

              {rating.comment ? <Text style={styles.reviewComment}>"{rating.comment}"</Text> : null}

              <View style={styles.scoresRow}>
                <Badge color="#60a5fa" label={`H: ${rating.hygiene_score}`} />
                <Badge color="#4ade80" label={`F: ${rating.freshness_score}`} />
                <Badge color="#facc15" label={`S: ${rating.service_score}`} />
              </View>

              {rating.vendor_reply && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyTitle}>Vendor Response</Text>
                  <Text style={styles.replyText}>{rating.vendor_reply.text}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function ScorePicker({ label, value, onChange }) {
  return (
    <View style={styles.scorePicker}>
      <Text style={styles.progressLabel}>{label}</Text>
      <View style={styles.scoreRow}>
        {SCORE_OPTIONS.map((option) => (
          <TouchableOpacity key={option} style={[styles.scoreChip, value === option && styles.scoreChipActive]} onPress={() => onChange(option)}>
            <Text style={[styles.scoreChipText, value === option && styles.scoreChipTextActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Badge({ color, label }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#ef4444', fontSize: 16, marginTop: 8 },
  container: { flex: 1, backgroundColor: '#0f172a' },
  headerImage: { width: '100%', height: 200, backgroundColor: '#1e293b' },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shopName: { fontSize: 24, fontWeight: 'bold', color: '#fff', flex: 1 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, gap: 4 },
  scoreText: { color: '#f97316', fontWeight: 'bold', fontSize: 16 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  metaText: { color: '#94a3b8', fontSize: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionBtnActive: {
    borderColor: '#f97316',
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  actionText: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  actionTextActive: { color: '#fdba74' },
  tag: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4 },
  tagText: { color: '#cbd5e1', fontSize: 12 },
  tagGreen: { backgroundColor: 'rgba(34,197,94,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' },
  tagGreenText: { color: '#4ade80', fontSize: 12 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 8 },
  rateCard: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#334155' },
  scorePicker: { marginBottom: 14 },
  scoreRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  scoreChip: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  scoreChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  scoreChipText: { color: '#cbd5e1', fontWeight: '700' },
  scoreChipTextActive: { color: '#fff' },
  textarea: { minHeight: 90, textAlignVertical: 'top', backgroundColor: '#0f172a', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#334155', padding: 12, marginBottom: 14 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  submitBtn: { backgroundColor: '#f97316', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b' },
  reviewCard: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#f97316', fontWeight: 'bold' },
  reviewerName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  reviewDate: { color: '#64748b', fontSize: 12, marginTop: 2 },
  reviewComment: { color: '#cbd5e1', fontStyle: 'italic', marginBottom: 12, fontSize: 14 },
  scoresRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: 'bold' },
  replyBox: { backgroundColor: 'rgba(249,115,22,0.05)', padding: 12, borderLeftWidth: 2, borderLeftColor: '#f97316', borderRadius: 4 },
  replyTitle: { color: '#f97316', fontSize: 12, fontWeight: 'bold', marginBottom: 4 },
  replyText: { color: '#94a3b8', fontSize: 13 },
  progressLabel: { color: '#cbd5e1', fontSize: 14, fontWeight: '600' },
});
