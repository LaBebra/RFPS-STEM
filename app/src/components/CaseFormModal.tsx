import { useEffect, useState, type FormEvent } from 'react';
import type { Priority, TestCase } from '../types';
import { formatDuration, PRIORITY_LABELS, PRIORITY_ORDER } from '../lib/format';
import { workerExecutor, type ExecResult } from '../lib/runner';
import { hasErrors, LIMITS, parseTags, validateCase, type CaseForm, type Errors } from '../lib/validate';
import { CodeEditor } from './CodeEditor';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { Field } from './ui';

interface Props {
  open: boolean;
  testCase?: TestCase;
  setupCode: string;
  defaultTimeoutMs: number;
  onClose: () => void;
  onSubmit: (data: Omit<TestCase, 'id' | 'suiteId' | 'createdAt' | 'updatedAt'>) => void;
}

const TEMPLATE = `// Тіло тесту. Доступні функції з коду підготовки набору та expect().
const result = 2 + 2;
expect(result).toBe(4);
`;

export function CaseFormModal({ open, testCase, setupCode, defaultTimeoutMs, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<CaseForm>({
    title: '',
    description: '',
    priority: 'medium',
    code: TEMPLATE,
    timeoutMs: String(defaultTimeoutMs),
    tags: '',
    enabled: true,
  });
  const [errors, setErrors] = useState<Errors<CaseForm>>({});
  const [trial, setTrial] = useState<ExecResult | 'running' | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTrial(null);
    setForm(
      testCase
        ? {
            title: testCase.title,
            description: testCase.description,
            priority: testCase.priority,
            code: testCase.code,
            timeoutMs: String(testCase.timeoutMs),
            tags: testCase.tags.join(', '),
            enabled: testCase.enabled,
          }
        : { title: '', description: '', priority: 'medium', code: TEMPLATE, timeoutMs: String(defaultTimeoutMs), tags: '', enabled: true },
    );
  }, [open, testCase, defaultTimeoutMs]);

  const set = <K extends keyof CaseForm>(k: K, v: CaseForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateCase(form);
    setErrors(errs);
    if (hasErrors(errs)) return;
    onSubmit({
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      code: form.code,
      timeoutMs: Number(form.timeoutMs),
      tags: parseTags(form.tags),
      enabled: form.enabled,
    });
  };

  const tryRun = async () => {
    setTrial('running');
    const timeout = Number(form.timeoutMs);
    const res = await workerExecutor({
      code: form.code,
      setupCode,
      timeoutMs: Number.isFinite(timeout) && timeout >= 100 ? Math.min(timeout, LIMITS.timeoutMax) : defaultTimeoutMs,
      signal: new AbortController().signal,
    });
    setTrial(res);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={testCase ? 'Редагування тест-кейсу' : 'Новий тест-кейс'}
      footer={
        <>
          <button type="button" className="btn btn--ghost footer-left" onClick={tryRun} disabled={trial === 'running'}>
            <Icon name={trial === 'running' ? 'spinner' : 'play'} className={trial === 'running' ? 'spin' : undefined} /> Пробний запуск
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Скасувати
          </button>
          <button type="submit" form="case-form" className="btn btn--primary">
            {testCase ? 'Зберегти' : 'Створити тест-кейс'}
          </button>
        </>
      }
    >
      <form id="case-form" onSubmit={submit} noValidate className="form-grid form-grid--2">
        <Field id="case-title" label="Назва" error={errors.title} required>
          <input id="case-title" value={form.title} maxLength={LIMITS.name} onChange={(e) => set('title', e.target.value)} aria-invalid={Boolean(errors.title) || undefined} data-autofocus />
        </Field>
        <div className="form-row">
          <Field id="case-priority" label="Пріоритет" error={errors.priority}>
            <select id="case-priority" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
              {PRIORITY_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="case-timeout" label="Тайм-аут, мс" error={errors.timeoutMs}>
            <input id="case-timeout" type="number" inputMode="numeric" min={LIMITS.timeoutMin} max={LIMITS.timeoutMax} step={100} value={form.timeoutMs} onChange={(e) => set('timeoutMs', e.target.value)} aria-invalid={Boolean(errors.timeoutMs) || undefined} />
          </Field>
        </div>
        <Field id="case-desc" label="Опис / очікуваний результат" error={errors.description}>
          <textarea id="case-desc" rows={2} value={form.description} maxLength={LIMITS.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <div className="form-row">
          <Field id="case-tags" label="Теги" error={errors.tags} hint="Через кому">
            <input id="case-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </Field>
          <label className="switch">
            <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
            <span className="switch__track" aria-hidden="true" />
            Активний
          </label>
        </div>
        <div className="span-2">
          <Field id="case-code" label="Код тесту (JavaScript)" error={errors.code} hint="Матчери: toBe, toEqual, toContain, toThrow, toBeCloseTo, toMatch, not... Підтримується await." required>
            <CodeEditor id="case-code" value={form.code} onChange={(v) => set('code', v)} rows={10} invalid={Boolean(errors.code)} describedBy={errors.code ? 'case-code-error' : 'case-code-hint'} />
          </Field>
        </div>
        {trial && (
          <div className="span-2 trial" aria-live="polite">
            {trial === 'running' ? (
              <StatusBadge status="running" />
            ) : (
              <>
                <div className="trial__head">
                  <StatusBadge status={trial.status} />
                  <span className="muted">
                    {formatDuration(trial.durationMs)} · перевірок: {trial.assertions}
                  </span>
                </div>
                {trial.error && <pre className="error-box">{trial.error}</pre>}
                {trial.logs.length > 0 && <pre className="log-box">{trial.logs.join('\n')}</pre>}
              </>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
