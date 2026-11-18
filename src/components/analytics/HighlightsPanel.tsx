import React, { useMemo, useState } from 'react';
import * as Icons from 'lucide-react';
import type { VisitorInsights, VisitorListItem, VisitorRow, VisitorTier } from '../../types/analytics';
import { TIER_META, TierBadge } from './analyticsUi';
import { VisitorList } from './VisitorList';

type Filter = 'priority' | VisitorTier | 'all';

interface HighlightsPanelProps {
  insights: VisitorInsights | null;
  loading: boolean;
  rangeLabel: string;
  onSelect: (sessionId: string) => void;
}

const toItem = (v: VisitorRow): VisitorListItem => ({
  sessionId: v.sessionId,
  city: v.city,
  region: v.region,
  country: v.country,
  device: v.device,
  os: v.os,
  browser: v.browser,
  secondsAgo: v.secondsAgo,
  referrer: v.entryReferrer,
  page: v.lastPage,
  pageTitle: v.lastTitle,
  entryPage: v.entryPage,
  signals: v.signals,
  tier: v.tier,
  score: v.score,
  cartValue: v.cartValue,
  searches: v.searches,
  bikes: v.bikes,
});

const matches = (v: VisitorRow, q: string) =>
  [v.city, v.region, v.os, v.browser, v.lastPage, v.lastTitle, v.entryPage, v.entryReferrer || '', ...v.searches, ...v.bikes]
    .some((t) => t.toLowerCase().includes(q));

/**
 * Los visitantes del periodo por prioridad: primero quien ha puesto algo en el carrito o ha empezado a pagar, después
 * quien ha visto varias páginas o fichas o ha vuelto. Por defecto no enseña a quien vio una sola página.
 */
export const HighlightsPanel: React.FC<HighlightsPanelProps> = ({ insights, loading, rangeLabel, onSelect }) => {
  const [filter, setFilter] = useState<Filter>('priority');
  const [search, setSearch] = useState('');

  const tiers = insights?.summary.tiers;
  const shown = useMemo(() => {
    if (!insights) return [];
    const q = search.trim().toLowerCase();
    return insights.visitors
      .filter((v) => (filter === 'all' ? true : filter === 'priority' ? v.tier === 'hot' || v.tier === 'engaged' : v.tier === filter))
      .filter((v) => !q || matches(v, q))
      .map(toItem);
  }, [insights, filter, search]);

  const filterCount = (f: Filter): number | null => {
    if (!tiers) return null;
    if (f === 'all') return insights!.summary.visitors;
    if (f === 'priority') return tiers.hot + tiers.engaged;
    return tiers[f];
  };

  const chips: { id: Filter; label: string }[] = [
    { id: 'priority', label: 'Prioritarios' },
    { id: 'hot', label: TIER_META.hot.plural },
    { id: 'engaged', label: TIER_META.engaged.plural },
    { id: 'browsing', label: TIER_META.browsing.plural },
    { id: 'bounce', label: TIER_META.bounce.plural },
    { id: 'all', label: 'Todos' },
  ];

  const total = filterCount(filter);
  const truncated = !search && total !== null && total > shown.length;

  return (
    <div className="bg-tech-card border border-tech-border rounded-md shadow-xl overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-tech-border space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-mono uppercase tracking-wider flex items-center gap-2 text-tech-text">
              <Icons.Flame className="w-4 h-4 text-orange-400" />
              Visitantes por prioridad ({rangeLabel})
            </h3>
            <p className="text-[11px] text-tech-muted font-mono mt-1">
              Primero quien ha puesto algo en el carrito o ha empezado a pagar; después quien ha visto varias páginas o ha vuelto.
              Toca un visitante para ver su recorrido completo.
            </p>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Icons.Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-tech-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar ciudad, página, búsqueda..."
              className="w-full bg-tech-carbon border border-tech-border rounded px-3 py-1.5 pl-8 text-xs font-mono text-tech-text focus:border-tech-yellow focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tech-muted hover:text-tech-text">
                <Icons.X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {chips.map((c) => {
            const n = filterCount(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider whitespace-nowrap border transition-all ${
                  filter === c.id
                    ? 'bg-tech-yellow/15 text-tech-yellow border-tech-yellow/40 font-bold'
                    : 'bg-tech-carbon text-tech-muted border-tech-border hover:text-tech-text'
                }`}
              >
                {c.label}{n !== null ? ` (${n})` : ''}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono text-tech-muted">
          {(['hot', 'engaged', 'browsing', 'bounce'] as VisitorTier[]).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><TierBadge tier={t} /> <span className="hidden lg:inline">{TIER_META[t].hint}</span></span>
          ))}
        </div>
      </div>

      {loading && !insights ? (
        <div className="py-16 flex justify-center"><Icons.Loader2 className="w-6 h-6 text-tech-yellow animate-spin" /></div>
      ) : (
        <VisitorList
          items={shown}
          onSelect={onSelect}
          pageLabel="Última página"
          ariaLabel="Visitantes del periodo por prioridad"
          emptyMessage={
            search
              ? 'Ningún visitante coincide con el filtro.'
              : filter === 'priority'
                ? 'Nadie con interés claro en este periodo todavía. Cuando alguien vea varias páginas o añada algo al carrito, aparecerá aquí.'
                : 'No hay visitantes de este tipo en el periodo.'
          }
        />
      )}

      {truncated && (
        <div className="px-4 py-3 border-t border-tech-border text-[11px] font-mono text-tech-muted text-center">
          Se enseñan los {shown.length} de más prioridad de {total}. Acorta el periodo o filtra para ver el resto.
        </div>
      )}
    </div>
  );
};
