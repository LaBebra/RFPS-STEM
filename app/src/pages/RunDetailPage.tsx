import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ResultStatus } from '../types';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, KpiCard, PageHeader, ProgressBar } from '../components/ui';
import { downloadFile, runToCsv, runToHtml, runToJson, safeFileName } from '../lib/export';
import { formatDateTime, formatDuration, PRIORITY_LABELS, RESULT_LABELS } from '../lib/format';
import { summarize } from '../lib/stats';
import { useCan, useDocumentTitle } from '../hooks';
import { cancelRun, isRunActive, launchRun } from '../store/runActions';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';

type Tab = 'all' | 'failing' | ResultStatus;

const BAD: ResultStatus[] = ['failed', 'error', 'timeout'];

export default function RunDetailPage() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const run = useAppStore((s) => s.runs.find((r) => r.id === runId));
  const cases = useAppStore((s) => s.cases);
  const deleteRun = useAppStore((s) => s.deleteRun);
  const user = useAuthStore((s) => s.user);
  const canRun = useCan('run');
  const canDelete = useCan('delete');
  const [tab, setTab] = useState<Tab>('all');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  useDocumentTitle(run ? run.title : 'Прогін не знайдено');

  if (!run) {
    return <EmptyState icon="runs" title="Прогін не знайдено" text="Можливо, його видалено з журналу." action={<Link to="/runs" className="btn">До журналу</Link>} />;
  }

  const s = summarize(run.results);
  const running = run.status === 'running';
  const rows = run.results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => tab === 'all' || (tab === 'failing' ? BAD.includes(r.status) : r.status === tab));
  const failingIds = run.results.filter((r) => BAD.includes(r.status)).map((r) => r.caseId);
  const existing = (ids: string[]) => ids.filter((id) => cases.some((c) => c.id === id));

  const rerun = (ids: string[], title: string) => {
    const valid = existing(ids);
    if (!valid.length) {
      toast.error('Тест-кейси цього прогону більше не існують');
      return;
    }
    const { runId: id } = launchRun({ caseIds: valid, title, scope: 'rerun', triggeredBy: user?.username ?? 'unknown' });
    toast.info('Повторний прогін запущено');
    navigate(`/runs/${id}`);
  };

  const exportAs = (kind: 'json' | 'csv' | 'html') => {
    const base = `autoqa_${safeFileName(run.title)}_${run.startedAt.slice(0, 10)}`;
    if (kind === 'json') downloadFile(`${base}.json`, runToJson(run), 'application/json');
    if (kind === 'csv') downloadFile(`${base}.csv`, runToCsv(run), 'text/csv');
    if (kind === 'html') downloadFile(`${base}.html`, runToHtml(run), 'text/html');
    toast.success(`Звіт ${kind.toUpperCase()} збережено`);
  };

  const toggle = (i: number) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'Усі', count: s.total },
    { key: 'failing', label: 'Невдалі', count: s.failed + s.error + s.timeout },
    { key: 'passed', label: 'Пройдені', count: s.passed },
    { key: 'skipped', label: 'Пропущені', count: s.skipped },
  ];

  return (
    <>
      <PageHeader
        back={
          <Link to="/runs" className="back-link">
            <Icon name="back" size={16} /> Журнал прогонів
          </Link>
        }
        title={run.title}
        subtitle={
          <>
            <StatusBadge status={run.status} kind="run" /> <span className="muted">Запущено {formatDateTime(run.startedAt)} · {run.triggeredBy} · {run.environment}</span>
          </>
        }
        actions={
          running ? (
            isRunActive(run.id) &&
            canRun && (
              <button type="button" className="btn btn--warning" onClick={() => cancelRun(run.id)}>
                <Icon name="stop" size={16} /> Зупинити прогін
              </button>
            )
          ) : (
            <>
              <div className="btn-group" role="group" aria-label="Експорт звіту">
                <button type="button" className="btn" onClick={() => exportAs('html')}>
                  <Icon name="download" /> HTML
                </button>
                <button type="button" className="btn" onClick={() => exportAs('csv')}>
                  CSV
                </button>
                <button type="button" className="btn" onClick={() => exportAs('json')}>
                  JSON
                </button>
              </div>
              {canRun && failingIds.length > 0 && (
                <button type="button" className="btn btn--primary" onClick={() => rerun(failingIds, `Перезапуск невдалих: ${run.title}`)}>
                  <Icon name="refresh" /> Перезапустити невдалі ({failingIds.length})
                </button>
              )}
              {canRun && failingIds.length === 0 && (
                <button type="button" className="btn btn--primary" onClick={() => rerun(run.results.map((r) => r.caseId), run.title)}>
                  <Icon name="refresh" /> Повторити
                </button>
              )}
              {canDelete && (
                <button type="button" className="icon-btn icon-btn--danger" aria-label="Видалити прогін" onClick={() => setConfirmDelete(true)}>
                  <Icon name="trash" />
                </button>
              )}
            </>
          )
        }
      />

      {running && (
        <div className="card run-progress" aria-live="polite">
          <div className="run-progress__head">
            <b>
              Виконано {s.finished} з {s.total}
            </b>
            <span className="muted">Тести виконуються в ізольованих Web Worker</span>
          </div>
          <ProgressBar value={s.finished} max={s.total} label="Прогрес прогону" />
        </div>
      )}

      <section className="kpi-grid" aria-label="Підсумки прогону">
        <KpiCard label="Успішність" value={`${s.passRate}%`} tone={running ? undefined : s.passRate >= 90 ? 'good' : 'bad'} />
        <KpiCard label="Пройдено" value={s.passed} hint={`з ${s.total}`} />
        <KpiCard label="Провалено / помилки" value={`${s.failed} / ${s.error}`} />
        <KpiCard label="Тайм-аути" value={s.timeout} />
        <KpiCard label="Тривалість" value={formatDuration(s.durationMs)} hint={run.finishedAt ? `завершено ${formatDateTime(run.finishedAt)}` : 'у процесі'} />
      </section>

      <div className="tabs" role="tablist" aria-label="Фільтр результатів">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
            {t.label} <span className="tabs__count">{t.count}</span>
          </button>
        ))}
      </div>

      <div className="card card--flush" role="tabpanel">
        {rows.length === 0 ? (
          <p className="muted pad">Немає результатів у цій категорії.</p>
        ) : (
          <ul className="results">
            {rows.map(({ r, i }) => {
              const expandable = Boolean(r.error || r.logs.length);
              const isOpen = open.has(i);
              return (
                <li key={i} className={`result result--${r.status}`}>
                  <button type="button" className="result__row" onClick={() => expandable && toggle(i)} aria-expanded={expandable ? isOpen : undefined} disabled={!expandable}>
                    <StatusBadge status={r.status} />
                    <span className="result__title">
                      <b>{r.caseTitle}</b>
                      <small className="muted">
                        {r.suiteName} · {PRIORITY_LABELS[r.priority]} · перевірок: {r.assertions}
                      </small>
                    </span>
                    <span className="result__time">{formatDuration(r.durationMs)}</span>
                    {expandable && <Icon name="back" size={16} className={`chevron${isOpen ? ' is-open' : ''}`} />}
                  </button>
                  {isOpen && (
                    <div className="result__details">
                      {r.error && (
                        <>
                          <h3>{RESULT_LABELS[r.status]}: деталі</h3>
                          <pre className="error-box">{r.error}</pre>
                        </>
                      )}
                      {r.logs.length > 0 && (
                        <>
                          <h3>Консоль</h3>
                          <pre className="log-box">{r.logs.join('\n')}</pre>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Видалити прогін?"
        message="Запис буде видалено з журналу та статистики."
        confirmLabel="Видалити"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteRun(run.id);
          toast.success('Прогін видалено');
          navigate('/runs');
        }}
      />
    </>
  );
}
