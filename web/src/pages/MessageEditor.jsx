import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Eraser, Image as ImageIcon, MousePointerClick, RotateCcw, Save, Sparkles } from 'lucide-react';
import { apiPost, apiPut } from '../api.js';
import { useConfigDraft, useMeta } from '../data.js';
import { useMessagePreview, ImagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import {
  Badge,
  Button,
  Card,
  ColorInput,
  ConfirmModal,
  Field,
  Input,
  PageHeader,
  PlaceholderChips,
  Select,
  Skeleton,
  Tabs,
  TextArea,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const ELEMENTS = [
  { key: 'title', label: 'Title', description: 'Headline block' },
  { key: 'description', label: 'Description', description: 'Main message body' },
  { key: 'footer', label: 'Footer', description: 'Small closing line' },
  { key: 'avatar', label: 'Avatar', description: 'Member thumbnail' },
  { key: 'serverIcon', label: 'Server icon', description: 'Community thumbnail' },
  { key: 'memberCount', label: 'Member count', description: 'Detail line' },
  { key: 'inviter', label: 'Inviter', description: 'Invite attribution' },
  { key: 'stats', label: 'Growth stats', description: 'Today / 7 days / all time' },
  { key: 'image', label: 'Banner', description: 'Generated image gallery' },
  { key: 'timestamp', label: 'Timestamp', description: 'Delivery time' },
];

function Len({ value = '', max }) {
  const length = String(value || '').length;
  return (
    <span className={length > max ? 'len-counter is-over' : 'len-counter'}>
      {length}/{max}
    </span>
  );
}

export default function MessageEditor() {
  const { guildId } = useParams();
  const toast = useToast();
  const { draft, setDraft, dirty, commit, reset, loading, error, reload } = useConfigDraft(`/guilds/${guildId}/welcome`);
  const { meta } = useMeta();
  const [tab, setTab] = useState('main');
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const descRef = useRef(null);

  const sample = { returning: tab === 'returning', isBot: tab === 'bot' };
  const preview = useMessagePreview(guildId, { config: draft, kind: 'welcome', sample, active: Boolean(draft) });

  const active =
    tab === 'main'
      ? draft?.content
      : draft?.content?.variants?.[tab] || { title: '', description: '', emoji: '' };

  const setMain = (mutator) => {
    setDraft((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutator(next);
      return next;
    });
  };

  const updateField = (field, value) => {
    setMain((next) => {
      if (tab === 'main') {
        next.content[field] = value;
        return;
      }
      next.content.variants = next.content.variants || {};
      next.content.variants[tab] = {
        title: next.content.variants[tab]?.title ?? '',
        description: next.content.variants[tab]?.description ?? '',
        emoji: next.content.variants[tab]?.emoji ?? '',
        ...next.content.variants[tab],
        [field]: value,
      };
    });
  };

  const insertToken = (token) => {
    const textarea = descRef.current;
    const value = String(active?.description || '');
    if (!textarea) {
      updateField('description', `${value}${token}`);
      return;
    }
    const start = textarea.selectionStart ?? value.length;
    const end = textarea.selectionEnd ?? value.length;
    const nextValue = `${value.slice(0, start)}${token}${value.slice(end)}`;
    updateField('description', nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      const position = start + token.length;
      textarea.setSelectionRange(position, position);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await apiPut(`/guilds/${guildId}/welcome`, draft);
      commit(saved);
      toast.success('Welcome message saved.');
    } catch (err) {
      toast.error(err.message);
      if (err.field) toast.error(`Field: ${err.field}`);
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    setResetting(true);
    try {
      await apiPost(`/guilds/${guildId}/actions`, { action: 'reset-welcome', confirm: true });
      setResetOpen(false);
      toast.success('Message and style reset to defaults.');
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Message Editor" description="Loading editor…" />
        <div className="editor-layout">
          <Card><Skeleton height={420} /></Card>
          <Card><Skeleton height={420} /></Card>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Message Editor" />
        <Card>
          <p className="muted">{error?.message || 'Editor could not be loaded.'}</p>
          <Button variant="primary" onClick={reload}>Reload</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Components V2"
        title="Message Editor"
        description="Craft the exact onboarding message with live server-rendered previews."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button icon={Eraser} onClick={reset} disabled={!dirty}>Discard</Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>
              Save message
            </Button>
          </>
        }
      />

      <div className="editor-layout">
        <div className="editor-column">
          <Card
            title="Content"
            subtitle={
              tab === 'main'
                ? 'The default welcome. Placeholders resolve for every member.'
                : tab === 'bot'
                  ? 'Overrides used when the joining account is a bot.'
                  : 'Overrides used when a known member returns.'
            }
            actions={<Tabs value={tab} onChange={setTab} options={[{ value: 'main', label: 'Main' }, { value: 'bot', label: 'Bot variant' }, { value: 'returning', label: 'Returning' }]} />}
          >
            <div className="form-stack">
              <Field
                label="Title"
                hint="Markdown headings are applied by the selected style."
                action={<Len value={active?.title} max={256} />}
              >
                <Input
                  value={active?.title || ''}
                  maxLength={256}
                  onChange={(event) => updateField('title', event.target.value)}
                  placeholder="Welcome to {server_name}!"
                />
              </Field>
              <Field
                label="Description"
                hint="Supports Discord markdown, quotes, small text and placeholders."
                action={<Len value={active?.description} max={3500} />}
              >
                <TextArea
                  ref={descRef}
                  value={active?.description || ''}
                  rows={9}
                  onChange={(event) => updateField('description', event.target.value)}
                  placeholder="Hey {user}, welcome to {server_name}…"
                />
              </Field>
              <div>
                <span className="field-label">Insert placeholder</span>
                <PlaceholderChips placeholders={meta?.placeholders || []} onPick={insertToken} />
              </div>
              <div className="form-grid">
                <Field label="Emoji" hint="Unicode or custom emoji.">
                  <Input
                    value={active?.emoji || ''}
                    maxLength={64}
                    onChange={(event) => updateField('emoji', event.target.value)}
                    placeholder="👋"
                  />
                </Field>
                {tab === 'main' ? (
                  <>
                    <Field label="Footer" action={<Len value={draft.content.footer} max={1024} />}>
                      <Input
                        value={draft.content.footer || ''}
                        maxLength={1024}
                        onChange={(event) => setMain((next) => { next.content.footer = event.target.value; })}
                        placeholder="{server_name} • {member_count} members"
                      />
                    </Field>
                    <Field label="Accent colour" hint="Container accent used across Components V2.">
                      <ColorInput value={draft.content.color} onChange={(value) => setMain((next) => { next.content.color = value; })} />
                    </Field>
                    <Field label="Style">
                      <Select value={draft.style} onChange={(event) => setMain((next) => { next.style = event.target.value; })}>
                        {(meta?.styles || []).map((style) => (
                          <option key={style.id} value={style.id}>{style.name}</option>
                        ))}
                      </Select>
                    </Field>
                  </>
                ) : null}
              </div>
              {tab === 'main' ? (
                <Toggle
                  checked={draft.content.mention}
                  onChange={(value) => setMain((next) => { next.content.mention = value; })}
                  label="Mention the member"
                  description="Adds a member mention block and pings only that member."
                />
              ) : (
                <div className="inline-note">Variant overrides only change title, description and emoji. Layout, colour and footer come from the main message.</div>
              )}
            </div>
          </Card>

          <Card title="Visible elements" subtitle="Toggle individual Components V2 blocks">
            <div className="toggle-grid">
              {ELEMENTS.map((element) => (
                <div key={element.key} className="toggle-tile">
                  <div>
                    <strong>{element.label}</strong>
                    <span>{element.description}</span>
                  </div>
                  <Toggle
                    checked={Boolean(draft.content.elements[element.key])}
                    onChange={(value) => setMain((next) => { next.content.elements[element.key] = value; })}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Connected components" subtitle="Further customisation lives in dedicated studios">
            <div className="quick-grid">
              <Link to={`/servers/${guildId}/buttons`} className="quick-action">
                <MousePointerClick size={17} />
                <span>Button manager</span>
                <small>Links, roles, tickets and rules</small>
              </Link>
              <Link to={`/servers/${guildId}/images`} className="quick-action">
                <ImageIcon size={17} />
                <span>Image studio</span>
                <small>Banner artwork and layers</small>
              </Link>
              <Link to={`/servers/${guildId}/dm`} className="quick-action">
                <Sparkles size={17} />
                <span>DM settings</span>
                <small>Private welcome experience</small>
              </Link>
            </div>
          </Card>

          <div className="save-footer">
            <div>
              <strong>{dirty ? 'Unsaved edits' : 'Message saved'}</strong>
              <span>Server-rendered preview updates instantly with every keystroke.</span>
            </div>
            <div className="save-footer-actions">
              <Button icon={RotateCcw} onClick={() => setResetOpen(true)}>Reset all</Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <Card title="Discord preview" subtitle="Rendered from the same model used for delivery" className="sticky-card">
            <Tabs
              value={tab}
              onChange={setTab}
              options={[
                { value: 'main', label: 'Main' },
                { value: 'bot', label: 'Bot' },
                { value: 'returning', label: 'Returning' },
              ]}
            />
            <DiscordPreview model={preview.model} loading={preview.loading} error={preview.error} />
            <div className="preview-meta">
              <Sparkles size={14} /> Preview uses a sample member and live community statistics.
            </div>
          </Card>
          <ImagePreview
            guildId={guildId}
            config={draft}
            kind="welcome"
            active={Boolean(draft.image.enabled && draft.content.elements.image)}
            label="Welcome banner"
          />
        </aside>
      </div>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetConfig}
        loading={resetting}
        title="Reset welcome message?"
        message="This restores the default message, DM copy, style and banner. Channels, buttons and roles are kept."
        confirmLabel="Reset to defaults"
      />
    </div>
  );
}
