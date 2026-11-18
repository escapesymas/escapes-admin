import React from 'react';
import * as Icons from 'lucide-react';
import { deltaOf, fmtValue, type Delta } from '../../utils/overviewFormat';
import type { OverviewKpi, OverviewPreset } from '../../types/overview';

const SENTIMENT_CLS: Record<Delta['sentiment'], string> = {
  good: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25',
  bad: 'text-red-400 bg-red-500/10 border-red-500/25',
  neutral: 'text-tech-muted bg-tech-carbon border-tech-border',
};

/** Variación respecto al periodo anterior: flecha, texto y color según sea bueno o malo para el negocio. */
export const DeltaChip: React.FC<{ kpi: Pick<OverviewKpi, 'value' | 'prev' | 'unit' | 'good'> }> = ({ kpi }) => {
  const d = deltaOf(kpi);
  if (d.dir === 'none') return <span className="text-[9px] font-mono text-tech-muted uppercase tracking-wider">Foto del momento</span>;
  const Icon = d.dir === 'up' || d.dir === 'new' ? Icons.ArrowUpRight : d.dir === 'down' ? Icons.ArrowDownRight : Icons.Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${SENTIMENT_CLS[d.sentiment]}`}>
      <Icon className="w-3 h-3" aria-hidden /> {d.dir === 'flat' ? 'igual' : d.text}
    </span>
  );
};

/** Indicador: nombre, cifra grande, variación y cifra del periodo anterior. */
export const KpiTile: React.FC<{ kpi: OverviewKpi; big?: boolean }> = ({ kpi, big }) => (
  <div
    title={kpi.hint}
    className={`bg-tech-card border border-tech-border rounded-md ${big ? 'p-4' : 'p-3.5'} flex flex-col justify-between gap-2 hover:border-tech-yellow/40 transition-colors min-w-0`}
  >
    <div className="text-[10px] text-tech-muted font-mono uppercase tracking-widest leading-snug">{kpi.label}</div>
    <div className={`${big ? 'text-2xl' : 'text-xl'} font-mono font-bold text-tech-text truncate`}>{fmtValue(kpi.value, kpi.unit)}</div>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-h-[20px]">
      <DeltaChip kpi={kpi} />
      {kpi.prev != null && <span className="text-[10px] font-mono text-tech-muted">antes {fmtValue(kpi.prev, kpi.unit)}</span>}
    </div>
  </div>
);

/** Lista ordenada con barra proporcional (páginas más vistas, orígenes, búsquedas…). */
export const RankList: React.FC<{
  title: string;
  icon: React.ElementType;
  rows: { label: string; sub?: string; value: number; valueText?: string }[];
  empty: string;
  valueHeader?: string;
}> = ({ title, icon: Icon, rows, empty, valueHeader }) => {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="bg-tech-card border border-tech-border rounded-md p-4 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-tech-text flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-tech-yellow" /> {title}</h3>
        {valueHeader && <span className="text-[9px] font-mono uppercase tracking-wider text-tech-muted">{valueHeader}</span>}
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-tech-muted font-mono py-3">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-[11px] font-mono">
                <span className="text-tech-text truncate" title={r.sub ? `${r.label} · ${r.sub}` : r.label}>{r.label}</span>
                <span className="text-tech-yellow font-bold shrink-0">{r.valueText ?? r.value}</span>
              </div>
              {r.sub && <div className="text-[9px] text-tech-muted truncate">{r.sub}</div>}
              <div className="h-1 bg-tech-carbon rounded-sm mt-1 overflow-hidden"><div className="h-full bg-tech-yellow/50" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ───────────── Texto en Markdown sencillo (el de la IA) sin usar HTML crudo ───────────── */

const inline = (text: string): React.ReactNode[] =>
  text.split('**').map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-tech-text font-bold">{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));

/** Títulos «##», listas con guiones o numeradas, negritas y párrafos. */
export const MarkdownLite: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className={`${list.ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-1.5 text-[12px] leading-relaxed text-tech-text/90 marker:text-tech-yellow`}>
        {list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}
      </Tag>,
    );
    list = null;
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      blocks.push(<h4 key={`h${blocks.length}`} className="text-[11px] font-mono font-bold uppercase tracking-widest text-tech-yellow pt-3 first:pt-0">{h[1].replace(/\*\*/g, '')}</h4>);
      continue;
    }
    const li = /^(?:[-*•]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (li) {
      const ordered = !!li[1];
      if (list && list.ordered !== ordered) flush();
      if (!list) list = { ordered, items: [] };
      list.items.push(li[2]);
      continue;
    }
    flush();
    blocks.push(<p key={`p${blocks.length}`} className="text-[12px] leading-relaxed text-tech-text/90">{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2.5">{blocks}</div>;
};

/* ───────────── Selector de periodo ───────────── */

export const PRESETS: { id: OverviewPreset; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: 'yesterday', label: 'Ayer' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'prev_month', label: 'Mes anterior' },
  { id: 'year', label: 'Este año' },
  { id: 'custom', label: 'Fechas…' },
];

export const PeriodPicker: React.FC<{
  preset: OverviewPreset;
  from: string;
  to: string;
  maxDate: string;
  onPreset: (p: OverviewPreset) => void;
  onDates: (from: string, to: string) => void;
}> = ({ preset, from, to, maxDate, onPreset, onDates }) => (
  <div className="flex flex-col gap-2 min-w-0 max-w-full">
    <div role="group" aria-label="Periodo del informe" className="flex items-center gap-1 bg-tech-carbon p-1 rounded-md border border-tech-border max-w-full overflow-x-auto">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreset(p.id)}
          aria-pressed={preset === p.id}
          className={`px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider transition-all whitespace-nowrap ${
            preset === p.id ? 'bg-tech-card text-tech-yellow border border-tech-border font-bold shadow-sm' : 'text-tech-muted hover:text-tech-text border border-transparent'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
    {preset === 'custom' && (
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-tech-muted">
        <label className="flex items-center gap-1.5">Desde
          <input type="date" value={from} max={to || maxDate} onChange={(e) => onDates(e.target.value, to)} className="bg-tech-carbon border border-tech-border rounded px-2 py-1 text-tech-text focus:border-tech-yellow focus:outline-none [color-scheme:dark]" />
        </label>
        <label className="flex items-center gap-1.5">Hasta
          <input type="date" value={to} min={from} max={maxDate} onChange={(e) => onDates(from, e.target.value)} className="bg-tech-carbon border border-tech-border rounded px-2 py-1 text-tech-text focus:border-tech-yellow focus:outline-none [color-scheme:dark]" />
        </label>
      </div>
    )}
  </div>
);
