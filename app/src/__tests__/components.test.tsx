import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CodeEditor } from '../components/CodeEditor';
import { ConfirmDialog } from '../components/Modal';
import { RunControl } from '../components/RunControl';
import { StatusBadge } from '../components/StatusBadge';
import { inlineExecutor } from '../lib/runner';
import { LoginPage, validateLogin } from '../pages/LoginPage';
import { setExecutor } from '../store/runActions';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { useState } from 'react';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({ user: null });
  useAppStore.getState().resetDemo();
  setExecutor(inlineExecutor);
});

describe('StatusBadge', () => {
  it('показує текст статусу (не лише колір)', () => {
    render(<StatusBadge status="timeout" />);
    expect(screen.getByText('Тайм-аут')).toHaveAttribute('data-status', 'timeout');
  });
  it('має окремі підписи для статусу прогону', () => {
    render(<StatusBadge status="failed" kind="run" />);
    expect(screen.getByText('З помилками')).toBeInTheDocument();
  });
});

describe('LoginPage', () => {
  it('validateLogin перевіряє формат логіна і пароля', () => {
    expect(validateLogin('', '')).toEqual({ username: 'Введіть логін', password: 'Введіть пароль' });
    expect(validateLogin('ab', '123456').username).toBeDefined();
    expect(validateLogin('<script>', '123456').username).toBeDefined();
    expect(validateLogin('admin', '123456')).toEqual({});
  });

  it('показує помилки валідації та помилку невірного пароля', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(screen.getByText('Введіть логін')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Логін'), 'admin');
    await user.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Невірний логін або пароль');
  });

  it('успішний вхід зберігає сесію', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByLabelText('Логін'), 'tester');
    await user.type(screen.getByLabelText('Пароль'), 'Tester#2026');
    await user.click(screen.getByRole('button', { name: 'Увійти' }));
    await waitFor(() => expect(useAuthStore.getState().user?.role).toBe('tester'));
    expect(sessionStorage.getItem('autoqa-lab:session')).toContain('tester');
  });

  it('кнопка показу пароля перемикає тип поля', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LoginPage />
      </MemoryRouter>,
    );
    const input = screen.getByLabelText('Пароль');
    expect(input).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Показати пароль' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('RunControl - діаграма станів кнопки запуску', () => {
  const renderControl = (ids: string[]) =>
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <RunControl caseIds={ids} title="Утиліти" scope="suite" />
      </MemoryRouter>,
    );

  it('disabled, якщо користувач не має права run', () => {
    useAuthStore.setState({ user: { username: 'guest', name: 'Гість', role: 'viewer' } });
    const { container } = renderControl(['case_slug']);
    expect(container.querySelector('.run-control')).toHaveAttribute('data-state', 'disabled');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disabled, якщо немає тест-кейсів', () => {
    useAuthStore.setState({ user: { username: 'admin', name: 'A', role: 'admin' } });
    const { container } = renderControl([]);
    expect(container.querySelector('.run-control')).toHaveAttribute('data-state', 'disabled');
  });

  it('idle -> running -> passed', async () => {
    useAuthStore.setState({ user: { username: 'admin', name: 'A', role: 'admin' } });
    const user = userEvent.setup();
    const { container } = renderControl(['case_slug', 'case_cap']);
    const root = () => container.querySelector('.run-control');
    expect(root()).toHaveAttribute('data-state', 'idle');
    await user.click(screen.getByRole('button', { name: /Запустити/ }));
    await waitFor(() => expect(root()).toHaveAttribute('data-state', 'passed'));
    expect(screen.getByRole('link', { name: 'Деталі прогону' })).toBeInTheDocument();
  });

  it('idle -> running -> failed для набору з дефектом', async () => {
    useAuthStore.setState({ user: { username: 'admin', name: 'A', role: 'admin' } });
    const user = userEvent.setup();
    const { container } = renderControl(['case_cart_disc']);
    await user.click(screen.getByRole('button'));
    await waitFor(() => expect(container.querySelector('.run-control')).toHaveAttribute('data-state', 'failed'));
  });
});

describe('ConfirmDialog', () => {
  it('викликає onConfirm та закривається по Escape', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Видалити?" message="Точно?" onConfirm={onConfirm} onCancel={onCancel} confirmLabel="Так" />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    await user.click(screen.getByRole('button', { name: 'Так' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('CodeEditor', () => {
  function Harness() {
    const [v, setV] = useState('a');
    return <CodeEditor id="ed" label="Код" value={v} onChange={setV} rows={3} />;
  }
  it('показує номери рядків і вставляє відступ клавішею Tab', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    const ta = screen.getByLabelText('Код') as HTMLTextAreaElement;
    expect(container.querySelectorAll('.code-editor__gutter span')).toHaveLength(3);
    ta.setSelectionRange(1, 1);
    await user.type(ta, '{Tab}', { initialSelectionStart: 1, initialSelectionEnd: 1 });
    expect(ta.value).toBe('a  ');
  });
});
