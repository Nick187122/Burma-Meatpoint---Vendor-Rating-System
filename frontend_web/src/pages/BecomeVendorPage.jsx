import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { ShieldAlert } from 'lucide-react';

export default function BecomeVendorPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shop_name: '', label: '', kebs_license: '', location: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post('/vendor-requests/', formData);
      toast.success('Application submitted successfully! Please wait for Admin approval.');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (user?.is_vendor_approved) {
    return (
      <div className="container py-12 text-center text-success">
        <h2 className="text-2xl font-bold mb-2">You are already an approved Vendor!</h2>
        <button onClick={() => navigate('/vendor-dashboard')} className="btn btn-outline mt-4">Go to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="container py-12 flex-center">
      <div className="card-glass p-8 max-w-2xl w-full">
        <div className="mb-6 pb-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-bold text-orange mb-2">Become a Verified Vendor</h2>
          <p className="text-secondary">Join the platform to reach more customers and build trust through transparent ratings.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex-col gap-5">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label text-white">Shop/Business Name</label>
              <input required className="form-input" placeholder="e.g. Oloibon Meat Point"
                value={formData.shop_name} onChange={e => setFormData({...formData, shop_name: e.target.value})} 
              />
            </div>
            <div className="form-group">
              <label className="form-label text-white">Stall Number / Label</label>
              <input required className="form-input" placeholder="e.g. Block C, Stall 4"
                value={formData.label} onChange={e => setFormData({...formData, label: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label text-white">Location Market</label>
              <select required className="form-input form-select"
                value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}
              >
                <option value="">Select Primary Market</option>
                <option value="Burma Market">Burma Market</option>
                <option value="City Market">City Market</option>
                <option value="Kibera">Kibera</option>
                <option value="Nairobi CBD">Nairobi CBD</option>
              </select>
            </div>
            
            <div className="form-group flex-col justify-end">
               <label className="form-label text-white flex gap-2 items-center">
                 KEBS License Number <ShieldAlert size={14} className="text-success" />
               </label>
               <input required className="form-input border-success" placeholder="KEB-XXXX-2026"
                 value={formData.kebs_license} onChange={e => setFormData({...formData, kebs_license: e.target.value})} 
               />
               <span className="text-xs text-secondary mt-1">Verification required for approval</span>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
