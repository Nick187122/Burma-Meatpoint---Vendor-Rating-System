import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import VendorCard from '../components/VendorCard';
import { Search, MapPin, Tag, LocateFixed, SlidersHorizontal, Star } from 'lucide-react';

export default function HomePage() {
  const [search, setSearch] = useState({
    q: '',
    location: '',
    meat_type: '',
    price_range: '',
    min_rating: '',
    latitude: '',
    longitude: '',
    radius_km: '10',
  });
  const [geoLoading, setGeoLoading] = useState(false);

  // Fetch top-rated vendors (cached by Django Redis)
  const { data: topVendors, isLoading: topLoading } = useQuery({
    queryKey: ['top-vendors'],
    queryFn: async () => {
      const { data } = await client.get('/vendors/top-rated/');
      return data;
    }
  });

  // Fetch search results based on active filters
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-vendors', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if(search.q) params.append('q', search.q);
      if(search.location) params.append('location', search.location);
      if(search.meat_type) params.append('meat_type', search.meat_type);
      if(search.price_range) params.append('price_range', search.price_range);
      if(search.min_rating) params.append('min_rating', search.min_rating);
      if(search.latitude && search.longitude) {
        params.append('latitude', search.latitude);
        params.append('longitude', search.longitude);
        params.append('radius_km', search.radius_km || '10');
      }
      
      const { data } = await client.get(`/vendors/search/?${params.toString()}`);
      return data.results;
    },
    enabled: Boolean(
      search.q ||
      search.location ||
      search.meat_type ||
      search.price_range ||
      search.min_rating ||
      (search.latitude && search.longitude)
    )
  });

  const isSearching = Boolean(
    search.q ||
    search.location ||
    search.meat_type ||
    search.price_range ||
    search.min_rating ||
    (search.latitude && search.longitude)
  );
  const displayVendors = isSearching ? searchResults : topVendors;

  const setCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSearch((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearNearby = () => {
    setSearch((prev) => ({
      ...prev,
      latitude: '',
      longitude: '',
    }));
  };

  return (
    <div className="container pb-12">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">
          <Tag size={14} /> Kenya's First Transparent Meat Rating System
        </div>
        <h1 className="hero-title">
          Verify Before You <span className="highlight">Buy</span>
        </h1>
        <p className="hero-sub">
          Ensure you're getting quality, hygiene-certified meat. Compare vendors and read anonymous customer reviews before making a purchase.
        </p>

        {/* Search Bar */}
        <div className="search-bar max-w-4xl mx-auto shadow-glow">
          <div className="search-input-wrap">
            <Search className="icon" size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search vendor name..."
              value={search.q}
              onChange={(e) => setSearch(p => ({...p, q: e.target.value}))}
            />
          </div>
          <div className="search-input-wrap">
            <MapPin className="icon" size={18} />
            <select 
              className="form-input form-select"
              value={search.location}
              onChange={(e) => setSearch(p => ({...p, location: e.target.value}))}
            >
              <option value="">Any Location</option>
              <option value="Nairobi CBD">Nairobi CBD</option>
              <option value="Burma Market">Burma Market</option>
              <option value="Kibera">Kibera</option>
              <option value="City Market">City Market</option>
            </select>
          </div>
          <div className="search-input-wrap">
            <Tag className="icon" size={18} />
            <select 
              className="form-input form-select"
              value={search.meat_type}
              onChange={(e) => setSearch(p => ({...p, meat_type: e.target.value}))}
            >
              <option value="">Any Meat Type</option>
              <option value="Beef">Beef</option>
              <option value="Mutton">Mutton</option>
              <option value="Goat">Goat</option>
              <option value="Chicken">Chicken</option>
              <option value="Pork">Pork</option>
            </select>
          </div>
        </div>

        <div className="search-bar max-w-4xl mx-auto shadow-glow mt-4">
          <div className="search-input-wrap">
            <SlidersHorizontal className="icon" size={18} />
            <select
              className="form-input form-select"
              value={search.price_range}
              onChange={(e) => setSearch(p => ({...p, price_range: e.target.value}))}
            >
              <option value="">Any Price Range</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div className="search-input-wrap">
            <Star className="icon" size={18} />
            <select
              className="form-input form-select"
              value={search.min_rating}
              onChange={(e) => setSearch(p => ({...p, min_rating: e.target.value}))}
            >
              <option value="">Any Rating</option>
              <option value="4.5">4.5+</option>
              <option value="4">4.0+</option>
              <option value="3">3.0+</option>
            </select>
          </div>
          <div className="search-input-wrap">
            <MapPin className="icon" size={18} />
            <select
              className="form-input form-select"
              value={search.radius_km}
              onChange={(e) => setSearch(p => ({...p, radius_km: e.target.value}))}
            >
              <option value="5">Within 5 km</option>
              <option value="10">Within 10 km</option>
              <option value="25">Within 25 km</option>
            </select>
          </div>
        </div>

        <div className="flex justify-center gap-3 mt-4 flex-wrap">
          <button type="button" className="btn btn-outline" onClick={setCurrentLocation} disabled={geoLoading}>
            <LocateFixed size={16} /> {geoLoading ? 'Finding You...' : 'Use My Location'}
          </button>
          {(search.latitude && search.longitude) && (
            <button type="button" className="btn btn-outline" onClick={clearNearby}>
              Clear Nearby Filter
            </button>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mt-8">
        <div className="flex-between mb-6">
          <h2 className="section-title text-xl m-0 text-primary">
            {isSearching ? 'Search Results' : 'Top Rated Vendors (Live)'}
          </h2>
        </div>

        {topLoading || (isSearching && searchLoading) ? (
           <div className="grid-4">
             {[1,2,3,4].map(n => (
               <div key={n} className="card skeleton" style={{ height: '300px' }} />
             ))}
           </div>
        ) : displayVendors?.length > 0 ? (
           <div className="grid-4">
             {displayVendors.map(vendor => (
               <VendorCard key={vendor.id} vendor={vendor} />
             ))}
           </div>
        ) : (
           <div className="card text-center py-12 text-muted">
             No vendors found matching your criteria.
           </div>
        )}
      </section>
    </div>
  );
}
