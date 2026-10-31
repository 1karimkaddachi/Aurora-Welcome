import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Check,
  ImagePlus,
  Layers,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { apiDelete, apiPost, apiPut, uploadImage } from '../api.js';
import { useApi } from '../hooks.js';
import { useMeta } from '../data.js';
import { ImagePreview } from '../components/Preview.jsx';
import {
  Badge,
  Button,
  Card,
  ColorInput,
  ConfirmModal,
  Field,
  Input,
  Modal,
  PageHeader,
  RangeInput,
  Segmented,
  Select,
  Skeleton,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const BACKGROUND_TYPES = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'color', label: 'Solid colour' },
  { value: 'image', label: 'Image' },
];

export default function Images() {
  const { guildId } = useParams();
  const toast = useToast();
  const { meta } = useMeta();
  const [target, setTarget] = useState('welcome');
  const welcomeApi = useApi(`/guilds/${guildId}/welcome`);
  const leaveApi = useApi(`/guilds/${guildId}/leave`);
  const uploadsApi = useApi(`/guilds/${guildId}/uploads`);
  const templatesApi = useApi(`/guilds/${guildId}/image-templates`);
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [deleteUpload, setDeleteUpload] = useState(null);
  const [deleteTemplate, setDeleteTemplate] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const fileRef = useRef(null);

  const base = target === 'leave' ? leaveApi.data : welcomeApi.data;

  useEffect(() => {
    if (!base) return;
    const clone = structuredClone(base);
    setDraft(clone);
    setOriginal(structuredClone(clone));
  }, [base, target]);

  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original));
  const image = draft?.image;

  const update = (mutator) => {
    setDraft((current) => {
      if (!current) return current;
      const next = structuredClone(current);
      mutator(next.image, next);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const path = target === 'leave' ? `/guilds/${guildId}/leave` : `/guilds/${guildId}/welcome`;
      const saved = await apiPut(path, draft);
      (target === 'leave' ? leaveApi : welcomeApi).setData(saved);
      setDraft(structuredClone(saved));
      setOriginal(structuredClone(saved));
      toast.success(`${target === 'leave' ? 'Leave' : 'Welcome'} banner saved.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadImage(guildId, file);
      update((img) => {
        img.background.image = uploaded.path;
        img.background.type = 'image';
      });
      uploadsApi.reload();
      toast.success('Background uploaded.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeUpload = async () => {
    if (!deleteUpload) return;
    try {
      await apiDelete(`/guilds/${guildId}/uploads/${deleteUpload.name}`);
      if (image?.background.image?.endsWith(`/${deleteUpload.name}`)) {
        update((img) => { img.background.image = null; });
      }
      toast.success('Upload deleted.');
      setDeleteUpload(null);
      uploadsApi.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) return toast.error('Name the image template.');
    setTemplateSaving(true);
    try {
      await apiPost(`/guilds/${guildId}/image-templates`, {
        name: templateName.trim(),
        config: image,
        backgroundPath: image.background.image,
      });
      toast.success('Image template saved.');
      setTemplateOpen(false);
      setTemplateName('');
      templatesApi.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setTemplateSaving(false);
    }
  };

  const applyTemplate = (template) => {
    update((img) => {
      Object.assign(img, structuredClone(template.config));
    });
    toast.info(`Applied ${template.name}.`);
  };

  const removeTemplate = async () => {
    if (!deleteTemplate) return;
    try {
      await apiDelete(`/guilds/${guildId}/image-templates/${deleteTemplate.id}`);
      setDeleteTemplate(null);
      templatesApi.reload();
      toast.success('Image template deleted.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const resetImage = () => {
    const defaults = meta?.imageDefaults?.[target];
    if (!defaults) return;
    setDraft((current) => ({ ...current, image: structuredClone(defaults) }));
    setResetOpen(false);
    toast.info('Banner settings reset to defaults.');
  };

  if ((target === 'welcome' ? welcomeApi.loading : leaveApi.loading) && !draft) {
    return (
      <div className="page-enter">
        <PageHeader title="Welcome Images" description="Loading image studio…" />
        <div className="editor-layout">
          <Card><Skeleton height={420} /></Card>
          <Card><Skeleton height={420} /></Card>
        </div>
      </div>
    );
  }

  if (!draft || !image) {
    return (
      <div className="page-enter">
        <PageHeader title="Welcome Images" />
        <Card>
          <p className="muted">Image settings could not be loaded.</p>
          <Button variant="primary" onClick={() => (target === 'leave' ? leaveApi.reload() : welcomeApi.reload())}>Reload</Button>
        </Card>
      </div>
    );
  }

  const uploads = uploadsApi.data || [];
  const imageTemplates = templatesApi.data || [];
  const bg = image.background;

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Canvas studio"
        title="Welcome Images"
        description="Design the banner generated for every arrival. Rendering happens in a worker pool and never blocks the gateway."
        actions={
          <>
            {dirty ? <Badge tone="warning" dot>Unsaved</Badge> : <Badge tone="success" dot>Synced</Badge>}
            <Button icon={RotateCcw} onClick={() => setResetOpen(true)}>Reset</Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!dirty}>Save banner</Button>
          </>
        }
      />

      <div className="toolbar-row">
        <Segmented
          value={target}
          onChange={setTarget}
          options={[
            { value: 'welcome', label: 'Welcome banner' },
            { value: 'leave', label: 'Leave banner' },
          ]}
        />
        <Toggle
          checked={image.enabled}
          onChange={(value) => update((img) => { img.enabled = value; })}
          label="Generate image on joins"
          description="Disable to send text-only Components V2 messages."
        />
      </div>

      <div className="editor-layout image-layout">
        <div className="editor-column">
          <Card title="Canvas" subtitle="Output resolution and type family" actions={<Wand2 size={16} className="muted-icon" />}>
            <div className="form-grid">
              <RangeInput label="Width" value={image.width} min={400} max={2000} step={2} onChange={(value) => update((img) => { img.width = value; })} />
              <RangeInput label="Height" value={image.height} min={150} max={1000} step={2} onChange={(value) => update((img) => { img.height = value; })} />
              <Field label="Font family" hint="Drop .ttf/.otf fonts into data/fonts to register custom families.">
                <Select value={image.font} onChange={(event) => update((img) => { img.font = event.target.value; })}>
                  {(meta?.fonts || ['Segoe UI']).map((font) => (
                    <option key={font} value={font}>{font}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="Background" subtitle="Gradient, solid colour or an uploaded image">
            <Segmented
              value={bg.type}
              onChange={(value) => update((img) => { img.background.type = value; })}
              options={BACKGROUND_TYPES}
            />
            {bg.type !== 'image' ? (
              <div className="form-stack" style={{ marginTop: 18 }}>
                <div className="color-stack">
                  {bg.colors.map((color, index) => (
                    <div className="color-row" key={index}>
                      <span className="color-index">{String(index + 1).padStart(2, '0')}</span>
                      <ColorInput value={color} onChange={(value) => update((img) => { img.background.colors[index] = value; })} />
                      {bg.colors.length > 1 ? (
                        <button type="button" className="icon-btn" onClick={() => update((img) => { img.background.colors.splice(index, 1); })}>
                          <Trash2 size={15} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {bg.colors.length < 5 ? (
                    <Button size="sm" icon={Plus} onClick={() => update((img) => { img.background.colors.push('#6366F1'); })}>
                      Add colour stop
                    </Button>
                  ) : null}
                </div>
                {bg.type === 'gradient' ? (
                  <div className="form-grid">
                    <RangeInput label="Angle" value={bg.angle} min={0} max={360} onChange={(value) => update((img) => { img.background.angle = value; })} suffix="°" />
                    <RangeInput label="Overlay" value={bg.overlay} min={0} max={0.95} step={0.05} onChange={(value) => update((img) => { img.background.overlay = value; })} suffix="" />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="form-stack" style={{ marginTop: 18 }}>
                <div className="form-grid">
                  <Field label="Fit">
                    <Select value={bg.fit} onChange={(event) => update((img) => { img.background.fit = event.target.value; })}>
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="stretch">Stretch</option>
                    </Select>
                  </Field>
                  <RangeInput label="Overlay" value={bg.overlay} min={0} max={0.95} step={0.05} onChange={(value) => update((img) => { img.background.overlay = value; })} suffix="" />
                </div>
                <div className="upload-row">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={handleUpload} />
                  <Button icon={Upload} onClick={() => fileRef.current?.click()} loading={uploading}>
                    Upload background
                  </Button>
                  <span className="field-hint">PNG, JPEG, WebP or GIF · up to {Math.round((meta?.limits?.uploadBytes || 8388608) / 1024 / 1024)} MB</span>
                </div>
                {uploads.length ? (
                  <div className="upload-grid">
                    {uploads.map((file) => (
                      <div key={file.name} className={bg.image === file.path ? 'upload-card selected' : 'upload-card'}>
                        <button type="button" className="upload-thumb" onClick={() => update((img) => { img.background.image = file.path; })}>
                          <img src={file.url} alt={file.name} />
                        </button>
                        <div className="upload-meta">
                          <span>{file.name.slice(0, 12)}…</span>
                          <button type="button" className="icon-btn" onClick={() => setDeleteUpload(file)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="inline-note">No backgrounds uploaded yet. Uploads are private and scoped to this community.</div>
                )}
              </div>
            )}
          </Card>

          <Card title="Avatar layer" subtitle="Shape, ring and position of the member avatar">
            <Toggle checked={image.avatar.show} onChange={(value) => update((img) => { img.avatar.show = value; })} label="Show avatar" />
            <div className="form-grid" style={{ marginTop: 14 }}>
              <Field label="Shape">
                <Segmented
                  value={image.avatar.shape}
                  onChange={(value) => update((img) => { img.avatar.shape = value; })}
                  options={[
                    { value: 'circle', label: 'Circle' },
                    { value: 'rounded', label: 'Rounded' },
                    { value: 'square', label: 'Square' },
                  ]}
                />
              </Field>
              <RangeInput label="Size" value={image.avatar.size} min={40} max={400} onChange={(value) => update((img) => { img.avatar.size = value; })} />
              <RangeInput label="X position" value={image.avatar.x} min={0} max={Math.max(200, image.width - 100)} onChange={(value) => update((img) => { img.avatar.x = value; })} />
              <RangeInput label="Y position" value={image.avatar.y} min={0} max={Math.max(100, image.height - 50)} onChange={(value) => update((img) => { img.avatar.y = value; })} />
              <RangeInput label="Ring width" value={image.avatar.borderWidth} min={0} max={24} onChange={(value) => update((img) => { img.avatar.borderWidth = value; })} />
              <Field label="Ring colour">
                <ColorInput value={image.avatar.borderColor} onChange={(value) => update((img) => { img.avatar.borderColor = value; })} />
              </Field>
            </div>
            <Toggle checked={image.avatar.glow} onChange={(value) => update((img) => { img.avatar.glow = value; })} label="Accent glow" />
          </Card>

          <Card title="Typography" subtitle="Headline, name and subtitle layers">
            <div className="form-grid">
              <RangeInput label="Text X" value={image.text.x} min={0} max={Math.max(200, image.width - 100)} onChange={(value) => update((img) => { img.text.x = value; })} />
              <RangeInput label="Text Y" value={image.text.y} min={0} max={Math.max(100, image.height - 50)} onChange={(value) => update((img) => { img.text.y = value; })} />
              <Field label="Alignment">
                <Segmented
                  value={image.text.align}
                  onChange={(value) => update((img) => { img.text.align = value; })}
                  options={[
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
              </Field>
              <RangeInput label="Headline size" value={image.text.titleSize} min={10} max={100} onChange={(value) => update((img) => { img.text.titleSize = value; })} />
              <RangeInput label="Name size" value={image.text.userSize} min={12} max={140} onChange={(value) => update((img) => { img.text.userSize = value; })} />
              <RangeInput label="Subtitle size" value={image.text.subtitleSize} min={10} max={80} onChange={(value) => update((img) => { img.text.subtitleSize = value; })} />
              <Field label="Headline colour">
                <ColorInput value={image.text.titleColor} onChange={(value) => update((img) => { img.text.titleColor = value; })} />
              </Field>
              <Field label="Name colour">
                <ColorInput value={image.text.userColor} onChange={(value) => update((img) => { img.text.userColor = value; })} />
              </Field>
              <Field label="Subtitle colour">
                <ColorInput value={image.text.subtitleColor} onChange={(value) => update((img) => { img.text.subtitleColor = value; })} />
              </Field>
            </div>
          </Card>

          <Card title="Branding & member number" subtitle="Server identity and the member badge">
            <Toggle checked={image.server.show} onChange={(value) => update((img) => { img.server.show = value; })} label="Show server brand" />
            <div className="form-grid" style={{ marginTop: 14 }}>
              <RangeInput label="Brand X" value={image.server.x} min={0} max={Math.max(200, image.width - 100)} onChange={(value) => update((img) => { img.server.x = value; })} />
              <RangeInput label="Brand Y" value={image.server.y} min={0} max={Math.max(100, image.height - 50)} onChange={(value) => update((img) => { img.server.y = value; })} />
              <RangeInput label="Logo size" value={image.server.size} min={16} max={200} onChange={(value) => update((img) => { img.server.size = value; })} />
              <RangeInput label="Name size" value={image.server.nameSize} min={8} max={60} onChange={(value) => update((img) => { img.server.nameSize = value; })} />
              <Field label="Server name colour">
                <ColorInput value={image.server.nameColor} onChange={(value) => update((img) => { img.server.nameColor = value; })} />
              </Field>
            </div>
            <Toggle checked={image.server.logo} onChange={(value) => update((img) => { img.server.logo = value; })} label="Show server logo" />
            <Toggle checked={image.memberNumber.show} onChange={(value) => update((img) => { img.memberNumber.show = value; })} label="Show member number badge" />
            <div className="form-grid" style={{ marginTop: 14 }}>
              <RangeInput label="Badge X" value={image.memberNumber.x} min={0} max={Math.max(200, image.width - 100)} onChange={(value) => update((img) => { img.memberNumber.x = value; })} />
              <RangeInput label="Badge Y" value={image.memberNumber.y} min={0} max={Math.max(100, image.height - 50)} onChange={(value) => update((img) => { img.memberNumber.y = value; })} />
              <RangeInput label="Badge size" value={image.memberNumber.size} min={10} max={80} onChange={(value) => update((img) => { img.memberNumber.size = value; })} />
              <Field label="Badge colour">
                <ColorInput value={image.memberNumber.color} onChange={(value) => update((img) => { img.memberNumber.color = value; })} />
              </Field>
            </div>
          </Card>

          <Card title="Decorations" subtitle="Layered detail drawn behind the content">
            <div className="form-grid">
              <Toggle checked={image.decorations.glow} onChange={(value) => update((img) => { img.decorations.glow = value; })} label="Accent glow" />
              <Toggle checked={image.decorations.particles} onChange={(value) => update((img) => { img.decorations.particles = value; })} label="Particles" />
              <Toggle checked={image.decorations.grid} onChange={(value) => update((img) => { img.decorations.grid = value; })} label="Grid texture" />
              <Toggle checked={image.decorations.accentBar} onChange={(value) => update((img) => { img.decorations.accentBar = value; })} label="Accent bar" />
            </div>
          </Card>

          <Card
            title="Image templates"
            subtitle="Save complete studio configurations"
            actions={<Button size="sm" variant="primary" icon={ImagePlus} onClick={() => setTemplateOpen(true)}>Save current</Button>}
          >
            {imageTemplates.length ? (
              <div className="image-template-list">
                {imageTemplates.map((template) => {
                  const bgTemplate = template.config?.background || {};
                  const thumb = template.backgroundPath
                    ? `/api/guilds/${guildId}/uploads/${template.backgroundPath.split('/').pop()}`
                    : null;
                  return (
                    <div key={template.id} className="image-template-row">
                      <span
                        className="image-template-thumb"
                        style={!thumb ? { background: `linear-gradient(135deg, ${(bgTemplate.colors || ['#6366F1', '#22D3EE']).join(',')})` } : undefined}
                      >
                        {thumb ? <img src={thumb} alt="" /> : <Layers size={16} />}
                      </span>
                      <div className="image-template-meta">
                        <strong>{template.name}</strong>
                        <span>{template.config?.width} × {template.config?.height} · {template.config?.background?.type}</span>
                      </div>
                      <Button size="sm" onClick={() => applyTemplate(template)}>Apply</Button>
                      <button type="button" className="icon-btn" onClick={() => setDeleteTemplate(template)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="inline-note">No image templates saved yet. Save your studio configuration to reuse it.</div>
            )}
          </Card>

          <div className="save-footer">
            <div>
              <strong>{dirty ? 'Unsaved banner changes' : 'Banner saved'}</strong>
              <span>Preview updates automatically after you stop changing controls.</span>
            </div>
            <div className="save-footer-actions">
              <Button icon={RotateCcw} onClick={() => setResetOpen(true)}>Reset</Button>
              <Button variant="primary" icon={Check} onClick={save} loading={saving} disabled={!dirty}>Save</Button>
            </div>
          </div>
        </div>

        <aside className="preview-column">
          <div className="sticky-card">
            <ImagePreview
              guildId={guildId}
              config={draft}
              kind={target === 'leave' ? 'leave' : 'welcome'}
              active
              label={target === 'leave' ? 'Leave banner preview' : 'Welcome banner preview'}
            />
            <div className="preview-meta">
              <Wand2 size={14} /> Rendered with @napi-rs/canvas · {image.width}×{image.height}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Save image template"
        description="Snapshots the full banner configuration including the background asset reference."
        footer={
          <>
            <Button onClick={() => setTemplateOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveTemplate} loading={templateSaving}>Save template</Button>
          </>
        }
      >
        <Field label="Template name">
          <Input value={templateName} maxLength={100} onChange={(event) => setTemplateName(event.target.value)} placeholder="Aurora Indigo" />
        </Field>
      </Modal>

      <ConfirmModal
        open={Boolean(deleteUpload)}
        onClose={() => setDeleteUpload(null)}
        onConfirm={removeUpload}
        title="Delete uploaded background?"
        message={`${deleteUpload?.name || ''} will be removed from disk. Any configuration referencing it will fall back to a gradient.`}
        confirmLabel="Delete file"
      />

      <ConfirmModal
        open={Boolean(deleteTemplate)}
        onClose={() => setDeleteTemplate(null)}
        onConfirm={removeTemplate}
        title="Delete image template?"
        message={`“${deleteTemplate?.name || ''}” will be removed.`}
        confirmLabel="Delete template"
      />

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={resetImage}
        title="Reset banner settings?"
        message="All layer positions, colours and dimensions return to the built-in defaults for this banner type."
        confirmLabel="Reset banner"
      />
    </div>
  );
}
