import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

/**
 * Respuestas rápidas del chat: las del equipo (las crea el administrador) y las
 * propias de cada asesor. Variables: {cliente}, {moto}, {asesor}.
 */

export interface QuickReply {
  id: number;
  title: string;
  body: string;
  global: boolean;
  editable: boolean;
}

export function useQuickReplies(adminToken: string) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const load = () => fetch('/api/admin/quick-replies', { headers: { Authorization: `Bearer ${adminToken}` } })
    .then((r) => (r.ok ? r.json() : { replies: [] }))
    .then((d) => setReplies(d.replies || []))
    .catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);
  return { replies, reload: load };
}

/** Sustituye las variables de una respuesta rápida. */
export function fillReply(body: string, vars: { cliente?: string; moto?: string; asesor?: string }) {
  return body
    .replace(/\{cliente\}/g, vars.cliente || '')
    .replace(/\{moto\}/g, vars.moto || 'tu moto')
    .replace(/\{asesor\}/g, vars.asesor || '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

interface PickerProps {
  replies: QuickReply[];
  onPick: (reply: QuickReply) => void;
  onClose: () => void;
}

/** Lista para elegir una respuesta (se inserta en la caja de texto, no se envía sola). */
export const QuickReplyPicker: React.FC<PickerProps> = ({ replies, onPick, onClose }) => {
  const [q, setQ] = useState('');
  const list = replies.filter((r) => !q || `${r.title} ${r.body}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="bg-tech-carbon border border-tech-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-mono uppercase text-tech-muted flex-1">Respuestas rápidas</p>
        <button onClick={onClose} className="text-tech-muted hover:text-tech-text"><Icons.X size={14} /></button>
      </div>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
        className="w-full bg-tech-card border border-tech-border rounded-lg px-3 py-1.5 text-sm text-tech-text" />
      <div className="max-h-56 overflow-y-auto space-y-1">
        {list.length === 0 && <p className="text-[11px] text-tech-muted">Sin respuestas. Créalas en Ajustes.</p>}
        {list.map((r) => (
          <button key={r.id} onClick={() => onPick(r)} className="w-full text-left p-2 rounded-lg border border-tech-border hover:border-tech-yellow">
            <span className="flex items-center gap-1.5 text-xs font-bold text-tech-text">
              {r.title}
              {r.global && <span className="text-[8px] font-mono uppercase text-tech-yellow border border-tech-yellow/40 rounded px-1">equipo</span>}
            </span>
            <span className="block text-[11px] text-tech-muted line-clamp-2">{r.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface ManagerProps {
  adminToken: string;
  isAdmin: boolean;
  replies: QuickReply[];
  reload: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

/** Gestión en Ajustes: crear, editar y borrar respuestas. */
export const QuickRepliesManager: React.FC<ManagerProps> = ({ adminToken, isAdmin, replies, reload, showToast }) => {
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [global, setGlobal] = useState(false);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const startEdit = (r: QuickReply | null) => {
    setEditing(r);
    setTitle(r?.title || '');
    setBody(r?.body || '');
    setGlobal(r ? r.global : false);
  };

  const save = async () => {
    const res = await fetch(editing ? `/api/admin/quick-replies/${editing.id}` : '/api/admin/quick-replies', {
      method: editing ? 'PUT' : 'POST', headers, body: JSON.stringify({ title, body, global }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { showToast(d.error || 'No se pudo guardar', 'error'); return; }
    showToast('Respuesta guardada');
    startEdit(null); setTitle(''); setBody('');
    reload();
  };

  const remove = async (r: QuickReply) => {
    if (!window.confirm(`¿Borrar «${r.title}»?`)) return;
    await fetch(`/api/admin/quick-replies/${r.id}`, { method: 'DELETE', headers });
    reload();
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-tech-muted flex items-center gap-1.5"><Icons.Zap size={14} /> Respuestas rápidas · variables: {'{cliente}'}, {'{moto}'}, {'{asesor}'}</p>
      <ul className="space-y-1">
        {replies.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-xs bg-tech-carbon border border-tech-border rounded-lg p-2">
            <span className="flex-1 min-w-0">
              <span className="font-bold text-tech-text">{r.title}</span>
              {r.global && <span className="ml-1.5 text-[8px] font-mono uppercase text-tech-yellow">equipo</span>}
              <span className="block text-tech-muted line-clamp-2">{r.body}</span>
            </span>
            {r.editable && (
              <span className="flex gap-1.5 shrink-0">
                <button onClick={() => startEdit(r)} className="text-tech-muted hover:text-tech-yellow" aria-label="Editar"><Icons.Pencil size={13} /></button>
                <button onClick={() => remove(r)} className="text-tech-muted hover:text-red-400" aria-label="Borrar"><Icons.Trash2 size={13} /></button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="bg-tech-carbon border border-tech-border rounded-lg p-2 space-y-2">
        <p className="text-[10px] font-mono uppercase text-tech-muted">{editing ? `Editar «${editing.title}»` : 'Nueva respuesta'}</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (p. ej. Plazo de envío)" maxLength={60}
          className="w-full bg-tech-card border border-tech-border rounded-lg px-3 py-1.5 text-sm text-tech-text" />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Texto de la respuesta"
          className="w-full bg-tech-card border border-tech-border rounded-lg px-3 py-1.5 text-sm text-tech-text resize-none" />
        <div className="flex items-center gap-3">
          {isAdmin && !editing && (
            <label className="text-[11px] text-tech-muted flex items-center gap-1.5">
              <input type="checkbox" checked={global} onChange={(e) => setGlobal(e.target.checked)} /> Para todo el equipo
            </label>
          )}
          <span className="flex-1" />
          {editing && <button onClick={() => startEdit(null)} className="text-[10px] font-mono uppercase text-tech-muted">Cancelar</button>}
          <button onClick={save} disabled={!title.trim() || !body.trim()}
            className="bg-tech-yellow text-black text-[10px] font-bold font-mono uppercase px-3 py-1.5 rounded-lg disabled:opacity-40">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
