import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice, formatEuros } from '../../utils/format';
import { ProductPicker, type ChatProductCard } from './ProductPicker';

interface CartItem extends Partial<ChatProductCard> {
  id: number;
  name: string;
  quantity: number;
  unavailable?: boolean;
}

interface Line {
  product: ChatProductCard;
  quantity: number;
}

interface Quote {
  subtotal: number;
  discount: number;
  discountPercent: number;
  shipping: number;
  tax: number;
  total: number;
}

interface OrderBuilderProps {
  adminToken: string;
  conversationId: number;
  customerName: string;
  onClose: () => void;
  /** Mensajes creados (bienvenida si procede y la tarjeta del pedido). */
  onSent: (messages: any[]) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

/**
 * Carrito actual del cliente y preparación de un pedido. Al enviarlo, el
 * cliente recibe una tarjeta con el botón «Ir al envío y pago» (checkout de la
 * web con su dirección) y el pedido queda a nombre del asesor.
 */
export const OrderBuilder: React.FC<OrderBuilderProps> = ({ adminToken, conversationId, customerName, onClose, onSent, showToast }) => {
  const [cart, setCart] = useState<CartItem[] | null>(null);
  const [cartUpdated, setCartUpdated] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sending, setSending] = useState(false);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetch(`/api/admin/chats/${conversationId}/cart`, { headers })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => { setCart(d.items || []); setCartUpdated(d.updatedAt || null); })
      .catch(() => setCart([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // Importe orientativo con el mismo cálculo que el carrito (Península).
  useEffect(() => {
    if (!lines.length) { setQuote(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/cart/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: lines.map((l) => ({ id: l.product.id, quantity: l.quantity })), country: 'ES', postcode: '28001' }),
      }).then((r) => (r.ok ? r.json() : null)).then((q) => q && setQuote(q)).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [lines]);

  const addProduct = (p: ChatProductCard, quantity = 1) => {
    setLines((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return prev.map((l, k) => (k === i ? { ...l, quantity: Math.min(99, l.quantity + quantity) } : l));
      return [...prev, { product: p, quantity }];
    });
  };

  const addCartToOrder = () => {
    for (const it of cart || []) {
      if (!it.unavailable && it.price) addProduct(it as ChatProductCard, it.quantity);
    }
  };

  const send = async () => {
    if (!lines.length || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chats/${conversationId}/order`, {
        method: 'POST', headers,
        body: JSON.stringify({ items: lines.map((l) => ({ id: l.product.id, quantity: l.quantity })), note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      onSent(data.messages || []);
      showToast('Pedido enviado al cliente');
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar el pedido', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-tech-card border-l border-tech-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
          <Icons.ShoppingCart size={18} className="text-tech-yellow" />
          <div className="flex-1">
            <p className="font-bold text-tech-text text-sm">Pedido para {customerName}</p>
            <p className="text-[10px] text-tech-muted">Le llegará con el botón «Ir al envío y pago»</p>
          </div>
          <button onClick={onClose} className="text-tech-muted hover:text-tech-text" aria-label="Cerrar"><Icons.X size={18} /></button>
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
                      <span className={`flex-1 leading-tight ${it.unavailable ? 'text-tech-muted line-through' : 'text-tech-text'}`}>{it.name}</span>
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
            <ul className="space-y-1.5">
              {lines.map((l) => (
                <li key={l.product.id} className="flex items-center gap-2 bg-tech-carbon border border-tech-border rounded-lg p-2">
                  {l.product.image ? <img src={l.product.image} alt="" className="w-9 h-9 object-contain bg-white rounded" /> : <span className="w-9 h-9 bg-tech-card rounded" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-tech-text leading-tight line-clamp-2">{l.product.name}</span>
                    <span className="block text-[10px] text-tech-muted">{formatPrice(l.product.sale_price ?? l.product.price)} · {l.product.in_stock ? `${l.product.stock} en stock` : 'sin stock'}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <button onClick={() => setLines((p) => p.map((x) => (x.product.id === l.product.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}
                      className="w-6 h-6 rounded border border-tech-border text-tech-muted hover:text-tech-text">−</button>
                    <span className="w-6 text-center text-xs text-tech-text">{l.quantity}</span>
                    <button onClick={() => setLines((p) => p.map((x) => (x.product.id === l.product.id ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)))}
                      className="w-6 h-6 rounded border border-tech-border text-tech-muted hover:text-tech-text">+</button>
                  </span>
                  <button onClick={() => setLines((p) => p.filter((x) => x.product.id !== l.product.id))} className="text-tech-muted hover:text-red-400" aria-label="Quitar">
                    <Icons.Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <ProductPicker adminToken={adminToken} onPick={(p) => addProduct(p)} placeholder="Añadir producto…" />
          </section>

          {quote && (
            <section className="bg-tech-carbon border border-tech-border rounded-lg p-3 text-xs space-y-1">
              <p className="flex justify-between text-tech-muted"><span>Subtotal</span><span>{formatEuros(quote.subtotal)}</span></p>
              {quote.discount > 0 && <p className="flex justify-between text-emerald-400"><span>Descuento {quote.discountPercent} %</span><span>−{formatEuros(quote.discount)}</span></p>}
              <p className="flex justify-between text-tech-muted"><span>Envío (Península)</span><span>{quote.shipping > 0 ? formatEuros(quote.shipping) : 'Gratis'}</span></p>
              <p className="flex justify-between font-bold text-tech-text text-sm"><span>Total aprox.</span><span>{formatEuros(quote.total)}</span></p>
              <p className="text-[10px] text-tech-muted">Envío e impuestos definitivos según la dirección que ponga en el pago.</p>
            </section>
          )}

          <label className="block text-[11px] text-tech-muted">
            Nota para el cliente (opcional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
              placeholder="Ej.: Te he puesto las pastillas delanteras y traseras para tu MT-07."
              className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text resize-none" />
          </label>
        </div>

        <div className="p-4 border-t border-tech-border">
          <button onClick={send} disabled={!lines.length || sending}
            className="w-full bg-tech-yellow text-black font-bold font-mono uppercase text-xs py-3 rounded-lg disabled:opacity-50">
            {sending ? 'Enviando…' : 'Enviar pedido al cliente'}
          </button>
        </div>
      </div>
    </div>
  );
};
