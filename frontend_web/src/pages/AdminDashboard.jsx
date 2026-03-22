import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import toast from 'react-hot-toast';
import { ShieldCheck, ShieldAlert, AlertTriangle, Settings, Check, X, ShieldOff } from 'lucide-react';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('applications');

  // --- Fetch Queries ---
  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['admin-apps'],
    queryFn: async () => {
      const { data } = await client.get('/admin/vendor-requests/');
      return data;
    }
  });

  const { data: flagged, isLoading: flagsLoading } = useQuery({
    queryKey: ['admin-flagged'],
    queryFn: async () => {
      const { data } = await client.get('/admin/flagged-reviews/');
      return data.results;
    }
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['admin-config'],
    queryFn: async () => {
      const { data } = await client.get('/admin/rating-config/');
      return data;
    }
  });

  const { data: nameRequests, isLoading: nameReqsLoading } = useQuery({
    queryKey: ['admin-name-requests'],
    queryFn: async () => {
      const { data } = await client.get('/admin/shop-name-requests/');
      return data;
    }
  });

  // --- Mutations ---
  const approveApp = useMutation({
    mutationFn: (id) => client.post(`/admin/vendor-requests/${id}/approve/`),
    onSuccess: () => {
      toast.success('Vendor Approved!');
      queryClient.invalidateQueries(['admin-apps']);
    }
  });

  const rejectApp = useMutation({
    mutationFn: (id) => client.post(`/admin/vendor-requests/${id}/reject/`),
    onSuccess: () => {
      toast.success('Vendor Rejected');
      queryClient.invalidateQueries(['admin-apps']);
    }
  });

  const resolveFlag = useMutation({
    mutationFn: (id) => client.post(`/admin/flagged-reviews/${id}/resolve/`, { action: 'resolve' }),
    onSuccess: () => {
      toast.success('Review Deleted & Flag removed.');
      queryClient.invalidateQueries(['admin-flagged']);
    }
  });

  const dismissFlag = useMutation({
    mutationFn: (id) => client.post(`/admin/flagged-reviews/${id}/resolve/`, { action: 'dismiss' }),
    onSuccess: () => {
      toast.success('Flag dismissed, review remains.');
      queryClient.invalidateQueries(['admin-flagged']);
    }
  });

  const approveName = useMutation({
    mutationFn: (id) => client.post(`/admin/shop-name-requests/${id}/approve/`),
    onSuccess: () => {
      toast.success('Shop name updated.');
      queryClient.invalidateQueries(['admin-name-requests']);
    }
  });

  const rejectName = useMutation({
    mutationFn: (id) => client.post(`/admin/shop-name-requests/${id}/reject/`),
    onSuccess: () => {
      toast.success('Shop name request rejected.');
      queryClient.invalidateQueries(['admin-name-requests']);
    }
  });

  const suspendVendor = useMutation({
    mutationFn: (id) => client.post(`/admin/vendors/${id}/suspend/`),
    onSuccess: () => {
      toast.success('Vendor Suspended.');
    }
  });

  const updateConfig = useMutation({
    mutationFn: (data) => client.patch('/admin/rating-config/', data),
    onSuccess: () => {
      toast.success('Algorithm Config Updated!');
      queryClient.invalidateQueries(['admin-config']);
    },
    onError: () => toast.error('Weights must sum to 1.0')
  });

  const handleConfigSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    updateConfig.mutate({
      hygiene_weight: parseFloat(fd.get('hygiene')),
      freshness_weight: parseFloat(fd.get('freshness')),
      service_weight: parseFloat(fd.get('service'))
    });
  };

  return (
    <div className="container py-8">
      <div className="flex items-center gap-3 mb-8 pb-4 border-b border-[var(--border)]">
        <ShieldCheck size={32} className="text-orange" />
        <div>
          <h1 className="text-2xl font-bold">Admin Control Center</h1>
          <p className="text-sm text-secondary">System-wide moderation and configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button 
          onClick={() => setActiveTab('applications')} 
          className={`btn ${activeTab === 'applications' ? 'btn-primary' : 'btn-outline'}`}
        >
          Vendor Applications
          {applications?.length > 0 && <span className="ml-2 bg-white text-orange rounded-full px-2 py-0.5 text-xs font-bold">{applications.filter(a => a.status === 'Pending').length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('flagged')} 
          className={`btn ${activeTab === 'flagged' ? 'btn-primary' : 'btn-outline'}`}
        >
          Flagged Reviews
          {flagged?.length > 0 && <span className="ml-2 bg-white text-orange rounded-full px-2 py-0.5 text-xs font-bold">{flagged.length}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('config')} 
          className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-outline'}`}
        >
          Algorithm Config
        </button>
        <button 
          onClick={() => setActiveTab('names')} 
          className={`btn ${activeTab === 'names' ? 'btn-primary' : 'btn-outline'}`}
        >
          Name Requests
          {nameRequests?.length > 0 && <span className="ml-2 bg-white text-orange rounded-full px-2 py-0.5 text-xs font-bold">{nameRequests.length}</span>}
        </button>
      </div>

      {/* Content */}
      <div className="card-glass p-6 min-h-[500px]">
        {activeTab === 'applications' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2"><ShieldAlert /> Pending Applications</h2>
            {appsLoading ? <div className="text-muted spin">Loading...</div> : 
             applications?.filter(a => a.status === 'Pending').length === 0 ? (
               <div className="text-center py-12 text-muted">No pending vendor applications.</div>
             ) : (
               <div className="table-wrap">
                 <table>
                   <thead>
                     <tr>
                       <th>Applicant</th>
                       <th>Business Info</th>
                       <th>Location</th>
                       <th>KEBS License</th>
                       <th>Action</th>
                     </tr>
                   </thead>
                   <tbody>
                     {applications?.filter(a => a.status === 'Pending').map(app => (
                       <tr key={app.id}>
                         <td className="font-bold">{app.user_name || `User #${app.user}`}</td>
                         <td>
                           {app.shop_name} <br/>
                           <span className="text-xs text-muted">{app.label}</span>
                         </td>
                         <td>{app.location}</td>
                         <td className="font-mono text-xs text-success bg-green-500/10 px-2 py-1 rounded inline-block mt-2">
                           {app.kebs_license}
                         </td>
                         <td>
                           <div className="flex gap-2">
                             <button onClick={() => approveApp.mutate(app.id)} className="btn btn-success btn-sm"><Check size={14}/> Approve</button>
                             <button onClick={() => rejectApp.mutate(app.id)} className="btn btn-danger btn-sm"><X size={14}/> Reject</button>
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        )}

        {activeTab === 'flagged' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2 text-danger"><AlertTriangle /> Moderation Queue</h2>
            {flagsLoading ? <div className="text-muted spin">Loading...</div> :
             flagged?.length === 0 ? (
               <div className="text-center py-12 text-muted">No flagged reviews currently.</div>
             ) : (
               <div className="flex-col gap-4">
                 {flagged?.map(flag => (
                   <div key={flag.id} className="border border-danger/30 rounded-lg p-4 bg-danger/5">
                     <div className="flex-between mb-3">
                       <span className="font-bold flex items-center gap-2">
                         <AlertTriangle size={16} className="text-danger"/> Flagged Rating #{flag.rating}
                       </span>
                       <span className="text-xs text-muted">Admin action required</span>
                     </div>
                     <div className="text-sm mb-2"><strong className="text-orange">Vendor Argument:</strong> "{flag.reason}"</div>
                     <div className="text-sm mb-4"><strong className="text-secondary">Original Review Text:</strong> "{flag.rating_comment || '(No written comment)'}"</div>
                     
                     <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                        <button onClick={() => resolveFlag.mutate(flag.id)} className="btn btn-danger btn-sm">Delete Review & Remove Flag</button>
                        <button onClick={() => dismissFlag.mutate(flag.id)} className="btn btn-outline btn-sm">Dismiss Flag (Keep Review)</button>
                        <button onClick={() => {
                          const vid = prompt("Enter Vendor ID to suspend (this revokes vendor access):");
                          if(vid) suspendVendor.mutate(vid);
                        }} className="btn btn-outline btn-sm border-danger text-danger"><ShieldOff size={14}/> Suspend Vendor</button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="max-w-md">
            <h2 className="text-lg font-bold mb-4 flex gap-2 text-blue-400"><Settings /> Algorithm Weights</h2>
            <p className="text-sm text-secondary mb-6 line-height-1.6">
              Adjust the weight configuration for the global rating algorithm. 
              The three metrics must always sum to exactly 1.0. New values apply immediately to all vendors.
            </p>
            
            {configLoading ? <div className="text-muted spin">Loading...</div> : (
              <form onSubmit={handleConfigSave} className="flex-col gap-5 bg-blue-500/5 p-6 rounded-lg border border-blue-500/20">
                <div className="form-group mb-0">
                  <label className="form-label text-blue-400">Hygiene & Cleanliness Weight</label>
                  <input type="number" step="0.01" min="0" max="1" name="hygiene" className="form-input" defaultValue={config?.hygiene_weight} required />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-green-400">Meat Freshness Weight</label>
                  <input type="number" step="0.01" min="0" max="1" name="freshness" className="form-input" defaultValue={config?.freshness_weight} required />
                </div>
                <div className="form-group mb-0">
                  <label className="form-label text-yellow-400">Customer Service Weight</label>
                  <input type="number" step="0.01" min="0" max="1" name="service" className="form-input" defaultValue={config?.service_weight} required />
                </div>
                
                <button type="submit" className="btn btn-primary mt-2" disabled={updateConfig.isLoading}>
                   {updateConfig.isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
              </form>
             )}
           </div>
         )}
         
         {activeTab === 'names' && (
           <div>
             <h2 className="text-lg font-bold mb-4 flex gap-2"><Settings size={20}/> Shop Name Change Requests</h2>
             {nameReqsLoading ? <div className="text-muted spin">Loading...</div> : 
              nameRequests?.length === 0 ? (
                <div className="text-center py-12 text-muted">No pending name change requests.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Vendor Email</th>
                        <th>Old Name</th>
                        <th>Requested New Name</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nameRequests?.map(req => (
                        <tr key={req.id}>
                          <td className="font-bold">{req.vendor_email}</td>
                          <td className="text-muted line-through">{req.old_name}</td>
                          <td className="font-bold text-orange">{req.new_name}</td>
                          <td>
                            <div className="flex gap-2">
                              <button onClick={() => approveName.mutate(req.id)} className="btn btn-success btn-sm"><Check size={14}/> Approve</button>
                              <button onClick={() => rejectName.mutate(req.id)} className="btn btn-danger btn-sm"><X size={14}/> Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
           </div>
         )}
       </div>
    </div>
  );
}
