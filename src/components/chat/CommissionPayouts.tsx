import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/**
 * Pagos de comisiones: lo que hay que pagar a cada asesor y el registro de
 * cada pago (marca como cobradas todas sus comisiones disponibles).
 */

interface AgentRow {
  agent_user_id: number;
  agent_name: string;
  totals: { awaiting: number; holding: number; available: number; paid_out: number; void: number };
  availableCount: number;
}

interface CommissionPayoutsProps {
  adminToken: string;
  onViewAgent: (agentId: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const METHODS = ['Transferencia', 'Bizum', 'Stripe', 'Efectivo', 'Otro'];

export const CommissionPayouts: React.FC<CommissionPayoutsProps> = ({ adminToken, onViewAgent, showToast }) => {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [holdDays, setHoldDays] = useState(30);
  const [paying, setPaying] = useState<AgentRow | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => fetch('/api/admin/commission-agents', { headers: { Authorization: `Bearer ${adminToken}` } })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { setAgents(d.agents || []); setHoldDays(d.holdDays || 30); } })
    .catch(() => setAgents([]));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const register = async () => {
    if (!paying) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/commission-payouts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentUserId: paying.agent_user_id, method, reference, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      showToast(`Pago de ${formatPrice(data.payout.amount_cents)} registrado (${data.count} comisiones)`);
      setPaying(null); setReference(''); setNote('');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo registrar el pago', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
      <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
        <Icons.HandCoins size={16} className="text-tech-yellow" />
        <p className="font-bold text-tech-text text-sm">Pagos de comisiones a asesores</p>
        <p className="text-[10px] text-tech-muted ml-2">Disponibles {holdDays} días después del pago del cliente.</p>
      </div>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
          <tr>
            <th className="text-left p-3">Asesor</th>
            <th className="text-right p-3">Pendiente de pago del cliente</th>
            <th className="text-right p-3">En periodo de devolución</th>
            <th className="text-right p-3">Disponible</th>
            <th className="text-right p-3">Cobrado</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {agents === null && <tr><td colSpan={6} className="p-4 text-tech-muted">Cargando…</td></tr>}
          {agents?.length === 0 && <tr><td colSpan={6} className="p-4 text-tech-muted">Todavía no hay comisiones.</td></tr>}
          {agents?.map((a) => (
            <tr key={a.agent_user_id} className="border-b border-tech-border last:border-0">
              <td className="p-3">
                <button onClick={() => onViewAgent(a.agent_user_id)} className="text-tech-text hover:text-tech-yellow font-bold">{a.agent_name}</button>
              </td>
              <td className="p-3 text-right text-tech-muted">{formatPrice(a.totals.awaiting)}</td>
              <td className="p-3 text-right text-tech-muted">{formatPrice(a.totals.holding)}</td>
              <td className="p-3 text-right font-bold text-emerald-400">{formatPrice(a.totals.available)}</td>
              <td className="p-3 text-right text-tech-text">{formatPrice(a.totals.paid_out)}</td>
              <td className="p-3 text-right">
                <button onClick={() => setPaying(a)} disabled={a.totals.available <= 0}
                  className="text-[10px] font-mono uppercase bg-tech-yellow text-black font-bold rounded px-2.5 py-1.5 disabled:opacity-30">
                  Registrar pago
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {paying && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPaying(null)}>
          <div className="bg-tech-card border border-tech-border rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-tech-text">Pagar a {paying.agent_name}</p>
            <p className="text-sm text-tech-text">
              Importe: <b className="text-emerald-400">{formatPrice(paying.totals.available)}</b>
              <span className="text-tech-muted text-xs"> ({paying.availableCount} comisiones disponibles)</span>
            </p>
            <p className="text-[11px] text-tech-muted">Haz primero el pago (transferencia, Bizum…) y regístralo aquí: las comisiones pasarán a «Cobrada».</p>
            <label className="block text-[11px] text-tech-muted">Método
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text">
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-tech-muted">Referencia (opcional)
              <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} placeholder="Nº de transferencia, factura…"
                className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
            </label>
            <label className="block text-[11px] text-tech-muted">Nota (opcional)
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500}
                className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPaying(null)} className="flex-1 border border-tech-border rounded-lg py-2 text-xs text-tech-muted">Cancelar</button>
              <button onClick={register} disabled={saving} className="flex-1 bg-tech-yellow text-black font-bold rounded-lg py-2 text-xs disabled:opacity-50">
                {saving ? 'Registrando…' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
