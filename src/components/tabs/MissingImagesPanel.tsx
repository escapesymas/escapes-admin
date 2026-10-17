import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useToast } from '../ToastContext';
import BulkImageRepair from './BulkImageRepair';

type Problem = 'sin_foto' | 'foto_remota' | 'fichero_perdido';

interface AuditItem {
  id: number;
  sku: string;
  name: string;
  brand: string;
  stock: number;
  familyCode: string;
  problem: Problem;
  photos: number;
  firstSrc: string;
}

interface AuditResponse {
  summary: {
    scannedAt: string;
    total: number;
    conFoto: number;
    sinImagen: number;
    sinImagenConStock: number;
    porProblema: Record<Problem, { total: number; conStock: number }>;
  };
  total: number;
  page: number;
  limit: number;
  items: AuditItem[];
}

const PAGE_SIZE = 50;

const PROBLEMS: { key: Problem; label: string; hint: string; badge: string }[] = [
  { key: 'sin_foto', label: 'Sin foto', hint: 'La ficha no tiene ninguna foto.', badge: 'bg-red-950/20 text-red-400 border-red-900/30' },
  { key: 'foto_remota', label: 'Solo foto remota de Bihr', hint: 'La foto es una dirección de Bihr sin copia en nuestro servidor; la tienda enseña «Imagen no disponible» si Bihr no la sirve.', badge: 'bg-yellow-950/20 text-yellow-400 border-yellow-900/30' },
  { key: 'fichero_perdido', label: 'Foto local perdida', hint: 'La ficha apunta a un fichero de /uploads que ya no está en el servidor.', badge: 'bg-orange-950/20 text-orange-400 border-orange-900/30' },
];

interface Props {
  adminToken: string;
  onOpenProduct: (id: number) => void;
  /** Cambia cuando se descargan fotos desde la ficha, para volver a pedir el listado. */
  refreshKey?: number;
}

