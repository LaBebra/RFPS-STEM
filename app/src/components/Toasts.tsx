import { useToastStore } from '../store/useToastStore';
import { Icon } from './Icon';

export function Toasts() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'clock'} />
          <span>{t.text}</span>
          <button type="button" className="icon-btn" onClick={() => dismiss(t.id)} aria-label="Закрити сповіщення">
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
