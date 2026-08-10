import React, { useState, useEffect, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';

/**
 * SyncTab — Consola de Sincronización del Catálogo Bihr
 *
 * Monitorea e inicia la sincronización de catálogos e imágenes del distribuidor.
 * Polls /api/bihr/sync-status every 1.5s while running so the operator can
 * watch throughput, ETA, and the current SKU tick by in real time.
 * The state is read from the `image_regen_state` table in PostgreSQL.
 */
const POLL_MS_RUNNING = 1500;
const POLL_MS_IDLE = 5000;

/** Format a number of seconds into a compact ETA string (e.g. "12m 34s", "1h 5m"). */
function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const SyncTab = () => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [triggeringCatalog, setTriggeringCatalog] = useState<string | null>(null);
  const [controllingImages, setControllingImages] = useState<string | null>(null);
  const prevSnapshotRef = useRef<{ processed: number; ts: number } | null>(null);
  const [throughput, setThroughput] = useState<number>(0);
  const [tick, setTick] = useState(0);

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/bihr/sync-status', {
        headers: { 'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);

        const processed = data?.images?.processed ?? 0;
        const now = Date.now();
        const prev = prevSnapshotRef.current;
        if (prev && processed > prev.processed) {
          const elapsed = (now - prev.ts) / 1000;
          if (elapsed > 0) {
            setThroughput((processed - prev.processed) / elapsed);
          }
        }
        prevSnapshotRef.current = { processed, ts: now };
      }
    } catch (e) {
      console.error('[FETCH SYNC STATUS ERROR]:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    let interval: ReturnType<typeof setInterval>;
    const setupInterval = () => {
      const ms = status?.images?.running ? POLL_MS_RUNNING : POLL_MS_IDLE;
      interval = setInterval(() => {
        fetchSyncStatus();
        setTick((t) => t + 1);
      }, ms);
    };
    setupInterval();
    return () => clearInterval(interval);
  }, [status?.images?.running]);

  const triggerCatalogSync = async (type: 'HardPart' | 'RiderGear' | 'Prices') => {
    setTriggeringCatalog(type);
    try {
      const res = await fetch('/api/bihr/sync-catalog', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || ''
        },
        body: JSON.stringify({ catalogType: type })
      });
      if (res.ok) {
        showToast('Sincronización de catálogo iniciada correctamente en segundo plano.');
      } else {
        showToast('Error al iniciar la sincronización.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de conexión.', 'error');
    } finally {
      setTriggeringCatalog(null);
      fetchSyncStatus();
    }
  };

  const controlImagesDownloader = async (action: 'start' | 'stop' | 'restart') => {
    setControllingImages(action);
    try {
      const res = await fetch('/api/bihr/sync-images-v4/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || ''
        },
        body: JSON.stringify({ batch: 5000, concurrency: 20, loopAll: true })
      });
      if (res.ok) {
        showToast(`Descargador de imágenes iniciado en segundo plano.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Error: ${err.error || res.statusText}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de conexión.', 'error');
    } finally {
      setControllingImages(null);
      fetchSyncStatus();
    }
  };

  const stopImagesDownloader = async () => {
    setControllingImages('stop');
    try {
      const res = await fetch('/api/bihr/sync-images-v2/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': import.meta.env.VITE_ADMIN_KEY || ''
        }
      });
      if (res.ok) {
        showToast(`Señal de parada enviada al descargador.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(`Error: ${err.error || res.statusText}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de conexión.', 'error');
    } finally {
      setControllingImages(null);
      fetchSyncStatus();
    }
  };

  if (loading && !status) {
    return (
      <div className="text-tech-muted italic py-12 text-center animate-pulse flex flex-col items-center justify-center gap-3">
        <Icons.Loader2 className="w-8 h-8 text-tech-yellow animate-spin" />
        <span>Cargando consola de sincronización...</span>
      </div>
    );
  }

  const catalog = status?.catalog || { status: 'idle' };
  const images = status?.images || { status: 'idle', running: false, pm2Status: 'stopped' };

  // Helper values
  const isCatalogSyncing = ['generating', 'waiting_generation', 'downloading', 'extracting', 'importing'].includes(catalog.status);
  
  // Progress bar calculation
  let catalogProgress = 0;
  if (catalog.totalBatches > 0) {
    catalogProgress = Math.round((catalog.currentBatch / catalog.totalBatches) * 100);
  }

  let imagesProgress = 0;
  if (images.total > 0) {
    imagesProgress = Math.round((images.processed / images.total) * 100);
  }

  return (
    <div className="space-y-8">
      {/* Catalog status section */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 shadow-lg shadow-black/40 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-tech-border pb-4 gap-4">
          <div>
            <h3 className="text-md font-black uppercase tracking-tighter italic text-zinc-200 flex items-center gap-2">
              <Icons.Database className="w-5 h-5 text-tech-yellow" /> Sincronización del Catálogo
            </h3>
            <p className="text-[10px] text-tech-muted mt-1 leading-relaxed">
              Descarga, extrae y actualiza la base de datos de productos de Bihr en PostgreSQL de forma asíncrona.
            </p>
          </div>
          <span
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
              isCatalogSyncing
                ? 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30 animate-pulse'
                : catalog.status === 'completed'
                ? 'bg-green-950/20 text-green-400 border-green-900/30'
                : catalog.status === 'failed'
                ? 'bg-red-950/20 text-red-400 border-red-900/30'
                : 'bg-[#1a1b1e] text-tech-muted border-tech-border'
            }`}
          >
            Estado: {catalog.status === 'idle' && 'Inactivo'}
            {catalog.status === 'generating' && 'Solicitando Generación'}
            {catalog.status === 'waiting_generation' && 'Esperando Bihr Server (Accept 202)'}
            {catalog.status === 'downloading' && 'Descargando ZIP'}
            {catalog.status === 'extracting' && 'Extrayendo ZIP'}
            {catalog.status === 'importing' && `Importando Lotes (${catalogProgress}%)`}
            {catalog.status === 'completed' && 'Completado'}
            {catalog.status === 'failed' && 'Error en Sincronización'}
          </span>
        </div>

        {/* Catalog Progress bar and info */}
        {isCatalogSyncing && (
          <div className="space-y-3 bg-[#1a1b1e]/40 p-4 rounded-xl border border-tech-border/40">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-[#cbd5e1]">
              <span>Progreso de Importación</span>
              <span className="text-tech-yellow">{catalogProgress}%</span>
            </div>
            <div className="w-full bg-[#1a1b1e] h-2 rounded-full overflow-hidden border border-tech-border">
              <div 
                className="bg-gradient-to-r from-orange-600 to-tech-yellow h-full rounded-full transition-all duration-300"
                style={{ width: `${catalogProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-[10px] uppercase font-bold text-tech-muted">
              <div>
                <span>Tipo Catálogo:</span>
                <span className="block text-tech-text mt-0.5">{catalog.catalogType}</span>
              </div>
              <div>
                <span>Lotes Procesados:</span>
                <span className="block text-tech-text mt-0.5">{catalog.currentBatch} / {catalog.totalBatches}</span>
              </div>
              <div>
                <span>Nuevos Productos:</span>
                <span className="block text-green-400 mt-0.5 font-bold">+{catalog.inserted}</span>
              </div>
              <div>
                <span>Actualizados:</span>
                <span className="block text-blue-400 mt-0.5 font-bold">~{catalog.updated}</span>
              </div>
            </div>
          </div>
        )}

        {catalog.status === 'completed' && (
          <div className="bg-green-950/10 border border-green-900/20 rounded-xl p-4 text-green-400 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="font-bold uppercase tracking-wider">¡Importación Exitosa!</p>
              <p className="text-[10px] text-[#cbd5e1] mt-0.5">
                Último catálogo procesado: <strong className="text-zinc-300">{catalog.catalogType}</strong> el {new Date(catalog.endTime).toLocaleString('es-ES')}.
              </p>
            </div>
            <div className="flex gap-4 text-[10px] font-black uppercase text-[#cbd5e1] shrink-0">
              <div>Nuevos: <span className="text-green-400">+{catalog.inserted}</span></div>
              <div>Actualizados: <span className="text-blue-400">~{catalog.updated}</span></div>
            </div>
          </div>
        )}

        {catalog.status === 'failed' && (
          <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 text-red-400 text-xs">
            <p className="font-bold uppercase tracking-wider">Fallo en la importación</p>
            <p className="text-[10px] text-[#cbd5e1] mt-1 leading-relaxed">
              Error: <strong className="text-red-300 font-mono">{catalog.error}</strong>
            </p>
          </div>
        )}

        {/* Buttons to trigger sync */}
        <div className="flex flex-wrap gap-4 pt-2">
          <button
            onClick={() => triggerCatalogSync('HardPart')}
            disabled={isCatalogSyncing || triggeringCatalog !== null}
            className="flex-1 min-w-[160px] bg-[#1a1b1e] hover:bg-zinc-850 disabled:bg-tech-card disabled:text-zinc-700 border border-tech-border hover:border-zinc-700 text-tech-text py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {triggeringCatalog === 'HardPart' ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin text-tech-yellow" />
            ) : (
              <Icons.Play className="w-3.5 h-3.5 text-tech-yellow" />
            )}
            Sincronizar HardParts
          </button>
          <button
            onClick={() => triggerCatalogSync('RiderGear')}
            disabled={isCatalogSyncing || triggeringCatalog !== null}
            className="flex-1 min-w-[160px] bg-[#1a1b1e] hover:bg-zinc-850 disabled:bg-tech-card disabled:text-zinc-700 border border-tech-border hover:border-zinc-700 text-tech-text py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {triggeringCatalog === 'RiderGear' ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin text-tech-yellow" />
            ) : (
              <Icons.Play className="w-3.5 h-3.5 text-tech-yellow" />
            )}
            Sincronizar RiderGear
          </button>
          <button
            onClick={() => triggerCatalogSync('Prices')}
            disabled={isCatalogSyncing || triggeringCatalog !== null}
            className="flex-1 min-w-[160px] bg-[#1a1b1e] hover:bg-zinc-850 disabled:bg-tech-card disabled:text-zinc-700 border border-tech-border hover:border-zinc-700 text-tech-text py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
          >
            {triggeringCatalog === 'Prices' ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin text-tech-yellow" />
            ) : (
              <Icons.Play className="w-3.5 h-3.5 text-tech-yellow" />
            )}
            Sincronizar Precios
          </button>
        </div>
      </div>

      {/* Image Downloader section */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 shadow-lg shadow-black/40 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-tech-border pb-4 gap-4">
          <div>
            <h3 className="text-md font-black uppercase tracking-tighter italic text-zinc-200 flex items-center gap-2">
              <Icons.Image className="w-5 h-5 text-tech-yellow" /> Descargador y Optimizador de Imágenes (PM2)
            </h3>
            <p className="text-[10px] text-tech-muted mt-1 leading-relaxed">
              Descarga en paralelo y convierte las imágenes de Bihr a WebP adaptadas para la web de Escapes y Más.
              El estado se persiste en la tabla <code className="font-mono text-[#cbd5e1]">image_regen_state</code> de PostgreSQL.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <span
              className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${
                images.running
                  ? 'bg-green-950/20 text-green-400 border-green-900/30'
                  : 'bg-[#1a1b1e] text-tech-muted border-tech-border'
              }`}
            >
              {images.running ? 'PROCESO ACTIVO' : 'INACTIVO'}
            </span>
            <span
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                images.status === 'running'
                  ? 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30 animate-pulse'
                  : images.status === 'completed'
                  ? 'bg-green-950/20 text-green-400 border-green-900/30'
                  : 'bg-[#1a1b1e] text-tech-muted border-tech-border'
              }`}
            >
              Estado: {images.status === 'idle' && 'Inactivo'}
              {images.status === 'running' && 'Procesando Imágenes'}
              {images.status === 'completed' && 'Descarga Completada'}
            </span>
          </div>
        </div>

        {/* Image Download progress */}
        {images.status === 'running' && (
          <div className="space-y-3 bg-[#1a1b1e]/40 p-4 rounded-xl border border-tech-border/40 animate-fade-in">
            <div className="flex justify-between items-baseline text-xs font-bold uppercase tracking-wider text-[#cbd5e1]">
              <span className="flex items-center gap-2">
                <Icons.Radio className="w-3 h-3 text-green-400 animate-pulse" />
                Progreso de Imágenes (live · refresco {POLL_MS_RUNNING / 1000}s)
              </span>
              <span className="text-tech-yellow font-mono">{imagesProgress}%</span>
            </div>
            <div className="w-full bg-[#1a1b1e] h-2 rounded-full overflow-hidden border border-tech-border">
              <div
                className="bg-gradient-to-r from-orange-600 to-tech-yellow h-full rounded-full transition-all duration-300"
                style={{ width: `${imagesProgress}%` }}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pt-2 text-[10px] uppercase font-bold text-tech-muted">
              <div>
                <span>Descargando:</span>
                <span className="block text-tech-text mt-0.5 truncate max-w-[120px] font-mono" title={images.current_sku}>
                  {images.current_sku || 'Buscando...'}
                </span>
              </div>
              <div>
                <span>Procesadas:</span>
                <span className="block text-tech-text mt-0.5 font-mono">{images.processed.toLocaleString()} / {images.total.toLocaleString()}</span>
              </div>
              <div>
                <span>Velocidad:</span>
                <span className="block text-tech-yellow mt-0.5 font-mono">
                  {throughput > 0 ? `${throughput.toFixed(1)}/s` : '—'}
                </span>
              </div>
              <div>
                <span>Tiempo Restante:</span>
                <span className="block text-tech-text mt-0.5 font-mono">
                  {throughput > 0 && images.total > images.processed
                    ? formatEta((images.total - images.processed) / throughput)
                    : '—'}
                </span>
              </div>
              <div>
                <span>Descargadas:</span>
                <span className="block text-green-400 mt-0.5 font-bold font-mono">{images.success.toLocaleString()}</span>
              </div>
              <div>
                <span>Fallidas:</span>
                <span className="block text-red-500 mt-0.5 font-bold font-mono">{images.failed.toLocaleString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 text-[10px] uppercase font-bold text-tech-muted border-t border-tech-border/40 mt-2">
              <div>
                <span>Omitidas (Sin imagen en catálogo):</span>
                <span className="block text-[#cbd5e1] mt-0.5 font-bold font-mono">{images.skipped.toLocaleString()}</span>
              </div>
              <div>
                <span>PID Proceso:</span>
                <span className="block text-tech-text mt-0.5 font-mono">{images.pid ?? '—'}</span>
              </div>
              <div>
                <span>Última Actualización:</span>
                <span className="block text-tech-text mt-0.5 font-mono">
                  {images.updated_at ? new Date(images.updated_at).toLocaleTimeString('es-ES') : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {images.status === 'completed' && (
          <div className="bg-green-950/10 border border-green-900/20 rounded-xl p-4 text-green-400 text-xs flex justify-between items-center">
            <div>
              <p className="font-bold uppercase tracking-wider">¡Proceso de imágenes finalizado!</p>
              <p className="text-[10px] text-[#cbd5e1] mt-0.5">Se descargaron y optimizaron las imágenes del catálogo en local.</p>
            </div>
            <div className="flex gap-4 text-[10px] font-black uppercase text-[#cbd5e1]">
              <div>Éxito: <span className="text-green-400">{images.success}</span></div>
              <div>Omitidas: <span className="text-[#cbd5e1]">{images.skipped}</span></div>
              <div>Error: <span className="text-red-500">{images.failed}</span></div>
            </div>
          </div>
        )}

        {images.status === 'idle' && !images.running && (
          <div className="bg-[#1a1b1e]/30 border border-zinc-850 rounded-xl p-4 text-tech-muted text-xs">
            <p className="font-bold uppercase tracking-wider">Servicio en reposo</p>
            <p className="text-[10px] text-tech-muted mt-0.5">El descargador no está corriendo. Presiona "Iniciar Descarga" para procesar el catálogo ZIP actual.</p>
          </div>
        )}

        {/* Buttons to control images downloader */}
        <div className="flex flex-wrap gap-4 pt-2">
          {!images.running ? (
            <button
              onClick={() => controlImagesDownloader('start')}
              disabled={controllingImages !== null}
              className="flex-1 min-w-[160px] bg-green-950/20 hover:bg-green-950/40 disabled:bg-tech-card border border-green-900/30 text-green-400 py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
            >
              {controllingImages === 'start' ? (
                <Icons.Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icons.Play className="w-3.5 h-3.5" />
              )}
              Iniciar Descarga
            </button>
          ) : (
            <>
              <button
                onClick={() => stopImagesDownloader()}
                disabled={controllingImages !== null}
                className="flex-1 min-w-[160px] bg-red-950/20 hover:bg-red-950/40 disabled:bg-tech-card border border-red-900/30 text-red-500 py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
              >
                {controllingImages === 'stop' ? (
                  <Icons.Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icons.Square className="w-3.5 h-3.5" />
                )}
                Detener Descarga
              </button>
              <button
                onClick={() => controlImagesDownloader('restart')}
                disabled={controllingImages !== null}
                className="flex-1 min-w-[160px] bg-[#1a1b1e] hover:bg-zinc-850 disabled:bg-tech-card border border-tech-border text-zinc-300 py-3.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
              >
                {controllingImages === 'restart' ? (
                  <Icons.Loader2 className="w-4 h-4 animate-spin text-tech-yellow" />
                ) : (
                  <Icons.RefreshCw className="w-3.5 h-3.5 text-tech-yellow" />
                )}
                Reiniciar Proceso
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncTab;
