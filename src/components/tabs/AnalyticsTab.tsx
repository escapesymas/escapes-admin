import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { SessionDetailModal } from '../modals/SessionDetailModal';
import { HighlightsPanel } from '../analytics/HighlightsPanel';
import { ConversionPanel } from '../analytics/ConversionPanel';
import { VisitorList } from '../analytics/VisitorList';
import { DeviceIcon, ReferrerBadge, formatSecondsAgo, TIER_RANK } from '../analytics/analyticsUi';
import type { RealtimeData, RealtimeActiveUser, VisitorInsights, VisitorListItem } from '../../types/analytics';
import { formatEuros } from '../../utils/format';

interface AnalyticsStats {
  overview: {
    totalVisitors: number;
    totalPageviews: number;
    googleVisitors: number;
    directVisitors: number;
    mobileVisitors: number;
    mobilePercent: number;
    avgPagesPerVisit: number;
  };
  timeSeries: {
    label: string;
    visitors: number;
    pageviews: number;
    google: number;
  }[];
  topPages: {
    path: string;
    title: string;
    views: number;
    visitors: number;
  }[];
  topReferrers: {
    domain: string;
    visitors: number;
    views: number;
  }[];
  topLocations: {
    city: string;
    region: string;
    country: string;
    visitors: number;
  }[];
  devices: {
    device: string;
    count: number;
    percent: number;
  }[];
  operatingSystems: {
    os: string;
    count: number;
    percent: number;
  }[];
  browsers: {
    browser: string;
    count: number;
    percent: number;
  }[];
}

interface AnalyticsTabProps {
  adminToken: string;
  onOnlineCountChange?: (count: number) => void;
}

type TimeRange = 'today' | '24h' | '7d' | '30d' | 'all';

const RANGE_LABEL: Record<TimeRange, string> = { today: 'hoy', '24h': 'últimas 24 h', '7d': '7 días', '30d': '30 días', all: 'histórico' };

