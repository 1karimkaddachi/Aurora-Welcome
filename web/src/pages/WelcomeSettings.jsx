import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, RotateCcw, Save, Sparkles, Wand2 } from 'lucide-react';
import { apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { useChannels, useConfigDraft, useMeta } from '../data.js';
import { useMessagePreview, ImagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import {
  Badge,
  Button,
  Card,
  ChannelSelect,
  Field,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  StyleGrid,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function WelcomeSettings() {
  const { guildId } = useParams();
  const toast = useToast();
  const { draft, setDraft, dirty, commit, reset, loading, error, reload } = useConfigDraft(`/guilds/${guildId}/welcome`);
  const { channels, online } = useChannels(guildId);
  const { meta } = useMeta();
  const [saving, setSaving] = useState(false);
  const preview = useMessagePreview(guildId, { config: draft, kind: 'welcome', active: Boolean(draft) });

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
      const saved = await apiPut(`/guilds/${guildId}/welcome`, draft);
      commit(saved);
      toast.success('Welcome settings saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Welcome Settings" description="Loading configuration…" />
        <div className="editor-layout">
          <Card><Skeleton height={340} /></Card>
          <Card><Skeleton height={340} /></Card>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Welcome Settings" />
        <Card>
          <p className="muted">{error?.message || 'Configuration could not be loaded.'}</p>
          <Button variant="primary" onClick={reload}>Reload</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Onboarding"
        title="Welcome Settings"
        description="Channels, delivery and the visual style of your community’s first impression."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved changes</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button icon={RotateCcw} onClick={reset} disabled={!dirty}>Discard</Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="editor-layout">
        <div className="editor-column">
          <Card
            title="System status"
            subtitle="Pause delivery without losing your configuration"
            actions={<Badge tone={draft.enabled ? 'success' : 'danger'} dot>{draft.enabled ? 'Live' : 'Paused'}</Badge>}
          >
            <Toggle
              checked={draft.enabled}
              onChange={(value) => update((next) => { next.enabled = value; })}
              label="Enable welcome messages"
              description="When paused, joins are still tracked and logged, but no welcome message is delivered."
            />
          </Card>

          <Card title="Destinations" subtitle="Where members are welcomed and which channels placeholders reference">
            <div className="form-grid">
              <Field label="Main welcome channel" hint="Primary public destination.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channels.main}
                  onChange={(value) => update((next) => { next.channels.main = value; })}
                />
              </Field>
              <Field label="Secondary welcome channel" hint="Optional second destination. Both receive the message.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channels.secondary}
                  onChange={(value) => update((next) => { next.channels.secondary = value; })}
                />
              </Field>
              <Field label="Rules channel" hint="Used by {rules_channel} and the Read Rules button.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channels.rules}
                  onChange={(value) => update((next) => { next.channels.rules = value; })}
                />
              </Field>
              <Field label="Introductions channel" hint="Used by {intros_channel} and the Introduce button.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channels.introductions}
                  onChange={(value) => update((next) => { next.channels.introductions = value; })}
                />
              </Field>
              <Field label="Announcements channel" hint="Referenced by {announcements_channel}.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channels.announcements}
                  onChange={(value) => update((next) => { next.channels.announcements = value; })}
                />
              </Field>
            </div>
            {!online ? (
              <div className="inline-note">
                The bot is offline, so channels cannot be listed. Channel IDs are stored as snowflakes and validate on delivery.
              </div>
            ) : null}
          </Card>

          <Card title="Visual style" subtitle="Each style uses a distinct Components V2 layout" actions={<Wand2 size={16} className="muted-icon" />}>
            <StyleGrid
              styles={meta?.styles || []}
              value={draft.style}
              onChange={(value) => update((next) => { next.style = value; })}
            />
          </Card>

          <Card title="Delivery behaviour" subtitle="Choose who receives what, and how">
            <div className="form-grid">
              <Field label="Send mode" hint="Public, direct message, or both.">
                <Segmented
                  value={draft.sendMode}
                  onChange={(value) => update((next) => { next.sendMode = value; })}
                  options={[
                    { value: 'public', label: 'Public' },
                    { value: 'dm', label: 'DM only' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              </Field>
              <Field label="Bots" hint="Bot accounts can be welcomed, skipped, or handled with the bot variant.">
                <Select value={draft.botMode} onChange={(event) => update((next) => { next.botMode = event.target.value; })}>
                  <option value="enabled">Welcome bots (bot variant)</option>
                  <option value="skip">Ignore bot joins</option>
                </Select>
              </Field>
              <Field label="Returning members" hint="Detected from membership history.">
                <Select
                  value={draft.returningMode}
                  onChange={(event) => update((next) => { next.returningMode = event.target.value; })}
                >
                  <option value="returning">Use returning variant</option>
                  <option value="normal">Use normal welcome</option>
                  <option value="skip">Do not welcome returning members</option>
                </Select>
              </Field>
            </div>
            <Toggle
              checked={draft.content.mention}
              onChange={(value) => update((next) => { next.content.mention = value; })}
              label="Mention the member"
              description="Adds a real mention block and allows a ping. All other mentions are suppressed."
            />
          </Card>

          <div className="save-footer">
            <div>
              <strong>{dirty ? 'You have unsaved changes' : 'Everything is saved'}</strong>
              <span>Settings write to SQLite and apply without a bot restart.</span>
            </div>
            <div className="save-footer-actions">
              <Button onClick={reset} disabled={!dirty}>Discard</Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>
                Save
              </Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <Card title="Message preview" subtitle="Rendered by the same server model used for delivery" className="sticky-card">
            <DiscordPreview model={preview.model} loading={preview.loading} error={preview.error} />
            <div className="preview-meta">
              <Sparkles size={14} />
              Placeholders are resolved with a sample member and this server’s live statistics.
            </div>
          </Card>
          <ImagePreview
            guildId={guildId}
            config={draft}
            kind="welcome"
            active={Boolean(draft.image.enabled && draft.content.elements.image)}
            label="Generated banner"
          />
        </aside>
      </div>
    </div>
  );
}
