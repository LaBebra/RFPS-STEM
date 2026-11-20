import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CaseFormModal } from '../components/CaseFormModal';
import { Layout } from '../components/Layout';
import { SuiteFormModal } from '../components/SuiteFormModal';
import { Toasts } from '../components/Toasts';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { toast, useToastStore } from '../store/useToastStore';

beforeEach(() => {
  useAppStore.getState().resetDemo();
  useToastStore.setState({ toasts: [] });
});

describe('SuiteFormModal', () => {
  it('не відправляє форму з помилками і відправляє коректну', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<SuiteFormModal open existingNames={['Кошик']} onClose={() => {}} onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Створити набір' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Назва обов'язкова")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Назва/), 'кошик');
    await user.click(screen.getByRole('button', { name: 'Створити набір' }));
    expect(screen.getByText('Набір з такою назвою вже існує')).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Назва/));
    await user.type(screen.getByLabelText(/Назва/), 'API тести');
    await user.type(screen.getByLabelText(/Теги/), 'Api, smoke');
    await user.click(screen.getByRole('button', { name: 'Створити набір' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'API тести', tags: ['api', 'smoke'] }));
  });
});

describe('CaseFormModal', () => {
  it('редагування: підставляє значення тест-кейсу та перевіряє тайм-аут', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const tc = useAppStore.getState().cases.find((c) => c.id === 'case_slug')!;
    render(<CaseFormModal open testCase={tc} setupCode="" defaultTimeoutMs={2000} onClose={() => {}} onSubmit={onSubmit} />);
    expect(screen.getByLabelText(/Назва/)).toHaveValue(tc.title);
    const timeout = screen.getByLabelText('Тайм-аут, мс');
    await user.clear(timeout);
    await user.type(timeout, '10');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(onSubmit).not.toHaveBeenCalled();
    await user.clear(timeout);
    await user.type(timeout, '3000');
    await user.click(screen.getByRole('button', { name: 'Зберегти' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 3000, priority: 'high' }));
  });
});

describe('Toasts', () => {
  it('показує й закриває сповіщення', async () => {
    const user = userEvent.setup();
    render(<Toasts />);
    act(() => toast.success('Збережено'));
    expect(screen.getByText('Збережено')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Закрити сповіщення' }));
    expect(screen.queryByText('Збережено')).not.toBeInTheDocument();
  });
});

describe('Layout', () => {
  it('показує навігацію, користувача та відкриває мобільне меню', async () => {
    const user = userEvent.setup();
    useAuthStore.setState({ user: { username: 'admin', name: 'Михайло Марчук', role: 'admin' } });
    const { container } = render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/']}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<p>Вміст</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('navigation')).toHaveTextContent('Журнал прогонів');
    expect(screen.getByText('Адміністратор')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Відкрити меню' }));
    expect(container.querySelector('.shell')).toHaveClass('shell--nav-open');
    await user.click(screen.getByRole('button', { name: /Вийти/ }));
    expect(useAuthStore.getState().user).toBeNull();
  });
});
