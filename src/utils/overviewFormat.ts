/**
 * Formato de las cifras de la Vista general. Mismo criterio que escapes-backend/lib/overview-format.ts (que usan el PDF y la IA):
 * si cambias uno, cambia el otro para que la pantalla, el PDF y el análisis enseñen exactamente lo mismo.
 */
import type { OverviewKpi, KpiUnit } from '../types/overview';

// `useGrouping: 'always'`: el español no agrupa por defecto los números de 4 cifras («1173»), pero en un informe se lee mejor «1.173».
const num = (v: number, min: number, max: number): string =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions).format(v);

export function fmtValue(v: number, unit: KpiUnit): string {
  switch (unit) {
    case 'eur': return `${num(v, 2, 2)} €`;
    case 'int': return num(Math.round(v), 0, 0);
    case 'pct': {
      const small = v !== 0 && Math.abs(v) < 1;
      return `${num(v, small ? 2 : 1, small ? 2 : 1)} %`;
    }
    case 'dec': return num(v, 1, 1);
  }
}

/** Euros sin decimales para los ejes de las gráficas («1.250 €»). */
export const fmtEurShort = (v: number): string => `${num(v, 0, v < 10 ? 2 : 0)} €`;

export interface Delta {
  /** «+12,3 %», «−3,1 pp», «nuevo», «=». Vacío si no hay con qué comparar. */
  text: string;
  dir: 'up' | 'down' | 'flat' | 'new' | 'none';
  sentiment: 'good' | 'bad' | 'neutral';
}

/** Variación respecto al periodo anterior. Desde cero no se calcula un porcentaje (sería infinito). */
export function deltaOf(k: Pick<OverviewKpi, 'value' | 'prev' | 'unit' | 'good'>): Delta {
  if (k.prev == null) return { text: '', dir: 'none', sentiment: 'neutral' };
  const diff = k.value - k.prev;
  const eps = k.unit === 'int' ? 0.5 : 0.005;
  if (Math.abs(diff) < eps) return { text: '=', dir: 'flat', sentiment: 'neutral' };
  const dir = diff > 0 ? 'up' : 'down';
  const sentiment: Delta['sentiment'] = k.good == null ? 'neutral' : (dir === 'up') === (k.good === 'up') ? 'good' : 'bad';
  if (k.unit === 'pct') return { text: `${diff > 0 ? '+' : '−'}${num(Math.abs(diff), 1, 1)} pp`, dir, sentiment };
  if (k.prev === 0) return { text: 'nuevo', dir: 'new', sentiment };
  const p = (diff / Math.abs(k.prev)) * 100;
  const shown = Math.abs(p) >= 1000 ? num(Math.round(Math.abs(p)), 0, 0) : num(Math.abs(p), 1, 1);
  return { text: `${p > 0 ? '+' : '−'}${shown} %`, dir, sentiment };
}

/** «2026-11-05» → «5/11». */
export function fmtDay(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}/${m}`;
}

/** «2026-11-05» → «jueves 5 de noviembre». */
export function fmtDayLong(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export const cityLabel = (city: string, country: string): string => (country && country !== 'ES' ? `${city} (${country})` : city);

export const GROUP_TITLES: Record<string, string> = {
  ventas: 'Ventas y pedidos',
  visitas: 'Visitas a la web',
  carritos: 'Carritos',
  clientes: 'Clientes',
  atencion: 'Atención al cliente',
  catalogo: 'Catálogo',
};

export const GROUP_ORDER = ['ventas', 'visitas', 'carritos', 'clientes', 'atencion', 'catalogo'] as const;

export const DEVICE_NAMES: Record<string, string> = { mobile: 'Móvil', desktop: 'Ordenador', laptop: 'Portátil', tablet: 'Tablet' };
export const PAYMENT_NAMES: Record<string, string> = { card: 'Tarjeta', paypal: 'PayPal', bizum: 'Bizum', transfer: 'Transferencia', otro: 'Otro' };
