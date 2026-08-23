import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Send, Share2, CheckCircle2, AlertCircle, ShoppingCart, AlertTriangle, ShoppingBag, Truck, UserPlus, TrendingUp } from 'lucide-react';
import {
  isPushNotificationSupported,
  isStandalonePWA,
  isIOS,
  registerServiceWorker,
  getCurrentSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestNotification,
  getPushPreferences,
  updatePushPreferences,
  type NotificationPreferences
} from '../utils/pushNotificationManager';

interface PushNotificationToggleProps {
  token?: string;
}

export const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({ token }) => {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    new_order: true,
    payment_failed: true,
    abandoned_cart: true,
    dropshipping_status: true,
    new_user: true,
    daily_summary: true
  });

  const supported = isPushNotificationSupported();
  const ios = isIOS();
  const standalone = isStandalonePWA();

  useEffect(() => {
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      setLoading(true);
      if (!supported) {
        setLoading(false);
        return;
      }
      await registerServiceWorker().catch(() => {});
      
      const subPromise = getCurrentSubscription();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
      const sub = await Promise.race([subPromise, timeoutPromise]);
      
      setIsSubscribed(!!sub);

      if (sub) {
        const currentPrefs = await getPushPreferences();
        if (currentPrefs) {
          setPrefs(currentPrefs);
        }
      }
    } catch (e) {
      console.error('Error al comprobar suscripción push:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (isSubscribed) {
        await unsubscribeFromPushNotifications(token);
        setIsSubscribed(false);
        setSuccessMsg('Notificaciones push desactivadas correctamente.');
      } else {
        await subscribeToPushNotifications(token);
        setIsSubscribed(true);
        setSuccessMsg('¡Notificaciones Push activadas en tu dispositivo!');
        const currentPrefs = await getPushPreferences();
        if (currentPrefs) setPrefs(currentPrefs);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar el estado de las notificaciones.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    if (isSubscribed) {
      await updatePushPreferences({ [key]: value });
    }
  };

  const handleSendTest = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTesting(true);

    try {
      await sendTestNotification(token);
      setSuccessMsg('Notificación de prueba enviada. Comprueba tu iPhone/pantalla de bloqueo.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar prueba.');
    } finally {
      setTesting(false);
    }
  };

  const notificationOptions = [
    {
      key: 'new_order' as keyof NotificationPreferences,
      label: 'Nuevos Pedidos',
      description: 'Alertas cuando un cliente compra y paga con éxito en la tienda',
      icon: ShoppingCart,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      key: 'payment_failed' as keyof NotificationPreferences,
      label: 'Pagos Rechazados / Fallidos',
      description: 'Avisos cuando la pasarela o tarjeta de un cliente es rechazada',
      icon: AlertTriangle,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    },
    {
      key: 'abandoned_cart' as keyof NotificationPreferences,
      label: 'Carritos Abandonados',
      description: 'Notificación cuando un cliente deja un carrito pendiente de finalizar',
      icon: ShoppingBag,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30'
    },
    {
      key: 'dropshipping_status' as keyof NotificationPreferences,
      label: 'Estado de Envío (Bihr)',
      description: 'Avisos de tracking generado o incidencias de envío con el proveedor',
      icon: Truck,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30'
    },
    {
      key: 'new_user' as keyof NotificationPreferences,
      label: 'Nuevos Clientes Registrados',
      description: 'Notificación cada vez que un usuario crea una nueva cuenta',
      icon: UserPlus,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
    },
    {
      key: 'daily_summary' as keyof NotificationPreferences,
      label: 'Resumen Diario de Ventas (21:00h)',
      description: 'Resumen automático al final del día con total facturado y pedidos',
      icon: TrendingUp,
      color: 'text-orange-400 bg-orange-500/10 border-orange-500/30'
    }
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Tarjeta principal de Estado */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${isSubscribed ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-400'}`}>
              {isSubscribed ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Notificaciones Push en tu Dispositivo</h3>
              <p className="text-sm text-slate-400">Alertas instantáneas en la pantalla de bloqueo de tu iPhone</p>
            </div>
          </div>
        </div>

        {/* Banner de instrucción para iOS si NO está añadida a inicio */}
        {ios && !standalone && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 flex items-start gap-3 text-amber-200 text-sm">
            <Share2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-1">Para activar notificaciones en tu iPhone:</span>
              Toca el botón <span className="underline font-medium">Compartir</span> de Safari y selecciona <span className="font-semibold text-amber-400">"Añadir a la pantalla de inicio"</span>. Luego abre la app instalada.
            </div>
          </div>
        )}

        {/* Mensajes de feedback */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 flex items-center gap-2 text-emerald-300 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Botones de control */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleToggle}
            disabled={loading || (ios && !standalone)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
              isSubscribed
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading ? (
              <span className="animate-pulse">Cargando...</span>
            ) : isSubscribed ? (
              <>
                <BellOff className="w-4 h-4" /> Desactivar Notificaciones
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" /> Activar Notificaciones en mi iPhone
              </>
            )}
          </button>

          {isSubscribed && (
            <button
              onClick={handleSendTest}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium border border-slate-700 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-orange-400" />
              {testing ? 'Enviando...' : 'Probar Notificación'}
            </button>
          )}
        </div>
      </div>

      {/* Menú de Selección de Tipos de Notificaciones */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="mb-6">
          <h4 className="text-base font-semibold text-white">Selección de Alertas Deseadas</h4>
          <p className="text-xs text-slate-400 mt-1">Elige exactamente qué avisos deseas recibir en tu iPhone</p>
        </div>

        <div className="space-y-3">
          {notificationOptions.map((opt) => {
            const Icon = opt.icon;
            const isChecked = prefs[opt.key] ?? true;

            return (
              <div
                key={opt.key}
                onClick={() => handlePreferenceChange(opt.key, !isChecked)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isChecked
                    ? 'bg-slate-800/80 border-slate-700'
                    : 'bg-slate-950/40 border-slate-800/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-lg border shrink-0 ${opt.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-slate-200 block truncate">{opt.label}</span>
                    <span className="text-xs text-slate-400 block truncate mt-0.5">{opt.description}</span>
                  </div>
                </div>

                {/* Custom Checkbox Toggle */}
                <div className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handlePreferenceChange(opt.key, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
