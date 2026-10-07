import React, { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import {
  MfaStatus, mfaStatus, registerPasskey, deletePasskey, totpSetup, totpEnable, totpDisable,
  recoveryRegenerate, passkeysSupported, friendlyWebAuthnError,
} from './mfaApi';

/** «Seguridad» en el panel: métodos de verificación en dos pasos de la propia cuenta. */
export const AccountSecurity: React.FC<{ adminToken: string }> = ({ adminToken }) => {
  const { showToast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);

  const load = () => mfaStatus(adminToken).then(setStatus).catch(() => setStatus(null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const act = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try { const r = await fn(); if (r?.recoveryCodes) setCodes(r.recoveryCodes); showToast(ok, 'success'); await load(); }
    catch (e: any) { showToast(friendlyWebAuthnError(e), 'error'); }
    finally { setBusy(false); }
  };

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'nunca');
  const box = 'bg-tech-card border border-tech-border rounded-xl p-5 space-y-3';
  const btn = 'bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50';

  if (!status) return <div className="flex justify-center py-16"><Icons.Loader2 className="w-6 h-6 animate-spin text-tech-muted" /></div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div className={box}>
        <p className="text-xs font-black uppercase tracking-wider text-tech-text flex items-center gap-2"><Icons.ScanFace size={15} className="text-tech-yellow" /> Face ID / huella (llaves de acceso)</p>
        <p className="text-[11px] text-tech-muted">Entras confirmando con la cara o la huella del dispositivo. Añade cada dispositivo que uses (móvil, ordenador).</p>
        {status.passkeys.length === 0 && <p className="text-xs text-tech-muted">Ninguna todavía.</p>}
        <ul className="space-y-1.5">
          {status.passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-2 bg-tech-carbon border border-tech-border rounded-lg p-2 text-xs">
              <Icons.KeyRound size={14} className="text-tech-yellow shrink-0" />
              <span className="flex-1 text-tech-text">{p.name || 'Llave de acceso'} <span className="text-tech-muted">· añadida {fmt(p.created_at)} · último uso {fmt(p.last_used_at)}</span></span>
              <button onClick={() => { if (window.confirm('¿Quitar esta llave de acceso?')) act(() => deletePasskey(adminToken, p.id), 'Llave quitada'); }}
                className="text-tech-muted hover:text-red-400" aria-label="Quitar"><Icons.Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
        {passkeysSupported()
          ? <button onClick={() => act(() => registerPasskey(adminToken), 'Llave de acceso añadida')} disabled={busy} className={btn}><Icons.Plus size={13} /> Añadir este dispositivo</button>
          : <p className="text-[11px] text-amber-400">Este navegador no admite llaves de acceso.</p>}
      </div>

      <div className={box}>
        <p className="text-xs font-black uppercase tracking-wider text-tech-text flex items-center gap-2"><Icons.Smartphone size={15} className="text-tech-yellow" /> Google Authenticator</p>
        {status.methods.totp ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400 flex items-center gap-1"><Icons.CheckCircle2 size={13} /> Activado</span>
            <button onClick={() => { if (window.confirm('¿Desactivar Google Authenticator?')) act(() => totpDisable(adminToken), 'Google Authenticator desactivado'); }} disabled={busy} className={btn}>Desactivar</button>
          </div>
        ) : qr ? (
          <div className="space-y-2">
            <img src={qr.qr} alt="Código QR" className="w-44 h-44 rounded-lg bg-white p-2" />
            <p className="text-[10px] text-tech-muted">Clave manual: <span className="font-mono text-tech-text select-all">{qr.secret}</span></p>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="000000"
                className="w-32 bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-tech-text" />
              <button onClick={() => act(async () => { const r = await totpEnable(adminToken, code); setQr(null); setCode(''); return r; }, 'Google Authenticator activado')}
                disabled={busy || code.length !== 6} className={btn}><Icons.Check size={13} /> Activar</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-tech-muted">Alternativa a Face ID: un código de 6 cifras que cambia cada 30 segundos.</p>
            <button onClick={() => act(async () => { setQr(await totpSetup(adminToken)); }, 'Escanea el código QR')} disabled={busy} className={btn}><Icons.QrCode size={13} /> Configurar</button>
          </>
        )}
      </div>

      <div className={box}>
        <p className="text-xs font-black uppercase tracking-wider text-tech-text flex items-center gap-2"><Icons.LifeBuoy size={15} className="text-tech-yellow" /> Códigos de recuperación</p>
        <p className="text-[11px] text-tech-muted">Para entrar si pierdes el móvil. Te quedan <b className="text-tech-text">{status.methods.recoveryLeft}</b> sin usar.</p>
        {codes && (
          <div className="grid grid-cols-2 gap-2 bg-tech-carbon border border-tech-border rounded-xl p-3 font-mono text-sm text-tech-text text-center">
            {codes.map((c) => <span key={c}>{c}</span>)}
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          {codes && <button onClick={() => { navigator.clipboard?.writeText(codes.join('\n')); showToast('Códigos copiados', 'success'); }} className={btn}><Icons.Copy size={13} /> Copiar</button>}
          <button onClick={() => { if (window.confirm('Se crearán códigos nuevos y los anteriores dejarán de valer. ¿Seguir?')) act(() => recoveryRegenerate(adminToken), 'Códigos nuevos creados: guárdalos'); }}
            disabled={busy} className={btn}><Icons.RefreshCw size={13} /> Crear códigos nuevos</button>
        </div>
      </div>
    </div>
  );
};
