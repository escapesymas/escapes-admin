import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { AdminSession } from '../../types/admin';

interface AdminLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  session: AdminSession;
  onLogout: () => void;
  pendingOrdersCount: number;
  activeCartsCount: number;
  pendingReviewsCount?: number;
  unreadNotificationsCount?: number;
  chatPendingCount?: number;
  onlineUsersCount?: number;
  /** Asesor: solo el chat. */
  isAdvisor?: boolean;
}

/**
 * Detecta si se ha desplegado una versión nueva del panel (el index.html apunta
 * a otro bundle). La app instalada en el móvil puede seguir abierta días con la
 * versión vieja; se comprueba al volver a la app y cada 5 minutos.
 */
function useNewVersion(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.getAttribute('src');
    if (!current) return; // en desarrollo no hay bundle
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const html = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
        const latest = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
        if (latest && latest !== current) setAvailable(true);
      } catch { /* sin conexión: se reintenta */ }
    };
    const id = setInterval(check, 5 * 60_000);
    document.addEventListener('visibilitychange', check);
    return () => { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', check); };
  }, []);
  return available;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  /** Algo que atender (pedidos por gestionar, mensajes sin leer…): suma en la cabecera del grupo si está plegado. */
  alert?: boolean;
  /** El número es de gente conectada ahora (se enseña con un punto verde en vez de como pendiente). */
  live?: boolean;
}

