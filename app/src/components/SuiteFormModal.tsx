import { useEffect, useState, type FormEvent } from 'react';
import type { Suite } from '../types';
import { hasErrors, LIMITS, parseTags, validateSuite, type Errors, type SuiteForm } from '../lib/validate';
import { CodeEditor } from './CodeEditor';
import { Modal } from './Modal';
import { Field } from './ui';

interface Props {
  open: boolean;
  suite?: Suite;
  existingNames: string[];
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; tags: string[]; setupCode: string }) => void;
}

const EMPTY: SuiteForm = { name: '', description: '', tags: '', setupCode: '// Спільний код для всіх тест-кейсів набору\n' };

export function SuiteFormModal({ open, suite, existingNames, onClose, onSubmit }: Props) {
  const [form, setForm] = useState<SuiteForm>(EMPTY);
  const [errors, setErrors] = useState<Errors<SuiteForm>>({});

  useEffect(() => {
    if (open) {
      setForm(suite ? { name: suite.name, description: suite.description, tags: suite.tags.join(', '), setupCode: suite.setupCode } : EMPTY);
      setErrors({});
    }
  }, [open, suite]);

  const set = <K extends keyof SuiteForm>(k: K, v: SuiteForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs = validateSuite(form, existingNames.filter((n) => n !== suite?.name));
    setErrors(errs);
    if (hasErrors(errs)) return;
    onSubmit({ name: form.name.trim(), description: form.description.trim(), tags: parseTags(form.tags), setupCode: form.setupCode });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={suite ? 'Редагування тестового набору' : 'Новий тестовий набір'}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Скасувати
          </button>
          <button type="submit" form="suite-form" className="btn btn--primary">
            {suite ? 'Зберегти зміни' : 'Створити набір'}
          </button>
        </>
      }
    >
      <form id="suite-form" onSubmit={submit} noValidate className="form-grid">
        <Field id="suite-name" label="Назва" error={errors.name} required>
          <input id="suite-name" value={form.name} maxLength={LIMITS.name} onChange={(e) => set('name', e.target.value)} aria-invalid={Boolean(errors.name) || undefined} data-autofocus />
        </Field>
        <Field id="suite-tags" label="Теги" error={errors.tags} hint="Через кому, наприклад: unit, smoke">
          <input id="suite-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
        </Field>
        <Field id="suite-desc" label="Опис" error={errors.description}>
          <textarea id="suite-desc" rows={2} value={form.description} maxLength={LIMITS.description} onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field id="suite-setup" label="Код підготовки (функції під тестом, фікстури)" error={errors.setupCode} hint="Виконується перед кожним тест-кейсом набору в ізольованому середовищі">
          <CodeEditor id="suite-setup" value={form.setupCode} onChange={(v) => set('setupCode', v)} rows={9} invalid={Boolean(errors.setupCode)} />
        </Field>
      </form>
    </Modal>
  );
}
