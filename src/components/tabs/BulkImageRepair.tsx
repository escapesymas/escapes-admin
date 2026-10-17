import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import ConfirmModal from '../modals/ConfirmModal';
import { useToast } from '../ToastContext';

interface BrandStats { total: number; done: number; saved: number; notFound: number; failed: number; skipped: number; lastError?: string }

interface RepairJob {
  status: 'idle' | 'running' | 'stopping' | 'done' | 'stopped' | 'error';
  scope: 'stock' | 'all';
  useApi: boolean;
  concurrency: number;
  startedAt?: string;
  finishedAt?: string;
  total: number;
  done: number;
  saved: number;
  notFound: number;
  failed: number;
  skipped: number;
  currentBrand: string;
  brands: Record<string, BrandStats>;
  recentErrors: { id: number; sku: string; brand: string; message: string }[];
  message?: string;
}

interface Props {
  adminToken: string;
  /** Productos sin imagen: todos y solo los que tienen stock. */
  totalCount?: number;
  stockCount?: number;
  /** Se llama cuando acaba (o se para) un trabajo, para volver a pedir el listado. */
  onFinished: () => void;
}

const num = (n: number) => n.toLocaleString('es-ES');

const STATUS_LABEL: Record<RepairJob['status'], string> = {
  idle: '',
  running: 'En marcha',
  stopping: 'Parando…',
  done: 'Terminado',
  stopped: 'Parado',
  error: 'Parado por un problema',
};

