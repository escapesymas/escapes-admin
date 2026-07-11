import React from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';
import type { Order } from '../../types/admin';

interface DashboardStats {
  sales: number;
  orders: number;
  users: number;
  posts: number;
  vps?: {
    cores: number;
    cpu: number;
    ramUsed: string;
    ramTotal: string;
    ramPercent: number;
    disk: { used: string; total: string; percent: string };
    imageStats?: {
      regenerating: boolean;
      status: string;
      regenProcessed: number;
      regenSuccess: number;
      optimized: number;
      total: number;
      regenCurrentSku?: string;
    };
    os: string;
    uptime: string;
  };
}

interface DashboardTabProps {
  adminWpId: string;
  adminEmail: string;
  adminToken: string;
  orders: Order[];
  setSelectedOrder: (order: Order | null) => void;
}

const StatCard = ({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) => (
  <div className="bg-tech-card/80 backdrop-blur-sm border border-tech-border rounded-md p-6 flex flex-col justify-between hover:border-tech-yellow/50 transition-colors shadow-lg">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-tech-carbon border border-tech-border rounded-md shadow-inner">{icon}</div>
      <span className="text-2xl font-mono font-bold text-tech-text">{value}</span>
    </div>
    <span className="text-[10px] text-tech-muted font-mono uppercase tracking-widest">{label}</span>
  </div>
);

const OrderStatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending': return <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Pendiente</span>;
    case 'processing': return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Procesando</span>;
    case 'completed': return <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Completado</span>;
    case 'cancelled': return <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">Cancelado</span>;
    default: return <span className="bg-tech-border text-zinc-400 border border-zinc-700 px-2.5 py-1 rounded-sm text-[9px] font-mono uppercase tracking-wider">{status}</span>;
  }
};

