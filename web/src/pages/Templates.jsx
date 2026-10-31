import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy, Eye, LayoutTemplate, Pencil, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { apiDelete, apiPost, apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { useMeta } from '../data.js';
import { useMessagePreview, ImagePreview } from '../components/Preview.jsx';
import DiscordPreview from '../components/DiscordPreview.jsx';
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
  Segmented,
  Skeleton,
  TextArea,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

export default function Templates() {
  const { guildId } = useParams();
  const toast = useToast();
  const { meta } = useMeta();
  const [type, setType] = useState('welcome');
  const templatesApi = useApi(`/guilds/${guildId}/templates?type=${type}`);
  const welcomeApi = useApi(`/guilds/${guildId}/welcome`);
  const leaveApi = useApi(`/guilds/${guildId}/leave`);
  const [selectedId, setSelectedId] = useState(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveForm, setSaveForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', overwrite: false });
  const [busyId, setBusyId] = useState(null);

  const base = type === 'leave' ? leaveApi.data : welcomeApi.data;
  const data = templatesApi.data;
  const templates = [...(data?.builtins || []), ...(data?.custom || [])];
  const selected = templates.find((template) => template.id === selectedId) || templates[0] || null;

  const selectedConfig = useMemo(
    () =>
      selected && base
        ? {
            ...structuredClone(base),
            style: selected.style,
            content: structuredClone(selected.content),
            image: structuredClone(selected.image || base.image),
          }
        : null,
    [selected, base],
  );
  const preview = useMessagePreview(guildId, {
    config: selectedConfig,
    kind: type === 'leave' ? 'leave' : 'welcome',
    active: Boolean(selectedConfig),
  });

  useEffect(() => {
    setSelectedId(null);
  }, [type]);

  useEffect(() => {
    if (data && !selectedId) setSelectedId(templates[0]?.id || null);
  }, [data, selectedId, templates]);

  const apply = async (template) => {
    setBusyId(template.id);
    try {
      await apiPost(`/guilds/${guildId}/templates/${template.id}/apply`, { type });
      toast.success(`Applied ${template.name}.`);
      welcomeApi.reload();
      leaveApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (template) => {
    setBusyId(template.id);
    try {
      const created = await apiPost(`/guilds/${guildId}/templates/${template.id}/duplicate`, { type });
      toast.success(`Copied to “${created.name}”.`);
      templatesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await apiDelete(`/guilds/${guildId}/templates/${deleteTarget.id}`);
      toast.success('Template deleted.');
      setDeleteTarget(null);
      templatesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveCurrent = async () => {
    if (!saveForm.name.trim()) return toast.error('Give the template a name.');
    setSaving(true);
    try {
      await apiPost(`/guilds/${guildId}/templates`, {
        type,
        name: saveForm.name.trim(),
        description: saveForm.description.trim(),
        fromCurrent: true,
      });
      toast.success('Current configuration saved as a template.');
      setSaveOpen(false);
      setSaveForm({ name: '', description: '' });
      templatesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (template) => {
    setEditTarget(template);
    setEditForm({ name: template.name, description: template.description || '', overwrite: false });
  };

  const saveEdit = async () => {
    if (!editTarget || !editForm.name.trim()) return toast.error('Give the template a name.');
    setSaving(true);
    try {
      const body = {
        type,
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        style: editForm.overwrite && base ? base.style : editTarget.style,
        content: editForm.overwrite && base ? base.content : editTarget.content,
        image: editForm.overwrite && base ? base.image : editTarget.image,
      };
      await apiPut(`/guilds/${guildId}/templates/${editTarget.id}`, body);
      toast.success('Template updated.');
      setEditTarget(null);
      templatesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const restore = async () => {
    setSaving(true);
    try {
      await apiPost(`/guilds/${guildId}/templates/restore-defaults`, { type });
      toast.success('Default template restored.');
      setRestoreOpen(false);
      welcomeApi.reload();
      leaveApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Presets"
        title="Message Templates"
        description="Reusable onboarding designs. Apply, duplicate or snapshot your current layout."
        actions={
          <>
            <Button icon={RotateCcw} onClick={() => setRestoreOpen(true)}>Restore default</Button>
            <Button variant="primary" icon={Plus} onClick={() => setSaveOpen(true)}>Save current</Button>
          </>
        }
      />

      <div className="toolbar-row">
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'welcome', label: 'Welcome templates' },
            { value: 'leave', label: 'Leave templates' },
          ]}
        />
        <span className="toolbar-hint">{templates.length} layouts · applied changes sync immediately</span>
      </div>

      <div className="editor-layout">
        <div className="editor-column">
          {templatesApi.loading && !data ? (
            <div className="template-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <Card key={index}><Skeleton height={90} /></Card>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card>
              <EmptyState
                icon={LayoutTemplate}
                title="No templates yet"
                description="Save your current configuration as the first reusable template."
                action={<Button variant="primary" onClick={() => setSaveOpen(true)}>Save current layout</Button>}
              />
            </Card>
          ) : (
            <div className="template-grid">
              {templates.map((template) => {
                const accent = meta?.styles?.find((style) => style.id === template.style)?.accent || '#6366F1';
                const isSelected = selected?.id === template.id;
                return (
                  <article
                    key={template.id}
                    className={isSelected ? 'template-card selected' : 'template-card'}
                    onClick={() => setSelectedId(template.id)}
                  >
                    <div className="template-visual" style={{ background: `linear-gradient(135deg, ${accent}33, #0b1020 70%)` }}>
                      <span className="template-swatch" style={{ background: accent }} />
                      <span className="template-style">{template.style}</span>
                      <span className="template-lines">
                        <i />
                        <i />
                        <i className="short" />
                      </span>
                    </div>
                    <div className="template-body">
                      <div className="template-title-row">
                        <h3>{template.name}</h3>
                        <Badge tone={template.builtin ? 'info' : 'neutral'}>{template.builtin ? 'Built-in' : 'Saved'}</Badge>
                      </div>
                      <p>{template.description || 'No description.'}</p>
                      <div className="template-actions" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="primary" icon={Sparkles} onClick={() => apply(template)} loading={busyId === template.id}>
                          Apply
                        </Button>
                        <Button size="sm" icon={Copy} onClick={() => duplicate(template)} loading={busyId === template.id}>
                          Duplicate
                        </Button>
                        {!template.builtin ? (
                          <>
                            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(template)} />
                            <Button size="sm" variant="ghost" icon={Trash2} onClick={() => setDeleteTarget(template)} />
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="preview-column">
          <Card
            title={selected ? selected.name : 'Template preview'}
            subtitle={selected ? `${selected.style} layout${selected.builtin ? ' · built-in' : ' · saved'} over your current channels` : 'Select a template'}
            className="sticky-card"
            actions={<Badge tone="info"><Eye size={12} /> Preview</Badge>}
          >
            <DiscordPreview
              model={preview.model}
              loading={preview.loading}
              error={preview.error}
            />
            {selected ? (
              <div className="template-preview-actions">
                <Button variant="primary" icon={Save} onClick={() => apply(selected)} loading={busyId === selected.id}>
                  Apply template
                </Button>
                <Link className="btn btn-secondary" to={`/servers/${guildId}/${type === 'leave' ? 'leave' : 'editor'}`}>
                  Open editor
                </Link>
              </div>
            ) : null}
          </Card>
          {selectedConfig ? (
            <ImagePreview
              guildId={guildId}
              config={selectedConfig}
              kind={type === 'leave' ? 'leave' : 'welcome'}
              active={Boolean(selectedConfig.image?.enabled && selectedConfig.content?.elements?.image)}
              label="Template banner"
            />
          ) : null}
        </aside>
      </div>

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save current configuration"
        description="Snapshots the message content, style and banner of your live configuration."
        footer={
          <>
            <Button onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveCurrent} loading={saving}>Save template</Button>
          </>
        }
      >
        <div className="form-stack">
          <Field label="Template name">
            <Input
              value={saveForm.name}
              maxLength={100}
              onChange={(event) => setSaveForm({ ...saveForm, name: event.target.value })}
              placeholder="Aurora Signature"
            />
          </Field>
          <Field label="Description" hint="Shown in the template library.">
            <TextArea
              rows={3}
              maxLength={300}
              value={saveForm.description}
              onChange={(event) => setSaveForm({ ...saveForm, description: event.target.value })}
              placeholder="Warm, minimal onboarding for a creative community."
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        title="Edit template"
        description="Rename the template or overwrite its saved layout with your current configuration."
        footer={
          <>
            <Button onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button variant="primary" onClick={saveEdit} loading={saving}>Save template</Button>
          </>
        }
      >
        <div className="form-stack">
          <Field label="Template name">
            <Input
              value={editForm.name}
              maxLength={100}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={3}
              maxLength={300}
              value={editForm.description}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
            />
          </Field>
          <Toggle
            checked={editForm.overwrite}
            onChange={(value) => setEditForm({ ...editForm, overwrite: value })}
            label="Overwrite content with current configuration"
            description="Replaces the saved message content, style and banner with the live configuration for this community."
          />
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={saving}
        title="Delete template?"
        message={`“${deleteTarget?.name || ''}” will be removed. Built-in templates are unaffected.`}
        confirmLabel="Delete template"
      />

      <ConfirmModal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={restore}
        loading={saving}
        title="Restore default template?"
        message={`The ${type} configuration will be replaced by the built-in default. Channels and buttons are kept.`}
        confirmLabel="Restore default"
      />
    </div>
  );
}