/** Grupos del menú que el usuario ha plegado (se recuerdan entre visitas). */
const NAV_KEY = 'escapes-admin-nav-collapsed';
const loadCollapsed = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(NAV_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  session,
  onLogout,
  pendingOrdersCount,
  activeCartsCount,
  pendingReviewsCount = 0,
  unreadNotificationsCount = 0,
  chatPendingCount = 0,
  onlineUsersCount = 0,
  isAdvisor = false
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const newVersion = useNewVersion();
  const [collapsed, setCollapsed] = useState<string[]>(loadCollapsed);
  
  const adminEmail = session?.user_email || 'admin@escapesymas.com';

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  // Menú agrupado como el de conta26: un acceso suelto arriba y grupos plegables por temas.
  const dashboardItem: NavItem = { id: 'stats', label: 'Vista general', icon: Icons.LayoutDashboard };
  const navGroups: { id: string; label: string; items: NavItem[] }[] = [
    {
      id: 'ventas', label: 'Ventas', items: [
        { id: 'orders', label: 'Pedidos', icon: Icons.ShoppingCart, badge: pendingOrdersCount, alert: true },
        { id: 'carts', label: 'Carritos', icon: Icons.ShoppingBag, badge: activeCartsCount },
        { id: 'coupons', label: 'Cupones', icon: Icons.Ticket },
        { id: 'shipping', label: 'Envíos y tarifas', icon: Icons.Truck },
      ],
    },
    {
      id: 'clientes', label: 'Clientes', items: [
        { id: 'chat', label: 'Chat', icon: Icons.MessagesSquare, badge: chatPendingCount, alert: true },
        { id: 'advisors', label: 'Asesores', icon: Icons.HandCoins },
        { id: 'reviews', label: 'Reseñas', icon: Icons.Star, badge: pendingReviewsCount, alert: true },
        { id: 'users', label: 'Usuarios', icon: Icons.Users },
      ],
    },
    {
      id: 'catalogo', label: 'Catálogo', items: [
        { id: 'products', label: 'Productos', icon: Icons.Package },
        { id: 'margins', label: 'Precios y márgenes', icon: Icons.TrendingUp },
        { id: 'sync', label: 'Sincronización', icon: Icons.RefreshCw },
      ],
    },
    {
      id: 'marketing', label: 'Marketing', items: [
        { id: 'analytics', label: 'Estadísticas web', icon: Icons.Activity, badge: onlineUsersCount > 0 ? onlineUsersCount : undefined, live: true },
        { id: 'seo', label: 'SEO', icon: Icons.Link2 },
        { id: 'social-content', label: 'Contenido TikTok', icon: Icons.Clapperboard },
      ],
    },
    {
      id: 'administracion', label: 'Administración', items: [
        { id: 'accounting', label: 'Contabilidad', icon: Icons.Receipt },
        { id: 'notifications', label: 'Avisos', icon: Icons.Bell, badge: unreadNotificationsCount, alert: true },
        { id: 'settings', label: 'Ajustes', icon: Icons.Settings },
        { id: 'account-security', label: 'Seguridad', icon: Icons.ShieldCheck },
      ],
    },
  ];
  // Los asesores solo tienen el chat y su seguridad: una lista corta, sin grupos.
  const advisorItems: NavItem[] = [
    { id: 'chat', label: 'Chat', icon: Icons.MessagesSquare, badge: chatPendingCount },
    { id: 'account-security', label: 'Seguridad', icon: Icons.ShieldCheck },
  ];

  const toggleGroup = (id: string) => {
    const next = collapsed.includes(id) ? collapsed.filter((g) => g !== id) : [...collapsed, id];
    setCollapsed(next);
    try { localStorage.setItem(NAV_KEY, JSON.stringify(next)); } catch { /* sin almacenamiento: no se recuerda */ }
  };

  // Al llegar a una pestaña de un grupo plegado (desde un aviso, un enlace o la última abierta) el grupo se despliega.
  useEffect(() => {
    const group = navGroups.find((g) => g.items.some((i) => i.id === activeTab));
    if (group && collapsed.includes(group.id)) toggleGroup(group.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleTabClick(item.id)}
        aria-current={isActive ? 'page' : undefined}
        className={`w-full flex items-center gap-3 text-left px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
          isActive
            ? 'bg-tech-yellow/10 text-tech-yellow'
            : 'text-tech-muted hover:text-tech-text hover:bg-white/[0.04]'
        }`}
      >
        <Icon size={16} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        {item.badge ? (
          item.live ? (
            <span
              title={`${item.badge} online ahora`}
              className="ml-auto shrink-0 flex items-center gap-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {item.badge}
            </span>
          ) : (
            <span className={`ml-auto shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center ${
              isActive ? 'bg-tech-yellow text-tech-carbon' : 'bg-tech-border text-tech-text'
            }`}>
              {item.badge}
            </span>
          )
        ) : null}
      </button>
    );
  };

  const renderNavButtons = () => {
    if (isAdvisor) return <div className="space-y-0.5">{advisorItems.map(renderItem)}</div>;
    return (
      <>
        <div className="space-y-0.5">{renderItem(dashboardItem)}</div>
        {navGroups.map((group) => {
          const open = !collapsed.includes(group.id);
          const hasActive = group.items.some((i) => i.id === activeTab);
          // Plegado, la cabecera enseña cuánto hay que atender dentro para que nada pendiente quede escondido.
          const pending = group.items.reduce((sum, i) => sum + (i.alert && typeof i.badge === 'number' ? i.badge : 0), 0);
          return (
            <div key={group.id} className="pt-4">
              <button
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
                aria-controls={`nav-group-${group.id}`}
                className={`w-full flex items-center justify-between px-3 pb-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] transition-colors ${
                  !open && hasActive ? 'text-tech-yellow' : 'text-tech-muted hover:text-tech-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  {group.label}
                  {!open && pending > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-tech-yellow text-tech-carbon tracking-normal">{pending}</span>
                  )}
                </span>
                <Icons.ChevronDown size={13} className={`opacity-60 transition-transform ${open ? '' : '-rotate-90'}`} />
              </button>
              {open && <div id={`nav-group-${group.id}`} className="space-y-0.5">{group.items.map(renderItem)}</div>}
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-tech-carbon text-tech-text flex flex-col md:flex-row font-sans relative">
      {/* Mobile Header Bar */}
      {isMobile && (
        <header className="flex md:hidden bg-tech-card border-b border-tech-border px-4 pb-3.5 pt-[max(5vh,env(safe-area-inset-top))] justify-between items-center sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-tech-yellow rounded-sm flex items-center justify-center text-tech-carbon">
              <Icons.Shield size={16} />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold uppercase tracking-tighter text-xs">Escapes <span className="text-tech-yellow">{isAdvisor ? 'Asesores' : 'Panel'}</span></span>
              <span className="text-[7px] text-tech-muted font-mono uppercase tracking-widest">{isAdvisor ? 'Panel de asesor' : 'Master Admin'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onLogout}
              className="p-1.5 text-tech-muted hover:text-tech-text transition-colors"
              title="Salir del Panel"
            >
              <Icons.LogOut size={16} />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 text-tech-text hover:text-tech-yellow transition-colors"
              aria-label="Abrir Menú"
            >
              {isMobileMenuOpen ? <Icons.X size={18} /> : <Icons.Menu size={18} />}
            </button>
          </div>
        </header>
      )}

      {/* Backdrop for mobile drawer */}
      {isMobile && isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-tech-carbon/80 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      {/* Mobile Sidebar Navigation Drawer */}
      {isMobile && isMobileMenuOpen && (
        <aside className="fixed left-0 top-0 bottom-0 w-64 bg-tech-card border-r border-tech-border z-50 flex flex-col h-full md:hidden shadow-2xl">
          <div className="px-6 pb-6 pt-[max(5vh,env(safe-area-inset-top))] border-b border-tech-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-tech-yellow rounded-md flex items-center justify-center text-tech-carbon shadow-lg shadow-yellow-500/20">
                <Icons.Shield className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold uppercase tracking-tighter text-sm">Escapes <span className="text-tech-yellow">{isAdvisor ? 'Asesores' : 'Panel'}</span></span>
                <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">{isAdvisor ? 'Panel de asesor' : 'Master Admin'}</span>
              </div>
            </div>
            <button 
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-tech-muted hover:text-tech-text p-1"
            >
              <Icons.X size={18} />
            </button>
          </div>

          <nav aria-label="Secciones del panel" className="px-3 py-4 flex-1 overflow-y-auto custom-scrollbar">
            {renderNavButtons()}
          </nav>

          <div className="p-4 border-t border-tech-border flex flex-col gap-2 bg-tech-carbon/50">
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-7 h-7 bg-tech-carbon rounded-sm flex items-center justify-center text-xs font-mono font-bold text-tech-text border border-tech-border uppercase">
                {adminEmail.slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-tech-text font-mono truncate">{adminEmail}</span>
                <span className="text-[8px] text-green-500 font-mono uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                  Conectado
                </span>
              </div>
            </div>
            <button
              onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-2 bg-tech-carbon hover:bg-red-950/30 hover:text-red-500 border border-tech-border hover:border-red-900/50 text-tech-muted py-3 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all mt-2"
            >
              <Icons.LogOut size={12} /> Salir del Panel
            </button>
          </div>
        </aside>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 bg-tech-carbon border-r border-tech-border flex flex-col h-screen sticky top-0 shrink-0 hidden md:flex">
          <div className="p-6 border-b border-tech-border flex items-center gap-3">
            <div className="w-9 h-9 bg-tech-yellow rounded-md flex items-center justify-center text-tech-carbon shadow-[0_0_15px_rgba(250,204,21,0.15)]">
              <Icons.Shield className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-mono font-bold uppercase tracking-tighter text-sm">Escapes <span className="text-tech-yellow">{isAdvisor ? 'Asesores' : 'Panel'}</span></span>
              <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">{isAdvisor ? 'Panel de asesor' : 'Master Admin'}</span>
            </div>
          </div>

          <nav aria-label="Secciones del panel" className="px-3 py-4 flex-1 overflow-y-auto custom-scrollbar">
            {renderNavButtons()}
          </nav>

          <div className="p-4 border-t border-tech-border flex flex-col gap-2 bg-tech-card">
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="w-7 h-7 bg-tech-carbon rounded-sm flex items-center justify-center text-xs font-mono font-bold text-tech-text border border-tech-border uppercase">
                {adminEmail.slice(0, 2)}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-tech-text font-mono truncate">{adminEmail}</span>
                <span className="text-[8px] text-green-500 font-mono uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse"></span>
                  Conectado
                </span>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 bg-tech-carbon hover:bg-red-950/30 hover:text-red-500 border border-tech-border hover:border-red-900/50 text-tech-muted py-3 rounded-md text-[10px] font-mono uppercase tracking-wider transition-all mt-2"
            >
              <Icons.LogOut size={12} /> Salir del Panel
            </button>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto max-w-7xl mx-auto w-full min-w-0">
        {children}
      </main>

      {/* Fondo bajo la barra de estado del móvil (app instalada): el contenido no se ve detrás al hacer scroll. */}
      {isMobile && <div className="fixed inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-tech-card z-[45] md:hidden pointer-events-none" />}

      {newVersion && (
        <button
          onClick={() => window.location.reload()}
          className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-[max(1rem,env(safe-area-inset-bottom))] bg-tech-yellow text-black text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2"
        >
          <Icons.RefreshCw size={14} /> Hay una versión nueva del panel · Actualizar
        </button>
      )}
    </div>
  );
};
