import { Link } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';

export default function VendorCard({ vendor }) {
  return (
    <Link to={`/vendor/${vendor.id}`} className="vendor-card" style={{ display: 'block' }}>
      {vendor.meat_photo || vendor.profile_image ? (
        <img 
          src={vendor.meat_photo || vendor.profile_image} 
          alt={vendor.shop_name} 
          className="vendor-card-image" 
          loading="lazy" 
        />
      ) : (
        <div className="vendor-card-image-placeholder">🥩</div>
      )}
      
      <div className="vendor-card-body">
        <div className="flex-between mb-2">
          <h3 className="vendor-card-name">{vendor.shop_name}</h3>
          <div className="flex gap-2 text-orange font-bold">
            <Star size={14} fill="currentColor" />
            {Number(vendor.overall_score).toFixed(1)}
          </div>
        </div>
        
        <div className="vendor-card-location flex gap-2">
          <MapPin size={14} /> {vendor.location}
        </div>
        {vendor.distance_km != null && (
          <div className="text-xs text-muted mb-2">
            {Number(vendor.distance_km).toFixed(1)} km away
          </div>
        )}
        
        <div className="flex flex-wrap gap-2 mb-3">
          {vendor.meat_types?.split(',').map((type, i) => (
             <span key={i} className="badge badge-gray">{type.trim()}</span>
          ))}
          {vendor.price_range && (
             <span className="badge badge-green">{vendor.price_range}</span>
          )}
        </div>
        
        <div className="vendor-card-count">
          Based on {vendor.total_ratings} verified reviews
        </div>
      </div>
    </Link>
  );
}
