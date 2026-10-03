// Avisos push del panel (PWA): suscripción, preferencias e historial.

// Mismo origen que el resto del panel: Traefik envía /api al backend. (Antes
// usaba VITE_API_URL con respaldo a backendescapes.com, dominio que ya no responde.)
const API_BASE = '/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function errorText(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data.error || fallback;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Instalada como app (pantalla de inicio de iOS/Android). */
export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`);
  const data = await res.json();
  if (!data.publicKey) throw new Error('No se pudo obtener la clave VAPID pública');
  return data.publicKey;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) throw new Error('Service Workers no están soportados en este navegador');
  return await navigator.serviceWorker.register('/sw.js');
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}

/** Pide permiso, suscribe el dispositivo y lo registra en el servidor. */
export async function subscribeToPushNotifications(token?: string): Promise<PushSubscription> {
  if (!isPushNotificationSupported()) {
    throw new Error('Las notificaciones push no están soportadas en este navegador o dispositivo.');
  }
  if (isIOS() && !isStandalonePWA()) {
    throw new Error('En iPhone, primero toca Compartir → «Añadir a la pantalla de inicio» y abre el panel desde ese icono.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado. Actívalo en Ajustes → Notificaciones.');

  const registration = await registerServiceWorker();
  const publicKey = await getVapidPublicKey();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
    });
  }

  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(subscription),
  });
  if (!res.ok) throw new Error(await errorText(res, 'Error al guardar la suscripción en el servidor'));
  return subscription;
}

/**
 * Vuelve a registrar en el servidor la suscripción que ya tiene el dispositivo
 * (al abrir el panel), por si se perdió o cambió de usuario.
 */
export async function refreshSubscription(token?: string): Promise<void> {
  const sub = await getCurrentSubscription().catch(() => null);
  if (!sub || !token) return;
  await fetch(`${API_BASE}/push/subscribe`, { method: 'POST', headers: headers(token), body: JSON.stringify(sub) }).catch(() => {});
}

export async function unsubscribeFromPushNotifications(token?: string): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return true;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await fetch(`${API_BASE}/push/unsubscribe`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ endpoint }),
  }).catch((err) => console.error('[UNSUBSCRIBE BACKEND ERROR]:', err));
  return true;
}

export async function sendTestNotification(token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/push/test`, { method: 'POST', headers: headers(token), body: '{}' });
  if (!res.ok) throw new Error(await errorText(res, 'Error al enviar la notificación de prueba'));
}

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  urgent: boolean;
}

export type NotificationPreferences = Record<string, boolean>;

/** Categorías disponibles y preferencias de este dispositivo. */
export async function getPushPreferences(token?: string): Promise<{ categories: NotificationCategory[]; preferences: NotificationPreferences | null }> {
  const subscription = await getCurrentSubscription().catch(() => null);
  const q = subscription ? `?endpoint=${encodeURIComponent(subscription.endpoint)}` : '';
  const res = await fetch(`${API_BASE}/push/preferences${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await errorText(res, 'No se pudieron leer las preferencias'));
  const data = await res.json();
  return { categories: data.categories || [], preferences: data.preferences || null };
}

export async function updatePushPreferences(prefs: NotificationPreferences, token?: string): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return false;
  const res = await fetch(`${API_BASE}/push/preferences`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ endpoint: subscription.endpoint, preferences: prefs }),
  }).catch(() => null);
  return !!res?.ok;
}

// ── Historial de avisos ──────────────────────────────────────────────────

export interface AdminNotificationItem {
  id: number;
  category: string;
  title: string;
  body: string;
  url: string | null;
  data: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export async function getNotificationHistory(token: string, opts: { before?: number; category?: string; unread?: boolean } = {}) {
  const q = new URLSearchParams({ limit: '30' });
  if (opts.before) q.set('before', String(opts.before));
  if (opts.category) q.set('category', opts.category);
  if (opts.unread) q.set('unread', '1');
  const res = await fetch(`${API_BASE}/push/history?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await errorText(res, 'No se pudo cargar el historial'));
  return (await res.json()) as { items: AdminNotificationItem[]; unread: number };
}

export async function getUnreadCount(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/push/unread-count`, { headers: headers(token) }).catch(() => null);
  if (!res?.ok) return 0;
  return (await res.json()).unread || 0;
}

export async function markNotificationsRead(token: string, ids: number[] | 'all'): Promise<number> {
  const res = await fetch(`${API_BASE}/push/history/read`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(ids === 'all' ? { all: true } : { ids }),
  });
  if (!res.ok) return -1;
  const unread = (await res.json()).unread || 0;
  // Actualiza el contador del icono de la app.
  const nav = navigator as any;
  if (nav.setAppBadge) (unread > 0 ? nav.setAppBadge(unread) : nav.clearAppBadge()).catch(() => {});
  return unread;
}
