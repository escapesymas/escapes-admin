import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/** Producto tal y como lo ve el cliente (precios en céntimos). */
export interface ChatProductCard {
  id: number;
  sku: string;
  name: string;
  brand: string;
  price: number;
  sale_price: number | null;
  stock: number;
  image: string | null;
  slug: string;
  in_stock: boolean;
  /** Solo en el panel: descuento máximo (margen mínimo del 20 % sobre el coste) y comisión por unidad. */
  has_cost?: boolean;
  /** En promoción (DTO2): ya va al margen mínimo, sin descuento ni comisión. */
  in_promo?: boolean;
  max_discount_pct?: number;
  commission_max?: number | null;
  commission_min?: number | null;
}

/** «Ganas 1,98–4,82 €» por unidad, o aviso si no hay coste. */
export const CommissionHint: React.FC<{ p: ChatProductCard }> = ({ p }) => (
  p.in_promo
    ? <span className="text-[10px] text-amber-400">En promoción: sin descuento ni comisión</span>
    : p.has_cost === false
    ? <span className="text-[10px] text-amber-400">Sin coste: no admite descuento</span>
    : p.commission_max != null
      ? (
        <span className="text-[10px] text-emerald-400">
          Ganas {formatPrice(p.commission_min ?? 0)}–{formatPrice(p.commission_max)} · dto. máx. {String(p.max_discount_pct ?? 0).replace('.', ',')} %
        </span>
      )
      : null
);

interface ProductPickerProps {
  adminToken: string;
  onPick: (product: ChatProductCard) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Buscador de productos publicados (nombre, marca, referencia o moto). */
export const ProductPicker: React.FC<ProductPickerProps> = ({ adminToken, onPick, placeholder, autoFocus }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ChatProductCard[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/chat-products?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${adminToken}` }, signal: controller.signal,
        });
        if (res.ok) setResults((await res.json()).products || []);
      } catch { /* cancelado */ } finally {
        setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, adminToken]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Icons.Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-tech-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder || 'Buscar producto: nombre, referencia, moto…'}
          className="w-full bg-tech-carbon border border-tech-border rounded-lg pl-9 pr-3 py-2 text-sm text-tech-text focus:outline-none focus:border-tech-yellow"
        />
      </div>
      {loading && <p className="text-[11px] text-tech-muted px-1">Buscando…</p>}
      {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-[11px] text-tech-muted px-1">Sin resultados.</p>}
      <div className="max-h-72 overflow-y-auto space-y-1">
        {results.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p)}
            className="w-full flex items-center gap-2 p-2 rounded-lg border border-tech-border hover:border-tech-yellow text-left"
          >
            {p.image
              ? <img src={p.image} alt="" className="w-10 h-10 object-contain bg-white rounded" loading="lazy" />
              : <span className="w-10 h-10 bg-tech-carbon rounded flex items-center justify-center"><Icons.Package size={16} className="text-tech-muted" /></span>}
            <span className="flex-1 min-w-0">
              <span className="block text-xs text-tech-text leading-tight line-clamp-2">{p.name}</span>
              <span className="block text-[10px] text-tech-muted">{p.sku} · {p.brand}</span>
              <CommissionHint p={p} />
            </span>
            <span className="text-right">
              <span className="block text-xs font-bold text-tech-text">{formatPrice(p.sale_price ?? p.price)}</span>
              <span className={`block text-[10px] ${p.in_stock ? 'text-emerald-400' : 'text-red-400'}`}>{p.in_stock ? `${p.stock} uds.` : 'Sin stock'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
