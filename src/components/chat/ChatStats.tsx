import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/** Estadísticas del chat por asesor y mes (solo administradores). */

interface AgentStats {
  agent_user_id: number;
  agent_name: string;
  attended: number;
  avg_first_response_s: number | null;
  avg_rating: string | null;
  ratings: number;
  converted: number;
  conversion: number;
  revenue: number;
  avg_ticket: number;
  commission: number;
}

const duration = (s: number | null) => {
  if (s == null) return '—';
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1).replace('.', ',')} h`;
};

export const ChatStats: React.FC<{ adminToken: string }> = ({ adminToken }) => {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<{ agents: AgentStats[]; waiting_now: number; offline_messages: number } | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/admin/chat-stats?month=${month}`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d)).catch(() => {});
  }, [month, adminToken]);

  const totals = (data?.agents || []).reduce((t, a) => ({
    attended: t.attended + a.attended, converted: t.converted + a.converted, revenue: t.revenue + a.revenue, commission: t.commission + a.commission,
  }), { attended: 0, converted: 0, revenue: 0, commission: 0 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-tech-muted flex items-center gap-2">
          Mes
          <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="bg-tech-carbon border border-tech-border rounded-lg px-3 py-1.5 text-sm text-tech-text" />
        </label>
        {data && <p className="text-[11px] text-tech-muted">{data.offline_messages} mensajes de fuera de horario este mes · {data.waiting_now} esperando ahora</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Chats atendidos', String(totals.attended)],
          ['Acaban en pedido pagado', totals.attended ? `${Math.round((totals.converted / totals.attended) * 100)} %` : '—'],
          ['Vendido (productos del asesor)', formatPrice(totals.revenue)],
          ['Comisiones', formatPrice(totals.commission)],
        ].map(([label, value]) => (
          <div key={label} className="bg-tech-card border border-tech-border rounded-xl p-4">
            <p className="text-[10px] font-mono uppercase text-tech-muted">{label}</p>
            <p className="text-2xl font-black text-tech-text mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
            <tr>
              <th className="text-left p-3">Asesor</th>
              <th className="text-right p-3">Chats</th>
              <th className="text-right p-3" title="Desde que el cliente pide asesor hasta la primera respuesta">1.ª respuesta</th>
              <th className="text-right p-3">Valoración</th>
              <th className="text-right p-3">Conversión</th>
              <th className="text-right p-3">Ticket medio</th>
              <th className="text-right p-3">Vendido</th>
              <th className="text-right p-3">Comisión</th>
            </tr>
          </thead>
          <tbody>
            {!data && <tr><td colSpan={8} className="p-4 text-tech-muted">Cargando…</td></tr>}
            {data?.agents.length === 0 && <tr><td colSpan={8} className="p-4 text-tech-muted">Sin chats atendidos este mes.</td></tr>}
            {data?.agents.map((a) => (
              <tr key={a.agent_user_id} className="border-b border-tech-border last:border-0">
                <td className="p-3 font-bold text-tech-text flex items-center gap-2"><Icons.UserCheck size={14} className="text-tech-yellow" />{a.agent_name}</td>
                <td className="p-3 text-right text-tech-text">{a.attended}</td>
                <td className="p-3 text-right text-tech-text">{duration(a.avg_first_response_s)}</td>
                <td className="p-3 text-right text-tech-text">{a.avg_rating ? <>{String(a.avg_rating).replace('.', ',')} ★ <span className="text-tech-muted">({a.ratings})</span></> : '—'}</td>
                <td className="p-3 text-right text-tech-text">{Math.round(a.conversion * 100)} %</td>
                <td className="p-3 text-right text-tech-text">{a.avg_ticket ? formatPrice(a.avg_ticket) : '—'}</td>
                <td className="p-3 text-right text-tech-text">{formatPrice(a.revenue)}</td>
                <td className="p-3 text-right font-bold text-emerald-400">{formatPrice(a.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
