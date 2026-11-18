import React from 'react';
import * as Icons from 'lucide-react';
import { formatEuros } from '../../utils/format';
import type { VisitorInterests, VisitorSignals, VisitorTier } from '../../types/analytics';

/** «Activo ahora», «Hace 5 min», «Hace 3h», «Hace 2 d». */
export const formatSecondsAgo = (seconds: number): string => {
  if (seconds < 20) return 'Activo ahora';
  if (seconds < 60) return `Hace ${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)} d`;
};

/** «45s», «6 min», «1h 20m». */
export const formatDurationShort = (totalSeconds: number): string => {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

export const DeviceIcon: React.FC<{ device: string }> = ({ device }) => {
  const d = device.toLowerCase();
  if (d.includes('mobile')) {
    return <span title="Móvil"><Icons.Smartphone className="w-3.5 h-3.5 text-tech-yellow" /></span>;
  }
  if (d.includes('tablet')) {
    return <span title="Tablet"><Icons.Tablet className="w-3.5 h-3.5 text-blue-400" /></span>;
  }
  return <span title="Ordenador"><Icons.Monitor className="w-3.5 h-3.5 text-purple-400" /></span>;
};

export const ReferrerBadge: React.FC<{ referrer: string | null }> = ({ referrer }) => {
  if (!referrer) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
        <Icons.Compass className="w-3 h-3" /> Directo
      </span>
    );
  }
  const ref = referrer.toLowerCase();
  if (ref.includes('google')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Icons.Search className="w-3 h-3" /> {ref.includes('quicksearchbox') ? 'Google (App)' : 'Google'}
      </span>
    );
  }
  if (ref.includes('instagram') || ref.includes('tiktok') || ref.includes('facebook')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-pink-500/10 text-pink-400 border border-pink-500/20">
        <Icons.Share2 className="w-3 h-3" /> Social
      </span>
    );
  }
  if (ref.includes('escapesymas')) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-tech-carbon text-tech-muted border border-tech-border">
        Interno
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
      <Icons.Globe className="w-3 h-3" /> {referrer}
    </span>
  );
};

/** Orden de prioridad (el mismo del backend): primero los calientes. */
export const TIER_RANK: Record<VisitorTier, number> = { hot: 0, engaged: 1, browsing: 2, bounce: 3 };

export const TIER_META: Record<VisitorTier, { label: string; plural: string; icon: React.ElementType; badge: string; row: string; hint: string }> = {
  hot: {
    label: 'Caliente', plural: 'Calientes', icon: Icons.Flame,
    badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    row: 'border-l-2 border-l-orange-500',
    hint: 'Ha añadido algo al carrito, empezado a pagar, abierto el chat o creado una cuenta.',
  },
  engaged: {
    label: 'Interesado', plural: 'Interesados', icon: Icons.Star,
    badge: 'bg-tech-yellow/10 text-tech-yellow border-tech-yellow/30',
    row: 'border-l-2 border-l-tech-yellow/60',
    hint: 'Ha visto 4 o más páginas, varias fichas de producto, ha buscado, ha elegido su moto o ha vuelto a entrar.',
  },
  browsing: {
    label: 'Curioso', plural: 'Curiosos', icon: Icons.Eye,
    badge: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
    row: 'border-l-2 border-l-transparent',
    hint: 'Ha visto 2 o 3 páginas sin más.',
  },
  bounce: {
    label: 'Rebote', plural: 'Rebotes', icon: Icons.MinusCircle,
    badge: 'bg-tech-carbon text-tech-muted border-tech-border',
    row: 'border-l-2 border-l-transparent',
    hint: 'Ha visto una sola página y se ha ido (aquí caen también la mayoría de rastreadores).',
  },
};

