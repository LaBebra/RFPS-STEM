import { useEffect, useState } from 'react';
import { can, type Action } from './lib/auth';
import { useAppStore } from './store/useAppStore';
import { useAuthStore } from './store/useAuthStore';

export function useCan(action: Action): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return can(role, action);
}

/** Застосовує тему (light/dark/system) до кореневого елемента документа. */
export function useApplyTheme() {
  const theme = useAppStore((s) => s.settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useAppStore((s) => s.settings.theme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const fn = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · AutoQA Lab`;
  }, [title]);
}

/** Відкладене значення (debounce) для полів пошуку. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Чи просить користувач зменшити анімацію (налаштування доступності ОС). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}
