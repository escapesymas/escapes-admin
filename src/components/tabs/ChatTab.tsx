import React, { useEffect, useRef, useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';

/**
 * Chat con clientes: conversaciones que el asistente IA ha pasado a un asesor
 * (cuando no ha resuelto la consulta y estamos dentro del horario de atención).
 */

interface ChatTabProps {
  adminToken: string;
  /** Conversación a abrir al entrar (desde un aviso del móvil). */
  initialConversationId?: number | null;
  onSummaryChange?: (pending: number) => void;
}

interface ConversationItem {
  id: number;
  status: 'waiting' | 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_by: string | null;
  user_id: number;
  name: string | null;
  email: string | null;
  last_message: string | null;
  unread: number;
}

interface Message {
  id: number;
  sender: 'customer' | 'ai' | 'agent' | 'system';
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: number;
  user_id: number;
  status: 'waiting' | 'open' | 'closed';
  created_at: string;
  customerOnline: boolean;
  customer: { name: string; email: string } | null;
  orders: { id: number; status: string; total: number; created_at: string }[];
  garage: { brand: string; model: string; year: number | null }[];
}

interface SupportSettings {
  mode: 'auto' | 'on' | 'off';
  timezone: string;
  agentName: string;
  days: Record<string, [string, string][]>;
}

interface SupportStatus {
  available: boolean;
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

const ChatTab: React.FC<ChatTabProps> = ({ adminToken, initialConversationId, onSummaryChange }) => {
  const { showToast } = useToast();
  const [scope, setScope] = useState<'open' | 'closed'>('open');
  const [list, setList] = useState<ConversationItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(initialConversationId ?? null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const lastIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (initialConversationId) setSelectedId(initialConversationId);
  }, [initialConversationId]);

  // Lista de conversaciones (cada 5 s).
  const loadList = async () => {
    try {
      const res = await fetch(`/api/admin/chats?scope=${scope}`, { headers });
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

  // Conversación abierta (cada 3 s, solo mensajes nuevos).
  const loadConversation = async (full: boolean) => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/admin/chats/${selectedId}?after=${full ? 0 : lastIdRef.current}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (full) {
        setDetail(data.conversation);
        setMessages(data.messages || []);
      } else {
        setDetail((d) => (d ? { ...d, status: data.conversation.status, customerOnline: data.conversation.customerOnline } : d));
        if (data.messages?.length) {
          setMessages((prev) => [...prev, ...data.messages.filter((m: Message) => !prev.some((p) => p.id === m.id))]);
        }
      }
      const all: Message[] = data.messages || [];
      if (all.length) lastIdRef.current = Math.max(full ? 0 : lastIdRef.current, all[all.length - 1].id);
    } catch { /* se reintenta */ }
  };

  useEffect(() => {
    lastIdRef.current = 0;
    setDetail(null);
    setMessages([]);
    if (!selectedId) return;
    loadConversation(true);
    const id = setInterval(() => loadConversation(false), 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Horario.
  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/support-settings', { headers });
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data.settings);
      setStatus(data.status);
    } catch { /* nada */ }
  };
  useEffect(() => {
    loadSettings();
    const id = setInterval(loadSettings, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = async (next: SupportSettings) => {
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/support-settings', { method: 'PUT', headers, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setSettings(data.settings);
      setStatus(data.status);
      showToast('Horario guardado');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo guardar', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/chats/${selectedId}/message`, { method: 'POST', headers, body: JSON.stringify({ content }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setReply('');
      setMessages((prev) => [...prev, data.message]);
      lastIdRef.current = Math.max(lastIdRef.current, data.message.id);
      setDetail((d) => (d && d.status === 'waiting' ? { ...d, status: 'open' } : d));
      loadList();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'No se pudo enviar', 'error');
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!selectedId || !window.confirm('¿Cerrar esta conversación? El cliente volverá al asistente IA.')) return;
    await fetch(`/api/admin/chats/${selectedId}/close`, { method: 'POST', headers });
    await loadConversation(true);
    loadList();
  };

  const statusChip = (s: string) => (
    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${STATUS_LABEL[s]?.cls || ''}`}>
      {STATUS_LABEL[s]?.label || s}
    </span>
  );

  const greeting = settings ? `Hola${detail?.customer?.name ? ` ${detail.customer.name.split(' ')[0]}` : ''}, soy ${settings.agentName}. ¿En qué puedo ayudarte?` : '';

  return (
    <div className="space-y-4 py-4">
      {/* Estado y horario */}
      <div className="bg-tech-card border border-tech-border rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`w-2.5 h-2.5 rounded-full ${status?.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold text-tech-text">
              {status?.available ? 'Estás disponible: la IA ofrecerá hablar contigo' : 'No disponible: la IA da el horario y el email'}
            </p>
            <p className="text-[11px] text-tech-muted">
              Horario: {status?.hoursText || '…'}{!status?.available && status?.nextOpen ? ` · Vuelves ${status.nextOpen}` : ''}
            </p>
          </div>
          {settings && (
            <div className="flex rounded-lg border border-tech-border overflow-hidden text-[10px] font-mono uppercase">
              {([['auto', 'Según horario'], ['on', 'Disponible'], ['off', 'No disponible']] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => saveSettings({ ...settings, mode: m })}
                  disabled={savingSettings}
                  className={`px-3 py-2 ${settings.mode === m ? 'bg-tech-yellow text-black font-bold' : 'text-tech-muted hover:text-tech-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowSettings((v) => !v)} className="text-[10px] font-mono uppercase text-tech-muted hover:text-tech-text flex items-center gap-1">
            <Icons.Clock size={14} /> Horario
          </button>
        </div>

        {showSettings && settings && (
          <div className="mt-4 pt-4 border-t border-tech-border space-y-3">
            <label className="block text-[11px] text-tech-muted">
              Nombre con el que respondes
              <input
                value={settings.agentName}
                onChange={(e) => setSettings({ ...settings, agentName: e.target.value })}
                className="mt-1 w-full max-w-sm bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text"
              />
            </label>
            <div className="space-y-2">
              {DAYS.map(({ key, label }) => {
                const ranges = settings.days[key] || [];
                const setRanges = (r: [string, string][]) => setSettings({ ...settings, days: { ...settings.days, [key]: r } });
                return (
                  <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-24 text-tech-muted text-xs">{label}</span>
                    {ranges.length === 0 && <span className="text-xs text-tech-muted italic">Cerrado</span>}
                    {ranges.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 bg-tech-carbon border border-tech-border rounded-lg px-2 py-1">
                        <input type="time" value={r[0]} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))}
                          className="bg-transparent text-tech-text text-xs" />
                        <span className="text-tech-muted">–</span>
                        <input type="time" value={r[1]} onChange={(e) => setRanges(ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))}
                          className="bg-transparent text-tech-text text-xs" />
                        <button onClick={() => setRanges(ranges.filter((_, j) => j !== i))} className="text-tech-muted hover:text-red-400" aria-label="Quitar tramo">
                          <Icons.X size={12} />
                        </button>
                      </span>
                    ))}
                    {ranges.length < 3 && (
                      <button onClick={() => setRanges([...ranges, ranges.length ? ['16:00', '20:00'] : ['10:00', '14:00']])}
                        className="text-[10px] font-mono uppercase text-tech-yellow hover:underline">
                        + Tramo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => saveSettings(settings)}
              disabled={savingSettings}
              className="bg-tech-yellow text-black text-xs font-bold font-mono uppercase px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {savingSettings ? 'Guardando…' : 'Guardar horario'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 min-h-[60vh]">
        {/* Lista */}
        <div className={`bg-tech-card border border-tech-border rounded-xl overflow-hidden flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
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
                  <span className="text-[10px] text-tech-muted">{timeAgo(c.updated_at)}</span>
                </div>
                {c.last_message && <p className="text-xs text-tech-muted truncate mt-1">{c.last_message}</p>}
              </button>
            ))}
          </div>
        </div>

        {/* Conversación */}
        <div className={`bg-tech-card border border-tech-border rounded-xl overflow-hidden flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
          {!selectedId && (
            <div className="flex-1 flex items-center justify-center text-sm text-tech-muted p-8 text-center">
              Elige una conversación para responder.
            </div>
          )}
          {selectedId && (
            <>
              <div className="px-4 py-3 border-b border-tech-border flex items-start gap-3">
                <button onClick={() => setSelectedId(null)} className="md:hidden text-tech-muted mt-0.5" aria-label="Volver">
                  <Icons.ArrowLeft size={18} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-tech-text truncate">{detail?.customer?.name || '…'}</p>
                    {detail && statusChip(detail.status)}
                    {detail?.customerOnline && detail.status !== 'closed' && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />en el chat</span>
                    )}
                  </div>
                  {detail?.customer?.email && (
                    <a href={`mailto:${detail.customer.email}`} className="text-[11px] text-tech-muted hover:text-tech-yellow">{detail.customer.email}</a>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-[10px] text-tech-muted">
                    {detail?.garage?.length ? <span>🏍️ {detail.garage.map((g) => `${g.brand} ${g.model}${g.year ? ` (${g.year})` : ''}`).join(', ')}</span> : null}
                    {detail?.orders?.length ? (
                      <span>📦 {detail.orders.map((o) => `#${o.id} ${formatPrice(Number(o.total))} (${o.status})`).join(' · ')}</span>
                    ) : detail ? <span>Sin pedidos</span> : null}
                  </div>
                </div>
                {detail && detail.status !== 'closed' && (
                  <button onClick={closeConversation} className="text-[10px] font-mono uppercase text-tech-muted hover:text-red-400 border border-tech-border rounded-lg px-2 py-1.5">
                    Cerrar
                  </button>
                )}
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[55vh] md:max-h-none">
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
                        {m.content}
                      </div>
                    </div>
                  )
                ))}
              </div>

              {detail && detail.status !== 'closed' ? (
                <div className="p-3 border-t border-tech-border space-y-2">
                  {detail.status === 'waiting' && greeting && (
                    <button onClick={() => send(greeting)} disabled={sending}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-tech-border text-tech-muted hover:text-tech-yellow hover:border-tech-yellow">
                      {greeting}
                    </button>
                  )}
                  <div className="flex gap-2">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(reply); } }}
                      placeholder="Escribe tu respuesta… (Intro para enviar, Mayús+Intro para salto de línea)"
                      rows={2}
                      className="flex-1 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text resize-none focus:outline-none focus:border-tech-yellow"
                    />
                    <button onClick={() => send(reply)} disabled={sending || !reply.trim()}
                      className="bg-tech-yellow text-black rounded-lg px-4 font-bold text-xs font-mono uppercase disabled:opacity-50">
                      {sending ? '…' : 'Enviar'}
                    </button>
                  </div>
                  {detail && !detail.customerOnline && (
                    <p className="text-[10px] text-tech-muted">El cliente no tiene el chat abierto: le avisaremos por email de tu respuesta.</p>
                  )}
                </div>
              ) : detail ? (
                <p className="p-3 border-t border-tech-border text-xs text-tech-muted text-center">Conversación cerrada.</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatTab;
