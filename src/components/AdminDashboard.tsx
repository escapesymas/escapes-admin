import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import AccountingTab from './AccountingTab';
import SyncTab from './tabs/SyncTab';
import UsersTab from './tabs/UsersTab';
import ProductsTab from './tabs/ProductsTab';
import OrdersTab from './tabs/OrdersTab';
import ShippingTab from './tabs/ShippingTab';
import CouponsTab from './tabs/CouponsTab';
import SeoTab from './tabs/SeoTab';
import MarginsTab from './tabs/MarginsTab';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardTab } from './tabs/DashboardTab';
import OrderCreationModal from './OrderCreationModal';
import ProductFormModal from './modals/ProductFormModal';
import ConfirmModal from './modals/ConfirmModal';
import ErrorBoundary from './ErrorBoundary';
import { useToast } from './ToastContext';
import { formatPrice, formatEuros } from '../utils/format';
import type { Order, Product, User, Cart, CartItem, OrderNote, OrderItem, AdminSession } from '../types/admin';

interface AdminDashboardProps {
  session: AdminSession;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ session, onLogout }) => {
  const [activeTab, setActiveTab] = useState('stats');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [carts, setCarts] = useState<Cart[]>([]);
  const [cartsSubTab, setCartsSubTab] = useState<'current' | 'abandoned'>('current');
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Products Search & Pagination
  const [productSearch, setProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);

  // Modals / Form States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProductForm, setShowProductForm] = useState<'create' | 'edit' | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showOrderCreationModal, setShowOrderCreationModal] = useState(false);

  // Orders Search & Filtering
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('all');

  // Orders Extra States (Notes & Refunds)
  const [orderNotes, setOrderNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isCustomerNote, setIsCustomerNote] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);

  // React State-Based Confirmations (Bypasses Native Browser Dialog Blocks)
  const [orderDeletingId, setOrderDeletingId] = useState<number | null>(null);
  const [cartDeletingId, setCartDeletingId] = useState<number | null>(null);
  const [productDeletingId, setProductDeletingId] = useState<number | null>(null);
  const [showModalDeleteConfirm, setShowModalDeleteConfirm] = useState(false);
  const showToast = useToast().showToast;

  const adminWpId = session?.user_id || session?.user?.id || session?.user?.publicMetadata?.wp_id || session?.wp_id || '';
  const adminEmail = session?.user_email || session?.user?.emailAddresses?.[0]?.emailAddress || '';
  const adminToken = session?.token || session?.jwt || '';

  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}` });

  const fetchProductsList = async (searchVal = '', pageVal = 1, append = false, isSilent = false, filters: Record<string, string> = {}) => {
    if (!isSilent) setProductsLoading(true);
    try {
      let url = `/api/admin?action=products-list&search=${encodeURIComponent(searchVal)}&page=${pageVal}&limit=50`;
      for (const [key, val] of Object.entries(filters)) {
        if (val !== '' && val !== undefined && val !== null) {
          url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
        }
      }
      const res = await fetch(url, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : [];
        const total = data?.total ?? null;
        if (total !== null) {
          setHasMoreProducts(pageVal * 50 < total);
        } else {
          setHasMoreProducts(list.length >= 50);
        }
        if (append) {
          setProducts(prev => [...prev, ...list]);
        } else {
          setProducts(list);
        }
      }
    } catch (e) {
      console.error('[FETCH PRODUCTS ERROR]:', e);
    } finally {
      if (!isSilent) setProductsLoading(false);
    }
  };

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      // 2. Fetch Orders List
      const ordersRes = await fetch(`/api/admin?action=orders-list`, { headers: authHeaders() });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(Array.isArray(ordersData) ? ordersData : (ordersData.orders || []));
      }

      // 3. Fetch Users List
      const usersRes = await fetch(`/api/admin?action=users-list`, { headers: authHeaders() });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }

      // 4. Fetch Carts List
      const cartsRes = await fetch(`/api/admin?action=carts-list`, { headers: authHeaders() });
      if (cartsRes.ok) {
        const cartsData = await cartsRes.json();
        setCarts(Array.isArray(cartsData) ? cartsData : []);
      }

    } catch (err) {
      console.error('[FETCH ADMIN DATA ERROR]:', err);
      if (!isSilent) setError('Error al cargar datos desde el servidor. Comprueba la conexión.');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      if (!selectedOrder && !showProductForm && !editingProduct && !showModalDeleteConfirm) {
        fetchData(true);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [adminWpId, adminEmail, selectedOrder, showProductForm, editingProduct, showModalDeleteConfirm]);

  useEffect(() => {
    if (selectedOrder) {
      fetch(`/api/admin?action=get-order-notes&orderId=${selectedOrder.id}`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => { if(Array.isArray(data)) setOrderNotes(data); });
    } else {
      setOrderNotes([]);
      setNewNote('');
      setRefundAmount('');
      setRefundReason('');
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (activeTab === 'products') {
      setProductPage(1);
      fetchProductsList(productSearch, 1, false);
    }
  }, [activeTab]);

  // Also load products on initial mount (when stats tab is default, products might not load until user clicks tab)
  useEffect(() => {
    fetchProductsList('', 1, false, true);
  }, []);

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const response = await fetch(`/api/admin?action=update-order-status`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status })
      });
      if (response.ok) {
        setSelectedOrder(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkUpdate = async (orderIds: number[], status: string) => {
    try {
      const response = await fetch(`/api/admin?action=bulk-update-orders`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds, status })
      });
      if (response.ok) {
        showToast(`Se han actualizado ${orderIds.length} pedidos.`, 'success');
        fetchData();
      } else {
        const errText = await response.text();
        showToast(`Fallo: ${errText}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error al actualizar en lote', 'error');
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    try {
      const response = await fetch(`/api/admin?action=delete-order`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      if (response.ok) {
        showToast('¡Pedido eliminado con éxito!', 'success');
        setSelectedOrder(null);
        fetchData();
      } else {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errJson.message || errText;
        } catch {}
        showToast(`Fallo: ${errMsg}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de red al borrar pedido', 'error');
    }
  };

  const handleDeleteCart = async (cartId: number) => {
    try {
      const response = await fetch(`/api/admin?action=delete-cart`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId })
      });
      if (response.ok) {
        showToast('¡Carrito archivado en abandonados con éxito!', 'success');
        fetchData(true);
      } else {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errJson.message || errText;
        } catch {}
        showToast(`Fallo: ${errMsg}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de red al archivar carrito', 'error');
    }
  };

  const handleSendAbandonedEmail = async (cart: Cart) => {
    if (!cart.userEmail || cart.userEmail === 'Invitado') {
      showToast('No se puede enviar email: Cliente invitado sin correo registrado.', 'error');
      return;
    }
    setSendingEmailId(cart.id);
    try {
      const res = await fetch(`/api/admin?action=send-abandoned-email`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartId: cart.id,
          email: cart.userEmail,
          firstName: cart.userFirstName,
          items: cart.items
        })
      });
      if (res.ok) {
        showToast(`¡Email de recuperación enviado con éxito a ${cart.userFirstName || 'cliente'}!`, 'success');
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Error al enviar el correo.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de conexión al enviar el correo.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handlePermanentlyDeleteCart = async (cartId: number) => {
    try {
      const res = await fetch(`/api/admin?action=permanently-delete-cart`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId })
      });
      if (res.ok) {
        showToast('¡Carrito eliminado de forma permanente con éxito!', 'success');
        fetchData(true);
      } else {
        showToast('Error al eliminar permanentemente.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de red al eliminar el carrito.', 'error');
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      const response = await fetch(`/api/admin?action=delete-product`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      if (response.ok) {
        showToast('¡Producto eliminado con éxito!', 'success');
        fetchData();
      } else {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errJson.message || errText;
        } catch {}
        showToast(`Fallo: ${errMsg}`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error de red al borrar producto', 'error');
    }
  };

  const handleProductSubmit = async (formData: any) => {
    const isEdit = showProductForm === 'edit';
    const action = isEdit ? 'update-product' : 'create-product';
    try {
      const response = await fetch(`/api/admin?action=${action}`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setShowProductForm(null);
        setEditingProduct(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="h-screen bg-tech-carbon flex flex-col items-center justify-center text-tech-text font-sans">
        <Icons.Loader2 className="w-12 h-12 text-tech-yellow animate-spin mb-4" />
        <span className="text-tech-muted text-xs font-bold uppercase tracking-widest italic animate-pulse">Sincronizando Base de Datos...</span>
      </div>
    );
  }

  return (
    <AdminLayout 
      session={session} 
      onLogout={onLogout} 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      pendingOrdersCount={orders.filter(o => o.status === 'pending').length}
      activeCartsCount={carts.length}
    >
      <div className="p-4 sm:p-6 md:p-10">
        {error && (
          <div className="mb-6 p-4 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-3">
            <Icons.AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <ErrorBoundary fallbackTitle="Error al cargar el panel">

        {/* Tab Header */}
        <header className="mb-6 md:mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-tech-border pb-6 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter">
              {activeTab === 'stats' && 'Panel de Control'}
              {activeTab === 'orders' && 'Historial de Pedidos'}
              {activeTab === 'products' && 'Catálogo de Productos'}
              {activeTab === 'users' && 'Usuarios Registrados'}
              {activeTab === 'coupons' && 'Cupones de Descuento'}
              {activeTab === 'shipping' && 'Zonas y Tarifas de Envío'}
              {activeTab === 'seo' && 'SEO Auto-Linking'}
              {activeTab === 'sync' && 'Consola de Sincronización (Bihr)'}
              {activeTab === 'margins' && 'Precios y Márgenes'}
              {activeTab === 'accounting' && 'Contabilidad y Facturación'}
            </h1>
            <p className="text-tech-muted text-xs mt-1 font-medium">
              {activeTab === 'stats' && 'Vista general del rendimiento del e-commerce.'}
              {activeTab === 'orders' && 'Gestiona los estados de los pagos y envíos en PostgreSQL.'}
              {activeTab === 'products' && 'Añade, edita o elimina recambios y su compatibilidad.'}
              {activeTab === 'users' && 'Lista de clientes activos y su rango de fidelización.'}
              {activeTab === 'coupons' && 'Crea, edita o elimina cupones de marketing y campañas.'}
              {activeTab === 'shipping' && 'Configura los métodos de envío, zonas geográficas y umbrales de envío gratis.'}
              {activeTab === 'seo' && 'Gestiona el diccionario de palabras clave del enlazado interno dofollow.'}
              {activeTab === 'sync' && 'Monitorea e inicia la sincronización de catálogos e imágenes del distribuidor.'}
              {activeTab === 'margins' && 'Configura márgenes por marca, categoría o globales y ejecuta el recálculo masivo de precios.'}
              {activeTab === 'accounting' && 'Analíticas financieras, libro de ventas, IVA repercutido y descarga de facturas PDF.'}
            </p>
          </div>
          {activeTab === 'products' && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setShowProductForm('create');
              }}
              className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
            >
              <Icons.Plus size={14} /> Añadir Producto
            </button>
          )}
          {activeTab === 'orders' && (
            <button
              onClick={() => setShowOrderCreationModal(true)}
              className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
            >
              <Icons.Plus size={14} /> Crear Pedido Manual
            </button>
          )}
        </header>

        {/* STATS VIEW */}
        {activeTab === 'stats' && (
          <DashboardTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} orders={orders} setSelectedOrder={setSelectedOrder} />
        )}
        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            orderSearch={orderSearch}
            orderFilter={orderFilter}
            orderDeletingId={orderDeletingId}
            setOrderSearch={setOrderSearch}
            setOrderFilter={setOrderFilter}
            setOrderDeletingId={setOrderDeletingId}
            setSelectedOrder={setSelectedOrder}
            handleDeleteOrder={handleDeleteOrder}
            handleBulkUpdate={handleBulkUpdate}
          />
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <ProductsTab
            products={products}
            productsLoading={productsLoading}
            hasMoreProducts={hasMoreProducts}
            productSearch={productSearch}
            productPage={productPage}
            setProductSearch={setProductSearch}
            setProductPage={setProductPage}
            setEditingProduct={setEditingProduct}
            setShowProductForm={setShowProductForm}
            fetchProductsList={fetchProductsList}
            handleDeleteProduct={handleDeleteProduct}
            userId={adminWpId || ''}
            adminEmail={adminEmail || ''}
            adminToken={adminToken}
          />
        )}



        {/* USERS TAB */}
        {activeTab === 'users' && (
          <UsersTab
            users={users}
            adminWpId={adminWpId}
            adminEmail={adminEmail}
            adminToken={adminToken}
            onUserSaved={() => fetchData(true)}
          />
        )}

        {/* CARTS TAB */}
        {activeTab === 'carts' && (() => {
          const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
          const currentCarts = carts.filter(c => c.isDeleted === 0 && new Date(c.updatedAt).getTime() > sixHoursAgo);
          const abandonedCarts = carts.filter(c => c.isDeleted === 1 || new Date(c.updatedAt).getTime() <= sixHoursAgo);
          const displayCarts = cartsSubTab === 'current' ? currentCarts : abandonedCarts;

          return (
            <div className="space-y-6">
              {/* Header/Info */}
              <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-wider text-tech-text">Seguimiento de Carritos en Tiempo Real</h2>
                  <p className="text-xs text-tech-muted mt-1">Monitorea los carritos de compra activos de clientes registrados e invitados en tu base de datos.</p>
                </div>
                <div className="text-[10px] text-tech-muted font-bold uppercase tracking-widest bg-tech-card border border-tech-border px-4 py-3.5 rounded-xl self-stretch md:self-auto text-center md:text-left">
                  Carritos Registrados: <strong className="text-tech-yellow font-mono">{carts.length}</strong>
                </div>
              </div>

              {/* Sub-tabs Selector */}
              <div className="flex gap-2 p-1 bg-tech-card border border-tech-border rounded-xl w-full md:w-fit">
                <button
                  onClick={() => setCartsSubTab('current')}
                  className={`flex-1 md:flex-none px-4 py-2.5 text-[10px] font-black uppercase italic tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                    cartsSubTab === 'current'
                      ? 'bg-[#1a1b1e] text-tech-yellow shadow-sm border border-zinc-850'
                      : 'text-tech-muted hover:text-zinc-300'
                  }`}
                >
                  <Icons.Activity className="w-3.5 h-3.5" />
                  Actuales ({currentCarts.length})
                </button>
                <button
                  onClick={() => setCartsSubTab('abandoned')}
                  className={`flex-1 md:flex-none px-4 py-2.5 text-[10px] font-black uppercase italic tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                    cartsSubTab === 'abandoned'
                      ? 'bg-[#1a1b1e] text-tech-yellow shadow-sm border border-zinc-850'
                      : 'text-tech-muted hover:text-zinc-300'
                  }`}
                >
                  <Icons.Inbox className="w-3.5 h-3.5" />
                  Abandonados / Eliminados ({abandonedCarts.length})
                </button>
              </div>

              {/* Carts List */}
              <div className="grid grid-cols-1 gap-4">
                {displayCarts.length === 0 ? (
                  <div className="bg-tech-card border border-tech-border rounded-2xl p-12 text-center text-tech-muted italic">
                    <Icons.ShoppingBag className="w-12 h-12 mx-auto text-zinc-800 mb-4 animate-pulse" />
                    {cartsSubTab === 'current' 
                      ? 'No hay carritos activos registrados en este momento.' 
                      : 'No hay carritos abandonados o eliminados registrados.'}
                  </div>
                ) : displayCarts.map((cart) => {
                  const totalCartPrice = cart.items.reduce((sum: number, item: CartItem) => sum + ((item.price || 0) * (item.quantity || 1)), 0);
                  const totalCartQty = cart.items.reduce((sum: number, item: CartItem) => sum + (item.quantity || 1), 0);

                  return (
                    <div key={cart.id} className="bg-tech-card border border-tech-border rounded-2xl p-6 hover:border-tech-border transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div className="flex-1 space-y-4">
                        {/* Cart Info Header */}
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase italic tracking-wider ${
                            cart.userId ? 'bg-orange-500/10 text-tech-yellow border border-orange-500/20' : 'bg-[#1a1b1e] text-tech-muted border border-zinc-850'
                          }`}>
                            {cart.userId ? 'Registrado' : 'Invitado'}
                          </span>
                          <span className="font-bold text-tech-text text-xs">
                            {cart.userId ? (
                              <span className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-zinc-200">
                                  {cart.userFirstName || cart.userLastName
                                    ? `${cart.userFirstName || ''} ${cart.userLastName || ''}`.trim()
                                    : cart.userUsername || 'Usuario Registrado'}
                                </span>
                                <span className="text-[10px] text-tech-muted font-mono font-medium">({cart.userEmail})</span>
                              </span>
                            ) : (
                              <span className="text-[#cbd5e1]">Cliente Invitado</span>
                            )}
                          </span>
                          <span className="text-[10px] text-tech-muted font-mono">Token: {cart.sessionToken.slice(0, 16)}...</span>
                          <span className="text-[10px] text-tech-muted">Última actividad: {new Date(cart.updatedAt).toLocaleString('es-ES')}</span>
                          {cart.isDeleted === 1 && (
                            <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded text-[8px] font-black uppercase italic tracking-widest">
                              Eliminado
                            </span>
                          )}
                        </div>

                        {/* Items List inside Cart */}
                        <div className="flex flex-wrap gap-2.5">
                          {cart.items.length === 0 ? (
                            <span className="text-tech-muted text-xs italic">Carrito vacío</span>
                          ) : cart.items.map((item: CartItem, idx: number) => (
                            <div key={idx} className="bg-[#1a1b1e]/50 border border-tech-border px-3.5 py-2 rounded-xl flex items-center gap-3 text-[11px]">
                              <span className="bg-tech-card border border-zinc-850 text-tech-yellow font-bold rounded-lg w-5 h-5 flex items-center justify-center text-[10px]">
                                {item.quantity}x
                              </span>
                              <div className="flex flex-col">
                                <span className="text-zinc-300 font-medium">{item.title || item.name || 'Producto'}</span>
                                <span className="text-[9px] text-tech-muted font-black uppercase italic">{formatPrice(item.price || 0)}/u</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total / Actions */}
                      <div className="flex flex-wrap items-center gap-6 w-full lg:w-auto justify-between lg:justify-end border-t border-tech-border lg:border-t-0 pt-4 lg:pt-0">
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] uppercase font-black tracking-widest text-tech-muted">Total Estimado</span>
                          <span className="text-lg font-black italic text-tech-yellow font-mono mt-0.5">{formatEuros(totalCartPrice)}</span>
                          <span className="text-[9px] text-tech-muted font-bold uppercase">{totalCartQty} artículos</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {/* Send Email Recovery Button only in Abandoned Tab */}
                          {cartsSubTab === 'abandoned' && (
                            cart.userId && cart.userEmail && cart.userEmail !== 'Invitado' ? (
                              <button
                                onClick={() => handleSendAbandonedEmail(cart)}
                                disabled={sendingEmailId === cart.id}
                                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase italic tracking-wider flex items-center gap-2 transition-all border ${
                                  sendingEmailId === cart.id
                                    ? 'bg-[#1a1b1e] text-zinc-600 border-zinc-850 cursor-not-allowed animate-pulse'
                                    : 'bg-orange-500/10 hover:bg-tech-yellow text-tech-yellow hover:text-black border-orange-500/20 hover:border-transparent'
                                }`}
                                title="Enviar email de recuperación de carrito"
                              >
                                {sendingEmailId === cart.id ? (
                                  <>
                                    <Icons.RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Enviando...
                                  </>
                                ) : (
                                  <>
                                    <Icons.Mail className="w-3.5 h-3.5" />
                                    Enviar Email
                                  </>
                                )}
                              </button>
                            ) : (
                              <span className="text-[9px] text-zinc-600 bg-[#1a1b1e]/30 px-3.5 py-3 rounded-xl border border-tech-border/50 font-bold uppercase italic select-none">
                                Sin Email
                              </span>
                            )
                          )}

                          {/* Delete Controls */}
                          {cartDeletingId === cart.id ? (
                            <div className="flex items-center gap-1.5 animate-pulse bg-red-950/20 px-3.5 py-2 rounded-xl border border-red-900/35">
                              <span className="text-[9px] text-red-500 font-black uppercase tracking-wider mr-1">¿Eliminar?</span>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (cartsSubTab === 'current') {
                                    await handleDeleteCart(cart.id);
                                  } else {
                                    await handlePermanentlyDeleteCart(cart.id);
                                  }
                                  setCartDeletingId(null);
                                }}
                                className="bg-red-600 hover:bg-red-500 text-tech-text px-2 py-1 rounded text-[9px] font-bold uppercase transition-all"
                              >
                                Sí
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCartDeletingId(null);
                                }}
                                className="bg-tech-border hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setCartDeletingId(cart.id)}
                              className="bg-red-950/10 hover:bg-red-950/20 text-red-500 hover:text-red-400 border border-red-950/20 hover:border-red-900/40 p-3.5 rounded-xl transition-all"
                              title={cartsSubTab === 'current' ? "Archivar Carrito" : "Eliminar Carrito Permanentemente"}
                            >
                              <Icons.Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {activeTab === 'coupons' && (
          <div className="bg-card border border-card-border p-6 rounded shadow-xl min-h-[400px]">
            <CouponsTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} />
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="bg-card border border-card-border p-6 rounded shadow-xl min-h-[400px]">
            <ShippingTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} />
          </div>
        )}

        {activeTab === 'seo' && (
          <SeoTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} />
        )}

        {activeTab === 'sync' && (
          <SyncTab />
        )}

        {activeTab === 'margins' && (
          <MarginsTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} />
        )}

        {activeTab === 'accounting' && (
          <AccountingTab adminWpId={adminWpId} adminEmail={adminEmail} adminToken={adminToken} />
        )}
        </ErrorBoundary>
      </div>

      {/* ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-tech-carbon/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-black italic uppercase tracking-wider text-tech-text">Gestionar Pedido #{selectedOrder.id}</h3>
                <p className="text-[10px] text-tech-muted font-mono mt-1">ID Transacción Pasarela: {selectedOrder.paymentId || 'No asignado'}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModalDeleteConfirm(true)}
                  className="bg-red-950/20 hover:bg-red-950/40 text-red-500 hover:text-red-400 border border-red-950/30 p-2 rounded-xl transition-all flex items-center justify-center"
                  title="Eliminar Pedido Permanentemente"
                >
                  <Icons.Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setSelectedOrder(null); setShowModalDeleteConfirm(false); }} className="text-tech-muted hover:text-tech-text">
                  <Icons.X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {showModalDeleteConfirm && (
              <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <Icons.AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                  <div className="text-left">
                    <h5 className="text-xs font-black text-red-400 uppercase tracking-wider">¿Eliminar pedido permanentemente?</h5>
                    <p className="text-[10px] text-[#cbd5e1] mt-0.5 font-medium">Esta acción no se puede deshacer y borrará el pedido en PostgreSQL.</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={async () => {
                      await handleDeleteOrder(selectedOrder.id);
                      setShowModalDeleteConfirm(false);
                    }}
                    className="bg-red-600 hover:bg-red-500 text-tech-text px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Sí, Eliminar
                  </button>
                  <button
                    onClick={() => setShowModalDeleteConfirm(false)}
                    className="bg-[#1a1b1e] hover:bg-tech-border border border-tech-border text-zinc-300 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-xs leading-relaxed">
              <div className="bg-[#1a1b1e]/50 p-4 border border-tech-border rounded-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-tech-muted mb-3">Datos del Cliente</h4>
                <p className="font-bold text-zinc-300">{selectedOrder.shippingData?.firstName} {selectedOrder.shippingData?.lastName}</p>
                <p className="text-[#cbd5e1]">{selectedOrder.shippingData?.email}</p>
                <p className="text-[#cbd5e1] mt-1">Teléfono: {selectedOrder.shippingData?.phone || 'No aportado'}</p>
              </div>

              <div className="bg-[#1a1b1e]/50 p-4 border border-tech-border rounded-xl">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-tech-muted mb-3">Dirección de Entrega</h4>
                <p className="text-zinc-300 font-medium">{selectedOrder.shippingData?.address}</p>
                <p className="text-[#cbd5e1]">{selectedOrder.shippingData?.zip} - {selectedOrder.shippingData?.city}</p>
                <p className="text-tech-muted text-[10px] uppercase font-bold mt-1">España (Península / Baleares)</p>
              </div>
            </div>

            {/* Order Items */}
            <div className="border border-tech-border rounded-xl overflow-hidden mb-8">
              <div className="bg-[#1a1b1e]/30 p-3 border-b border-tech-border text-[10px] uppercase font-black tracking-widest text-tech-muted">
                Productos Comprados
              </div>
              <div className="divide-y divide-zinc-900/60 bg-tech-card">
                {selectedOrder.items.map((item: OrderItem) => (
                  <div key={item.id} className="p-4 flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <span className="bg-[#1a1b1e] border border-tech-border text-[#cbd5e1] w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold">
                        {item.quantity}x
                      </span>
                      <span className="text-zinc-300 font-medium">{item.product_name || 'Producto N/D'}</span>
                    </div>
                    <span className="font-black text-tech-text italic">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#1a1b1e]/40 p-4 border-t border-tech-border flex justify-between items-center text-sm">
                <span className="font-bold text-[#cbd5e1]">Total Facturado</span>
                <span className="text-xl font-black italic text-tech-yellow">{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>

            {/* FACTURA PDF */}
            <div className="bg-[#1a1b1e]/50 p-5 border border-tech-border rounded-xl mb-4">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-tech-muted">Factura PDF</h4>
                {selectedOrder.invoiceNumber && (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">
                    {selectedOrder.invoiceNumber}
                  </span>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                {!selectedOrder.invoiceNumber ? (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin?action=generate-invoice`, {
                          method: 'POST',
                          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: selectedOrder.id }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error generando factura');
                        setSelectedOrder({ ...selectedOrder, invoiceNumber: data.invoice.invoice_number });
                        showToast(`Factura generada: ${data.invoice.invoice_number}`);
                      } catch (err) {
                        showToast((err as Error).message, 'error');
                      }
                    }}
                    className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-2"
                  >
                    <Icons.FilePlus className="w-3.5 h-3.5" />
                    <span>Generar Factura</span>
                  </button>
                ) : (
                  <button
                    onClick={() => window.open(`/api/admin?action=download-invoice&orderId=${selectedOrder.id}`, '_blank')}
                    className="bg-[#1a1b1e] hover:bg-tech-border border border-tech-border text-zinc-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-2"
                  >
                    <Icons.Download className="w-3.5 h-3.5" />
                    <span>Descargar PDF</span>
                  </button>
                )}
              </div>
            </div>

            {/* DROPSHIPPING (BIHR) INTEGRATION */}
            <div className="bg-[#1a1b1e]/50 p-5 border border-tech-border rounded-xl mb-8">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-tech-muted">Integración Dropshipping (Bihr)</h4>
                <div className="flex gap-2">
                  {selectedOrder.dropshippingStatus === 'not_sent' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-tech-border text-[#cbd5e1] border border-zinc-700">No Enviado</span>
                  )}
                  {selectedOrder.dropshippingStatus === 'pending_bihr' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-955/40 text-amber-400 border border-amber-800/40 animate-pulse">Pendiente Distribuidor</span>
                  )}
                  {selectedOrder.dropshippingStatus === 'shipped' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-955/40 text-emerald-400 border border-emerald-800/40">Enviado</span>
                  )}
                  {selectedOrder.dropshippingStatus === 'cancelled' && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-955/40 text-red-400 border border-red-800/40">Cancelado</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Ticket ID de Bihr</p>
                  <p className="font-mono text-tech-text text-sm font-bold">{selectedOrder.bihrTicketId || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-1">Código de Seguimiento (Tracking)</p>
                  {selectedOrder.trackingNumber ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-tech-yellow text-sm font-bold">{selectedOrder.trackingNumber}</span>
                      {selectedOrder.trackingUrl && (
                        <a
                          href={selectedOrder.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 font-bold hover:underline"
                        >
                          [Ver envío]
                        </a>
                      )}
                    </div>
                  ) : (
                    <p className="text-tech-muted font-medium">No disponible</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-3 border-t border-tech-border/60 pt-4">
                {selectedOrder.dropshippingStatus === 'not_sent' && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin?action=send-dropshipping-order', {
                          method: 'POST',
                          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: selectedOrder.id })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error desconocido');

                        showToast(`Pedido enviado a Bihr. Ticket: ${data.ticketId}`);
                        setSelectedOrder({
                          ...selectedOrder,
                          dropshippingStatus: 'pending_bihr',
                          bihrTicketId: data.ticketId
                        });
                        fetchData(true);
                      } catch (err) {
                        showToast((err as Error).message, 'error');
                      }
                    }}
                    className="bg-tech-yellow hover:bg-orange-600 text-tech-text px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-2"
                  >
                    <Icons.Navigation className="w-3.5 h-3.5" />
                    <span>Enviar a Bihr (Dropshipping)</span>
                  </button>
                )}

                {selectedOrder.bihrTicketId && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/admin?action=query-dropshipping-status&orderId=${selectedOrder.id}`);
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Error de conexión');

                        showToast(`Estado Bihr: ${data.dropshippingStatus.toUpperCase()}${data.trackingNumber ? ` | Tracking: ${data.trackingNumber}` : ''}`);

                        setSelectedOrder({
                          ...selectedOrder,
                          dropshippingStatus: data.dropshippingStatus,
                          trackingNumber: data.trackingNumber,
                          trackingUrl: data.trackingUrl
                        });
                        fetchData(true);
                      } catch (err) {
                        showToast((err as Error).message, 'error');
                      }
                    }}
                    className="bg-[#1a1b1e] hover:bg-tech-border border border-tech-border text-zinc-300 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all flex items-center gap-2"
                  >
                    <Icons.RefreshCw className="w-3.5 h-3.5" />
                    <span>Sincronizar Tracking</span>
                  </button>
                )}
              </div>
            </div>

            {/* NOTAS DEL PEDIDO */}
            <div className="bg-[#1a1b1e]/50 p-5 border border-tech-border rounded-xl mb-8">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-tech-muted mb-4">Notas del Pedido</h4>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2">
                {orderNotes.length === 0 ? (
                  <p className="text-xs text-zinc-600 font-medium italic">No hay notas en este pedido.</p>
                ) : (
                  orderNotes.map(note => (
                    <div key={note.id} className={`p-3 rounded-xl border text-xs ${note.is_customer_note ? 'bg-blue-950/20 border-blue-900/30' : 'bg-tech-card border-tech-border'}`}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-black text-tech-muted text-[10px] uppercase tracking-wider">{note.created_by}</span>
                        <span className="text-[9px] text-zinc-600 font-mono">{new Date(note.created_at).toLocaleString('es-ES')}</span>
                      </div>
                      <p className="text-zinc-300 whitespace-pre-wrap">{note.note}</p>
                      {note.is_customer_note && (
                        <span className="mt-2 inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-900/40 text-blue-400">Nota enviada al cliente</span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="flex flex-col gap-3">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Escribe una nota interna o un mensaje para el cliente..."
                  className="w-full bg-tech-card border border-tech-border rounded-xl p-3 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow min-h-[80px]"
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={isCustomerNote}
                      onChange={(e) => setIsCustomerNote(e.target.checked)}
                      className="w-4 h-4 rounded border-tech-border bg-[#1a1b1e] text-tech-yellow focus:ring-tech-yellow"
                    />
                    Enviar nota por correo al cliente
                  </label>
                  <button
                    onClick={async () => {
                      if (!newNote.trim()) return;
                      try {
                        const res = await fetch(`/api/admin?action=add-order-note`, {
                          method: 'POST',
                          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: selectedOrder.id, note: newNote, isCustomerNote })
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setOrderNotes([data, ...orderNotes]);
                          setNewNote('');
                          setIsCustomerNote(false);
                          showToast('Nota añadida correctamente.');
                        } else {
                          showToast(data.error || 'Error al añadir nota', 'error');
                        }
                      } catch (err) {
                        showToast('Error de red', 'error');
                      }
                    }}
                    disabled={!newNote.trim()}
                    className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-4 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all"
                  >
                    Añadir Nota
                  </button>
                </div>
              </div>
            </div>

            {/* REEMBOLSOS (STRIPE) */}
            {(selectedOrder.stripe_charge_id || selectedOrder.paymentId) && (
              <div className="bg-[#1a1b1e]/50 p-5 border border-red-900/30 rounded-xl mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-red-500">Reembolsos (Stripe)</h4>
                  {(selectedOrder.refunded_amount ?? 0) > 0 && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-red-955/40 text-red-400 border border-red-800/40">
                      Reembolsado: {formatEuros(selectedOrder.refunded_amount || 0)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                  <div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Cantidad a Reembolsar (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(selectedOrder.total / 100) - (selectedOrder.refunded_amount || 0)}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder={`Max: ${((selectedOrder.total / 100) - (selectedOrder.refunded_amount || 0)).toFixed(2)}`}
                      className="w-full bg-tech-card border border-tech-border rounded-xl px-4 py-2 text-xs text-tech-text focus:border-red-500 outline-none"
                    />
                  </div>
                  <div className="w-full">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Motivo (Opcional)</label>
                    <select
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full bg-tech-card border border-tech-border rounded-xl px-4 py-2 text-xs text-tech-text focus:border-red-500 outline-none"
                    >
                      <option value="">Selecciona un motivo</option>
                      <option value="requested_by_customer">Solicitado por el cliente</option>
                      <option value="fraudulent">Sospecha de fraude</option>
                      <option value="duplicate">Duplicado</option>
                    </select>
                  </div>
                  <button
                    onClick={async () => {
                      if (!refundAmount || parseFloat(refundAmount) <= 0) return;
                      setShowRefundConfirm(true);
                    }}
                    disabled={!refundAmount || parseFloat(refundAmount) <= 0}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all whitespace-nowrap h-[38px] flex items-center justify-center shrink-0"
                  >
                    Procesar Reembolso
                  </button>
                </div>
              </div>
            )}


            {/* Update Status Dropdown */}
            <div className="flex items-center gap-4 border-t border-tech-border pt-6">
              <span className="text-[10px] uppercase font-black tracking-widest text-tech-muted">Cambiar Estado</span>
              <div className="flex gap-2">
                {['pending', 'processing', 'completed', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleUpdateOrderStatus(selectedOrder.id, st)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase italic tracking-wider transition-all border ${
                      selectedOrder.status === st
                        ? 'bg-tech-yellow text-tech-text border-tech-yellow'
                        : 'bg-[#1a1b1e] hover:bg-tech-border border-tech-border text-tech-muted'
                    }`}
                  >
                    {st === 'pending' && 'Pendiente'}
                    {st === 'processing' && 'Procesando'}
                    {st === 'completed' && 'Completado'}
                    {st === 'cancelled' && 'Cancelado'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER CREATION MODAL */}
      {showOrderCreationModal && (
        <OrderCreationModal
          adminWpId={adminWpId}
          adminEmail={adminEmail}
          adminToken={adminToken}
          onClose={() => setShowOrderCreationModal(false)}
          onSuccess={() => {
            setShowOrderCreationModal(false);
            fetchData();
          }}
          showToast={showToast}
        />
      )}

      {/* PRODUCT FORM MODAL */}
      {showProductForm && (
        <ProductFormModal
          session={session}
          mode={showProductForm}
          product={editingProduct}
          onClose={() => setShowProductForm(null)}
          onSubmit={handleProductSubmit}
        />
      )}

      {/* CONFIRM MODAL for refund */}
      <ConfirmModal
        open={showRefundConfirm}
        title="Confirmar reembolso Stripe"
        message={`Vas a reembolsar ${refundAmount}€ directamente a la tarjeta del cliente a través de Stripe. ¿Estás seguro?`}
        confirmLabel="Sí, reembolsar"
        variant="danger"
        onConfirm={async () => {
          setShowRefundConfirm(false);
          if (!refundAmount || parseFloat(refundAmount) <= 0) return;
          try {
          if (!selectedOrder) return;
            const res = await fetch(`/api/admin?action=refund-order`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: selectedOrder.id, amount: parseFloat(refundAmount), reason: refundReason })
            });
            const data = await res.json();
            if (res.ok) {
              showToast('Reembolso procesado correctamente.');
              setSelectedOrder({ ...selectedOrder, refunded_amount: (selectedOrder.refunded_amount || 0) + parseFloat(refundAmount) });
              setRefundAmount('');
              fetchData();
            } else {
              showToast(`Error Stripe: ${data.error}`, 'error');
            }
          } catch(e) {
            showToast('Error de red al reembolsar', 'error');
          }
        }}
        onCancel={() => setShowRefundConfirm(false)}
      />
    </AdminLayout>
  );
};

// StatCard, OrderStatusBadge, DropshippingStatusBadge inlined from Badges.tsx — use imports instead
// ProductFormModal extracted to ./modals/ProductFormModal.tsx
// CouponsTab, SeoTab, MarginsTab extracted to ./tabs/
