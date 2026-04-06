import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Crosshair, Map, MapPin, QrCode, Search, SlidersHorizontal, Star } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import client from '../../src/api/client';

const INITIAL_FILTERS = {
  q: '',
  location: '',
  meat_type: '',
  price_range: '',
  min_rating: '',
  radius_km: '10',
};

const FILTER_CHIPS = {
  meat_type: ['', 'Beef', 'Goat', 'Poultry', 'Pork', 'Mixed'],
  price_range: ['', 'Low', 'Medium', 'High'],
  min_rating: ['', '4.5', '4', '3'],
  radius_km: ['5', '10', '25'],
};

export default function HomeScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [cachedVendors, setCachedVendors] = useState([]);
  const [showingCachedData, setShowingCachedData] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [showMap, setShowMap] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('cached_vendors')
      .then((value) => {
        if (!value) return;
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          setCachedVendors(parsed);
          setShowingCachedData(true);
        }
      })
      .catch(() => {});
  }, []);

  const isSearching = Boolean(
    filters.q || filters.location || filters.meat_type || filters.price_range || filters.min_rating || currentCoords
  );

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ['mobile-vendors', filters, currentCoords],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.q) params.append('q', filters.q);
      if (filters.location) params.append('location', filters.location);
      if (filters.meat_type) params.append('meat_type', filters.meat_type);
      if (filters.price_range) params.append('price_range', filters.price_range);
      if (filters.min_rating) params.append('min_rating', filters.min_rating);
      if (currentCoords) {
        params.append('latitude', String(currentCoords.latitude));
        params.append('longitude', String(currentCoords.longitude));
        params.append('radius_km', filters.radius_km || '10');
      }

      const url = isSearching ? `/vendors/search/?${params.toString()}` : '/vendors/';
      const { data } = await client.get(url);
      const results = Array.isArray(data) ? data : data.results || [];

      if (!isSearching) {
        await AsyncStorage.setItem('cached_vendors', JSON.stringify(results));
        setShowingCachedData(false);
      }

      return results;
    },
    initialData: cachedVendors.length && !isSearching ? cachedVendors : undefined
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const listData = Array.isArray(vendors) ? vendors : cachedVendors;
  const mappedVendors = useMemo(
    () => listData.filter((item) => item.latitude && item.longitude),
    [listData]
  );

  const handleUseLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location required', 'Allow location access to show nearby vendors on the map.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCurrentCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setShowMap(true);
    } catch (error) {
      Alert.alert('Location unavailable', 'The app could not read your current location.');
    }
  };

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCurrentCoords(null);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/vendor/${item.id}`)}
      activeOpacity={0.85}
    >
      <Image
        style={styles.image}
        source={{ uri: item.meat_photo || item.profile_image || 'https://via.placeholder.com/400x200?text=No+Photo' }}
      />
      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text style={styles.title}>{item.shop_name}</Text>
          <View style={styles.scoreBadge}>
            <Star color="#f97316" size={14} fill="#f97316" />
            <Text style={styles.scoreText}>{Number(item.overall_score || 0).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <MapPin color="#94a3b8" size={14} />
          <Text style={styles.metaText}>
            {item.location}
            {item.distance_km ? ` • ${item.distance_km} km away` : ''}
          </Text>
        </View>

        <View style={styles.tagsRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{item.meat_types}</Text></View>
          {item.price_range ? <View style={styles.tagAccent}><Text style={styles.tagAccentText}>{item.price_range}</Text></View> : null}
        </View>

        <Text style={styles.ratingsText}>{item.total_ratings} customer reviews</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        ListHeaderComponent={(
          <View style={styles.headerWrap}>
            <View style={styles.topHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Discover Vendors</Text>
                <Text style={styles.headerSubtitle}>Search by name, market, meat type, rating, and live map radius.</Text>
              </View>
              <TouchableOpacity style={styles.scanBtn} onPress={() => router.push('/scan')}>
                <QrCode color="#fdba74" size={18} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Search color="#94a3b8" size={18} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search vendor or market"
                placeholderTextColor="#64748b"
                value={filters.q}
                onChangeText={(text) => setFilters((prev) => ({ ...prev, q: text }))}
              />
            </View>

            <TextInput
              style={styles.input}
              placeholder="Filter by location"
              placeholderTextColor="#64748b"
              value={filters.location}
              onChangeText={(text) => setFilters((prev) => ({ ...prev, location: text }))}
            />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleUseLocation}>
                <Crosshair size={16} color="#fdba74" />
                <Text style={styles.actionBtnText}>{currentCoords ? 'Refresh Nearby' : 'Use My Location'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowMap((prev) => !prev)}>
                <Map size={16} color="#fdba74" />
                <Text style={styles.actionBtnText}>{showMap ? 'Hide Map' : 'Show Map'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterHeader}>
              <SlidersHorizontal color="#f97316" size={16} />
              <Text style={styles.filterHeaderText}>Quick Filters</Text>
            </View>

            <FilterRow
              label="Meat Type"
              options={FILTER_CHIPS.meat_type}
              value={filters.meat_type}
              onChange={(value) => setFilters((prev) => ({ ...prev, meat_type: value }))}
            />
            <FilterRow
              label="Price Range"
              options={FILTER_CHIPS.price_range}
              value={filters.price_range}
              onChange={(value) => setFilters((prev) => ({ ...prev, price_range: value }))}
            />
            <FilterRow
              label="Minimum Rating"
              options={FILTER_CHIPS.min_rating}
              value={filters.min_rating}
              onChange={(value) => setFilters((prev) => ({ ...prev, min_rating: value }))}
              formatter={(value) => (value ? `${value}+` : 'Any')}
            />
            {currentCoords && (
              <FilterRow
                label="Map Radius"
                options={FILTER_CHIPS.radius_km}
                value={filters.radius_km}
                onChange={(value) => setFilters((prev) => ({ ...prev, radius_km: value }))}
                formatter={(value) => `${value} km`}
              />
            )}

            {(isSearching || currentCoords) && (
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            )}

            {showMap && (
              <View style={styles.mapWrap}>
                {mappedVendors.length ? (
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: currentCoords?.latitude || Number(mappedVendors[0].latitude),
                      longitude: currentCoords?.longitude || Number(mappedVendors[0].longitude),
                      latitudeDelta: 0.15,
                      longitudeDelta: 0.15,
                    }}
                    showsUserLocation={Boolean(currentCoords)}
                  >
                    {mappedVendors.map((vendor) => (
                      <Marker
                        key={vendor.id}
                        coordinate={{
                          latitude: Number(vendor.latitude),
                          longitude: Number(vendor.longitude),
                        }}
                        title={vendor.shop_name}
                        description={`${vendor.location} • ${Number(vendor.overall_score || 0).toFixed(1)} stars`}
                        onCalloutPress={() => router.push(`/vendor/${vendor.id}`)}
                      />
                    ))}
                  </MapView>
                ) : (
                  <View style={styles.mapEmpty}>
                    {isLoading ? (
                      <ActivityIndicator color="#f97316" />
                    ) : (
                      <Text style={styles.emptyText}>No mapped vendors matched the current filters.</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {showingCachedData && !isSearching && listData.length > 0 && (
              <View style={styles.cacheBanner}>
                <Text style={styles.cacheBannerText}>Showing cached vendors while the app reconnects.</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !isLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No vendors matched your current filters.</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function FilterRow({ label, options, value, onChange, formatter = (item) => item || 'Any' }) {
  return (
    <View style={styles.filterRowWrap}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.filterRow}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <TouchableOpacity
              key={`${label}-${option || 'any'}`}
              style={[styles.filterChip, selected && styles.filterChipActive]}
              onPress={() => onChange(option)}
            >
              <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>
                {formatter(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  listContent: { padding: 16, paddingBottom: 40 },
  headerWrap: { marginBottom: 16 },
  topHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  headerSubtitle: { color: '#94a3b8', fontSize: 14 },
  scanBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1e293b', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', paddingVertical: 14 },
  input: { backgroundColor: '#1e293b', color: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 14, paddingVertical: 14, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: '#f97316', paddingVertical: 12, borderRadius: 10 },
  actionBtnText: { color: '#fdba74', fontWeight: '700', fontSize: 12 },
  filterHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  filterHeaderText: { color: '#fdba74', fontWeight: '700' },
  filterRowWrap: { marginBottom: 10 },
  filterLabel: { color: '#cbd5e1', fontSize: 13, marginBottom: 6, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { borderWidth: 1, borderColor: '#334155', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111827' },
  filterChipActive: { borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.15)' },
  filterChipText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#fdba74' },
  clearBtn: { alignSelf: 'flex-start', marginTop: 6, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#f97316' },
  clearBtnText: { color: '#fdba74', fontWeight: '700' },
  mapWrap: { height: 260, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#334155', marginTop: 8, marginBottom: 12 },
  map: { flex: 1 },
  mapEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', padding: 24 },
  cacheBanner: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.3)', borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginTop: 4 },
  cacheBannerText: { color: '#fdba74', fontSize: 12, textAlign: 'center' },
  card: { backgroundColor: '#1e293b', borderRadius: 12, marginBottom: 20, overflow: 'hidden', borderColor: '#334155', borderWidth: 1 },
  image: { width: '100%', height: 180, backgroundColor: '#334155' },
  cardBody: { padding: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff', flex: 1 },
  scoreBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  scoreText: { color: '#f97316', fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  metaText: { color: '#94a3b8', fontSize: 14 },
  tagsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tag: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagText: { color: '#cbd5e1', fontSize: 12 },
  tagAccent: { backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tagAccentText: { color: '#4ade80', fontSize: 12 },
  ratingsText: { color: '#64748b', fontSize: 12 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', fontSize: 16, textAlign: 'center' },
});
