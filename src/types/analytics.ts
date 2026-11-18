/** Tipos de las estadísticas web (los devuelve el backend en /api/admin/analytics/*). */

/** hot: intención de compra · engaged: interés claro · browsing: mira un poco · bounce: una sola página. */
export type VisitorTier = 'hot' | 'engaged' | 'browsing' | 'bounce';

/** Lo que ha hecho un visitante: páginas y los eventos que importan. */
export interface VisitorSignals {
  pageviews: number;
  productViews: number;
  visits: number;
  addToCart: number;
  checkout: number;
  purchase: number;
  chat: number;
  signUp: number;
  searches: number;
  noResults: number;
  bikes: number;
}

export interface VisitorInterests {
  searches: string[];
  bikes: string[];
}

export interface RealtimeActiveUser extends VisitorInterests {
  sessionId: string;
  city: string;
  region: string;
  country: string;
  device: string;
  os: string;
  browser: string;
  lastActiveAt: string;
  sessionStart: string;
  secondsAgo: number;
  totalEvents: number;
  currentPage: string;
  pageTitle: string;
  referrerDomain: string | null;
  signals: VisitorSignals;
  tier: VisitorTier;
  score: number;
  cartValue: number;
  visitStart: string;
  durationSeconds: number;
}

export interface RealtimePageView {
  eventId: string;
  sessionId: string;
  createdAt: string;
  secondsAgo: number;
  urlPath: string;
  pageTitle: string;
  referrerDomain: string | null;
  city: string;
  country: string;
  device: string;
}

export interface RealtimeData {
  online5m: number;
  online15m: number;
  online30m: number;
  users: RealtimeActiveUser[];
  recentPageviews: RealtimePageView[];
  timestamp: string;
}

/** Un visitante del periodo seleccionado. */
export interface VisitorRow extends VisitorInterests {
  sessionId: string;
  city: string;
  region: string;
  country: string;
  device: string;
  os: string;
  browser: string;
  firstSeen: string;
  lastSeen: string;
  secondsAgo: number;
  entryPage: string;
  entryReferrer: string | null;
  lastPage: string;
  lastTitle: string;
  signals: VisitorSignals;
  tier: VisitorTier;
  score: number;
  cartValue: number;
}

export interface EventSummaryRow {
  name: string;
  label: string;
  important: boolean;
  count: number;
  sessions: number;
}

export interface TermRow {
  term: string;
  count: number;
  sessions: number;
}

export interface VisitorInsights {
  summary: {
    visitors: number;
    tiers: Record<VisitorTier, number>;
    funnel: { visitors: number; productViews: number; addToCart: number; checkout: number; purchase: number };
    cartValue: number;
  };
  visitors: VisitorRow[];
  events: EventSummaryRow[];
  topSearches: TermRow[];
  noResultSearches: TermRow[];
  topBikes: TermRow[];
}

/** Resultado de buscar la visita que creó un carrito. */
export interface CartSessionMatch {
  sessionId: string;
  matched: number;
  total: number;
  lastAddAt: string;
  gapSeconds: number;
  confidence: 'alta' | 'media' | 'baja';
  otherCandidates: number;
}

/** Fila común para el listado de visitantes, sea del tiempo real o de un periodo. */
export interface VisitorListItem extends VisitorInterests {
  sessionId: string;
  city: string;
  region: string;
  country: string;
  device: string;
  os: string;
  browser: string;
  secondsAgo: number;
  referrer: string | null;
  /** Página actual (tiempo real) o última vista (periodo). */
  page: string;
  pageTitle: string;
  /** Página por la que entró, si se conoce y es distinta de la actual. */
  entryPage?: string;
  signals: VisitorSignals;
  tier: VisitorTier;
  score: number;
  cartValue: number;
}
