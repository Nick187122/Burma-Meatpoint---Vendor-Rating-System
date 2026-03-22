import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [searchParams] = useSearchParams();
  const initTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const [tab, setTab] = useState(initTab);
  
  const navigate = useNavigate();
  const { login, register } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', confirm_password: '', name: '', phone: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let res;
      if (tab === 'login') {
        res = await login({ email: formData.email, password: formData.password });
        toast.success(`Welcome back, ${res.user.name}!`);
        // Route based on role
        if (res.user.role === 'Admin') navigate('/admin');
        else if (res.user.role === 'Vendor' && res.user.is_vendor_approved) navigate('/vendor-dashboard');
        else navigate('/');
      } else {
        if (formData.password !== formData.confirm_password) {
          toast.error('Passwords do not match');
          setIsLoading(false);
          return;
        }
        res = await register(formData);
        toast.success('Registration successful!');
        navigate('/');
      }
    } catch (err) {
      let msg = 'Authentication failed';
      if (err.response?.data) {
        if (err.response.data.error) msg = err.response.data.error;
        else if (err.response.data.detail) msg = err.response.data.detail;
        else if (typeof err.response.data === 'object') {
          // DRF form validation error: Extract the first error of the first field
          const firstKey = Object.keys(err.response.data)[0];
          msg = Array.isArray(err.response.data[firstKey]) 
            ? err.response.data[firstKey][0] 
            : err.response.data[firstKey];
        }
      }
      toast.error(typeof msg === 'string' ? msg : 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="card-glass p-8" style={{ width: '100%', maxWidth: '420px' }}>
        
        <div className="flex gap-4 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
          <button 
            className={`flex-1 pb-3 font-semibold ${tab === 'login' ? 'text-primary' : 'text-secondary'}`}
            style={{ borderBottom: tab === 'login' ? '2px solid var(--primary)' : '2px solid transparent' }}
            onClick={() => setTab('login')}
          >
            Sign In
          </button>
          <button 
            className={`flex-1 pb-3 font-semibold ${tab === 'register' ? 'text-primary' : 'text-secondary'}`}
            style={{ borderBottom: tab === 'register' ? '2px solid var(--primary)' : '2px solid transparent' }}
            onClick={() => setTab('register')}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-col gap-4">
          {tab === 'register' && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input required type="text" className="form-input" 
                  value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="tel" className="form-input" 
                  value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input required type="email" className="form-input" 
              value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input required type="password" className="form-input" minLength={8}
              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
            />
          </div>

          {tab === 'register' && (
             <div className="form-group">
               <label className="form-label">Confirm Password</label>
               <input required type="password" className="form-input" 
                 value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})} 
               />
             </div>
          )}

          <button type="submit" className="btn btn-primary btn-full mt-4" disabled={isLoading}>
            {isLoading ? 'Processing...' : (tab === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

      </div>
    </div>
  );
}
