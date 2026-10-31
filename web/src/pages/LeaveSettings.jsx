import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, MoonStar, RotateCcw, Save, Send, WifiOff } from 'lucide-react';
import { apiPost, apiPut } from '../api.js';
import { useActiveGuild } from '../context.js';
import { useChannels, useConfigDraft, useMeta } from '../data.js';
import { useMessagePreview, ImagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import {
  Badge,
  Button,
  Card,
  ChannelSelect,
  ColorInput,
  Field,
  Input,
  PageHeader,
  Skeleton,
  StyleGrid,
  TextArea,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const LEAVE_ELEMENTS = [
  { key: 'title', label: 'Title', description: 'Headline block' },
  { key: 'description', label: 'Description', description: 'Farewell copy' },
  { key: 'footer', label: 'Footer', description: 'Closing line' },
  { key: 'avatar', label: 'Avatar', description: 'Member thumbnail' },
  { key: 'serverIcon', label: 'Server icon', description: 'Community thumbnail' },
  { key: 'memberCount', label: 'Member count', description: 'Remaining members' },
  { key: 'stats', label: 'Growth stats', description: 'Community pulse' },
  { key: 'image', label: 'Banner', description: 'Generated image' },
  { key: 'timestamp', label: 'Timestamp', description: 'Departure time' },
];

export default function LeaveSettings() {
  const { guildId } = useParams();
  const guild = useActiveGuild();
  const toast = useToast();
  const { draft, setDraft, dirty, commit, reset, loading, error, reload } = useConfigDraft(`/guilds/${guildId}/leave`);
  const { channels, online } = useChannels(guildId);
  const { meta } = useMeta();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const preview = useMessagePreview(guildId, { config: draft, kind: 'leave', active: Boolean(draft) });

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
      const saved = await apiPut(`/guilds/${guildId}/leave`, draft);
      commit(saved);
      toast.success('Leave settings saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!draft.channelId) return toast.error('Choose a leave channel first.');
    setTesting(true);
    try {
      const result = await apiPost(`/guilds/${guildId}/test`, { kind: 'leave' });
      if (result.ok) toast.success('Leave test sent to the configured channel.');
      else toast.error(result.reason || result.skipped || 'The leave test failed.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Leave Settings" description="Loading leave configuration…" />
        <div className="editor-layout">
          <Card><Skeleton height={400} /></Card>
          <Card><Skeleton height={400} /></Card>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Leave Settings" />
        <Card>
          <p className="muted">{error?.message || 'Leave settings could not be loaded.'}</p>
          <Button variant="primary" onClick={reload}>Reload</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Departures"
        title="Leave Settings"
        description="Close the member journey with a respectful, fully configurable goodbye."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button icon={RotateCcw} onClick={reset} disabled={!dirty}>Discard</Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>
          </>
        }
      />

      {!guild?.botOnline ? (
        <div className="callout callout-warning">
          <WifiOff size={18} />
          <div>
            <strong>Leave delivery is paused while the bot is offline</strong>
            <span>Configuration saves immediately; the next leave event will use it once the gateway reconnects.</span>
          </div>
        </div>
      ) : null}

      <div className="editor-layout">
        <div className="editor-column">
          <Card
            title="Leave system"
            subtitle="Independent from the welcome configuration"
            actions={<Badge tone={draft.enabled ? 'success' : 'neutral'} dot>{draft.enabled ? 'Enabled' : 'Disabled'}</Badge>}
          >
            <Toggle
              checked={draft.enabled}
              onChange={(value) => update((next) => { next.enabled = value; })}
              label="Enable leave messages"
              description="A leave message is posted every time a member leaves."
            />
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="Leave channel" hint="The only destination for leave messages.">
                <ChannelSelect
                  channels={channels}
                  online={online}
                  value={draft.channelId}
                  onChange={(value) => update((next) => { next.channelId = value; })}
                />
              </Field>
            </div>
          </Card>

          <Card title="Visual style" subtitle="Distinct Components V2 layouts">
            <StyleGrid
              styles={meta?.styles || []}
              value={draft.style}
              onChange={(value) => update((next) => { next.style = value; })}
            />
          </Card>

          <Card title="Message" subtitle="Markdown and placeholders supported">
            <div className="form-stack">
              <Field label="Title">
                <Input value={draft.content.title} maxLength={256} onChange={(event) => update((next) => { next.content.title = event.target.value; })} />
              </Field>
              <Field label="Description">
                <TextArea rows={7} value={draft.content.description} maxLength={3500} onChange={(event) => update((next) => { next.content.description = event.target.value; })} />
              </Field>
              <div className="form-grid">
                <Field label="Footer">
                  <Input value={draft.content.footer} maxLength={1024} onChange={(event) => update((next) => { next.content.footer = event.target.value; })} />
                </Field>
                <Field label="Emoji">
                  <Input value={draft.content.emoji} maxLength={64} onChange={(event) => update((next) => { next.content.emoji = event.target.value; })} />
                </Field>
                <Field label="Accent colour">
                  <ColorInput value={draft.content.color} onChange={(value) => update((next) => { next.content.color = value; })} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Visible elements" subtitle="Toggle individual blocks">
            <div className="toggle-grid">
              {LEAVE_ELEMENTS.map((element) => (
                <div key={element.key} className="toggle-tile">
                  <div>
                    <strong>{element.label}</strong>
                    <span>{element.description}</span>
                  </div>
                  <Toggle
                    checked={Boolean(draft.content.elements[element.key])}
                    onChange={(value) => update((next) => { next.content.elements[element.key] = value; })}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Leave banner" subtitle="Generated departure artwork" actions={<MoonStar size={16} className="muted-icon" />}>
            <Toggle
              checked={draft.image.enabled}
              onChange={(value) => update((next) => { next.image.enabled = value; })}
              label="Generate a leave banner"
              description="Uses the leave image template from the image studio."
            />
          </Card>

          <div className="save-footer">
            <div>
              <strong>{dirty ? 'Unsaved leave changes' : 'Leave settings saved'}</strong>
              <span>Test sends a real message to the configured channel.</span>
            </div>
            <div className="save-footer-actions">
              <Button icon={Send} onClick={test} loading={testing} disabled={!guild?.botOnline || !draft.channelId}>
                Send test
              </Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <Card title="Leave preview" subtitle="Server-rendered Components V2 message" className="sticky-card">
            <DiscordPreview model={preview.model} loading={preview.loading} error={preview.error} />
          </Card>
          <ImagePreview
            guildId={guildId}
            config={draft}
            kind="leave"
            active={Boolean(draft.image.enabled && draft.content.elements.image)}
            label="Leave banner"
          />
        </aside>
      </div>
    </div>
  );
}
