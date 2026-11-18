import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';
import type { Order } from '../../types/admin';
import type { OverviewAiReport, OverviewCompare, OverviewKpi, OverviewPreset, OverviewReport } from '../../types/overview';
import { BarChart, FunnelChart } from '../overview/OverviewCharts';
import { CompareToggle, KpiTile, MarkdownLite, PeriodPicker, RankList } from '../overview/OverviewWidgets';
import {
  DEVICE_NAMES, GROUP_ORDER, GROUP_TITLES, PAYMENT_NAMES, cityLabel, fmtDateTime, fmtDay, fmtDayLong, fmtEurShort, fmtValue,
} from '../../utils/overviewFormat';

interface DashboardTabProps {
  adminWpId: string;
  adminEmail: string;
  adminToken: string;
  orders: Order[];
  setSelectedOrder: (order: Order | null) => void;
}

const STORE_KEY = 'overview_period_v1';
const VALID_PRESETS: OverviewPreset[] = ['today', 'yesterday', '7d', '30d', 'month', 'prev_month', 'year', 'custom'];

/** Hoy en hora de Madrid como YYYY-MM-DD. */
const madridToday = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const addDays = (date: string, n: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const shortDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return `${d}/${m}/${y}`;
};

const rangeText = (from: string, to: string): string => (from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`);

const loadPeriod = (): { preset: OverviewPreset; from: string; to: string; compare: OverviewCompare } => {
  const today = madridToday();
  const fallback = { preset: '30d' as OverviewPreset, from: addDays(today, -29), to: today, compare: 'prev' as OverviewCompare };
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (raw && VALID_PRESETS.includes(raw.preset)) {
      return {
        preset: raw.preset, compare: raw.compare === 'yoy' ? 'yoy' : 'prev',
        from: /^\d{4}-\d{2}-\d{2}$/.test(raw.from) ? raw.from : fallback.from, to: /^\d{4}-\d{2}-\d{2}$/.test(raw.to) ? raw.to : fallback.to,
      };
    }
  } catch { /* sin almacenamiento o datos rotos: se usa el periodo por defecto */ }
  return fallback;
};

const OrderStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending': return <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Pendiente</span>;
    case 'processing': return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Procesando</span>;
    case 'completed': return <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Completado</span>;
    case 'cancelled': return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Cancelado</span>;
    default: return <span className="bg-tech-border text-zinc-400 border border-zinc-700 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">{status}</span>;
  }
};

const Card: React.FC<{ title: string; icon: React.ElementType; right?: React.ReactNode; children: React.ReactNode }> = ({ title, icon: Icon, right, children }) => (
  <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-5 shadow-xl min-w-0">
    <div className="flex items-start justify-between gap-3 mb-4">
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-tech-text flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-tech-yellow" /> {title}</h3>
      {right}
    </div>
    {children}
  </div>
);

export const DashboardTab: React.FC<DashboardTabProps> = ({ adminToken, orders, setSelectedOrder }) => {
  const initial = useMemo(loadPeriod, []);
  const [preset, setPreset] = useState<OverviewPreset>(initial.preset);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [compare, setCompare] = useState<OverviewCompare>(initial.compare);
  const [excludeInternal, setExcludeInternal] = useState(true);

  const [report, setReport] = useState<OverviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ai, setAi] = useState<OverviewAiReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [includeAiInPdf, setIncludeAiInPdf] = useState(true);
  const [copied, setCopied] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);

  const reqId = useRef(0);
  const aiRef = useRef<HTMLDivElement>(null);
  const today = madridToday();

  // Un periodo personalizado solo se pide cuando las dos fechas están bien.
  const customOk = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const query = useMemo(() => {
    const q = new URLSearchParams({ preset, compare, excludeInternal: String(excludeInternal) });
    if (preset === 'custom') { q.set('from', from); q.set('to', to); }
    return q.toString();
  }, [preset, from, to, compare, excludeInternal]);
  const queryRef = useRef(query);
  queryRef.current = query;

  const load = useCallback(async (background = false) => {
    if (preset === 'custom' && !customOk) { setLoading(false); return; }
    const id = ++reqId.current;
    if (!background) setLoading(true);
    try {
      const res = await fetch(`/api/admin/overview/report?${query}`, { headers: { Authorization: `Bearer ${adminToken}` } });
      if (id !== reqId.current) return;
      if (res.status === 401) { setError('Sesión caducada o falta la verificación en dos pasos.'); return; }
      if (!res.ok) { setError('No se pudo calcular el informe. Inténtalo de nuevo.'); return; }
      setReport(await res.json());
      setError(null);
    } catch (err) {
      console.error('[FETCH OVERVIEW ERROR]:', err);
      if (id === reqId.current) setError('No se pudo calcular el informe. Revisa la conexión.');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [query, adminToken, preset, customOk]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(true); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  // El análisis de la IA es de un periodo concreto: al cambiar de periodo se descarta.
  useEffect(() => { setAi(null); setAiError(null); setPdfError(null); }, [query]);

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ preset, from, to, compare })); } catch { /* no se recuerda */ }
  }, [preset, from, to, compare]);

  const body = useCallback((extra: Record<string, unknown> = {}) => JSON.stringify({ preset, compare, excludeInternal, ...(preset === 'custom' ? { from, to } : {}), ...extra }), [preset, from, to, compare, excludeInternal]);

  const generateAi = async (force = false) => {
    const startedFor = queryRef.current;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/admin/overview/ai-report', {
        method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: body({ force }),
      });
      const data = await res.json().catch(() => ({}));
      if (startedFor !== queryRef.current) return; // mientras tanto se cambió de periodo
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el informe con la IA.');
      setAi(data);
      setTimeout(() => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e: any) {
      if (startedFor === queryRef.current) setAiError(e?.message || 'No se pudo generar el informe con la IA.');
    } finally {
      setAiLoading(false);
    }
  };

  const downloadPdf = async () => {
    setPdfLoading(true);
    setPdfError(null);
    try {
      const res = await fetch('/api/admin/overview/pdf', {
        method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: body(ai && includeAiInPdf ? { aiText: ai.text } : {}),
      });
      if (!res.ok) throw new Error('No se pudo generar el PDF.');
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'informe-escapesymas.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15_000);
    } catch (e: any) {
      setPdfError(e?.message || 'No se pudo generar el PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const copyAi = async () => {
    if (!ai) return;
    try { await navigator.clipboard.writeText(ai.text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin permiso del portapapeles */ }
  };

  const kpisById = useMemo(() => new Map((report?.kpis || []).map((k) => [k.id, k])), [report]);
  const headline = (report?.headline || []).map((id) => kpisById.get(id)).filter((k): k is OverviewKpi => !!k);
  const period = report?.period;
  const stale = loading && !!report; // se está recalculando: el informe anterior se ve atenuado

  const toggleGroup = (g: string) => setClosedGroups((c) => (c.includes(g) ? c.filter((x) => x !== g) : [...c, g]));

  return (
    <div className="space-y-6 animate-fade-in min-w-0">
      {/* ── Periodo y acciones ── */}
      <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 space-y-3 max-w-full">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-tech-muted font-mono">Informe del periodo</div>
            <div className="text-lg font-black italic uppercase tracking-tight text-tech-text">{period?.label ?? 'Calculando…'}</div>
            {period && (
              <div className="text-[11px] text-tech-muted font-mono mt-0.5">
                {rangeText(period.from, period.to)} · comparado con {period.prevLabel.toLowerCase()} ({rangeText(period.prevFrom, period.prevTo)})
              </div>
            )}
          </div>
          <PeriodPicker
            preset={preset}
            from={from}
            to={to}
            maxDate={today}
            onPreset={(p) => { setPreset(p); }}
            onDates={(f, t) => { setFrom(f); setTo(t); }}
          />
          <CompareToggle value={compare} onChange={setCompare} />
          <label
            title="Oculta toda Canarias para no contar tus pruebas. Los clientes reales de Canarias tampoco salen mientras esté marcado."
            className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-tech-muted hover:text-tech-text bg-tech-carbon/60 px-3 py-1.5 rounded-sm border border-tech-border"
          >
            <input type="checkbox" checked={excludeInternal} onChange={(e) => setExcludeInternal(e.target.checked)} className="rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card" />
            <span className="text-[11px]">Excluir tráfico propio (toda Canarias)</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            title="Volver a calcular el informe"
            className="flex items-center gap-2 px-3 py-2 rounded-sm border border-tech-border bg-tech-carbon text-tech-text hover:border-tech-yellow hover:text-tech-yellow text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <Icons.RefreshCw size={13} className={loading ? 'animate-spin text-tech-yellow' : ''} /> <span className="hidden sm:inline">Actualizar</span>
          </button>
          <button
            onClick={() => generateAi(false)}
            disabled={!report || aiLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-sm bg-tech-yellow text-black hover:bg-yellow-300 text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {aiLoading ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Sparkles size={14} />} {aiLoading ? 'Redactando…' : 'Informe con IA'}
          </button>
          <button
            onClick={downloadPdf}
            disabled={!report || pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-sm border border-tech-yellow/60 text-tech-yellow hover:bg-tech-yellow/10 text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {pdfLoading ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.FileDown size={14} />} {pdfLoading ? 'Generando…' : 'Descargar PDF'}
          </button>
          {pdfError && <span className="w-full text-[11px] text-red-400 font-mono">{pdfError}</span>}
        </div>
      </div>

      {preset === 'custom' && !customOk && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs font-mono text-amber-300">Elige un «Desde» anterior o igual al «Hasta».</div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-xs font-mono text-red-400 flex items-center gap-3">
          <Icons.AlertCircle className="w-5 h-5 flex-shrink-0" /> <span>{error}</span>
        </div>
      )}
      {report && report.kpis.some((k) => k.noPrev) && (
        <div className="bg-sky-500/10 border border-sky-500/30 rounded-md p-3 text-xs font-mono text-sky-200 flex items-start gap-2">
          <Icons.Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            No hay datos de «{report.period.prevLabel.toLowerCase()}» ({rangeText(report.period.prevFrom, report.period.prevTo)}) con los que comparar:
            {report.dataSince.store ? ` la tienda tiene datos desde el ${shortDate(report.dataSince.store)}` : ''}
            {report.dataSince.visits ? ` y las estadísticas web desde el ${shortDate(report.dataSince.visits)}` : ''}.
            Esos indicadores salen sin comparar (no es lo mismo que «cero»).
          </span>
        </div>
      )}
      {report?.warnings.map((w) => (
        <div key={w} className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs font-mono text-amber-300 flex items-center gap-2"><Icons.AlertTriangle className="w-4 h-4 shrink-0" /> {w}</div>
      ))}

      {/* ── Análisis con IA ── */}
      {(ai || aiLoading || aiError) && (
        <div ref={aiRef} className="bg-tech-card border border-tech-yellow/30 rounded-md shadow-xl scroll-mt-4">
          <div className="p-4 sm:p-5 border-b border-tech-border flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[11px] font-mono uppercase tracking-widest text-tech-text flex items-center gap-2">
              <Icons.Sparkles className="w-4 h-4 text-tech-yellow" /> Análisis con IA · {period?.label}
            </h3>
            {ai && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono text-tech-muted">{fmtDateTime(ai.generatedAt)}{ai.cached ? ' · guardado hace un momento' : ''}</span>
                <button onClick={copyAi} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-tech-border text-[10px] font-mono uppercase tracking-wider text-tech-text hover:border-tech-yellow hover:text-tech-yellow transition-colors">
                  {copied ? <Icons.Check size={12} /> : <Icons.Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
                </button>
                <button onClick={() => generateAi(true)} disabled={aiLoading} className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-tech-border text-[10px] font-mono uppercase tracking-wider text-tech-text hover:border-tech-yellow hover:text-tech-yellow transition-colors disabled:opacity-50">
                  <Icons.RefreshCw size={12} className={aiLoading ? 'animate-spin' : ''} /> Volver a redactar
                </button>
              </div>
            )}
          </div>
          <div className="p-4 sm:p-6">
            {aiLoading && !ai && (
              <div className="flex items-center gap-3 text-xs font-mono text-tech-muted py-6 justify-center">
                <Icons.Loader2 className="w-5 h-5 animate-spin text-tech-yellow" /> Redactando el informe con los datos del periodo… tarda entre 10 y 40 segundos.
              </div>
            )}
            {aiError && (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-red-400">
                <span className="flex items-center gap-2"><Icons.AlertCircle className="w-4 h-4" /> {aiError}</span>
                <button onClick={() => generateAi(false)} disabled={aiLoading} className="px-3 py-1.5 rounded border border-red-500/40 hover:bg-red-500/10 uppercase tracking-wider text-[10px] disabled:opacity-50">Reintentar</button>
              </div>
            )}
            {ai && <div className={aiLoading ? 'opacity-50' : ''}><MarkdownLite text={ai.text} /></div>}
          </div>
          {ai && (
            <div className="px-4 sm:px-6 py-3 border-t border-tech-border flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-tech-muted">
              <span>Texto generado por IA a partir de los datos de este informe: revisa las cifras importantes antes de decidir.</span>
              <label className="flex items-center gap-2 cursor-pointer select-none text-tech-text">
                <input type="checkbox" checked={includeAiInPdf} onChange={(e) => setIncludeAiInPdf(e.target.checked)} className="rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card" />
                Incluir en el PDF
              </label>
            </div>
          )}
        </div>
      )}

      {loading && !report && !error && (
        <div className="flex items-center justify-center h-64 text-tech-muted"><Icons.Loader2 size={24} className="animate-spin mr-3" /> Calculando el informe…</div>
      )}

      {report && (
        <div className={`space-y-6 transition-opacity ${stale ? 'opacity-60' : ''}`} aria-busy={stale}>
          {/* ── Indicadores clave ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {headline.map((k) => <KpiTile key={k.id} kpi={k} big />)}
          </div>

          {/* ── Gráficas por día ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
            <Card
              title="Ventas por día"
              icon={Icons.TrendingUp}
              right={<span className="text-[11px] font-mono text-tech-yellow font-bold">{fmtValue(report.sales.byDay.reduce((s, d) => s + d.revenue, 0), 'eur')}</span>}
            >
              <BarChart
                ariaLabel="Ventas por día en euros"
                colorClass="fill-tech-yellow"
                format={fmtEurShort}
                data={report.sales.byDay.map((d) => ({ label: fmtDay(d.date), title: `${fmtDayLong(d.date)} · ${d.orders} ${d.orders === 1 ? 'pedido' : 'pedidos'}`, value: d.revenue }))}
                compare={report.compareSeries?.revenue}
                compareLabel={report.period.prevLabel}
              />
            </Card>
            <Card
              title="Visitantes por día"
              icon={Icons.Users}
              right={report.visits ? <span className="text-[11px] font-mono text-tech-text font-bold">{fmtValue(kpisById.get('visitors')?.value ?? 0, 'int')} únicos</span> : undefined}
            >
              {report.visits ? (
                <BarChart
                  ariaLabel="Visitantes por día"
                  colorClass="fill-sky-400"
                  format={(v) => fmtValue(v, 'int')}
                  data={report.visits.byDay.map((d) => ({ label: fmtDay(d.date), title: `${fmtDayLong(d.date)} · ${fmtValue(d.pageviews, 'int')} páginas vistas`, value: d.visitors }))}
                  compare={report.compareSeries?.visitors}
                  compareLabel={report.period.prevLabel}
                />
              ) : <p className="text-[11px] text-tech-muted font-mono py-6">Las estadísticas de visitas no están disponibles ahora.</p>}
            </Card>
          </div>

          {/* ── Embudo y carritos por día ── */}
          {report.visits && report.funnel.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
              <Card title="Del visitante al pedido" icon={Icons.Filter}><FunnelChart steps={report.funnel} /></Card>
              <Card
                title="Visitantes que añaden al carrito por día"
                icon={Icons.ShoppingCart}
                right={<span className="text-[11px] font-mono text-tech-yellow font-bold">{fmtValue(kpisById.get('carts_added_value')?.value ?? 0, 'eur')} añadidos</span>}
              >
                <BarChart
                  ariaLabel="Visitantes que añaden al carrito por día"
                  colorClass="fill-orange-400"
                  format={(v) => fmtValue(v, 'int')}
                  data={report.visits.byDay.map((d) => ({ label: fmtDay(d.date), title: `${fmtDayLong(d.date)} · ${fmtValue(d.cartValue, 'eur')} añadidos · ${d.checkouts} ${d.checkouts === 1 ? 'empieza' : 'empiezan'} a pagar`, value: d.carts }))}
                  compare={report.compareSeries?.carts}
                  compareLabel={report.period.prevLabel}
                />
              </Card>
            </div>
          )}

          {/* ── Todos los indicadores por grupo ── */}
          <div className="space-y-4">
            {GROUP_ORDER.map((g) => {
              const ks = report.kpis.filter((k) => k.group === g);
              if (!ks.length) return null;
              const open = !closedGroups.includes(g);
              return (
                <section key={g} className="bg-tech-card/40 border border-tech-border rounded-md">
                  <button onClick={() => toggleGroup(g)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                    <h3 className="text-[11px] font-mono uppercase tracking-widest text-tech-text flex items-center gap-2">
                      {GROUP_TITLES[g]} <span className="text-tech-muted">({ks.length})</span>
                    </h3>
                    <Icons.ChevronDown className={`w-4 h-4 text-tech-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                      {ks.map((k) => <KpiTile key={k.id} kpi={k} />)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {/* ── Listados ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            <RankList
              title="Productos más vendidos" icon={Icons.Package} valueHeader="Ventas" empty="No ha habido ventas en el periodo."
              rows={report.sales.topProducts.map((p) => ({ label: p.name, sub: `${p.units} ud. · ref. ${p.sku}`, value: p.revenue, valueText: fmtValue(p.revenue, 'eur') }))}
            />
            <RankList
              title="Páginas más vistas" icon={Icons.FileText} valueHeader="Vistas" empty="Sin datos de visitas."
              rows={(report.visits?.topPages || []).map((p) => ({ label: p.path, sub: p.title || undefined, value: p.views, valueText: fmtValue(p.views, 'int') }))}
            />
            <RankList
              title="De dónde vienen" icon={Icons.Compass} valueHeader="Visitantes" empty="Sin datos de visitas."
              rows={(report.visits?.sources || []).map((s) => ({ label: s.name, value: s.visitors, valueText: fmtValue(s.visitors, 'int') }))}
            />
            <RankList
              title="Dispositivos" icon={Icons.Smartphone} valueHeader="Visitantes" empty="Sin datos de visitas."
              rows={(report.visits?.devices || []).map((d) => ({ label: DEVICE_NAMES[d.device] || d.device, value: d.visitors, valueText: fmtValue(d.visitors, 'int') }))}
            />
            <RankList
              title="Ciudades" icon={Icons.MapPin} valueHeader="Visitantes" empty="Sin datos de visitas."
              rows={(report.visits?.cities || []).map((c) => ({ label: cityLabel(c.city, c.country), value: c.visitors, valueText: fmtValue(c.visitors, 'int') }))}
            />
            <RankList
              title="Búsquedas más frecuentes" icon={Icons.Search} valueHeader="Veces" empty="Nadie ha buscado en el periodo."
              rows={(report.visits?.topSearches || []).map((s) => ({ label: s.term, value: s.count }))}
            />
            <RankList
              title="Búsquedas sin resultados" icon={Icons.SearchX} valueHeader="Veces" empty="Todas las búsquedas han dado resultados."
              rows={(report.visits?.noResultSearches || []).map((s) => ({ label: s.term, value: s.count }))}
            />
            <RankList
              title="Motos que eligen" icon={Icons.Bike} valueHeader="Veces" empty="Nadie ha elegido moto en el periodo."
              rows={(report.visits?.topBikes || []).map((s) => ({ label: s.term, value: s.count }))}
            />
            <RankList
              title="Métodos de pago y cupones" icon={Icons.CreditCard} valueHeader="Importe" empty="No ha habido pagos en el periodo."
              rows={[
                ...report.sales.payments.map((p) => ({ label: PAYMENT_NAMES[p.method] || p.method, sub: `${p.orders} ${p.orders === 1 ? 'pedido' : 'pedidos'}`, value: p.revenue, valueText: fmtValue(p.revenue, 'eur') })),
                ...report.sales.coupons.map((c) => ({ label: `Cupón ${c.code}`, sub: `${c.orders} ${c.orders === 1 ? 'pedido' : 'pedidos'}`, value: Math.max(c.discount, 0.01), valueText: `−${fmtValue(c.discount, 'eur')}` })),
              ]}
            />
            <RankList
              title={`Carritos activos de más valor (${report.carts.active.count})`} icon={Icons.ShoppingBag} valueHeader="Valor" empty="No hay carritos con productos."
              rows={report.carts.top.map((c) => ({ label: `#${c.id} · ${c.email ? 'Con cuenta' : 'Invitado'}`, sub: `${c.items} ud. · ${fmtDateTime(c.updatedAt)}`, value: c.value, valueText: fmtValue(c.value, 'eur') }))}
            />
          </div>

          <p className="text-[10px] font-mono text-tech-muted leading-relaxed">
            Datos de {fmtDateTime(report.generatedAt)}. Ventas = pedidos pagados sin cancelados ni reembolsados, IVA incluido. Días naturales en hora de Madrid. Visitas y embudo: estadísticas web
            {report.excludeInternal ? ' sin el tráfico de pruebas de Canarias' : ' con todo el tráfico'}. Los carritos activos, los clientes registrados y el catálogo son una foto del momento.
            Pasa el ratón por un indicador para ver su definición.
          </p>
        </div>
      )}

      {/* ── Ventas recientes ── */}
      <div className="bg-tech-card border border-tech-border rounded-md shadow-xl">
        <div className="p-6 border-b border-tech-border">
          <h2 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text">
            <Icons.TrendingUp className="text-tech-yellow w-4 h-4" /> Ventas Recientes
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border">
                <th className="px-6 py-4 font-normal">Pedido ID</th>
                <th className="px-6 py-4 font-normal">Fecha</th>
                <th className="px-6 py-4 font-normal">Cliente</th>
                <th className="px-6 py-4 font-normal">Total</th>
                <th className="px-6 py-4 font-normal">Estado</th>
                <th className="px-6 py-4 font-normal text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tech-border">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-[#1a1b1e] transition-colors">
                  <td className="px-6 py-4 font-mono text-tech-text">#{order.id}</td>
                  <td className="px-6 py-4 text-[11px] text-tech-muted">{new Date(order.createdAt).toLocaleDateString('es-ES')}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-tech-text">{order.shippingData?.firstName} {order.shippingData?.lastName}</span>
                      <span className="text-[9px] text-tech-muted font-mono">{order.shippingData?.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-tech-yellow text-sm">{formatPrice(order.total)}</td>
                  <td className="px-6 py-4"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-[10px] text-tech-text hover:text-tech-yellow font-mono uppercase tracking-wider border border-tech-border hover:border-tech-yellow px-3 py-1.5 rounded-sm transition-all"
                    >
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-tech-muted text-xs font-mono">No hay ventas recientes registradas en la base de datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