export const DashboardTab: React.FC<DashboardTabProps> = ({ adminWpId, adminEmail, adminToken, orders, setSelectedOrder }) => {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/admin?action=dashboard-stats`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) setStats(data && !data.error ? data : null);
        }
      } catch (err) {
        console.error('[FETCH DASHBOARD STATS ERROR]:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [adminToken]);

  if (!stats) return (
    <div className="flex items-center justify-center h-64 text-tech-muted">
      <Icons.Loader2 size={24} className="animate-spin mr-3" /> Cargando estadísticas...
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Ventas Totales" value={formatPrice(stats.sales)} icon={<Icons.DollarSign className="text-tech-yellow w-5 h-5" />} />
        <StatCard label="Pedidos Procesados" value={stats.orders} icon={<Icons.ShoppingCart className="text-blue-500 w-5 h-5" />} />
        <StatCard label="Clientes Totales" value={stats.users} icon={<Icons.Users className="text-purple-500 w-5 h-5" />} />
        <StatCard label="Temas del Foro" value={stats.posts} icon={<Icons.MessageSquare className="text-green-500 w-5 h-5" />} />
      </div>

      {/* VPS Status */}
      {stats.vps && (
        <div className="w-full">
          {/* VPS Hardware Metrics Card */}
          <div className="bg-tech-card border border-tech-border rounded-md p-6 flex flex-col justify-between shadow-xl">
            <div>
              <h2 className="text-sm font-mono uppercase tracking-wider mb-6 flex items-center gap-2 text-tech-text border-b border-tech-border pb-4">
                <Icons.Cpu className="text-tech-yellow w-4 h-4" /> Telemetría del Servidor (VPS)
              </h2>
              
              <div className="space-y-6">
                {/* CPU Progress */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-2 text-tech-muted">
                    <span>Uso de CPU ({stats.vps.cores} Cores)</span>
                    <span className="text-tech-yellow">{stats.vps.cpu}%</span>
                  </div>
                  <div className="w-full bg-tech-carbon h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div 
                      className="bg-tech-yellow h-full transition-all duration-500" 
                      style={{ width: `${stats.vps.cpu}%` }}
                    />
                  </div>
                </div>

                {/* RAM Progress */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-2 text-tech-muted">
                    <span>Memoria RAM ({stats.vps.ramUsed} / {stats.vps.ramTotal})</span>
                    <span className="text-tech-yellow">{stats.vps.ramPercent}%</span>
                  </div>
                  <div className="w-full bg-tech-carbon h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div 
                      className="bg-tech-yellow h-full transition-all duration-500" 
                      style={{ width: `${stats.vps.ramPercent}%` }}
                    />
                  </div>
                </div>

                {/* Disk Progress */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-2 text-tech-muted">
                    <span>Almacenamiento SSD ({stats.vps.disk.used} / {stats.vps.disk.total})</span>
                    <span className="text-tech-yellow">{stats.vps.disk.percent}</span>
                  </div>
                  <div className="w-full bg-tech-carbon h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
                    <div 
                      className="bg-tech-yellow h-full transition-all duration-500" 
                      style={{ width: stats.vps.disk.percent }}
                    />
                  </div>
                </div>

                {/* Image Regeneration Progress */}
                {stats.vps.imageStats && (
                  <div className="mt-6 pt-6 border-t border-tech-border border-dashed">
                    <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-4 text-tech-text">
                      <span className="flex items-center gap-2"><Icons.Image className="w-3 h-3 text-tech-muted" /> Procesador de Imágenes WebP</span>
                      <span className={stats.vps.imageStats.regenerating ? 'text-green-500 flex items-center gap-1' : 'text-tech-muted'}>
                        {stats.vps.imageStats.regenerating && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                        {stats.vps.imageStats.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-tech-carbon border border-tech-border p-3 rounded-md flex flex-col gap-1 items-center justify-center">
                        <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">Procesados</span>
                        <div className="text-tech-text font-mono font-bold text-lg">{stats.vps.imageStats.regenProcessed}</div>
                      </div>
                      <div className="bg-tech-carbon border border-tech-border p-3 rounded-md flex flex-col gap-1 items-center justify-center">
                        <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">Éxitos</span>
                        <div className="text-green-500 font-mono font-bold text-lg">{stats.vps.imageStats.regenSuccess}</div>
                      </div>
                      <div className="bg-tech-carbon border border-tech-border p-3 rounded-md flex flex-col gap-1 items-center justify-center">
                        <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">Optimizadas</span>
                        <div className="text-tech-yellow font-mono font-bold text-lg">{stats.vps.imageStats.optimized}</div>
                      </div>
                      <div className="bg-tech-carbon border border-tech-border p-3 rounded-md flex flex-col gap-1 items-center justify-center">
                        <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">Total DB</span>
                        <div className="text-tech-text font-mono font-bold text-lg">{stats.vps.imageStats.total}</div>
                      </div>
                    </div>
                    {stats.vps.imageStats.regenerating && stats.vps.imageStats.regenCurrentSku && (
                      <div className="mt-4 p-2 bg-[#1a1b1e] border border-[#2a2b2e] rounded-sm text-[10px] text-tech-yellow font-mono truncate flex items-center gap-2">
                        <Icons.Terminal className="w-3 h-3" /> Procesando SKU: {stats.vps.imageStats.regenCurrentSku}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-tech-border flex justify-between text-[10px] text-tech-muted font-mono uppercase tracking-widest">
              <span>SO: <strong className="text-tech-text font-normal">{stats.vps.os}</strong></span>
              <span>Uptime: <strong className="text-tech-text font-normal">{stats.vps.uptime}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-tech-card border border-tech-border rounded-md shadow-xl">
        <div className="p-6 border-b border-tech-border">
          <h2 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text">
            <Icons.TrendingUp className="text-tech-yellow w-4 h-4" /> Ventas Recientes
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border">
                <th className="px-6 py-4 font-normal">Pedido ID</th>
                <th className="px-6 py-4 font-normal">Fecha</th>
                <th className="px-6 py-4 font-normal">Cliente</th>
                <th className="px-6 py-4 font-normal">Total</th>
                <th className="px-6 py-4 font-normal">Estado</th>
                <th className="px-6 py-4 font-normal text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tech-border">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-[#1a1b1e] transition-colors">
                  <td className="px-6 py-4 font-mono text-tech-text">#{order.id}</td>
                  <td className="px-6 py-4 text-[11px] text-tech-muted">{new Date(order.createdAt).toLocaleDateString('es-ES')}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-tech-text">{order.shippingData?.firstName} {order.shippingData?.lastName}</span>
                      <span className="text-[9px] text-tech-muted font-mono">{order.shippingData?.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-tech-yellow text-sm">{formatPrice(order.total)}</td>
                  <td className="px-6 py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-[10px] text-tech-text hover:text-tech-yellow font-mono uppercase tracking-wider border border-tech-border hover:border-tech-yellow px-3 py-1.5 rounded-sm transition-all"
                    >
                      Inspeccionar
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-tech-muted text-xs font-mono">
                    No hay ventas recientes registradas en la base de datos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
