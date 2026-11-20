import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Priority, ResultStatus, TestCase } from '../types';
import { CaseFormModal } from '../components/CaseFormModal';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { RunControl } from '../components/RunControl';
import { StatusBadge } from '../components/StatusBadge';
import { SuiteFormModal } from '../components/SuiteFormModal';
import { EmptyState, PageHeader } from '../components/ui';
import { PRIORITY_LABELS, PRIORITY_ORDER } from '../lib/format';
import { useCan, useDebounced, useDocumentTitle } from '../hooks';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { launchRun } from '../store/runActions';
import { toast } from '../store/useToastStore';

type LastFilter = 'all' | 'passed' | 'failing' | 'never';

export default function SuiteDetailPage() {
  const { suiteId } = useParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const user = useAuthStore((s) => s.user);
  const suite = store.suites.find((s) => s.id === suiteId);
  useDocumentTitle(suite?.name ?? 'Набір не знайдено');
  const canEdit = useCan('edit');
  const canDelete = useCan('delete');
  const canRun = useCan('run');

  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [last, setLast] = useState<LastFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [caseModal, setCaseModal] = useState<{ open: boolean; tc?: TestCase }>({ open: false });
  const [suiteModal, setSuiteModal] = useState(false);
  const [toDelete, setToDelete] = useState<TestCase | null>(null);
  const q = useDebounced(query).trim().toLowerCase();

  const cases = useMemo(() => store.cases.filter((c) => c.suiteId === suiteId), [store.cases, suiteId]);

  /** Останній статус кожного тест-кейсу за журналом прогонів. */
  const lastResults = useMemo(() => {
    const map = new Map<string, ResultStatus>();
    for (const r of store.runs) {
      if (r.status === 'running') continue;
      for (const x of r.results) if (!map.has(x.caseId) && !['skipped', 'cancelled'].includes(x.status)) map.set(x.caseId, x.status);
    }
    return map;
  }, [store.runs]);

  const filtered = cases
    .filter((c) => priority === 'all' || c.priority === priority)
    .filter((c) => {
      const st = lastResults.get(c.id);
      if (last === 'all') return true;
      if (last === 'never') return !st;
      if (last === 'passed') return st === 'passed';
      return st && st !== 'passed';
    })
    .filter((c) => !q || `${c.title} ${c.description} ${c.tags.join(' ')}`.toLowerCase().includes(q))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));

  if (!suite) {
    return <EmptyState title="Набір не знайдено" text="Можливо, його було видалено." action={<Link to="/suites" className="btn">До списку наборів</Link>} />;
  }

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const runSelected = () => {
    const ids = cases.filter((c) => selected.has(c.id)).map((c) => c.id);
    const { runId } = launchRun({ caseIds: ids, title: `Вибрані тести: ${suite.name}`, scope: 'selection', triggeredBy: user?.username ?? 'unknown' });
    toast.info(`Запущено ${ids.length} тест-кейсів`);
    navigate(`/runs/${runId}`);
  };

  return (
    <>
      <PageHeader
        back={
          <Link to="/suites" className="back-link">
            <Icon name="back" size={16} /> Тестові набори
          </Link>
        }
        title={suite.name}
        subtitle={suite.description}
        actions={
          <>
            {canEdit && (
              <button type="button" className="btn" onClick={() => setSuiteModal(true)}>
                <Icon name="edit" /> Налаштувати набір
              </button>
            )}
            <RunControl caseIds={cases.filter((c) => c.enabled).map((c) => c.id)} title={`Прогін: ${suite.name}`} scope="suite" label="Запустити набір" />
          </>
        }
      />

      <div className="filters">
        <label className="search">
          <Icon name="search" />
          <span className="visually-hidden">Пошук тест-кейсів</span>
          <input type="search" placeholder="Пошук тест-кейсів" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="inline-field">
          <span>Пріоритет</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority | 'all')}>
            <option value="all">Усі</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          <span>Останній результат</span>
          <select value={last} onChange={(e) => setLast(e.target.value as LastFilter)}>
            <option value="all">Будь-який</option>
            <option value="passed">Пройдено</option>
            <option value="failing">Невдалі</option>
            <option value="never">Не запускались</option>
          </select>
        </label>
        <div className="filters__right">
          {canRun && selected.size > 0 && (
            <button type="button" className="btn btn--primary" onClick={runSelected}>
              <Icon name="play" size={16} /> Запустити вибрані ({selected.size})
            </button>
          )}
          {canEdit && (
            <button type="button" className="btn" onClick={() => setCaseModal({ open: true })}>
              <Icon name="plus" /> Тест-кейс
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={cases.length ? 'Немає тест-кейсів за фільтром' : 'У наборі ще немає тест-кейсів'}
          text={cases.length ? 'Змініть параметри фільтрації.' : 'Додайте перший тест-кейс із перевірками expect().'}
          action={
            canEdit && !cases.length ? (
              <button type="button" className="btn btn--primary" onClick={() => setCaseModal({ open: true })}>
                <Icon name="plus" /> Додати тест-кейс
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="card card--flush">
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th scope="col" className="col-check">
                    <input
                      type="checkbox"
                      aria-label="Вибрати всі"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(filtered.map((c) => c.id)))}
                    />
                  </th>
                  <th scope="col">Тест-кейс</th>
                  <th scope="col">Пріоритет</th>
                  <th scope="col">Останній результат</th>
                  <th scope="col">Активний</th>
                  <th scope="col" className="col-actions">
                    Дії
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const st = lastResults.get(c.id);
                  return (
                    <tr key={c.id} className={c.enabled ? '' : 'is-disabled'}>
                      <td className="col-check" data-label="Вибір">
                        <input type="checkbox" aria-label={`Вибрати ${c.title}`} checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                      </td>
                      <td data-label="Тест-кейс">
                        <button type="button" className="link-btn case-title" onClick={() => setCaseModal({ open: true, tc: c })}>
                          {c.title}
                        </button>
                        {c.description && <small className="muted block">{c.description}</small>}
                        <span className="tags">
                          {c.tags.map((t) => (
                            <span key={t} className="tag">
                              {t}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td data-label="Пріоритет">
                        <span className={`priority priority--${c.priority}`}>{PRIORITY_LABELS[c.priority]}</span>
                      </td>
                      <td data-label="Останній результат">{st ? <StatusBadge status={st} /> : <span className="muted">не запускався</span>}</td>
                      <td data-label="Активний">
                        <label className="switch switch--sm">
                          <input
                            type="checkbox"
                            checked={c.enabled}
                            disabled={!canEdit}
                            onChange={() => store.toggleCase(c.id)}
                            aria-label={`${c.enabled ? 'Вимкнути' : 'Увімкнути'} ${c.title}`}
                          />
                          <span className="switch__track" aria-hidden="true" />
                        </label>
                      </td>
                      <td className="col-actions" data-label="Дії">
                        <div className="row-actions">
                          <RunControl caseIds={c.enabled ? [c.id] : []} title={c.title} scope="case" label="" compact />
                          {canEdit && (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`Копіювати ${c.title}`}
                              title="Дублювати"
                              onClick={() => {
                                store.duplicateCase(c.id);
                                toast.success('Тест-кейс скопійовано');
                              }}
                            >
                              <Icon name="copy" />
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" className="icon-btn icon-btn--danger" aria-label={`Видалити ${c.title}`} title="Видалити" onClick={() => setToDelete(c)}>
                              <Icon name="trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CaseFormModal
        open={caseModal.open}
        testCase={caseModal.tc}
        setupCode={suite.setupCode}
        defaultTimeoutMs={store.settings.defaultTimeoutMs}
        onClose={() => setCaseModal({ open: false })}
        onSubmit={(data) => {
          if (!canEdit) {
            toast.error('Недостатньо прав для редагування');
            return;
          }
          if (caseModal.tc) {
            store.updateCase(caseModal.tc.id, data);
            toast.success('Тест-кейс збережено');
          } else {
            store.addCase({ ...data, suiteId: suite.id });
            toast.success('Тест-кейс створено');
          }
          setCaseModal({ open: false });
        }}
      />
      <SuiteFormModal
        open={suiteModal}
        suite={suite}
        existingNames={store.suites.map((s) => s.name)}
        onClose={() => setSuiteModal(false)}
        onSubmit={(data) => {
          store.updateSuite(suite.id, data);
          toast.success('Набір оновлено');
          setSuiteModal(false);
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title="Видалити тест-кейс?"
        message={`Тест-кейс «${toDelete?.title}» буде видалено без можливості відновлення.`}
        confirmLabel="Видалити"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            store.deleteCase(toDelete.id);
            setSelected((s) => {
              const n = new Set(s);
              n.delete(toDelete.id);
              return n;
            });
          }
          toast.success('Тест-кейс видалено');
          setToDelete(null);
        }}
      />
    </>
  );
}
