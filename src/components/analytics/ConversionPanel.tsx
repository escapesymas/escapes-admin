import React from 'react';
import * as Icons from 'lucide-react';
import type { TermRow, VisitorInsights } from '../../types/analytics';
import { formatEuros } from '../../utils/format';

interface ConversionPanelProps {
  insights: VisitorInsights | null;
  loading: boolean;
  rangeLabel: string;
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);

const card = 'bg-tech-card border border-tech-border rounded-md shadow-xl p-4 sm:p-6';
const cardTitle = 'text-sm font-mono uppercase tracking-wider mb-4 flex items-center gap-2 text-tech-text border-b border-tech-border pb-3';

const TermList: React.FC<{ rows: TermRow[]; empty: string; tone: string }> = ({ rows, empty, tone }) => {
  if (!rows.length) return <p className="text-xs font-mono text-tech-muted py-4 text-center">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.term} className="text-xs font-mono">
          <div className="flex justify-between gap-3 mb-1">
            <span className="text-tech-text truncate" title={r.term}>{r.term}</span>
            <span className="text-tech-muted shrink-0">
              <strong className={tone}>{r.count}</strong> {r.count === 1 ? 'vez' : 'veces'}
              {r.sessions !== r.count ? ` · ${r.sessions} ${r.sessions === 1 ? 'persona' : 'personas'}` : ''}
            </span>
          </div>
          <div className="w-full bg-[#1a1b1e] h-1 rounded-sm overflow-hidden">
            <div className="h-full bg-current opacity-70" style={{ width: `${Math.round((r.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Embudo de conversión, eventos registrados y lo que buscan los visitantes (incluido lo que no encuentran). */
export const ConversionPanel: React.FC<ConversionPanelProps> = ({ insights, loading, rangeLabel }) => {
  if (!insights) {
    return loading
      ? <div className="py-16 flex justify-center"><Icons.Loader2 className="w-6 h-6 text-tech-yellow animate-spin" /></div>
      : <div className="py-12 text-center text-tech-muted text-xs font-mono">No se pudieron cargar los datos de conversión.</div>;
  }

  const { funnel, cartValue } = insights.summary;
  const steps = [
    { label: 'Visitantes', n: funnel.visitors, icon: Icons.Users, bar: 'bg-tech-yellow' },
    { label: 'Vieron una ficha de producto', n: funnel.productViews, icon: Icons.Package, bar: 'bg-blue-400' },
    { label: 'Añadieron al carrito', n: funnel.addToCart, icon: Icons.ShoppingCart, bar: 'bg-orange-400' },
    { label: 'Empezaron a pagar', n: funnel.checkout, icon: Icons.CreditCard, bar: 'bg-pink-400' },
    { label: 'Compraron', n: funnel.purchase, icon: Icons.BadgeCheck, bar: 'bg-emerald-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Embudo */}
      <div className={card}>
        <h3 className={cardTitle}>
          <Icons.TrendingUp className="w-4 h-4 text-tech-yellow" />
          Embudo de compra ({rangeLabel})
        </h3>
        <div className="space-y-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const ofVisitors = pct(s.n, funnel.visitors);
            const ofPrevious = i > 0 ? pct(s.n, steps[i - 1].n) : null;
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between gap-3 text-xs font-mono mb-1">
                  <span className="flex items-center gap-2 text-tech-text"><Icon className="w-3.5 h-3.5 text-tech-muted" /> {s.label}</span>
                  <span className="text-tech-muted">
                    <strong className="text-tech-text text-sm">{s.n}</strong>
                    <span className="ml-2">{ofVisitors}% de los visitantes</span>
                    {ofPrevious !== null && steps[i - 1].n > 0 && <span className="ml-2 hidden sm:inline">· {ofPrevious}% del paso anterior</span>}
                  </span>
                </div>
                <div className="w-full bg-tech-carbon h-2.5 rounded-sm overflow-hidden border border-tech-border/50">
                  <div className={`${s.bar} h-full transition-all duration-500`} style={{ width: `${Math.max(ofVisitors, s.n > 0 ? 1.5 : 0)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-tech-muted font-mono mt-4">
          {cartValue > 0
            ? <>Los visitantes de este periodo han dejado <strong className="text-tech-yellow">{formatEuros(cartValue)}</strong> en productos añadidos al carrito.</>
            : 'Nadie ha añadido productos al carrito en este periodo.'}
          {' '}Cada visitante cuenta una vez en cada paso; quien vuelve con un carrito de otro día puede aparecer en pago sin haber añadido nada hoy.
        </p>
      </div>

      {/* Eventos registrados */}
      <div className={`${card} !p-0 overflow-hidden`}>
        <div className="p-4 sm:p-6 pb-0"><h3 className={cardTitle}><Icons.MousePointerClick className="w-4 h-4 text-tech-yellow" /> Eventos registrados ({rangeLabel})</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-tech-carbon text-[9px] text-tech-muted font-mono uppercase tracking-widest border-b border-tech-border">
              <tr>
                <th className="px-4 sm:px-6 py-3">Evento</th>
                <th className="px-4 sm:px-6 py-3 text-right">Veces</th>
                <th className="px-4 sm:px-6 py-3 text-right">Visitantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tech-border">
              {insights.events.map((e) => (
                <tr key={e.name} className={e.important ? 'bg-orange-500/[0.04]' : ''}>
                  <td className="px-4 sm:px-6 py-2.5 text-xs font-mono">
                    <span className={e.important ? 'text-orange-300 font-bold' : 'text-tech-text'}>{e.label}</span>
                    <span className="text-[10px] text-tech-muted ml-2">{e.name}</span>
                  </td>
                  <td className="px-4 sm:px-6 py-2.5 text-right text-xs font-mono text-tech-yellow font-bold">{e.count}</td>
                  <td className="px-4 sm:px-6 py-2.5 text-right text-xs font-mono text-tech-text">{e.sessions}</td>
                </tr>
              ))}
              {insights.events.length === 0 && (
                <tr><td colSpan={3} className="px-6 py-10 text-center text-tech-muted text-xs font-mono">No hay eventos en este periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Búsquedas y motos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={card}>
          <h3 className={cardTitle}><Icons.Search className="w-4 h-4 text-fuchsia-300" /> Lo que buscan</h3>
          <div className="text-fuchsia-300"><TermList rows={insights.topSearches} tone="text-fuchsia-300" empty="Nadie ha usado el buscador en este periodo." /></div>
        </div>
        <div className={card}>
          <h3 className={cardTitle}><Icons.SearchX className="w-4 h-4 text-red-300" /> Buscan y no encuentran</h3>
          <p className="text-[11px] text-tech-muted font-mono -mt-2 mb-3">Demanda que hoy no cubrimos: candidatas a añadir al catálogo.</p>
          <div className="text-red-300"><TermList rows={insights.noResultSearches} tone="text-red-300" empty="Ninguna búsqueda sin resultados en este periodo." /></div>
        </div>
        <div className={card}>
          <h3 className={cardTitle}><Icons.Bike className="w-4 h-4 text-amber-300" /> Motos que eligen</h3>
          <div className="text-amber-300"><TermList rows={insights.topBikes} tone="text-amber-300" empty="Nadie ha elegido su moto en este periodo." /></div>
        </div>
      </div>
    </div>
  );
};
