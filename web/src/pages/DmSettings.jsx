import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Mail, Send, Sparkles, WifiOff } from 'lucide-react';
import { apiPost, apiPut } from '../api.js';
import { useActiveGuild } from '../context.js';
import { useConfigDraft } from '../data.js';
import { useMessagePreview, ImagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import {
  Badge,
  Button,
  Card,
  ColorInput,
  Field,
  Input,
  PageHeader,
  Segmented,
  Skeleton,
  TextArea,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const DM_ELEMENTS = [
  { key: 'title', label: 'Title', description: 'Headline block' },
  { key: 'description', label: 'Description', description: 'Main copy' },
  { key: 'footer', label: 'Footer', description: 'Closing note' },
  { key: 'avatar', label: 'Avatar', description: 'Member thumbnail' },
  { key: 'serverIcon', label: 'Server icon', description: 'Community thumbnail' },
  { key: 'memberCount', label: 'Member count', description: 'Detail line' },
  { key: 'inviter', label: 'Inviter', description: 'Attribution line' },
  { key: 'stats', label: 'Growth stats', description: 'Community pulse' },
  { key: 'image', label: 'Banner', description: 'Generated image' },
  { key: 'timestamp', label: 'Timestamp', description: 'Delivery time' },
];

export default function DmSettings() {
  const { guildId } = useParams();
  const guild = useActiveGuild();
  const toast = useToast();
  const { draft, setDraft, dirty, commit, reset, loading, error, reload } = useConfigDraft(`/guilds/${guildId}/welcome`);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const preview = useMessagePreview(guildId, { config: draft, kind: 'dm', active: Boolean(draft) });

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
      toast.success('DM settings saved.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const testDm = async () => {
    setTesting(true);
    try {
      const result = await apiPost(`/guilds/${guildId}/test`, { kind: 'dm' });
      if (result.ok) toast.success('Test DM sent. Check your Discord inbox.');
      else toast.error(result.reason || 'The DM test failed.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="DM Settings" description="Loading DM configuration…" />
        <div className="editor-layout">
          <Card><Skeleton height={380} /></Card>
          <Card><Skeleton height={380} /></Card>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="DM Settings" />
        <Card>
          <p className="muted">{error?.message || 'DM settings could not be loaded.'}</p>
          <Button variant="primary" onClick={reload}>Reload</Button>
        </Card>
      </div>
    );
  }

  const dm = draft.dmContent;

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Private onboarding"
        title="DM Settings"
        description="Deliver a private welcome that new members can keep, complete with buttons and a generated banner."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button onClick={reset} disabled={!dirty}>Discard</Button>
            <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>Save DM</Button>
          </>
        }
      />

      {!guild?.botOnline ? (
        <div className="callout callout-warning">
          <WifiOff size={18} />
          <div>
            <strong>DM test unavailable while the bot is offline</strong>
            <span>Configuration still saves. Once connected, use “Send test DM” to verify delivery.</span>
          </div>
        </div>
      ) : null}

      <div className="editor-layout">
        <div className="editor-column">
          <Card title="Delivery" subtitle="Choose how the private welcome is combined with the public message" actions={<Mail size={16} className="muted-icon" />}>
            <Segmented
              value={draft.sendMode}
              onChange={(value) => update((next) => { next.sendMode = value; })}
              options={[
                { value: 'public', label: 'Public only' },
                { value: 'dm', label: 'DM only' },
                { value: 'both', label: 'Public + DM' },
              ]}
            />
            <div className="inline-note">
              DM failures (closed DMs) are detected and logged. {draft.sendMode === 'public' ? 'Direct messages are currently disabled.' : 'Direct messages are enabled.'}
            </div>
          </Card>

          <Card title="DM content" subtitle="Sent as a Components V2 message in the member’s inbox">
            <div className="form-stack">
              <Field label="Title">
                <Input value={dm.title} maxLength={256} onChange={(event) => update((next) => { next.dmContent.title = event.target.value; })} />
              </Field>
              <Field label="Description" hint="Placeholders resolve for the joining member.">
                <TextArea rows={8} value={dm.description} maxLength={3500} onChange={(event) => update((next) => { next.dmContent.description = event.target.value; })} />
              </Field>
              <div className="form-grid">
                <Field label="Footer">
                  <Input value={dm.footer} maxLength={1024} onChange={(event) => update((next) => { next.dmContent.footer = event.target.value; })} />
                </Field>
                <Field label="Emoji">
                  <Input value={dm.emoji} maxLength={64} onChange={(event) => update((next) => { next.dmContent.emoji = event.target.value; })} />
                </Field>
                <Field label="Accent colour">
                  <ColorInput value={dm.color} onChange={(value) => update((next) => { next.dmContent.color = value; })} />
                </Field>
              </div>
            </div>
          </Card>

          <Card title="Visible elements" subtitle="Components V2 blocks inside the DM">
            <div className="toggle-grid">
              {DM_ELEMENTS.map((element) => (
                <div key={element.key} className="toggle-tile">
                  <div>
                    <strong>{element.label}</strong>
                    <span>{element.description}</span>
                  </div>
                  <Toggle
                    checked={Boolean(dm.elements[element.key])}
                    onChange={(value) => update((next) => { next.dmContent.elements[element.key] = value; })}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Actions" subtitle="Verify the real delivery path">
            <div className="button-row-actions">
              <Button variant="primary" icon={Send} onClick={testDm} loading={testing} disabled={!guild?.botOnline}>
                Send test DM to me
              </Button>
              <Link className="btn btn-secondary" to={`/servers/${guildId}/buttons`}>
                Manage DM buttons
              </Link>
              <Link className="btn btn-ghost" to={`/servers/${guildId}/editor`}>
                <Sparkles size={15} /> Style is shared with the editor
              </Link>
            </div>
          </Card>

          <div className="save-footer">
            <div>
              <strong>{dirty ? 'Unsaved DM changes' : 'DM settings saved'}</strong>
              <span>Delivery mode applies instantly for future joins.</span>
            </div>
            <div className="save-footer-actions">
              <Button onClick={reset} disabled={!dirty}>Discard</Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <Card title="DM preview" subtitle="Components V2 direct message" className="sticky-card">
            <DiscordPreview model={preview.model} loading={preview.loading} error={preview.error} />
            <div className="preview-meta">
              <Mail size={14} /> Inbox preview uses your saved DM buttons and the shared banner.
            </div>
          </Card>
          <ImagePreview
            guildId={guildId}
            config={draft}
            kind="dm"
            active={Boolean(draft.image.enabled && dm.elements.image)}
            label="DM banner"
          />
        </aside>
      </div>
    </div>
  );
}
