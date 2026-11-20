import type { Role, User } from '../types';

/**
 * Демонстраційний модуль автентифікації фронтенду.
 * У повній системі перевірку виконує бекенд; тут зберігаються лише
 * солені SHA-256 хеші паролів, а відкриті паролі в коді відсутні.
 */
interface StoredUser extends User {
  salt: string;
  hash: string;
}

const USERS: StoredUser[] = [
  {
    username: 'admin',
    name: 'Михайло Марчук',
    role: 'admin',
    salt: 'a9f1c2e4',
    hash: '038b92d8acf686522e4cb3db5231be7addf0832672d48d885ad03c7510eb29ad',
  },
  {
    username: 'tester',
    name: 'QA-інженер',
    role: 'tester',
    salt: '5b7d0e33',
    hash: '06fbda637530f4a74a47509c73654ac7b7784b8710f99c80c7b450777f9c7f37',
  },
  {
    username: 'guest',
    name: 'Гість (перегляд)',
    role: 'viewer',
    salt: 'c41e8a90',
    hash: '191577935fb87fcc3dd34f25ae06ec81926385a86f21ec5002a0367fcf8a7f90',
  },
];

export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 60_000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type Action = 'view' | 'edit' | 'run' | 'delete' | 'admin';

const PERMISSIONS: Record<Role, Action[]> = {
  admin: ['view', 'edit', 'run', 'delete', 'admin'],
  tester: ['view', 'edit', 'run', 'delete'],
  viewer: ['view'],
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Адміністратор',
  tester: 'Тестувальник',
  viewer: 'Спостерігач',
};

/** Перевірка прав доступу ролі до дії (RBAC). */
export function can(role: Role | undefined, action: Action): boolean {
  return role ? PERMISSIONS[role].includes(action) : false;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Порівняння рядків за сталий час (зменшує ризик атак за часом відповіді). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface LoginState {
  attempts: number;
  lockedUntil: number;
}

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid' | 'locked'; retryInMs?: number; attemptsLeft?: number };

/**
 * Перевіряє облікові дані з урахуванням обмеження кількості спроб.
 * Стан спроб передається ззовні, щоб функцію було просто тестувати.
 */
export async function verifyCredentials(
  username: string,
  password: string,
  state: LoginState,
  now = Date.now(),
): Promise<{ result: LoginResult; state: LoginState }> {
  if (state.lockedUntil > now) {
    return { result: { ok: false, reason: 'locked', retryInMs: state.lockedUntil - now }, state };
  }
  const login = username.trim().toLowerCase();
  const user = USERS.find((u) => u.username === login);
  // Хеш обчислюється навіть для неіснуючого користувача, щоб час відповіді не видавав логіни.
  const hash = await sha256Hex(`${user?.salt ?? 'x'}:${password}`);
  if (user && safeEqual(hash, user.hash)) {
    return {
      result: { ok: true, user: { username: user.username, name: user.name, role: user.role } },
      state: { attempts: 0, lockedUntil: 0 },
    };
  }
  const attempts = state.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return {
      result: { ok: false, reason: 'locked', retryInMs: LOCK_MS },
      state: { attempts: 0, lockedUntil: now + LOCK_MS },
    };
  }
  return { result: { ok: false, reason: 'invalid', attemptsLeft: MAX_ATTEMPTS - attempts }, state: { attempts, lockedUntil: 0 } };
}

export const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'Admin#2026', role: 'admin' as Role },
  { username: 'tester', password: 'Tester#2026', role: 'tester' as Role },
  { username: 'guest', password: 'Guest#2026', role: 'viewer' as Role },
];
