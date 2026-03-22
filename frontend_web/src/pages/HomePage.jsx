import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import VendorCard from '../components/VendorCard';
import { Search, MapPin, Tag } from 'lucide-react';

export default function HomePage() {
  const [search, setSearch] = useState({ q: '', location: '', meat_type: '' });

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
      
      const { data } = await client.get(`/vendors/search/?${params.toString()}`);
      return data.results;
    },
    enabled: search.q !== '' || search.location !== '' || search.meat_type !== ''
  });

  const isSearching = search.q || search.location || search.meat_type;
  const displayVendors = isSearching ? searchResults : topVendors;

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
