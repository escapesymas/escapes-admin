/**
 * Verificación en dos pasos del personal: llamadas a /api/mfa y a la llave de
 * acceso del dispositivo (Face ID, huella, Windows Hello).
 */
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';

export interface MfaMethods { passkeys: number; totp: boolean; recoveryLeft: number }
export interface MfaStatus {
  pending: boolean;
  setupRequired: boolean;
  methods: MfaMethods;
  passkeys: { id: number; name: string | null; created_at: string; last_used_at: string | null }[];
}
export interface MfaResult { token: string; recoveryCodes?: string[] }

export const passkeysSupported = () => browserSupportsWebAuthn();

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/mfa${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || 'No se pudo completar');
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const mfaStatus = (token: string) => call<MfaStatus>(token, '/status');

/** Nombre orientativo del dispositivo para la lista de llaves. */
function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone (Face ID)';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android (huella)';
  if (/Mac OS X/.test(ua)) return 'Mac (Touch ID)';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return 'Llave de acceso';
}

/** Crea una llave de acceso en este dispositivo y la registra. */
export async function registerPasskey(token: string): Promise<MfaResult> {
  const options = await call<any>(token, '/passkey/register-options', { method: 'POST' });
  const response = await startRegistration({ optionsJSON: options });
  return call<MfaResult>(token, '/passkey/register-verify', { method: 'POST', body: JSON.stringify({ response, name: deviceName() }) });
}

/** Segundo paso con la llave de acceso (Face ID / huella). */
export async function verifyPasskey(token: string): Promise<MfaResult> {
  const options = await call<any>(token, '/passkey/auth-options', { method: 'POST' });
  const response = await startAuthentication({ optionsJSON: options });
  return call<MfaResult>(token, '/passkey/auth-verify', { method: 'POST', body: JSON.stringify({ response }) });
}

export const totpSetup = (token: string) => call<{ qr: string; secret: string }>(token, '/totp/setup', { method: 'POST' });
export const totpEnable = (token: string, code: string) => call<MfaResult>(token, '/totp/enable', { method: 'POST', body: JSON.stringify({ code }) });
export const totpVerify = (token: string, code: string) => call<MfaResult>(token, '/totp/verify', { method: 'POST', body: JSON.stringify({ code }) });
export const totpDisable = (token: string) => call<{ success: boolean }>(token, '/totp/disable', { method: 'POST' });
export const recoveryVerify = (token: string, code: string) => call<MfaResult>(token, '/recovery/verify', { method: 'POST', body: JSON.stringify({ code }) });
export const recoveryRegenerate = (token: string) => call<{ recoveryCodes: string[] }>(token, '/recovery/regenerate', { method: 'POST' });
export const deletePasskey = (token: string, id: number) => call<{ success: boolean }>(token, `/passkey/${id}`, { method: 'DELETE' });

/** Mensaje claro cuando el usuario cancela Face ID o el navegador no lo permite. */
export function friendlyWebAuthnError(err: any): string {
  const name = err?.name || '';
  if (name === 'NotAllowedError') return 'Se canceló o se agotó el tiempo. Vuelve a intentarlo.';
  if (name === 'InvalidStateError') return 'Este dispositivo ya está registrado.';
  if (name === 'NotSupportedError') return 'Este navegador no admite llaves de acceso. Usa Google Authenticator.';
  return err?.message || 'No se pudo completar';
}
