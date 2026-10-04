import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { formatPrice } from '../../utils/format';

/** Ficha del cliente: conversaciones anteriores, pedidos y notas internas (el cliente no las ve). */

interface Profile {
  user: { id: number; email: string; first_name: string | null; last_name: string | null; created_at: string } | null;
  conversations: { id: number; created_at: string; status: string; agent_name: string | null; rating: number | null; offline: boolean; first_message: string | null }[];
  orders: { id: number; number: string; status: string; total: number; created_at: string; sales_channel: string | null }[];
  notes: { id: number; author_user_id: number | null; author_name: string | null; body: string; source?: string; created_at: string }[];
  spentCents: number;
}

interface CustomerProfileProps {
  adminToken: string;
  conversationId: number;
  onClose: () => void;
  onOpenConversation: (id: number) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export const CustomerProfile: React.FC<CustomerProfileProps> = ({ adminToken, conversationId, onClose, onOpenConversation, showToast }) => {
  const [data, setData] = useState<Profile | null>(null);
  const [note, setNote] = useState('');
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const load = () => fetch(`/api/admin/chats/${conversationId}/profile`, { headers })
    .then((r) => (r.ok ? r.json() : null)).then((d) => d && setData(d)).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [conversationId]);

  const addNote = async () => {
    const res = await fetch(`/api/admin/chats/${conversationId}/notes`, { method: 'POST', headers, body: JSON.stringify({ body: note }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error || 'No se pudo guardar la nota', 'error'); return; }
    setNote('');
    load();
  };

  const removeNote = async (id: number) => {
    const res = await fetch(`/api/admin/chats/${conversationId}/notes/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'No se pudo borrar', 'error'); return; }
    load();
  };

  const u = data?.user;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-tech-card border-l border-tech-border flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-tech-border flex items-center gap-2">
          <Icons.UserRound size={18} className="text-tech-yellow" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-tech-text text-sm truncate">{u ? ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.email) : 'Ficha del cliente'}</p>
            {u && <p className="text-[10px] text-tech-muted">{u.email} · cliente desde {fmt(u.created_at)}</p>}
          </div>
          <button onClick={onClose} className="text-tech-muted hover:text-tech-text" aria-label="Cerrar"><Icons.X size={18} /></button>
        </div>
        {!data && <p className="p-4 text-xs text-tech-muted">Cargando…</p>}
        {data && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
            <section className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-tech-carbon border border-tech-border rounded-lg p-2"><p className="text-lg font-black text-tech-text">{data.orders.length}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Pedidos</p></div>
              <div className="bg-tech-carbon border border-tech-border rounded-lg p-2"><p className="text-lg font-black text-emerald-400">{formatPrice(data.spentCents)}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Gastado</p></div>
              <div className="bg-tech-carbon border border-tech-border rounded-lg p-2"><p className="text-lg font-black text-tech-text">{data.conversations.length}</p><p className="text-[9px] uppercase font-mono text-tech-muted">Chats previos</p></div>
            </section>

            <section className="space-y-2">
              <h4 className="text-[10px] font-mono uppercase text-tech-muted">Notas internas (el cliente no las ve)</h4>
              <p className="text-[10px] text-tech-muted flex items-center gap-1"><Icons.Sparkles size={11} className="text-sky-400" /> La IA apunta notas solas al cerrarse cada chat. Bórralas si no son útiles.</p>
              <div className="flex gap-2">
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: prefiere Brembo, llamar si hay stock…" maxLength={2000}
                  onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) addNote(); }}
                  className="flex-1 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
                <button onClick={addNote} disabled={!note.trim()} className="bg-tech-yellow text-black text-[10px] font-bold font-mono uppercase px-3 rounded-lg disabled:opacity-40">Añadir</button>
              </div>
              {data.notes.length === 0 && <p className="text-tech-muted">Sin notas.</p>}
              <ul className="space-y-1.5">
                {data.notes.map((n) => (
                  <li key={n.id} className={`bg-tech-carbon border rounded-lg p-2 flex gap-2 ${n.source === 'ia' ? 'border-sky-500/30' : 'border-tech-border'}`}>
                    <span className="flex-1 whitespace-pre-wrap text-tech-text">{n.body}
                      <span className="flex items-center gap-1 text-[10px] text-tech-muted mt-0.5">
                        {n.source === 'ia'
                          ? <><Icons.Sparkles size={10} className="text-sky-400" /><span className="text-sky-300">IA</span></>
                          : (n.author_name || 'Asesor')} · {fmt(n.created_at)}
                      </span>
                    </span>
                    <button onClick={() => removeNote(n.id)} className="text-tech-muted hover:text-red-400 self-start" aria-label="Borrar nota"><Icons.Trash2 size={13} /></button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-[10px] font-mono uppercase text-tech-muted">Conversaciones anteriores</h4>
              {data.conversations.length === 0 && <p className="text-tech-muted">Es su primera conversación.</p>}
              {data.conversations.map((c) => (
                <button key={c.id} onClick={() => onOpenConversation(c.id)} className="w-full text-left bg-tech-carbon border border-tech-border rounded-lg p-2 hover:border-tech-yellow">
                  <span className="flex items-center gap-2 text-tech-text">
                    {fmt(c.created_at)}{c.agent_name ? ` · ${c.agent_name}` : ''}
                    {c.offline && <span className="text-[9px] font-mono uppercase text-sky-400">mensaje</span>}
                    {c.rating != null && <span className="ml-auto text-tech-yellow">{'★'.repeat(c.rating)}<span className="text-tech-muted">{'★'.repeat(5 - c.rating)}</span></span>}
                  </span>
                  {c.first_message && <span className="block text-tech-muted line-clamp-1">{c.first_message}</span>}
                </button>
              ))}
            </section>

            <section className="space-y-1.5">
              <h4 className="text-[10px] font-mono uppercase text-tech-muted">Pedidos</h4>
              {data.orders.length === 0 && <p className="text-tech-muted">Sin pedidos.</p>}
              {data.orders.map((o) => (
                <div key={o.id} className="flex items-center gap-2 bg-tech-carbon border border-tech-border rounded-lg p-2">
                  <span className="font-mono text-tech-text">{o.number}</span>
                  <span className="text-tech-muted">{fmt(o.created_at)} · {o.status}{o.sales_channel === 'chat' ? ' · chat' : ''}</span>
                  <span className="ml-auto font-bold text-tech-text">{formatPrice(Number(o.total))}</span>
                </div>
              ))}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
