import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import toast from 'react-hot-toast';
import { Star, ShieldAlert, TrendingUp, Users, Settings, MessageSquare, Clock } from 'lucide-react';

export default function VendorDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [photoBase64, setPhotoBase64] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['vendor-analytics'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/dashboard/');
      return data;
    }
  });

  const { data: qrData } = useQuery({
    queryKey: ['vendor-qr-code'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/qr-code/');
      return data;
    },
    enabled: activeTab === 'overview' || activeTab === 'settings'
  });

  const { data: myRatings, isLoading: ratingsLoading } = useQuery({
    queryKey: ['vendor-my-ratings'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/ratings/');
      return data;
    },
    enabled: activeTab === 'reviews'
  });

  const updateProfile = useMutation({
    mutationFn: (data) => client.patch('/vendor/profile/', data),
    onSuccess: () => {
      toast.success('Profile updated successfully!');
      queryClient.invalidateQueries(['vendor-analytics']);
      setPhotoBase64(null);
    },
    onError: () => toast.error('Failed to update profile.')
  });

  const requestNameChange = useMutation({
    mutationFn: (new_name) => client.post('/vendor/shop-name-request/', { new_name }),
    onSuccess: () => {
      toast.success('Name change requested! Admin will review it shortly.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to request name change.');
    }
  });

  const postReply = useMutation({
    mutationFn: ({ rating_id, reply_text }) =>
      client.post(`/vendor/ratings/${rating_id}/reply/`, { reply_text }),
    onSuccess: () => {
      toast.success('Reply posted!');
      setReplyTexts({});
      queryClient.invalidateQueries(['vendor-my-ratings']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to post reply.')
  });

  if (analyticsLoading) return <div className="container py-12 text-center text-muted spin">Loading Dashboard...</div>;

  // The API returns: { vendor, benchmark, recent_ratings, score_breakdown }
  const vendor = analytics?.vendor;
  const scores = analytics?.score_breakdown;
  const benchmark = analytics?.benchmark;
  const reviews = Array.isArray(myRatings) ? myRatings : (myRatings?.results || []);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setPhotoBase64(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleProfileUpdate = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = {
      meat_types: fd.get('meat_types'),
      price_range: fd.get('price_range')
    };
    if (photoBase64) {
      payload.meat_photo = photoBase64;
    }
    updateProfile.mutate(payload);
  };

  const handleNameChange = (e) => {
    e.preventDefault();
    const newName = new FormData(e.target).get('new_name');
    if (newName && newName !== vendor?.shop_name) {
      requestNameChange.mutate(newName);
    }
  };

  const handleReplySubmit = (ratingId) => {
    const text = replyTexts[ratingId]?.trim();
    if (!text) return;
    postReply.mutate({ rating_id: ratingId, reply_text: text });
  };

  const tabs = [
    { id: 'overview', label: 'Overview Analytics', icon: <TrendingUp size={18} /> },
    { id: 'reviews', label: 'Customer Reviews', icon: <MessageSquare size={18} /> },
    { id: 'settings', label: 'Store Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="container py-12 flex flex-col md:flex-row gap-12">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar w-full md:w-64 flex-shrink-0">
        <div className="sidebar-nav space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`sidebar-link w-full text-left p-3 rounded transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'active text-white bg-slate-800'
                  : 'text-secondary hover:bg-slate-800 hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
          <a
            href={`/vendor/${vendor?.id}`}
            className="sidebar-link block text-secondary p-3 rounded hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
          >
            <Star size={18} /> My Public Profile
          </a>
        </div>

        <div className="mt-8 p-5 bg-orange-500/10 border border-orange-500/20 rounded-md">
          <h4 className="text-sm font-bold text-orange mb-3">Seller Tips</h4>
          <ul className="text-sm text-secondary flex-col gap-2 list-disc pl-5 space-y-1">
            <li>Respond to reviews promptly</li>
            <li>Maintain high hygiene standards</li>
            <li>Upload an appetizing meat photo</li>
          </ul>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-content flex-grow">
        <h1 className="text-3xl font-bold mb-2">
          {vendor?.shop_name || 'Vendor Dashboard'}
        </h1>
        <p className="text-secondary mb-8">{vendor?.location} · {vendor?.meat_types}</p>

        {/* ─── OVERVIEW TAB ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid-3 gap-6">
              <div className="stat-card border-green-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><Star size={16} className="text-green-500" /> Overall Score</span>
                <span className="stat-value text-green-500 text-3xl font-bold">
                  {Number(scores?.overall || 0).toFixed(1)}
                </span>
                <span className="stat-sub block mt-2 text-sm text-secondary">/ 5.0 composite</span>
              </div>

              <div className="stat-card border-blue-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><Users size={16} className="text-blue-500" /> Total Ratings</span>
                <span className="stat-value text-blue-500 text-3xl font-bold">
                  {scores?.total_ratings || 0}
                </span>
                <span className="stat-sub block mt-2 text-sm text-secondary">Verified customers</span>
              </div>

              <div className="stat-card border-orange-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><ShieldAlert size={16} className="text-orange-500" /> Area Avg Score</span>
                <span className="stat-value text-orange-500 text-3xl font-bold">
                  {Number(benchmark?.area_average || 0).toFixed(1)}
                </span>
                <span className="stat-sub block mt-2 text-sm text-secondary">
                  {benchmark?.difference >= 0 ? '+' : ''}{Number(benchmark?.difference || 0).toFixed(1)} vs. you
                </span>
              </div>
            </div>

            <div className="card-glass p-6 border-orange shadow-lg">
              <div className="flex flex-col md:flex-row gap-6 items-center">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-orange mb-2">Shop QR Code</h3>
                  <p className="text-sm text-secondary mb-4">Print or share this code so customers can land directly on your public rating page.</p>
                  <div className="flex flex-wrap gap-3">
                    <a href={qrData?.profile_url} target="_blank" rel="noreferrer" className="btn btn-primary">
                      Open Public Page
                    </a>
                    {qrData?.qr_code_data_url && (
                      <a href={qrData.qr_code_data_url} download={`vendor-${vendor?.id || 'qr'}.png`} className="btn btn-outline">
                        Save QR Image
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-4 break-all">{qrData?.profile_url}</p>
                </div>
                {qrData?.qr_code_data_url && (
                  <div className="bg-white rounded-lg p-4 shadow-md">
                    <img src={qrData.qr_code_data_url} alt="Vendor QR code" className="w-44 h-44 object-contain" />
                  </div>
                )}
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="card-glass p-0 overflow-hidden border-orange shadow-lg">
              <div className="p-5 border-b border-[var(--border)] bg-orange-500/5">
                <h3 className="text-xl font-bold text-orange">Score Breakdown</h3>
              </div>
              <div className="p-8 space-y-6">
                {[
                  { label: 'Hygiene & Cleanliness', value: scores?.hygiene, color: 'text-green-400', barColor: 'bg-green-400' },
                  { label: 'Meat Freshness', value: scores?.freshness, color: 'text-blue-400', barColor: 'bg-blue-400' },
                  { label: 'Customer Service', value: scores?.service, color: 'text-yellow-400', barColor: 'bg-yellow-400' },
                ].map(({ label, value, color, barColor }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className={`font-semibold text-sm ${color}`}>{label}</span>
                      <span className="font-bold">{Number(value || 0).toFixed(1)} / 5.0</span>
                    </div>
                    <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-700`}
                        style={{ width: `${(Number(value || 0) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="mt-6 pt-6 border-t border-[var(--border)] text-center">
                  <button onClick={() => setActiveTab('reviews')} className="btn btn-primary px-6 py-2">
                    View Customer Reviews
                  </button>
                  <p className="text-sm text-muted mt-4">Replying to reviews boosts your algorithm ranking visibility.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── REVIEWS TAB ──────────────────────────────────────────────── */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare size={22} className="text-orange" />
              Customer Reviews
              <span className="badge badge-orange ml-1">{scores?.total_ratings || 0}</span>
            </h2>

            {ratingsLoading ? (
              <div className="text-muted spin text-center py-8">Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className="card text-center py-12 text-muted">No reviews yet. Share your profile link to get rated!</div>
            ) : (
              <div className="space-y-4">
                {reviews.map(rating => (
                  <div key={rating.id} className="card p-5 border border-[var(--border)]">
                    <div className="flex-between mb-3 pb-3 border-b border-[var(--border)]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex-center font-bold text-orange text-sm">
                          {rating.consumer_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="font-bold text-sm">
                            {rating.consumer_name}
                            {rating.anonymous_mode && <span className="badge badge-gray ml-2 text-xs">Anonymous</span>}
                          </div>
                          <div className="text-xs text-muted flex items-center gap-1">
                            <Clock size={11} /> {new Date(rating.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="badge badge-blue">H: {rating.hygiene_score}</span>
                        <span className="badge badge-green">F: {rating.freshness_score}</span>
                        <span className="badge badge-yellow">S: {rating.service_score}</span>
                      </div>
                    </div>

                    {rating.comment && (
                      <p className="text-sm text-secondary italic mb-4">"{rating.comment}"</p>
                    )}

                    {/* Vendor reply thread */}
                    {rating.vendor_reply ? (
                      <div className="mt-3 p-3 bg-orange-500/5 border-l-2 border-orange-500 rounded-r text-sm text-secondary">
                        <span className="text-xs font-bold text-orange block mb-1">Your Reply</span>
                        {rating.vendor_reply.text}
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          className="form-input flex-1 py-1.5 px-3 text-sm"
                          placeholder="Write a public reply..."
                          value={replyTexts[rating.id] || ''}
                          onChange={(e) => setReplyTexts(prev => ({ ...prev, [rating.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit(rating.id)}
                        />
                        <button
                          onClick={() => handleReplySubmit(rating.id)}
                          className="btn btn-outline btn-sm"
                          disabled={postReply.isPending}
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── SETTINGS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'settings' && (
          <div className="space-y-10">
            <div className="card-glass p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-6 flex gap-3 items-center">
                <Settings size={24} className="text-white" /> Update Store Profile
              </h3>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Products Available (Meat Types)</label>
                  <input
                    type="text" name="meat_types"
                    className="form-input w-full p-3 rounded bg-slate-800 border-slate-700"
                    defaultValue={vendor?.meat_types || ''}
                    placeholder="e.g. Beef, Mutton, Chicken"
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Price Range / Notes</label>
                  <input
                    type="text" name="price_range"
                    className="form-input w-full p-3 rounded bg-slate-800 border-slate-700"
                    defaultValue={vendor?.price_range || ''}
                    placeholder="e.g. 500-1200 KES/kg"
                  />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Showcase Your Meat (Photo)</label>
                  <input
                    type="file" accept="image/*"
                    onChange={handlePhotoUpload}
                    className="form-input w-full p-3 rounded bg-slate-800 border border-slate-700 cursor-pointer"
                  />
                  {photoBase64 && (
                    <img src={photoBase64} alt="Preview" className="mt-3 rounded max-h-32 object-cover" />
                  )}
                </div>
                <button
                  type="submit"
                  className="btn btn-primary px-8 py-3 mt-4 text-base"
                  disabled={updateProfile.isPending}
                >
                  {updateProfile.isPending ? 'Saving...' : 'Save Profile Updates'}
                </button>
              </form>
            </div>

            {qrData?.qr_code_data_url && (
              <div className="card-glass p-8 border-orange shadow-lg">
                <h3 className="text-2xl font-bold text-orange mb-4">Vendor QR Display</h3>
                <p className="text-base text-secondary mb-6">Use this QR code on posters, counters, or your phone so customers can open your shop profile instantly.</p>
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <div className="bg-white rounded-lg p-4 shadow-md">
                    <img src={qrData.qr_code_data_url} alt="Vendor QR code" className="w-52 h-52 object-contain" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary mb-3 break-all">{qrData.profile_url}</p>
                    <a href={qrData.profile_url} target="_blank" rel="noreferrer" className="btn btn-outline">
                      Open Public Profile
                    </a>
                  </div>
                </div>
              </div>
            )}

            <div className="card-glass p-8 border-orange shadow-lg">
              <h3 className="text-2xl font-bold text-orange mb-6 flex gap-3 items-center">
                <ShieldAlert size={24} /> Request Shop Name Change
              </h3>
              <p className="text-base text-secondary mb-6 leading-relaxed">
                Shop name changes must be manually approved by the Administrator to prevent impersonation.
                Your current shop name is{' '}
                <strong className="text-white bg-slate-800 px-2 py-1 rounded ml-1">{vendor?.shop_name}</strong>.
              </p>
              <form onSubmit={handleNameChange} className="flex flex-col md:flex-row gap-6 items-end">
                <div className="form-group mb-0 flex-1 w-full">
                  <label className="form-label block mb-2 font-medium">New Shop Name</label>
                  <input
                    type="text" name="new_name"
                    className="form-input w-full p-3 rounded bg-slate-800 border-slate-700"
                    placeholder="Enter requested new name"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-outline border-orange text-orange px-6 py-3 w-full md:w-auto"
                  disabled={requestNameChange.isPending}
                >
                  {requestNameChange.isPending ? 'Requesting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