export const TierBadge: React.FC<{ tier: VisitorTier }> = ({ tier }) => {
  const m = TIER_META[tier];
  const Icon = m.icon;
  return (
    <span title={m.hint} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border whitespace-nowrap ${m.badge}`}>
      <Icon className="w-3 h-3" /> {m.label}
    </span>
  );
};

interface SignalChipsProps {
  signals: VisitorSignals;
  cartValue: number;
  interests: VisitorInterests;
  /** Máximo de chips de búsqueda y moto que se enseñan. */
  compact?: boolean;
}

const chip = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap max-w-[200px]';

/** Lo importante que ha hecho un visitante, en chips: compra, pago, carrito (con su valor), chat, registro, visitas, fichas, búsquedas y moto. */
export const SignalChips: React.FC<SignalChipsProps> = ({ signals: s, cartValue, interests, compact }) => {
  const chips: React.ReactNode[] = [];
  if (s.purchase > 0) {
    chips.push(<span key="purchase" className={`${chip} bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-bold`}><Icons.BadgeCheck className="w-3 h-3 shrink-0" /> Compró</span>);
  }
  if (s.checkout > 0) {
    chips.push(<span key="checkout" className={`${chip} bg-orange-500/15 text-orange-300 border-orange-500/40 font-bold`}><Icons.CreditCard className="w-3 h-3 shrink-0" /> Pago iniciado</span>);
  }
  if (s.addToCart > 0) {
    chips.push(
      <span key="cart" className={`${chip} bg-tech-yellow/15 text-tech-yellow border-tech-yellow/40 font-bold`}
        title={`${s.addToCart} ${s.addToCart === 1 ? 'producto añadido' : 'productos añadidos'} al carrito`}>
        <Icons.ShoppingCart className="w-3 h-3 shrink-0" /> Carrito{s.addToCart > 1 ? ` ×${s.addToCart}` : ''}{cartValue > 0 ? ` · ${formatEuros(cartValue)}` : ''}
      </span>);
  }
  if (s.chat > 0) {
    chips.push(<span key="chat" className={`${chip} bg-sky-500/15 text-sky-300 border-sky-500/40`}><Icons.MessageCircle className="w-3 h-3 shrink-0" /> Chat</span>);
  }
  if (s.signUp > 0) {
    chips.push(<span key="signup" className={`${chip} bg-cyan-500/15 text-cyan-300 border-cyan-500/40`}><Icons.UserPlus className="w-3 h-3 shrink-0" /> Registro</span>);
  }
  if (s.visits > 1) {
    chips.push(<span key="visits" className={`${chip} bg-purple-500/10 text-purple-300 border-purple-500/30`} title="Ha vuelto a entrar"><Icons.Repeat className="w-3 h-3 shrink-0" /> {s.visits} visitas</span>);
  }
  if (s.productViews > 0) {
    chips.push(<span key="products" className={`${chip} bg-blue-500/10 text-blue-300 border-blue-500/25`}><Icons.Package className="w-3 h-3 shrink-0" /> {s.productViews} {s.productViews === 1 ? 'ficha' : 'fichas'}</span>);
  }
  const queries = interests.searches.slice(0, compact ? 1 : 2);
  queries.forEach((q, i) => {
    chips.push(<span key={`q${i}`} className={`${chip} bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25`} title={`Buscó: ${q}`}><Icons.Search className="w-3 h-3 shrink-0" /> <span className="truncate">{q}</span></span>);
  });
  if (!queries.length && s.searches > 0) {
    chips.push(<span key="searches" className={`${chip} bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25`}><Icons.Search className="w-3 h-3 shrink-0" /> {s.searches} {s.searches === 1 ? 'búsqueda' : 'búsquedas'}</span>);
  }
  if (s.noResults > 0) {
    chips.push(<span key="noresults" className={`${chip} bg-red-500/10 text-red-300 border-red-500/30`} title="Buscó algo y no encontró resultados"><Icons.SearchX className="w-3 h-3 shrink-0" /> Sin resultados</span>);
  }
  if (interests.bikes[0]) {
    chips.push(<span key="bike" className={`${chip} bg-amber-500/10 text-amber-300 border-amber-500/25`} title={`Moto elegida: ${interests.bikes.join(' · ')}`}><Icons.Bike className="w-3 h-3 shrink-0" /> <span className="truncate">{interests.bikes[0]}</span></span>);
  }
  if (!chips.length) return null;
  return <div className="flex flex-wrap items-center gap-1.5">{chips}</div>;
};
