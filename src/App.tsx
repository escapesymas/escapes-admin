import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { ToastProvider } from './components/ToastContext';
import { AcceptInvitation } from './components/AcceptInvitation';
import { MfaGate } from './components/security/MfaGate';
import { mfaStatus, MfaMethods } from './components/security/mfaApi';

// El mismo panel sirve a los asesores en asesores.escapesymas.com (solo el chat).
const ADVISORS_HOST = typeof window !== 'undefined' && window.location.hostname.startsWith('asesores.');
// Enlace de invitación de asesor: /invitacion/<token> (o ?invitacion=<token>, enlaces antiguos).
const INVITATION = typeof window !== 'undefined'
  ? (window.location.pathname.match(/^\/invitacion\/([a-f0-9]{64})\/?$/)?.[1] || new URLSearchParams(window.location.search).get('invitacion'))
  : null;
if (ADVISORS_HOST) {
  document.title = 'Escapes y Más · Asesores';
  // Al añadirla a la pantalla de inicio, la app se llama «Asesores E&M».
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-asesores.json');
  let appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!appTitle) { appTitle = document.createElement('meta'); appTitle.setAttribute('name', 'apple-mobile-web-app-title'); document.head.appendChild(appTitle); }
  appTitle.setAttribute('content', 'Asesores E&M');
}
import { Shield, Key, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitationDone, setInvitationDone] = useState(false);
  // Segundo paso pendiente (Face ID / Authenticator): la sesión aún no da acceso al panel.
  const [gate, setGate] = useState<{ base: any; setupRequired: boolean; methods: MfaMethods } | null>(null);

  /** Abre el panel solo si la sesión ya tiene hecho el segundo paso; si no, lo pide. */
  const enter = async (sess: any) => {
    try {
      const st = await mfaStatus(sess.token);
      if (st.pending) { setGate({ base: sess, setupRequired: st.setupRequired, methods: st.methods }); return; }
      localStorage.setItem('escapesymas_admin_session', JSON.stringify(sess));
      setSession(sess);
    } catch (e: any) {
      localStorage.removeItem('escapesymas_admin_session');
      setSession(null);
      if (e?.status !== 401 && e?.status !== 403) setError('No se pudo comprobar la sesión. Vuelve a entrar.');
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('escapesymas_admin_session');
    let parsed: any = null;
    try { parsed = saved ? JSON.parse(saved) : null; } catch { localStorage.removeItem('escapesymas_admin_session'); }
    if (!parsed?.token) { setLoading(false); return; }
    enter(parsed).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth?action=login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      const role = data.user?.role || '';
      if (role !== 'admin' && role !== 'asesor') {
        throw new Error(ADVISORS_HOST ? 'Esta cuenta no es de asesor. Pide una invitación al administrador.' : 'Esta cuenta no tiene acceso al panel.');
      }
      const safeSession = {
        token: data.token || data.jwt || '',
        user_id: data.user_id || data.user?.id || data.wpId || '',
        user_email: data.user_email || data.user?.email || '',
        user: data.user || null,
        role,
      };

      if (data.mfa?.required) {
        setGate({ base: safeSession, setupRequired: !!data.mfa.setupRequired, methods: data.mfa.methods });
        return;
      }
      await enter(safeSession);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el VPS');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('escapesymas_admin_session');
    setSession(null);
    setGate(null);
  };

  if (loading) {
    return (
      <div className="h-screen bg-tech-carbon flex flex-col items-center justify-center text-tech-text font-sans">
        <Loader2 className="w-12 h-12 text-tech-yellow animate-spin mb-4" />
        <span className="text-tech-muted text-xs font-bold uppercase tracking-widest italic animate-pulse">Iniciando Consola de Seguridad...</span>
      </div>
    );
  }

  // La invitación manda aunque haya una sesión abierta en este navegador (al
  // aceptarla se sustituye): antes se ignoraba y se veía el panel sin más.
  if (INVITATION && !invitationDone) {
    return (
      <AcceptInvitation
        token={INVITATION}
        currentEmail={session?.user_email || session?.user?.email || null}
        onDone={(sess) => {
          window.history.replaceState({}, '', '/');
          setInvitationDone(true);
          enter(sess);
        }}
        onSkip={session ? () => { window.history.replaceState({}, '', '/'); setInvitationDone(true); } : undefined}
      />
    );
  }

  if (gate) {
    return (
      <MfaGate
        token={gate.base.token}
        email={gate.base.user_email || gate.base.user?.email || ''}
        setupRequired={gate.setupRequired}
        methods={gate.methods}
        onComplete={(fullToken) => {
          const sess = { ...gate.base, token: fullToken };
          localStorage.setItem('escapesymas_admin_session', JSON.stringify(sess));
          setGate(null);
          setSession(sess);
        }}
        onCancel={handleLogout}
      />
    );
  }

  if (session) {
    return (
      <ToastProvider>
        <AdminDashboard session={session} onLogout={handleLogout} />
      </ToastProvider>
    );
  }

  return (
    <div className="min-h-screen bg-tech-carbon flex items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Decorative Grid and Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-tech-yellow/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="bg-tech-card/70 backdrop-blur-xl border border-tech-border/80 rounded-2xl p-8 shadow-2xl shadow-black/90">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-tech-yellow/10 border border-tech-yellow/30 rounded-2xl flex items-center justify-center mb-4 text-tech-yellow shadow-lg shadow-yellow-500/10">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-tech-text">
              Escapes <span className="text-tech-yellow">{ADVISORS_HOST ? 'Asesores' : 'Admin'}</span>
            </h1>
            <p className="text-tech-muted text-xs mt-1 uppercase tracking-widest font-bold">{ADVISORS_HOST ? 'Panel de asesores' : 'Consola de Control del VPS'}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-3 text-red-400 text-xs animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <div>
                <p className="font-bold uppercase tracking-wider mb-0.5">Acceso Denegado</p>
                <p className="text-[#cbd5e1] leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-tech-muted mb-2">{ADVISORS_HOST ? 'Email' : 'Email Administrador'}</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ADVISORS_HOST ? 'tu@email.com' : 'admin@escapesymas.com'}
                  required
                  className="w-full bg-[#1a1b1e]/60 border border-tech-border focus:border-tech-yellow/50 rounded-xl px-4 py-3 text-sm text-tech-text placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-tech-yellow/30 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-tech-muted mb-2">Contraseña</label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-[#1a1b1e]/60 border border-tech-border focus:border-tech-yellow/50 rounded-xl px-4 py-3 text-sm text-tech-text placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-tech-yellow/30 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-tech-yellow hover:bg-yellow-500 disabled:bg-tech-yellow/50 text-tech-text font-black uppercase italic tracking-widest text-xs py-4 rounded-xl shadow-lg shadow-yellow-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-8"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  <span>Entrar al Panel</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
