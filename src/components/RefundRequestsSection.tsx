import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import type { RefundRequest } from '../types/admin';

const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

interface Props {
  requests: RefundRequest[];
  authHeaders: () => Record<string, string>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  /** Se llama tras aprobar o rechazar para recargar el pedido. */
  onResolved: () => void;
}

/**
 * Solicitudes de reembolso del cliente dentro del detalle del pedido:
 * aprobar (reembolsa por Stripe el importe indicado) o rechazar con motivo.
 * En ambos casos el cliente recibe un correo.
 */
export default function RefundRequestsSection({ requests, authHeaders, showToast, onResolved }: Props) {
  const [amount, setAmount] = useState<Record<number, string>>({});
  const [note, setNote] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  if (!requests.length) return null;

  const resolve = async (r: RefundRequest, decision: 'approve' | 'reject') => {
    const amt = amount[r.id] ?? r.amount.toFixed(2);
    const n = (note[r.id] || '').trim();
    if (decision === 'reject' && n.length < 5) {
      showToast('Escribe el motivo del rechazo: se le envía al cliente.', 'error');
      return;
    }
    const question = decision === 'approve'
      ? `Vas a reembolsar ${amt} € por Stripe al cliente. ¿Continuar?`
      : '¿Rechazar la solicitud? El cliente recibirá el motivo por correo.';
    if (!window.confirm(question)) return;
    setBusy(r.id);
    try {
      const res = await fetch('/api/admin?action=resolve-refund-request', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: r.id, decision, amount: decision === 'approve' ? parseFloat(amt) : undefined, note: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(`Error: ${data.error || 'no se pudo resolver'}`, 'error'); return; }
      showToast(decision === 'approve' ? 'Reembolso realizado y cliente avisado.' : 'Solicitud rechazada y cliente avisado.');
      onResolved();
    } catch {
      showToast('Error de red', 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-[#1a1b1e]/50 p-5 border border-amber-700/30 rounded-xl mb-8 space-y-4">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
        <Icons.RotateCcw className="w-3.5 h-3.5" /> Solicitudes de reembolso del cliente
      </h4>
      {requests.map((r) => (
        <div key={r.id} className="border border-tech-border rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase text-zinc-400">
              {new Date(r.createdAt).toLocaleString('es-ES')} · {r.scope === 'full' ? 'Pedido completo' : 'Algunos productos'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
              r.status === 'pending' ? 'text-amber-400 border-amber-700/50'
                : r.status === 'refunded' ? 'text-emerald-400 border-emerald-700/50'
                  : 'text-red-400 border-red-800/50'}`}>
              {r.status === 'pending' ? 'Pendiente' : r.status === 'refunded' ? `Reembolsado ${eur(r.refunded)}` : 'Rechazada'}
            </span>
          </div>
          <ul className="text-xs text-tech-text space-y-0.5">
            {r.items.map((i) => <li key={i.itemId}>{i.quantity} × {i.name} <span className="text-zinc-500">({eur(i.priceCents / 100)}/ud.)</span></li>)}
          </ul>
          <div className="text-xs">
            <span className="font-bold text-tech-text">{r.reasonLabel}:</span>{' '}
            <span className="text-zinc-300 whitespace-pre-wrap">{r.reason}</span>
          </div>
          {r.adminNote && <p className="text-xs text-zinc-400 border-l-2 border-tech-yellow pl-2">{r.adminNote}</p>}

          {r.status === 'pending' && (
            <div className="space-y-2 pt-1">
              <div className="flex flex-col md:flex-row gap-2">
                <label className="flex-1">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Importe a reembolsar (€) · estimado {eur(r.amount)}</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    value={amount[r.id] ?? r.amount.toFixed(2)}
                    onChange={(e) => setAmount((a) => ({ ...a, [r.id]: e.target.value }))}
                    className="w-full bg-tech-card border border-tech-border rounded-xl px-3 py-2 text-xs text-tech-text outline-none focus:border-tech-yellow"
                  />
                </label>
              </div>
              <textarea
                rows={2}
                placeholder="Nota para el cliente (obligatoria si rechazas; opcional si apruebas)"
                value={note[r.id] || ''}
                onChange={(e) => setNote((x) => ({ ...x, [r.id]: e.target.value }))}
                className="w-full bg-tech-card border border-tech-border rounded-xl px-3 py-2 text-xs text-tech-text outline-none focus:border-tech-yellow"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button" disabled={busy === r.id} onClick={() => resolve(r, 'reject')}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-800/60 text-red-400 hover:bg-red-950/40 disabled:opacity-50"
                >
                  Rechazar
                </button>
                <button
                  type="button" disabled={busy === r.id} onClick={() => resolve(r, 'approve')}
                  className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busy === r.id ? <Icons.Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icons.Check className="w-3.5 h-3.5" />}
                  Aprobar y reembolsar
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
