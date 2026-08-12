import React, { useEffect, useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import type { Product, ProductCompatibilityEntry } from '../../types/admin';

type ProductDetailStats = {
  all_time: { units_sold: number; revenue_cents: number; order_count: number };
  current_30d: { units_sold: number; revenue_cents: number; order_count: number };
  previous_30d: { units_sold: number; revenue_cents: number; order_count: number };
  delta: { units_pct: number | null; revenue_pct: number | null };
  daily_30d: Array<{ date: string; units: number; revenue_cents: number; order_count: number }>;
  margin_cents: number;
  margin_pct: number;
  cogs_cents: number;
  stock_turnover: number | null;
  return_rate_pct: number;
  refunded_orders: number;
  total_orders_with_product: number;
  avg_order_total_cents: number;
};

type ProductDetailRecentOrder = {
  order_id: number;
  created_at: string;
  status: string;
  total_cents: number;
  quantity: number;
  unit_price_cents: number;
  customer_email: string | null;
};

type ProductDetailResponse = {
  product: Product & {
    images: any;
    compatibility: any;
    old_part_number?: string;
    bihr_partnumber?: string;
    stock_status?: string;
    low_stock_threshold?: number | null;
    updated_at?: string;
    categories?: any;
    [k: string]: any;
  };
  stats: ProductDetailStats;
  recent_orders: ProductDetailRecentOrder[];
  live_stock?: {
    quantity: number | null;
    status: string | null;
  };
};

interface ProductDetailModalProps {
  session: { token?: string; jwt?: string };
  productId: number;
  onClose: () => void;
}

const eur = (cents: number): string =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

const eurRound = (cents: number): string => eur(Math.round(cents || 0));

const formatDate = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (iso: string): string => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-950/30 text-yellow-400 border-yellow-900/40',
  processing: 'bg-blue-950/30 text-blue-400 border-blue-900/40',
  completed: 'bg-green-950/30 text-green-400 border-green-900/40',
  cancelled: 'bg-red-950/30 text-red-400 border-red-900/40',
  refunded: 'bg-orange-950/30 text-orange-400 border-orange-900/40',
  shipped: 'bg-cyan-950/30 text-cyan-400 border-cyan-900/40',
  delivered: 'bg-emerald-950/30 text-emerald-400 border-emerald-900/40',
  on_hold: 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40',
};

const MiniBarChart: React.FC<{ data: Array<{ date: string; units: number; revenue_cents: number }> }> = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.revenue_cents));
  const totalW = 100; // viewBox width %
  const barW = totalW / data.length;
  return (
    <svg viewBox={`0 0 ${totalW} 30`} preserveAspectRatio="none" className="w-full h-24">
      {data.map((d, i) => {
        const h = (d.revenue_cents / max) * 28;
        const y = 30 - h;
        const x = i * barW;
        return (
          <rect
            key={d.date}
            x={x + barW * 0.15}
            y={y}
            width={barW * 0.7}
            height={Math.max(0.5, h)}
            rx={0.4}
            fill="#facc15"
            opacity={d.revenue_cents > 0 ? 1 : 0.25}
          >
            <title>{`${d.date}: ${eurRound(d.revenue_cents)} (${d.units} uds)`}</title>
          </rect>
        );
      })}
    </svg>
  );
};

