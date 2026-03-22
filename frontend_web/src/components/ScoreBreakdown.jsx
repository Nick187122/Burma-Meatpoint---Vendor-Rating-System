export default function ScoreBreakdown({ hygiene, freshness, service }) {
  const bars = [
    { label: 'Hygiene & Cleanliness', score: hygiene },
    { label: 'Meat Freshness', score: freshness },
    { label: 'Customer Service', score: service },
  ];

  return (
    <div className="flex-col gap-4">
      {bars.map((bar, i) => (
        <div key={i}>
          <div className="flex-between mb-1">
            <span className="text-sm font-semibold text-secondary">{bar.label}</span>
            <span className="text-sm font-bold">{Number(bar.score).toFixed(1)} <span className="text-muted">/ 5</span></span>
          </div>
          <div className="score-bar-track">
            <div 
              className="score-bar-fill" 
              style={{ width: `${(bar.score / 5) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
