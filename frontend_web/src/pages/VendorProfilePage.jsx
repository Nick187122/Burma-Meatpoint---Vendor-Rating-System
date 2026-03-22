import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import useAuthStore from '../store/authStore';
import StarRating from '../components/StarRating';
import ScoreBreakdown from '../components/ScoreBreakdown';
import RatingForm from '../components/RatingForm';
import { MapPin, CheckCircle, Clock, Store, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function VendorProfilePage() {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuthStore();

  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: async () => {
      const { data } = await client.get(`/vendors/${id}/`);
      return data;
    }
  });

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['ratings', id],
    queryFn: async () => {
      const { data } = await client.get(`/vendors/${id}/ratings/`);
      return data;
    }
  });

  const handleFlagReview = async (reviewId) => {
    const reason = prompt('Why are you flagging this review?');
    if (!reason) return;
    try {
      await client.post(`/vendor/ratings/${reviewId}/flag/`, { reason });
      toast.success('Review flagged for Admin moderation.');
    } catch {
      toast.error('Failed to flag review.');
    }
  };

  const handleReply = async (reviewId) => {
    const reply = prompt('Enter your reply:');
    if (!reply) return;
    try {
      await client.post(`/vendor/ratings/${reviewId}/reply/`, { reply });
      toast.success('Reply posted.');
      // Refetch would trigger here normally via QueryClient invalidate but 
      // simple page reload works for now or let React Query refetch on focus
    } catch {
      toast.error('Failed to post reply.');
    }
  };

  if (vendorLoading) return <div className="container py-12 text-center text-muted spin">Loading...</div>;
  if (!vendor) return <div className="container py-12 text-center text-danger">Vendor not found</div>;

  const isMyVendor = user?.id === vendor.user;

  return (
    <div className="container py-8">
      
      {/* Header Profile Card */}
      <div className="card-glass overflow-hidden mb-8 p-0">
        <div className="h-48 w-full bg-slate-800" style={{ 
          backgroundImage: `url(${vendor.profile_image || ''})`,
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#1a1f2e' 
        }} />
        
        <div className="p-8 pb-10">
          <div className="flex-between flex-wrap gap-4 items-end">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                {vendor.shop_name}
                {vendor.kebs_license && <CheckCircle size={20} className="text-success" />}
              </h1>
              <div className="flex gap-4 text-secondary text-sm">
                <span className="flex items-center gap-1"><MapPin size={16}/> {vendor.location}</span>
                <span className="badge badge-gray">{vendor.meat_types}</span>
                <span className="badge badge-green">{vendor.price_range}</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-xs text-muted font-bold tracking-wider mb-1 uppercase">Overall Score</div>
              <div className="text-4xl font-extrabold text-orange flex items-center gap-2">
                <StarRating value={vendor.overall_score} size={28} />
                {Number(vendor.overall_score).toFixed(1)}
              </div>
              <div className="text-sm text-secondary mt-1">Based on {vendor.total_ratings} ratings</div>
            </div>
          </div>
        </div>
      </div>

      {vendor.meat_photo && (
        <div className="card-glass mb-8 overflow-hidden p-0 border-orange">
           <div className="p-4 border-b border-[var(--border)] bg-orange-500/5">
             <h3 className="text-lg font-bold text-orange flex items-center gap-2"><ImageIcon size={18}/> Fresh Meat Showcase</h3>
           </div>
           <div className="w-full max-h-[500px] overflow-hidden flex justify-center bg-slate-900 relative">
             <img src={vendor.meat_photo} alt="Meat Showcase" className="max-w-full max-h-[500px] object-contain hover:scale-[1.02] transition-transform duration-500 cursor-pointer" />
           </div>
        </div>
      )}

      <div className="grid-3">
        {/* Left Column: Metrics & Form */}
        <div className="flex-col gap-6" style={{ gridColumn: 'span 1' }}>
          
          <div className="card">
            <h3 className="text-lg font-bold mb-4">Detailed Breakdown</h3>
            <ScoreBreakdown 
              hygiene={vendor.hygiene_score} 
              freshness={vendor.freshness_score} 
              service={vendor.service_score} 
            />
          </div>

          <div className="card">
             <h3 className="text-lg font-bold mb-2 text-success">Verification</h3>
             {vendor.kebs_license ? (
               <div className="text-sm p-3 bg-green-500/10 rounded flex items-start gap-2 border border-green-500/20 text-success">
                 <CheckCircle size={16} className="mt-1 flex-shrink-0" />
                 <div>
                   <strong className="block mb-1">KEBS Certified</strong>
                   License: {vendor.kebs_license}
                 </div>
               </div>
             ) : (
               <div className="text-sm p-3 bg-yellow-500/10 rounded text-warning">
                 Pending KEBS Verification
               </div>
             )}
          </div>

          {/* Render Rating form for consumers (not the owner, not admin unless testing) */}
          {isAuthenticated && user.role === 'Consumer' && !isMyVendor && (
             <RatingForm vendorId={id} />
          )}

        </div>

        {/* Right Column: Reviews Timeline */}
        <div style={{ gridColumn: 'span 2' }}>
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            Customer Reviews <span className="badge badge-orange">{vendor.total_ratings}</span>
          </h2>

          <div className="flex-col gap-4">
            {ratingsLoading ? (
              <div className="text-muted p-4">Loading reviews...</div>
            ) : ratingsData?.results?.length === 0 ? (
              <div className="card text-center py-12 text-muted">No reviews yet. Be the first!</div>
            ) : (
              ratingsData?.results?.map(rating => (
                <div key={rating.id} className="card p-5 relative border-active">
                  <div className="flex-between mb-3 border-b border-[var(--border)] pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex-center font-bold text-orange">
                        {rating.consumer_name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold flex items-center gap-2">
                          {rating.consumer_name}
                          {rating.anonymous_mode && <span className="badge badge-gray text-xs">Anonymous</span>}
                        </div>
                        <div className="text-xs text-muted flex items-center gap-1">
                          <Clock size={12} /> {new Date(rating.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <StarRating value={(rating.hygiene_score + rating.freshness_score + rating.service_score)/3} size={14} />
                      {isMyVendor && (
                        <button onClick={() => handleFlagReview(rating.id)} className="text-xs text-danger hover:underline mt-1 block">
                          Flag Review
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {rating.comment && (
                    <p className="text-sm text-secondary italic mb-4">"{rating.comment}"</p>
                  )}

                  {/* Rating Breakdown Badges */}
                  <div className="flex gap-2">
                     <span className="badge badge-blue">Hygiene: {rating.hygiene_score}</span>
                     <span className="badge badge-green">Freshness: {rating.freshness_score}</span>
                     <span className="badge badge-yellow">Service: {rating.service_score}</span>
                  </div>

                  {/* Vendor Reply Thread */}
                  {rating.reply ? (
                    <div className="mt-4 p-4 bg-orange-500/5 border-l-2 border-orange-500 rounded-r-md">
                      <div className="text-xs font-bold text-orange mb-1 flex items-center gap-1">
                        <Store size={12}/> Vendor Response
                      </div>
                      <p className="text-sm text-secondary">{rating.reply.reply_text}</p>
                    </div>
                  ) : isMyVendor ? (
                    <div className="mt-4">
                      <button onClick={() => handleReply(rating.id)} className="btn btn-outline btn-sm">
                        Reply to this review
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
