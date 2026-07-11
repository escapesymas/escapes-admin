import React from 'react';

export const OrderStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    pending: 'bg-yellow-950/20 text-yellow-500 border-yellow-900/30',
    processing: 'bg-blue-950/20 text-blue-400 border-blue-900/30',
    completed: 'bg-green-950/20 text-green-500 border-green-900/30',
    cancelled: 'bg-red-950/20 text-red-500 border-red-900/30',
  };
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    processing: 'Procesando',
    completed: 'Completado',
    cancelled: 'Cancelado',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase italic border ${map[status] || 'bg-[#1a1b1e] text-tech-muted border-tech-border'}`}>
      {labels[status] || status}
    </span>
  );
};

export const DropshippingStatusBadge = ({ status, trackingNumber, trackingUrl }: { status: string; trackingNumber?: string | null; trackingUrl?: string | null }) => {
  const map: Record<string, string> = {
    not_sent: 'bg-zinc-955 text-zinc-550 border-tech-border',
    pending_bihr: 'bg-amber-955/20 text-amber-500 border-amber-900/30 animate-pulse',
    shipped: 'bg-emerald-955/20 text-emerald-500 border-emerald-900/30',
    cancelled: 'bg-red-955/20 text-red-500 border-red-900/30',
  };
  const labels: Record<string, string> = {
    not_sent: 'No Enviado',
    pending_bihr: 'Pendiente',
    shipped: 'Enviado',
    cancelled: 'Cancelado',
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase italic border ${map[status] || 'bg-[#1a1b1e] text-zinc-550 border-tech-border'}`}>
        {labels[status] || 'No Enviado'}
      </span>
      {status === 'shipped' && trackingNumber && (
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[9px] font-mono text-tech-muted">Track:</span>
          {trackingUrl ? (
            <a href={trackingUrl} target="_blank" rel="noreferrer" className="text-[9px] font-mono font-bold text-blue-400 hover:text-blue-300 underline">
              {trackingNumber}
            </a>
          ) : (
            <span className="text-[9px] font-mono font-bold text-[#cbd5e1]">{trackingNumber}</span>
          )}
        </div>
      )}
    </div>
  );
};
