import React, { useState, useEffect } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { ToastProvider } from './components/ToastContext';
import { Shield, Key, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('escapesymas_admin_session');
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem('escapesymas_admin_session');
      }
    }
    setLoading(false);
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

      const safeSession = {
        token: data.token || data.jwt || '',
        user_id: data.user_id || data.user?.id || data.wpId || '',
        user_email: data.user_email || data.user?.email || '',
        user: data.user || null,
      };

      localStorage.setItem('escapesymas_admin_session', JSON.stringify(safeSession));
      setSession(safeSession);
    } catch (err: any) {
      setError(err.message || 'Error de conexión con el VPS');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('escapesymas_admin_session');
    setSession(null);
  };

  if (loading) {
    return (
      <div className="h-screen bg-tech-carbon flex flex-col items-center justify-center text-tech-text font-sans">
        <Loader2 className="w-12 h-12 text-tech-yellow animate-spin mb-4" />
        <span className="text-tech-muted text-xs font-bold uppercase tracking-widest italic animate-pulse">Iniciando Consola de Seguridad...</span>
      </div>
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
              Escapes <span className="text-tech-yellow">Admin</span>
            </h1>
            <p className="text-tech-muted text-xs mt-1 uppercase tracking-widest font-bold">Consola de Control del VPS</p>
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
              <label className="block text-[10px] uppercase font-black tracking-widest text-tech-muted mb-2">Email Administrador</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@escapesymas.com"
                  required
                  className="w-full bg-[#1a1b1e]/60 border border-tech-border focus:border-tech-yellow/50 rounded-xl px-4 py-3 text-sm text-tech-text placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-tech-yellow/30 transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase font-black tracking-widest text-tech-muted mb-2">Contraseña VPS</label>
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
