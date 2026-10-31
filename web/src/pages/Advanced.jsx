import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { apiGet, apiPost, apiPut } from '../api.js';
import { useActiveGuild } from '../context.js';
import { useChannels, useConfigDraft } from '../data.js';
import {
  Badge,
  Button,
  Card,
  ChannelSelect,
  ConfirmModal,
  Field,
  Input,
  PageHeader,
  Skeleton,
  TextArea,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const DANGER_ACTIONS = {
  'reset-welcome': {
    title: 'Reset welcome configuration?',
    message: 'Message, DM copy, style and banner return to defaults. Channels, buttons and roles are kept.',
    confirmLabel: 'Reset welcome',
  },
  'reset-leave': {
    title: 'Reset leave configuration?',
    message: 'The leave message, style and banner return to defaults. The leave channel is kept.',
    confirmLabel: 'Reset leave',
  },
  'clear-logs': {
    title: 'Clear all logs?',
    message: 'Every audit entry for this community is permanently deleted.',
    confirmLabel: 'Clear logs',
  },
  'clear-invites': {
    title: 'Clear invite attribution?',
    message: 'Leaderboard history and cached invite counters are deleted.',
    confirmLabel: 'Clear invites',
  },
};

export default function Advanced() {
  const { guildId } = useParams();
  const guild = useActiveGuild();
  const toast = useToast();
  const { draft, setDraft, dirty, commit, reset, loading, error, reload } = useConfigDraft(`/guilds/${guildId}/settings`);
  const { channels, online } = useChannels(guildId);
  const [saving, setSaving] = useState(false);
  const [danger, setDanger] = useState(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const update = (mutator) => {
    setDraft((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutator(next);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await apiPut(`/guilds/${guildId}/settings`, draft);
      commit(saved);
      toast.success('Advanced settings saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runDanger = async () => {
    if (!danger) return;
    setRunning(true);
    try {
      await apiPost(`/guilds/${guildId}/actions`, { action: danger, confirm: true });
      toast.success('Action completed.');
      setDanger(null);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  const exportConfig = async () => {
    setExporting(true);
    try {
      const [welcome, leave] = await Promise.all([
        apiGet(`/guilds/${guildId}/welcome`),
        apiGet(`/guilds/${guildId}/leave`),
      ]);
      const payload = { exportedAt: new Date().toISOString(), guildId, settings: draft, welcome, leave };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `aurora-${guildId}-configuration.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Configuration exported.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Advanced Settings" description="Loading advanced configuration…" />
        <Card><Skeleton height={420} /></Card>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Advanced Settings" />
        <Card>
          <p className="muted">{error?.message || 'Settings could not be loaded.'}</p>
          <Button variant="primary" onClick={reload}>Reload</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="System"
        title="Advanced Settings"
        description="Logging, invite intelligence, delivery timing and guarded maintenance actions."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button icon={Download} onClick={exportConfig} loading={exporting}>Export</Button>
            <Button icon={RotateCcw} onClick={reset} disabled={!dirty}>Discard</Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save settings</Button>
          </>
        }
      />

      <div className="settings-layout">
        <div className="settings-column">
          <Card title="Channels" subtitle="Operational destinations used by logs and member actions">
            <div className="form-grid">
              <Field label="Audit log channel" hint="Receives Components V2 audit cards for every important event.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.logChannelId}
                  onChange={(value) => update((next) => { next.logChannelId = value; })}
                />
              </Field>
              <Field label="Ticket channel" hint="The Open Ticket button creates a private thread here.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.ticketChannelId}
                  onChange={(value) => update((next) => { next.ticketChannelId = value; })}
                />
              </Field>
              <Field label="Roles channel" hint="Linked from the self-role experience when no roles are configured.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.rolesChannelId}
                  onChange={(value) => update((next) => { next.rolesChannelId = value; })}
                />
              </Field>
            </div>
            {!online ? (
              <div className="inline-note">The bot is offline, so channel names are unavailable. IDs are still stored.</div>
            ) : null}
            <Field label="Rules text" hint="Shown in the ephemeral Read Rules panel. Markdown supported.">
              <TextArea
                rows={5}
                maxLength={2000}
                value={draft.rulesText}
                onChange={(event) => update((next) => { next.rulesText = event.target.value; })}
                placeholder="**Be kind.** Treat every member with respect.…"
              />
            </Field>
          </Card>

          <Card title="Invite intelligence" subtitle="Tracking, vanity attribution and abuse thresholds">
            <div className="settings-list">
              <Toggle
                checked={draft.inviteTracking}
                onChange={(value) => update((next) => { next.inviteTracking = value; })}
                label="Invite tracking"
                description="Diff invite counters on every join and store attribution history."
              />
              <Toggle
                checked={draft.vanityTracking}
                onChange={(value) => update((next) => { next.vanityTracking = value; })}
                label="Vanity URL tracking"
                description="Attribute joins to the vanity URL when no invite counter changed."
              />
            </div>
            <div className="form-grid">
              <Field label="Abuse threshold" hint="Joins from one inviter inside the window before an alert is logged.">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.abuseThreshold}
                  onChange={(event) => update((next) => { next.abuseThreshold = Number(event.target.value); })}
                />
              </Field>
              <Field label="Abuse window" hint="Minutes to look back.">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={draft.abuseWindowMinutes}
                  onChange={(event) => update((next) => { next.abuseWindowMinutes = Number(event.target.value); })}
                />
              </Field>
            </div>
          </Card>

          <Card title="Delivery" subtitle="Timing, cleanup and safety switches">
            <div className="form-grid">
              <Field label="Join delay" hint="Seconds to wait before the welcome is delivered (0–600).">
                <Input
                  type="number"
                  min={0}
                  max={600}
                  value={Math.round((draft.welcomeDelayMs || 0) / 1000)}
                  onChange={(event) => update((next) => { next.welcomeDelayMs = Math.max(0, Number(event.target.value) || 0) * 1000; })}
                />
              </Field>
              <Field label="Delete welcome after" hint="Seconds before the message is removed. 0 keeps it.">
                <Input
                  type="number"
                  min={0}
                  max={604800}
                  value={draft.deleteWelcomeAfter}
                  onChange={(event) => update((next) => { next.deleteWelcomeAfter = Number(event.target.value); })}
                />
              </Field>
            </div>
            <div className="settings-list">
              <Toggle
                checked={draft.dmFailureNotice}
                onChange={(value) => update((next) => { next.dmFailureNotice = value; })}
                label="Post DM failures to the log channel"
                description="Closed DMs are always stored in the database; this mirrors them to the audit channel."
              />
              <Toggle
                checked={draft.dryRun}
                onChange={(value) => update((next) => { next.dryRun = value; })}
                label="Dry run mode"
                description="Evaluate joins and log intended actions without sending messages or assigning roles."
              />
            </div>
            {draft.dryRun ? (
              <div className="callout callout-warning">
                <AlertTriangle size={17} />
                <div>
                  <strong>Dry run is active</strong>
                  <span>No welcome, DM, leave message or role assignment will be performed until this is disabled.</span>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Maintenance" subtitle="Guarded actions that cannot be undone">
            <div className="danger-grid">
              {Object.entries(DANGER_ACTIONS).map(([action, meta]) => (
                <div key={action} className="danger-card">
                  <span className="danger-icon"><ShieldAlert size={17} /></span>
                  <div>
                    <strong>{meta.title.replace(/\?$/, '')}</strong>
                    <span>{meta.message}</span>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => setDanger(action)}>Run</Button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <aside className="settings-side">
          <Card title="System status" subtitle="Runtime and connection health" className="sticky-card">
            <div className="summary-list">
              <div className="summary-row">
                <span>Bot</span>
                <Badge tone={guild?.botOnline ? 'success' : 'danger'} dot>
                  {guild?.botOnline ? 'Connected' : 'Offline'}
                </Badge>
              </div>
              <div className="summary-row">
                <span>Database</span>
                <strong>SQLite (WAL)</strong>
              </div>
              <div className="summary-row">
                <span>Images</span>
                <strong>Worker pool</strong>
              </div>
              <div className="summary-row">
                <span>Messages</span>
                <strong>Components V2</strong>
              </div>
            </div>
            <div className="inline-note">
              Environment variables and the Discord Developer Portal setup are documented in the README.
            </div>
          </Card>

          <Card title="Required bot permissions" subtitle="Grant these in Server Settings → Roles" className="sticky-card">
            <ul className="permission-list">
              <li>View Channels</li>
              <li>Send Messages</li>
              <li>Attach Files</li>
              <li>Manage Roles</li>
              <li>Manage Server (invites &amp; threads)</li>
              <li>Create Private Threads</li>
              <li>Send Messages in Threads</li>
              <li>Read Message History</li>
            </ul>
            <div className="inline-note">
              Components V2 messages do not use embeds. Any embed-based integrations are intentionally unsupported.
            </div>
          </Card>
        </aside>
      </div>

      <ConfirmModal
        open={Boolean(danger)}
        onClose={() => setDanger(null)}
        onConfirm={runDanger}
        loading={running}
        title={danger ? DANGER_ACTIONS[danger].title : ''}
        message={danger ? DANGER_ACTIONS[danger].message : ''}
        confirmLabel={danger ? DANGER_ACTIONS[danger].confirmLabel : 'Confirm'}
      />
    </div>
  );
}