const BulkImageRepair: React.FC<Props> = ({ adminToken, totalCount, stockCount, onFinished }) => {
  const { showToast } = useToast();
  const [job, setJob] = useState<RepairJob | null>(null);
  const [useApi, setUseApi] = useState(true);
  const [confirm, setConfirm] = useState<null | 'stock' | 'all'>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasActive = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  const call = useCallback(async (path: string, init?: RequestInit): Promise<RepairJob> => {
    const r = await fetch(`/api/admin/catalog/image-repair${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${adminToken}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err: any = new Error(body?.error || `HTTP ${r.status}`);
      err.state = body?.state;
      throw err;
    }
    return body as RepairJob;
  }, [adminToken]);

  const refresh = useCallback(async () => {
    if (!adminToken) return;
    try { setJob(await call('')); } catch { /* el estado se vuelve a pedir en el siguiente intento */ }
  }, [adminToken, call]);

  // Al abrir la pestaña se recoge el trabajo que ya estuviera en marcha.
  useEffect(() => { refresh(); }, [refresh]);

  const active = job?.status === 'running' || job?.status === 'stopping';
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [active, refresh]);

  useEffect(() => {
    if (wasActive.current && !active && job) {
      if (job.status === 'done') showToast(`Descarga terminada: ${num(job.saved)} productos con foto nueva`, 'success');
      else if (job.status === 'error') showToast(job.message || 'La descarga se paró por un problema', 'error');
      else showToast(`Descarga parada: ${num(job.saved)} productos con foto nueva`, 'success');
      onFinishedRef.current();
    }
    wasActive.current = !!active;
  }, [active, job, showToast]);

  const start = async (scope: 'stock' | 'all') => {
    setConfirm(null);
    setSending(true);
    setError(null);
    try {
      setJob(await call('', { method: 'POST', body: JSON.stringify({ scope, useApi }) }));
    } catch (e: any) {
      if (e?.state) setJob(e.state);
      setError(e?.message || 'No se pudo empezar la descarga');
    } finally {
      setSending(false);
    }
  };

  const stop = async () => {
    setSending(true);
    try { setJob(await call('/stop', { method: 'POST' })); } catch (e: any) { setError(e?.message || 'No se pudo parar'); } finally { setSending(false); }
  };

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.done / job.total) * 100)) : 0;
  const hasReport = !!job && job.status !== 'idle' && job.status !== 'running' && job.status !== 'stopping';
  const worstBrands = job
    ? Object.entries(job.brands).filter(([, b]) => b.notFound + b.failed + b.skipped > 0)
        .sort((a, b) => (b[1].notFound + b[1].failed) - (a[1].notFound + a[1].failed)).slice(0, 10)
    : [];

  return (
    <div className="bg-tech-card border border-tech-border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-widest text-tech-text flex items-center gap-2">
            <Icons.DownloadCloud size={14} className="text-tech-yellow" /> Descarga en bloque de fotos de Bihr
            {job && job.status !== 'idle' && (
              <span className={`px-2 py-0.5 rounded border text-[9px] ${job.status === 'error' ? 'bg-red-950/20 text-red-400 border-red-900/30' : active ? 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30' : 'bg-green-950/20 text-green-400 border-green-900/30'}`}>
                {STATUS_LABEL[job.status]}
              </span>
            )}
          </div>
          {!active && (
            <p className="text-[11px] text-tech-muted mt-2 max-w-3xl leading-relaxed">
              Busca la foto de cada producto en el zip de su marca de Bihr (y, si no está, en su API) y la guarda en nuestro servidor.
              Va en segundo plano, primero los productos con stock. Si no encuentra la foto, el producto se queda como está.
              Puedes parar cuando quieras. Si el servidor se actualiza mientras tanto, se corta: vuelve a pulsar y sigue donde lo dejó.
            </p>
          )}
        </div>
        {active && (
          <button
            onClick={stop}
            disabled={sending || job?.status === 'stopping'}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-red-950/20 text-red-400 border-red-900/30 hover:border-red-700 transition-all disabled:opacity-40"
          >
            <Icons.Square size={12} /> {job?.status === 'stopping' ? 'Parando…' : 'Parar'}
          </button>
        )}
      </div>

      {!active && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setConfirm('stock')}
            disabled={sending || !stockCount}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-tech-yellow text-black hover:bg-yellow-500 transition-all disabled:opacity-40"
          >
            <Icons.Download size={14} /> Descargar los {stockCount !== undefined ? num(stockCount) : ''} con stock
          </button>
          <button
            onClick={() => setConfirm('all')}
            disabled={sending || !totalCount}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-tech-card text-[#cbd5e1] border-tech-border hover:border-zinc-700 transition-all disabled:opacity-40"
          >
            Descargar todos{totalCount !== undefined ? ` (${num(totalCount)})` : ''}
          </button>
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#cbd5e1] px-2 cursor-pointer select-none" title="Más lenta: una petición cada 250 ms">
            <input type="checkbox" checked={useApi} onChange={e => setUseApi(e.target.checked)} className="accent-yellow-400" />
            Usar también la API de Bihr
          </label>
        </div>
      )}

      {error && <div className="bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl px-4 py-3 text-xs">{error}</div>}

      {job && job.status !== 'idle' && (
        <div className="space-y-3">
          {job.message && (
            <div className={`text-xs ${job.status === 'error' ? 'text-red-400' : 'text-tech-muted'}`}>{job.message}</div>
          )}
          {job.total > 0 && (
            <>
              <div className="h-2 rounded-full bg-[#1a1b1e] overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-tech-yellow transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-tech-muted">
                <span><span className="text-tech-text font-bold">{num(job.done)}</span> de {num(job.total)} ({pct} %)</span>
                <span className="text-green-500"><span className="font-bold">{num(job.saved)}</span> con foto nueva</span>
                <span><span className="text-tech-text font-bold">{num(job.notFound)}</span> sin foto en Bihr</span>
                <span className={job.failed ? 'text-red-400' : ''}><span className="font-bold">{num(job.failed)}</span> con fallo</span>
                {job.skipped > 0 && <span><span className="text-tech-text font-bold">{num(job.skipped)}</span> saltados</span>}
                {active && job.currentBrand && <span>Marca: <span className="text-tech-text font-bold">{job.currentBrand}</span></span>}
              </div>
            </>
          )}
        </div>
      )}

      {hasReport && worstBrands.length > 0 && (
        <details className="text-[11px] text-tech-muted">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#cbd5e1]">Marcas donde no se encontró la foto o falló</summary>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-tech-border text-[9px] uppercase tracking-widest font-black">
                  <th className="pb-2">Marca</th><th className="pb-2 text-right">Productos</th><th className="pb-2 text-right">Con foto</th>
                  <th className="pb-2 text-right">Sin foto en Bihr</th><th className="pb-2 text-right">Fallos</th><th className="pb-2 text-right">Saltados</th><th className="pb-2 pl-4">Último fallo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {worstBrands.map(([brand, b]) => (
                  <tr key={brand}>
                    <td className="py-2 font-bold text-tech-text">{brand}</td>
                    <td className="py-2 text-right">{num(b.total)}</td>
                    <td className="py-2 text-right">{num(b.saved)}</td>
                    <td className="py-2 text-right">{num(b.notFound)}</td>
                    <td className="py-2 text-right">{num(b.failed)}</td>
                    <td className="py-2 text-right">{num(b.skipped)}</td>
                    <td className="py-2 pl-4 text-red-400">{b.lastError || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {job && job.recentErrors.length > 0 && (
        <details className="text-[11px] text-tech-muted">
          <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#cbd5e1]">Últimos fallos ({job.recentErrors.length})</summary>
          <ul className="mt-3 space-y-1">
            {job.recentErrors.slice().reverse().map((e, i) => (
              <li key={`${e.id}-${i}`}><span className="font-mono text-tech-text">{e.sku}</span> · {e.brand} · <span className="text-red-400">{e.message}</span></li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmModal
        open={confirm !== null}
        variant="warning"
        title="Descargar fotos de Bihr"
        message={confirm === 'stock'
          ? `Se van a buscar las fotos de ${stockCount !== undefined ? num(stockCount) : 'todos los'} productos sin imagen que tienen stock. Puede tardar varias horas y puedes parar cuando quieras. Los productos cuya foto no se encuentre no se tocan.`
          : `Se van a buscar las fotos de ${totalCount !== undefined ? num(totalCount) : 'todos los'} productos sin imagen, primero los que tienen stock. Puede tardar muchas horas y puedes parar cuando quieras. Los productos cuya foto no se encuentre no se tocan.`}
        confirmLabel="Empezar"
        onConfirm={() => confirm && start(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default BulkImageRepair;
