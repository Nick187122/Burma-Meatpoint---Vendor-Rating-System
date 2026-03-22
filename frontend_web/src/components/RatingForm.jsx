import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import toast from 'react-hot-toast';
import StarRating from './StarRating';
import { ShieldAlert } from 'lucide-react';

export default function RatingForm({ vendorId, onSuccess }) {
  const queryClient = useQueryClient();
  const [scores, setScores] = useState({ hygiene: 0, freshness: 0, service: 0 });
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  const mutation = useMutation({
    mutationFn: (data) => client.post('/ratings/', data),
    onSuccess: () => {
      toast.success('Rating submitted securely!');
      queryClient.invalidateQueries(['vendor', vendorId]);
      queryClient.invalidateQueries(['ratings', vendorId]);
      if(onSuccess) onSuccess();
      // reset form
      setScores({ hygiene: 0, freshness: 0, service: 0 });
      setComment('');
      setAnonymous(false);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to submit rating';
      toast.error(msg);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if(scores.hygiene === 0 || scores.freshness === 0 || scores.service === 0) {
      toast.error('Please assign stars for all three categories.');
      return;
    }
    mutation.mutate({
      vendor: vendorId,
      hygiene_score: scores.hygiene,
      freshness_score: scores.freshness,
      service_score: scores.service,
      comment,
      anonymous_mode: anonymous
    });
  };

  return (
    <div className="card-glass p-6">
      <h3 className="section-title text-lg mb-4">Rate this Vendor</h3>
      
      <form onSubmit={handleSubmit} className="flex-col gap-4">
        <div className="flex-between">
          <span className="text-sm font-semibold">Hygiene & Cleanliness</span>
          <StarRating 
            value={scores.hygiene} 
            onChange={(v) => setScores(p => ({...p, hygiene: v}))} 
            readonly={false} 
          />
        </div>
        
        <div className="flex-between">
          <span className="text-sm font-semibold">Meat Freshness</span>
          <StarRating 
            value={scores.freshness} 
            onChange={(v) => setScores(p => ({...p, freshness: v}))} 
            readonly={false} 
          />
        </div>
        
        <div className="flex-between">
          <span className="text-sm font-semibold">Customer Service</span>
          <StarRating 
            value={scores.service} 
            onChange={(v) => setScores(p => ({...p, service: v}))} 
            readonly={false} 
          />
        </div>

        <div className="divider" style={{ margin: '10px 0' }} />

        <div className="form-group">
          <label className="form-label">Review Comment (Optional)</label>
          <textarea 
            className="form-input form-textarea" 
            placeholder="Share details of your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
          />
        </div>

        <div className="flex-between mt-2">
          <label className="flex gap-2 text-sm text-secondary" style={{ cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={anonymous} 
              onChange={(e) => setAnonymous(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            <ShieldAlert size={16} /> Post Anonymously
          </label>
          
          <button type="submit" className="btn btn-primary" disabled={mutation.isLoading}>
            {mutation.isLoading ? 'Submitting...' : 'Submit Rating'}
          </button>
        </div>
      </form>
    </div>
  );
}
