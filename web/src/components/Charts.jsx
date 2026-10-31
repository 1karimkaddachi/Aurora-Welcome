import { useMemo } from 'react';

function buildPath(points) {
  if (!points.length) return '';
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

export function AreaChart({ data = [], series = [], height = 220, labelKey = 'day' }) {
  const width = 720;
  const padding = { top: 18, right: 16, bottom: 28, left: 34 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const { max, allPoints, labels } = useMemo(() => {
    const values = data.flatMap((row) => series.map((item) => Number(row[item.key]) || 0));
    const peak = Math.max(1, ...values);
    const roundedMax = Math.ceil(peak / 5) * 5;
    const points = series.map((item) => {
      const coords = data.map((row, index) => {
        const x = padding.left + (data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
        const y = padding.top + innerHeight - ((Number(row[item.key]) || 0) / roundedMax) * innerHeight;
        return [x, y];
      });
      return { ...item, coords, path: buildPath(coords) };
    });
    const every = Math.max(1, Math.ceil(data.length / 7));
    const tickLabels = data
      .map((row, index) => ({ ...row, index }))
      .filter((row) => row.index % every === 0 || row.index === data.length - 1)
      .map((row) => ({
        x: padding.left + (data.length <= 1 ? innerWidth / 2 : (row.index / (data.length - 1)) * innerWidth),
        label: String(row[labelKey] || '').slice(5),
      }));
    return { max: roundedMax, allPoints: points, labels: tickLabels };
  }, [data, series, innerWidth, innerHeight, labelKey]);

  if (!data.length) {
    return <div className="chart-empty">No membership data yet.</div>;
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Membership chart">
        <defs>
          {series.map((item) => (
            <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={item.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={item.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = padding.top + innerHeight - fraction * innerHeight;
          return (
            <g key={fraction}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="chart-grid" />
              <text x={padding.left - 10} y={y + 4} className="chart-axis" textAnchor="end">
                {Math.round(max * fraction)}
              </text>
            </g>
          );
        })}
        {allPoints.map((item) => (
          <path
            key={`area-${item.key}`}
            d={`${item.path} L${item.coords[item.coords.length - 1][0]},${padding.top + innerHeight} L${item.coords[0][0]},${padding.top + innerHeight} Z`}
            fill={`url(#fill-${item.key})`}
          />
        ))}
        {allPoints.map((item) => (
          <path key={`line-${item.key}`} d={item.path} fill="none" stroke={item.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {allPoints.map((item) =>
          item.coords.map(([x, y], index) => (
            <circle key={`${item.key}-${index}`} cx={x} cy={y} r="2.4" fill={item.color}>
              <title>{`${data[index][labelKey]} · ${item.label}: ${data[index][item.key]}`}</title>
            </circle>
          )),
        )}
        {labels.map((tick) => (
          <text key={`${tick.x}-${tick.label}`} x={tick.x} y={height - 8} className="chart-axis" textAnchor="middle">
            {tick.label}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        {series.map((item) => (
          <span key={item.key}>
            <i style={{ background: item.color }} /> {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values = [], color = '#6366F1', height = 44 }) {
  const width = 120;
  const max = Math.max(1, ...values);
  const path = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * width;
      const y = height - (value / max) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="sparkline" preserveAspectRatio="none">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function MiniBars({ data = [], height = 150, labelKey = 'day' }) {
  const max = Math.max(1, ...data.map((row) => Number(row.joins) || 0));
  return (
    <div className="mini-bars" style={{ height }}>
      {data.map((row) => (
        <div key={row[labelKey]} className="mini-bar" title={`${row[labelKey]}: +${row.joins} / -${row.leaves}`}>
          <span className="mini-bar-fill" style={{ height: `${Math.max(4, ((Number(row.joins) || 0) / max) * 100)}%` }} />
          <span className="mini-bar-leaves" style={{ height: `${Math.max(2, ((Number(row.leaves) || 0) / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}
