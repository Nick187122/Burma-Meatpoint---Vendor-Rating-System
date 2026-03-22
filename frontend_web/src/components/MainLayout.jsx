import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { Toaster } from 'react-hot-toast';

export default function MainLayout() {
  return (
    <>
      <Navbar />
      <div className="page-wrapper">
        <Outlet />
      </div>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: { background: 'var(--bg-card)', color: '#fff', border: '1px solid var(--border)' },
          success: { iconTheme: { primary: 'var(--success)', secondary: '#fff' } }
        }} 
      />
    </>
  );
}
