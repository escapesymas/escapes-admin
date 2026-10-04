import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';
import { ProductPicker, CommissionHint, type ChatProductCard } from './ProductPicker';

interface CartItem extends Partial<ChatProductCard> {
  id: number;
  name: string;
  quantity: number;
  unavailable?: boolean;
}

/** Línea del pedido en preparación (borrador por conversación). */
export interface DraftLine {
  product: ChatProductCard;
  quantity: number;
  /** % de descuento del asesor sobre el precio de venta. */
  discount: number;
}

/** Importes y comisión calculados por el servidor para el borrador. */
export interface OrderPreview {
  lines: { id: number; quantity: number; discount: number; list: number; unit: number; max_discount_pct: number; commission_unit: number | null; commission: number | null }[];
  quote: { subtotal: number; discount: number; discountPercent: number; shipping: number; total: number } | null;
  commissionTotal: number;
}

interface OrderBuilderProps {
  adminToken: string;
  conversationId: number;
  customerName: string;
  lines: DraftLine[];
  setLines: (fn: (prev: DraftLine[]) => DraftLine[]) => void;
  preview: OrderPreview | null;
  onClose: () => void;
  /** Mensajes creados (bienvenida si procede y la tarjeta del pedido). */
  onSent: (messages: any[]) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const pct = (n: number) => String(n).replace('.', ',');

/**
 * Carrito actual del cliente y preparación del pedido con descuento por
 * producto (hasta dejar un 20 % de margen sobre el coste) y la comisión del
 * asesor (50 % del margen neto). Al enviarlo, el cliente recibe la tarjeta con
 * el botón «Ir al envío y pago».
 */
export const OrderBuilder: React.FC<OrderBuilderProps> = ({
  adminToken, conversationId, customerName, lines, setLines, preview, onClose, onSent, showToast,
}) => {
  const [cart, setCart] = useState<CartItem[] | null>(null);
  const [cartUpdated, setCartUpdated] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`/api/admin/chats/${conversationId}/cart`, { headers })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { setCart(d.items || []); setCartUpdated(d.updatedAt || null); })
      .catch(() => setCart([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const maxFor = (l: DraftLine) => preview?.lines.find((x) => x.id === l.product.id)?.max_discount_pct ?? l.product.max_discount_pct ?? 0;

  const addProduct = (p: ChatProductCard, quantity = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return prev.map((l, k) => (k === i ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l));
      return [...prev, { product: p, quantity, discount: 0 }];
    });
  };

  const addCartToOrder = () => {
    for (const it of cart || []) {
      if (!it.unavailable && it.price) addProduct(it as ChatProductCard, it.quantity);
    }
  };

  const update = (id: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.product.id === id ? { ...l, ...patch } : l)));

  const send = async () => {
    if (!lines.length || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chats/${conversationId}/order`, {
        method: 'POST', headers,
        body: JSON.stringify({ items: lines.map((l) => ({ id: l.product.id, quantity: l.quantity, discount: l.discount })), note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      onSent(data.messages || []);
      setLines(() => []);
      showToast('Pedido enviado al cliente');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar el pedido', 'error');
    } finally {
      setSending(false);
    }
  };

  const anyOverLimit = lines.some((l) => l.discount > maxFor(l));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-lg h-full bg-tech-card border-l border-tech-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
          <Icons.ShoppingCart size={18} className="text-tech-yellow" />
          <div className="flex-1">
            <p className="font-bold text-tech-text text-sm">Pedido para {customerName}</p>
            <p className="text-[10px] text-tech-muted">Le llegará con el botón «Ir al envío y pago»</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-mono uppercase text-tech-muted">Tu comisión</p>
            <p className="text-lg font-black text-emerald-400 leading-none">{formatPrice(preview?.commissionTotal || 0)}</p>
          </div>
          <button onClick={onClose} className="text-tech-muted hover:text-tech-text ml-2" aria-label="Cerrar"><Icons.X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Carrito actual */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-mono uppercase text-tech-muted">Carrito actual del cliente</h4>
              {cartUpdated && <span className="text-[10px] text-tech-muted">{new Date(cartUpdated).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            {cart === null && <p className="text-xs text-tech-muted">Cargando…</p>}
            {cart?.length === 0 && <p className="text-xs text-tech-muted">El carrito está vacío.</p>}
            {cart && cart.length > 0 && (
              <>
                <ul className="space-y-1">
                  {cart.map((it, i) => (
                    <li key={`${it.id}-${i}`} className="flex items-center gap-2 text-xs">
                      {it.image ? <img src={it.image} alt="" className="w-8 h-8 object-contain bg-white rounded" /> : <span className="w-8 h-8 bg-tech-carbon rounded" />}
                      <span className="flex-1 min-w-0">
                        <span className={`block leading-tight ${it.unavailable ? 'text-tech-muted line-through' : 'text-tech-text'}`}>{it.name}</span>
                        {!it.unavailable && <CommissionHint p={it as ChatProductCard} />}
                      </span>
                      <span className="text-tech-muted whitespace-nowrap">{it.quantity} × {it.price ? formatPrice(it.sale_price ?? it.price) : '—'}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={addCartToOrder} className="text-[10px] font-mono uppercase text-tech-yellow hover:underline">
                  + Añadir el carrito al pedido
                </button>
              </>
            )}
          </section>

          {/* Pedido */}
          <section className="space-y-2">
            <h4 className="text-[10px] font-mono uppercase text-tech-muted">Productos del pedido</h4>
            {lines.length === 0 && <p className="text-xs text-tech-muted">Añade productos con el buscador o desde su carrito.</p>}
            <ul className="space-y-2">
              {lines.map((l) => {
                const pv = preview?.lines.find((x) => x.id === l.product.id);
                const max = maxFor(l);
                const noCost = l.product.has_cost === false;
                const over = l.discount > max;
                return (
                  <li key={l.product.id} className="bg-tech-carbon border border-tech-border rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      {l.product.image ? <img src={l.product.image} alt="" className="w-10 h-10 object-contain bg-white rounded" /> : <span className="w-10 h-10 bg-tech-card rounded" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs text-tech-text leading-tight line-clamp-2">{l.product.name}</span>
                        <span className="block text-[10px] text-tech-muted">{l.product.sku} · {l.product.in_stock ? `${l.product.stock} en stock` : 'sin stock'}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <button onClick={() => update(l.product.id, { quantity: Math.max(1, l.quantity - 1) })} className="w-6 h-6 rounded border border-tech-border text-tech-muted hover:text-tech-text">−</button>
                        <span className="w-6 text-center text-xs text-tech-text">{l.quantity}</span>
                        <button onClick={() => update(l.product.id, { quantity: Math.min(99, l.quantity + 1) })} className="w-6 h-6 rounded border border-tech-border text-tech-muted hover:text-tech-text">+</button>
                      </span>
                      <button onClick={() => setLines((p) => p.filter((x) => x.product.id !== l.product.id))} className="text-tech-muted hover:text-red-400" aria-label="Quitar">
                        <Icons.Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                      <label className="flex items-center gap-1.5 text-tech-muted">
                        Descuento
                        <input
                          type="number" min={0} max={max} step={0.5} inputMode="decimal"
                          value={l.discount || ''}
                          placeholder="0"
                          disabled={noCost || max <= 0}
                          onChange={(e) => update(l.product.id, { discount: Math.max(0, Math.min(99, Number(e.target.value.replace(',', '.')) || 0)) })}
                          className={`w-16 bg-tech-card border rounded px-2 py-1 text-tech-text text-right disabled:opacity-40 ${over ? 'border-red-500' : 'border-tech-border'}`}
                        />
                        %
                      </label>
                      <span className={over ? 'text-red-400 font-bold' : 'text-tech-muted'}>
                        {noCost ? 'sin coste: no admite descuento' : `máx. ${pct(max)} %`}
                      </span>
                      {!noCost && max > 0 && (
                        <button onClick={() => update(l.product.id, { discount: max })} className="text-[10px] text-tech-yellow hover:underline">usar máx.</button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-tech-muted">
                        {pv && pv.unit < pv.list && <span className="line-through mr-1">{formatPrice(pv.list)}</span>}
                        <span className="text-tech-text font-bold">{formatPrice(pv?.unit ?? (l.product.sale_price ?? l.product.price))}</span>
                        {l.quantity > 1 && <span> × {l.quantity}</span>}
                      </span>
                      <span className="text-emerald-400">
                        {pv?.commission != null
                          ? <>Comisión <b>{formatPrice(pv.commission)}</b>{l.quantity > 1 && pv.commission_unit != null ? ` (${formatPrice(pv.commission_unit)}/ud.)` : ''}</>
                          : noCost ? <span className="text-tech-muted">sin comisión calculable</span> : '…'}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ProductPicker adminToken={adminToken} onPick={(p) => addProduct(p)} placeholder="Añadir producto…" />
          </section>

          {preview?.quote && (
            <section className="bg-tech-carbon border border-tech-border rounded-lg p-3 text-xs space-y-1">
              <p className="flex justify-between text-tech-muted"><span>Subtotal</span><span>{formatPrice(preview.quote.subtotal)}</span></p>
              {preview.quote.discount > 0 && <p className="flex justify-between text-emerald-400"><span>Descuento por importe {preview.quote.discountPercent} % (productos sin descuento tuyo)</span><span>−{formatPrice(preview.quote.discount)}</span></p>}
              <p className="flex justify-between text-tech-muted"><span>Envío (Península)</span><span>{preview.quote.shipping > 0 ? formatPrice(preview.quote.shipping) : 'Gratis'}</span></p>
              <p className="flex justify-between font-bold text-tech-text text-sm"><span>Total aprox. para el cliente</span><span>{formatPrice(preview.quote.total)}</span></p>
              <p className="flex justify-between font-bold text-emerald-400 text-sm pt-1 border-t border-tech-border"><span>Tu comisión</span><span>{formatPrice(preview.commissionTotal)}</span></p>
              <p className="text-[10px] text-tech-muted">Comisión = 50 % del margen neto (precio sin IVA − coste − comisión de pago). Cuenta cuando el cliente paga.</p>
            </section>
          )}

          <label className="block text-[11px] text-tech-muted">
            Nota para el cliente (opcional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
              placeholder="Ej.: Te he puesto las pastillas delanteras y traseras para tu MT-07 con un 10 % de descuento."
              className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text resize-none" />
          </label>
        </div>

        <div className="p-4 border-t border-tech-border space-y-1">
          {anyOverLimit && <p className="text-[11px] text-red-400">Hay descuentos por encima del máximo permitido.</p>}
          <button onClick={send} disabled={!lines.length || sending || anyOverLimit}
            className="w-full bg-tech-yellow text-black font-bold font-mono uppercase text-xs py-3 rounded-lg disabled:opacity-50">
            {sending ? 'Enviando…' : 'Enviar pedido al cliente'}
          </button>
        </div>
      </div>
    </div>
  );
};
