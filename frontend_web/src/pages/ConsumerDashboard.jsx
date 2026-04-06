import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import client from '../api/client';
import useAuthStore from '../store/authStore';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';
import { Heart, Star, Clock, Trash2, MapPin, Tag } from 'lucide-react';

export default function ConsumerDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ratings');

  const { data: myRatings, isLoading: ratingsLoading } = useQuery({
    queryKey: ['consumer-my-ratings'],
    queryFn: async () => {
      const { data } = await client.get('/consumer/my-ratings/');
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: activeTab === 'ratings'
  });

  const { data: favorites, isLoading: favsLoading } = useQuery({
    queryKey: ['consumer-favorites'],
    queryFn: async () => {
      const { data } = await client.get('/consumer/favorites/');
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: activeTab === 'favorites'
  });

  const removeFavorite = useMutation({
    mutationFn: (vendorId) => client.delete(`/consumer/favorites/${vendorId}/`),
    onSuccess: () => {
      toast.success('Removed from favorites.');
      queryClient.invalidateQueries(['consumer-favorites']);
    },
    onError: () => toast.error('Failed to remove favorite.')
  });

  const tabs = [
    { id: 'ratings', label: 'My Ratings', icon: <Star size={16} /> },
    { id: 'favorites', label: 'Saved Vendors', icon: <Heart size={16} /> },
  ];

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-1">My Profile</h1>
        <p className="text-secondary">
          Welcome back, <span className="text-white font-semibold">{user?.name}</span>
          <span className="text-muted ml-2 text-sm">· {user?.email}</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6 border-b border-[var(--border)] pb-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--orange)] text-orange'
                : 'border-transparent text-secondary hover:text-white'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── MY RATINGS ──────────────────────────────────────────────────────── */}
      {activeTab === 'ratings' && (
        <div>
          {ratingsLoading ? (
            <div className="text-center py-12 text-muted spin">Loading your ratings...</div>
          ) : myRatings?.length === 0 ? (
            <div className="card text-center py-16">
              <Star size={40} className="text-muted mx-auto mb-4" />
              <p className="text-muted mb-4">You haven't rated any vendors yet.</p>
              <Link to="/" className="btn btn-primary">Find Vendors to Rate</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted mb-4">{myRatings.length} rating{myRatings.length !== 1 ? 's' : ''} submitted</p>
              {myRatings.map(rating => (
                <div key={rating.id} className="card p-5">
                  <div className="flex-between mb-3 pb-3 border-b border-[var(--border)]">
                    <div>
                      <Link
                        to={`/vendor/${rating.vendor}`}
                        className="font-bold text-orange hover:underline"
                      >
                        Vendor #{rating.vendor}
                      </Link>
                      <div className="flex items-center gap-1 text-xs text-muted mt-1">
                        <Clock size={11} /> {new Date(rating.timestamp).toLocaleDateString('en-KE', {
                          year: 'numeric', month: 'short', day: 'numeric'
                        })}
                        {rating.anonymous_mode && (
                          <span className="badge badge-gray ml-2">Anonymous</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <StarRating value={(rating.hygiene_score + rating.freshness_score + rating.service_score) / 3} size={16} />
                    </div>
                  </div>

                  <div className="flex gap-2 mb-3">
                    <span className="badge badge-blue">Hygiene: {rating.hygiene_score}/5</span>
                    <span className="badge badge-green">Freshness: {rating.freshness_score}/5</span>
                    <span className="badge badge-yellow">Service: {rating.service_score}/5</span>
                  </div>

                  {rating.comment && (
                    <p className="text-sm text-secondary italic">"{rating.comment}"</p>
                  )}

                  {/* Vendor reply thread */}
                  {rating.vendor_reply && (
                    <div className="mt-3 p-3 bg-orange-500/5 border-l-2 border-orange rounded-r text-sm">
                      <span className="text-xs font-bold text-orange block mb-1">Vendor Reply</span>
                      <span className="text-secondary">{rating.vendor_reply.text}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── SAVED VENDORS ───────────────────────────────────────────────────── */}
      {activeTab === 'favorites' && (
        <div>
          {favsLoading ? (
            <div className="text-center py-12 text-muted spin">Loading saved vendors...</div>
          ) : favorites?.length === 0 ? (
            <div className="card text-center py-16">
              <Heart size={40} className="text-muted mx-auto mb-4" />
              <p className="text-muted mb-4">You haven't saved any vendors yet.</p>
              <Link to="/" className="btn btn-primary">Discover Vendors</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted mb-4">{favorites.length} saved vendor{favorites.length !== 1 ? 's' : ''}</p>
              <div className="grid-2 gap-4">
                {favorites.map(fav => {
                  const v = fav.vendor_details;
                  return (
                    <div key={fav.id} className="card p-5 flex flex-col gap-3">
                      <div className="flex-between">
                        <Link to={`/vendor/${v.id}`} className="font-bold text-lg text-orange hover:underline">
                          {v.shop_name}
                        </Link>
                        <button
                          onClick={() => removeFavorite.mutate(v.id)}
                          className="text-muted hover:text-danger transition-colors"
                          title="Remove from favorites"
                          disabled={removeFavorite.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="flex gap-3 text-sm text-secondary">
                        <span className="flex items-center gap-1"><MapPin size={13} /> {v.location}</span>
                        <span className="flex items-center gap-1"><Tag size={13} /> {v.meat_types}</span>
                      </div>
                      <div className="flex-between">
                        <StarRating value={v.overall_score} size={15} />
                        <span className="text-sm text-muted">{v.total_ratings} ratings</span>
                      </div>
                      {v.price_range && (
                        <span className="badge badge-green self-start">{v.price_range}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