type KpiTone = 'emerald' | 'yellow' | 'orange' | 'pink' | 'purple' | 'blue';
const KPI_TONES: Record<KpiTone, { box: string; hover: string; value: string }> = {
  emerald: { box: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', hover: 'hover:border-emerald-500/50', value: 'text-emerald-400' },
  yellow: { box: 'bg-tech-yellow/10 border-tech-yellow/20 text-tech-yellow', hover: 'hover:border-tech-yellow/50', value: 'text-tech-text' },
  orange: { box: 'bg-orange-500/10 border-orange-500/20 text-orange-400', hover: 'hover:border-orange-500/50', value: 'text-orange-300' },
  pink: { box: 'bg-pink-500/10 border-pink-500/20 text-pink-400', hover: 'hover:border-pink-500/50', value: 'text-pink-300' },
  purple: { box: 'bg-purple-500/10 border-purple-500/20 text-purple-400', hover: 'hover:border-purple-500/50', value: 'text-tech-text' },
  blue: { box: 'bg-blue-500/10 border-blue-500/20 text-blue-400', hover: 'hover:border-blue-500/50', value: 'text-tech-text' },
};

/** Indicador de la fila superior: número grande, qué es y un dato que lo acompaña. */
const Kpi: React.FC<{
  icon: React.ElementType; tone: KpiTone; value: React.ReactNode; label: string; sub: React.ReactNode; pulse?: boolean; onClick?: () => void;
}> = ({ icon: Icon, tone, value, label, sub, pulse, onClick }) => {
  const t = KPI_TONES[tone];
  return (
    <div
      onClick={onClick}
      className={`bg-tech-card border border-tech-border rounded-md p-4 flex flex-col justify-between ${t.hover} transition-colors shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2 border rounded-md ${t.box}`}><Icon className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`} /></div>
        <span className={`text-2xl font-mono font-bold ${t.value}`}>{value}</span>
      </div>
      <div>
        <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">{label}</div>
        <div className="text-[11px] text-tech-text/70 font-mono mt-1">{sub}</div>
      </div>
    </div>
  );
};

type SubTab = 'highlights' | 'realtime' | 'conversion' | 'overview' | 'pages' | 'sources' | 'tech';

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ adminToken, onOnlineCountChange }) => {
  const [range, setRange] = useState<TimeRange>('today');
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('highlights');

  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
  const [insights, setInsights] = useState<VisitorInsights | null>(null);
  const [liveSort, setLiveSort] = useState<'priority' | 'recent'>('priority');
  const [showBounces, setShowBounces] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionSearch, setSessionSearch] = useState<string>('');

  // Carga de datos en tiempo real
  const fetchRealtime = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setRefreshing(true);
      const res = await fetch(`/api/admin/analytics/realtime?excludeInternal=${excludeInternal}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data: RealtimeData = await res.json();
        setRealtime(data);
        setLastUpdated(new Date());
        if (onOnlineCountChange) onOnlineCountChange(data.online5m);
      } else if (res.status === 401) {
        setError('Sesión expirada o requiere autenticación de dos pasos.');
      }
    } catch (err: any) {
      console.error('[FETCH REALTIME ANALYTICS ERROR]:', err);
    } finally {
      setRefreshing(false);
    }
  }, [adminToken, excludeInternal, onOnlineCountChange]);

  // Carga de estadísticas agregadas según rango
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/analytics/stats?range=${range}&excludeInternal=${excludeInternal}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) {
        const data: AnalyticsStats = await res.json();
        setStats(data);
        setError(null);
      }
    } catch (err: any) {
      console.error('[FETCH STATS ERROR]:', err);
      setError('No se pudieron cargar las métricas acumuladas.');
    }
  }, [adminToken, range, excludeInternal]);

  // Visitantes por prioridad, embudo, eventos y búsquedas del periodo
  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/analytics/visitors?range=${range}&excludeInternal=${excludeInternal}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.ok) setInsights(await res.json());
    } catch (err: any) {
      console.error('[FETCH VISITOR INSIGHTS ERROR]:', err);
    }
  }, [adminToken, range, excludeInternal]);

  // Carga inicial
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchRealtime(false), fetchStats(), fetchInsights()]);
      if (mounted) setLoading(false);
    };
    loadAll();
    return () => { mounted = false; };
  }, [fetchRealtime, fetchStats, fetchInsights]);

  // Bucle de auto-refresco (cada 5s para tiempo real, cada 30s para acumulado)
  useEffect(() => {
    if (!autoRefresh) return;

    const rtInterval = setInterval(() => {
      fetchRealtime(true);
    }, 5000);

    const statsInterval = setInterval(() => {
      fetchStats();
      fetchInsights();
    }, 30000);

    return () => {
      clearInterval(rtInterval);
      clearInterval(statsInterval);
    };
  }, [autoRefresh, fetchRealtime, fetchStats, fetchInsights]);

  const getDeviceIcon = (device: string) => <DeviceIcon device={device} />;
  const getReferrerBadge = (referrer: string | null) => <ReferrerBadge referrer={referrer} />;

  // En directo: prioridad (calientes primero, después más páginas y acciones) o lo más reciente. Los rebotes, ocultos.
  const liveItems: VisitorListItem[] = (() => {
    const q = sessionSearch.trim().toLowerCase();
    const users = (realtime?.users || []).filter((u: RealtimeActiveUser) =>
      !q || [u.city, u.currentPage, u.pageTitle, u.os, u.referrerDomain || '', ...u.searches, ...u.bikes].some((t) => t.toLowerCase().includes(q)));
    const sorted = [...users].sort((a, b) =>
      liveSort === 'recent'
        ? a.secondsAgo - b.secondsAgo
        : TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.score - a.score || a.secondsAgo - b.secondsAgo);
    return sorted.map((u) => ({
      sessionId: u.sessionId, city: u.city, region: u.region, country: u.country, device: u.device, os: u.os, browser: u.browser,
      secondsAgo: u.secondsAgo, referrer: u.referrerDomain, page: u.currentPage, pageTitle: u.pageTitle,
      signals: u.signals, tier: u.tier, score: u.score, cartValue: u.cartValue, searches: u.searches, bikes: u.bikes,
    }));
  })();
  const liveBounces = liveItems.filter((i) => i.tier === 'bounce').length;
  const liveVisible = showBounces || liveSort === 'recent' ? liveItems : liveItems.filter((i) => i.tier !== 'bounce');
  const hotNow = (realtime?.users || []).filter((u) => u.tier === 'hot').length;

  return (
    <div className="space-y-6 animate-fade-in text-tech-text min-w-0 max-w-full">
      {/* 1. Header con Controles en Vivo y Filtros */}
      <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap min-w-0">
          {/* Badge EN VIVO */}
          <div className="flex items-center gap-2.5 bg-tech-carbon px-3.5 py-2 rounded-md border border-tech-border">
            <span className="relative flex h-3 w-3">
              {autoRefresh && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${autoRefresh ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 text-tech-text">
                {autoRefresh ? 'EN VIVO' : 'PAUSADO'}
                {realtime && (
                  <span className="text-tech-yellow ml-1">
                    ({realtime.online5m} {realtime.online5m === 1 ? 'online' : 'online'})
                  </span>
                )}
              </span>
              <span className="text-[10px] text-tech-muted font-mono">
                Act. {lastUpdated.toLocaleTimeString('es-ES')}
              </span>
            </div>
          </div>

          {/* Toggle Auto-Refresco */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-xs font-mono uppercase tracking-wider transition-all ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-tech-carbon border-tech-border text-tech-muted hover:text-tech-text'
            }`}
            title={autoRefresh ? 'Pausar auto-actualización cada 5s' : 'Reanudar auto-actualización en directo'}
          >
            {autoRefresh ? <Icons.Pause size={13} /> : <Icons.Play size={13} />}
            <span>{autoRefresh ? 'Auto (5s)' : 'Pausado'}</span>
          </button>

          {/* Botón Refresco Manual */}
          <button
            onClick={() => {
              fetchRealtime(false);
              fetchStats();
              fetchInsights();
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-tech-border bg-tech-carbon text-tech-text hover:border-tech-yellow hover:text-tech-yellow text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-50"
            title="Actualizar datos ahora"
          >
            <Icons.RefreshCw size={13} className={refreshing ? 'animate-spin text-tech-yellow' : ''} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>

          {/* Toggle Excluir Tráfico Interno */}
          <label
            title="Oculta toda Canarias para no contar tus pruebas. Los clientes reales de Canarias tampoco salen mientras esté marcado."
            className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-tech-muted hover:text-tech-text bg-tech-carbon/60 px-3 py-1.5 rounded-sm border border-tech-border">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => setExcludeInternal(e.target.checked)}
              className="rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card"
            />
            <span className="text-[11px]">Excluir tráfico propio (toda Canarias)</span>
          </label>
        </div>

        {/* Selector de Rango Temporal */}
        <div className="flex items-center gap-1 bg-tech-carbon p-1 rounded-md border border-tech-border max-w-full shrink-0 overflow-x-auto">
          {(
            [
              { id: 'today', label: 'Hoy' },
              { id: '24h', label: '24 Horas' },
              { id: '7d', label: '7 Días' },
              { id: '30d', label: '30 Días' },
              { id: 'all', label: 'Histórico' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setRange(item.id)}
              className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
                range === item.id
                  ? 'bg-tech-card text-tech-yellow border border-tech-border font-bold shadow-sm'
                  : 'text-tech-muted hover:text-tech-text'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-xs font-mono text-red-400 flex items-center gap-3">
          <Icons.AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Indicadores: lo más relevante a simple vista */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <Kpi
          icon={Icons.Radio}
          tone="emerald"
          pulse
          value={realtime ? realtime.online5m : <Icons.Loader2 className="animate-spin w-5 h-5 inline" />}
          label="En línea ahora"
          sub={<>{realtime?.online15m || 0} en 15 min{hotNow > 0 && <span className="text-orange-300"> · {hotNow} {hotNow === 1 ? 'caliente' : 'calientes'}</span>}</>}
          onClick={() => setActiveSubTab('realtime')}
        />
        <Kpi
          icon={Icons.Users}
          tone="yellow"
          value={stats?.overview.totalVisitors ?? (loading ? '...' : 0)}
          label={`Visitantes únicos (${RANGE_LABEL[range]})`}
          sub={`${stats?.overview.totalPageviews ?? 0} págs · ${stats?.overview.avgPagesPerVisit ?? 0} por visita · ${stats?.overview.mobilePercent ?? 0}% móvil`}
        />
        <Kpi
          icon={Icons.Flame}
          tone="orange"
          value={insights ? insights.summary.tiers.hot + insights.summary.tiers.engaged : (loading ? '...' : 0)}
          label="Con interés"
          sub={insights && insights.summary.visitors > 0
            ? `${Math.round(((insights.summary.tiers.hot + insights.summary.tiers.engaged) / insights.summary.visitors) * 100)}% de los visitantes · ${Math.round((insights.summary.tiers.bounce / insights.summary.visitors) * 100)}% rebote`
            : 'Varias páginas o acciones importantes'}
          onClick={() => setActiveSubTab('highlights')}
        />
        <Kpi
          icon={Icons.ShoppingCart}
          tone="yellow"
          value={insights?.summary.funnel.addToCart ?? (loading ? '...' : 0)}
          label="Añadieron al carrito"
          sub={insights && insights.summary.cartValue > 0 ? `${formatEuros(insights.summary.cartValue)} en carritos` : 'Nadie en este periodo'}
          onClick={() => setActiveSubTab('conversion')}
        />
        <Kpi
          icon={Icons.CreditCard}
          tone="pink"
          value={insights?.summary.funnel.checkout ?? (loading ? '...' : 0)}
          label="Empezaron a pagar"
          sub={insights?.summary.funnel.purchase === 1 ? '1 compra registrada' : `${insights?.summary.funnel.purchase ?? 0} compras registradas`}
          onClick={() => setActiveSubTab('conversion')}
        />
        <Kpi
          icon={Icons.Search}
          tone="purple"
          value={stats?.overview.googleVisitors ?? (loading ? '...' : 0)}
          label="Desde Google"
          sub={stats && stats.overview.totalVisitors > 0
            ? `${Math.round((stats.overview.googleVisitors / stats.overview.totalVisitors) * 100)}% del total`
            : 'Búsquedas SEO'}
        />
      </div>

      {/* 3. Navegación por Subpestañas del Módulo */}
      {/* Desde 640 px las pestañas pasan a una segunda línea si no caben (antes se cortaban con un scroll escondido); en el móvil siguen con scroll lateral. */}
      <div className="flex items-center gap-x-1 gap-y-0.5 border-b border-tech-border overflow-x-auto pb-1 sm:pb-0 sm:overflow-visible sm:flex-wrap">
        {([
          { id: 'highlights', label: `Destacados (${insights ? insights.summary.tiers.hot + insights.summary.tiers.engaged : 0})`, icon: Icons.Flame, iconCls: 'text-orange-400' },
          { id: 'realtime', label: `En directo (${realtime?.users.length || 0})`, icon: Icons.Radio, iconCls: 'text-emerald-400' },
          { id: 'conversion', label: 'Conversión y búsquedas', icon: Icons.TrendingUp, iconCls: '' },
          { id: 'overview', label: 'Evolución temporal', icon: Icons.BarChart2, iconCls: '' },
          { id: 'pages', label: `Páginas y modelos (${stats?.topPages.length || 0})`, icon: Icons.FileText, iconCls: '' },
          { id: 'sources', label: 'Fuentes y ciudades', icon: Icons.Compass, iconCls: '' },
          { id: 'tech', label: 'Dispositivos y SO', icon: Icons.Cpu, iconCls: '' },
        ] as { id: SubTab; label: string; icon: React.ElementType; iconCls: string }[]).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                activeSubTab === t.id
                  ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
                  : 'border-transparent text-tech-muted hover:text-tech-text'
              }`}
            >
              <Icon className={`w-4 h-4 ${t.iconCls}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4a. CONTENIDO: VISITANTES DESTACADOS DEL PERIODO */}
      {activeSubTab === 'highlights' && (
        <HighlightsPanel insights={insights} loading={loading} rangeLabel={RANGE_LABEL[range]} onSelect={setSelectedSessionId} />
      )}

      {/* 4b. CONTENIDO: EMBUDO, EVENTOS Y BÚSQUEDAS */}
      {activeSubTab === 'conversion' && (
        <ConversionPanel insights={insights} loading={loading} rangeLabel={RANGE_LABEL[range]} />
      )}

      {/* 4c. CONTENIDO: SUBPESTAÑA EN DIRECTO */}
      {activeSubTab === 'realtime' && (
        <div className="space-y-6">
          {/* Bloque de Usuarios Activos Ahora */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-tech-border flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text">
                  <Icons.Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  Sesiones activas en los últimos 30 minutos
                </h3>
                <p className="text-[11px] text-tech-muted font-mono mt-1">
                  Las cifras son de toda su visita actual. Toca un visitante para ver sus páginas, búsquedas y recorrido completo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Orden: prioridad o más recientes */}
                <div className="flex rounded border border-tech-border overflow-hidden text-[10px] font-mono uppercase">
                  {([['priority', 'Por prioridad'], ['recent', 'Más recientes']] as const).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setLiveSort(id)}
                      className={`px-3 py-1.5 transition-colors ${liveSort === id ? 'bg-tech-yellow text-black font-bold' : 'bg-tech-carbon text-tech-muted hover:text-tech-text'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Buscador de sesiones */}
                <div className="relative w-full sm:w-56">
                  <Icons.Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tech-muted" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Filtrar ciudad, URL..."
                    className="w-full bg-tech-carbon border border-tech-border rounded px-3 py-1.5 pl-8 text-xs font-mono text-tech-text focus:border-tech-yellow focus:outline-none"
                  />
                  {sessionSearch && (
                    <button onClick={() => setSessionSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tech-muted hover:text-tech-text">
                      <Icons.X size={12} />
                    </button>
                  )}
                </div>

                <span className="text-xs font-mono bg-tech-carbon px-3 py-1.5 rounded border border-tech-border text-tech-yellow whitespace-nowrap hidden sm:inline-block">
                  {realtime?.users.length || 0} sesiones
                </span>
              </div>
            </div>

            <VisitorList
              items={liveVisible}
              onSelect={setSelectedSessionId}
              pageLabel="Página actual"
              ariaLabel="Tabla de usuarios activos en tiempo real"
              emptyMessage={
                realtime?.users.length === 0
                  ? 'No hay visitantes activos en este momento. Los nuevos accesos aparecerán aquí en vivo en cuanto entren a la web.'
                  : liveItems.length === 0
                    ? 'No hay sesiones que coincidan con el filtro.'
                    : 'Ahora mismo solo hay visitantes que han visto una página.'
              }
            />

            {liveSort === 'priority' && liveBounces > 0 && (
              <button
                onClick={() => setShowBounces(!showBounces)}
                className="w-full px-4 py-3 border-t border-tech-border text-[11px] font-mono text-tech-muted hover:text-tech-yellow hover:bg-[#1a1b1e] transition-colors flex items-center justify-center gap-2"
              >
                <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBounces ? 'rotate-180' : ''}`} />
                {showBounces
                  ? 'Ocultar los visitantes de una sola página'
                  : `Mostrar ${liveBounces} ${liveBounces === 1 ? 'visitante que solo ha visto' : 'visitantes que solo han visto'} 1 página`}
              </button>
            )}
          </div>

          {/* Feed de Páginas Vistas Recientes (Actividad en Vivo) */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-4 sm:p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.Activity className="w-4 h-4 text-tech-yellow" />
              Feed en Directo: Últimas Páginas Vistas
            </h3>
            <div className="divide-y divide-tech-border">
              {realtime?.recentPageviews.slice(0, 15).map((pv) => (
                <div
                  key={pv.eventId}
                  onClick={() => setSelectedSessionId(pv.sessionId)}
                  className="py-3 flex items-center justify-between gap-4 text-xs font-mono flex-wrap sm:flex-nowrap cursor-pointer hover:bg-[#1a1b1e] p-2 rounded transition-colors"
                  title="Haz clic para ver el recorrido completo de este visitante"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] text-tech-muted w-20 flex-shrink-0">
                      {formatSecondsAgo(pv.secondsAgo)}
                    </span>
                    <span className="flex-shrink-0">{getDeviceIcon(pv.device)}</span>
                    <a
                      href={`https://escapesymas.com${pv.urlPath}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-tech-yellow hover:underline truncate"
                      title={pv.urlPath}
                    >
                      {pv.urlPath}
                    </a>
                  </div>
                  <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                    <span className="text-[11px] text-tech-muted flex items-center gap-1">
                      <Icons.MapPin className="w-3 h-3 text-tech-yellow/70" /> {pv.city} ({pv.country})
                    </span>
                    {getReferrerBadge(pv.referrerDomain)}
                    <span className="text-[10px] text-tech-muted hover:text-tech-yellow hidden sm:inline">
                      Ver →
                    </span>
                  </div>
                </div>
              ))}
              {(!realtime || realtime.recentPageviews.length === 0) && (
                <div className="py-6 text-center text-tech-muted text-xs font-mono">
                  Sin actividad reciente registrada en los últimos 30 minutos.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. CONTENIDO: SUBPESTAÑA EVOLUCIÓN TEMPORAL (GRÁFICO) */}
      {activeSubTab === 'overview' && stats && (
        <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl space-y-5 min-w-0 max-w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-tech-border pb-4">
            <div>
              <h3 className="text-sm font-mono uppercase tracking-wider text-tech-text flex items-center gap-2">
                <Icons.TrendingUp className="w-4 h-4 text-tech-yellow" />
                Curva de Tráfico ({range === 'today' ? 'Hoy por Horas' : `Periodo ${range}`})
              </h3>
              <p className="text-[11px] text-tech-muted font-mono mt-1">
                Comparativa entre páginas vistas totales, visitantes únicos y tráfico orgánico de Google.
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm" /> Páginas vistas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-tech-yellow rounded-sm" /> Visitantes únicos
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" /> Google Orgánico
              </span>
            </div>
          </div>

          {/* Gráfico de Barras con Desplazamiento Horizontal Autónomo en Móvil */}
          {stats.timeSeries.length > 0 ? (
            <div className="w-full min-w-0">
              <div className="w-full overflow-x-auto pb-3 pt-1 scrollbar-thin overscroll-x-contain touch-pan-x">
                <div className="h-64 sm:h-72 min-w-[560px] sm:min-w-0 w-full flex items-end gap-1 sm:gap-2.5 pt-8 pb-3 px-3 bg-tech-carbon/60 rounded border border-tech-border relative">
                  {(() => {
                    const maxVal = Math.max(
                      ...stats.timeSeries.map((d) => Math.max(d.pageviews, d.visitors, d.google)),
                      5
                    );

                    return (
                      <>
                        {/* Líneas de guía horizontales de fondo */}
                        <div className="absolute inset-x-3 top-8 bottom-8 flex flex-col justify-between pointer-events-none opacity-20 z-0">
                          <div className="border-b border-dashed border-tech-muted w-full relative">
                            <span className="absolute -top-3.5 right-0 text-[8px] font-mono text-tech-muted">{maxVal}</span>
                          </div>
                          <div className="border-b border-dashed border-tech-muted w-full relative">
                            <span className="absolute -top-3.5 right-0 text-[8px] font-mono text-tech-muted">{Math.round(maxVal * 0.66)}</span>
                          </div>
                          <div className="border-b border-dashed border-tech-muted w-full relative">
                            <span className="absolute -top-3.5 right-0 text-[8px] font-mono text-tech-muted">{Math.round(maxVal * 0.33)}</span>
                          </div>
                          <div className="border-b border-tech-border/50 w-full" />
                        </div>

                        {stats.timeSeries.map((point, idx) => {
                          const pvHeight = Math.max(4, Math.round((point.pageviews / maxVal) * 100));
                          const visHeight = Math.max(4, Math.round((point.visitors / maxVal) * 100));
                          const gooHeight = Math.max(2, Math.round((point.google / maxVal) * 100));
                          const isHovered = hoveredPoint === idx;

                          return (
                            <div
                              key={idx}
                              className="flex-1 min-w-[18px] sm:min-w-0 h-full flex flex-col justify-end items-center group relative cursor-pointer select-none z-10"
                              onMouseEnter={() => setHoveredPoint(idx)}
                              onMouseLeave={() => setHoveredPoint(null)}
                              onClick={() => setHoveredPoint(hoveredPoint === idx ? null : idx)}
                            >
                              {/* Tooltip flotante al pasar el ratón o pulsar en móvil */}
                              {isHovered && (
                                <div className="absolute bottom-full mb-2 z-30 bg-tech-card/95 backdrop-blur-md border border-tech-border rounded p-2.5 shadow-2xl text-[10px] font-mono min-w-[130px] pointer-events-none animate-fade-in -translate-x-1/2 left-1/2 whitespace-nowrap">
                                  <div className="text-tech-yellow font-bold border-b border-tech-border pb-1 mb-1.5 flex items-center justify-between gap-2">
                                    <span>{point.label}</span>
                                    <span className="text-[8px] text-tech-muted font-normal">Detalle</span>
                                  </div>
                                  <div className="flex justify-between items-center text-blue-400 py-0.5">
                                    <span>Páginas:</span> <strong>{point.pageviews}</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-tech-text py-0.5">
                                    <span>Visitantes:</span> <strong>{point.visitors}</strong>
                                  </div>
                                  <div className="flex justify-between items-center text-emerald-400 py-0.5">
                                    <span>Google:</span> <strong>{point.google}</strong>
                                  </div>
                                </div>
                              )}

                              {/* Barras agrupadas */}
                              <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                                {/* Barra Páginas Vistas */}
                                <div
                                  className={`w-full max-w-[10px] sm:max-w-[12px] bg-blue-500/80 rounded-t-sm transition-all duration-300 ${
                                    isHovered ? 'bg-blue-400 ring-1 ring-blue-300' : ''
                                  }`}
                                  style={{ height: `${pvHeight}%` }}
                                />
                                {/* Barra Visitantes */}
                                <div
                                  className={`w-full max-w-[10px] sm:max-w-[12px] bg-tech-yellow/80 rounded-t-sm transition-all duration-300 ${
                                    isHovered ? 'bg-tech-yellow ring-1 ring-yellow-200' : ''
                                  }`}
                                  style={{ height: `${visHeight}%` }}
                                />
                                {/* Barra Google */}
                                <div
                                  className={`w-full max-w-[10px] sm:max-w-[12px] bg-emerald-400/80 rounded-t-sm transition-all duration-300 ${
                                    isHovered ? 'bg-emerald-300 ring-1 ring-emerald-200' : ''
                                  }`}
                                  style={{ height: `${gooHeight}%` }}
                                />
                              </div>

                              {/* Etiqueta X */}
                              <span className="text-[9px] font-mono text-tech-muted mt-2 truncate w-full text-center">
                                {point.label}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Pista de interacción para dispositivos móviles */}
              <div className="sm:hidden flex items-center justify-between text-[10px] text-tech-muted font-mono pt-1 px-1">
                <span className="flex items-center gap-1 text-tech-yellow/80">
                  <Icons.Info className="w-3 h-3" />
                  Toca una barra para ver datos
                </span>
                <span>← Desliza para explorar →</span>
              </div>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-tech-muted text-xs font-mono">
              No hay datos suficientes para graficar en este rango temporal.
            </div>
          )}
        </div>
      )}

      {/* 6. CONTENIDO: SUBPESTAÑA PÁGINAS Y MODELOS */}
      {activeSubTab === 'pages' && stats && (
        <div className="bg-tech-card border border-tech-border rounded-md shadow-xl overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-tech-border flex items-center justify-between">
            <h3 className="text-sm font-mono uppercase tracking-wider text-tech-text flex items-center gap-2">
              <Icons.FileText className="w-4 h-4 text-tech-yellow" />
              Ranking de Páginas y Modelos Más Vistos
            </h3>
            <span className="text-xs font-mono text-tech-muted">Top 25 URLs</span>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-label="Ranking de páginas y modelos más vistos"
            className="overflow-x-auto focus:outline-none"
          >
            <table className="w-full text-left border-collapse">
              <thead className="bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border">
                <tr>
                  <th className="px-6 py-4">URL / Ficha</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4 text-right">Visitas Únicas</th>
                  <th className="px-6 py-4 text-right">Páginas Vistas</th>
                  <th className="px-6 py-4 text-right w-48">Popularidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-tech-border">
                {(() => {
                  const maxViews = Math.max(...stats.topPages.map((p) => p.views), 1);
                  return stats.topPages.map((page, idx) => {
                    const isEscape = page.path.startsWith('/escapes/');
                    const isProduct = page.path.startsWith('/producto/');
                    const isHome = page.path === '/';
                    const isUniversales = page.path === '/universales';

                    const pct = Math.round((page.views / maxViews) * 100);

                    return (
                      <tr key={page.path} className="hover:bg-[#1a1b1e] transition-colors">
                        <td className="px-6 py-3.5 font-mono text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-tech-muted text-[10px] w-5 pt-0.5">#{idx + 1}</span>
                            <div className="flex flex-col min-w-0">
                              <a
                                href={`https://escapesymas.com${page.path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-tech-text hover:text-tech-yellow hover:underline truncate max-w-lg flex items-center gap-1.5"
                              >
                                <span className="truncate">{page.path}</span>
                                <Icons.ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                              </a>
                              {page.title && (
                                <span className="text-[10px] text-tech-muted truncate max-w-lg" title={page.title}>{page.title}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 whitespace-nowrap">
                          {isEscape && (
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                              Moto
                            </span>
                          )}
                          {isProduct && (
                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                              Producto
                            </span>
                          )}
                          {isHome && (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                              Inicio
                            </span>
                          )}
                          {isUniversales && (
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                              Catálogo
                            </span>
                          )}
                          {!isEscape && !isProduct && !isHome && !isUniversales && (
                            <span className="bg-tech-carbon text-tech-muted border border-tech-border px-2 py-0.5 rounded text-[10px] font-mono">
                              Otra
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-xs text-tech-text">
                          {page.visitors}
                        </td>
                        <td className="px-6 py-3.5 text-right font-mono text-xs text-tech-yellow font-bold">
                          {page.views}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="w-full bg-tech-carbon h-2 rounded-sm overflow-hidden border border-tech-border/50">
                            <div className="bg-tech-yellow h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}

                {stats.topPages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-tech-muted text-xs font-mono">
                      No hay registros de páginas para este rango temporal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. CONTENIDO: SUBPESTAÑA FUENTES Y CIUDADES */}
      {activeSubTab === 'sources' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Canales y Referrers */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.Compass className="w-4 h-4 text-tech-yellow" />
              Canales de Entrada / Referrers
            </h3>
            <div className="space-y-3">
              {stats.topReferrers.map((ref) => {
                const total = stats.overview.totalVisitors || 1;
                const pct = Math.round((ref.visitors / total) * 100);
                return (
                  <div key={ref.domain} className="bg-tech-carbon p-3 rounded border border-tech-border">
                    <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                      <span className="font-bold text-tech-text">{ref.domain}</span>
                      <span className="text-tech-yellow font-mono">
                        {ref.visitors} visitantes ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-[#1a1b1e] h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                      <div className="bg-tech-yellow h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranking de Ciudades */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.MapPin className="w-4 h-4 text-tech-yellow" />
              Top Ciudades y Provincias
            </h3>
            <div className="divide-y divide-tech-border max-h-[420px] overflow-y-auto">
              {stats.topLocations.map((loc, idx) => (
                <div key={idx} className="py-2.5 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-tech-muted w-5">#{idx + 1}</span>
                    <span className="text-tech-text font-medium">{loc.city}</span>
                    <span className="text-[10px] text-tech-muted">
                      ({loc.region ? `${loc.region}, ` : ''}{loc.country})
                    </span>
                  </div>
                  <span className="text-tech-yellow font-bold">
                    {loc.visitors} {loc.visitors === 1 ? 'visita' : 'visitas'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 8. CONTENIDO: SUBPESTAÑA TECNOLOGÍA (DISPOSITIVOS, SO, BROWSERS) */}
      {activeSubTab === 'tech' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Dispositivos */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.Smartphone className="w-4 h-4 text-tech-yellow" />
              Dispositivos
            </h3>
            <div className="space-y-3">
              {stats.devices.map((d) => (
                <div key={d.device} className="bg-tech-carbon p-3 rounded border border-tech-border">
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="capitalize text-tech-text">{d.device}</span>
                    <span className="text-tech-yellow font-bold">{d.count} ({d.percent}%)</span>
                  </div>
                  <div className="w-full bg-[#1a1b1e] h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div className="bg-tech-yellow h-full" style={{ width: `${d.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sistemas Operativos */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.Cpu className="w-4 h-4 text-tech-yellow" />
              Sistemas Operativos
            </h3>
            <div className="space-y-3">
              {stats.operatingSystems.map((o) => (
                <div key={o.os} className="bg-tech-carbon p-3 rounded border border-tech-border">
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="text-tech-text">{o.os}</span>
                    <span className="text-tech-yellow font-bold">{o.count} ({o.percent}%)</span>
                  </div>
                  <div className="w-full bg-[#1a1b1e] h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div className="bg-tech-yellow h-full" style={{ width: `${o.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navegadores */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl p-6">
            <h3 className="text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3">
              <Icons.Globe className="w-4 h-4 text-tech-yellow" />
              Navegadores
            </h3>
            <div className="space-y-3">
              {stats.browsers.map((b) => (
                <div key={b.browser} className="bg-tech-carbon p-3 rounded border border-tech-border">
                  <div className="flex justify-between items-center text-xs font-mono mb-1.5">
                    <span className="capitalize text-tech-text">{b.browser}</span>
                    <span className="text-tech-yellow font-bold">{b.count} ({b.percent}%)</span>
                  </div>
                  <div className="w-full bg-[#1a1b1e] h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div className="bg-tech-yellow h-full" style={{ width: `${b.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Inspección de Recorrido de Sesión */}
      {selectedSessionId && (
        <SessionDetailModal
          sessionId={selectedSessionId}
          adminToken={adminToken}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
};
