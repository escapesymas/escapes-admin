import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as Icons from 'lucide-react';

type ToastType = 'success' | 'error';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let counter = 0;

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + counter++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl transition-all duration-300 animate-in slide-in-from-right ${
              t.type === 'success'
                ? 'bg-emerald-950/95 text-emerald-400 border-emerald-900/50'
                : 'bg-red-950/95 text-red-400 border-red-900/50'
            }`}
          >
            {t.type === 'success' ? (
              <Icons.CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <Icons.AlertOctagon className="w-5 h-5 shrink-0" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider">{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-2 opacity-60 hover:opacity-100">
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
