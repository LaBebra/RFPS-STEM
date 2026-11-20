import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ROLE_LABELS } from '../lib/auth';
import { useResolvedTheme } from '../hooks';
import { useAppStore } from '../store/useAppStore';
import { useAuthStore } from '../store/useAuthStore';
import { Icon, type IconName } from './Icon';
import { Loader } from './ui';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Дашборд', icon: 'dashboard', end: true },
  { to: '/suites', label: 'Тестові набори', icon: 'suites' },
  { to: '/runs', label: 'Журнал прогонів', icon: 'runs' },
  { to: '/settings', label: 'Налаштування', icon: 'settings' },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const checkSession = useAuthStore((s) => s.checkSession);
  const running = useAppStore((s) => s.runs.filter((r) => r.status === 'running').length);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const theme = useResolvedTheme();

  // Закриваємо мобільне меню при переході між сторінками.
  useEffect(() => setOpen(false), [location.pathname]);

  // Перевірка строку дії сесії щохвилини.
  useEffect(() => {
    const t = setInterval(checkSession, 60_000);
    return () => clearInterval(t);
  }, [checkSession]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`shell${open ? ' shell--nav-open' : ''}`}>
      <a className="skip-link" href="#main">
        Перейти до основного вмісту
      </a>
      <aside className="sidebar" id="sidebar" aria-label="Головна навігація">
        <div className="brand">
          <span className="brand__logo">
            <Icon name="logo" size={18} />
          </span>
          <span>
            AutoQA <b>Lab</b>
          </span>
        </div>
        <nav>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.to === '/runs' && running > 0 && (
                    <span className="nav-link__count" aria-label={`${running} активних прогонів`}>
                      {running}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar__footer">
          <div className="user-chip">
            <span className="user-chip__avatar" aria-hidden="true">
              {user?.name.slice(0, 1)}
            </span>
            <span className="user-chip__text">
              <b>{user?.name}</b>
              <small>{user ? ROLE_LABELS[user.role] : ''}</small>
            </span>
          </div>
          <button type="button" className="btn btn--ghost btn--block" onClick={logout}>
            <Icon name="logout" /> Вийти
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />

      <div className="main-col">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
          <span className="topbar__brand">
            AutoQA <b>Lab</b>
          </span>
          <div className="topbar__spacer" />
          {running > 0 && (
            <NavLink to="/runs" className="topbar__running">
              <Icon name="spinner" size={14} className="spin" /> Активних прогонів: {running}
            </NavLink>
          )}
          <button
            type="button"
            className="icon-btn"
            onClick={() => updateSettings({ theme: theme === 'dark' ? 'light' : 'dark' })}
            aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
            title="Перемкнути тему"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          <Suspense fallback={<Loader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
