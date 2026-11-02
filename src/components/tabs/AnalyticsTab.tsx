import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { SessionDetailModal } from '../modals/SessionDetailModal';

interface RealtimeActiveUser {
  sessionId: string;
  city: string;
  region: string;
  country: string;
  device: string;
  os: string;
  browser: string;
  lastActiveAt: string;
  sessionStart: string;
  secondsAgo: number;
  totalEvents: number;
  currentPage: string;
  pageTitle: string;
  referrerDomain: string | null;
}

interface RealtimePageView {
  eventId: string;
  sessionId: string;
  createdAt: string;
  secondsAgo: number;
  urlPath: string;
  pageTitle: string;
  referrerDomain: string | null;
  city: string;
  country: string;
  device: string;
}

interface RealtimeData {
  online5m: number;
  online15m: number;
  online30m: number;
  users: RealtimeActiveUser[];
  recentPageviews: RealtimePageView[];
  timestamp: string;
}

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

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ adminToken, onOnlineCountChange }) => {
  const [range, setRange] = useState<TimeRange>('today');
  const [excludeInternal, setExcludeInternal] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'realtime' | 'overview' | 'pages' | 'sources' | 'tech'>('realtime');

  const [realtime, setRealtime] = useState<RealtimeData | null>(null);
  const [stats, setStats] = useState<AnalyticsStats | null>(null);
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

  // Carga inicial
  useEffect(() => {
    let mounted = true;
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchRealtime(false), fetchStats()]);
      if (mounted) setLoading(false);
    };
    loadAll();
    return () => { mounted = false; };
  }, [fetchRealtime, fetchStats]);

  // Bucle de auto-refresco (cada 5s para tiempo real, cada 30s para acumulado)
  useEffect(() => {
    if (!autoRefresh) return;

    const rtInterval = setInterval(() => {
      fetchRealtime(true);
    }, 5000);

    const statsInterval = setInterval(() => {
      fetchStats();
    }, 30000);

    return () => {
      clearInterval(rtInterval);
      clearInterval(statsInterval);
    };
  }, [autoRefresh, fetchRealtime, fetchStats]);

  const formatSecondsAgo = (seconds: number) => {
    if (seconds < 20) return 'Activo ahora';
    if (seconds < 60) return `Hace ${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    return `Hace ${hours}h`;
  };

  const getDeviceIcon = (device: string) => {
    const d = device.toLowerCase();
    if (d.includes('mobile')) {
      return (
        <span title="Móvil">
          <Icons.Smartphone className="w-3.5 h-3.5 text-tech-yellow" />
        </span>
      );
    }
    if (d.includes('tablet')) {
      return (
        <span title="Tablet">
          <Icons.Tablet className="w-3.5 h-3.5 text-blue-400" />
        </span>
      );
    }
    return (
      <span title="Ordenador">
        <Icons.Monitor className="w-3.5 h-3.5 text-purple-400" />
      </span>
    );
  };

  const getReferrerBadge = (referrer: string | null) => {
    if (!referrer || referrer === '') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Icons.Compass className="w-3 h-3" /> Directo
        </span>
      );
    }
    const ref = referrer.toLowerCase();
    if (ref.includes('googlequicksearchbox') || ref.includes('quicksearchbox') || ref.includes('google')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Icons.Search className="w-3 h-3" /> {ref.includes('quicksearchbox') ? 'Google (App)' : 'Google'}
        </span>
      );
    }
    if (ref.includes('instagram') || ref.includes('tiktok') || ref.includes('facebook')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
          <Icons.Share2 className="w-3 h-3" /> Social
        </span>
      );
    }
    if (ref.includes('escapesymas')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-tech-carbon text-tech-muted border border-tech-border">
          Interno
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <Icons.Globe className="w-3 h-3" /> {referrer}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in text-tech-text min-w-0 max-w-full">
      {/* 1. Header con Controles en Vivo y Filtros */}
      <div className="bg-tech-card border border-tech-border rounded-md p-4 sm:p-6 shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
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
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-tech-border bg-tech-carbon text-tech-text hover:border-tech-yellow hover:text-tech-yellow text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-50"
            title="Actualizar datos ahora"
          >
            <Icons.RefreshCw size={13} className={refreshing ? 'animate-spin text-tech-yellow' : ''} />
            <span className="hidden sm:inline">Refrescar</span>
          </button>

          {/* Toggle Excluir Tráfico Interno */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-mono text-tech-muted hover:text-tech-text bg-tech-carbon/60 px-3 py-1.5 rounded-sm border border-tech-border">
            <input
              type="checkbox"
              checked={excludeInternal}
              onChange={(e) => setExcludeInternal(e.target.checked)}
              className="rounded border-tech-border text-tech-yellow focus:ring-0 bg-tech-card"
            />
            <span className="text-[11px]">Excluir tráfico propio (Canarias)</span>
          </label>
        </div>

        {/* Selector de Rango Temporal */}
        <div className="flex items-center gap-1 bg-tech-carbon p-1 rounded-md border border-tech-border w-full lg:w-auto overflow-x-auto">
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

      {/* 2. Tarjetas de Usuarios en Línea y KPIs en Directo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Online Ahora */}
        <div className="bg-tech-card border border-tech-border rounded-md p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400">
              <Icons.Radio className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-3xl font-mono font-bold text-emerald-400">
              {realtime ? realtime.online5m : <Icons.Loader2 className="animate-spin w-6 h-6 inline" />}
            </span>
          </div>
          <div>
            <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">
              Usuarios en línea (últimos 5m)
            </div>
            <div className="text-[11px] text-tech-text/70 font-mono mt-1">
              {realtime?.online15m || 0} activos en los últimos 15 min
            </div>
          </div>
        </div>

        {/* KPI 2: Total Visitantes Periodo */}
        <div className="bg-tech-card border border-tech-border rounded-md p-5 flex flex-col justify-between hover:border-tech-yellow/50 transition-colors shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-tech-carbon border border-tech-border rounded-md text-tech-yellow">
              <Icons.Users className="w-5 h-5" />
            </div>
            <span className="text-3xl font-mono font-bold text-tech-text">
              {stats?.overview.totalVisitors ?? (loading ? '...' : 0)}
            </span>
          </div>
          <div>
            <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">
              Visitantes Únicos ({range === 'today' ? 'Hoy' : range})
            </div>
            <div className="text-[11px] text-tech-text/70 font-mono mt-1">
              {stats?.overview.mobilePercent ?? 0}% desde dispositivos móviles
            </div>
          </div>
        </div>

        {/* KPI 3: Páginas Vistas */}
        <div className="bg-tech-card border border-tech-border rounded-md p-5 flex flex-col justify-between hover:border-blue-500/50 transition-colors shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-md text-blue-400">
              <Icons.Eye className="w-5 h-5" />
            </div>
            <span className="text-3xl font-mono font-bold text-tech-text">
              {stats?.overview.totalPageviews ?? (loading ? '...' : 0)}
            </span>
          </div>
          <div>
            <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">
              Páginas Vistas Totales
            </div>
            <div className="text-[11px] text-tech-text/70 font-mono mt-1">
              Promedio: {stats?.overview.avgPagesPerVisit ?? 0} págs / sesión
            </div>
          </div>
        </div>

        {/* KPI 4: Google Orgánico */}
        <div className="bg-tech-card border border-tech-border rounded-md p-5 flex flex-col justify-between hover:border-purple-500/50 transition-colors shadow-lg">
          <div className="flex justify-between items-start mb-3">
            <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-md text-purple-400">
              <Icons.Search className="w-5 h-5" />
            </div>
            <span className="text-3xl font-mono font-bold text-tech-text">
              {stats?.overview.googleVisitors ?? (loading ? '...' : 0)}
            </span>
          </div>
          <div>
            <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">
              Tráfico Orgánico de Google
            </div>
            <div className="text-[11px] text-tech-text/70 font-mono mt-1">
              {stats && stats.overview.totalVisitors > 0
                ? `${Math.round((stats.overview.googleVisitors / stats.overview.totalVisitors) * 100)}% del total`
                : 'Búsquedas SEO'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Navegación por Subpestañas del Módulo */}
      <div className="flex items-center gap-2 border-b border-tech-border overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('realtime')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'realtime'
              ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
              : 'border-transparent text-tech-muted hover:text-tech-text'
          }`}
        >
          <Icons.Radio className="w-4 h-4 text-emerald-400" />
          <span>En Directo ({realtime?.users.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'overview'
              ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
              : 'border-transparent text-tech-muted hover:text-tech-text'
          }`}
        >
          <Icons.BarChart2 className="w-4 h-4" />
          <span>Evolución Temporal</span>
        </button>

        <button
          onClick={() => setActiveSubTab('pages')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'pages'
              ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
              : 'border-transparent text-tech-muted hover:text-tech-text'
          }`}
        >
          <Icons.FileText className="w-4 h-4" />
          <span>Páginas y Modelos ({stats?.topPages.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('sources')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'sources'
              ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
              : 'border-transparent text-tech-muted hover:text-tech-text'
          }`}
        >
          <Icons.Compass className="w-4 h-4" />
          <span>Fuentes y Ciudades</span>
        </button>

        <button
          onClick={() => setActiveSubTab('tech')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'tech'
              ? 'border-tech-yellow text-tech-yellow font-bold bg-tech-card/50'
              : 'border-transparent text-tech-muted hover:text-tech-text'
          }`}
        >
          <Icons.Cpu className="w-4 h-4" />
          <span>Dispositivos y SO</span>
        </button>
      </div>

      {/* 4. CONTENIDO: SUBPESTAÑA EN DIRECTO */}
      {activeSubTab === 'realtime' && (
        <div className="space-y-6">
          {/* Bloque de Usuarios Activos Ahora */}
          <div className="bg-tech-card border border-tech-border rounded-md shadow-xl overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-tech-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text">
                  <Icons.Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                  Sesiones Activas en los Últimos 30 Minutos
                </h3>
                <p className="text-[11px] text-tech-muted font-mono mt-1">
                  Toca o haz clic en cualquier visitante para ver todas sus páginas, búsquedas y recorrido completo.
                </p>
              </div>

              {/* Buscador de sesiones */}
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Icons.Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tech-muted" />
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    placeholder="Filtrar ciudad, URL..."
                    className="w-full bg-tech-carbon border border-tech-border rounded px-3 py-1.5 pl-8 text-xs font-mono text-tech-text focus:border-tech-yellow focus:outline-none"
                  />
                  {sessionSearch && (
                    <button
                      onClick={() => setSessionSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tech-muted hover:text-tech-text"
                    >
                      <Icons.X size={12} />
                    </button>
                  )}
                </div>

                <span className="text-xs font-mono bg-tech-carbon px-3 py-1.5 rounded border border-tech-border text-tech-yellow whitespace-nowrap hidden sm:inline-block">
                  {realtime?.users.length || 0} sesiones
                </span>
              </div>
            </div>

            {/* VISTA MÓVIL: Tarjetas legibles sin scroll horizontal incómodo */}
            <div className="block md:hidden divide-y divide-tech-border">
              {(() => {
                const filtered = (realtime?.users || []).filter((u) => {
                  if (!sessionSearch.trim()) return true;
                  const q = sessionSearch.toLowerCase();
                  return (
                    u.city.toLowerCase().includes(q) ||
                    u.currentPage.toLowerCase().includes(q) ||
                    u.pageTitle.toLowerCase().includes(q) ||
                    u.os.toLowerCase().includes(q) ||
                    (u.referrerDomain && u.referrerDomain.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="px-4 py-12 text-center text-tech-muted text-xs font-mono">
                      No hay sesiones que coincidan con la búsqueda.
                    </div>
                  );
                }

                return filtered.map((user) => {
                  const isSuperFresh = user.secondsAgo <= 60;
                  return (
                    <div
                      key={user.sessionId}
                      onClick={() => setSelectedSessionId(user.sessionId)}
                      className={`p-4 space-y-3 cursor-pointer hover:bg-[#1a1b1e] active:bg-[#222428] transition-colors ${
                        isSuperFresh ? 'bg-emerald-500/[0.04]' : ''
                      }`}
                    >
                      {/* Fila superior: Estado + Ubicación + Referrer */}
                      <div className="flex items-center justify-between gap-2 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              isSuperFresh
                                ? 'bg-emerald-500 animate-ping'
                                : user.secondsAgo <= 300
                                ? 'bg-emerald-500'
                                : 'bg-zinc-600'
                            }`}
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              isSuperFresh ? 'text-emerald-400' : 'text-tech-text'
                            }`}
                          >
                            {formatSecondsAgo(user.secondsAgo)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-tech-muted flex items-center gap-1 font-mono">
                            <Icons.MapPin size={12} className="text-tech-yellow" />
                            {user.city} ({user.country})
                          </span>
                          {getReferrerBadge(user.referrerDomain)}
                        </div>
                      </div>

                      {/* Fila central: Página que está viendo */}
                      <div className="bg-tech-carbon p-3 rounded border border-tech-border/80">
                        <div className="text-[9px] text-tech-muted font-mono uppercase tracking-wider mb-0.5">
                          Página actual
                        </div>
                        <div className="text-xs font-mono font-bold text-tech-yellow truncate flex items-center gap-1">
                          <span className="truncate">{user.currentPage}</span>
                          <Icons.ExternalLink size={12} className="opacity-60 flex-shrink-0" />
                        </div>
                        {user.pageTitle && (
                          <div className="text-[10px] text-tech-muted truncate mt-0.5">
                            {user.pageTitle}
                          </div>
                        )}
                      </div>

                      {/* Fila inferior: Dispositivo + Llamada a inspección */}
                      <div className="flex items-center justify-between text-xs font-mono pt-0.5">
                        <div className="flex items-center gap-1.5 text-tech-muted text-[11px]">
                          {getDeviceIcon(user.device)}
                          <span>{user.os} · {user.browser}</span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-tech-yellow font-bold bg-tech-yellow/10 px-2.5 py-1 rounded border border-tech-yellow/20">
                          <span>{user.totalEvents} {user.totalEvents === 1 ? 'pág' : 'págs'} · Ver recorrido</span>
                          <Icons.ArrowRight size={12} />
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* VISTA ESCRITORIO: Tabla completa con sticky headers y clic para inspección */}
            <div
              tabIndex={0}
              role="region"
              aria-label="Tabla de usuarios activos en tiempo real"
              className="hidden md:block overflow-x-auto max-h-[600px] focus:outline-none focus:ring-1 focus:ring-tech-yellow/50"
            >
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border shadow-sm">
                  <tr>
                    <th className="px-4 sm:px-6 py-3.5">Estado</th>
                    <th className="px-4 sm:px-6 py-3.5">Ubicación</th>
                    <th className="px-4 sm:px-6 py-3.5">Página Actual</th>
                    <th className="px-4 sm:px-6 py-3.5">Origen / Referrer</th>
                    <th className="px-4 sm:px-6 py-3.5">Dispositivo</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Eventos</th>
                    <th className="px-4 sm:px-6 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tech-border">
                  {(() => {
                    const filtered = (realtime?.users || []).filter((u) => {
                      if (!sessionSearch.trim()) return true;
                      const q = sessionSearch.toLowerCase();
                      return (
                        u.city.toLowerCase().includes(q) ||
                        u.currentPage.toLowerCase().includes(q) ||
                        u.pageTitle.toLowerCase().includes(q) ||
                        u.os.toLowerCase().includes(q) ||
                        (u.referrerDomain && u.referrerDomain.toLowerCase().includes(q))
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-tech-muted text-xs font-mono">
                            {realtime?.users.length === 0
                              ? 'No hay visitantes activos en este momento. Los nuevos accesos aparecerán aquí en vivo en cuanto entren a la web.'
                              : 'No hay sesiones que coincidan con el filtro.'}
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((user) => {
                      const isSuperFresh = user.secondsAgo <= 60;
                      return (
                        <tr
                          key={user.sessionId}
                          onClick={() => setSelectedSessionId(user.sessionId)}
                          className={`hover:bg-[#1a1b1e] cursor-pointer transition-colors ${
                            isSuperFresh ? 'bg-emerald-500/[0.03]' : ''
                          }`}
                        >
                          {/* Estado / Tiempo transcurrido */}
                          <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isSuperFresh
                                    ? 'bg-emerald-500 animate-ping'
                                    : user.secondsAgo <= 300
                                    ? 'bg-emerald-500'
                                    : 'bg-zinc-600'
                                }`}
                              />
                              <span
                                className={`text-[11px] font-mono font-medium ${
                                  isSuperFresh
                                    ? 'text-emerald-400 font-bold'
                                    : user.secondsAgo <= 300
                                    ? 'text-emerald-300'
                                    : 'text-tech-muted'
                                }`}
                              >
                                {formatSecondsAgo(user.secondsAgo)}
                              </span>
                            </div>
                          </td>

                          {/* Ubicación */}
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <Icons.MapPin className="w-3.5 h-3.5 text-tech-yellow flex-shrink-0" />
                              <div className="flex flex-col">
                                <span className="text-xs font-mono font-medium text-tech-text">
                                  {user.city}
                                </span>
                                <span className="text-[10px] text-tech-muted font-mono">
                                  {user.region ? `${user.region}, ` : ''}{user.country}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Página actual que está viendo */}
                          <td className="px-4 sm:px-6 py-3.5">
                            <div className="flex flex-col gap-0.5 max-w-md">
                              <a
                                href={`https://escapesymas.com${user.currentPage}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-mono text-tech-yellow hover:underline truncate flex items-center gap-1"
                                title={user.currentPage}
                              >
                                <span className="truncate">{user.currentPage}</span>
                                <Icons.ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
                              </a>
                              {user.pageTitle && (
                                <span className="text-[10px] text-tech-muted truncate" title={user.pageTitle}>
                                  {user.pageTitle}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Origen / Referrer */}
                          <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                            {getReferrerBadge(user.referrerDomain)}
                          </td>

                          {/* Dispositivo y Navegador */}
                          <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getDeviceIcon(user.device)}
                              <div className="flex flex-col text-[11px] font-mono">
                                <span className="text-tech-text">{user.os}</span>
                                <span className="text-[9px] text-tech-muted">{user.browser}</span>
                              </div>
                            </div>
                          </td>

                          {/* Total eventos */}
                          <td className="px-4 sm:px-6 py-3.5 text-right font-mono text-xs text-tech-muted">
                            {user.totalEvents} {user.totalEvents === 1 ? 'vista' : 'vistas'}
                          </td>

                          {/* Botón Ver Recorrido */}
                          <td className="px-4 sm:px-6 py-3.5 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSessionId(user.sessionId);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-tech-text hover:text-tech-yellow border border-tech-border hover:border-tech-yellow px-2.5 py-1 rounded transition-colors"
                            >
                              <span>Recorrido</span>
                              <Icons.ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
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
                          <div className="flex items-center gap-2">
                            <span className="text-tech-muted text-[10px] w-5">#{idx + 1}</span>
                            <a
                              href={`https://escapesymas.com${page.path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-tech-text hover:text-tech-yellow hover:underline truncate max-w-lg flex items-center gap-1.5"
                            >
                              <span className="truncate">{page.path}</span>
                              <Icons.ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                            </a>
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
