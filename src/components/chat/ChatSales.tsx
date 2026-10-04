import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/** Pedidos preparados en el chat, por asesor y mes (base para las comisiones). */

interface ChatOrderRow {
  id: number;
  created_at: string;
  agent_user_id: number | null;
  agent_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  conversation_id: number | null;
  estimate_cents: number | null;
  /** Solo los productos del asesor (sin el resto del carrito ni el envío). */
  attributed_cents: number | null;
  estimate_commission_cents: number | null;
  commission_cents: number | null;
  order_id: number | null;
  order_number: string | null;
  order_status: string | null;
  order_total: number | null;
  paid_at: string | null;
  status_label: string;
  paid: boolean;
}

interface AgentSummary {
  agent_user_id: number | null;
  agent_name: string | null;
  sent: number;
  ordered: number;
  paid: number;
  paid_cents: number;
  commission_paid: number;
  commission_pending: number;
}

interface ChatSalesProps {
  adminToken: string;
  onOpenConversation: (id: number) => void;
}

const statusClass = (r: ChatOrderRow) =>
  r.paid ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    : !r.order_id ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    : ['cancelled', 'refunded', 'payment_failed'].includes(r.order_status || '') ? 'bg-red-500/15 text-red-400 border-red-500/30'
    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

export const ChatSales: React.FC<ChatSalesProps> = ({ adminToken, onOpenConversation }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [orders, setOrders] = useState<ChatOrderRow[]>([]);
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/chat-orders?month=${month}`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => (r.ok ? r.json() : { orders: [], agents: [] }))
      .then((d) => { setOrders(d.orders || []); setAgents(d.agents || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month, adminToken]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs text-tech-muted flex items-center gap-2">
          Mes
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="bg-tech-carbon border border-tech-border rounded-lg px-3 py-1.5 text-sm text-tech-text" />
        </label>
        <p className="text-[11px] text-tech-muted">Pedidos preparados por cada asesor en el chat y su estado.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.length === 0 && !loading && (
          <p className="text-xs text-tech-muted col-span-full">Sin pedidos del chat este mes.</p>
        )}
        {agents.map((a) => (
          <div key={String(a.agent_user_id)} className="bg-tech-card border border-tech-border rounded-xl p-4">
            <p className="font-bold text-tech-text flex items-center gap-2"><Icons.UserCheck size={16} className="text-tech-yellow" />{a.agent_name || 'Sin asesor'}</p>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div><p className="text-lg font-black text-tech-text">{a.sent}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Enviados</p></div>
              <div><p className="text-lg font-black text-tech-text">{a.ordered}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Pedidos</p></div>
              <div><p className="text-lg font-black text-emerald-400">{a.paid}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Pagados</p></div>
            </div>
            <p className="mt-3 text-sm text-tech-text">Vendido (sus productos, pagados): <span className="font-bold">{formatPrice(a.paid_cents)}</span></p>
            <p className="text-sm text-tech-text">Comisión ganada: <span className="font-bold text-emerald-400">{formatPrice(a.commission_paid)}</span></p>
            {a.commission_pending > 0 && <p className="text-[11px] text-tech-muted">Pendiente de pago del cliente: {formatPrice(a.commission_pending)}</p>}
          </div>
        ))}
      </div>

      <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
            <tr>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Asesor</th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">Pedido</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Pedido</th>
              <th className="text-right p-3" title="Productos preparados por el asesor, sin envío ni el resto del carrito">Del asesor</th>
              <th className="text-right p-3" title="50 % del margen neto de sus productos">Comisión</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="p-4 text-tech-muted">Cargando…</td></tr>}
            {!loading && orders.length === 0 && <tr><td colSpan={9} className="p-4 text-tech-muted">Sin pedidos del chat este mes.</td></tr>}
            {orders.map((r) => (
              <tr key={r.id} className="border-b border-tech-border last:border-0">
                <td className="p-3 text-tech-muted whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className="p-3 text-tech-text">{r.agent_name || '—'}</td>
                <td className="p-3 text-tech-text">{r.customer_name || r.customer_email || '—'}</td>
                <td className="p-3 text-tech-text font-mono">{r.order_number || '—'}</td>
                <td className="p-3"><span className={`px-1.5 py-0.5 rounded border text-[10px] uppercase font-mono ${statusClass(r)}`}>{r.status_label}</span></td>
                <td className="p-3 text-right text-tech-text whitespace-nowrap">
                  {r.order_total != null ? formatPrice(Number(r.order_total)) : r.estimate_cents != null ? <span className="text-tech-muted">≈ {formatPrice(r.estimate_cents)}</span> : '—'}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {r.attributed_cents != null ? <span className={r.paid ? 'text-emerald-400 font-bold' : 'text-tech-text'}>{formatPrice(r.attributed_cents)}</span> : <span className="text-tech-muted">—</span>}
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  {r.commission_cents != null
                    ? <span className={r.paid ? 'text-emerald-400 font-bold' : 'text-tech-text'}>{formatPrice(r.commission_cents)}</span>
                    : r.estimate_commission_cents != null ? <span className="text-tech-muted">≈ {formatPrice(r.estimate_commission_cents)}</span> : '—'}
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
    </div>
  );
};
