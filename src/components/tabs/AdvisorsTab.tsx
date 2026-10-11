import React, { useCallback, useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';
import { MyCommissions } from '../chat/MyCommissions';

/**
 * Asesores y comisiones (solo administradores): KPIs de cada asesor en el
 * periodo (chats, conversión, ventas, descuentos, margen y comisión), su
 * porcentaje de comisión, lo que hay que pagarle, el registro de pagos y los
 * avisos al equipo de asesores.
 */

type State = 'awaiting' | 'holding' | 'available' | 'paid_out' | 'void';

interface AdvisorRow {
  id: number;
  name: string;
  email: string;
  role: 'asesor' | 'admin';
  online: boolean;
  paused: boolean;
  commission_share: number;
  /** Última aceptación de la información de protección de datos (current = versión vigente). */
  legal: { version: string; accepted_at: string; emailed_at: string | null; current: boolean } | null;
  attended: number;
  avg_first_response_s: number | null;
  avg_rating: number | null;
  ratings: number;
  sent: number;
  ordered: number;
  paid: number;
  voided: number;
  revenue: number;
  margin: number;
  commission: number;
  no_cost_units: number;
  states: Record<State, number>;
  available_count: number;
  last_payout_at: string | null;
  conversion: number | null;
  avg_ticket: number | null;
  avg_discount_pct: number | null;
  commission_of_margin: number | null;
  margin_pct: number | null;
}

interface Payout {
  id: number;
  agent_user_id: number;
  agent_name: string | null;
  amount_cents: number;
  method: string;
  reference: string | null;
  note: string | null;
  paid_at: string;
}

interface Announcement {
  id: number;
  title: string;
  body: string | null;
  created_at: string;
  recipients: { user_id: number; name: string; read_at: string | null }[];
}

interface Overview {
  holdDays: number;
  defaultShare: number;
  totals: {
    agents: number; online: number; attended: number; sent: number; paid: number; revenue: number; margin: number;
    commission: number; awaiting: number; holding: number; available: number; paid_out_period: number;
    conversion: number | null; avg_ticket: number | null; avg_discount_pct: number | null; commission_of_margin: number | null;
  };
  agents: AdvisorRow[];
  payouts: Payout[];
}

const PERIODS = [
  { key: 'month', label: 'Este mes' },
  { key: 'last-month', label: 'Mes pasado' },
  { key: '90', label: 'Últimos 90 días' },
  { key: 'year', label: 'Este año' },
  { key: 'all', label: 'Todo' },
] as const;
type PeriodKey = typeof PERIODS[number]['key'];

function periodRange(key: PeriodKey): { from: Date; to: Date } {
  const now = new Date();
  if (key === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  if (key === 'last-month') return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: new Date(now.getFullYear(), now.getMonth(), 1) };
  if (key === '90') return { from: new Date(now.getTime() - 90 * 86400_000), to: now };
  if (key === 'year') return { from: new Date(now.getFullYear(), 0, 1), to: now };
  return { from: new Date(2020, 0, 1), to: now };
}

const METHODS = ['Transferencia', 'Bizum', 'Stripe', 'Efectivo', 'Otro'];

const pct = (v: number | null, digits = 1) => (v == null ? '—' : `${(v * 100).toFixed(digits).replace('.', ',')} %`);
const pctRaw = (v: number | null, digits = 1) => (v == null ? '—' : `${v.toFixed(digits).replace('.', ',')} %`);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const duration = (s: number | null) => {
  if (s == null) return '—';
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.round(s / 60)} min`;
  return `${(s / 3600).toFixed(1).replace('.', ',')} h`;
};

const Kpi: React.FC<{ label: string; value: string; hint?: string; accent?: string }> = ({ label, value, hint, accent }) => (
  <div className="bg-tech-card border border-tech-border rounded-xl p-4">
    <p className="text-[10px] font-mono uppercase tracking-wider text-tech-muted">{label}</p>
    <p className={`text-xl font-black mt-1 ${accent || 'text-tech-text'}`}>{value}</p>
    {hint && <p className="text-[10px] text-tech-muted mt-0.5">{hint}</p>}
  </div>
);

export const AdvisorsTab: React.FC<{ adminToken: string; onOpenConversation: (id: number) => void }> = ({ adminToken, onOpenConversation }) => {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<PeriodKey>('month');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareDraft, setShareDraft] = useState<Record<number, string>>({});
  const [paying, setPaying] = useState<AdvisorRow | null>(null);
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<AdvisorRow | null>(null);
  const [notice, setNotice] = useState({ title: '', body: '', to: 'all' });
  const [sendingNotice, setSendingNotice] = useState(false);
  const [sent, setSent] = useState<Announcement[] | null>(null);

  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const load = useCallback(() => {
    const { from, to } = periodRange(period);
    setError(null);
    fetch(`/api/admin/advisors/overview?from=${from.toISOString()}&to=${to.toISOString()}`, { headers: { Authorization: `Bearer ${adminToken}` } })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los asesores');
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error de conexión'));
  }, [adminToken, period]);

  useEffect(() => { setData(null); load(); }, [load]);

  const loadSent = useCallback(() => {
    fetch('/api/admin/advisors/announcements', { headers: { Authorization: `Bearer ${adminToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSent(d?.announcements || []))
      .catch(() => setSent([]));
  }, [adminToken]);

  // Los avisos enviados se refrescan cada minuto para ver quién los va leyendo.
  useEffect(() => {
    loadSent();
    const t = setInterval(loadSent, 60_000);
    return () => clearInterval(t);
  }, [loadSent]);

  const saveShare = async (a: AdvisorRow) => {
    const raw = shareDraft[a.id];
    if (raw == null) return;
    const share = Number(raw.replace(',', '.'));
    if (!(share >= 0 && share <= 90)) { showToast('El porcentaje debe estar entre 0 y 90', 'error'); return; }
    if (share === a.commission_share) { setShareDraft(({ [a.id]: _, ...rest }) => rest); return; }
    try {
      const res = await fetch(`/api/admin/advisors/${a.id}/share`, { method: 'PUT', headers, body: JSON.stringify({ share }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar');
      showToast(`${a.name}: comisión del ${String(share).replace('.', ',')} % en sus próximos pedidos`, 'success');
      setShareDraft(({ [a.id]: _, ...rest }) => rest);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    }
  };

  const registerPayout = async () => {
    if (!paying) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/commission-payouts', {
        method: 'POST', headers, body: JSON.stringify({ agentUserId: paying.id, method, reference, note }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Error');
      showToast(`Pago de ${formatPrice(d.payout.amount_cents)} registrado (${d.count} comisiones). Se ha avisado al asesor.`, 'success');
      setPaying(null); setReference(''); setNote('');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo registrar el pago', 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendLegal = async (a: AdvisorRow) => {
    try {
      const res = await fetch(`/api/admin/advisors/${a.id}/legal/send`, { method: 'POST', headers });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar');
      showToast(`Copia enviada a ${a.name} (y a info@ para el archivo)`, 'success');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar', 'error');
    }
  };

  const sendNotice = async () => {
    if (!notice.title.trim()) return;
    setSendingNotice(true);
    try {
      const res = await fetch('/api/admin/advisors/notify', {
        method: 'POST', headers,
        body: JSON.stringify({ title: notice.title, body: notice.body, userIds: notice.to === 'all' ? [] : [Number(notice.to)] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo enviar');
      showToast(`Aviso enviado a ${d.sent} asesor${d.sent === 1 ? '' : 'es'}`, 'success');
      setNotice({ title: '', body: '', to: 'all' });
      loadSent();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar', 'error');
    } finally {
      setSendingNotice(false);
    }
  };

  if (error) return <div className="bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl p-4">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-20 text-tech-muted"><Icons.Loader2 className="w-6 h-6 animate-spin" /></div>;

  const t = data.totals;
  const advisors = data.agents.filter((a) => a.role === 'asesor');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-2 rounded-lg border text-xs font-bold ${period === p.key ? 'border-tech-yellow text-tech-yellow' : 'border-tech-border text-tech-muted hover:text-tech-text'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPIs del equipo en el periodo */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <Kpi label="Asesores" value={String(t.agents)} hint={`${t.online} conectados ahora`} />
        <Kpi label="Chats atendidos" value={String(t.attended)} hint={`${t.sent} pedidos preparados`} />
        <Kpi label="Pedidos pagados" value={String(t.paid)} hint={`Conversión ${pct(t.conversion)}`} />
        <Kpi label="Ventas del chat" value={formatPrice(t.revenue)} hint={`Ticket medio ${t.avg_ticket != null ? formatPrice(t.avg_ticket) : '—'}`} />
        <Kpi label="Margen neto" value={formatPrice(t.margin)} hint={`Descuento medio ${pctRaw(t.avg_discount_pct)}`} accent="text-emerald-400" />
        <Kpi label="Comisiones generadas" value={formatPrice(t.commission)} hint={`${pct(t.commission_of_margin, 0)} del margen`} accent="text-tech-yellow" />
        <Kpi label="Disponible para pagar" value={formatPrice(t.available)} hint="Ya pasó el plazo de devolución" accent="text-emerald-400" />
        <Kpi label="En periodo de devolución" value={formatPrice(t.holding)} hint={`${data.holdDays} días desde el pago`} />
        <Kpi label="Pendiente de pago del cliente" value={formatPrice(t.awaiting)} />
        <Kpi label="Pagado en el periodo" value={formatPrice(t.paid_out_period)} hint={`${data.payouts.length} pagos`} />
      </div>

      {/* Asesores */}
      <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2 flex-wrap">
          <Icons.Users size={16} className="text-tech-yellow" />
          <p className="font-bold text-tech-text text-sm">Asesores</p>
          <p className="text-[10px] text-tech-muted">
            Comisión = % del margen neto (por defecto {data.defaultShare} %). El cambio se aplica a los pedidos nuevos.
            Las comisiones se pueden pagar {data.holdDays} días después del pago del cliente.
          </p>
        </div>
        <table className="w-full text-xs min-w-[1100px]">
          <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
            <tr>
              <th className="text-left p-3">Asesor</th>
              <th className="text-right p-3">% comisión</th>
              <th className="text-right p-3">Chats</th>
              <th className="text-right p-3">1.ª respuesta</th>
              <th className="text-right p-3">Valoración</th>
              <th className="text-right p-3">Pedidos (pagados / enviados)</th>
              <th className="text-right p-3">Conversión</th>
              <th className="text-right p-3">Ventas</th>
              <th className="text-right p-3">Dto. medio</th>
              <th className="text-right p-3">Margen neto</th>
              <th className="text-right p-3">Comisión</th>
              <th className="text-right p-3">Disponible</th>
              <th className="text-right p-3">Cobrado</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {!data.agents.length && <tr><td colSpan={14} className="p-4 text-tech-muted">Todavía no hay asesores.</td></tr>}
            {data.agents.map((a) => (
              <tr key={a.id} className="border-b border-tech-border last:border-0 align-top">
                <td className="p-3">
                  <button onClick={() => setDetail(a)} className="text-tech-text hover:text-tech-yellow font-bold text-left">{a.name}</button>
                  <p className="text-[10px] text-tech-muted flex items-center gap-1 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.online ? (a.paused ? 'bg-amber-400' : 'bg-emerald-400') : 'bg-tech-border'}`} />
                    {a.role === 'admin' ? 'Administrador' : a.online ? (a.paused ? 'En pausa' : 'Conectado') : 'Desconectado'}
                  </p>
                  {a.role === 'asesor' && (
                    <p className={`text-[10px] mt-1 flex items-center gap-1 whitespace-nowrap ${a.legal?.current ? 'text-emerald-400' : 'text-amber-400'}`}
                      title={a.legal ? `Versión ${a.legal.version}${a.legal.emailed_at ? ` · copia enviada el ${fmtDate(a.legal.emailed_at)}` : ''}` : 'Se le pedirá al entrar en su panel'}>
                      <Icons.ShieldCheck size={11} />
                      {a.legal?.current ? `RGPD firmado ${fmtDate(a.legal.accepted_at)}` : 'RGPD pendiente'}
                      <button onClick={() => sendLegal(a)} className="underline text-tech-muted hover:text-tech-text ml-1">enviar copia</button>
                    </p>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <input
                      value={shareDraft[a.id] ?? String(a.commission_share).replace('.', ',')}
                      onChange={(e) => setShareDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveShare(a); }}
                      inputMode="decimal"
                      className="w-14 bg-tech-carbon border border-tech-border rounded px-2 py-1 text-right text-tech-text"
                    />
                    <span className="text-tech-muted">%</span>
                    {shareDraft[a.id] != null && (
                      <button onClick={() => saveShare(a)} title="Guardar" className="text-emerald-400 hover:text-emerald-300"><Icons.Check size={14} /></button>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right text-tech-text">{a.attended}</td>
                <td className="p-3 text-right text-tech-muted">{duration(a.avg_first_response_s)}</td>
                <td className="p-3 text-right text-tech-muted">{a.avg_rating != null ? `${String(a.avg_rating).replace('.', ',')} ★ (${a.ratings})` : '—'}</td>
                <td className="p-3 text-right text-tech-text">{a.paid} / {a.sent}{a.voided ? <span className="text-red-400"> · {a.voided} anul.</span> : null}</td>
                <td className="p-3 text-right text-tech-text">{pct(a.conversion)}</td>
                <td className="p-3 text-right text-tech-text">{formatPrice(a.revenue)}{a.avg_ticket != null && <p className="text-[10px] text-tech-muted">ticket {formatPrice(a.avg_ticket)}</p>}</td>
                <td className="p-3 text-right text-tech-muted">{pctRaw(a.avg_discount_pct)}</td>
                <td className="p-3 text-right text-emerald-400">
                  {formatPrice(a.margin)}
                  {a.margin_pct != null && <p className="text-[10px] text-tech-muted">{pct(a.margin_pct)} s/ venta</p>}
                  {a.no_cost_units > 0 && <p className="text-[10px] text-amber-400">{a.no_cost_units} ud. sin coste</p>}
                </td>
                <td className="p-3 text-right text-tech-yellow font-bold">
                  {formatPrice(a.commission)}
                  {a.commission_of_margin != null && <p className="text-[10px] text-tech-muted font-normal">{pct(a.commission_of_margin, 0)} del margen</p>}
                </td>
                <td className="p-3 text-right font-bold text-emerald-400">
                  {formatPrice(a.states.available)}
                  {a.states.holding > 0 && <p className="text-[10px] text-tech-muted font-normal">+{formatPrice(a.states.holding)} en devolución</p>}
                </td>
                <td className="p-3 text-right text-tech-text">
                  {formatPrice(a.states.paid_out)}
                  <p className="text-[10px] text-tech-muted">{a.last_payout_at ? `último ${fmtDate(a.last_payout_at)}` : 'sin pagos'}</p>
                </td>
                <td className="p-3 text-right">
                  <button onClick={() => setPaying(a)} disabled={a.states.available <= 0}
                    className="text-[10px] font-mono uppercase bg-tech-yellow text-black font-bold rounded px-2.5 py-1.5 disabled:opacity-30 whitespace-nowrap">
                    Registrar pago
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pagos registrados */}
        <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
          <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
            <Icons.HandCoins size={16} className="text-tech-yellow" />
            <p className="font-bold text-tech-text text-sm">Pagos registrados en el periodo</p>
          </div>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase font-mono text-tech-muted border-b border-tech-border">
              <tr><th className="text-left p-3">Fecha</th><th className="text-left p-3">Asesor</th><th className="text-left p-3">Método</th><th className="text-right p-3">Importe</th></tr>
            </thead>
            <tbody>
              {!data.payouts.length && <tr><td colSpan={4} className="p-4 text-tech-muted">No hay pagos en este periodo.</td></tr>}
              {data.payouts.map((p) => (
                <tr key={p.id} className="border-b border-tech-border last:border-0">
                  <td className="p-3 text-tech-muted">{fmtDate(p.paid_at)}</td>
                  <td className="p-3 text-tech-text">{p.agent_name || `Asesor ${p.agent_user_id}`}</td>
                  <td className="p-3 text-tech-muted">{p.method}{p.reference ? ` · ${p.reference}` : ''}{p.note ? <p className="text-[10px]">{p.note}</p> : null}</td>
                  <td className="p-3 text-right font-bold text-tech-text">{formatPrice(p.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Aviso a los asesores */}
        <div className="bg-tech-card border border-tech-border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icons.Megaphone size={16} className="text-tech-yellow" />
            <p className="font-bold text-tech-text text-sm">Enviar un aviso a los asesores</p>
          </div>
          <p className="text-[11px] text-tech-muted">Les llega al móvil y les aparece en una ventana al abrir su panel.</p>
          <select value={notice.to} onChange={(e) => setNotice((n) => ({ ...n, to: e.target.value }))}
            className="w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text">
            <option value="all">Todos los asesores ({advisors.length})</option>
            {advisors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={notice.title} onChange={(e) => setNotice((n) => ({ ...n, title: e.target.value }))} maxLength={120} placeholder="Título"
            className="w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
          <textarea value={notice.body} onChange={(e) => setNotice((n) => ({ ...n, body: e.target.value }))} maxLength={1000} rows={3} placeholder="Mensaje (opcional)"
            className="w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
          <button onClick={sendNotice} disabled={!notice.title.trim() || sendingNotice || !advisors.length}
            className="bg-tech-yellow text-black font-bold rounded-lg px-4 py-2 text-xs disabled:opacity-40 flex items-center gap-2">
            {sendingNotice ? <Icons.Loader2 size={13} className="animate-spin" /> : <Icons.Send size={13} />} Enviar aviso
          </button>
        </div>
      </div>

      {/* Avisos enviados y quién los ha leído */}
      <div className="bg-tech-card border border-tech-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
          <Icons.MailCheck size={16} className="text-tech-yellow" />
          <p className="font-bold text-tech-text text-sm">Avisos enviados</p>
          <p className="text-[10px] text-tech-muted">Se marca como leído cuando el asesor lo abre en su panel.</p>
        </div>
        {sent === null && <p className="p-4 text-xs text-tech-muted">Cargando…</p>}
        {sent?.length === 0 && <p className="p-4 text-xs text-tech-muted">Todavía no has enviado avisos.</p>}
        <ul className="divide-y divide-tech-border">
          {sent?.map((a) => {
            const read = a.recipients.filter((r) => r.read_at).length;
            return (
              <li key={a.id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-tech-text">{a.title}</p>
                    {a.body && <p className="text-xs text-tech-muted whitespace-pre-line mt-0.5">{a.body}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-tech-muted">{fmtDateTime(a.created_at)}</p>
                    <p className={`text-xs font-bold ${read === a.recipients.length ? 'text-emerald-400' : 'text-tech-yellow'}`}>
                      Leído por {read} de {a.recipients.length}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {a.recipients.map((r) => (
                    <span key={r.user_id}
                      className={`text-[10px] px-2 py-1 rounded-full border flex items-center gap-1 ${r.read_at ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-tech-border text-tech-muted'}`}>
                      {r.read_at ? <Icons.CheckCheck size={11} /> : <Icons.Clock size={11} />}
                      {r.name}{r.read_at ? ` · ${fmtDateTime(r.read_at)}` : ' · sin leer'}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Registrar pago */}
      {paying && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPaying(null)}>
          <div className="bg-tech-card border border-tech-border rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-tech-text">Pagar a {paying.name}</p>
            <p className="text-sm text-tech-text">
              Importe: <b className="text-emerald-400">{formatPrice(paying.states.available)}</b>
              <span className="text-tech-muted text-xs"> ({paying.available_count} comisiones disponibles)</span>
            </p>
            <p className="text-[11px] text-tech-muted">Haz primero el pago (transferencia, Bizum…) y regístralo aquí: las comisiones pasarán a «Cobrada» y el asesor recibirá un aviso.</p>
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
              <button onClick={registerPayout} disabled={saving} className="flex-1 bg-tech-yellow text-black font-bold rounded-lg py-2 text-xs disabled:opacity-50">
                {saving ? 'Registrando…' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de las comisiones de un asesor */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={() => setDetail(null)}>
          <div className="bg-tech-carbon border border-tech-border rounded-xl p-4 w-full max-w-5xl my-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-tech-text">Comisiones de {detail.name}</p>
              <button onClick={() => setDetail(null)} className="text-tech-muted hover:text-tech-text"><Icons.X size={18} /></button>
            </div>
            <MyCommissions adminToken={adminToken} agentId={detail.id}
              onOpenConversation={(id) => { setDetail(null); onOpenConversation(id); }} />
          </div>
        </div>
      )}
    </div>
  );
};
