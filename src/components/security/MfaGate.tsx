import React, { useEffect, useState } from 'react';
import { ShieldCheck, ScanFace, Smartphone, KeyRound, Loader2, AlertCircle, Copy, Check, LogOut } from 'lucide-react';
import {
  MfaMethods, MfaResult, passkeysSupported, registerPasskey, verifyPasskey,
  totpSetup, totpEnable, totpVerify, recoveryVerify, friendlyWebAuthnError,
} from './mfaApi';

/**
 * Segundo paso al entrar al panel (obligatorio para administradores y asesores).
 * - Si la cuenta aún no tiene ningún método: configurarlo (Face ID / huella o
 *   Google Authenticator) y guardar los códigos de recuperación.
 * - Si ya tiene: verificar con uno de ellos o con un código de recuperación.
 */
interface Props {
  token: string;                 // token pendiente (login con contraseña)
  email: string;
  setupRequired: boolean;
  methods: MfaMethods;
  onComplete: (fullToken: string) => void;
  onCancel: () => void;
}

const card = 'bg-tech-card/70 backdrop-blur-xl border border-tech-border/80 rounded-2xl p-8 shadow-2xl shadow-black/90';
const primary = 'w-full bg-tech-yellow hover:bg-yellow-500 disabled:opacity-50 text-tech-text font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-2';
const secondary = 'w-full bg-tech-carbon hover:bg-tech-border/40 border border-tech-border text-tech-text font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50';
const input = 'w-full bg-[#1a1b1e]/60 border border-tech-border focus:border-tech-yellow/50 rounded-xl px-4 py-3 text-center text-lg tracking-[0.4em] text-tech-text font-mono focus:outline-none';

