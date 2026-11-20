import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { DEMO_ACCOUNTS, ROLE_LABELS } from '../lib/auth';
import { useDocumentTitle } from '../hooks';
import { useAuthStore } from '../store/useAuthStore';

interface FormErrors {
  username?: string;
  password?: string;
  form?: string;
}

export function validateLogin(username: string, password: string): FormErrors {
  const e: FormErrors = {};
  if (!username.trim()) e.username = 'Введіть логін';
  else if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim())) e.username = 'Логін: 3-32 латинські літери, цифри, . _ -';
  if (!password) e.password = 'Введіть пароль';
  else if (password.length < 6) e.password = 'Пароль закороткий';
  return e;
}

export function LoginPage() {
  useDocumentTitle('Вхід');
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [pending, setPending] = useState(false);
  const [lockLeft, setLockLeft] = useState(0);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const t = setTimeout(() => setLockLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [lockLeft]);

  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateLogin(username, password);
    setErrors(v);
    if (v.username || v.password) return;
    setPending(true);
    const result = await login(username, password);
    setPending(false);
    if (result.ok) {
      navigate('/', { replace: true });
      return;
    }
    setPassword('');
    if (result.reason === 'locked') {
      const sec = Math.ceil((result.retryInMs ?? 0) / 1000);
      setLockLeft(sec);
      setErrors({ form: `Забагато невдалих спроб. Вхід заблоковано на ${sec} с.` });
    } else {
      setErrors({ form: `Невірний логін або пароль. Залишилось спроб: ${result.attemptsLeft}.` });
    }
  };

  const fillDemo = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrors({});
  };

  return (
    <div className="login">
      <section className="login__card" aria-labelledby="login-title">
        <div className="brand brand--lg">
          <span className="brand__logo">
            <Icon name="logo" size={22} />
          </span>
          <span>
            AutoQA <b>Lab</b>
          </span>
        </div>
        <h1 id="login-title">Вхід до системи</h1>
        <p className="muted">Платформа для автоматизації тестування програмного забезпечення</p>

        <form onSubmit={submit} noValidate>
          {errors.form && (
            <div className="alert alert--error" role="alert">
              <Icon name="alert" /> {lockLeft > 0 ? `Забагато невдалих спроб. Повторіть через ${lockLeft} с.` : errors.form}
            </div>
          )}
          <div className={`field${errors.username ? ' field--error' : ''}`}>
            <label htmlFor="username">Логін</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              maxLength={32}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={Boolean(errors.username) || undefined}
              aria-describedby={errors.username ? 'username-error' : undefined}
              autoFocus
            />
            {errors.username && (
              <small id="username-error" className="field__error">
                {errors.username}
              </small>
            )}
          </div>
          <div className={`field${errors.password ? ' field--error' : ''}`}>
            <label htmlFor="password">Пароль</label>
            <div className="input-group">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                maxLength={64}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password) || undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
                aria-pressed={showPassword}
              >
                <Icon name={showPassword ? 'eyeOff' : 'eye'} />
              </button>
            </div>
            {errors.password && (
              <small id="password-error" className="field__error">
                {errors.password}
              </small>
            )}
          </div>
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={pending || lockLeft > 0}>
            {pending ? <Icon name="spinner" className="spin" /> : <Icon name="lock" />}
            {pending ? 'Перевірка...' : 'Увійти'}
          </button>
        </form>

        <details className="demo-accounts">
          <summary>Демонстраційні облікові записи</summary>
          <ul>
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button type="button" className="link-btn" onClick={() => fillDemo(a.username, a.password)}>
                  {a.username} / {a.password}
                </button>
                <span className="muted"> - {ROLE_LABELS[a.role]}</span>
              </li>
            ))}
          </ul>
        </details>
      </section>
      <p className="login__footer muted">STEM-проєкт · КНУ імені Тараса Шевченка · 2026</p>
    </div>
  );
}
