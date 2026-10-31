import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart3, Download, TrendingUp, UserMinus, UserPlus, Users } from 'lucide-react';
import { useApi } from '../hooks.js';
import { formatDate, formatNumber } from '../data.js';
import { AreaChart, MiniBars } from '../components/Charts.jsx';
import StatCard from '../components/StatCard.jsx';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  Skeleton,
} from '../components/ui.jsx';

function downloadCsv(data) {
  const header = 'date,joins,leaves,humans,bots,total_members';
  const rows = data.map((row) => [row.day, row.joins, row.leaves, row.humans, row.bots, row.totalMembers].join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'aurora-membership.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Statistics() {
  const { guildId } = useParams();
  const [days, setDays] = useState(30);
  const api = useApi(`/guilds/${guildId}/stats?days=${days}`);
  const data = api.data;

  if (api.loading && !data) {
    return (
      <div className="page-enter">
        <PageHeader title="Statistics" description="Loading membership analytics…" />
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="stat-card"><Skeleton height={80} /></div>
          ))}
        </div>
        <Card><Skeleton height={260} /></Card>
      </div>
    );
  }

  if (api.error || !data) {
    return (
      <div className="page-enter">
        <PageHeader title="Statistics" />
        <Card><EmptyState title="Analytics unavailable" description={api.error?.message} action={<Button variant="primary" onClick={api.reload}>Retry</Button>} /></Card>
      </div>
    );
  }

  const rangeJoins = data.daily.reduce((sum, row) => sum + row.joins, 0);
  const rangeLeaves = data.daily.reduce((sum, row) => sum + row.leaves, 0);
  const rangeHumans = data.daily.reduce((sum, row) => sum + row.humans, 0);
  const rangeBots = data.daily.reduce((sum, row) => sum + row.bots, 0);
  const net = rangeJoins - rangeLeaves;
  const maxDay = [...data.daily].sort((a, b) => b.joins - a.joins)[0];

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Analytics"
        title="Statistics"
        description="Membership growth, joins and departures, measured from real join history."
        actions={
          <>
            <Segmented
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
              options={[
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: '90', label: '90 days' },
              ]}
            />
            <Button icon={Download} onClick={() => downloadCsv(data.daily)}>Export CSV</Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard icon={Users} label="Current members" value={formatNumber(data.currentMembers)} hint={`${formatNumber(data.uniqueMembers)} tracked profiles`} tone="indigo" />
        <StatCard icon={UserPlus} label={`Joins · ${days}d`} value={`+${formatNumber(rangeJoins)}`} delta={data.growthPercent} hint="Week-over-week trend" tone="cyan" />
        <StatCard icon={UserMinus} label={`Leaves · ${days}d`} value={`-${formatNumber(rangeLeaves)}`} hint={`Net ${net >= 0 ? '+' : ''}${formatNumber(net)} members`} tone="rose" />
        <StatCard
          icon={TrendingUp}
          label="All-time joins"
          value={formatNumber(data.totalJoins)}
          hint={`${formatNumber(data.humansJoined)} humans · ${formatNumber(data.botsJoined)} bots`}
          tone="emerald"
        />
      </div>

      <div className="overview-grid">
        <Card
          className="span-2"
          title="Joins & leaves"
          subtitle={`Daily movement over the last ${days} days`}
          actions={<Badge tone="info">{formatNumber(rangeHumans)} humans · {formatNumber(rangeBots)} bots</Badge>}
        >
          <AreaChart
            data={data.daily}
            height={260}
            series={[
              { key: 'joins', label: 'Joins', color: '#22d3ee' },
              { key: 'leaves', label: 'Leaves', color: '#fb7185' },
            ]}
          />
        </Card>

        <Card title="Community pulse" subtitle="Daily join volume">
          <MiniBars data={data.daily.slice(-24)} height={160} />
          <div className="pulse-stats">
            <div>
              <span>Peak day</span>
              <strong>{maxDay ? formatNumber(maxDay.joins) : 0} joins</strong>
              <small>{maxDay ? formatDate(maxDay.day) : '—'}</small>
            </div>
            <div>
              <span>Today</span>
              <strong>+{formatNumber(data.today.joins)} / -{formatNumber(data.today.leaves)}</strong>
              <small>net {data.today.joins - data.today.leaves >= 0 ? '+' : ''}{data.today.joins - data.today.leaves}</small>
            </div>
            <div>
              <span>This week</span>
              <strong>+{formatNumber(data.week.joins)}</strong>
              <small>{formatNumber(data.week.leaves)} left</small>
            </div>
          </div>
        </Card>

        <Card
          className="span-2"
          title="Daily breakdown"
          subtitle="Latest recorded days"
          actions={<Badge tone="neutral"><BarChart3 size={12} /> {data.daily.length} days</Badge>}
        >
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Joins</th>
                  <th>Humans</th>
                  <th>Bots</th>
                  <th>Leaves</th>
                  <th>Total members</th>
                </tr>
              </thead>
              <tbody>
                {[...data.daily].reverse().slice(0, 12).map((row) => (
                  <tr key={row.day}>
                    <td>{formatDate(row.day)}</td>
                    <td><strong>+{formatNumber(row.joins)}</strong></td>
                    <td>{formatNumber(row.humans)}</td>
                    <td>{formatNumber(row.bots)}</td>
                    <td className={row.leaves ? 'text-rose' : ''}>-{formatNumber(row.leaves)}</td>
                    <td>{formatNumber(row.totalMembers)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Invite performance" subtitle="Top recruiters by attribution">
          {data.leaderboard.length ? (
            <ol className="leaderboard">
              {data.leaderboard.map((entry, index) => (
                <li key={`${entry.inviterId}-${index}`}>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <span className="leader-name">{entry.inviterName || 'Unknown'}</span>
                  <span className="leader-count">{formatNumber(entry.joins)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState title="No invite data" description="Invite attribution appears here once joins are tracked." />
          )}
          <div className="inline-note">
            {formatNumber(data.inviteTotal)} total attributed joins. Join history is the source of truth for all charts.
          </div>
        </Card>
      </div>
    </div>
  );
}
