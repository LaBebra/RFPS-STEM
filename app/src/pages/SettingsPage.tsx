import { useRef, useState, type ChangeEvent } from 'react';
import type { Settings, ThemeMode } from '../types';
import { Icon } from '../components/Icon';
import { ConfirmDialog } from '../components/Modal';
import { PageHeader } from '../components/ui';
import { ROLE_LABELS } from '../lib/auth';
import { downloadFile, workspaceToJson } from '../lib/export';
import { parseWorkspace } from '../lib/validate';
import { useCan, useDocumentTitle } from '../hooks';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast } from '../store/useToastStore';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Як у системі' },
  { value: 'light', label: 'Світла' },
  { value: 'dark', label: 'Темна' },
];

export default function SettingsPage() {
  useDocumentTitle('Налаштування');
  const store = useAppStore();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useCan('admin');
  const canEdit = useCan('edit');
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const s = store.settings;

  const update = (patch: Partial<Settings>) => {
    store.updateSettings(patch);
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      toast.error('Оберіть файл .json');
      return;
    }
    const result = parseWorkspace(await file.text(), store.settings);
    if (!result.ok) {
      toast.error(`Імпорт неможливий: ${result.error}`);
      return;
    }
    store.importWorkspace(result.data);
    toast.success(`Імпортовано: ${result.data.suites.length} наборів, ${result.data.cases.length} тест-кейсів`);
  };

  const onExport = () => {
    downloadFile(
      `autoqa_workspace_${new Date().toISOString().slice(0, 10)}.json`,
      workspaceToJson({ version: 1, suites: store.suites, cases: store.cases, runs: store.runs, settings: store.settings }),
      'application/json',
    );
    toast.success('Робочий простір експортовано');
  };

  return (
    <>
      <PageHeader title="Налаштування" subtitle="Параметри виконання тестів, інтерфейсу та керування даними" />
      <div className="settings-grid">
        <section className="card">
          <h2>Виконання тестів</h2>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="set-timeout">Тайм-аут за замовчуванням, мс</label>
              <input
                id="set-timeout"
                type="number"
                min={100}
                max={30000}
                step={100}
                value={s.defaultTimeoutMs}
                disabled={!canEdit}
                onChange={(e) => update({ defaultTimeoutMs: Number(e.target.value) })}
              />
              <small className="field__hint">Застосовується до нових тест-кейсів (100-30000 мс)</small>
            </div>
            <div className="field">
              <label htmlFor="set-conc">Паралельних виконавців (Web Worker): {s.concurrency}</label>
              <input id="set-conc" type="range" min={1} max={4} value={s.concurrency} disabled={!canEdit} onChange={(e) => update({ concurrency: Number(e.target.value) })} />
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.stopOnFirstFailure} disabled={!canEdit} onChange={(e) => update({ stopOnFirstFailure: e.target.checked })} />
              <span className="switch__track" aria-hidden="true" />
              Зупиняти прогін після першої невдачі
            </label>
            <div className="field">
              <label htmlFor="set-hist">Зберігати прогонів у журналі</label>
              <select id="set-hist" value={s.historyLimit} disabled={!canEdit} onChange={(e) => update({ historyLimit: Number(e.target.value) })}>
                {[25, 50, 100, 200, 500].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card">
          <h2>Інтерфейс</h2>
          <fieldset className="radio-group">
            <legend>Тема оформлення</legend>
            {THEMES.map((t) => (
              <label key={t.value} className="radio">
                <input type="radio" name="theme" value={t.value} checked={s.theme === t.value} onChange={() => update({ theme: t.value })} />
                {t.label}
              </label>
            ))}
          </fieldset>
          <h2 className="mt">Обліковий запис</h2>
          <dl className="kv">
            <dt>Користувач</dt>
            <dd>{user?.name}</dd>
            <dt>Логін</dt>
            <dd>{user?.username}</dd>
            <dt>Роль</dt>
            <dd>{user ? ROLE_LABELS[user.role] : '-'}</dd>
          </dl>
        </section>

        <section className="card">
          <h2>Дані робочого простору</h2>
          <p className="muted">
            Дані зберігаються локально у браузері. Експорт дозволяє перенести тест-кейси на інший пристрій або передати команді.
          </p>
          <div className="stack">
            <button type="button" className="btn" onClick={onExport}>
              <Icon name="download" /> Експортувати JSON
            </button>
            <button type="button" className="btn" disabled={!isAdmin} onClick={() => fileRef.current?.click()} title={isAdmin ? undefined : 'Доступно адміністратору'}>
              <Icon name="upload" /> Імпортувати JSON
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
            <button type="button" className="btn btn--danger" disabled={!isAdmin} onClick={() => setConfirmReset(true)}>
              <Icon name="refresh" /> Скинути до демо-даних
            </button>
          </div>
          {!isAdmin && <p className="muted small">Імпорт і скидання даних доступні лише адміністратору.</p>}
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        danger
        title="Скинути робочий простір?"
        message="Усі набори, тест-кейси та історію буде замінено демонстраційними даними."
        confirmLabel="Скинути"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          store.resetDemo();
          setConfirmReset(false);
          toast.success('Демо-дані відновлено');
        }}
      />
    </>
  );
}
