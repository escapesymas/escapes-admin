import React, { useCallback, useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

/**
 * Conversaciones de los clientes con el asistente IA de la web (solo
 * administradores): lista con buscador y, al abrir una, todos sus turnos,
 * los productos que se enseñaron y si pasó a un asesor.
 */

interface SessionRow {
  id: number;
  user_id: number;
  turns: number;
  handoff_conversation_id: number | null;
  created_at: string;
  updated_at: string;
  first_question: string | null;
  customer_name: string | null;
  customer_email: string | null;
}

interface Turn { role: 'user' | 'assistant'; content: string; at: string; products?: string[]; outcome?: string; offeredHuman?: boolean }

const OUTCOME: Record<string, string> = {
  out_of_scope: 'Fuera de tema',
  guardrail: 'Bloqueado por seguridad',
  error: 'Error del asistente',
};

const fmt = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const AiChats: React.FC<{ adminToken: string; onOpenConversation: (id: number) => void }> = ({ adminToken, onOpenConversation }) => {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<(SessionRow & { messages: Turn[] }) | null>(null);

  const headers = { Authorization: `Bearer ${adminToken}` };

  const load = useCallback(async (before?: number) => {
    const params = new URLSearchParams();
    if (before) params.set('before', String(before));
    if (search) params.set('q', search);
    const res = await fetch(`/api/admin/ai-chats?${params}`, { headers });
    const d = res.ok ? await res.json() : { sessions: [] };
    setRows((prev) => (before ? [...(prev || []), ...d.sessions] : d.sessions));
    setHasMore(d.sessions.length === 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, search]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const open = async (id: number) => {
    const res = await fetch(`/api/admin/ai-chats/${id}`, { headers });
    if (res.ok) setSelected((await res.json()).session);
  };

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
      <div className="bg-tech-card border border-tech-border rounded-xl overflow-hidden flex flex-col max-h-[75vh]">
        <form onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }} className="p-3 border-b border-tech-border flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente o texto…"
            className="flex-1 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-xs text-tech-text" />
          <button className="px-3 rounded-lg border border-tech-border text-tech-muted hover:text-tech-text"><Icons.Search size={14} /></button>
        </form>
        <div className="overflow-y-auto divide-y divide-tech-border">
          {rows === null && <p className="p-4 text-xs text-tech-muted">Cargando…</p>}
          {rows?.length === 0 && <p className="p-4 text-xs text-tech-muted">{search ? 'Sin resultados.' : 'Todavía no hay conversaciones con la IA guardadas.'}</p>}
          {rows?.map((r) => (
            <button key={r.id} onClick={() => open(r.id)}
              className={`w-full text-left p-3 hover:bg-tech-border/20 ${selected?.id === r.id ? 'bg-tech-border/30' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-tech-text truncate">{r.customer_name || r.customer_email || `Cliente ${r.user_id}`}</span>
                <span className="text-[10px] text-tech-muted shrink-0">{fmt(r.updated_at)}</span>
              </div>
              <p className="text-[11px] text-tech-muted truncate mt-0.5">{r.first_question || '—'}</p>
              <p className="text-[10px] text-tech-muted mt-1 flex items-center gap-2">
                <span>{r.turns} pregunta{r.turns === 1 ? '' : 's'}</span>
                {r.handoff_conversation_id && <span className="text-tech-yellow flex items-center gap-1"><Icons.UserRound size={11} /> pasó a asesor</span>}
              </p>
            </button>
          ))}
          {hasMore && rows && (
            <button onClick={() => load(rows[rows.length - 1].id)} className="w-full p-3 text-xs text-tech-muted hover:text-tech-text">Ver más</button>
          )}
        </div>
      </div>

      <div className="bg-tech-card border border-tech-border rounded-xl overflow-hidden flex flex-col max-h-[75vh]">
        {!selected ? (
          <p className="p-6 text-xs text-tech-muted text-center my-auto">Elige una conversación para leerla.</p>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-tech-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-tech-text truncate">{selected.customer_name || selected.customer_email || `Cliente ${selected.user_id}`}</p>
                <p className="text-[10px] text-tech-muted">{selected.customer_email} · empezó {fmt(selected.created_at)}</p>
              </div>
              {selected.handoff_conversation_id && (
                <button onClick={() => onOpenConversation(selected.handoff_conversation_id!)}
                  className="text-[10px] font-mono uppercase border border-tech-yellow text-tech-yellow rounded px-2 py-1.5 shrink-0">
                  Ver chat con asesor
                </button>
              )}
            </div>
            <div className="overflow-y-auto p-4 space-y-3">
              {selected.messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-tech-yellow text-black rounded-br-sm' : 'bg-tech-carbon border border-tech-border text-tech-text rounded-bl-sm'}`}>
                    {m.role === 'assistant' && <p className="text-[9px] font-mono uppercase text-tech-yellow mb-0.5">Asistente IA</p>}
                    {m.content}
                    {m.products?.length ? <p className="text-[10px] text-tech-muted mt-1.5">Productos mostrados: {m.products.join(', ')}</p> : null}
                    {m.outcome && OUTCOME[m.outcome] && <p className="text-[10px] text-amber-400 mt-1">{OUTCOME[m.outcome]}</p>}
                    {m.offeredHuman && <p className="text-[10px] text-tech-muted mt-1">Ofreció hablar con un asesor</p>}
                    <p className={`text-[9px] mt-1 ${m.role === 'user' ? 'text-black/60' : 'text-tech-muted'}`}>{fmt(m.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
