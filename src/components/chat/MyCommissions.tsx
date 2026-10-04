import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/**
 * Panel de comisiones de un asesor: lo pendiente de que el cliente pague, en
 * periodo de devolución, disponible para cobrar, cobrado y anulado, con el
 * histórico de pedidos y de pagos recibidos.
 */

type State = 'awaiting' | 'holding' | 'available' | 'paid_out' | 'void';

interface CommissionRow {
  id: number;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  conversation_id: number | null;
  order_number: string | null;
  order_total: number | null;
  status_label: string;
  state: State;
  available_on: string | null;
  amount: number;
  commission_cents: number | null;
  payout_paid_at: string | null;
  payout_method: string | null;
}

interface Payout {
  id: number;
  amount_cents: number;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
}

interface Data {
  agent: { id: number; name: string };
  holdDays: number;
  totals: Record<State, number>;
  commissions: CommissionRow[];
  payouts: Payout[];
}

export const STATE_INFO: Record<State, { label: string; cls: string; help: string }> = {
  awaiting: { label: 'Pendiente de pago del cliente', cls: 'bg-sky-500/15 text-sky-400 border-sky-500/30', help: 'Pedido enviado o creado; falta que el cliente pague.' },
  holding: { label: 'En periodo de devolución', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', help: 'Pagado; se puede cobrar cuando pase el plazo de devolución.' },
  available: { label: 'Disponible para cobrar', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', help: 'Lista para incluir en el próximo pago.' },
  paid_out: { label: 'Cobrada', cls: 'bg-slate-500/15 text-tech-text border-tech-border', help: 'Ya pagada al asesor.' },
  void: { label: 'Anulada', cls: 'bg-red-500/15 text-red-400 border-red-500/30', help: 'Pedido cancelado, rechazado o reembolsado.' },
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

interface MyCommissionsProps {
  adminToken: string;
  /** Asesor a consultar (por defecto, el que ha iniciado sesión). */
  agentId?: number | null;
  onOpenConversation: (id: number) => void;
}

export const MyCommissions: React.FC<MyCommissionsProps> = ({ adminToken, agentId, onOpenConversation }) => {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<State | 'all'>('all');

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/my-commissions${agentId ? `?agent=${agentId}` : ''}`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, [adminToken, agentId]);

  if (!data) return <p className="text-xs text-tech-muted p-4">Cargando comisiones…</p>;

  const rows = data.commissions.filter((r) => filter === 'all' || r.state === filter);
  const cards: State[] = ['awaiting', 'holding', 'available', 'paid_out'];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icons.Wallet size={18} className="text-tech-yellow" />
        <p className="font-bold text-tech-text">Comisiones de {data.agent.name}</p>
        <p className="text-[11px] text-tech-muted ml-2">
          50 % del margen neto de tus productos. Se pueden cobrar {data.holdDays} días después del pago del cliente (plazo de devolución).
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((st) => (
          <button key={st} onClick={() => setFilter(filter === st ? 'all' : st)}
            className={`text-left bg-tech-card border rounded-xl p-4 ${filter === st ? 'border-tech-yellow' : 'border-tech-border hover:border-tech-muted'}`}>
            <p className="text-[10px] font-mono uppercase text-tech-muted">{STATE_INFO[st].label}</p>
            <p className={`text-2xl font-black mt-1 ${st === 'available' ? 'text-emerald-400' : 'text-tech-text'}`}>{formatPrice(data.totals[st])}</p>
            <p className="text-[10px] text-tech-muted mt-1">{STATE_INFO[st].help}</p>
          </button>
        ))}
      </div>
      {data.totals.void > 0 && (
        <p className="text-[11px] text-tech-muted">Anuladas por cancelación o reembolso: {formatPrice(data.totals.void)}</p>
      )}

      <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-tech-border text-[10px] font-mono uppercase">
          <span className="text-tech-muted">Histórico</span>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="ml-auto text-tech-yellow hover:underline">Ver todas</button>
          )}
        </div>
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
            <tr>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Pedido</th>
              <th className="text-left p-3">Estado de la comisión</th>
              <th className="text-right p-3">Comisión</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-4 text-tech-muted">Sin comisiones en este estado.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-tech-border last:border-0">
                <td className="p-3 text-tech-muted whitespace-nowrap">{fmtDate(r.created_at)}</td>
                <td className="p-3 text-tech-text">{r.customer_name || r.customer_email || '—'}</td>
                <td className="p-3">
                  <span className="font-mono text-tech-text">{r.order_number || '—'}</span>
                  <span className="block text-[10px] text-tech-muted">{r.status_label}{r.order_total != null ? ` · ${formatPrice(Number(r.order_total))}` : ''}</span>
                </td>
                <td className="p-3">
                  <span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-mono ${STATE_INFO[r.state].cls}`}>{STATE_INFO[r.state].label}</span>
                  {r.state === 'holding' && r.available_on && <span className="block text-[10px] text-tech-muted mt-1">Cobrable desde el {fmtDate(r.available_on)}</span>}
                  {r.state === 'paid_out' && <span className="block text-[10px] text-tech-muted mt-1">Pagada el {fmtDate(r.payout_paid_at)} ({r.payout_method})</span>}
                </td>
                <td className={`p-3 text-right whitespace-nowrap font-bold ${r.state === 'void' ? 'text-tech-muted line-through' : r.state === 'available' ? 'text-emerald-400' : 'text-tech-text'}`}>
                  {r.commission_cents == null && r.state === 'awaiting' ? '≈ ' : ''}{formatPrice(r.amount)}
                </td>
                <td className="p-3 text-right">
                  {r.conversation_id && (
                    <button onClick={() => onOpenConversation(r.conversation_id!)} className="text-tech-muted hover:text-tech-yellow" title="Abrir conversación">
                      <Icons.MessageSquare size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-tech-card border border-tech-border rounded-xl p-4">
        <p className="text-[10px] font-mono uppercase text-tech-muted mb-2">Pagos recibidos</p>
        {data.payouts.length === 0 && <p className="text-xs text-tech-muted">Todavía no hay pagos.</p>}
        <ul className="divide-y divide-tech-border">
          {data.payouts.map((p) => (
            <li key={p.id} className="py-2 flex items-center gap-3 text-xs">
              <Icons.CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-tech-text">{fmtDate(p.paid_at)}</span>
              <span className="text-tech-muted">{p.method}{p.reference ? ` · ${p.reference}` : ''}{p.note ? ` · ${p.note}` : ''}</span>
              <span className="ml-auto font-bold text-tech-text">{formatPrice(p.amount_cents)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
