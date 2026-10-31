import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
let sequence = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'success') => {
      const id = ++sequence;
      setToasts((current) => [...current.slice(-4), { id, message, type }]);
      setTimeout(() => remove(id), 4800);
    },
    [remove],
  );

  const toast = useMemo(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
      push,
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((item) => {
          const Icon = item.type === 'error' ? AlertTriangle : item.type === 'info' ? Info : CheckCircle2;
          return (
            <div key={item.id} className={`toast toast-${item.type}`}>
              <span className="toast-icon">
                <Icon size={17} />
              </span>
              <span className="toast-message">{item.message}</span>
              <button type="button" className="toast-close" onClick={() => remove(item.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context;
}
