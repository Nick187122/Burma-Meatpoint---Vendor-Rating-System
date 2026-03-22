import { Star } from 'lucide-react';

export default function StarRating({ value, size = 18, color = '#f59e0b', onChange, readonly = true }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="stars">
      {stars.map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          className={`star ${star <= value ? 'star-filled' : 'star-empty'}`}
          style={{ fontSize: size, color: star <= value ? color : undefined }}
        >
          <Star size={size} fill={star <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}
