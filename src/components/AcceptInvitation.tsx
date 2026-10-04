import React, { useEffect, useState } from 'react';
import { UserPlus, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Alta de un asesor desde el enlace de la invitación (?invitacion=token).
 * Sin cuenta: crea su contraseña. Con cuenta en la tienda: entra con la suya.
 */
interface AcceptInvitationProps {
  token: string;
  onDone: (session: any) => void;
  /** Email de la sesión ya abierta en este navegador (se sustituye al aceptar). */
  currentEmail?: string | null;
  /** Volver al panel sin aceptar (si hay sesión abierta). */
  onSkip?: () => void;
}

export const AcceptInvitation: React.FC<AcceptInvitationProps> = ({ token, onDone, currentEmail, onSkip }) => {
  const [info, setInfo] = useState<{ email: string; name: string | null; existingAccount: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/agent-invitations/${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Invitación no válida');
        setInfo(d);
        setFirstName(d.name || '');
      })
      .catch((e) => setError(e.message));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (!info.existingAccount && password !== password2) { setError('Las contraseñas no coinciden'); return; }
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/agent-invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, firstName, lastName }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo completar el alta');
      onDone({ token: d.token, user_id: d.user.id, user_email: d.user.email, user: d.user, role: d.user.role });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const input = 'w-full bg-[#1a1b1e]/60 border border-tech-border focus:border-tech-yellow/50 rounded-xl px-4 py-3 text-sm text-tech-text focus:outline-none';

  return (
    <div className="min-h-screen bg-tech-carbon flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md bg-tech-card/70 border border-tech-border/80 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-tech-yellow/10 border border-tech-yellow/30 rounded-2xl flex items-center justify-center mb-3 text-tech-yellow">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black italic uppercase tracking-tighter text-tech-text">Escapes <span className="text-tech-yellow">Asesores</span></h1>
          <p className="text-tech-muted text-xs mt-1">Alta en el panel de asesores</p>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" /> {error}
          </div>
        )}

        {!info && !error && <p className="text-center text-tech-muted text-sm"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Comprobando la invitación…</p>}

        {info && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-tech-text">Invitación para <b>{info.email}</b></p>
            {currentEmail && currentEmail.toLowerCase() !== info.email.toLowerCase() && (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
                En este navegador tienes abierta la sesión de {currentEmail}. Al aceptar, se cerrará y entrarás como {info.email}.
              </p>
            )}
            {info.existingAccount ? (
              <>
                <p className="text-xs text-tech-muted">Ya tienes cuenta en la tienda: escribe tu contraseña para activar el acceso de asesor.</p>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" className={input} autoFocus />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nombre" className={input} />
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellidos" className={input} />
                </div>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña (mín. 8 caracteres)" className={input} />
                <input type="password" required minLength={8} value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Repite la contraseña" className={input} />
              </>
            )}
            <button type="submit" disabled={sending}
              className="w-full bg-tech-yellow text-black font-black uppercase text-xs tracking-widest py-3.5 rounded-xl disabled:opacity-50">
              {sending ? 'Activando…' : info.existingAccount ? 'Activar acceso de asesor' : 'Crear mi acceso'}
            </button>
          </form>
        )}
        {onSkip && (
          <button type="button" onClick={onSkip} className="mt-4 w-full text-[11px] text-tech-muted hover:text-tech-text underline">
            Volver al panel sin aceptar
          </button>
        )}
      </div>
    </div>
  );
};
