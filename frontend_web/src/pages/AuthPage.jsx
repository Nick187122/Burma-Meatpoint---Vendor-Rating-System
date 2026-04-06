import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import client from '../api/client';
import useAuthStore from '../store/authStore';

const getInitialMode = (searchParams) => {
  const mode = searchParams.get('mode');
  if (mode === 'forgot' || mode === 'reset' || mode === 'verify') return mode;
  return searchParams.get('tab') === 'register' ? 'register' : 'login';
};

export default function AuthPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, register } = useAuthStore();

  const initialMode = useMemo(() => getInitialMode(searchParams), [searchParams]);
  const [mode, setMode] = useState(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirm_password: '',
    name: '',
    phone: '',
  });
  const [resetData, setResetData] = useState({
    password: '',
    confirm_password: '',
  });

  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';
  const isResetMode = mode === 'reset' && uid && token;
  const isVerifyMode = mode === 'verify' && uid && token;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const updateMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === 'register') setSearchParams({ tab: 'register' });
    else if (nextMode === 'forgot') setSearchParams({ mode: 'forgot' });
    else if (nextMode === 'reset' && uid && token) setSearchParams({ mode: 'reset', uid, token });
    else if (nextMode === 'verify' && uid && token) setSearchParams({ mode: 'verify', uid, token });
    else setSearchParams({});
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let res;
      if (mode === 'login') {
        res = await login({ email: formData.email, password: formData.password });
        toast.success(`Welcome back, ${res.user.name}!`);
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
        toast.success(res.message || 'Registration successful. Check your email to verify your account.');
        navigate('/');
      }
    } catch (err) {
      let msg = 'Authentication failed';
      if (err.response?.data) {
        if (err.response.data.error) msg = err.response.data.error;
        else if (err.response.data.detail) msg = err.response.data.detail;
        else if (typeof err.response.data === 'object') {
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

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await client.post('/auth/password-reset/request/', { email: formData.email });
      toast.success(data.message || 'Password reset email sent.');
      updateMode('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to start password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await client.post('/auth/password-reset/confirm/', {
        uid,
        token,
        password: resetData.password,
        confirm_password: resetData.confirm_password,
      });
      toast.success(data.message || 'Password reset successful.');
      setResetData({ password: '', confirm_password: '' });
      updateMode('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await client.post('/auth/email-verification/confirm/', { uid, token });
      toast.success(data.message || 'Email verified successfully.');
      updateMode('login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to verify email.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsLoading(true);
    try {
      const { data } = await client.post('/auth/email-verification/request/', { email: formData.email });
      toast.success(data.message || 'Verification email sent.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to resend verification email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container flex-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="card-glass p-8" style={{ width: '100%', maxWidth: '440px' }}>
        {(mode === 'login' || mode === 'register') && (
          <div className="flex gap-4 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              className={`flex-1 pb-3 font-semibold ${mode === 'login' ? 'text-primary' : 'text-secondary'}`}
              style={{ borderBottom: mode === 'login' ? '2px solid var(--primary)' : '2px solid transparent' }}
              onClick={() => updateMode('login')}
            >
              Sign In
            </button>
            <button
              className={`flex-1 pb-3 font-semibold ${mode === 'register' ? 'text-primary' : 'text-secondary'}`}
              style={{ borderBottom: mode === 'register' ? '2px solid var(--primary)' : '2px solid transparent' }}
              onClick={() => updateMode('register')}
            >
              Create Account
            </button>
          </div>
        )}

        {(mode === 'login' || mode === 'register') && (
          <form onSubmit={handleAuthSubmit} className="flex-col gap-4">
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    required
                    type="text"
                    className="form-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                required
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                required
                type="password"
                className="form-input"
                minLength={8}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <input
                  required
                  type="password"
                  className="form-input"
                  value={formData.confirm_password}
                  onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full mt-4" disabled={isLoading}>
              {isLoading ? 'Processing...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>

            {mode === 'login' && (
              <>
                <button
                  type="button"
                  className="btn btn-outline btn-full"
                  onClick={() => updateMode('forgot')}
                >
                  Forgot Password
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-full"
                  onClick={handleResendVerification}
                  disabled={isLoading || !formData.email}
                >
                  Resend Verification Email
                </button>
              </>
            )}
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold mb-2">Forgot Password</h2>
              <p className="text-secondary text-sm">Enter your account email and the backend will send a reset link.</p>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                required
                type="email"
                className="form-input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" className="btn btn-outline btn-full" onClick={() => updateMode('login')}>
              Back to Sign In
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold mb-2">Set New Password</h2>
              <p className="text-secondary text-sm">
                {isResetMode ? 'Choose a new password for your account.' : 'This reset link is incomplete or invalid.'}
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                required
                type="password"
                className="form-input"
                minLength={8}
                value={resetData.password}
                onChange={(e) => setResetData({ ...resetData, password: e.target.value })}
                disabled={!isResetMode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                required
                type="password"
                className="form-input"
                minLength={8}
                value={resetData.confirm_password}
                onChange={(e) => setResetData({ ...resetData, confirm_password: e.target.value })}
                disabled={!isResetMode}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || !isResetMode}>
              {isLoading ? 'Updating...' : 'Reset Password'}
            </button>
            <button type="button" className="btn btn-outline btn-full" onClick={() => updateMode('login')}>
              Back to Sign In
            </button>
          </form>
        )}

        {mode === 'verify' && (
          <form onSubmit={handleVerificationSubmit} className="flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold mb-2">Verify Email</h2>
              <p className="text-secondary text-sm">
                {isVerifyMode ? 'Confirm your email address to unlock vendor application features.' : 'This verification link is incomplete or invalid.'}
              </p>
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={isLoading || !isVerifyMode}>
              {isLoading ? 'Verifying...' : 'Verify Email'}
            </button>
            <button type="button" className="btn btn-outline btn-full" onClick={() => updateMode('login')}>
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
