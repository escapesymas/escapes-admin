/** Informe de la Vista general: misma forma que `OverviewReport` de escapes-backend/lib/overview-report.ts. */

export type OverviewPreset = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'prev_month' | 'year' | 'custom';
export type KpiUnit = 'eur' | 'int' | 'pct' | 'dec';
export type KpiGroup = 'ventas' | 'visitas' | 'carritos' | 'clientes' | 'atencion' | 'catalogo';

export interface OverviewPeriod {
  preset: OverviewPreset;
  label: string;
  from: string;
  to: string;
  days: number;
  prevFrom: string;
  prevTo: string;
  prevLabel: string;
}

export interface OverviewKpi {
  id: string;
  group: KpiGroup;
  label: string;
  value: number;
  /** null = foto del momento (no se compara). */
  prev: number | null;
  unit: KpiUnit;
  good: 'up' | 'down' | null;
  hint?: string;
}

export interface OverviewFunnelStep { key: string; label: string; current: number; previous: number }

export interface OverviewVisits {
  byDay: { date: string; visitors: number; pageviews: number; carts: number; checkouts: number; cartValue: number }[];
  topPages: { path: string; title: string; views: number; visitors: number }[];
  sources: { name: string; visitors: number }[];
  cities: { city: string; country: string; visitors: number }[];
  devices: { device: string; visitors: number }[];
  topSearches: { term: string; count: number }[];
  noResultSearches: { term: string; count: number }[];
  topBikes: { term: string; count: number }[];
}

export interface OverviewReport {
  period: OverviewPeriod;
  generatedAt: string;
  excludeInternal: boolean;
  headline: string[];
  kpis: OverviewKpi[];
  sales: {
    byDay: { date: string; orders: number; revenue: number }[];
    topProducts: { name: string; sku: string; units: number; revenue: number }[];
    payments: { method: string; orders: number; revenue: number }[];
    coupons: { code: string; orders: number; discount: number }[];
  };
  visits: OverviewVisits | null;
  funnel: OverviewFunnelStep[];
  carts: {
    active: { count: number; value: number; guests: number; stale: number };
    top: { id: number; email: string | null; value: number; items: number; updatedAt: string }[];
  };
  warnings: string[];
}

export interface OverviewAiReport {
  text: string;
  model: string;
  generatedAt: string;
  cached: boolean;
  attempts: number;
  notes: string[];
  period: OverviewPeriod;
}
