import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Gift, Link2, RefreshCw, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { apiPost, apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { formatDateTime, formatNumber, initials } from '../data.js';
import StatCard from '../components/StatCard.jsx';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  PageHeader,
  Skeleton,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const TYPE_TONE = { normal: 'success', vanity: 'info', unknown: 'warning', disabled: 'neutral' };

export default function InviteTracking() {
  const { guildId } = useParams();
  const toast = useToast();
  const invitesApi = useApi(`/guilds/${guildId}/invites`);
  const settingsApi = useApi(`/guilds/${guildId}/settings`);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const data = invitesApi.data;
  const settings = settingsApi.data;
  const leaderboard = data?.leaderboard || [];
  const recent = data?.recent || [];
  const maxJoins = Math.max(1, ...leaderboard.map((entry) => entry.joins));
  const weekJoins = data?.last7Days ?? 0;

  const updateSettings = async (patch) => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const saved = await apiPut(`/guilds/${guildId}/settings`, { ...settings, ...patch });
      settingsApi.setData(saved);
      toast.success('Invite tracking updated.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const clearHistory = async () => {
    setClearing(true);
    try {
      await apiPost(`/guilds/${guildId}/invites/clear`, {});
      toast.success('Invite history cleared.');
      setClearOpen(false);
      invitesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Growth intelligence"
        title="Invite Tracking"
        description="Know who brought each member, spot abuse patterns and celebrate your best recruiters."
        actions={
          <>
            <Button icon={RefreshCw} onClick={invitesApi.reload}>Refresh</Button>
            <Button variant="danger" icon={Trash2} onClick={() => setClearOpen(true)}>Clear history</Button>
          </>
        }
      />

      {invitesApi.loading && !data ? (
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="stat-card"><Skeleton height={70} /></div>
          ))}
        </div>
      ) : invitesApi.error ? (
        <Card><EmptyState title="Invites unavailable" description={invitesApi.error.message} action={<Button variant="primary" onClick={invitesApi.reload}>Retry</Button>} /></Card>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard icon={Link2} label="Attributed joins" value={formatNumber(data.total)} hint="All-time invite crediting" tone="amber" />
            <StatCard icon={UserPlus} label="Last 7 days" value={formatNumber(weekJoins)} hint="From the recent attribution feed" tone="cyan" />
            <StatCard
              icon={Gift}
              label="Top inviter"
              value={leaderboard[0]?.inviterName || '—'}
              hint={leaderboard[0] ? `${formatNumber(leaderboard[0].joins)} attributed joins` : 'No invites yet'}
              tone="indigo"
            />
            <StatCard
              icon={ShieldCheck}
              label="Tracking"
              value={data.tracking ? 'Active' : 'Paused'}
              hint={data.vanityTracking ? 'Vanity joins tracked' : 'Vanity tracking off'}
              tone={data.tracking ? 'emerald' : 'neutral'}
            />
          </div>

          <div className="overview-grid">
            <Card
              className="span-2"
              title="Invite leaderboard"
              subtitle="Ranked by attributed joins"
              actions={<Badge tone="warning">Possible abuse threshold · {data.abuseThreshold} / {data.abuseWindowMinutes}m</Badge>}
            >
              {leaderboard.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Inviter</th>
                        <th>Joins</th>
                        <th>Vanity</th>
                        <th>Unknown</th>
                        <th className="bar-col">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, index) => (
                        <tr key={`${entry.inviterId}-${index}`}>
                          <td><span className={`rank rank-${index + 1}`}>{index + 1}</span></td>
                          <td>
                            <div className="identity">
                              <span className="mini-avatar">{initials(entry.inviterName || entry.inviterId || 'U')}</span>
                              <div>
                                <strong>{entry.inviterName || 'Unknown'}</strong>
                                <span>{entry.inviterId ? entry.inviterId : 'No inviter resolved'}</span>
                              </div>
                            </div>
                          </td>
                          <td><strong>{formatNumber(entry.joins)}</strong></td>
                          <td>{formatNumber(entry.vanity)}</td>
                          <td>{formatNumber(entry.unknown)}</td>
                          <td className="bar-col">
                            <span className="inline-bar">
                              <i style={{ width: `${Math.round((entry.joins / maxJoins) * 100)}%` }} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Gift} title="No attributed joins yet" description="Attribution starts after the bot caches invite codes." />
              )}
            </Card>

            <Card title="Tracking controls" subtitle="Applied immediately">
              <div className="settings-list">
                <Toggle
                  checked={Boolean(settings?.inviteTracking)}
                  onChange={(value) => updateSettings({ inviteTracking: value })}
                  label="Enable invite tracking"
                  description="Diff invite use counters on every join."
                  disabled={!settings || savingSettings}
                />
                <Toggle
                  checked={Boolean(settings?.vanityTracking)}
                  onChange={(value) => updateSettings({ vanityTracking: value })}
                  label="Track vanity URL joins"
                  description="Attribute joins when no invite counter changed."
                  disabled={!settings || savingSettings}
                />
              </div>
              <div className="inline-note">
                Abuse alerts trigger after <strong>{data.abuseThreshold}</strong> joins from one inviter within{' '}
                <strong>{data.abuseWindowMinutes} minutes</strong>. Adjust this in{' '}
                <Link to={`/servers/${guildId}/advanced`}>Advanced Settings</Link>.
              </div>
            </Card>

            <Card
              className="span-2"
              title="Recent attributions"
              subtitle="The raw invite attribution feed"
              actions={<Badge tone="info">{recent.length} events</Badge>}
            >
              {recent.length ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Member</th>
                        <th>Inviter</th>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((entry) => (
                        <tr key={entry.id}>
                          <td>
                            <div className="identity">
                              <span className="mini-avatar">{initials(entry.username || entry.user_id)}</span>
                              <div>
                                <strong>{entry.username || 'Unknown'}</strong>
                                <span>{entry.user_id}</span>
                              </div>
                            </div>
                          </td>
                          <td>{entry.inviter_name || (entry.inviter_id ? entry.inviter_id : 'Unknown source')}</td>
                          <td><code className="code-pill">{entry.code}</code></td>
                          <td><Badge tone={TYPE_TONE[entry.type] || 'neutral'}>{entry.type}</Badge></td>
                          <td>{formatDateTime(entry.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Link2} title="No attribution history" description="Invite events appear as members join." />
              )}
            </Card>

            <Card title="How attribution works" subtitle="And where Discord limits it">
              <div className="callout callout-info">
                <AlertTriangle size={17} />
                <div>
                  <strong>Counter-diff attribution</strong>
                  <span>
                    Discord does not tell bots which invite was used. Aurora compares invite use counts before and
                    after a join. Simultaneous joins can make attribution ambiguous; those cases are logged.
                  </span>
                </div>
              </div>
              <ul className="plain-list">
                <li>Vanity joins are tracked when no invite counter increased.</li>
                <li>Unknown joins are still recorded so totals remain honest.</li>
                <li>Invite fetch failures are logged and never crash the join flow.</li>
              </ul>
            </Card>
          </div>
        </>
      )}

      <ConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearHistory}
        loading={clearing}
        title="Clear invite history?"
        message="All attribution records and cached invite counters for this server will be deleted. Leaderboards reset immediately."
        confirmLabel="Clear history"
      />
    </div>
  );
}
