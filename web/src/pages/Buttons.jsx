import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Link2,
  MousePointerClick,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiDelete, apiPost, apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { useMeta } from '../data.js';
import { useMessagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
import { useRoles } from '../data.js';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  RoleSelect,
  Segmented,
  Select,
  Skeleton,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const EMPTY_FORM = { label: '', emoji: '', type: 'rules', style: '2', url: '' };

export default function Buttons() {
  const { guildId } = useParams();
  const toast = useToast();
  const { meta } = useMeta();
  const [scope, setScope] = useState('welcome');
  const buttonsApi = useApi(`/guilds/${guildId}/buttons?scope=${scope}`);
  const selfApi = useApi(`/guilds/${guildId}/selfroles`);
  const { roles, online } = useRoles(guildId);
  const welcomeApi = useApi(`/guilds/${guildId}/welcome`);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selfForm, setSelfForm] = useState({ roleId: '', label: '', emoji: '' });
  const [selfSaving, setSelfSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  const preview = useMessagePreview(guildId, {
    config: welcomeApi.data,
    kind: scope === 'dm' ? 'dm' : 'welcome',
    active: Boolean(welcomeApi.data),
    refreshKey: previewKey,
  });

  const buttons = buttonsApi.data || [];
  const selfRoles = selfApi.data || [];

  const refresh = () => {
    buttonsApi.reload();
    setPreviewKey((value) => value + 1);
  };

  const openCreate = () => {
    setEditor({ mode: 'create' });
    setForm(scope === 'dm' ? { ...EMPTY_FORM, type: 'url' } : EMPTY_FORM);
  };

  const openEdit = (button) => {
    setEditor({ mode: 'edit', id: button.id });
    setForm({
      label: button.label,
      emoji: button.emoji || '',
      type: button.type,
      style: String(button.style || 2),
      url: button.url || '',
    });
  };

  const saveButton = async () => {
    if (!form.label.trim()) return toast.error('Button labels cannot be empty.');
    if (form.type === 'url' && !/^https?:\/\/\S+$/i.test(form.url)) return toast.error('Enter a valid http(s) URL.');
    setSaving(true);
    try {
      const payload = {
        scope,
        label: form.label.trim(),
        emoji: form.emoji.trim(),
        type: form.type,
        style: Number(form.style),
        url: form.type === 'url' ? form.url.trim() : null,
      };
      if (editor.mode === 'create') await apiPost(`/guilds/${guildId}/buttons`, payload);
      else await apiPut(`/guilds/${guildId}/buttons/${editor.id}`, payload);
      toast.success(editor.mode === 'create' ? 'Button added.' : 'Button updated.');
      setEditor(null);
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleButton = async (button) => {
    try {
      await apiPut(`/guilds/${guildId}/buttons/${button.id}`, { enabled: !button.enabled });
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const move = async (index, direction) => {
    const next = [...buttons];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await apiPost(`/guilds/${guildId}/buttons/reorder`, { scope, ids: next.map((button) => button.id) });
      refresh();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const removeButton = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await apiDelete(`/guilds/${guildId}/buttons/${deleteTarget.id}`);
      toast.success('Button removed.');
      setDeleteTarget(null);
      refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const addSelfRole = async () => {
    if (!selfForm.roleId) return toast.error('Select a role.');
    if (!selfForm.label.trim()) return toast.error('Give the role a label.');
    setSelfSaving(true);
    try {
      await apiPost(`/guilds/${guildId}/selfroles`, selfForm);
      toast.success('Self-assignable role added.');
      setSelfForm({ roleId: '', label: '', emoji: '' });
      selfApi.reload();
      setPreviewKey((value) => value + 1);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSelfSaving(false);
    }
  };

  const removeSelfRole = async (role) => {
    try {
      await apiDelete(`/guilds/${guildId}/selfroles/${role.id}`);
      toast.success('Self-assignable role removed.');
      selfApi.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const requiresUrl = form.type === 'url';
  const isLink = form.type === 'url' || form.type === 'dashboard';

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Components V2"
        title="Button Manager"
        description="Every button performs a real action: channel links, self roles, support threads and validated URLs."
        actions={<Button variant="primary" icon={Plus} onClick={openCreate}>Add button</Button>}
      />

      <div className="toolbar-row">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'welcome', label: 'Welcome buttons' },
            { value: 'dm', label: 'DM buttons' },
          ]}
        />
        <span className="toolbar-hint">Discord allows up to 25 buttons per message · 5 per row</span>
      </div>

      <div className="editor-layout">
        <div className="editor-column">
          <Card
            title={scope === 'welcome' ? 'Welcome buttons' : 'DM buttons'}
            subtitle={scope === 'welcome' ? 'Shown under the public welcome message.' : 'Shown inside the welcome direct message.'}
            actions={<Badge tone="info">{buttons.length}/25</Badge>}
          >
            {buttonsApi.loading && !buttonsApi.data ? (
              <div className="loading-block">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} height={54} />
                ))}
              </div>
            ) : buttons.length === 0 ? (
              <EmptyState
                icon={MousePointerClick}
                title="No buttons configured"
                description="Add Read Rules, Get Roles or a support ticket button to give new members their first action."
                action={<Button variant="primary" icon={Plus} onClick={openCreate}>Add the first button</Button>}
              />
            ) : (
              <div className="button-list">
                {buttons.map((button, index) => (
                  <div key={button.id} className="button-row">
                    <span className={`button-preview style-${button.type === 'url' || button.type === 'dashboard' ? 5 : button.style}`}>
                      {button.emoji ? <span>{button.emoji}</span> : null}
                      {button.label}
                      {(button.type === 'url' || button.type === 'dashboard') ? <Link2 size={12} /> : null}
                    </span>
                    <div className="button-info">
                      <strong>{button.type}</strong>
                      <span>{button.url || (button.type === 'dashboard' ? 'Dashboard link' : 'Internal action')}</span>
                    </div>
                    <div className="button-controls">
                      <Toggle checked={button.enabled} onChange={() => toggleButton(button)} />
                      <button type="button" className="icon-btn" disabled={index === 0} onClick={() => move(index, -1)} title="Move up">
                        <ArrowUp size={14} />
                      </button>
                      <button type="button" className="icon-btn" disabled={index === buttons.length - 1} onClick={() => move(index, 1)} title="Move down">
                        <ArrowDown size={14} />
                      </button>
                      <button type="button" className="icon-btn" onClick={() => openEdit(button)} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button type="button" className="icon-btn danger" onClick={() => setDeleteTarget(button)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Self-assignable roles"
            subtitle="Used by the Get Roles button. Members can toggle these roles themselves."
          >
            {selfRoles.length ? (
              <div className="button-list">
                {selfRoles.map((role) => (
                  <div key={role.id} className="button-row self-role-row">
                    <span className="self-role-badge">{role.emoji || '🎭'}</span>
                    <div className="button-info">
                      <strong>{role.label}</strong>
                      <span>
                        @{role.roleName || role.roleId}
                        {role.assignable === false ? ' · above bot role' : ''}
                      </span>
                    </div>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => removeSelfRole(role)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="inline-note">No self-assignable roles yet. Add one below to make the Get Roles button functional.</div>
            )}
            <div className="self-role-form">
              <Field label="Role">
                <RoleSelect roles={roles} online={online} value={selfForm.roleId} onChange={(roleId) => setSelfForm({ ...selfForm, roleId })} />
              </Field>
              <Field label="Label">
                <Input value={selfForm.label} maxLength={80} onChange={(event) => setSelfForm({ ...selfForm, label: event.target.value })} placeholder="Gamer" />
              </Field>
              <Field label="Emoji">
                <Input value={selfForm.emoji} maxLength={64} onChange={(event) => setSelfForm({ ...selfForm, emoji: event.target.value })} placeholder="🎮" />
              </Field>
              <Button variant="primary" icon={Plus} onClick={addSelfRole} loading={selfSaving}>Add role</Button>
            </div>
          </Card>
        </div>

        <aside className="preview-column">
          <Card title="Button preview" subtitle="Live Components V2 rendering with saved buttons" className="sticky-card" actions={<Badge tone="info"><Sparkles size={12} /> Live</Badge>}>
            <DiscordPreview
              model={preview.model}
              loading={preview.loading}
              error={preview.error}
            />
          </Card>
          <div className="callout callout-info">
            <Check size={17} />
            <div>
              <strong>Every button is handled</strong>
              <span>Rules and introductions deep-link to channels, Get Roles opens a self-role picker, tickets create private threads, and URL buttons validate http(s).</span>
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor?.mode === 'create' ? 'Add button' : 'Edit button'}
        description="Label, action and visual styling."
        footer={
          <>
            <Button onClick={() => setEditor(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveButton} loading={saving}>Save button</Button>
          </>
        }
      >
        <div className="form-stack">
          <div className="form-grid">
            <Field label="Label">
              <Input value={form.label} maxLength={80} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="Read Rules" />
            </Field>
            <Field label="Emoji">
              <Input value={form.emoji} maxLength={64} onChange={(event) => setForm({ ...form, emoji: event.target.value })} placeholder="📜" />
            </Field>
          </div>
          <Field
            label="Action"
            hint={
              scope === 'dm'
                ? 'Direct messages can only use link actions. Internal buttons need a server interaction context.'
                : meta?.buttonTypes?.find((type) => type.id === form.type)?.description
            }
          >
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {(meta?.buttonTypes || [])
                .filter((type) => scope !== 'dm' || ['url', 'dashboard'].includes(type.id))
                .map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
            </Select>
          </Field>
          {form.type === 'url' ? (
            <Field label="URL" hint="Must be a valid http(s) destination.">
              <Input value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://example.com" />
            </Field>
          ) : null}
          {!isLink ? (
            <Field label="Style">
              <Segmented
                value={form.style}
                onChange={(value) => setForm({ ...form, style: value })}
                options={[
                  { value: '1', label: 'Primary' },
                  { value: '2', label: 'Secondary' },
                  { value: '3', label: 'Success' },
                  { value: '4', label: 'Danger' },
                ]}
              />
            </Field>
          ) : (
            <div className="inline-note">Link and dashboard actions use Discord’s link button style automatically.</div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeButton}
        loading={saving}
        title="Remove button?"
        message={`“${deleteTarget?.label || ''}” will no longer appear in the ${scope} message.`}
        confirmLabel="Remove button"
      />
    </div>
  );
}
