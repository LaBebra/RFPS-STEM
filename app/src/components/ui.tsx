import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function EmptyState({ icon = 'suites', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={28} />
      </div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function KpiCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className={`kpi${tone ? ` kpi--${tone}` : ''}`}>
      <div className="kpi__label">{label}</div>
      <div className="kpi__value">{value}</div>
      {hint && <div className="kpi__hint">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {back}
        <h1>{title}</h1>
        {subtitle && <p className="page-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
  required,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <small className="field__hint" id={`${id}-hint`}>
          {hint}
        </small>
      )}
      {error && (
        <small className="field__error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </div>
  );
}

export function Loader() {
  return (
    <div className="loader" role="status">
      <span className="spinner-ring" aria-hidden="true" /> Завантаження...
    </div>
  );
}
