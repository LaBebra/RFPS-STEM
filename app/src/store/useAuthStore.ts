import { create } from 'zustand';
import type { User } from '../types';
import { SESSION_TTL_MS, verifyCredentials, type LoginResult, type LoginState } from '../lib/auth';

const SESSION_KEY = 'autoqa-lab:session';
const ATTEMPTS_KEY = 'autoqa-lab:login-attempts';

interface Session {
  user: User;
  expiresAt: number;
}

function readSession(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.user || typeof s.expiresAt !== 'number' || s.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s.user;
  } catch {
    return null;
  }
}

function readAttempts(): LoginState {
  try {
    const s = JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? '') as LoginState;
    if (typeof s.attempts === 'number' && typeof s.lockedUntil === 'number') return s;
  } catch {
    /* немає збереженого стану */
  }
  return { attempts: 0, lockedUntil: 0 };
}

interface AuthState {
  user: User | null;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  /** Перевірка строку дії сесії (викликається періодично). */
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: readSession(),
  login: async (username, password) => {
    const { result, state } = await verifyCredentials(username, password, readAttempts());
    try {
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
    } catch {
      /* сховище недоступне */
    }
    if (result.ok) {
      const session: Session = { user: result.user, expiresAt: Date.now() + SESSION_TTL_MS };
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        /* сесія лише в пам'яті */
      }
      set({ user: result.user });
    }
    return result;
  },
  logout: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    set({ user: null });
  },
  checkSession: () => {
    if (!readSession()) set({ user: null });
  },
}));
