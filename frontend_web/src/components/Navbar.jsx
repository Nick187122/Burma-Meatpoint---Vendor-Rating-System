import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { LogOut, User, Store, Shield, Heart } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo">
          BMA<span>Point</span>
        </Link>
        
        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              {user.role === 'Consumer' && !user.is_vendor_approved && (
                <Link to="/become-vendor" className="nav-link">Become a Vendor</Link>
              )}
              {user.role === 'Consumer' && (
                <Link to="/profile" className="nav-link flex gap-1.5 items-center">
                  <Heart size={15} /> My Profile
                </Link>
              )}
              {user.role === 'Vendor' && user.is_vendor_approved && (
                <Link to="/vendor-dashboard" className="nav-link flex gap-2 items-center">
                  <Store size={16} /> Dashboard
                </Link>
              )}
              {user.role === 'Admin' && (
                <Link to="/admin" className="nav-link flex gap-2 items-center text-orange">
                  <Shield size={16} /> Admin
                </Link>
              )}
              
              <Link to={user.role === 'Consumer' ? '/profile' : '#'} className="nav-link flex gap-2 items-center">
                <User size={16} /> {user.name}
              </Link>
              
              <button onClick={logout} className="nav-link flex gap-2 items-center" style={{ color: 'var(--danger)' }}>
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <Link to="/auth" className="nav-link">Sign In</Link>
              <Link to="/auth?tab=register" className="btn btn-primary btn-sm ml-2">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
