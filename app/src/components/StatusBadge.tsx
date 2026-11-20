import type { ResultStatus, RunStatus } from '../types';
import { RESULT_LABELS, RUN_LABELS } from '../lib/format';
import { Icon, type IconName } from './Icon';

const ICONS: Record<ResultStatus | RunStatus, IconName> = {
  queued: 'clock',
  running: 'spinner',
  passed: 'check',
  failed: 'x',
  error: 'alert',
  timeout: 'clock',
  skipped: 'skip',
  cancelled: 'minus',
};

/** Бейдж статусу: колір завжди доповнений іконкою та текстом (не лише колір). */
export function StatusBadge({ status, kind = 'result' }: { status: ResultStatus | RunStatus; kind?: 'result' | 'run' }) {
  const label = kind === 'run' ? RUN_LABELS[status as RunStatus] : RESULT_LABELS[status as ResultStatus];
  return (
    <span className={`badge badge--${status}`} data-status={status}>
      <Icon name={ICONS[status]} size={14} className={status === 'running' ? 'spin' : undefined} />
      {label}
    </span>
  );
}