const MissingImagesPanel: React.FC<Props> = ({ adminToken, onOpenProduct, refreshKey = 0 }) => {
  const { showToast } = useToast();
  const [problem, setProblem] = useState<'' | Problem>('');
  const [onlyStock, setOnlyStock] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);
  const lastRequest = useRef(0);

  const query = useCallback((extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(problem ? { problem } : {}), ...(onlyStock ? { stock: '1' } : {}), ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}), ...extra });
    return `/api/admin/catalog/image-audit?${p.toString()}`;
  }, [problem, onlyStock, debouncedSearch]);

  const load = useCallback(async (refresh = false) => {
    if (!adminToken) return;
    const id = ++lastRequest.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(query({ page: String(page), limit: String(PAGE_SIZE), ...(refresh ? { refresh: '1' } : {}) }), { headers: { Authorization: `Bearer ${adminToken}` } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      if (id === lastRequest.current) {
        // Tras descargar fotos el listado es más corto: si la página en la que estabas ya no existe, vuelve a la última.
        const pagesNow = Math.max(1, Math.ceil((body as AuditResponse).total / (body as AuditResponse).limit));
        if (page > pagesNow) { setPage(pagesNow); return; }
        setData(body as AuditResponse);
      }
    } catch (e: any) {
      if (id === lastRequest.current) setError(e?.message || 'No se pudo revisar el catálogo');
    } finally {
      if (id === lastRequest.current) setLoading(false);
    }
  }, [adminToken, query, page]);

  // Al cambiar un filtro se vuelve a la primera página.
  useEffect(() => { setPage(1); }, [problem, onlyStock, debouncedSearch]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const downloadCsv = async () => {
    setExporting(true);
    try {
      const r = await fetch(query({ format: 'csv' }), { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos-sin-imagen-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast(e?.message || 'No se pudo descargar el listado', 'error');
    } finally {
      setExporting(false);
    }
  };

  const s = data?.summary;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pct = s && s.total > 0 ? ((s.sinImagen / s.total) * 100).toFixed(1) : '0';
  const problemInfo = (k: Problem) => PROBLEMS.find(x => x.key === k)!;

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-tech-card border border-tech-border rounded-2xl p-4">
          <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">Productos en la tienda</div>
          <div className="text-2xl font-black text-tech-text mt-1">{s ? s.total.toLocaleString('es-ES') : '…'}</div>
        </div>
        <div className="bg-tech-card border border-tech-border rounded-2xl p-4">
          <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">Con imagen</div>
          <div className="text-2xl font-black text-green-500 mt-1">{s ? s.conFoto.toLocaleString('es-ES') : '…'}</div>
        </div>
        <div className="bg-tech-card border border-tech-border rounded-2xl p-4">
          <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">Sin imagen</div>
          <div className="text-2xl font-black text-red-400 mt-1">{s ? s.sinImagen.toLocaleString('es-ES') : '…'}</div>
          {s && <div className="text-[10px] text-tech-muted mt-1">{pct} % del catálogo</div>}
        </div>
        <div className="bg-tech-card border border-tech-border rounded-2xl p-4">
          <div className="text-[9px] uppercase font-black tracking-widest text-tech-muted">Sin imagen y con stock</div>
          <div className="text-2xl font-black text-tech-yellow mt-1">{s ? s.sinImagenConStock.toLocaleString('es-ES') : '…'}</div>
          <div className="text-[10px] text-tech-muted mt-1">Los que se pueden vender</div>
        </div>
      </div>

      <BulkImageRepair
        adminToken={adminToken}
        totalCount={s?.sinImagen}
        stockCount={s?.sinImagenConStock}
        onFinished={() => load(true)}
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() => setProblem('')}
          className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all ${problem === '' ? 'bg-tech-yellow text-black border-tech-yellow' : 'bg-tech-card text-[#cbd5e1] border-tech-border hover:border-zinc-700'}`}
        >
          Todos{s ? ` (${s.sinImagen.toLocaleString('es-ES')})` : ''}
        </button>
        {PROBLEMS.map(p => (
          <button
            key={p.key}
            onClick={() => setProblem(p.key)}
            title={p.hint}
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg border transition-all ${problem === p.key ? 'bg-tech-yellow text-black border-tech-yellow' : 'bg-tech-card text-[#cbd5e1] border-tech-border hover:border-zinc-700'}`}
          >
            {p.label}{s ? ` (${s.porProblema[p.key].total.toLocaleString('es-ES')})` : ''}
          </button>
        ))}
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#cbd5e1] px-3 py-2 cursor-pointer select-none">
          <input type="checkbox" checked={onlyStock} onChange={e => setOnlyStock(e.target.checked)} className="accent-yellow-400" />
          Solo con stock
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU o marca…"
            className="w-full bg-tech-card border border-tech-border rounded-xl pl-11 pr-4 py-3 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all shadow-inner"
          />
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border bg-tech-card text-[#cbd5e1] border-tech-border hover:border-zinc-700 transition-all disabled:opacity-40"
          title="Vuelve a revisar todo el catálogo"
        >
          <Icons.RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Revisar de nuevo
        </button>
        <button
          onClick={downloadCsv}
          disabled={exporting || !data || data.total === 0}
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-tech-yellow text-black hover:bg-yellow-500 transition-all disabled:opacity-40"
          title="Descarga todos los productos que cumplen el filtro, en un CSV para Excel"
        >
          {exporting ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Download size={14} />}
          Descargar CSV{data ? ` (${data.total.toLocaleString('es-ES')})` : ''}
        </button>
      </div>

      {s && (
        <div className="text-[10px] text-tech-muted">
          Revisado el {new Date(s.scannedAt).toLocaleString('es-ES')}. La foto remota de Bihr no se comprueba una a una: se cuenta como «sin imagen» porque la tienda solo la enseña si Bihr la sirve en ese momento.
        </div>
      )}

      {error && (
        <div className="bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl px-4 py-3 text-xs">{error}</div>
      )}

      {/* Tabla */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-4">Producto</th>
                <th className="pb-4">Marca</th>
                <th className="pb-4">SKU</th>
                <th className="pb-4">Stock</th>
                <th className="pb-4">Problema</th>
                <th className="pb-4 text-right">Fotos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {!data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-tech-muted italic">
                    {loading || !data ? 'Revisando el catálogo… puede tardar unos segundos.' : 'No hay productos sin imagen con este filtro.'}
                  </td>
                </tr>
              ) : data.items.map(item => (
                <tr key={item.id} className="hover:bg-white/[0.01]">
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => onOpenProduct(item.id)}
                      className="text-left text-xs font-bold text-tech-text hover:text-tech-yellow transition-colors"
                      title="Abrir la ficha para descargar las fotos de Bihr"
                    >
                      {item.name}
                    </button>
                  </td>
                  <td className="py-3 pr-3 text-xs font-bold text-[#cbd5e1]">{item.brand || '-'}</td>
                  <td className="py-3 pr-3 font-mono text-xs text-tech-muted">{item.sku}</td>
                  <td className="py-3 pr-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase italic ${item.stock > 0 ? 'bg-green-950/20 text-green-500 border border-green-900/30' : 'bg-red-950/20 text-red-500 border border-red-900/30'}`}>
                      {item.stock > 0 ? `${item.stock} Uds` : 'Agotado'}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span title={problemInfo(item.problem).hint} className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${problemInfo(item.problem).badge}`}>
                      {problemInfo(item.problem).label}
                    </span>
                  </td>
                  <td className="py-3 text-right text-xs font-mono text-tech-muted">{item.photos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-tech-muted">
            Mostrando <span className="text-tech-text">{data.items.length}</span> de <span className="text-tech-text">{data.total.toLocaleString('es-ES')}</span> productos
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="bg-tech-card hover:bg-[#1a1b1e] border border-tech-border text-zinc-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-1 disabled:opacity-30"
              aria-label="Página anterior"
            >
              <Icons.ChevronLeft size={14} />
              Anterior
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-tech-muted px-2">
              Página <span className="text-tech-text">{page}</span> / <span className="text-tech-text">{pages}</span>
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="bg-tech-card hover:bg-[#1a1b1e] border border-tech-border text-zinc-300 px-3 py-2 rounded-lg text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-1 disabled:opacity-30"
              aria-label="Página siguiente"
            >
              Siguiente
              <Icons.ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissingImagesPanel;
