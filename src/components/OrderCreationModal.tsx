import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../utils/format';
import type { Product, CartItem } from '../types/admin';

interface OrderCreationModalProps {
  adminWpId: string;
  adminEmail: string;
  adminToken: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const OrderCreationModal: React.FC<OrderCreationModalProps> = ({ adminWpId, adminEmail, adminToken, onClose, onSuccess, showToast }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Formularios
  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '', phone: '', address: '', city: '', zip: '' });

  // Productos a añadir (búsqueda)
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<(Product & { qty: number })[]>([]);

  // Buscar productos
  useEffect(() => {
    if (productSearch.length < 3) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin?action=products-list&search=${encodeURIComponent(productSearch)}&limit=10`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchResults(data);
          } else {
            setSearchResults(data.products || []);
          }
        }
      } catch (err) {
        console.error("Error al buscar productos", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearch, adminToken]);

  // Autocompletar cliente
  useEffect(() => {
    const query = customer.email || customer.phone;
    if (!query || query.length < 5) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin?action=search-customer&q=${encodeURIComponent(query)}`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.firstName) {
            setCustomer(prev => ({
              ...prev,
              firstName: prev.firstName || data.firstName || '',
              lastName: prev.lastName || data.lastName || '',
              email: prev.email || data.email || '',
              phone: prev.phone || data.phone || '',
              address: prev.address || data.address || '',
              city: prev.city || data.city || '',
              zip: prev.zip || data.zip || '',
            }));
            showToast('Datos autocompletados desde pedidos anteriores', 'success');
          }
        }
      } catch (err) {
        console.error("Error buscando cliente", err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [customer.email, customer.phone, adminToken]);

  const addToCart = (prod: Product) => {
    const exists = cartItems.find(i => i.id === prod.id);
    if (exists) {
      setCartItems(cartItems.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i));
    } else {
      setCartItems([...cartItems, { ...prod, qty: 1 }]);
    }
    setProductSearch('');
  };

  const removeFromCart = (id: number) => {
    setCartItems(cartItems.filter(i => i.id !== id));
  };

  const calculateTotal = () => {
    return cartItems.reduce((acc, item) => acc + (item.price || 0) * item.qty, 0);
  };

  const handleCreateOrder = async () => {
    if (!customer.email || !customer.firstName || cartItems.length === 0) {
      showToast('Faltan datos del cliente o productos en el carrito', 'error');
      return;
    }
    setLoading(true);
    try {
      const items = cartItems.map(i => ({
        id: i.id,
        name: i.name,
        quantity: i.qty,
        price: i.price
      }));

      const payload = {
        customerData: customer,
        items,
        generatePaymentLink: true
      };

      const res = await fetch(`/api/admin?action=create-manual-order`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        showToast('Pedido creado y enlace de Stripe generado', 'success');
        onSuccess(); // Cerrará el modal y actualizará
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (e) {
      showToast('Error de red al crear pedido', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-tech-carbon/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-8 shadow-2xl">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-black italic uppercase tracking-wider text-tech-text">Crear Pedido Manual</h3>
            <p className="text-[10px] text-tech-muted font-mono mt-1">
              Se generará un enlace de pago de Stripe que se enviará automáticamente por correo al cliente.
            </p>
          </div>
          <button onClick={onClose} className="text-tech-muted hover:text-tech-text">
            <Icons.X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-tech-yellow' : 'bg-tech-border'}`}></div>
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-tech-yellow' : 'bg-tech-border'}`}></div>
        </div>

        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-xs font-black uppercase tracking-widest text-tech-muted">1. Datos del Cliente</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nombre</label>
                <input type="text" value={customer.firstName} onChange={e => setCustomer({...customer, firstName: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="Ej: Juan" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Apellidos</label>
                <input type="text" value={customer.lastName} onChange={e => setCustomer({...customer, lastName: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="Ej: Pérez" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Correo Electrónico (Para enviar enlace de pago)</label>
                <input type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="ejemplo@correo.com" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Teléfono</label>
                <input type="tel" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="+34 600 000 000" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Dirección</label>
                <input type="text" value={customer.address} onChange={e => setCustomer({...customer, address: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="Calle, Número, Piso..." />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Ciudad</label>
                <input type="text" value={customer.city} onChange={e => setCustomer({...customer, city: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="Madrid" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Código Postal</label>
                <input type="text" value={customer.zip} onChange={e => setCustomer({...customer, zip: e.target.value})} className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-tech-text focus:border-tech-yellow outline-none" placeholder="28001" />
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <button 
                onClick={() => setStep(2)} 
                disabled={!customer.email || !customer.firstName}
                className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-6 py-2.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all"
              >
                Siguiente Paso
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-xs font-black uppercase tracking-widest text-tech-muted">2. Añadir Productos</h4>
            
            <div className="relative">
              <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar por SKU o Nombre de producto..."
                className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl pl-11 pr-4 py-3 text-xs text-tech-text focus:outline-none focus:border-tech-yellow"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1b1e] border border-tech-border rounded-xl overflow-hidden z-10 max-h-48 overflow-y-auto">
                  {searchResults.map(p => (
                    <div key={p.id} onClick={() => addToCart(p)} className="p-3 hover:bg-tech-border cursor-pointer flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        {p.images && Array.isArray(p.images) && p.images[0] && <img src={typeof p.images[0] === 'string' ? p.images[0] : (p.images[0] as any).url} alt="" className="w-8 h-8 object-cover rounded" />}
                        <div>
                          <p className="font-bold text-zinc-300">{p.name}</p>
                          <p className="text-[10px] font-mono text-zinc-500">{p.sku}</p>
                        </div>
                      </div>
                      <span className="font-black text-tech-yellow">{formatPrice(p.price || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-tech-border rounded-xl overflow-hidden">
              <div className="bg-[#1a1b1e]/30 p-3 border-b border-tech-border text-[10px] uppercase font-black tracking-widest text-tech-muted">
                Carrito de Compra
              </div>
              <div className="divide-y divide-zinc-900/60 bg-tech-card min-h-[100px]">
                {cartItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-600 italic">No hay productos en el carrito</div>
                ) : (
                  cartItems.map(item => (
                    <div key={item.id} className="p-3 flex justify-between items-center text-xs">
                      <div className="flex items-center gap-3">
                        <span className="bg-[#1a1b1e] border border-tech-border text-[#cbd5e1] w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold">
                          {item.qty}x
                        </span>
                        <div>
                          <p className="text-zinc-300 font-medium">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{item.sku}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-black text-tech-text italic">{formatPrice((item.price || 0) * item.qty)}</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-500 hover:text-red-400 p-1">
                          <Icons.X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="bg-[#1a1b1e]/40 p-4 border-t border-tech-border flex justify-between items-center text-sm">
                <span className="font-bold text-[#cbd5e1]">Total</span>
                <span className="text-xl font-black italic text-tech-yellow">{formatPrice(calculateTotal())}</span>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button 
                onClick={() => setStep(1)}
                className="bg-[#1a1b1e] hover:bg-tech-border text-zinc-300 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
              >
                Volver
              </button>
              <button 
                onClick={handleCreateOrder}
                disabled={cartItems.length === 0 || loading}
                className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-6 py-2.5 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2"
              >
                {loading ? <Icons.Loader className="w-4 h-4 animate-spin" /> : <Icons.Link className="w-4 h-4" />}
                Crear Pedido y Generar Enlace
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default OrderCreationModal;
