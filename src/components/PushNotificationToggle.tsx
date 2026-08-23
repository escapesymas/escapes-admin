import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Send, Share2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  isPushNotificationSupported,
  isStandalonePWA,
  isIOS,
  getCurrentSubscription,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  sendTestNotification
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
      // Registrar primero el SW si no lo estaba para evitar bloqueo en navigator.serviceWorker.ready
      await registerServiceWorker().catch(() => {});
      
      const subPromise = getCurrentSubscription();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
      const sub = await Promise.race([subPromise, timeoutPromise]);
      
      setIsSubscribed(!!sub);
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
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar el estado de las notificaciones.');
    } finally {
      setLoading(false);
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-lg ${isSubscribed ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-400'}`}>
            {isSubscribed ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Notificaciones Push de Pedidos</h3>
            <p className="text-sm text-slate-400">Recibe alertas al instante en tu iPhone al entrar un nuevo pedido</p>
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
  );
};