const DeltaBadge: React.FC<{ pct: number | null }> = ({ pct }) => {
  if (pct === null) return <span className="text-[10px] text-zinc-600 font-bold">— sin histórico</span>;
  const positive = pct >= 0;
  const Icon = positive ? Icons.TrendingUp : Icons.TrendingDown;
  const cls = positive ? 'text-green-400' : 'text-red-400';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-black ${cls}`}>
      <Icon size={12} />
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
};

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ session, productId, onClose }) => {
  const [data, setData] = useState<ProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sales' | 'details' | 'compatibility'>('sales');
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    const token = session?.token || session?.jwt || '';
    if (!token || !productId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin?action=product-detail&id=${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json().then(j => ({ status: r.status, body: j })))
      .then(({ status, body }) => {
        if (cancelled) return;
        if (!status || status >= 400) {
          throw new Error(body?.error || `HTTP ${status}`);
        }
        setData(body);
      })
      .catch(e => {
        if (!cancelled) setError(e.message || 'Error cargando producto');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [productId, session?.token, session?.jwt]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const product = data?.product;
  const stats = data?.stats;
  const recent = data?.recent_orders || [];

  const images: Array<{ src?: string; url?: string; alt?: string }> = useMemo(() => {
    if (!product?.images) return [];
    if (Array.isArray(product.images)) return product.images;
    return [];
  }, [product]);

  const compat: ProductCompatibilityEntry[] = useMemo(() => {
    if (!product?.compatibility) return [];
    if (Array.isArray(product.compatibility)) return product.compatibility as ProductCompatibilityEntry[];
    return [];
  }, [product]);

  const currentImgSrc = (images[activeImg] as any)?.src || (images[activeImg] as any)?.url || '';
  const costCents = Number(product?.cost || 0);
  const priceCents = Number(product?.price || 0);
  const marginUnitCents = priceCents - costCents;
  const marginUnitPct = priceCents > 0 ? (marginUnitCents / priceCents) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-6xl my-8 shadow-2xl shadow-black/60"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-tech-border sticky top-0 bg-tech-card rounded-t-2xl z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-tech-yellow/10 border border-tech-yellow/30 flex items-center justify-center text-tech-yellow shrink-0">
              <Icons.Package size={20} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-tech-muted font-black">Detalle de Producto</div>
              <div className="text-sm font-bold text-tech-text truncate">
                {loading ? 'Cargando…' : product?.name || 'Sin nombre'}
                {product?.sku && <span className="ml-2 font-mono text-[11px] text-tech-muted">SKU: {product.sku}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {product && (
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase border ${
                product.status === 'published' ? 'bg-green-950/20 text-green-400 border-green-900/40'
                : product.status === 'draft' ? 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40'
                : 'bg-red-950/20 text-red-400 border-red-900/40'
              }`}>
                {product.status || 'draft'}
              </span>
            )}
            <button onClick={onClose} className="text-tech-muted hover:text-tech-text p-2 rounded-lg hover:bg-[#1a1b1e]" aria-label="Cerrar">
              <Icons.X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="m-5 p-4 bg-red-950/30 border border-red-800/50 rounded-xl text-red-400 text-xs flex items-start gap-2">
            <Icons.AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <div className="font-bold uppercase tracking-wider mb-1">Error</div>
              <div>{error}</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="p-12 flex flex-col items-center justify-center text-tech-muted">
            <Icons.Loader2 size={32} className="animate-spin mb-3 text-tech-yellow" />
            <span className="text-[10px] uppercase tracking-widest font-black">Cargando datos…</span>
          </div>
        )}

        {!loading && product && (
          <div>
            {/* Top section: large gallery left + product info right */}
            <div className="grid grid-cols-[420px_1fr] gap-0 border-b border-tech-border">

              {/* Gallery — left panel, full height */}
              <div className="flex flex-col gap-3 p-5 border-r border-tech-border bg-[#111112]">
                {/* Main image */}
                <div className="relative aspect-square bg-[#1a1b1e] border border-tech-border rounded-xl overflow-hidden flex items-center justify-center">
                  {currentImgSrc ? (
                    <img src={currentImgSrc} alt={images[activeImg]?.alt || product.name} className="w-full h-full object-contain" />
                  ) : (
                    <Icons.Package className="w-16 h-16 text-zinc-700" />
                  )}
                  {images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-white font-black px-2 py-1 rounded-md">
                      {activeImg + 1}/{images.length}
                    </div>
                  )}
                </div>
                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="grid grid-cols-6 gap-2">
                    {images.map((img, i) => {
                      const src = (img as any).src || (img as any).url || '';
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveImg(i)}
                          className={`aspect-square bg-[#1a1b1e] border rounded-lg overflow-hidden flex items-center justify-center transition-colors ${
                            i === activeImg ? 'border-tech-yellow ring-1 ring-tech-yellow/40' : 'border-tech-border hover:border-zinc-600'
                          }`}
                        >
                          {src ? (
                            <img src={src} alt={img.alt || ''} className="w-full h-full object-cover" />
                          ) : (
                            <Icons.ImageOff size={12} className="text-zinc-700" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info — right panel */}
              <div className="space-y-4 p-5 min-w-0">
                <div>
                  <h2 className="text-xl font-black italic text-tech-text uppercase tracking-tight leading-tight">{product.name}</h2>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-tech-muted">
                    {product.brand && <span><strong className="text-[#cbd5e1]">Marca:</strong> {product.brand}</span>}
                    {product.barcode && <span><strong className="text-[#cbd5e1]">Cód. Barras:</strong> {product.barcode}</span>}
                    {product.supplier_code && <span><strong className="text-[#cbd5e1]">Cód. Proveedor:</strong> {product.supplier_code}</span>}
                    {product.old_part_number && <span><strong className="text-[#cbd5e1]">Old Part#:</strong> {product.old_part_number}</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black">Precio</div>
                    <div className="text-base font-black italic text-tech-text mt-1">{eurRound(priceCents)}</div>
                    {product.sale_price && (
                      <div className="text-[10px] text-green-400 line-through font-bold">{eurRound(product.sale_price)}</div>
                    )}
                  </div>
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black">Coste</div>
                    <div className="text-base font-black italic text-tech-text mt-1">{costCents > 0 ? eurRound(costCents) : '—'}</div>
                  </div>
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black">Margen / ud</div>
                    <div className={`text-base font-black italic mt-1 ${marginUnitCents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {costCents > 0 ? eurRound(marginUnitCents) : '—'}
                    </div>
                    {costCents > 0 && (
                      <div className="text-[10px] text-tech-muted font-bold">{marginUnitPct.toFixed(1)}%</div>
                    )}
                  </div>
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-3">
                    <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black">Stock Bihr</div>
                    <div className={`text-base font-black italic mt-1 ${(data?.live_stock?.quantity ?? product.stock ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {data?.live_stock?.quantity ?? product.stock ?? 0} uds
                    </div>
                    <div className="text-[10px] text-tech-muted font-bold">{data?.live_stock?.status ?? product.stock_status ?? '—'}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {product.dropshipping && (
                    <span className="text-[10px] bg-blue-950/30 text-blue-400 border border-blue-900/40 px-2.5 py-1 rounded-md font-bold">Dropshipping</span>
                  )}
                  {product.ondemand && (
                    <span className="text-[10px] bg-yellow-950/30 text-yellow-400 border border-yellow-900/40 px-2.5 py-1 rounded-md font-bold">Bajo Demanda</span>
                  )}
                  {product.delivery_plant && (
                    <span className="text-[10px] bg-[#1a1b1e] border border-tech-border text-[#cbd5e1] px-2.5 py-1 rounded-md font-bold">
                      Planta: {product.delivery_plant}
                    </span>
                  )}
                  {product.type && product.type !== 'simple' && (
                    <span className="text-[10px] bg-purple-950/30 text-purple-400 border border-purple-900/40 px-2.5 py-1 rounded-md font-bold">
                      {product.type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-tech-border px-6 sticky top-[73px] bg-tech-card z-[5]">
              {(['sales', 'details', 'compatibility'] as const).map(t => {
                const labels: Record<typeof t, string> = {
                  sales: 'Ventas',
                  details: 'Detalles',
                  compatibility: `Compatibilidad (${compat.length})`,
                };
                const Icon = t === 'sales' ? Icons.BarChart3 : t === 'details' ? Icons.Info : Icons.Bike;
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${
                      tab === t ? 'border-tech-yellow text-tech-text' : 'border-transparent text-tech-muted hover:text-tech-text'
                    }`}
                  >
                    <Icon size={14} />
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {tab === 'sales' && stats && (
                <div className="space-y-6">
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-1">Unidades (30d)</div>
                      <div className="text-2xl font-black italic text-tech-text">{stats.current_30d.units_sold}</div>
                      <DeltaBadge pct={stats.delta.units_pct} />
                    </div>
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-1">Ingresos (30d)</div>
                      <div className="text-2xl font-black italic text-tech-text">{eurRound(stats.current_30d.revenue_cents)}</div>
                      <DeltaBadge pct={stats.delta.revenue_pct} />
                    </div>
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-1">Pedidos (30d)</div>
                      <div className="text-2xl font-black italic text-tech-text">{stats.current_30d.order_count}</div>
                      <div className="text-[10px] text-tech-muted font-bold">vs {stats.previous_30d.order_count}</div>
                    </div>
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-1">Ticket medio</div>
                      <div className="text-2xl font-black italic text-tech-text">{eurRound(stats.avg_order_total_cents)}</div>
                      <div className="text-[10px] text-tech-muted font-bold">cuando se incluye</div>
                    </div>
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-1">Tasa devolución</div>
                      <div className={`text-2xl font-black italic ${stats.return_rate_pct > 5 ? 'text-red-400' : 'text-tech-text'}`}>
                        {stats.return_rate_pct}%
                      </div>
                      <div className="text-[10px] text-tech-muted font-bold">{stats.refunded_orders}/{stats.total_orders_with_product}</div>
                    </div>
                  </div>

                  {/* All-time totals */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-tech-yellow/5 border border-tech-yellow/20 rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-yellow font-black mb-1">Total unidades vendidas</div>
                      <div className="text-2xl font-black italic text-tech-text">{stats.all_time.units_sold}</div>
                    </div>
                    <div className="bg-tech-yellow/5 border border-tech-yellow/20 rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-yellow font-black mb-1">Ingresos totales</div>
                      <div className="text-2xl font-black italic text-tech-text">{eurRound(stats.all_time.revenue_cents)}</div>
                    </div>
                    <div className="bg-tech-yellow/5 border border-tech-yellow/20 rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-yellow font-black mb-1">Margen acumulado</div>
                      <div className={`text-2xl font-black italic ${stats.margin_cents >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {eurRound(stats.margin_cents)}
                      </div>
                      <div className="text-[10px] text-tech-muted font-bold">{stats.margin_pct}%</div>
                    </div>
                    <div className="bg-tech-yellow/5 border border-tech-yellow/20 rounded-xl p-4">
                      <div className="text-[9px] uppercase tracking-widest text-tech-yellow font-black mb-1">Rotación stock</div>
                      <div className="text-2xl font-black italic text-tech-text">
                        {stats.stock_turnover === null ? '∞' : stats.stock_turnover.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-tech-muted font-bold">uds vendidas / stock actual</div>
                    </div>
                  </div>

                  {/* Daily chart */}
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-tech-muted font-black">Ingresos diarios · últimos 30 días</div>
                        <div className="text-base font-black italic text-tech-text">
                          {eurRound(stats.daily_30d.reduce((acc, d) => acc + d.revenue_cents, 0))}
                        </div>
                      </div>
                      <div className="text-[10px] text-tech-muted font-bold uppercase tracking-widest">
                        Pico: {eurRound(Math.max(0, ...stats.daily_30d.map(d => d.revenue_cents)))}
                      </div>
                    </div>
                    <MiniBarChart data={stats.daily_30d} />
                    <div className="flex justify-between mt-2 text-[9px] text-tech-muted font-bold">
                      <span>{stats.daily_30d[0]?.date.slice(5)}</span>
                      <span>{stats.daily_30d[Math.floor(stats.daily_30d.length / 2)]?.date.slice(5)}</span>
                      <span>{stats.daily_30d[stats.daily_30d.length - 1]?.date.slice(5)}</span>
                    </div>
                  </div>

                  {/* Recent orders table */}
                  <div className="bg-[#1a1b1e] border border-tech-border rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-tech-border flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-tech-muted font-black">Últimos pedidos con este producto</div>
                      <span className="text-[10px] text-tech-muted font-bold">{recent.length}</span>
                    </div>
                    {recent.length === 0 ? (
                      <div className="p-6 text-center text-[11px] text-tech-muted italic">
                        Aún no se ha vendido este producto.
                      </div>
                    ) : (
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-tech-border text-[9px] text-tech-muted uppercase tracking-widest font-black">
                            <th className="px-4 py-2">Pedido</th>
                            <th className="px-4 py-2">Fecha</th>
                            <th className="px-4 py-2">Cliente</th>
                            <th className="px-4 py-2 text-center">Uds</th>
                            <th className="px-4 py-2 text-right">Precio ud</th>
                            <th className="px-4 py-2 text-right">Total</th>
                            <th className="px-4 py-2">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {recent.map(r => (
                            <tr key={r.order_id} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2 font-mono text-xs text-tech-text">#{r.order_id}</td>
                              <td className="px-4 py-2 text-[11px] text-tech-muted">{formatDateTime(r.created_at)}</td>
                              <td className="px-4 py-2 text-[11px] text-[#cbd5e1] truncate max-w-[160px]">{r.customer_email || '—'}</td>
                              <td className="px-4 py-2 text-center text-xs font-bold text-tech-text">{r.quantity}</td>
                              <td className="px-4 py-2 text-right text-[11px] text-tech-muted font-mono">{eur(r.unit_price_cents)}</td>
                              <td className="px-4 py-2 text-right text-xs font-bold text-tech-text">{eur(r.total_cents)}</td>
                              <td className="px-4 py-2">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${STATUS_BADGE[r.status] || 'bg-zinc-800/40 text-zinc-400 border-zinc-700/40'}`}>
                                  {r.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {tab === 'sales' && !stats && (
                <div className="p-8 text-center text-tech-muted text-xs italic">No hay estadísticas disponibles.</div>
              )}

              {tab === 'details' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-tech-muted font-black mb-1">Descripción</div>
                      <div className="text-xs text-[#cbd5e1] whitespace-pre-wrap bg-[#1a1b1e] border border-tech-border rounded-lg p-3 min-h-[80px]">
                        {product.description || <span className="italic text-tech-muted">Sin descripción</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Peso">{product.weight_g ? `${(product.weight_g / 1000).toFixed(2)} kg` : '—'}</Field>
                      <Field label="Dimensiones">
                        {product.length_mm && product.width_mm && product.height_mm
                          ? `${product.length_mm}×${product.width_mm}×${product.height_mm} mm`
                          : '—'}
                      </Field>
                      <Field label="Tipo">{product.type || 'simple'}</Field>
                      <Field label="Stock status">{product.stock_status || '—'}</Field>
                      <Field label="Low stock threshold">{product.low_stock_threshold ?? '—'}</Field>
                      <Field label="Creado">{formatDate(product.created_at || '')}</Field>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Field label="Categoría principal">{product.category_id || '—'}</Field>
                    <Field label="Subcategoría 2">{product.category2_id || product.category2 || '—'}</Field>
                    <Field label="Subcategoría 3">{product.category3_id || product.category3 || '—'}</Field>
                    <Field label="Old part number">{product.old_part_number || '—'}</Field>
                    <Field label="Bihr partnumber">{product.bihr_partnumber || '—'}</Field>
                    <Field label="Updated">{formatDate(product.updated_at || '')}</Field>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-tech-muted font-black mb-1">Categorías asignadas (JSON)</div>
                      <pre className="text-[10px] text-[#cbd5e1] bg-[#1a1b1e] border border-tech-border rounded-lg p-3 overflow-x-auto max-h-48">
                        {JSON.stringify(product.categories || product, null, 2).slice(0, 600)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'compatibility' && (
                <div>
                  {compat.length === 0 ? (
                    <div className="p-8 text-center text-tech-muted text-xs italic">Sin compatibilidades declaradas.</div>
                  ) : (
                    <div className="bg-[#1a1b1e] border border-tech-border rounded-xl overflow-hidden">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-tech-border text-[9px] text-tech-muted uppercase tracking-widest font-black">
                            <th className="px-4 py-2">Marca</th>
                            <th className="px-4 py-2">Modelo</th>
                            <th className="px-4 py-2">Año</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/50">
                          {compat.map((c, i) => (
                            <tr key={i} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2 text-xs text-tech-text">{c.brand}</td>
                              <td className="px-4 py-2 text-xs text-[#cbd5e1]">{c.model}</td>
                              <td className="px-4 py-2 text-xs text-tech-muted font-mono">{c.year || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="bg-[#1a1b1e] border border-tech-border rounded-lg p-3">
    <div className="text-[9px] uppercase tracking-widest text-tech-muted font-black mb-0.5">{label}</div>
    <div className="text-xs text-tech-text">{children}</div>
  </div>
);

export default ProductDetailModal;