export const MfaGate: React.FC<Props> = ({ token, email, setupRequired, methods, onComplete, onCancel }) => {
  const [mode, setMode] = useState<'choose' | 'totp-setup' | 'totp' | 'recovery'>(
    setupRequired ? 'choose' : methods.passkeys > 0 ? 'choose' : 'totp');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<{ token: string; list: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const supported = passkeysSupported();

  const finish = (r: MfaResult) => {
    // Primera configuración: antes de entrar, enseñar los códigos de recuperación.
    if (r.recoveryCodes?.length) setCodes({ token: r.token, list: r.recoveryCodes });
    else onComplete(r.token);
  };

  const run = async (fn: () => Promise<MfaResult>) => {
    setBusy(true); setError(null);
    try { finish(await fn()); } catch (e: any) { setError(friendlyWebAuthnError(e)); } finally { setBusy(false); }
  };

  useEffect(() => {
    if (mode !== 'totp-setup' || qr) return;
    setBusy(true);
    totpSetup(token).then(setQr).catch((e) => setError(e.message)).finally(() => setBusy(false));
  }, [mode, qr, token]);

  const header = (title: string, sub: string) => (
    <div className="flex flex-col items-center mb-6 text-center">
      <div className="w-16 h-16 bg-tech-yellow/10 border border-tech-yellow/30 rounded-2xl flex items-center justify-center mb-4 text-tech-yellow">
        <ShieldCheck className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-black uppercase tracking-tight text-tech-text">{title}</h1>
      <p className="text-tech-muted text-xs mt-2 leading-relaxed">{sub}</p>
    </div>
  );

  let body: React.ReactNode;
  if (codes) {
    body = (
      <>
        {header('Guarda tus códigos de recuperación', 'Si pierdes el móvil, cada código te deja entrar una vez. Guárdalos en un lugar seguro (por ejemplo, tu gestor de contraseñas). No se vuelven a mostrar.')}
        <div className="grid grid-cols-2 gap-2 bg-tech-carbon border border-tech-border rounded-xl p-4 font-mono text-sm text-tech-text text-center">
          {codes.list.map((c) => <span key={c}>{c}</span>)}
        </div>
        <button onClick={() => { navigator.clipboard?.writeText(codes.list.join('\n')); setCopied(true); }} className={`${secondary} mt-3`}>
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiados' : 'Copiar códigos'}
        </button>
        <button onClick={() => onComplete(codes.token)} className={`${primary} mt-4`}>Ya los he guardado · Entrar</button>
      </>
    );
  } else if (mode === 'totp-setup') {
    body = (
      <>
        {header('Google Authenticator', 'Escanea el código con Google Authenticator (o Microsoft Authenticator, 1Password…) y escribe el número de 6 cifras que aparece.')}
        {qr ? (
          <div className="flex flex-col items-center gap-2 mb-4">
            <img src={qr.qr} alt="Código QR" className="w-48 h-48 rounded-lg bg-white p-2" />
            <p className="text-[10px] text-tech-muted text-center">¿No puedes escanear? Clave manual:<br /><span className="font-mono text-tech-text select-all break-all">{qr.secret}</span></p>
          </div>
        ) : <Loader2 className="w-6 h-6 animate-spin text-tech-muted mx-auto mb-4" />}
        <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={input} />
        <button onClick={() => run(() => totpEnable(token, code))} disabled={busy || code.length !== 6} className={`${primary} mt-4`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Activar
        </button>
        <button onClick={() => { setMode('choose'); setError(null); }} className="w-full text-[11px] text-tech-muted mt-3">Volver</button>
      </>
    );
  } else if (mode === 'totp') {
    body = (
      <>
        {header('Verificación en dos pasos', 'Escribe el código de 6 cifras de Google Authenticator.')}
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={input}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) run(() => totpVerify(token, code)); }} />
        <button onClick={() => run(() => totpVerify(token, code))} disabled={busy || code.length !== 6} className={`${primary} mt-4`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Verificar
        </button>
        {methods.passkeys > 0 && <button onClick={() => { setMode('choose'); setError(null); }} className="w-full text-[11px] text-tech-muted mt-3">Usar Face ID / huella</button>}
        <button onClick={() => { setMode('recovery'); setCode(''); setError(null); }} className="w-full text-[11px] text-tech-muted mt-2">Usar un código de recuperación</button>
      </>
    );
  } else if (mode === 'recovery') {
    body = (
      <>
        {header('Código de recuperación', 'Escribe uno de los códigos que guardaste al activar la verificación. Cada código sirve una sola vez.')}
        <input autoFocus value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))} placeholder="XXXX-XXXX" className={input} />
        <button onClick={() => run(() => recoveryVerify(token, code))} disabled={busy || code.replace(/[^A-Z0-9]/g, '').length < 8} className={`${primary} mt-4`}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Entrar
        </button>
        <button onClick={() => { setMode(methods.passkeys > 0 ? 'choose' : 'totp'); setCode(''); setError(null); }} className="w-full text-[11px] text-tech-muted mt-3">Volver</button>
      </>
    );
  } else if (setupRequired) {
    body = (
      <>
        {header('Protege tu cuenta', 'El panel exige verificación en dos pasos. Elige cómo quieres confirmar que eres tú cada vez que entres.')}
        {supported && (
          <button onClick={() => run(() => registerPasskey(token))} disabled={busy} className={primary}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />} Usar Face ID / huella (recomendado)
          </button>
        )}
        <button onClick={() => { setMode('totp-setup'); setError(null); }} disabled={busy} className={`${secondary} mt-3`}>
          <Smartphone className="w-4 h-4" /> Usar Google Authenticator
        </button>
        <p className="text-[10px] text-tech-muted text-center mt-4">Luego podrás añadir el otro método desde «Seguridad» en el panel.</p>
      </>
    );
  } else {
    body = (
      <>
        {header('Verificación en dos pasos', `Confirma que eres tú (${email}).`)}
        <button onClick={() => run(() => verifyPasskey(token))} disabled={busy || !supported} className={primary}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />} Entrar con Face ID / huella
        </button>
        {!supported && <p className="text-[10px] text-amber-400 text-center mt-2">Este navegador no admite llaves de acceso.</p>}
        {methods.totp && (
          <button onClick={() => { setMode('totp'); setError(null); }} className={`${secondary} mt-3`}>
            <Smartphone className="w-4 h-4" /> Usar Google Authenticator
          </button>
        )}
        <button onClick={() => { setMode('recovery'); setCode(''); setError(null); }} className="w-full text-[11px] text-tech-muted mt-3">Usar un código de recuperación</button>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-tech-carbon flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-md">
        <div className={card}>
          {error && (
            <div className="mb-5 p-3 bg-red-950/30 border border-red-800/50 rounded-xl flex items-start gap-2 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" /> {error}
            </div>
          )}
          {body}
          {!codes && (
            <button onClick={onCancel} className="w-full text-[11px] text-tech-muted mt-6 flex items-center justify-center gap-1.5">
              <LogOut className="w-3 h-3" /> Salir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
