import React from 'react';
import * as Icons from 'lucide-react';
import type { VisitorListItem } from '../../types/analytics';
import { DeviceIcon, ReferrerBadge, SignalChips, TIER_META, TierBadge, formatSecondsAgo } from './analyticsUi';

interface VisitorListProps {
  items: VisitorListItem[];
  onSelect: (sessionId: string) => void;
  emptyMessage: string;
  /** Texto de la columna de página: «Página actual» en directo, «Última página» en un periodo. */
  pageLabel: string;
  ariaLabel: string;
}

const statusDot = (secondsAgo: number) =>
  secondsAgo <= 60 ? 'bg-emerald-500 animate-ping' : secondsAgo <= 300 ? 'bg-emerald-500' : 'bg-zinc-600';

const statusText = (secondsAgo: number) =>
  secondsAgo <= 60 ? 'text-emerald-400 font-bold' : secondsAgo <= 300 ? 'text-emerald-300' : 'text-tech-muted';

const rowBg = (item: VisitorListItem) => (item.tier === 'hot' ? 'bg-orange-500/[0.04]' : '');

/**
 * Listado de visitantes ordenado por prioridad (lo ordena quien lo usa): nivel, páginas vistas y lo importante que han
 * hecho. Es el mismo para el tiempo real y para un periodo; tabla en escritorio y tarjetas en el móvil.
 */
export const VisitorList: React.FC<VisitorListProps> = ({ items, onSelect, emptyMessage, pageLabel, ariaLabel }) => {
  if (items.length === 0) {
    return <div className="px-4 py-12 text-center text-tech-muted text-xs font-mono">{emptyMessage}</div>;
  }

  return (
    <>
      {/* VISTA MÓVIL: tarjetas legibles sin scroll horizontal */}
      <div className="block md:hidden divide-y divide-tech-border">
        {items.map((u) => (
          <div
            key={u.sessionId}
            onClick={() => onSelect(u.sessionId)}
            className={`p-4 space-y-3 cursor-pointer hover:bg-[#1a1b1e] active:bg-[#222428] transition-colors ${TIER_META[u.tier].row} ${rowBg(u)}`}
          >
            <div className="flex items-center justify-between gap-2 text-xs font-mono">
              <TierBadge tier={u.tier} />
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusDot(u.secondsAgo)}`} />
                <span className={`text-[11px] ${statusText(u.secondsAgo)}`}>{formatSecondsAgo(u.secondsAgo)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-tech-muted">
              <span className="flex items-center gap-1 min-w-0">
                <Icons.MapPin size={12} className="text-tech-yellow shrink-0" />
                <span className="truncate">{u.city} ({u.country})</span>
                <span className="shrink-0 pl-1"><DeviceIcon device={u.device} /></span>
              </span>
              <ReferrerBadge referrer={u.referrer} />
            </div>

            <SignalChips signals={u.signals} cartValue={u.cartValue} interests={u} />

            <div className="bg-tech-carbon p-3 rounded border border-tech-border/80">
              <div className="text-[9px] text-tech-muted font-mono uppercase tracking-wider mb-0.5">{pageLabel}</div>
              <div className="text-xs font-mono font-bold text-tech-yellow truncate">{u.page}</div>
              {u.pageTitle && <div className="text-[10px] text-tech-muted truncate mt-0.5">{u.pageTitle}</div>}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-tech-muted">{u.os} · {u.browser}</span>
              <span className="inline-flex items-center gap-1 text-tech-yellow font-bold bg-tech-yellow/10 px-2.5 py-1 rounded border border-tech-yellow/20">
                {u.signals.pageviews} {u.signals.pageviews === 1 ? 'pág' : 'págs'} · Ver recorrido <Icons.ArrowRight size={12} />
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* VISTA ESCRITORIO */}
      <div
        tabIndex={0}
        role="region"
        aria-label={ariaLabel}
        className="hidden md:block overflow-x-auto max-h-[640px] focus:outline-none focus:ring-1 focus:ring-tech-yellow/50"
      >
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border shadow-sm">
            <tr>
              <th className="px-4 py-3.5">Prioridad</th>
              <th className="px-4 py-3.5">Visitante</th>
              <th className="px-4 py-3.5">Qué ha hecho</th>
              <th className="px-4 py-3.5">{pageLabel}</th>
              <th className="px-4 py-3.5">Origen</th>
              <th className="px-4 py-3.5">Actividad</th>
              <th className="px-4 py-3.5 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-tech-border">
            {items.map((u) => (
              <tr
                key={u.sessionId}
                onClick={() => onSelect(u.sessionId)}
                className={`hover:bg-[#1a1b1e] cursor-pointer transition-colors ${TIER_META[u.tier].row} ${rowBg(u)}`}
              >
                <td className="px-4 py-3.5 whitespace-nowrap align-top">
                  <div className="flex flex-col gap-1.5 items-start">
                    <TierBadge tier={u.tier} />
                    <span className="text-[11px] font-mono text-tech-text">
                      <strong className="text-sm">{u.signals.pageviews}</strong> {u.signals.pageviews === 1 ? 'página' : 'páginas'}
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3.5 align-top whitespace-nowrap">
                  <div className="flex items-start gap-1.5">
                    <Icons.MapPin className="w-3.5 h-3.5 text-tech-yellow flex-shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-mono font-medium text-tech-text">{u.city}</span>
                      <span className="text-[10px] text-tech-muted font-mono">{u.region ? `${u.region}, ` : ''}{u.country}</span>
                      <span className="flex items-center gap-1.5 text-[10px] text-tech-muted font-mono mt-1">
                        <DeviceIcon device={u.device} /> {u.os} · {u.browser}
                      </span>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3.5 align-top min-w-[220px]">
                  <SignalChips signals={u.signals} cartValue={u.cartValue} interests={u} />
                </td>

                <td className="px-4 py-3.5 align-top">
                  <div className="flex flex-col gap-0.5 max-w-xs">
                    <a
                      href={`https://escapesymas.com${u.page}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-mono text-tech-yellow hover:underline truncate flex items-center gap-1"
                      title={u.page}
                    >
                      <span className="truncate">{u.page}</span>
                      <Icons.ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
                    </a>
                    {u.pageTitle && <span className="text-[10px] text-tech-muted truncate" title={u.pageTitle}>{u.pageTitle}</span>}
                    {u.entryPage && u.entryPage !== u.page && (
                      <span className="text-[10px] text-tech-muted font-mono truncate" title={`Entró por ${u.entryPage}`}>Entró por {u.entryPage}</span>
                    )}
                  </div>
                </td>

                <td className="px-4 py-3.5 whitespace-nowrap align-top"><ReferrerBadge referrer={u.referrer} /></td>

                <td className="px-4 py-3.5 whitespace-nowrap align-top">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusDot(u.secondsAgo)}`} />
                    <span className={`text-[11px] font-mono ${statusText(u.secondsAgo)}`}>{formatSecondsAgo(u.secondsAgo)}</span>
                  </div>
                </td>

                <td className="px-4 py-3.5 text-right whitespace-nowrap align-top">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(u.sessionId); }}
                    className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-tech-text hover:text-tech-yellow border border-tech-border hover:border-tech-yellow px-2.5 py-1 rounded transition-colors"
                  >
                    <span>Recorrido</span>
                    <Icons.ChevronRight size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
