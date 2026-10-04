import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';
import { ProductPicker } from '../chat/ProductPicker';
import { OrderBuilder, type DraftLine, type OrderPreview } from '../chat/OrderBuilder';
import { ChatSales } from '../chat/ChatSales';
import { MyCommissions } from '../chat/MyCommissions';
import { AgentsManager } from '../chat/AgentsManager';
import { isPushNotificationSupported, getCurrentSubscription, subscribeToPushNotifications } from '../../utils/pushNotificationManager';

/**
 * Chat con clientes: conversaciones que el asistente IA ha pasado a un asesor
 * (cuando no ha resuelto la consulta y estamos dentro del horario de atención).
 * Desde aquí se atiende, se envían productos, imágenes y pedidos con botón de
 * pago, y se ven las ventas del chat por asesor.
 */

interface ChatTabProps {
  adminToken: string;
  /** Conversación a abrir al entrar (desde un aviso del móvil). */
  initialConversationId?: number | null;
  onSummaryChange?: (pending: number) => void;
  /** Asesor (panel de asesores): sin ventas, sin equipo ni horario global. */
  isAdvisor?: boolean;
}

interface ConversationItem {
  id: number;
  status: 'waiting' | 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_by: string | null;
  agent_name: string | null;
  user_id: number;
  name: string | null;
  email: string | null;
  last_message: string | null;
  unread: number;
}

interface Message {
  id: number;
  sender: 'customer' | 'ai' | 'agent' | 'system';
  kind?: 'text' | 'product' | 'image' | 'order';
  content: string;
  payload?: any;
  created_at: string;
}

interface ConversationDetail {
  id: number;
  user_id: number;
  status: 'waiting' | 'open' | 'closed';
  created_at: string;
  agent_user_id: number | null;
  agent_name: string | null;
  customerOnline: boolean;
  customer: { name: string; email: string } | null;
  orders: { id: number; status: string; total: number; created_at: string }[];
  garage: { brand: string; model: string; year: number | null }[];
  chatOrders?: { id: number; created_at: string; estimate_commission_cents: number | null; commission_cents: number | null; order_id: number | null; order_status: string | null }[];
}

interface SupportSettings {
  mode: 'auto' | 'on' | 'off';
  timezone: string;
  agentName: string;
  welcomeTemplate?: string;
  days: Record<string, [string, string][]>;
}

interface SupportStatus {
  available: boolean;
  inHours?: boolean;
  onlineAgents?: number;
  hoursText: string;
  nextOpen: string | null;
}

