import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

export default function StatCard({ icon: Icon, label, value, hint, delta, tone = 'indigo', sparkline }) {
  const positive = typeof delta === 'number' && delta > 0;
  const negative = typeof delta === 'number' && delta < 0;
  const DeltaIcon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus;
  return (
    <div className={`stat-card tone-${tone}`}>
      <div className="stat-top">
        <span className="stat-icon">
          {Icon ? <Icon size={18} /> : null}
        </span>
        {typeof delta === 'number' ? (
          <span className={`stat-delta ${positive ? 'up' : negative ? 'down' : 'flat'}`}>
            <DeltaIcon size={13} />
            {Math.abs(delta)}%
          </span>
        ) : null}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
      {sparkline ? <div className="stat-spark">{sparkline}</div> : null}
    </div>
  );
}
