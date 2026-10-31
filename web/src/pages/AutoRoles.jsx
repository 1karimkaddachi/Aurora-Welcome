import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, Plus, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { apiDelete, apiPost, apiPut } from '../api.js';
import { useApi } from '../hooks.js';
import { useRoles } from '../data.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  RoleSelect,
  Select,
  Skeleton,
  Toggle,
} from '../components/ui.jsx';
import { useToast } from '../components/Toast.jsx';

const TARGET_LABEL = { human: 'Humans', bot: 'Bots', all: 'Everyone' };

export default function AutoRoles() {
  const { guildId } = useParams();
  const toast = useToast();
  const rolesApi = useApi(`/guilds/${guildId}/autoroles`);
  const overview = useApi(`/guilds/${guildId}/overview`);
  const { roles, online } = useRoles(guildId);
  const [form, setForm] = useState({ roleId: '', target: 'human', delaySeconds: 0 });
  const [saving, setSaving] = useState(false);

  const autoRoles = rolesApi.data || [];
  const offline = !online;

  const add = async () => {
    if (!form.roleId) return toast.error('Select a role to assign.');
    setSaving(true);
    try {
      await apiPost(`/guilds/${guildId}/autoroles`, {
        roleId: form.roleId,
        target: form.target,
        delaySeconds: Number(form.delaySeconds) || 0,
        enabled: true,
      });
      toast.success('Auto role added.');
      setForm({ roleId: '', target: 'human', delaySeconds: 0 });
      rolesApi.reload();
      overview.reload();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (role) => {
    try {
      await apiPut(`/guilds/${guildId}/autoroles/${role.id}`, { enabled: !role.enabled });
      rolesApi.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const remove = async (role) => {
    try {
      await apiDelete(`/guilds/${guildId}/autoroles/${role.id}`);
      toast.success('Auto role removed.');
      rolesApi.reload();
      overview.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Member automation"
        title="Auto Roles"
        description="Assign roles on join with role-hierarchy checks, per-role delays and audited results."
        actions={<Link className="btn btn-secondary" to={`/servers/${guildId}/logs`}>Role logs</Link>}
      />

      {offline ? (
        <div className="callout callout-warning">
          <AlertTriangle size={18} />
          <div>
            <strong>Role list unavailable</strong>
            <span>The bot is offline. You can still add a role by ID, but hierarchy validation only runs when connected.</span>
          </div>
        </div>
      ) : null}

      <div className="editor-layout">
        <div className="editor-column">
          <Card title="Configured roles" subtitle="Applied in order, with a small delay between assignments" actions={<Badge tone="info">{autoRoles.length} rules</Badge>}>
            {rolesApi.loading && !rolesApi.data ? (
              <div className="loading-block">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} height={48} />
                ))}
              </div>
            ) : autoRoles.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No automatic roles"
                description="Give every new member their base role, or target bots separately."
              />
            ) : (
              <div className="auto-role-list">
                {autoRoles.map((role) => (
                  <div key={role.id} className="auto-role-row">
                    <span className="role-dot" style={{ background: role.roleColor || '#64748B' }} />
                    <div className="auto-role-main">
                      <div className="auto-role-title">
                        <strong>{role.roleName ? `@${role.roleName}` : role.roleId}</strong>
                        <Badge tone={role.target === 'bot' ? 'warning' : role.target === 'all' ? 'info' : 'success'}>
                          {TARGET_LABEL[role.target]}
                        </Badge>
                        {role.delaySeconds > 0 ? <Badge tone="neutral">{role.delaySeconds}s delay</Badge> : null}
                      </div>
                      <span>
                        {role.assignable === false
                          ? '⚠ Role is above the bot’s highest role'
                          : role.roleName
                            ? 'Role position is valid'
                            : 'Role not found in this server'}
                      </span>
                    </div>
                    <Toggle checked={role.enabled} onChange={() => toggle(role)} />
                    <button type="button" className="icon-btn danger" onClick={() => remove(role)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Add an automatic role" subtitle="Applied on every matching join">
            <div className="form-grid">
              <Field label="Role">
                <RoleSelect roles={roles} online={online} value={form.roleId} onChange={(roleId) => setForm({ ...form, roleId })} />
              </Field>
              <Field label="Target">
                <Select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value })}>
                  <option value="human">Humans only</option>
                  <option value="bot">Bots only</option>
                  <option value="all">Everyone</option>
                </Select>
              </Field>
              <Field label="Delay" hint="Seconds to wait before assigning (0–3600).">
                <Input
                  type="number"
                  min={0}
                  max={3600}
                  value={form.delaySeconds}
                  onChange={(event) => setForm({ ...form, delaySeconds: event.target.value })}
                />
              </Field>
            </div>
            <div className="form-actions">
              <Button variant="primary" icon={Plus} onClick={add} loading={saving}>Add auto role</Button>
            </div>
          </Card>
        </div>

        <aside className="preview-column">
          <Card title="How assignment works" subtitle="Safety checks before every role" className="sticky-card">
            <div className="checklist">
              <div>
                <UserCheck size={16} />
                <div>
                  <strong>Hierarchy validated</strong>
                  <span>The bot can only assign roles below its highest role.</span>
                </div>
              </div>
              <div>
                <ShieldCheck size={16} />
                <div>
                  <strong>Integration roles skipped</strong>
                  <span>Managed roles cannot be assigned and are logged as failures.</span>
                </div>
              </div>
              <div>
                <AlertTriangle size={16} />
                <div>
                  <strong>Every result logged</strong>
                  <span>Success and failure are written to the audit log with the role ID.</span>
                </div>
              </div>
            </div>
            <div className="inline-note">
              The bot’s role must sit above every auto role. Server owners are never modified automatically.
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
