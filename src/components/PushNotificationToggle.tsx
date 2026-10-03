import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, BellOff, Send, Share2, CheckCircle2, AlertCircle, ShoppingCart, AlertTriangle, ShoppingBag, Truck,
  UserPlus, TrendingUp, RotateCcw, Mail, ShieldCheck, Star, Server, CheckCheck, Loader2,
} from 'lucide-react';
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
  getNotificationHistory,
  markNotificationsRead,
  type NotificationCategory,
  type NotificationPreferences,
  type AdminNotificationItem,
} from '../utils/pushNotificationManager';

interface PushNotificationToggleProps {
  token?: string;
  /** Abre el enlace de un aviso dentro del panel (pestaña y pedido). */
  onOpenLink?: (url: string) => void;
  /** Avisa al panel del número de avisos sin leer. */
  onUnreadChange?: (n: number) => void;
}

/** Icono y color de cada categoría. */
const CATEGORY_STYLE: Record<string, { icon: React.ElementType; color: string }> = {
  new_order: { icon: ShoppingCart, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  payment_failed: { icon: AlertTriangle, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  refund: { icon: RotateCcw, color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  dropshipping_status: { icon: Truck, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  contact: { icon: Mail, color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  warranty: { icon: ShieldCheck, color: 'text-teal-400 bg-teal-500/10 border-teal-500/30' },
  review: { icon: Star, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  abandoned_cart: { icon: ShoppingBag, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  new_user: { icon: UserPlus, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  system: { icon: Server, color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
  daily_summary: { icon: TrendingUp, color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
};
const styleFor = (key: string) => CATEGORY_STYLE[key] || CATEGORY_STYLE.system;

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export const PushNotificationToggle: React.FC<PushNotificationToggleProps> = ({ token, onOpenLink, onUnreadChange }) => {
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [testing, setTesting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({});

  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<string>('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const supported = isPushNotificationSupported();
  const ios = isIOS();
  const standalone = isStandalonePWA();

  const loadPrefs = useCallback(async () => {
    try {
      const { categories: cats, preferences } = await getPushPreferences(token);
      setCategories(cats);
      setPrefs(preferences || Object.fromEntries(cats.map((c) => [c.key, true])));
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  }, [token]);

  const loadHistory = useCallback(async (append = false, before?: number) => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const data = await getNotificationHistory(token, { before, category: filter || undefined });
      setItems((prev) => (append ? [...prev, ...data.items] : data.items));
      setHasMore(data.items.length === 30);
      setUnread(data.unread);
      onUnreadChange?.(data.unread);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [token, filter, onUnreadChange]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        if (supported) {
          await registerServiceWorker().catch(() => {});
          const sub = await Promise.race([
            getCurrentSubscription(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
          setIsSubscribed(!!sub);
        }
        await loadPrefs();
      } finally {
        setLoading(false);
      }
    })();
  }, [supported, loadPrefs]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleToggle = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      if (isSubscribed) {
        await unsubscribeFromPushNotifications(token);
        setIsSubscribed(false);
        setSuccessMsg('Avisos desactivados en este dispositivo.');
      } else {
        await subscribeToPushNotifications(token);
        setIsSubscribed(true);
        setSuccessMsg('Avisos activados en este dispositivo.');
        await loadPrefs();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo cambiar el estado de los avisos.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = async (key: string, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    if (isSubscribed) {
      const ok = await updatePushPreferences({ [key]: value }, token);
      if (!ok) setErrorMsg('No se pudo guardar la preferencia.');
    }
  };

  const setAll = async (value: boolean) => {
    const all = Object.fromEntries(categories.map((c) => [c.key, value]));
    setPrefs(all);
    if (isSubscribed) await updatePushPreferences(all, token);
  };

  const handleSendTest = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTesting(true);
    try {
      await sendTestNotification(token);
      setSuccessMsg('Prueba enviada. Debería llegarte en unos segundos.');
      setTimeout(() => loadHistory(), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar la prueba.');
    } finally {
      setTesting(false);
    }
  };

  const openItem = async (it: AdminNotificationItem) => {
    if (!it.read_at && token) {
      setItems((list) => list.map((x) => (x.id === it.id ? { ...x, read_at: new Date().toISOString() } : x)));
      const n = await markNotificationsRead(token, [it.id]);
      if (n >= 0) { setUnread(n); onUnreadChange?.(n); }
    }
    if (it.url && onOpenLink) onOpenLink(it.url);
  };

  const readAll = async () => {
    if (!token) return;
    const n = await markNotificationsRead(token, 'all');
    if (n >= 0) {
      setUnread(n);
      onUnreadChange?.(n);
      setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    }
  };

  const enabledCount = categories.filter((c) => prefs[c.key] !== false).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      <div className="space-y-6">
        {/* Estado del dispositivo */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-lg ${isSubscribed ? 'bg-orange-500/20 text-orange-500' : 'bg-slate-800 text-slate-400'}`}>
              {isSubscribed ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Avisos en este dispositivo</h3>
              <p className="text-sm text-slate-400">
                {isSubscribed ? `Activados · ${enabledCount} de ${categories.length} tipos` : 'Desactivados'}
              </p>
            </div>
          </div>

          {!supported && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-4 mb-4 text-slate-300 text-sm">
              Este navegador no admite avisos push. En iPhone, abre el panel desde el icono de la pantalla de inicio.
            </div>
          )}

          {ios && !standalone && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4 flex items-start gap-3 text-amber-200 text-sm">
              <Share2 className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-1">Para recibir avisos en el iPhone:</span>
                Toca <span className="underline font-medium">Compartir</span> en Safari, elige <span className="font-semibold text-amber-400">«Añadir a la pantalla de inicio»</span> y abre el panel desde ese icono.
              </div>
            </div>
          )}

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

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleToggle}
              disabled={loading || !supported || (ios && !standalone)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all ${
                isSubscribed
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-600/30'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isSubscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              {isSubscribed ? 'Desactivar avisos' : 'Activar avisos en este dispositivo'}
            </button>
            {isSubscribed && (
              <button
                onClick={handleSendTest}
                disabled={testing}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium border border-slate-700 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-orange-400" />
                {testing ? 'Enviando…' : 'Enviar prueba'}
              </button>
            )}
          </div>
        </div>

        {/* Tipos de aviso */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h4 className="text-base font-semibold text-white">Qué avisos quieres recibir</h4>
              <p className="text-xs text-slate-400 mt-1">
                {isSubscribed ? 'Se guarda para este dispositivo. El historial guarda todos los avisos.' : 'Activa los avisos para elegir qué recibir en este dispositivo.'}
              </p>
            </div>
            {isSubscribed && (
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setAll(true)} className="text-[11px] px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">Todos</button>
                <button onClick={() => setAll(false)} className="text-[11px] px-2.5 py-1 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800">Ninguno</button>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {categories.map((opt) => {
              const { icon: Icon, color } = styleFor(opt.key);
              const isChecked = prefs[opt.key] !== false;
              return (
                <label
                  key={opt.key}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                    isSubscribed ? 'cursor-pointer' : 'cursor-not-allowed'
                  } ${isChecked ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-950/40 border-slate-800/50 opacity-60'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border shrink-0 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-sm text-slate-200 block">{opt.label}</span>
                      <span className="text-xs text-slate-400 block mt-0.5">{opt.description}</span>
                    </div>
                  </div>
                  <span className="relative inline-flex items-center shrink-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={!isSubscribed}
                      onChange={(e) => handlePreferenceChange(opt.key, e.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="w-11 h-6 bg-slate-700 rounded-full peer-checked:bg-orange-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Historial */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="text-base font-semibold text-white">Historial de avisos</h4>
            <p className="text-xs text-slate-400 mt-1">{unread > 0 ? `${unread} sin leer` : 'Todo leído'} · se guardan 90 días</p>
          </div>
          {unread > 0 && (
            <button onClick={readAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todo leído
            </button>
          )}
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full mb-4 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200"
        >
          <option value="">Todos los tipos</option>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>

        <div className="space-y-2">
          {items.length === 0 && !historyLoading && (
            <p className="text-sm text-slate-500 text-center py-10 border border-dashed border-slate-800 rounded-xl">No hay avisos.</p>
          )}
          {items.map((it) => {
            const { icon: Icon, color } = styleFor(it.category);
            return (
              <button
                key={it.id}
                onClick={() => openItem(it)}
                className={`w-full text-left p-3 rounded-xl border flex gap-3 transition-colors ${
                  it.read_at ? 'border-slate-800 bg-slate-950/30 hover:bg-slate-800/40' : 'border-orange-600/40 bg-orange-500/5 hover:bg-orange-500/10'
                }`}
              >
                <div className={`p-2 h-fit rounded-lg border shrink-0 ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-sm ${it.read_at ? 'text-slate-300' : 'text-white font-semibold'}`}>{it.title}</span>
                    <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{timeAgo(it.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 break-words">{it.body}</p>
                </div>
                {!it.read_at && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" aria-label="Sin leer" />}
              </button>
            );
          })}
          {historyLoading && <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-500 animate-spin" /></div>}
          {hasMore && !historyLoading && (
            <button
              onClick={() => loadHistory(true, items[items.length - 1]?.id)}
              className="w-full text-xs py-2 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800/40"
            >
              Ver más
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
