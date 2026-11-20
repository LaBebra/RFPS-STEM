import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Suite } from '../types';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { RunControl } from '../components/RunControl';
import { StatusBadge } from '../components/StatusBadge';
import { SuiteFormModal } from '../components/SuiteFormModal';
import { EmptyState, PageHeader } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useCan, useDebounced, useDocumentTitle } from '../hooks';
import { useAppStore } from '../store/useAppStore';
import { toast } from '../store/useToastStore';

export default function SuitesPage() {
  useDocumentTitle('Тестові набори');
  const { suites, cases, runs, addSuite, updateSuite, deleteSuite } = useAppStore();
  const canEdit = useCan('edit');
  const canDelete = useCan('delete');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('all');
  const [editing, setEditing] = useState<Suite | undefined>();
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Suite | null>(null);
  const q = useDebounced(query).trim().toLowerCase();

  const allTags = useMemo(() => [...new Set(suites.flatMap((s) => s.tags))].sort(), [suites]);
  const filtered = suites.filter(
    (s) => (tag === 'all' || s.tags.includes(tag)) && (!q || `${s.name} ${s.description}`.toLowerCase().includes(q)),
  );

  const lastStatus = (suiteId: string) => {
    for (const r of runs) {
      if (r.status === 'running') continue;
      const res = r.results.filter((x) => x.suiteId === suiteId);
      if (res.length) return res.some((x) => ['failed', 'error', 'timeout'].includes(x.status)) ? 'failed' : 'passed';
    }
    return null;
  };

  return (
    <>
      <PageHeader
        title="Тестові набори"
        subtitle="Групування тест-кейсів за модулями системи, що тестується"
        actions={
          canEdit && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            >
              <Icon name="plus" /> Новий набір
            </button>
          )
        }
      />

      <div className="filters">
        <label className="search">
          <Icon name="search" />
          <span className="visually-hidden">Пошук наборів</span>
          <input type="search" placeholder="Пошук за назвою або описом" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="inline-field">
          <span>Тег</span>
          <select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">Усі</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <span className="muted filters__count">Знайдено: {filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={suites.length ? 'Нічого не знайдено' : 'Ще немає тестових наборів'}
          text={suites.length ? 'Змініть умови пошуку.' : 'Створіть перший набір, щоб додати тест-кейси.'}
        />
      ) : (
        <div className="suite-grid">
          {filtered.map((s) => {
            const sc = cases.filter((c) => c.suiteId === s.id);
            const status = lastStatus(s.id);
            return (
              <article key={s.id} className="card suite-card">
                <div className="suite-card__head">
                  <h2>
                    <Link to={`/suites/${s.id}`}>{s.name}</Link>
                  </h2>
                  {status && <StatusBadge status={status} />}
                </div>
                <p className="muted suite-card__desc">{s.description || 'Без опису'}</p>
                <div className="tags">
                  {s.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
                <dl className="suite-card__meta">
                  <div>
                    <dt>Тест-кейсів</dt>
                    <dd>{sc.length}</dd>
                  </div>
                  <div>
                    <dt>Активних</dt>
                    <dd>{sc.filter((c) => c.enabled).length}</dd>
                  </div>
                  <div>
                    <dt>Оновлено</dt>
                    <dd>{formatDateTime(s.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="suite-card__actions">
                  <RunControl caseIds={sc.filter((c) => c.enabled).map((c) => c.id)} title={`Прогін: ${s.name}`} scope="suite" compact />
                  <Link className="btn btn--sm" to={`/suites/${s.id}`}>
                    Відкрити
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Редагувати набір ${s.name}`}
                      onClick={() => {
                        setEditing(s);
                        setFormOpen(true);
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className="icon-btn icon-btn--danger" aria-label={`Видалити набір ${s.name}`} onClick={() => setToDelete(s)}>
                      <Icon name="trash" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <SuiteFormModal
        open={formOpen}
        suite={editing}
        existingNames={suites.map((s) => s.name)}
        onClose={() => setFormOpen(false)}
        onSubmit={(data) => {
          if (editing) {
            updateSuite(editing.id, data);
            toast.success('Набір оновлено');
            setFormOpen(false);
          } else {
            const created = addSuite(data);
            toast.success('Набір створено');
            setFormOpen(false);
            navigate(`/suites/${created.id}`);
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(toDelete)}
        danger
        title="Видалити тестовий набір?"
        message={
          <>
            Набір «{toDelete?.name}» і всі його тест-кейси ({cases.filter((c) => c.suiteId === toDelete?.id).length}) буде видалено. Історія прогонів
            збережеться.
          </>
        }
        confirmLabel="Видалити"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) deleteSuite(toDelete.id);
          toast.success('Набір видалено');
          setToDelete(null);
        }}
      />
    </>
  );
}
