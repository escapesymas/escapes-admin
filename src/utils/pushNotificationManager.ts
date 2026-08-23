// Gestor de suscripciones Push para el Frontend PWA (escapes-admin)

const API_BASE = import.meta.env.VITE_API_URL || 'https://backendescapes.com/api';

/**
 * Convierte una clave VAPID Base64 URL Safe a Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Verifica si el navegador/dispositivo soporta Service Workers y Notificaciones Push
 */
export function isPushNotificationSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Verifica si se ejecuta en modo standalone (instalada como app en pantalla de inicio de iOS/Android)
 */
export function isStandalonePWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
}

/**
 * Detecta si el dispositivo es iOS (iPhone / iPad)
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

/**
 * Obtiene la clave VAPID pública desde el backend
 */
async function getVapidPublicKey(): Promise<string> {
  const res = await fetch(`${API_BASE}/push/vapid-public-key`);
  const data = await res.json();
  if (!data.publicKey) throw new Error('No se pudo obtener la clave VAPID pública');
  return data.publicKey;
}

/**
 * Registra el Service Worker `sw.js`
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers no están soportados en este navegador');
  }
  return await navigator.serviceWorker.register('/sw.js');
}

/**
 * Obtiene la suscripción push actual si existe
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushNotificationSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}

/**
 * Solicita permiso y suscribe al usuario a las notificaciones Push
 */
export async function subscribeToPushNotifications(token?: string): Promise<PushSubscription> {
  if (!isPushNotificationSupported()) {
    throw new Error('Las notificaciones Push no están soportadas en este navegador o dispositivo.');
  }

  // En iOS, las notificaciones push Web solo funcionan si la app ha sido añadida a la Pantalla de Inicio
  if (isIOS() && !isStandalonePWA()) {
    throw new Error('En iPhone, debes primero tocar en Compartir -> "Añadir a la pantalla de inicio" para activar las notificaciones.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado por el usuario.');
  }

  const registration = await registerServiceWorker();
  const publicKey = await getVapidPublicKey();
  const convertedKey = urlBase64ToUint8Array(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedKey.buffer as ArrayBuffer
    });
  }

  // Enviar suscripción al backend
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(subscription)
  });

  if (!res.ok) {
    throw new Error('Error al guardar la suscripción push en el servidor');
  }

  return subscription;
}

/**
 * Cancela la suscripción a notificaciones push
 */
export async function unsubscribeFromPushNotifications(token?: string): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  // Informar al backend
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    await fetch(`${API_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ endpoint })
    });
  } catch (err) {
    console.error('[UNSUBSCRIBE BACKEND ERROR]:', err);
  }

  return true;
}

/**
 * Envía una notificación de prueba al backend
 */
export async function sendTestNotification(token?: string): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/push/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: '🛒 ¡Pedido de prueba recibido!',
      body: 'Notificación de prueba enviada con éxito desde Escapes y Más Admin PWA.'
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al enviar notificación de prueba');
  }
}

export interface NotificationPreferences {
  new_order: boolean;
  payment_failed: boolean;
  abandoned_cart: boolean;
  dropshipping_status: boolean;
  new_user: boolean;
  daily_summary: boolean;
}

/**
 * Obtiene las preferencias de notificación desde el servidor
 */
export async function getPushPreferences(): Promise<NotificationPreferences | null> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return null;

  try {
    const res = await fetch(`${API_BASE}/push/preferences?endpoint=${encodeURIComponent(subscription.endpoint)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.preferences || null;
  } catch (err) {
    console.error('Error al obtener preferencias:', err);
    return null;
  }
}

/**
 * Guarda las preferencias de notificación en el servidor
 */
export async function updatePushPreferences(prefs: Partial<NotificationPreferences>): Promise<boolean> {
  const subscription = await getCurrentSubscription();
  if (!subscription) return false;

  try {
    const res = await fetch(`${API_BASE}/push/preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        preferences: prefs
      })
    });
    return res.ok;
  } catch (err) {
    console.error('Error al actualizar preferencias:', err);
    return false;
  }
}
