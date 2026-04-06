import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts
import MainLayout from '../components/MainLayout';

// Pages
import HomePage from '../pages/HomePage';
import AuthPage from '../pages/AuthPage';
import VendorProfilePage from '../pages/VendorProfilePage';
import BecomeVendorPage from '../pages/BecomeVendorPage';
import VendorDashboard from '../pages/VendorDashboard';
import AdminDashboard from '../pages/AdminDashboard';
import ConsumerDashboard from '../pages/ConsumerDashboard';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/auth', element: <AuthPage /> },
      { path: '/vendor/:id', element: <VendorProfilePage /> },

      // Consumer protected routes
      {
        element: <ProtectedRoute allowedRoles={['Consumer', 'Vendor']} />,
        children: [
          { path: '/become-vendor', element: <BecomeVendorPage /> }
        ]
      },

      // Consumer profile route
      {
        element: <ProtectedRoute allowedRoles={['Consumer']} />,
        children: [
          { path: '/profile', element: <ConsumerDashboard /> }
        ]
      },

      // Vendor protected routes
      {
        element: <ProtectedRoute allowedRoles={['Vendor']} />,
        children: [
          { path: '/vendor-dashboard', element: <VendorDashboard /> }
        ]
      },

      // Admin strictly isolated routes
      {
        element: <ProtectedRoute allowedRoles={['Admin']} />,
        children: [
          { path: '/admin', element: <AdminDashboard /> }
        ]
      }
    ]
  }
]);
