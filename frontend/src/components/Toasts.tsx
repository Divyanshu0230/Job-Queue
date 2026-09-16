import { X } from 'lucide-react';
import { useToasts } from '../hooks/useToasts';
import { cn } from '../lib/cn';

export function Toasts() {
  const { toasts, dismiss } = useToasts();

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={cn('toast', `toast--${toast.tone}`)}>
          <div>
            <p>{toast.title}</p>
            {toast.detail ? <small>{toast.detail}</small> : null}
          </div>
          <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
