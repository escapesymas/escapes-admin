import React from 'react';
import * as Icons from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-tech-carbon/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            variant === 'danger' ? 'bg-red-950/30 border border-red-800/30 text-red-500' :
            variant === 'warning' ? 'bg-amber-950/30 border border-amber-800/30 text-amber-500' :
            'bg-zinc-900 border border-tech-border text-tech-text'
          }`}>
            {variant === 'danger' ? <Icons.AlertTriangle className="w-5 h-5" /> :
             variant === 'warning' ? <Icons.AlertCircle className="w-5 h-5" /> :
             <Icons.HelpCircle className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text">{title}</h3>
            <p className="text-xs text-tech-muted mt-2 leading-relaxed">{message}</p>
          </div>
          <button onClick={onCancel} className="text-tech-muted hover:text-tech-text shrink-0">
            <Icons.X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-tech-border">
          <button
            onClick={onCancel}
            className="bg-[#1a1b1e] border border-tech-border text-tech-muted px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all hover:text-tech-text"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all shadow-lg ${
              variant === 'danger'
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-950/20'
                : 'bg-tech-yellow hover:bg-orange-600 text-tech-text shadow-orange-950/10'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
