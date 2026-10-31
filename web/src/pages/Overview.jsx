import { Link, useParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  Image as ImageIcon,
  Link2,
  MousePointerClick,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import { apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { formatNumber, formatDate, initials, timeAgo } from '../data.js';
import { ImagePreview, useMessagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import { AreaChart } from '../components/Charts.jsx';
import StatCard from '../components/StatCard.jsx';
import { LogItem } from '../components/Activity.jsx';
import { Badge, Button, Card, EmptyState, Skeleton, Toggle } from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Overview() {
  const { guildId } = useParams();
  const toast = useToast();
  const overview = useApi(`/guilds/${guildId}/overview`);
  const welcomeApi = useApi(`/guilds/${guildId}/welcome`);
  const preview = useMessagePreview(guildId, {
    config: welcomeApi.data,
    kind: 'welcome',
    active: Boolean(welcomeApi.data),
  });
  const data = overview.data;

  const toggleWelcome = async (enabled) => {
    if (!welcomeApi.data) return;
    try {
      const next = { ...structuredClone(welcomeApi.data), enabled };
      const saved = await apiPut(`/guilds/${guildId}/welcome`, next);
      welcomeApi.setData(saved);
      overview.reload();
      toast.success(`Welcome ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (overview.loading && !data) {
    return (
      <div className="page-enter">
        <div className="skeleton-title">
          <Skeleton width="240px" height={28} />
          <Skeleton width="420px" height={14} />
        </div>
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="stat-card">
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={30} />
            </div>
          ))}
        </div>
        <div className="overview-grid">
          <Card><Skeleton height={220} /></Card>
          <Card><Skeleton height={220} /></Card>
        </div>
      </div>
    );
  }

  if (overview.error) {
    return (
      <Card>
        <EmptyState
          title="Could not load this community"
          description={overview.error.message}
          action={<Button variant="primary" onClick={overview.reload}>Try again</Button>}
        />
      </Card>
    );
  }

  const { guild, stats, invites, welcome, leave } = data;
  const chartData = stats.daily.slice(-14);

  return (
    <div className="page-enter">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Command center</span>
          <h1>Good to see you.</h1>
          <p>Here is how {guild.name} is welcoming its newest members.</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-secondary" to={`/servers/${guildId}/statistics`}>
            <TrendingUp size={16} /> Statistics
          </Link>
          <Link className="btn btn-primary" to={`/servers/${guildId}/editor`}>
            <Sparkles size={16} /> Open live editor
          </Link>
        </div>
      </div>

      { !guild.botOnline ? (
        <div className="callout callout-warning">
          <WifiOff size={18} />
          <div>
            <strong>The bot is not connected right now</strong>
            <span>
              Dashboard changes are saved to the database immediately, but delivery resumes only when the bot connects.
              Set <code>DISCORD_TOKEN</code> and restart Aurora.
            </span>
          </div>
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard
          icon={Users}
          label="Total members"
          value={formatNumber(guild.memberCount)}
          hint={`${formatNumber(stats.uniqueMembers)} tracked profiles`}
          tone="indigo"
        />
        <StatCard
          icon={UserPlus}
          label="Joins today"
          value={`+${formatNumber(stats.today.joins)}`}
          hint={`${formatNumber(stats.today.leaves)} leaves today`}
          tone="cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="Last 30 days"
          value={formatNumber(stats.month.joins)}
          delta={stats.growthPercent}
          hint="Week-over-week growth"
          tone="emerald"
        />
        <StatCard
          icon={Link2}
          label="Attributed invites"
          value={formatNumber(invites.total)}
          hint={`${invites.leaderboard.length} active inviters`}
          tone="amber"
        />
      </div>

      <div className="overview-grid">
        <Card
          className="span-2"
          title="Membership pulse"
          subtitle="Joins and leaves over the last 14 days"
          actions={<Badge tone="info">Live data</Badge>}
        >
          <AreaChart
            data={chartData}
            series={[
              { key: 'joins', label: 'Joins', color: '#22d3ee' },
              { key: 'leaves', label: 'Leaves', color: '#fb7185' },
            ]}
          />
        </Card>

        <Card
          title="Welcome system"
          subtitle="Your current onboarding configuration"
          actions={
            <Toggle
              checked={Boolean(welcome.enabled)}
              onChange={toggleWelcome}
              disabled={!welcomeApi.data}
            />
          }
        >
          <div className="summary-list">
            <div className="summary-row">
              <span>Status</span>
              <Badge tone={welcome.enabled ? 'success' : 'danger'} dot>
                {welcome.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="summary-row">
              <span>Style</span>
              <strong>{welcome.style}</strong>
            </div>
            <div className="summary-row">
              <span>Delivery</span>
              <strong>{welcome.sendMode}</strong>
            </div>
            <div className="summary-row">
              <span>Main channel</span>
              <strong>{welcome.channelId ? `#${welcome.channelId}` : 'Not configured'}</strong>
            </div>
            <div className="summary-row">
              <span>Components</span>
              <strong>
                {welcome.buttons} buttons · {welcome.imageEnabled ? 'banner on' : 'banner off'}
              </strong>
            </div>
          </div>
          <div className="summary-actions">
            <Link className="btn btn-secondary btn-sm" to={`/servers/${guildId}/welcome`}>
              Settings <ArrowRight size={14} />
            </Link>
            <Link className="btn btn-ghost btn-sm" to={`/servers/${guildId}/buttons`}>
              <MousePointerClick size={14} /> Buttons
            </Link>
          </div>
        </Card>

        <Card
          title="Live welcome preview"
          subtitle="The exact Components V2 message sent to new members"
          className="span-2 preview-card"
          actions={
            <Link className="btn btn-ghost btn-sm" to={`/servers/${guildId}/editor`}>
              Edit <ArrowUpRight size={14} />
            </Link>
          }
        >
          <DiscordPreview model={preview.model} loading={preview.loading} error={preview.error} />
          {welcomeApi.data ? (
            <div className="overview-banner">
              <ImagePreview
                guildId={guildId}
                config={welcomeApi.data}
                kind="welcome"
                active={Boolean(welcomeApi.data.image.enabled && welcomeApi.data.content.elements.image)}
                label="Welcome banner"
              />
            </div>
          ) : null}
        </Card>

        <Card title="Leave system" subtitle="Departure handling">
          <div className="summary-list">
            <div className="summary-row">
              <span>Status</span>
              <Badge tone={leave.enabled ? 'success' : 'neutral'} dot>
                {leave.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            <div className="summary-row">
              <span>Channel</span>
              <strong>{leave.channelId ? `#${leave.channelId}` : 'Not configured'}</strong>
            </div>
            <div className="summary-row">
              <span>Banner</span>
              <strong>{leave.imageEnabled ? 'Enabled' : 'Disabled'}</strong>
            </div>
          </div>
          <div className="summary-actions">
            <Link className="btn btn-ghost btn-sm" to={`/servers/${guildId}/leave`}>
              Configure leave <ArrowRight size={14} />
            </Link>
          </div>
        </Card>

        <Card title="Newest members" subtitle="Latest arrivals and their invite source" actions={<Clock3 size={15} className="muted-icon" />}>
          {data.recentMembers.length ? (
            <div className="member-list">
              {data.recentMembers.map((member) => (
                <div key={member.id} className="member-row">
                  <span className="member-avatar">
                    {member.avatar ? <img src={member.avatar} alt="" /> : initials(member.username)}
                  </span>
                  <div className="member-main">
                    <strong>{member.username}</strong>
                    <span>
                      #{formatNumber(member.memberNumber)} · {member.inviterName ? `invited by ${member.inviterName}` : 'source unknown'}
                    </span>
                  </div>
                  <span className="member-time">{timeAgo(member.joinedAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={UserPlus} title="No members tracked yet" description="Join records appear here after the bot observes a member join." />
          )}
        </Card>

        <Card title="Recent activity" subtitle="Audit stream across onboarding" actions={<Link className="btn btn-ghost btn-sm" to={`/servers/${guildId}/logs`}>All logs</Link>}>
          {data.recentLogs.length ? (
            <div className="log-list">
              {data.recentLogs.map((log) => (
                <LogItem key={log.id} log={log} />
              ))}
            </div>
          ) : (
            <EmptyState title="No activity yet" description="Welcome sends, auto roles and invite attributions will appear here." />
          )}
        </Card>

        <Card title="Invite leaders" subtitle="Attributed joins this server" actions={<Link className="btn btn-ghost btn-sm" to={`/servers/${guildId}/invites`}>Details</Link>}>
          {invites.leaderboard.length ? (
            <ol className="leaderboard">
              {invites.leaderboard.map((entry, index) => (
                <li key={`${entry.inviterId}-${index}`}>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  <span className="leader-name">{entry.inviterName || 'Unknown'}</span>
                  <span className="leader-count">{formatNumber(entry.joins)} joins</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={Link2} title="No attributed joins" description="Invite attribution begins after the bot caches invites." />
          )}
        </Card>

        <Card title="Quick actions" subtitle="Jump into the most-used tools">
          <div className="quick-grid">
            <Link to={`/servers/${guildId}/editor`} className="quick-action">
              <Sparkles size={17} />
              <span>Message editor</span>
              <small>Text, placeholders and style</small>
            </Link>
            <Link to={`/servers/${guildId}/images`} className="quick-action">
              <ImageIcon size={17} />
              <span>Image studio</span>
              <small>Banners and templates</small>
            </Link>
            <Link to={`/servers/${guildId}/templates`} className="quick-action">
              <MousePointerClick size={17} />
              <span>Templates</span>
              <small>Apply a proven layout</small>
            </Link>
            <Link to={`/servers/${guildId}/invites`} className="quick-action">
              <Link2 size={17} />
              <span>Invite insights</span>
              <small>Leaderboard and history</small>
            </Link>
          </div>
          <div className="small-note">
            Last welcome update {formatDate(welcome.updatedAt)} · {formatNumber(stats.week.joins)} joins in the last 7 days
          </div>
        </Card>
      </div>
    </div>
  );
}
