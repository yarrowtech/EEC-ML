import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_META = {
  success: { icon: CheckCircle2, classes: 'border-emerald-200 bg-emerald-50 text-emerald-800', iconColor: 'text-emerald-500' },
  error: { icon: AlertCircle, classes: 'border-rose-200 bg-rose-50 text-rose-800', iconColor: 'text-rose-500' },
  info: { icon: Info, classes: 'border-sky-200 bg-sky-50 text-sky-800', iconColor: 'text-sky-500' }
};

const DEFAULT_DURATION = 4500;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((type, message, options = {}) => {
    if (!message) return;
    idRef.current += 1;
    const id = idRef.current;
    const duration = options.duration || DEFAULT_DURATION;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, { duration: 7000, ...options }),
    info: (message, options) => push('info', message, options)
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,380px)]" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const meta = TOAST_META[toast.type] || TOAST_META.info;
          const Icon = meta.icon;
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-lg text-sm animate-[toast-in_180ms_ease-out] ${meta.classes}`}
            >
              <Icon size={17} className={`mt-0.5 shrink-0 ${meta.iconColor}`} />
              <p className="flex-1 leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    // Fail soft so components can render outside the provider (e.g. in tests).
    return { success: () => {}, error: () => {}, info: () => {} };
  }
  return context;
};

export default ToastProvider;
