import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { RunScope } from '../types';
import { useCan } from '../hooks';
import { cancelRun, launchRun } from '../store/runActions';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';
import { Icon } from './Icon';

/**
 * Стани елемента керування прогоном (див. діаграму станів у документації):
 * disabled -> немає прав або тестів; idle -> готовий до запуску;
 * running -> виконується (кнопка стає "Зупинити"); cancelling -> очікує зупинки воркерів;
 * passed / failed / cancelled -> показ результату 4 с, потім повернення в idle.
 */
export type RunControlState = 'disabled' | 'idle' | 'running' | 'cancelling' | 'passed' | 'failed' | 'cancelled';

interface Props {
  caseIds: string[];
  title: string;
  scope: RunScope;
  label?: string;
  navigateOnStart?: boolean;
  compact?: boolean;
}

export function RunControl({ caseIds, title, scope, label = 'Запустити', navigateOnStart, compact }: Props) {
  const allowed = useCan('run');
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [runId, setRunId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const run = useAppStore((s) => (runId ? s.runs.find((r) => r.id === runId) : undefined));

  const finished = run ? run.results.filter((r) => r.status !== 'queued' && r.status !== 'running').length : 0;

  let state: RunControlState = 'idle';
  if (!allowed || caseIds.length === 0) state = 'disabled';
  else if (run?.status === 'running') state = cancelling ? 'cancelling' : 'running';
  else if (run && showResult) state = run.status;

  useEffect(() => {
    if (run && run.status !== 'running') {
      setCancelling(false);
      setShowResult(true);
      const t = setTimeout(() => setShowResult(false), 4000);
      return () => clearTimeout(t);
    }
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    try {
      const { runId: id } = launchRun({ caseIds, title, scope, triggeredBy: user?.username ?? 'unknown' });
      setRunId(id);
      setShowResult(false);
      toast.info(`Прогін «${title}» запущено`);
      if (navigateOnStart) navigate(`/runs/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не вдалося запустити прогін');
    }
  };

  const stop = () => {
    if (runId && cancelRun(runId)) setCancelling(true);
  };

  const content: Record<RunControlState, { icon: 'play' | 'stop' | 'spinner' | 'check' | 'x' | 'minus'; text: string; cls: string }> = {
    disabled: { icon: 'play', text: label, cls: 'btn--primary' },
    idle: { icon: 'play', text: label, cls: 'btn--primary' },
    running: { icon: 'stop', text: `Зупинити (${finished}/${run?.results.length ?? 0})`, cls: 'btn--warning' },
    cancelling: { icon: 'spinner', text: 'Зупинення...', cls: 'btn--warning' },
    passed: { icon: 'check', text: 'Успішно', cls: 'btn--success' },
    failed: { icon: 'x', text: 'Є помилки', cls: 'btn--danger' },
    cancelled: { icon: 'minus', text: 'Скасовано', cls: '' },
  };
  const c = content[state];
  const onClick = state === 'idle' || state === 'passed' || state === 'failed' || state === 'cancelled' ? start : state === 'running' ? stop : undefined;

  return (
    <span className="run-control" data-state={state}>
      <button
        type="button"
        className={`btn ${c.cls}${compact ? ' btn--sm' : ''}`}
        onClick={onClick}
        disabled={state === 'disabled' || state === 'cancelling'}
        aria-busy={state === 'running' || state === 'cancelling'}
        aria-label={c.text.trim() ? undefined : `Запустити: ${title}`}
        title={!allowed ? 'Недостатньо прав для запуску' : caseIds.length === 0 ? 'Немає тест-кейсів для запуску' : undefined}
      >
        <Icon name={c.icon} size={16} className={c.icon === 'spinner' ? 'spin' : undefined} />
        {c.text}
      </button>
      {run && (state === 'running' || showResult) && !compact && (
        <Link className="link-sm" to={`/runs/${run.id}`}>
          Деталі прогону
        </Link>
      )}
    </span>
  );
}
