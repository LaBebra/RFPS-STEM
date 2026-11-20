import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RunStatus } from '../types';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState, PageHeader } from '../components/ui';
import { formatDateTime, formatDuration, RUN_LABELS } from '../lib/format';
import { filterRuns, sortRuns, summarize, type SortKey } from '../lib/stats';
import { useCan, useDebounced, useDocumentTitle } from '../hooks';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

const PAGE_SIZE = 10;

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'startedAt', label: 'Дата' },
  { key: 'passRate', label: 'Успішність' },
  { key: 'durationMs', label: 'Тривалість' },
  { key: 'total', label: 'Кількість тестів' },
];

export default function RunsPage() {
  useDocumentTitle('Журнал прогонів');
  const { runs, suites, clearRuns } = useAppStore();
  const canDelete = useCan('delete');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const [suiteId, setSuiteId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('startedAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const q = useDebounced(query);

  const filtered = useMemo(
    () => sortRuns(filterRuns(runs, { query: q, status, suiteId, from, to }), sort, dir),
    [runs, q, status, suiteId, from, to, sort, dir],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [q, status, suiteId, from, to, sort, dir]);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = q || status !== 'all' || suiteId !== 'all' || from || to;

  const reset = () => {
    setQuery('');
    setStatus('all');
    setSuiteId('all');
    setFrom('');
    setTo('');
  };

  return (
    <>
      <PageHeader
        title="Журнал прогонів"
        subtitle="Історія запусків з результатами, тривалістю та середовищем виконання"
        actions={
          canDelete &&
          runs.length > 0 && (
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmClear(true)}>
              <Icon name="trash" /> Очистити історію
            </button>
          )
        }
      />

      <div className="filters filters--wrap" role="search">
        <label className="search">
          <Icon name="search" />
          <span className="visually-hidden">Пошук у журналі</span>
          <input type="search" placeholder="Назва, користувач, тест-кейс" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="inline-field">
          <span>Статус</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as RunStatus | 'all')}>
            <option value="all">Усі</option>
            {(Object.keys(RUN_LABELS) as RunStatus[]).map((s) => (
              <option key={s} value={s}>
                {RUN_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Набір</span>
          <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
            <option value="all">Усі</option>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>З</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="inline-field">
          <span>По</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="inline-field">
          <span>Сортування</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn--sm" onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} aria-label={`Напрямок сортування: ${dir === 'asc' ? 'за зростанням' : 'за спаданням'}`}>
          {dir === 'asc' ? '↑ Зрост.' : '↓ Спад.'}
        </button>
        {hasFilters && (
          <button type="button" className="link-btn" onClick={reset}>
            Скинути фільтри
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="runs" title={runs.length ? 'Немає прогонів за фільтром' : 'Журнал порожній'} text={runs.length ? 'Змініть параметри фільтрації.' : 'Запустіть тести з дашборду або сторінки набору.'} />
      ) : (
        <>
          <div className="card card--flush">
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="visually-hidden">Журнал прогонів, знайдено {filtered.length}</caption>
                <thead>
                  <tr>
                    <th scope="col">Прогін</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Пройдено</th>
                    <th scope="col">Невдалі</th>
                    <th scope="col">Тривалість</th>
                    <th scope="col">Користувач</th>
                    <th scope="col">Середовище</th>
                    <th scope="col">Запущено</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const s = summarize(r.results);
                    return (
                      <tr key={r.id}>
                        <td data-label="Прогін">
                          <Link to={`/runs/${r.id}`}>{r.title}</Link>
                        </td>
                        <td data-label="Статус">
                          <StatusBadge status={r.status} kind="run" />
                        </td>
                        <td data-label="Пройдено">
                          <div className="mini-bar" aria-hidden="true">
                            <span style={{ width: `${s.passRate}%` }} />
                          </div>
                          {s.passed}/{s.total} · {s.passRate}%
                        </td>
                        <td data-label="Невдалі">{s.failed + s.error + s.timeout}</td>
                        <td data-label="Тривалість">{formatDuration(s.durationMs)}</td>
                        <td data-label="Користувач">{r.triggeredBy}</td>
                        <td data-label="Середовище">{r.environment}</td>
                        <td data-label="Запущено">{formatDateTime(r.startedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <nav className="pagination" aria-label="Сторінки журналу">
            <button type="button" className="btn btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Назад
            </button>
            <span>
              Сторінка {page} з {pages} · всього {filtered.length}
            </span>
            <button type="button" className="btn btn--sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Далі
            </button>
          </nav>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        danger
        title="Очистити історію прогонів?"
        message={`Буде видалено ${runs.filter((r) => r.status !== 'running').length} завершених прогонів. Дію неможливо скасувати.`}
        confirmLabel="Очистити"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearRuns();
          setConfirmClear(false);
          toast.success('Історію очищено');
        }}
      />
    </>
  );
}
