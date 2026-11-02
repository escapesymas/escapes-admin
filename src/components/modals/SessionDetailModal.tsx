import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';

export interface SessionEventItem {
  eventId: string;
  createdAt: string;
  timeFormatted: string;
  secondsFromStart: number;
  timeOnPageSeconds: number | null;
  eventType: number;
  eventName: string;
  urlPath: string;
  pageTitle: string;
  referrerDomain: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  eventData: { key: string; value: string }[];
}

export interface SessionDetailData {
  session: {
    sessionId: string;
    city: string;
    region: string;
    country: string;
    device: string;
    os: string;
    browser: string;
    screen: string;
    language: string;
    sessionStart: string;
    lastActiveAt: string;
    durationSeconds: number;
    totalEvents: number;
    initialReferrer: string | null;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
  };
  events: SessionEventItem[];
}

interface SessionDetailModalProps {
  sessionId: string | null;
  adminToken: string;
  onClose: () => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  sessionId,
  adminToken,
  onClose,
}) => {
  const [data, setData] = useState<SessionDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/analytics/session-detail?sessionId=${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('No se pudo cargar el recorrido de la sesión');
        return res.json();
      })
      .then((resData) => {
        if (mounted) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [sessionId, adminToken]);

  // Cerrar al pulsar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sessionId) return null;

  const formatDuration = (totalSeconds: number) => {
    if (totalSeconds < 60) return `${totalSeconds} segundos`;
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins < 60) return `${mins} min ${secs > 0 ? `${secs}s` : ''}`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const formatSeconds = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s > 0 ? `${s}s` : ''}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-tech-card border border-tech-border rounded-lg max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-fade-in text-tech-text"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-tech-border flex items-center justify-between gap-4 bg-tech-carbon/60 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-tech-yellow/10 border border-tech-yellow/20 rounded-md text-tech-yellow">
              <Icons.Footprints className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-mono font-bold uppercase tracking-wider text-tech-text flex items-center gap-2">
                Recorrido del Visitante
              </h2>
              <p className="text-[11px] text-tech-muted font-mono mt-0.5">
                Secuencia cronológica de todas las páginas y acciones realizadas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-tech-muted hover:text-tech-text hover:bg-tech-border/40 rounded-md transition-colors"
            title="Cerrar ventana"
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {loading && (
            <div className="py-20 flex flex-col items-center justify-center text-tech-muted font-mono text-xs gap-3">
              <Icons.Loader2 size={28} className="animate-spin text-tech-yellow" />
              <span>Cargando recorrido y eventos del visitante...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-md text-xs font-mono flex items-center gap-2">
              <Icons.AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!loading && data && (
            <>
              {/* Tarjetas de Datos de la Sesión */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-tech-carbon/50 p-4 rounded-md border border-tech-border text-xs font-mono">
                {/* Ubicación */}
                <div className="space-y-1">
                  <span className="text-[10px] text-tech-muted uppercase tracking-wider block">Ubicación</span>
                  <div className="flex items-center gap-1.5 text-tech-text font-medium truncate">
                    <Icons.MapPin size={13} className="text-tech-yellow flex-shrink-0" />
                    <span className="truncate">{data.session.city}</span>
                  </div>
                  <span className="text-[10px] text-tech-muted block truncate">
                    {data.session.region ? `${data.session.region}, ` : ''}{data.session.country}
                  </span>
                </div>

                {/* Dispositivo */}
                <div className="space-y-1">
                  <span className="text-[10px] text-tech-muted uppercase tracking-wider block">Dispositivo</span>
                  <div className="flex items-center gap-1.5 text-tech-text font-medium truncate">
                    {data.session.device === 'mobile' ? (
                      <Icons.Smartphone size={13} className="text-tech-yellow flex-shrink-0" />
                    ) : (
                      <Icons.Monitor size={13} className="text-purple-400 flex-shrink-0" />
                    )}
                    <span className="truncate">{data.session.os}</span>
                  </div>
                  <span className="text-[10px] text-tech-muted block truncate">
                    {data.session.browser} {data.session.screen ? `· ${data.session.screen}` : ''}
                  </span>
                </div>

                {/* Duración */}
                <div className="space-y-1">
                  <span className="text-[10px] text-tech-muted uppercase tracking-wider block">Tiempo en la tienda</span>
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold truncate">
                    <Icons.Clock size={13} className="flex-shrink-0" />
                    <span>{formatDuration(data.session.durationSeconds)}</span>
                  </div>
                  <span className="text-[10px] text-tech-muted block">
                    {data.session.totalEvents} {data.session.totalEvents === 1 ? 'acción' : 'acciones'}
                  </span>
                </div>

                {/* Origen de llegada */}
                <div className="space-y-1">
                  <span className="text-[10px] text-tech-muted uppercase tracking-wider block">Canal inicial</span>
                  <div className="text-tech-yellow font-medium truncate">
                    {data.session.initialReferrer ? (
                      data.session.initialReferrer.includes('google') ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Icons.Search size={12} /> Google
                        </span>
                      ) : (
                        <span className="truncate">{data.session.initialReferrer}</span>
                      )
                    ) : (
                      <span className="text-blue-400 flex items-center gap-1">
                        <Icons.Compass size={12} /> Directo
                      </span>
                    )}
                  </div>
                  {data.session.utmSource && (
                    <span className="text-[9px] text-tech-muted block truncate font-mono">
                      UTM: {data.session.utmSource}
                    </span>
                  )}
                </div>
              </div>

              {/* Timeline del Usuario */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-tech-border pb-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-tech-text flex items-center gap-2">
                    <Icons.ListOrdered className="w-4 h-4 text-tech-yellow" />
                    Secuencia Paso a Paso ({data.events.length} eventos)
                  </h3>
                  <span className="text-[10px] font-mono text-tech-muted">
                    Inicio: {new Date(data.session.sessionStart).toLocaleTimeString('es-ES')}
                  </span>
                </div>

                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-tech-border">
                  {data.events.map((ev, idx) => {
                    const isPageview = ev.eventType === 1;
                    const isBikeSelected = ev.eventName === 'bike_selected';
                    const isLast = idx === data.events.length - 1;

                    return (
                      <div key={ev.eventId || idx} className="relative group">
                        {/* Nodo / Punto del timeline */}
                        <div
                          className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 shadow-md ${
                            isLast
                              ? 'bg-emerald-500 border-tech-card text-tech-carbon'
                              : isBikeSelected
                              ? 'bg-tech-yellow border-tech-card text-tech-carbon'
                              : 'bg-tech-card border-tech-border text-tech-muted group-hover:border-tech-yellow group-hover:text-tech-yellow'
                          }`}
                        >
                          {isBikeSelected ? (
                            <Icons.Sparkles size={12} />
                          ) : isPageview ? (
                            <span className="text-[10px] font-mono font-bold">{idx + 1}</span>
                          ) : (
                            <Icons.Activity size={12} />
                          )}
                        </div>

                        {/* Contenido del paso */}
                        <div className="bg-tech-carbon/80 border border-tech-border rounded-md p-3.5 space-y-2 hover:border-tech-border/80 transition-colors">
                          <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
                            <div className="flex items-center gap-2">
                              <span className="text-tech-yellow font-bold">{ev.timeFormatted}</span>
                              <span className="text-tech-muted">
                                ({ev.secondsFromStart === 0 ? 'Entrada' : `+${formatSeconds(ev.secondsFromStart)}`})
                              </span>
                            </div>

                            {/* Tiempo de permanencia en esta página */}
                            {ev.timeOnPageSeconds !== null && ev.timeOnPageSeconds > 0 && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Icons.Clock size={11} /> Estuvo {formatSeconds(ev.timeOnPageSeconds)}
                              </span>
                            )}
                            {isLast && (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                                Última página vista
                              </span>
                            )}
                          </div>

                          {/* Si es selección de moto */}
                          {isBikeSelected && (
                            <div className="bg-tech-yellow/10 border border-tech-yellow/30 p-2.5 rounded text-xs font-mono">
                              <div className="text-[10px] text-tech-yellow uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                                <Icons.CheckCircle size={12} /> Modelo de moto seleccionado:
                              </div>
                              <div className="text-tech-text font-bold text-sm">
                                {ev.eventData.find((d) => d.key === 'bike')?.value || 'Moto'}
                              </div>
                            </div>
                          )}

                          {/* URL y Título */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between gap-2">
                              <a
                                href={`https://escapesymas.com${ev.urlPath}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-tech-text hover:text-tech-yellow hover:underline truncate flex items-center gap-1.5 font-medium"
                                title={ev.urlPath}
                              >
                                <span className="truncate">{ev.urlPath}</span>
                                <Icons.ExternalLink size={12} className="flex-shrink-0 text-tech-muted" />
                              </a>
                            </div>
                            {ev.pageTitle && (
                              <span className="text-[11px] text-tech-muted truncate" title={ev.pageTitle}>
                                {ev.pageTitle}
                              </span>
                            )}
                          </div>

                          {/* Datos adicionales de evento si existen */}
                          {!isBikeSelected && ev.eventData && ev.eventData.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-tech-border/50">
                              {ev.eventData.map((d, dIdx) => (
                                <span
                                  key={dIdx}
                                  className="text-[10px] font-mono bg-tech-card px-2 py-0.5 rounded border border-tech-border text-tech-muted"
                                >
                                  <strong>{d.key}:</strong> {d.value}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-tech-border flex justify-end bg-tech-carbon/60 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tech-carbon border border-tech-border hover:border-tech-yellow text-tech-text text-xs font-mono uppercase tracking-wider rounded-sm transition-all"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
