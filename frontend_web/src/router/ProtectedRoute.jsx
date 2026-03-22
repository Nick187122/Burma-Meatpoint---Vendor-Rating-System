import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Admin isolation strictly enforced
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // If Admin tries to access consumer/vendor pages
    if (user?.role === 'Admin') return <Navigate to="/admin" replace />;
    
    // If Consumer/Vendor tries to access Admin pages
    if (allowedRoles.includes('Admin')) return <Navigate to="/" replace />;
  }

  // Approved vendor check (Only enforce if the route is strictly for Vendors)
  if (allowedRoles.length === 1 && allowedRoles[0] === 'Vendor' && !user?.is_vendor_approved) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
