import { forwardRef, useEffect } from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { classNames } from '../hooks.js';

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading = false, className, children, ...props }) {
  return (
    <button
      type="button"
      className={classNames('btn', `btn-${variant}`, `btn-${size}`, className)}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

export function Card({ title, subtitle, badge, actions, children, className, flush = false }) {
  return (
    <section className={classNames('card', className)}>
      {(title || actions || badge) && (
        <header className="card-header">
          <div className="card-heading">
            <div className="card-title-row">
              <h3>{title}</h3>
              {badge}
            </div>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="card-actions">{actions}</div> : null}
        </header>
      )}
      <div className={classNames('card-body', flush && 'card-body-flush')}>{children}</div>
    </section>
  );
}

export function Badge({ tone = 'neutral', dot = false, children }) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={classNames('toggle', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb" />
    </button>
  );
  if (!label) return control;
  return (
    <div className={classNames('toggle-row', disabled && 'is-disabled')}>
      <div>
        <span className="toggle-label">{label}</span>
        {description ? <span className="toggle-desc">{description}</span> : null}
      </div>
      {control}
    </div>
  );
}

export function Field({ label, hint, error, children, className, action }) {
  return (
    <label className={classNames('field', className, error && 'has-error')}>
      {label ? (
        <span className="field-label-row">
          <span className="field-label">{label}</span>
          {action}
        </span>
      ) : null}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }) {
  return <input className={classNames('input', className)} {...props} />;
}

export const TextArea = forwardRef(function TextArea({ className, rows = 5, ...props }, ref) {
  return <textarea ref={ref} className={classNames('input textarea', className)} rows={rows} {...props} />;
});

export function Select({ className, children, ...props }) {
  return (
    <span className="select-wrap">
      <select className={classNames('input select', className)} {...props}>
        {children}
      </select>
      <ChevronDown size={15} className="select-caret" />
    </span>
  );
}

export function Segmented({ options, value, onChange, size = 'md' }) {
  return (
    <div className={classNames('segmented', `segmented-${size}`)} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={classNames('segmented-item', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <option.icon size={14} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs({ options, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={classNames('tab', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ColorInput({ value, onChange, className }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#5865F2';
  return (
    <div className={classNames('color-input', className)}>
      <input type="color" value={safe} onChange={(event) => onChange(event.target.value.toUpperCase())} />
      <input
        className="input"
        value={value || ''}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        maxLength={7}
        spellCheck={false}
      />
    </div>
  );
}

export function RangeInput({ label, value, min, max, step = 1, onChange, suffix = 'px' }) {
  return (
    <div className="range-field">
      <div className="range-head">
        <span>{label}</span>
        <span className="range-value">
          {step < 1 ? Number(value || 0).toFixed(2) : Math.round(Number(value) || 0)}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <span className="page-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-icon">
          <Icon size={22} />
        </span>
      ) : null}
      <h4>{title}</h4>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const handle = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={classNames('modal', `modal-${size}`)} role="dialog" aria-modal="true">
        <header className="modal-header">
          <div>
            <h3>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = true, loading = false }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={message}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={classNames('confirm-note', danger ? 'is-danger' : '')}>
        {danger ? 'This action cannot be undone.' : 'This change is applied immediately.'}
      </div>
    </Modal>
  );
}

export function Skeleton({ height = 16, width = '100%', className }) {
  return <span className={classNames('skeleton', className)} style={{ height, width }} />;
}

export function LoadingBlock({ rows = 4 }) {
  return (
    <div className="loading-block">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} height={14} width={`${90 - index * 12}%`} />
      ))}
    </div>
  );
}

export function StyleGrid({ styles, value, onChange }) {
  return (
    <div className="style-grid">
      {styles.map((style) => (
        <button
          key={style.id}
          type="button"
          className={classNames('style-card', value === style.id && 'is-active')}
          onClick={() => onChange(style.id)}
        >
          <span className="style-swatch" style={{ background: `linear-gradient(135deg, ${style.accent}, ${style.accent}55)` }} />
          <span className="style-name">{style.name}</span>
          <span className="style-desc">{style.description}</span>
        </button>
      ))}
    </div>
  );
}

export function ChannelSelect({ channels, online, value, onChange, allowNone = true }) {
  if (!online) {
    return (
      <div className="manual-id">
        <Input
          value={value || ''}
          onChange={(event) => onChange(event.target.value.trim() || null)}
          placeholder="Channel ID (e.g. 123456789012345678)"
          inputMode="numeric"
        />
        <span className="field-hint">Bot offline — enter a channel ID manually.</span>
      </div>
    );
  }
  const categories = channels.filter((channel) => channel.type === 4);
  const selectable = channels.filter((channel) => channel.type !== 4);
  return (
    <Select value={value || ''} onChange={(event) => onChange(event.target.value || null)}>
      {allowNone ? <option value="">No channel</option> : null}
      {value && !selectable.some((channel) => channel.id === value) ? <option value={value}>Unknown channel ({value})</option> : null}
      {categories.map((category) => (
        <optgroup key={category.id} label={category.name}>
          {selectable
            .filter((channel) => channel.parentId === category.id)
            .map((channel) => (
              <option key={channel.id} value={channel.id}>
                # {channel.name}
              </option>
            ))}
        </optgroup>
      ))}
      <optgroup label="Uncategorised">
        {selectable
          .filter((channel) => !channel.parentId)
          .map((channel) => (
            <option key={channel.id} value={channel.id}>
              # {channel.name}
            </option>
          ))}
      </optgroup>
    </Select>
  );
}

export function RoleSelect({ roles, online, value, onChange, allowNone = true }) {
  if (!online) {
    return (
      <div className="manual-id">
        <Input
          value={value || ''}
          onChange={(event) => onChange(event.target.value.trim() || null)}
          placeholder="Role ID (e.g. 123456789012345678)"
          inputMode="numeric"
        />
        <span className="field-hint">Bot offline — enter a role ID manually.</span>
      </div>
    );
  }
  return (
    <Select value={value || ''} onChange={(event) => onChange(event.target.value || null)}>
      {allowNone ? <option value="">Select a role</option> : null}
      {value && !roles.some((role) => role.id === value) ? <option value={value}>Unknown role ({value})</option> : null}
      {roles.map((role) => (
        <option key={role.id} value={role.id} disabled={role.isEveryone || (!role.assignable && !role.isEveryone)}>
          @{role.name}
          {role.assignable === false ? ' (above bot)' : ''}
        </option>
      ))}
    </Select>
  );
}

export function PlaceholderChips({ placeholders, onPick }) {
  return (
    <div className="placeholder-chips">
      {placeholders.map((placeholder) => (
        <button
          key={placeholder.token}
          type="button"
          className="placeholder-chip"
          onClick={() => onPick(placeholder.token)}
          title={`${placeholder.label} — e.g. ${placeholder.example}`}
        >
          {placeholder.token}
        </button>
      ))}
    </div>
  );
}
