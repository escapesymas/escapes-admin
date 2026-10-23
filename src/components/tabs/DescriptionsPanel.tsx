import React, { useCallback, useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

interface Status {
  products: { total: number; con_stock: number; del_fabricante: number; sin_descripcion: number; sin_descripcion_con_stock: number };
  queue: {
    total: number; traducidas: number; pendientes: number; fallidas: number;
    fichas_traducidas: number; fichas_pendientes: number; ultimos_10_min: number; ultima: string | null;
  };
  recent: { en: string; es: string; translated_at: string }[];
  lastRun: { finishedAt?: string; status: string; filled?: number; refreshed?: number; translated?: number; english?: number; error?: string } | null;
}

const REFRESH_MS = 20_000;
const n = (v: number | undefined) => (v ?? 0).toLocaleString('es-ES');

interface Props { adminToken: string }

/**
 * Descripciones de producto: las del fabricante que se copian cada día y la traducción de las que llegan en
 * inglés (va sola en el servidor; aquí solo se mira cómo va). Se actualiza cada 20 s.
 */
const DescriptionsPanel: React.FC<Props> = ({ adminToken }) => {
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const r = await fetch('/api/admin/catalog/descriptions', { headers: { Authorization: `Bearer ${adminToken}` } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      setData(body);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const q = data?.queue;
  const p = data?.products;
  const pct = q && q.total ? Math.round((q.traducidas / q.total) * 100) : 0;
  // Ritmo de los últimos 10 minutos → tiempo que falta.
  const perMin = q ? q.ultimos_10_min / 10 : 0;
  const eta = q && q.pendientes && perMin > 0 ? Math.ceil(q.pendientes / perMin) : null;
  const etaText = eta === null ? null : eta < 60 ? `${eta} min` : `${Math.floor(eta / 60)} h ${eta % 60} min`;
  const working = !!q?.pendientes && perMin > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-tech-muted">
          Se actualiza solo cada 20 segundos.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-tech-card text-[#cbd5e1] border-tech-border hover:border-zinc-700 transition-all disabled:opacity-40"
        >
          <Icons.RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      {error && <div className="bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl px-4 py-3 text-xs">{error}</div>}

      {q && (
        <div className="bg-tech-card border border-tech-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-tech-text flex items-center gap-2">
              <Icons.Languages size={16} className="text-tech-yellow" /> Traducción de las que llegan en inglés
            </h3>
            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border ${working ? 'bg-green-950/20 text-green-400 border-green-900/30' : q.pendientes ? 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30' : 'bg-tech-card text-tech-muted border-tech-border'}`}>
              {working ? 'Traduciendo' : q.pendientes ? 'En espera' : 'Terminado'}
            </span>
          </div>
          <div className="h-3 bg-[#1a1b1e] rounded-full overflow-hidden border border-tech-border">
            <div className="h-full bg-tech-yellow transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-[11px] text-[#cbd5e1]">
            <span><b className="text-tech-text">{pct}%</b> · {n(q.traducidas)} de {n(q.total)} textos</span>
            <span>{etaText ? `Faltan unos ${etaText}` : q.pendientes ? 'Calculando…' : ''}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Fichas traducidas', value: q.fichas_traducidas },
              { label: 'Fichas pendientes', value: q.fichas_pendientes },
              { label: 'Por minuto', value: Math.round(perMin) },
              { label: 'Descartadas', value: q.fallidas, hint: 'Fallaron 3 veces (cifras cambiadas o texto que no cuadra): se quedan sin descripción.' },
            ].map((c) => (
              <div key={c.label} title={c.hint} className="bg-[#1a1b1e] border border-tech-border rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">{c.label}</div>
                <div className="text-sm font-black text-tech-text">{n(c.value)}</div>
              </div>
            ))}
          </div>
          {q.ultima && <div className="text-[10px] text-tech-muted">Última traducción: {new Date(q.ultima).toLocaleString('es-ES')}</div>}
        </div>
      )}

      {p && (
        <div className="bg-tech-card border border-tech-border rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-tech-text flex items-center gap-2">
            <Icons.FileText size={16} className="text-tech-yellow" /> Fichas publicadas
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Publicadas', value: p.total },
              { label: 'Con texto del fabricante', value: p.del_fabricante },
              { label: 'Sin descripción', value: p.sin_descripcion },
              { label: 'Sin descripción y con stock', value: p.sin_descripcion_con_stock },
            ].map((c) => (
              <div key={c.label} className="bg-[#1a1b1e] border border-tech-border rounded-xl px-3 py-2">
                <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">{c.label}</div>
                <div className="text-sm font-black text-tech-text">{n(c.value)}</div>
              </div>
            ))}
          </div>
          {data?.lastRun && (
            <div className="text-[10px] text-tech-muted">
              Última pasada con el catálogo: {data.lastRun.finishedAt ? new Date(data.lastRun.finishedAt).toLocaleString('es-ES') : '—'}
              {data.lastRun.status === 'error' ? ` · error: ${data.lastRun.error}` : ` · ${n((data.lastRun.filled ?? 0) + (data.lastRun.refreshed ?? 0))} fichas actualizadas`}.
              {' '}Se repite cada día por la mañana; si editas una descripción a mano, ya no se toca.
            </div>
          )}
        </div>
      )}

      {!!data?.recent.length && (
        <div className="bg-tech-card border border-tech-border rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-tech-text">Últimas traducciones</h3>
          {data.recent.map((r) => (
            <div key={r.translated_at + r.en} className="border-t border-tech-border pt-3 first:border-0 first:pt-0 space-y-1">
              <div className="text-[11px] text-tech-muted"><span className="font-black text-[9px] uppercase tracking-widest mr-2">EN</span>{r.en}…</div>
              <div className="text-[11px] text-[#cbd5e1]"><span className="font-black text-[9px] uppercase tracking-widest mr-2 text-tech-yellow">ES</span>{r.es}…</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DescriptionsPanel;
