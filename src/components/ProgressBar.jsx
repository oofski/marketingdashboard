import { progressColor } from '../services/format.js';

export default function ProgressBar({ percent, showLabel = true, height = 8 }) {
  const pct = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className="progress-wrap">
      <div className="progress-track" style={{ height }}>
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: progressColor(pct) }}
        />
      </div>
      {showLabel && <span className="progress-label">{pct}%</span>}
    </div>
  );
}
