import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';

interface CartItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  price_cents: number;
  image_url?: string;
}

interface Cart {
  id: number;
  user_id?: number;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items: CartItem[];
  total_cents: number;
  updated_at: string;
  status: 'active' | 'abandoned';
}

interface CartsTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
}

const CartsTab: React.FC<CartsTabProps> = ({ adminWpId, adminEmail, adminToken }) => {
  const { showToast } = useToast();
  const [carts, setCarts] = useState<Cart[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'abandoned'>('all');
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null);
  const [sendingRecoveryId, setSendingRecoveryId] = useState<number | null>(null);

  const fetchCarts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=active-carts`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCarts(Array.isArray(data) ? data : data.carts || []);
      }
    } catch (e) {
      console.error('[FETCH CARTS ERROR]:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarts();
  }, [adminToken]);

  const handleSendRecoveryEmail = async (cart: Cart) => {
    if (!cart.customer_email) {
      return showToast('El carrito no tiene un email asociado para enviar la recuperación.', 'error');
    }

    setSendingRecoveryId(cart.id);
    try {
      const res = await fetch(`/api/admin?action=send-cart-recovery-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cartId: cart.id, email: cart.customer_email })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(`Email de recuperación enviado correctamente a ${cart.customer_email}`);
      } else {
        showToast(data.error || 'Error al enviar email de recuperación', 'error');
      }
    } catch (e) {
      showToast('Error de conexión al enviar el correo.', 'error');
    } finally {
      setSendingRecoveryId(null);
    }
  };

  const filteredCarts = carts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const email = (c.customer_email || '').toLowerCase();
      const name = (c.customer_name || '').toLowerCase();
      const itemMatch = c.items?.some(i => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
      return email.includes(q) || name.includes(q) || itemMatch || c.id.toString().includes(q);
    }
    return true;
  });

  // Calculate statistics
  const totalCarts = carts.length;
  const activeCount = carts.filter(c => c.status === 'active').length;
  const abandonedCount = carts.filter(c => c.status === 'abandoned').length;
  const totalValueCents = carts.reduce((acc, c) => acc + (c.total_cents || 0), 0);

  if (loading && carts.length === 0) {
    return (
      <div className="text-tech-muted italic py-12 text-center animate-pulse flex flex-col items-center justify-center gap-3">
        <Icons.Loader2 className="w-8 h-8 text-tech-yellow animate-spin" />
        <span>Cargando carritos activos y abandonados...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-tech-card border border-tech-border rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">Carritos Totales</span>
            <div className="p-2.5 bg-tech-carbon border border-tech-border rounded-lg text-tech-yellow">
              <Icons.ShoppingBag size={18} />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-tech-text">{totalCarts}</div>
        </div>

        <div className="bg-tech-card border border-tech-border rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">Carritos Activos</span>
            <div className="p-2.5 bg-green-950/20 border border-green-900/30 rounded-lg text-green-400">
              <Icons.Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-green-400">{activeCount}</div>
        </div>

        <div className="bg-tech-card border border-tech-border rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">Carritos Abandonados</span>
            <div className="p-2.5 bg-orange-950/20 border border-orange-900/30 rounded-lg text-orange-400">
              <Icons.AlertCircle size={18} />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-orange-400">{abandonedCount}</div>
        </div>

        <div className="bg-tech-card border border-tech-border rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">Valor Retenido</span>
            <div className="p-2.5 bg-tech-yellow/10 border border-tech-yellow/30 rounded-lg text-tech-yellow">
              <Icons.DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-mono font-bold text-tech-yellow">{formatPrice(totalValueCents)}</div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, email, SKU o ID de carrito..."
            className="w-full bg-tech-card border border-tech-border rounded-xl pl-11 pr-4 py-3 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'active', label: 'Activos (<24h)' },
            { id: 'abandoned', label: 'Abandonados (>24h)' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setStatusFilter(chip.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                statusFilter === chip.id
                  ? 'bg-tech-yellow/15 text-tech-yellow border-tech-yellow/30'
                  : 'bg-tech-card text-tech-muted border-tech-border hover:text-zinc-300'
              }`}
            >
              {chip.label}
            </button>
          ))}

          <button
            onClick={fetchCarts}
            className="p-2.5 bg-tech-card hover:bg-tech-border border border-tech-border text-zinc-300 rounded-xl transition-all ml-auto"
            title="Refrescar Carritos"
          >
            <Icons.RefreshCw size={14} className={loading ? 'animate-spin text-tech-yellow' : ''} />
          </button>
        </div>
      </div>

      {/* Carts Table */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-4">Carrito ID</th>
                <th className="pb-4">Cliente / Contacto</th>
                <th className="pb-4">Resumen Artículos</th>
                <th className="pb-4">Valor Total</th>
                <th className="pb-4">Última Actividad</th>
                <th className="pb-4">Estado</th>
                <th className="pb-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {filteredCarts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-tech-muted italic text-xs font-mono">
                    No hay carritos registrados que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filteredCarts.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="py-4 font-mono font-bold text-tech-text text-xs">#{c.id}</td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-300">{c.customer_name || 'Usuario Anónimo'}</span>
                        <span className="text-[10px] text-tech-muted font-mono">{c.customer_email || 'Sin email registrado'}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-xs">
                        {c.items && c.items.length > 0 ? (
                          c.items.slice(0, 2).map((item, i) => (
                            <span key={i} className="bg-tech-carbon border border-tech-border text-tech-text px-2 py-0.5 rounded text-[10px] font-mono truncate max-w-[140px]">
                              {item.quantity}x {item.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-tech-muted italic">Sin artículos</span>
                        )}
                        {c.items && c.items.length > 2 && (
                          <span className="text-[10px] font-bold text-tech-yellow bg-tech-yellow/10 px-1.5 py-0.5 rounded">
                            +{c.items.length - 2} más
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 font-mono font-black italic text-tech-yellow text-sm">{formatPrice(c.total_cents)}</td>
                    <td className="py-4 text-xs text-tech-muted font-mono">
                      {c.updated_at ? new Date(c.updated_at).toLocaleString('es-ES') : '—'}
                    </td>
                    <td className="py-4">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                        c.status === 'abandoned'
                          ? 'bg-orange-950/20 text-orange-400 border-orange-900/30'
                          : 'bg-green-950/20 text-green-400 border-green-900/30'
                      }`}>
                        {c.status === 'abandoned' ? 'Abandonado' : 'Activo'}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedCart(c)}
                          className="bg-[#1a1b1e] hover:bg-tech-border border border-tech-border text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
                        >
                          Inspeccionar
                        </button>
                        {c.customer_email && (
                          <button
                            onClick={() => handleSendRecoveryEmail(c)}
                            disabled={sendingRecoveryId === c.id}
                            className="bg-tech-yellow/10 hover:bg-tech-yellow/20 border border-tech-yellow/30 text-tech-yellow px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-1.5 disabled:opacity-50"
                            title="Enviar correo de recuperación de carrito"
                          >
                            {sendingRecoveryId === c.id ? (
                              <Icons.Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Icons.Mail size={12} />
                            )}
                            Recuperar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cart Detail Inspection Modal */}
      {selectedCart && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-tech-card border border-tech-border rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-tech-border pb-4">
              <div>
                <h3 className="text-lg font-black uppercase italic tracking-tighter text-zinc-100 flex items-center gap-2">
                  <Icons.ShoppingCart className="text-tech-yellow w-5 h-5" /> Carrito #{selectedCart.id}
                </h3>
                <p className="text-[10px] text-tech-muted font-mono mt-0.5">
                  Última modificación: {selectedCart.updated_at ? new Date(selectedCart.updated_at).toLocaleString('es-ES') : '—'}
                </p>
              </div>
              <button onClick={() => setSelectedCart(null)} className="text-tech-muted hover:text-tech-text p-1">
                <Icons.X size={20} />
              </button>
            </div>

            {/* Customer Info */}
            <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4 space-y-2 text-xs">
              <div className="text-[10px] font-black uppercase tracking-widest text-tech-muted">Información del Cliente</div>
              <div className="flex justify-between">
                <span className="text-tech-muted">Nombre:</span>
                <span className="font-bold text-tech-text">{selectedCart.customer_name || 'Anónimo'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tech-muted">Email:</span>
                <span className="font-mono text-tech-yellow">{selectedCart.customer_email || 'No proporcionado'}</span>
              </div>
              {selectedCart.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-tech-muted">Teléfono:</span>
                  <span className="font-mono text-tech-text">{selectedCart.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Items Breakdown */}
            <div className="space-y-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-tech-muted">Artículos En Carrito</div>
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {selectedCart.items && selectedCart.items.map((item, idx) => (
                  <div key={idx} className="bg-[#1a1b1e] border border-tech-border rounded-xl p-3 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-tech-border" />
                      ) : (
                        <div className="w-10 h-10 bg-tech-carbon rounded-lg border border-tech-border flex items-center justify-center text-tech-muted">
                          <Icons.Package size={16} />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-tech-text">{item.name}</div>
                        <div className="text-[10px] text-tech-muted font-mono">SKU: {item.sku || '—'} · Cantidad: {item.quantity}</div>
                      </div>
                    </div>
                    <div className="font-mono font-black italic text-tech-yellow text-sm">
                      {formatPrice(item.price_cents * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Footer */}
            <div className="border-t border-tech-border pt-4 flex justify-between items-center">
              <div>
                <span className="text-xs text-tech-muted uppercase font-bold">Total del Carrito:</span>
                <div className="text-2xl font-black italic text-tech-yellow">{formatPrice(selectedCart.total_cents)}</div>
              </div>
              {selectedCart.customer_email && (
                <button
                  onClick={() => handleSendRecoveryEmail(selectedCart)}
                  className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg"
                >
                  <Icons.Mail size={14} /> Enviar Recordatorio
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartsTab;
