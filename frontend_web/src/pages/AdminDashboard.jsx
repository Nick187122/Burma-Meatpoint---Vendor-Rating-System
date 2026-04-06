import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import toast from 'react-hot-toast';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Settings, Check, X, ShieldOff,
  Users, BarChart2, TrendingUp, Store
} from 'lucide-react';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('applications');

  // ─── Fetch Queries ─────────────────────────────────────────────────────────
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
      // API returns a plain array — NOT { results: [...] }
      const { data } = await client.get('/admin/flagged-reviews/');
      return Array.isArray(data) ? data : (data.results || []);
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
      return Array.isArray(data) ? data : (data.results || []);
    }
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data } = await client.get('/admin/stats/');
      return data;
    },
    enabled: activeTab === 'stats'
  });

  const { data: usersList, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data } = await client.get('/admin/users/');
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: activeTab === 'users'
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const { data } = await client.get('/admin/audit-logs/');
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: activeTab === 'audit'
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const approveApp = useMutation({
    mutationFn: (id) => client.post(`/admin/vendor-requests/${id}/approve/`),
    onSuccess: () => { toast.success('Vendor Approved!'); queryClient.invalidateQueries(['admin-apps']); }
  });

  const rejectApp = useMutation({
    mutationFn: (id) => client.post(`/admin/vendor-requests/${id}/reject/`),
    onSuccess: () => { toast.success('Vendor Rejected'); queryClient.invalidateQueries(['admin-apps']); }
  });

  const resolveFlag = useMutation({
    mutationFn: (id) => client.post(`/admin/flagged-reviews/${id}/resolve/`, { action: 'resolve' }),
    onSuccess: () => { toast.success('Review Deleted & Flag removed.'); queryClient.invalidateQueries(['admin-flagged']); }
  });

  const dismissFlag = useMutation({
    mutationFn: (id) => client.post(`/admin/flagged-reviews/${id}/resolve/`, { action: 'dismiss' }),
    onSuccess: () => { toast.success('Flag dismissed, review remains.'); queryClient.invalidateQueries(['admin-flagged']); }
  });

  const approveName = useMutation({
    mutationFn: (id) => client.post(`/admin/shop-name-requests/${id}/approve/`),
    onSuccess: () => { toast.success('Shop name updated.'); queryClient.invalidateQueries(['admin-name-requests']); }
  });

  const rejectName = useMutation({
    mutationFn: (id) => client.post(`/admin/shop-name-requests/${id}/reject/`),
    onSuccess: () => { toast.success('Shop name request rejected.'); queryClient.invalidateQueries(['admin-name-requests']); }
  });

  const suspendVendor = useMutation({
    mutationFn: ({ id, reason }) => client.post(`/admin/vendors/${id}/suspend/`, { reason }),
    onSuccess: () => { toast.success('Vendor Suspended.'); }
  });

  const unsuspendVendor = useMutation({
    mutationFn: (id) => client.post(`/admin/vendors/${id}/unsuspend/`),
    onSuccess: () => { toast.success('Vendor reinstated.'); }
  });

  const updateConfig = useMutation({
    mutationFn: (data) => client.patch('/admin/rating-config/', data),
    onSuccess: () => { toast.success('Algorithm Config Updated!'); queryClient.invalidateQueries(['admin-config']); },
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

  const pendingCount = applications?.filter(a => a.status === 'Pending').length || 0;
  const flaggedCount = flagged?.length || 0;
  const nameCount = nameRequests?.length || 0;

  const tabList = [
    { id: 'applications', label: 'Vendor Applications', badge: pendingCount, icon: <ShieldAlert size={16} /> },
    { id: 'flagged', label: 'Flagged Reviews', badge: flaggedCount, icon: <AlertTriangle size={16} /> },
    { id: 'names', label: 'Name Requests', badge: nameCount, icon: <Store size={16} /> },
    { id: 'config', label: 'Algorithm Config', badge: 0, icon: <Settings size={16} /> },
    { id: 'audit', label: 'Audit Logs', badge: 0, icon: <ShieldCheck size={16} /> },
    { id: 'stats', label: 'System Stats', badge: 0, icon: <BarChart2 size={16} /> },
    { id: 'users', label: 'All Users', badge: 0, icon: <Users size={16} /> },
  ];

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
      <div className="flex flex-wrap gap-2 mb-6">
        {tabList.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-outline'} flex items-center gap-1.5`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge > 0 && (
              <span className="ml-1 bg-white text-orange rounded-full px-2 py-0.5 text-xs font-bold">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content Panel */}
      <div className="card-glass p-6 min-h-[500px]">

        {/* ─── VENDOR APPLICATIONS ─────────────────────────────────────── */}
        {activeTab === 'applications' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2"><ShieldAlert /> Pending Applications</h2>
            {appsLoading ? <div className="text-muted spin">Loading...</div> :
              pendingCount === 0 ? (
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
                            {app.shop_name}<br />
                            <span className="text-xs text-muted">{app.meat_types}</span>
                          </td>
                          <td>{app.location}</td>
                          <td className="font-mono text-xs text-success bg-green-500/10 px-2 py-1 rounded">
                            {app.kebs_license}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button onClick={() => approveApp.mutate(app.id)} className="btn btn-success btn-sm">
                                <Check size={14} /> Approve
                              </button>
                              <button onClick={() => rejectApp.mutate(app.id)} className="btn btn-danger btn-sm">
                                <X size={14} /> Reject
                              </button>
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

        {/* ─── FLAGGED REVIEWS ─────────────────────────────────────────── */}
        {activeTab === 'flagged' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2 text-danger"><AlertTriangle /> Moderation Queue</h2>
            {flagsLoading ? <div className="text-muted spin">Loading...</div> :
              flaggedCount === 0 ? (
                <div className="text-center py-12 text-muted">No flagged reviews currently.</div>
              ) : (
                <div className="flex-col gap-4 space-y-4">
                  {flagged?.map(flag => (
                    <div key={flag.id} className="border border-danger/30 rounded-lg p-4 bg-danger/5">
                      <div className="flex-between mb-3">
                        <span className="font-bold flex items-center gap-2">
                          <AlertTriangle size={16} className="text-danger" /> Flagged Rating #{flag.rating}
                        </span>
                        <span className="text-xs text-muted">Flagged by: {flag.flagged_by}</span>
                      </div>
                      <div className="text-sm mb-2">
                        <strong className="text-orange">Reason:</strong> "{flag.reason}"
                      </div>
                      <div className="flex gap-3 pt-3 border-t border-[var(--border)]">
                        <button onClick={() => resolveFlag.mutate(flag.id)} className="btn btn-danger btn-sm">
                          Delete Review & Remove Flag
                        </button>
                        <button onClick={() => dismissFlag.mutate(flag.id)} className="btn btn-outline btn-sm">
                          Dismiss Flag (Keep Review)
                        </button>
                        <button
                          onClick={() => {
                            const vid = prompt('Enter Vendor ID to suspend:');
                            if (vid) suspendVendor.mutate({ id: vid, reason: 'Admin suspension via moderation panel.' });
                          }}
                          className="btn btn-outline btn-sm border-danger text-danger"
                        >
                          <ShieldOff size={14} /> Suspend Vendor
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ─── NAME CHANGE REQUESTS ────────────────────────────────────── */}
        {activeTab === 'names' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2"><Settings size={20} /> Shop Name Change Requests</h2>
            {nameReqsLoading ? <div className="text-muted spin">Loading...</div> :
              nameCount === 0 ? (
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
                              <button onClick={() => approveName.mutate(req.id)} className="btn btn-success btn-sm"><Check size={14} /> Approve</button>
                              <button onClick={() => rejectName.mutate(req.id)} className="btn btn-danger btn-sm"><X size={14} /> Reject</button>
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

        {/* ─── ALGORITHM CONFIG ────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="max-w-md">
            <h2 className="text-lg font-bold mb-4 flex gap-2 text-blue-400"><Settings /> Algorithm Weights</h2>
            <p className="text-sm text-secondary mb-6">
              Adjust the weight configuration for the global rating algorithm.
              The three metrics must always sum to exactly 1.0. New values apply immediately to all vendors.
            </p>
            {configLoading ? <div className="text-muted spin">Loading...</div> : (
              <form onSubmit={handleConfigSave} className="flex-col gap-5 bg-blue-500/5 p-6 rounded-lg border border-blue-500/20 space-y-4">
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
                <button type="submit" className="btn btn-primary mt-2" disabled={updateConfig.isPending}>
                  {updateConfig.isPending ? 'Saving...' : 'Save Configuration'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ─── SYSTEM STATS ────────────────────────────────────────────── */}
        {activeTab === 'audit' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2"><ShieldCheck /> Audit Logs</h2>
            {auditLoading ? <div className="text-muted spin">Loading...</div> :
              auditLogs?.length === 0 ? (
                <div className="text-center py-12 text-muted">No audit entries recorded yet.</div>
              ) : (
                <div className="space-y-4">
                  {auditLogs.map(entry => (
                    <div key={entry.id} className="card p-5 border border-[var(--border)]">
                      <div className="flex-between gap-4 mb-3">
                        <div>
                          <div className="font-bold text-orange">{entry.action}</div>
                          <div className="text-sm text-secondary">
                            {entry.admin_name || entry.admin_email} · {entry.target_type} #{entry.target_id || 'n/a'}
                          </div>
                        </div>
                        <div className="text-xs text-muted">
                          {new Date(entry.created_at).toLocaleString()}
                        </div>
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <pre className="text-xs text-secondary bg-slate-900 rounded p-3 overflow-x-auto">
                          {JSON.stringify(entry.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <h2 className="text-lg font-bold mb-6 flex gap-2 text-green-400"><TrendingUp /> Platform Analytics</h2>
            {statsLoading ? <div className="text-muted spin">Loading...</div> : (
              <div className="space-y-6">
                <div className="grid-3 gap-4">
                  {[
                    { label: 'Total Users', value: stats?.users?.total, color: 'text-blue-400', bg: 'border-blue-500/30' },
                    { label: 'Consumers', value: stats?.users?.consumers, color: 'text-purple-400', bg: 'border-purple-500/30' },
                    { label: 'Approved Vendors', value: stats?.users?.active_vendors, color: 'text-green-400', bg: 'border-green-500/30' },
                    { label: 'Suspended Vendors', value: stats?.users?.suspended_vendors, color: 'text-red-400', bg: 'border-red-500/30' },
                    { label: 'Total Ratings', value: stats?.ratings?.total, color: 'text-orange', bg: 'border-orange-500/30' },
                    { label: 'Flagged Reviews', value: stats?.ratings?.flagged, color: 'text-yellow-400', bg: 'border-yellow-500/30' },
                  ].map(item => (
                    <div key={item.label} className={`stat-card ${item.bg} p-5`}>
                      <div className="text-sm text-muted mb-1">{item.label}</div>
                      <div className={`text-3xl font-bold ${item.color}`}>{item.value ?? '—'}</div>
                    </div>
                  ))}
                </div>
                <div className="card p-5">
                  <div className="text-sm text-muted mb-1">Platform Average Score</div>
                  <div className="text-4xl font-extrabold text-orange">
                    {Number(stats?.ratings?.avg_platform_score || 0).toFixed(2)}
                    <span className="text-base text-muted ml-2"> / 5.00</span>
                  </div>
                </div>
                {stats?.top_vendor?.shop_name && (
                  <div className="card p-5 border-orange">
                    <div className="text-sm text-muted mb-1">⭐ Top Rated Vendor</div>
                    <div className="text-xl font-bold text-orange">{stats.top_vendor.shop_name}</div>
                    <div className="text-sm text-secondary">{stats.top_vendor.location} · Score: {stats.top_vendor.overall_score}</div>
                  </div>
                )}
                <div className="grid-2 gap-4">
                  <div className="card p-4">
                    <div className="text-sm text-muted mb-1">Pending Vendor Applications</div>
                    <div className="text-2xl font-bold text-yellow-400">{stats?.pending?.vendor_requests ?? 0}</div>
                  </div>
                  <div className="card p-4">
                    <div className="text-sm text-muted mb-1">Pending Name Change Requests</div>
                    <div className="text-2xl font-bold text-yellow-400">{stats?.pending?.name_change_requests ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── ALL USERS ───────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            <h2 className="text-lg font-bold mb-4 flex gap-2"><Users /> All Users</h2>
            {usersLoading ? <div className="text-muted spin">Loading...</div> :
              usersList?.length === 0 ? (
                <div className="text-center py-12 text-muted">No users found.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList?.map(u => (
                        <tr key={u.id}>
                          <td className="font-bold">{u.name}</td>
                          <td className="text-secondary text-sm">{u.email}</td>
                          <td>
                            <span className={`badge ${u.role === 'Vendor' ? 'badge-orange' : 'badge-gray'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${u.status === 'Active' ? 'badge-green' : 'badge-red'}`}>
                              {u.status}
                            </span>
                          </td>
                          <td className="text-xs text-muted">{new Date(u.date_joined).toLocaleDateString()}</td>
                          <td>
                            {u.role === 'Vendor' && u.status === 'Active' && (
                              <button
                                onClick={() => suspendVendor.mutate({ id: u.vendor_details_id ?? u.id, reason: 'Admin manual suspension.' })}
                                className="btn btn-danger btn-sm"
                              >
                                <ShieldOff size={13} /> Suspend
                              </button>
                            )}
                            {u.role === 'Vendor' && u.status === 'Suspended' && (
                              <button
                                onClick={() => unsuspendVendor.mutate(u.vendor_details_id ?? u.id)}
                                className="btn btn-success btn-sm"
                              >
                                <Check size={13} /> Reinstate
                              </button>
                            )}
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
