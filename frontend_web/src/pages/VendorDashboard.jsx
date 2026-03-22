import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { Star, ShieldAlert, TrendingUp, Users, Settings } from 'lucide-react';

export default function VendorDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [photoBase64, setPhotoBase64] = useState(null);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['vendor-analytics'],
    queryFn: async () => {
      const { data } = await client.get('/vendor/dashboard/');
      return data;
    }
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

  if (analyticsLoading) return <div className="container py-12 text-center text-muted spin">Loading Dashboard...</div>;

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
    if (newName && newName !== analytics?.vendor?.shop_name) {
      requestNameChange.mutate(newName);
    }
  };

  return (
    <div className="container py-12 flex flex-col md:flex-row gap-12">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar w-full md:w-64 flex-shrink-0">
        <div className="sidebar-nav space-y-2">
          <button onClick={() => setActiveTab('overview')} className={`sidebar-link w-full text-left p-3 rounded transition-colors ${activeTab === 'overview' ? 'active text-white bg-slate-800' : 'text-secondary hover:bg-slate-800 hover:text-white'}`}>
            <TrendingUp size={18} className="inline-block mr-2" /> Overview Analytics
          </button>
          <button onClick={() => setActiveTab('settings')} className={`sidebar-link w-full text-left p-3 rounded transition-colors ${activeTab === 'settings' ? 'active text-white bg-slate-800' : 'text-secondary hover:bg-slate-800 hover:text-white'}`}>
            <Settings size={18} className="inline-block mr-2" /> Store Settings
          </button>
          <a href={`/vendor/${analytics?.vendor?.id}`} className="sidebar-link block text-secondary p-3 rounded hover:bg-slate-800 hover:text-white transition-colors">
            <Star size={18} className="inline-block mr-2" /> My Public Profile
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
        <h1 className="text-3xl font-bold mb-8">Vendor Dashboard</h1>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid-3 gap-6">
              <div className="stat-card border-green-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><Star size={16} className="text-green-500"/> Overall Score</span>
                <span className="stat-value text-green-500 text-3xl font-bold">{Number(analytics?.metrics?.overall_score || 0).toFixed(1)}</span>
                <span className="stat-sub block mt-2 text-sm text-secondary">Across all categories</span>
              </div>
              
              <div className="stat-card border-blue-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><Users size={16} className="text-blue-500"/> Total Ratings</span>
                <span className="stat-value text-blue-500 text-3xl font-bold">{analytics?.metrics?.total_ratings || 0}</span>
                <span className="stat-sub block mt-2 text-sm text-secondary">Verified customers</span>
              </div>
              
              <div className="stat-card border-orange-500/30 p-6">
                <span className="stat-label flex gap-2 mb-2 text-sm"><ShieldAlert size={16} className="text-orange-500"/> Reviews</span>
                <span className="stat-value text-orange-500 text-3xl font-bold">{analytics?.metrics?.total_ratings || 0}</span>
                <span className="stat-sub block mt-2 text-sm text-secondary">Total feedback received</span>
              </div>
            </div>

            {/* Recent Activity / Benchmark */}
            <div className="card-glass p-0 overflow-hidden border-orange mt-8 shadow-lg">
              <div className="p-5 border-b border-[var(--border)] bg-orange-500/5">
                <h3 className="text-xl font-bold text-orange">Performance Benchmark</h3>
              </div>
              <div className="p-8">
                <div className="space-y-6">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Hygiene Score</span>
                    <span className="font-bold">{Number(analytics?.metrics?.hygiene_score || 0).toFixed(1)} / 5</span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Freshness Score</span>
                    <span className="font-bold">{Number(analytics?.metrics?.freshness_score || 0).toFixed(1)} / 5</span>
                  </div>
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Service Score</span>
                    <span className="font-bold">{Number(analytics?.metrics?.service_score || 0).toFixed(1)} / 5</span>
                  </div>
                </div>
                
                <div className="mt-10 pt-6 border-t border-[var(--border)] text-center">
                   <a href={`/vendor/${analytics?.vendor?.id}`} className="btn btn-primary px-6 py-2">Manage Customer Reviews</a>
                   <p className="text-sm text-muted mt-4">Replying to reviews boosts your algorithm ranking visibility.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-10">
            <div className="card-glass p-8 shadow-lg">
              <h3 className="text-2xl font-bold mb-6 flex gap-3 items-center"><Settings size={24} className="text-white"/> Update Store Profile</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Products Available (Meat Types)</label>
                  <input type="text" name="meat_types" className="form-input w-full p-3 rounded bg-slate-800 border-slate-700" defaultValue={analytics?.vendor?.meat_types || ''} placeholder="e.g. Beef, Mutton, Chicken" />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Price Range / Notes</label>
                  <input type="text" name="price_range" className="form-input w-full p-3 rounded bg-slate-800 border-slate-700" defaultValue={analytics?.vendor?.price_range || ''} placeholder="e.g. 500-1200 KES/kg" />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label block mb-2 font-medium">Showcase Your Meat (Photo)</label>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="form-input w-full p-3 rounded bg-slate-800 border border-slate-700 cursor-pointer" />
                </div>
                <button type="submit" className="btn btn-primary px-8 py-3 mt-4 text-base" disabled={updateProfile.isLoading}>
                  {updateProfile.isLoading ? 'Saving...' : 'Save Profile Updates'}
                </button>
              </form>
            </div>

            <div className="card-glass p-8 border-orange shadow-lg">
              <h3 className="text-2xl font-bold text-orange mb-6 flex gap-3 items-center"><ShieldAlert size={24}/> Request Shop Name Change</h3>
              <p className="text-base text-secondary mb-6 leading-relaxed">
                Shop name changes must be manually approved by the Administrator to prevent impersonation. 
                Your current shop name is <strong className="text-white bg-slate-800 px-2 py-1 rounded ml-1">{analytics?.vendor?.shop_name}</strong>.
              </p>
              <form onSubmit={handleNameChange} className="flex flex-col md:flex-row gap-6 items-end">
                <div className="form-group mb-0 flex-1 w-full">
                  <label className="form-label block mb-2 font-medium">New Shop Name</label>
                  <input type="text" name="new_name" className="form-input w-full p-3 rounded bg-slate-800 border-slate-700" placeholder="Enter requested new name" required />
                </div>
                <button type="submit" className="btn btn-outline border-orange text-orange px-6 py-3 w-full md:w-auto" disabled={requestNameChange.isLoading}>
                  {requestNameChange.isLoading ? 'Requesting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
