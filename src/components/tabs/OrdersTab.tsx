import React from 'react';
import * as Icons from 'lucide-react';
import { OrderStatusBadge, DropshippingStatusBadge } from '../Badges';
import { formatPrice } from '../../utils/format';
import type { Order } from '../../types/admin';

interface OrdersTabProps {
  orders: Order[];
  orderSearch: string;
  orderFilter: string;
  orderDeletingId: number | null;
  setOrderSearch: (v: string) => void;
  setOrderFilter: (v: string) => void;
  setOrderDeletingId: (id: number | null) => void;
  setSelectedOrder: (order: Order | null) => void;
  handleDeleteOrder: (id: number) => Promise<void>;
  handleBulkUpdate: (ids: number[], status: string) => Promise<void>;
}

/**
 * OrdersTab — Historial de Pedidos en PostgreSQL
 *
 * Tabla de pedidos con filtros de estado, búsqueda y controles inline de eliminación.
 * Muestra la integración con Bihr Dropshipping.
 */
const OrdersTab: React.FC<OrdersTabProps> = ({
  orders,
  orderSearch,
  orderFilter,
  orderDeletingId,
  setOrderSearch,
  setOrderFilter,
  setOrderDeletingId,
  setSelectedOrder,
  handleDeleteOrder,
  handleBulkUpdate,
}) => {
  const [selectedIds, setSelectedIds] = React.useState<number[]>([]);
  const [bulkAction, setBulkAction] = React.useState<string>('');

  const filteredOrders = orders.filter(order => {
    if (orderFilter !== 'all') {
      if (order.status !== orderFilter) return false;
    }
    if (orderSearch) {
      const query = orderSearch.toLowerCase();
      const orderIdStr = `#${order.id}`;
      const clientName = `${order.shippingData?.firstName || ''} ${order.shippingData?.lastName || ''}`.toLowerCase();
      const clientEmail = (order.shippingData?.email || '').toLowerCase();
      const paymentId = (order.paymentId || '').toLowerCase();
      return (
        orderIdStr.includes(query) ||
        order.id.toString().includes(query) ||
        clientName.includes(query) ||
        clientEmail.includes(query) ||
        paymentId.includes(query)
      );
    }
    return true;
  });

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    
    // Headers
    const headers = ['ID Pedido', 'Fecha', 'Cliente', 'Email', 'Estado', 'Subtotal', 'Envío', 'Descuento', 'Total', 'Método Pago', 'Estado Dropshipping', 'Tracking'];
    
    // Rows
    const rows = filteredOrders.map(o => [
      o.id,
      new Date(o.createdAt).toLocaleDateString('es-ES'),
      `${o.shippingData?.firstName || ''} ${o.shippingData?.lastName || ''}`,
      o.shippingData?.email || '',
      o.status,
      formatPrice(o.subtotal),
      formatPrice(o.shippingCost),
      formatPrice(o.discountAmount),
      formatPrice(o.total),
      o.paymentId || 'No asignado',
      o.dropshippingStatus || 'not_sent',
      o.trackingNumber || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pedidos_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Filter controls and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
          <input
            type="text"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            placeholder="Buscar pedidos por ID, cliente o email..."
            className="w-full bg-tech-card border border-tech-border rounded-xl pl-11 pr-4 py-3 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all shadow-inner"
          />
        </div>
        
        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'pending', label: 'Pendiente' },
            { id: 'processing', label: 'Procesando' },
            { id: 'completed', label: 'Completado' },
            { id: 'cancelled', label: 'Cancelado' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setOrderFilter(chip.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                orderFilter === chip.id
                  ? 'bg-tech-yellow/15 text-tech-yellow border-tech-yellow/30'
                  : 'bg-tech-card text-tech-muted border-tech-border hover:text-zinc-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
          
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 ml-auto md:ml-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all bg-green-900/40 text-green-400 border border-green-900/50 hover:bg-green-900/60 flex items-center gap-1"
          >
            <Icons.Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div className="bg-tech-card border border-tech-yellow/50 rounded-xl p-4 flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="bg-tech-yellow text-tech-text px-2.5 py-1 rounded-lg text-xs font-black">{selectedIds.length}</span>
            <span className="text-sm font-bold text-zinc-300">pedidos seleccionados</span>
          </div>
          <div className="flex gap-3 items-center">
            <select
              value={bulkAction}
              onChange={(e) => setBulkAction(e.target.value)}
              className="bg-[#1a1b1e] text-zinc-300 border border-tech-border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none focus:border-tech-yellow transition-all cursor-pointer"
            >
              <option value="">-- Acción en lote --</option>
              <option value="pending">Marcar como Pendiente</option>
              <option value="processing">Marcar como Procesando</option>
              <option value="completed">Marcar como Completado</option>
              <option value="cancelled">Marcar como Cancelado</option>
            </select>
            <button
              onClick={async () => {
                if (!bulkAction) return;
                await handleBulkUpdate(selectedIds, bulkAction);
                setSelectedIds([]);
                setBulkAction('');
              }}
              disabled={!bulkAction}
              className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all"
            >
              Aplicar
            </button>
            <button
              onClick={() => {
                // Export logic
                const rows = orders.filter(o => selectedIds.includes(o.id));
                const csvHeader = "ID,Fecha,Cliente,Email,Total,Estado\n";
                const csvRows = rows.map(o => `${o.id},${new Date(o.createdAt).toLocaleDateString('es-ES')},${o.shippingData?.firstName} ${o.shippingData?.lastName},${o.shippingData?.email},${formatPrice(o.total)},${o.status}`).join('\n');
                const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('href', url);
                a.setAttribute('download', 'pedidos_export.csv');
                a.click();
              }}
              className="bg-[#1a1b1e] hover:bg-tech-border text-zinc-300 px-4 py-2 border border-tech-border rounded-lg text-xs font-black uppercase tracking-wider transition-all flex gap-2 items-center"
            >
              <Icons.Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>
      )}

      {/* Orders Table Card */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-4 w-10">
                  <input 
                    type="checkbox" 
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredOrders.map(o => o.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    checked={selectedIds.length > 0 && selectedIds.length === filteredOrders.length}
                    className="w-4 h-4 rounded border-tech-border bg-[#1a1b1e] text-tech-yellow focus:ring-tech-yellow cursor-pointer"
                  />
                </th>
                <th className="pb-4">Pedido ID</th>
                <th className="pb-4">Fecha</th>
                <th className="pb-4">Cliente</th>
                <th className="pb-4">Método Envío</th>
                <th className="pb-4">Total</th>
                <th className="pb-4">Estado</th>
                <th className="pb-4">Dropshipping (Bihr)</th>
                <th className="pb-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-tech-muted italic">
                    No se encontraron pedidos que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className={`hover:bg-white/[0.01] transition-colors ${selectedIds.includes(order.id) ? 'bg-tech-yellow/5' : ''}`}>
                  <td className="py-4">
                    <input 
                      type="checkbox"
                      checked={selectedIds.includes(order.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds([...selectedIds, order.id]);
                        else setSelectedIds(selectedIds.filter(id => id !== order.id));
                      }}
                      className="w-4 h-4 rounded border-tech-border bg-[#1a1b1e] text-tech-yellow focus:ring-tech-yellow cursor-pointer"
                    />
                  </td>
                  <td className="py-4 font-bold text-tech-text">#{order.id}</td>
                  <td className="py-4 text-xs text-tech-muted">{new Date(order.createdAt).toLocaleDateString('es-ES')}</td>
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-300">
                        {order.shippingData?.firstName} {order.shippingData?.lastName}
                      </span>
                      <span className="text-[10px] text-zinc-550 font-mono">{order.shippingData?.email}</span>
                    </div>
                  </td>
                  <td className="py-4 text-xs text-tech-muted font-medium">
                    {order.shippingData?.address ? 'A domicilio' : 'General'}
                  </td>
                  <td className="py-4 font-black italic text-zinc-300 text-sm">{formatPrice(order.total)}</td>
                  <td className="py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="py-4">
                    <DropshippingStatusBadge 
                      status={order.dropshippingStatus} 
                      trackingNumber={order.trackingNumber} 
                      trackingUrl={order.trackingUrl} 
                    />
                  </td>
                  <td className="py-4 text-right">
                    {orderDeletingId === order.id ? (
                      <div className="flex items-center justify-end gap-1.5 animate-pulse bg-red-950/20 px-2.5 py-1 rounded-lg border border-red-900/35">
                        <span className="text-[9px] text-red-500 font-black uppercase tracking-wider mr-1">¿Eliminar?</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleDeleteOrder(order.id);
                            setOrderDeletingId(null);
                          }}
                          className="bg-red-600 hover:bg-red-500 text-tech-text px-2 py-1 rounded text-[9px] font-bold uppercase transition-all"
                        >
                          Sí
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderDeletingId(null);
                          }}
                          className="bg-tech-border hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded text-[9px] font-bold uppercase transition-all"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="bg-[#1a1b1e] hover:bg-tech-border border border-tech-border text-zinc-300 px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
                        >
                          Gestionar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderDeletingId(order.id);
                          }}
                          className="bg-red-950/20 hover:bg-red-950/40 text-red-500 hover:text-red-400 border border-red-950/30 p-2 rounded-lg transition-all flex items-center justify-center"
                          title="Eliminar Pedido Permanentemente"
                        >
                          <Icons.Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrdersTab;
