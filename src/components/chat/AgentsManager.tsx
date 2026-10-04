import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';

/**
 * Asesores del chat (solo administradores): invitar por email, ver quién está
 * conectado, quitar el rol y gestionar las invitaciones pendientes. Los
 * asesores entran en asesores.escapesymas.com.
 */

interface Agent {
  id: number;
  email: string;
  role: 'admin' | 'asesor';
  full_name: string | null;
  chat_name: string;
  online: boolean;
  status_at: string | null;
  open_chats: number;
}

interface Invitation {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
  expires_at: string;
}

interface AgentsManagerProps {
  adminToken: string;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

export const AgentsManager: React.FC<AgentsManagerProps> = ({ adminToken, showToast }) => {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const load = () => fetch('/api/admin/agents', { headers })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => { if (d) { setAgents(d.agents || []); setInvitations(d.invitations || []); } })
    .catch(() => setAgents([]));

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const r = await fetch('/api/admin/agents/invite', { method: 'POST', headers, body: JSON.stringify({ email, name }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      showToast(d.emailStatus === 'sent' ? `Invitación enviada a ${email}` : `Invitación creada; el email se reintentará (${d.emailStatus})`);
      setEmail(''); setName('');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo invitar', 'error');
    } finally {
      setSending(false);
    }
  };

  const revoke = async (a: Agent) => {
    if (!window.confirm(`¿Quitar el acceso de asesor a ${a.chat_name}? Sus conversaciones abiertas volverán a la cola.`)) return;
    const r = await fetch(`/api/admin/agents/${a.id}/revoke`, { method: 'POST', headers });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { showToast(`${a.chat_name} ya no es asesor${d.reassigned ? ` (${d.reassigned} conversaciones a la cola)` : ''}`); load(); }
    else showToast(d.error || 'No se pudo quitar el rol', 'error');
  };

  const cancel = async (inv: Invitation) => {
    await fetch(`/api/admin/agents/invitations/${inv.id}/cancel`, { method: 'POST', headers });
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={invite} className="bg-tech-card border border-tech-border rounded-xl p-4 space-y-3">
        <p className="font-bold text-tech-text text-sm flex items-center gap-2"><Icons.UserPlus size={16} className="text-tech-yellow" /> Invitar a un asesor</p>
        <p className="text-[11px] text-tech-muted">Le llega un email con un enlace (válido 7 días) para crear su acceso en asesores.escapesymas.com. Si ya tiene cuenta en la tienda, entra con su contraseña.</p>
        <div className="flex flex-wrap gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@ejemplo.com"
            className="flex-1 min-w-[200px] bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" maxLength={80}
            className="w-48 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text" />
          <button type="submit" disabled={sending} className="bg-tech-yellow text-black font-bold font-mono uppercase text-xs px-4 rounded-lg disabled:opacity-50">
            {sending ? 'Enviando…' : 'Invitar'}
          </button>
        </div>
      </form>

      <div className="bg-tech-card border border-tech-border rounded-xl overflow-x-auto">
        <p className="px-4 py-3 border-b border-tech-border text-[10px] font-mono uppercase text-tech-muted">Equipo del chat</p>
        <table className="w-full text-xs">
          <tbody>
            {agents === null && <tr><td className="p-4 text-tech-muted">Cargando…</td></tr>}
            {agents?.map((a) => (
              <tr key={a.id} className="border-b border-tech-border last:border-0">
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${a.online ? 'bg-emerald-500' : 'bg-slate-600'}`} title={a.online ? 'Conectado' : 'Desconectado'} />
                    <span className="font-bold text-tech-text">{a.chat_name}</span>
                    {a.role === 'admin' && <span className="text-[9px] font-mono uppercase text-tech-yellow border border-tech-yellow/40 rounded px-1">admin</span>}
                  </span>
                  <span className="block text-[10px] text-tech-muted ml-4">{a.email}</span>
                </td>
                <td className="p-3 text-tech-muted">{a.online ? 'Conectado' : 'Desconectado'}</td>
                <td className="p-3 text-tech-muted">{a.open_chats} chat{a.open_chats === 1 ? '' : 's'} abierto{a.open_chats === 1 ? '' : 's'}</td>
                <td className="p-3 text-right">
                  {a.role === 'asesor' && (
                    <button onClick={() => revoke(a)} className="text-[10px] font-mono uppercase text-tech-muted hover:text-red-400">Quitar acceso</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invitations.length > 0 && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-4">
          <p className="text-[10px] font-mono uppercase text-tech-muted mb-2">Invitaciones pendientes</p>
          <ul className="divide-y divide-tech-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="py-2 flex items-center gap-3 text-xs">
                <Icons.Mail size={14} className="text-tech-muted" />
                <span className="text-tech-text">{inv.name ? `${inv.name} · ` : ''}{inv.email}</span>
                <span className="text-tech-muted">enviada el {fmt(inv.created_at)} · caduca el {fmt(inv.expires_at)}</span>
                <button onClick={() => cancel(inv)} className="ml-auto text-[10px] font-mono uppercase text-tech-muted hover:text-red-400">Cancelar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
