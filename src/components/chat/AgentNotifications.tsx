import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';

/**
 * Avisos del asesor: campana con el número de avisos sin leer y una ventana
 * con su historial (chats, pedidos, pagos de comisiones y avisos del
 * administrador). Los avisos del administrador sin leer abren la ventana solos.
 */

interface AgentNotice {
  id: number;
  category: string;
  title: string;
  body: string | null;
  url: string | null;
  created_at: string;
  read_at: string | null;
}

const STYLE: Record<string, { icon: React.ElementType; cls: string; label: string }> = {
  announcement: { icon: Icons.Megaphone, cls: 'text-tech-yellow bg-yellow-500/10 border-yellow-500/30', label: 'Aviso del equipo' },
  payout: { icon: Icons.HandCoins, cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: 'Pago de comisiones' },
  commission: { icon: Icons.TrendingUp, cls: 'text-sky-400 bg-sky-500/10 border-sky-500/30', label: 'Comisiones' },
  chat: { icon: Icons.MessagesSquare, cls: 'text-tech-text bg-slate-500/10 border-slate-500/30', label: 'Chat' },
};
const styleFor = (c: string) => STYLE[c] || STYLE.chat;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

interface AgentNotificationsProps {
  adminToken: string;
  /** Abre el enlace del aviso dentro del panel (conversación del chat). */
  onOpenLink: (url: string) => void;
}

export const AgentNotifications: React.FC<AgentNotificationsProps> = ({ adminToken, onOpenLink }) => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AgentNotice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  // Avisos del administrador ya mostrados automáticamente en esta sesión.
  const shownRef = useRef<Set<number>>(new Set());

  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch('/api/agent/notifications?limit=50', { headers: { Authorization: `Bearer ${adminToken}` } });
      if (!res.ok) return;
      const d = await res.json();
      setItems(d.items || []);
      setUnread(d.unread || 0);
      // Un aviso nuevo del administrador se enseña aunque el asesor no abra la campana.
      const fresh = (d.items || []).filter((n: AgentNotice) => n.category === 'announcement' && !n.read_at && !shownRef.current.has(n.id));
      if (fresh.length) {
        fresh.forEach((n: AgentNotice) => shownRef.current.add(n.id));
        setOpen(true);
      }
    } catch { /* sin conexión: se reintenta en la siguiente vuelta */ } finally {
      if (!silent) setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Escape cierra la ventana.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const markRead = async (body: { ids?: number[]; all?: boolean }) => {
    try {
      await fetch('/api/agent/notifications/read', { method: 'POST', headers, body: JSON.stringify(body) });
    } catch { /* se marcará la próxima vez */ }
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (body.all || body.ids?.includes(n.id) ? { ...n, read_at: n.read_at || now } : n)));
    setUnread((u) => (body.all ? 0 : Math.max(0, u - (body.ids?.length || 0))));
  };

  const openItem = (n: AgentNotice) => {
    if (!n.read_at) markRead({ ids: [n.id] });
    if (n.url) { onOpenLink(n.url); setOpen(false); }
  };

  return (
    <>
      <button
        onClick={() => { setOpen(true); load(); }}
        title="Avisos"
        className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg border border-tech-border text-tech-muted hover:text-tech-text text-xs"
      >
        <Icons.Bell size={14} />
        <span className="hidden sm:inline">Avisos</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-tech-card border border-tech-border rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
              <Icons.Bell size={16} className="text-tech-yellow" />
              <p className="font-bold text-tech-text text-sm flex-1">Avisos {unread > 0 && <span className="text-tech-muted font-normal">· {unread} sin leer</span>}</p>
              {unread > 0 && (
                <button onClick={() => markRead({ all: true })} className="text-[11px] text-tech-muted hover:text-tech-text flex items-center gap-1">
                  <Icons.CheckCheck size={13} /> Marcar todo como leído
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-tech-muted hover:text-tech-text ml-2"><Icons.X size={18} /></button>
            </div>
            <div className="overflow-y-auto divide-y divide-tech-border">
              {loading && !items.length && <p className="p-4 text-xs text-tech-muted">Cargando…</p>}
              {!loading && !items.length && <p className="p-6 text-center text-xs text-tech-muted">No tienes avisos todavía.</p>}
              {items.map((n) => {
                const st = styleFor(n.category);
                const Icon = st.icon;
                return (
                  <button key={n.id} onClick={() => openItem(n)}
                    className={`w-full text-left p-3 flex gap-3 hover:bg-tech-border/20 ${n.read_at ? 'opacity-60' : ''}`}>
                    <span className={`shrink-0 w-8 h-8 rounded-lg border grid place-items-center ${st.cls}`}><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-bold text-tech-text truncate">{n.title}</span>
                        {!n.read_at && <span className="w-2 h-2 rounded-full bg-tech-yellow shrink-0" />}
                      </span>
                      {n.body && <span className="block text-xs text-tech-muted mt-0.5 whitespace-pre-line">{n.body}</span>}
                      <span className="block text-[10px] text-tech-muted mt-1">{st.label} · {timeAgo(n.created_at)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