const DAYS: { key: string; label: string }[] = [
  { key: '1', label: 'Lunes' }, { key: '2', label: 'Martes' }, { key: '3', label: 'Miércoles' },
  { key: '4', label: 'Jueves' }, { key: '5', label: 'Viernes' }, { key: '6', label: 'Sábado' }, { key: '0', label: 'Domingo' },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  waiting: { label: 'Esperando', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  open: { label: 'Abierta', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  closed: { label: 'Cerrada', cls: 'bg-slate-500/15 text-tech-muted border-tech-border' },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

/** Contenido de un mensaje según su tipo (texto, producto, imagen o pedido). */
const MessageBody: React.FC<{ m: Message }> = ({ m }) => {
  if (m.kind === 'product' && m.payload) {
    const p = m.payload;
    return (
      <div className="flex items-center gap-2 bg-white/90 text-black rounded-lg p-2 mt-1">
        {p.image ? <img src={p.image} alt="" className="w-12 h-12 object-contain" /> : <Icons.Package size={20} />}
        <div className="min-w-0">
          <p className="text-[9px] uppercase font-mono opacity-60">{p.brand} · {p.sku}</p>
          <p className="text-xs leading-tight line-clamp-2">{p.name}</p>
          <p className="text-xs font-bold">{formatPrice(p.sale_price ?? p.price)}{!p.in_stock && <span className="text-red-600 font-normal"> · sin stock</span>}</p>
        </div>
      </div>
    );
  }
  if (m.kind === 'image' && m.payload?.url) {
    return (
      <div className="mt-1 space-y-1">
        <a href={m.payload.url} target="_blank" rel="noopener noreferrer">
          <img src={m.payload.url} alt={m.content || 'Imagen'} className="rounded-lg max-h-60 object-contain bg-black/10" loading="lazy" />
        </a>
        {m.content && <p>{m.content}</p>}
      </div>
    );
  }
  if (m.kind === 'order' && m.payload) {
    const o = m.payload;
    return (
      <div className="mt-1 bg-white/90 text-black rounded-lg p-2 text-xs space-y-1 min-w-[220px]">
        <p className="font-bold flex items-center gap-1"><Icons.ShoppingCart size={12} /> Pedido enviado con botón de pago</p>
        {o.note && <p className="italic">{o.note}</p>}
        <ul className="space-y-0.5">
          {o.lines.map((l: any) => <li key={l.id} className="flex justify-between gap-2"><span className="line-clamp-1">{l.quantity} × {l.name}</span><span>{formatPrice(l.unit)}</span></li>)}
        </ul>
        <p className="flex justify-between font-bold border-t border-black/10 pt-1"><span>Total aprox.</span><span>{formatPrice(o.total)}</span></p>
      </div>
    );
  }
  return <>{m.content}</>;
};

const ChatTab: React.FC<ChatTabProps> = ({ adminToken, initialConversationId, onSummaryChange, isAdvisor = false }) => {
  const { showToast } = useToast();
  const [view, setView] = useState<'chats' | 'sales' | 'commissions' | 'agents'>('chats');
  const [myOnline, setMyOnline] = useState(false);
  const [pushReady, setPushReady] = useState<boolean | null>(null);
  const [scope, setScope] = useState<'open' | 'closed'>('open');
  const [list, setList] = useState<ConversationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(initialConversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showOrder, setShowOrder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [myAgentName, setMyAgentName] = useState('');
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pedido en preparación de cada conversación (se conserva al cerrar el panel lateral).
  const [drafts, setDrafts] = useState<Record<number, DraftLine[]>>({});
  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const draft = selectedId ? drafts[selectedId] || [] : [];
  const setDraft = (fn: (prev: DraftLine[]) => DraftLine[]) => {
    if (!selectedId) return;
    setDrafts((all) => ({ ...all, [selectedId]: fn(all[selectedId] || []) }));
  };

  const authOnly = { Authorization: `Bearer ${adminToken}` };
  const headers = { ...authOnly, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (initialConversationId) { setSelectedId(initialConversationId); setView('chats'); }
  }, [initialConversationId]);

  // Lista de conversaciones (cada 5 s).
  const loadList = async () => {
    try {
      const res = await fetch(`/api/admin/chats?scope=${scope}`, { headers: authOnly });
      if (!res.ok) return;
      const data = await res.json();
      setList(data.conversations || []);
      if (scope === 'open') {
        onSummaryChange?.((data.conversations || []).filter((c: ConversationItem) => c.status === 'waiting' || c.unread > 0).length);
      }
    } catch { /* se reintenta */ } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    setListLoading(true);
    loadList();
    const id = setInterval(loadList, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, adminToken]);

  const appendMessages = (incoming: Message[]) => {
    if (!incoming?.length) return;
    setMessages((prev) => [...prev, ...incoming.filter((m) => !prev.some((p) => p.id === m.id))]);
    lastIdRef.current = Math.max(lastIdRef.current, ...incoming.map((m) => m.id));
  };

  // Conversación abierta (cada 3 s, solo mensajes nuevos).
  const loadConversation = async (full: boolean) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/chats/${selectedId}?after=${full ? 0 : lastIdRef.current}`, { headers: authOnly });
      if (!res.ok) return;
      const data = await res.json();
      if (full) {
        setDetail(data.conversation);
        setMessages([]);
        lastIdRef.current = 0;
      } else {
        setDetail((d) => (d ? {
          ...d, status: data.conversation.status, customerOnline: data.conversation.customerOnline,
          agent_user_id: data.conversation.agent_user_id, agent_name: data.conversation.agent_name,
        } : d));
      }
      appendMessages(data.messages || []);
    } catch { /* se reintenta */ }
  };

  useEffect(() => {
    lastIdRef.current = 0;
    setDetail(null);
    setMessages([]);
    setShowProducts(false);
    if (!selectedId) return;
    loadConversation(true);
    const id = setInterval(() => loadConversation(false), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Horario y nombre del asesor.
  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/support-settings', { headers: authOnly });
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data.settings);
      setStatus(data.status);
      setMyAgentName((prev) => prev || data.myAgentName || '');
      setMyOnline(!!data.myOnline);
    } catch { /* nada */ }
  };

  // ¿Este dispositivo recibe los avisos del chat?
  useEffect(() => {
    if (!isPushNotificationSupported()) { setPushReady(null); return; }
    getCurrentSubscription().then((sub) => setPushReady(!!sub)).catch(() => setPushReady(false));
  }, []);

  const enablePush = async () => {
    try {
      await subscribeToPushNotifications(adminToken);
      setPushReady(true);
      showToast('Avisos activados en este dispositivo');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudieron activar los avisos', 'error');
    }
  };

  /** Conectarse/desconectarse para atender o cambiar el nombre (cualquier asesor). */
  const saveAgentStatus = async (patch: { online?: boolean; name?: string }) => {
    try {
      const res = await fetch('/api/admin/agent-status', { method: 'POST', headers, body: JSON.stringify(patch) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMyOnline(!!data.myOnline);
      if (data.myAgentName) setMyAgentName(data.myAgentName);
      if (data.status) setStatus(data.status);
      if (patch.name !== undefined) showToast('Nombre guardado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    }
  };
  useEffect(() => {
    loadSettings();
    const id = setInterval(loadSettings, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Importes y comisión del borrador, calculados por el servidor.
  const draftKey = JSON.stringify(draft.map((l) => [l.product.id, l.quantity, l.discount]));
  useEffect(() => {
    if (!selectedId || draft.length === 0) { setPreview(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/chats/${selectedId}/order-preview`, {
        method: 'POST', headers, signal: ctrl.signal,
        body: JSON.stringify({ items: draft.map((l) => ({ id: l.product.id, quantity: l.quantity, discount: l.discount })) }),
      }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setPreview(d)).catch(() => {});
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, draftKey]);

  const saveSettings = async (next: SupportSettings, withName = false) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/support-settings', {
        method: 'PUT', headers, body: JSON.stringify(withName ? { ...next, myAgentName } : next),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSettings(data.settings);
      setStatus(data.status);
      if (data.myAgentName) setMyAgentName(data.myAgentName);
      showToast('Ajustes del chat guardados');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  /** Envía algo al cliente (texto, producto…) y añade lo que devuelva el servidor. */
  const post = async (path: string, body: object | FormData) => {
    if (!selectedId) return false;
    const isForm = body instanceof FormData;
    const res = await fetch(`/api/admin/chats/${selectedId}/${path}`, {
      method: 'POST', headers: isForm ? authOnly : headers, body: isForm ? body : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error');
    appendMessages(data.messages || []);
    setDetail((d) => (d && d.status === 'waiting' ? { ...d, status: 'open' } : d));
    loadList();
    return true;
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await post('message', { content });
      setReply('');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar', 'error');
    } finally {
      setSending(false);
    }
  };

  const take = async () => {
    try {
      await post('take', {});
      loadConversation(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo atender', 'error');
    }
  };

  const sendProduct = async (productId: number) => {
    try {
      await post('product', { productId });
      setShowProducts(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar el producto', 'error');
    }
  };

  const sendImage = async (file: File) => {
    if (!file.type.startsWith('image/')) { showToast('Solo se pueden enviar imágenes', 'error'); return; }
    if (file.size > 12 * 1024 * 1024) { showToast('La imagen supera los 12 MB', 'error'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('image', file, file.name || 'imagen.png');
      await post('image', form);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar la imagen', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Imagen pegada desde el portapapeles (Ctrl+V / Cmd+V).
  const onPaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    const file = item?.getAsFile();
    if (file) { e.preventDefault(); sendImage(file); }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'));
    if (file) sendImage(file);
  };

  const closeConversation = async () => {
    if (!selectedId || !window.confirm('¿Cerrar esta conversación? El cliente volverá al asistente IA.')) return;
    await fetch(`/api/admin/chats/${selectedId}/close`, { method: 'POST', headers: authOnly });
    await loadConversation(true);
    loadList();
  };

  const statusChip = (s: string) => (
    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${STATUS_LABEL[s]?.cls || ''}`}>
      {STATUS_LABEL[s]?.label || s}
    </span>
  );

  const active = !!detail && detail.status !== 'closed';
  const unassigned = active && !detail?.agent_user_id;

  return (
    <div className="space-y-4 py-4">
      {/* Estado, horario y ajustes */}
      <div className="bg-tech-card border border-tech-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => saveAgentStatus({ online: !myOnline })}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-mono uppercase font-bold ${myOnline ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-tech-border text-tech-muted hover:text-tech-text'}`}
            title={myOnline ? 'Pulsa para dejar de recibir clientes' : 'Pulsa para empezar a atender'}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${myOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            {myOnline ? 'Conectado' : 'Desconectado'}
          </button>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-tech-text">
              {status?.available
                ? 'La IA ofrece hablar con un asesor'
                : status?.inHours ? 'Nadie conectado: la IA da el email y el horario' : 'Fuera de horario: la IA da el horario y el email'}
            </p>
            <p className="text-[11px] text-tech-muted">
              Horario: {status?.hoursText || '…'}{!status?.inHours && status?.nextOpen ? ` · Abre ${status.nextOpen}` : ''}
              {' · '}Asesores conectados: {status?.onlineAgents ?? 0}
            </p>
          </div>
          {pushReady === false && (
            <button onClick={enablePush} className="flex items-center gap-1 text-[10px] font-mono uppercase text-tech-yellow border border-tech-yellow/40 rounded-lg px-2.5 py-2">
              <Icons.BellRing size={14} /> Activar avisos aquí
            </button>
          )}
          {!isAdvisor && settings && (
            <div className="flex rounded-lg border border-tech-border overflow-hidden text-[10px] font-mono uppercase" title="Horario de atención">
              {([['auto', 'Según horario'], ['on', 'Siempre'], ['off', 'Cerrado']] as const).map(([m, label]) => (
                <button key={m} onClick={() => saveSettings({ ...settings, mode: m })} disabled={savingSettings}
                  className={`px-3 py-2 ${settings.mode === m ? 'bg-tech-yellow text-black font-bold' : 'text-tech-muted hover:text-tech-text'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowSettings((v) => !v)} className="text-[10px] font-mono uppercase text-tech-muted hover:text-tech-text flex items-center gap-1">
            <Icons.Settings2 size={14} /> Ajustes
          </button>
        </div>

        {showSettings && isAdvisor && (
          <div className="mt-4 pt-4 border-t border-tech-border flex flex-wrap items-end gap-2">
            <label className="block text-[11px] text-tech-muted flex-1 min-w-[200px]">
              Tu nombre en el chat (lo ve el cliente en la bienvenida y en tus mensajes)
              <input value={myAgentName} onChange={(e) => setMyAgentName(e.target.value)} maxLength={60}
                className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
            </label>
            <button onClick={() => saveAgentStatus({ name: myAgentName })}
              className="bg-tech-yellow text-black text-xs font-bold font-mono uppercase px-4 py-2 rounded-lg">Guardar</button>
          </div>
        )}

        {showSettings && !isAdvisor && settings && (
          <div className="mt-4 pt-4 border-t border-tech-border space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block text-[11px] text-tech-muted">
                Tu nombre en el chat
                <input value={myAgentName} onChange={(e) => setMyAgentName(e.target.value)} maxLength={60}
                  className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
              </label>
              <label className="block text-[11px] text-tech-muted">
                Nombre genérico (si un asesor no ha puesto el suyo)
                <input value={settings.agentName} onChange={(e) => setSettings({ ...settings, agentName: e.target.value })} maxLength={60}
                  className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
              </label>
            </div>
            <label className="block text-[11px] text-tech-muted">
              Mensaje de bienvenida al atender ({'{cliente}'} = nombre del cliente, {'{asesor}'} = tu nombre)
              <textarea value={settings.welcomeTemplate || ''} onChange={(e) => setSettings({ ...settings, welcomeTemplate: e.target.value })}
                rows={2} maxLength={500}
                className="mt-1 w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text resize-none" />
            </label>
            <div className="space-y-2">
              <p className="text-[11px] text-tech-muted">Horario de atención</p>
              {DAYS.map(({ key, label }) => {
                const ranges = settings.days[key] || [];
                const setRanges = (r: [string, string][]) => setSettings({ ...settings, days: { ...settings.days, [key]: r } });
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-tech-muted text-xs">{label}</span>
                    {ranges.length === 0 && <span className="text-xs text-tech-muted italic">Cerrado</span>}
                    {ranges.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 bg-tech-carbon border border-tech-border rounded-lg px-2 py-1">
                        <input type="time" value={r[0]} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="bg-transparent text-tech-text text-xs" />
                        <span className="text-tech-muted">–</span>
                        <input type="time" value={r[1]} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="bg-transparent text-tech-text text-xs" />
                        <button onClick={() => setRanges(ranges.filter((_, j) => j !== i))} className="text-tech-muted hover:text-red-400" aria-label="Quitar tramo"><Icons.X size={12} /></button>
                      </span>
                    ))}
                    {ranges.length < 3 && (
                      <button onClick={() => setRanges([...ranges, ranges.length ? ['16:00', '20:00'] : ['10:00', '14:00']])}
                        className="text-[10px] font-mono uppercase text-tech-yellow hover:underline">+ Tramo</button>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => saveSettings(settings, true)} disabled={savingSettings}
              className="bg-tech-yellow text-black text-xs font-bold font-mono uppercase px-4 py-2 rounded-lg disabled:opacity-50">
              {savingSettings ? 'Guardando…' : 'Guardar ajustes'}
            </button>
          </div>
        )}
      </div>

      {/* Conversaciones / ventas */}
      <div className="flex gap-2 text-[10px] font-mono uppercase">
        {([
          ['chats', 'Conversaciones', Icons.MessagesSquare],
          ...(isAdvisor ? [] : [['sales', 'Ventas del chat', Icons.BadgeEuro], ['agents', 'Asesores', Icons.Users]] as const),
          ['commissions', 'Mis comisiones', Icons.Wallet],
        ] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border ${view === v ? 'border-tech-yellow text-tech-yellow' : 'border-tech-border text-tech-muted hover:text-tech-text'}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {view === 'agents' && !isAdvisor && <AgentsManager adminToken={adminToken} showToast={showToast} />}

      {view === 'sales' && !isAdvisor && (
        <ChatSales adminToken={adminToken} onOpenConversation={(id) => { setScope('closed'); setSelectedId(id); setView('chats'); }} />
      )}

      {view === 'commissions' && (
        <MyCommissions adminToken={adminToken}
          onOpenConversation={(id) => { setScope('closed'); setSelectedId(id); setView('chats'); }} />
      )}

      {view === 'chats' && (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 min-h-[60vh]">
          {/* Lista */}
          <div className={`bg-tech-card border border-tech-border rounded-xl overflow-hidden flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
            <div className="flex border-b border-tech-border text-[10px] font-mono uppercase">
              {(['open', 'closed'] as const).map((sc) => (
                <button key={sc} onClick={() => setScope(sc)}
                  className={`flex-1 py-3 ${scope === sc ? 'text-tech-yellow border-b-2 border-tech-yellow' : 'text-tech-muted'}`}>
                  {sc === 'open' ? 'Activas' : 'Cerradas'}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {listLoading && list.length === 0 && <p className="p-4 text-xs text-tech-muted">Cargando…</p>}
              {!listLoading && list.length === 0 && (
                <p className="p-6 text-xs text-tech-muted text-center">
                  {scope === 'open' ? 'No hay conversaciones activas. Te avisaremos al móvil cuando un cliente pida hablar contigo.' : 'Sin conversaciones cerradas.'}
                </p>
              )}
              {list.map((c) => (
                <button key={c.id} onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b border-tech-border hover:bg-[#1a1b1e] ${selectedId === c.id ? 'bg-[#1a1b1e]' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-tech-text truncate flex-1">{c.name || c.email || `Cliente ${c.user_id}`}</span>
                    {c.unread > 0 && <span className="bg-tech-yellow text-black text-[10px] font-bold rounded-full px-1.5">{c.unread}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {statusChip(c.status)}
                    {c.agent_name && <span className="text-[10px] text-tech-muted">· {c.agent_name}</span>}
                    <span className="text-[10px] text-tech-muted ml-auto">{timeAgo(c.updated_at)}</span>
                  </div>
                  {c.last_message && <p className="text-xs text-tech-muted truncate mt-1">{c.last_message}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Conversación */}
          <div className={`bg-tech-card border border-tech-border rounded-xl overflow-hidden flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
            {!selectedId && (
              <div className="flex-1 flex items-center justify-center text-sm text-tech-muted p-8 text-center">Elige una conversación para responder.</div>
            )}
            {selectedId && (
              <>
                <div className="px-4 py-3 border-b border-tech-border flex items-start gap-3">
                  <button onClick={() => setSelectedId(null)} className="md:hidden text-tech-muted mt-0.5" aria-label="Volver"><Icons.ArrowLeft size={18} /></button>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-tech-text truncate">{detail?.customer?.name || '…'}</p>
                      {detail && statusChip(detail.status)}
                      {detail?.customerOnline && active && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />en el chat</span>
                      )}
                      {detail?.agent_name && <span className="text-[10px] text-tech-muted">Atiende: {detail.agent_name}</span>}
                    </div>
                    {detail?.customer?.email && <a href={`mailto:${detail.customer.email}`} className="text-[11px] text-tech-muted hover:text-tech-yellow">{detail.customer.email}</a>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-tech-muted">
                      {detail?.garage?.length ? <span>🏍️ {detail.garage.map((g) => `${g.brand} ${g.model}${g.year ? ` (${g.year})` : ''}`).join(', ')}</span> : null}
                      {detail?.orders?.length
                        ? <span>📦 {detail.orders.map((o) => `#${o.id} ${formatPrice(Number(o.total))} (${o.status})`).join(' · ')}</span>
                        : detail ? <span>Sin pedidos</span> : null}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {unassigned && (
                      <button onClick={take} className="bg-tech-yellow text-black text-[10px] font-bold font-mono uppercase rounded-lg px-3 py-1.5">Atender</button>
                    )}
                    {active && (
                      <button onClick={closeConversation} className="text-[10px] font-mono uppercase text-tech-muted hover:text-red-400 border border-tech-border rounded-lg px-2 py-1.5">Cerrar</button>
                    )}
                  </div>
                </div>

                {(draft.length > 0 || detail?.chatOrders?.length) ? (
                  <button
                    onClick={() => setShowOrder(true)}
                    className="flex items-center gap-2 px-4 py-2 border-b border-tech-border bg-emerald-500/5 text-left hover:bg-emerald-500/10"
                  >
                    <Icons.BadgeEuro size={16} className="text-emerald-400" />
                    {draft.length > 0 ? (
                      <span className="text-xs text-tech-text flex-1">
                        Pedido en preparación ({draft.reduce((a, l) => a + l.quantity, 0)} uds.) · tu comisión:{' '}
                        <b className="text-emerald-400">{formatPrice(preview?.commissionTotal || 0)}</b>
                      </span>
                    ) : (() => {
                      const last = detail!.chatOrders![0];
                      const c = last.commission_cents ?? last.estimate_commission_cents;
                      return (
                        <span className="text-xs text-tech-text flex-1">
                          Último pedido enviado · comisión {last.commission_cents != null ? '' : 'estimada '}
                          <b className="text-emerald-400">{c != null ? formatPrice(c) : '—'}</b>
                          <span className="text-tech-muted"> · {last.order_id ? (last.order_status || 'creado') : 'pendiente de que el cliente lo abra'}</span>
                        </span>
                      );
                    })()}
                    <span className="text-[10px] font-mono uppercase text-tech-muted">Ver pedido</span>
                  </button>
                ) : null}

                <div
                  ref={scrollRef}
                  onDragOver={(e) => { if (active) { e.preventDefault(); setDragOver(true); } }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => active && onDrop(e)}
                  className={`flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[55vh] md:max-h-[60vh] ${dragOver ? 'outline-2 outline-dashed outline-tech-yellow' : ''}`}
                >
                  {messages.map((m) => (
                    m.sender === 'system' ? (
                      <p key={m.id} className="text-[11px] text-center text-tech-muted">{m.content} · {hhmm(m.created_at)}</p>
                    ) : (
                      <div key={m.id} className={`flex ${m.sender === 'agent' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          m.sender === 'agent' ? 'bg-tech-yellow text-black rounded-br-sm'
                            : m.sender === 'customer' ? 'bg-[#1e2128] text-tech-text rounded-bl-sm'
                            : 'bg-transparent border border-dashed border-tech-border text-tech-muted rounded-bl-sm text-xs'
                        }`}>
                          <p className={`text-[9px] font-mono uppercase mb-0.5 ${m.sender === 'agent' ? 'text-black/60' : 'text-tech-muted'}`}>
                            {m.sender === 'agent' ? 'Tú' : m.sender === 'customer' ? 'Cliente' : 'Asistente IA'} · {hhmm(m.created_at)}
                          </p>
                          <MessageBody m={m} />
                        </div>
                      </div>
                    )
                  ))}
                  {uploading && <p className="text-[11px] text-right text-tech-muted">Subiendo imagen…</p>}
                </div>

                {active ? (
                  <div className="p-3 border-t border-tech-border space-y-2">
                    {showProducts && (
                      <div className="bg-tech-carbon border border-tech-border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-mono uppercase text-tech-muted">Enviar tarjeta de producto</p>
                          <button onClick={() => setShowProducts(false)} className="text-tech-muted hover:text-tech-text"><Icons.X size={14} /></button>
                        </div>
                        <ProductPicker adminToken={adminToken} onPick={(p) => sendProduct(p.id)} autoFocus />
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Enviar imagen (también puedes pegarla con Ctrl+V o arrastrarla)"
                        className="flex items-center gap-1 text-[10px] font-mono uppercase text-tech-muted hover:text-tech-yellow border border-tech-border rounded-lg px-2.5 py-1.5">
                        <Icons.Image size={14} /> Imagen
                      </button>
                      <button onClick={() => setShowProducts((v) => !v)} title="Enviar tarjeta de producto"
                        className={`flex items-center gap-1 text-[10px] font-mono uppercase border rounded-lg px-2.5 py-1.5 ${showProducts ? 'border-tech-yellow text-tech-yellow' : 'border-tech-border text-tech-muted hover:text-tech-yellow'}`}>
                        <Icons.Package size={14} /> Producto
                      </button>
                      <button onClick={() => setShowOrder(true)} title="Ver su carrito y preparar un pedido con botón de pago"
                        className="flex items-center gap-1 text-[10px] font-mono uppercase text-tech-muted hover:text-tech-yellow border border-tech-border rounded-lg px-2.5 py-1.5">
                        <Icons.ShoppingCart size={14} /> Carrito y pedido
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) sendImage(f); e.target.value = ''; }} />
                    </div>
                    <div className="flex gap-2">
                      <textarea
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onPaste={onPaste}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(reply); } }}
                        placeholder={unassigned ? 'Escribe para atender (se enviará antes tu bienvenida)…' : 'Escribe tu respuesta… (Intro envía, Mayús+Intro salto de línea, Ctrl+V pega imágenes)'}
                        rows={2}
                        className="flex-1 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text resize-none focus:outline-none focus:border-tech-yellow"
                      />
                      <button onClick={() => send(reply)} disabled={sending || !reply.trim()}
                        className="bg-tech-yellow text-black rounded-lg px-4 font-bold text-xs font-mono uppercase disabled:opacity-50">
                        {sending ? '…' : 'Enviar'}
                      </button>
                    </div>
                    {detail && !detail.customerOnline && (
                      <p className="text-[10px] text-tech-muted">El cliente no tiene el chat abierto: le llegará una notificación (y un email si tarda en volver).</p>
                    )}
                  </div>
                ) : detail ? (
                  <p className="p-3 border-t border-tech-border text-xs text-tech-muted text-center">Conversación cerrada.</p>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {showOrder && selectedId && detail && (
        <OrderBuilder
          adminToken={adminToken}
          conversationId={selectedId}
          customerName={detail.customer?.name || 'el cliente'}
          lines={draft}
          setLines={setDraft}
          preview={preview}
          onClose={() => setShowOrder(false)}
          onSent={(msgs) => { appendMessages(msgs); loadList(); loadConversation(true); }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default ChatTab;
