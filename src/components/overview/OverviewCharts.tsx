import React, { useState } from 'react';
import { deltaOf, fmtValue } from '../../utils/overviewFormat';
import type { OverviewFunnelStep } from '../../types/overview';

export interface BarPoint { label: string; value: number; /** Texto largo del tooltip («jueves 5 de noviembre»). */ title?: string }

/** Mínimo de «huecos» de la gráfica: con pocos días las barras no se estiran a todo lo ancho. */
const MIN_SLOTS = 14;

/**
 * Gráfica de barras (una por día) hecha con SVG propio: el área de barras se estira con el ancho, y los textos (máximo, fechas,
 * cifra al pasar el ratón) son HTML para que no se deformen. Con menos de 2 puntos no se dibuja: no hay serie que ver.
 */
export const BarChart: React.FC<{
  data: BarPoint[];
  format: (v: number) => string;
  colorClass: string;
  ariaLabel: string;
  height?: number;
}> = ({ data, format, colorClass, ariaLabel, height = 130 }) => {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) {
    return <div className="flex items-center justify-center text-[11px] text-tech-muted font-mono" style={{ height }}>Un solo día: no hay serie por día.</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 0);
  const slots = Math.max(data.length, MIN_SLOTS);
  const offset = (slots - data.length) / 2;
  const W = slots * 10;
  const mid = data[Math.floor(data.length / 2)].label;

  return (
    <div role="img" aria-label={ariaLabel} className="select-none">
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
          {[0, 50, 100].map((y) => (
            <line key={y} x1={0} x2={W} y1={y} y2={y} stroke="currentColor" className="text-tech-border" strokeWidth={1} strokeDasharray={y === 100 ? undefined : '3 4'} vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = max > 0 ? Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * 96) : 0;
            const x = (offset + i) * 10;
            return (
              <g key={i}>
                {hover === i && <rect x={x} y={0} width={10} height={100} className="fill-white/5" />}
                <rect x={x + 1.5} y={100 - h} width={7} height={h} className={`${colorClass} ${hover === i ? 'opacity-100' : 'opacity-80'}`} />
                <rect x={x} y={0} width={10} height={100} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {max > 0 && <span className="absolute left-0 -top-0.5 text-[9px] font-mono text-tech-muted bg-tech-card/80 pr-1">{format(max)}</span>}
        {hover !== null && (
          <div
            className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full bg-tech-carbon border border-tech-border rounded px-2 py-1 shadow-xl whitespace-nowrap"
            style={{ left: `${((offset + hover + 0.5) / slots) * 100}%`, top: 0 }}
          >
            <div className="text-[9px] text-tech-muted font-mono capitalize">{data[hover].title || data[hover].label}</div>
            <div className="text-[11px] text-tech-text font-mono font-bold">{format(data[hover].value)}</div>
          </div>
        )}
      </div>
      <div className="flex justify-between text-[9px] font-mono text-tech-muted mt-1">
        <span>{data[0].label}</span>
        {data.length > 2 && <span>{mid}</span>}
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
};

/** Embudo: barras horizontales con el % que pasa de un paso al siguiente y la cifra del periodo anterior. */
export const FunnelChart: React.FC<{ steps: OverviewFunnelStep[] }> = ({ steps }) => {
  const max = Math.max(...steps.map((s) => s.current), 1);
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const prevStep = i > 0 ? steps[i - 1].current : 0;
        const conv = i > 0 && prevStep > 0 ? (s.current / prevStep) * 100 : null;
        const d = deltaOf({ value: s.current, prev: s.previous, unit: 'int', good: 'up' });
        return (
          <div key={s.key}>
            <div className="flex items-baseline justify-between gap-2 text-[11px] font-mono mb-1">
              <span className="text-tech-text">{s.label}</span>
              <span className="flex items-baseline gap-2">
                {conv !== null && <span className="text-tech-muted text-[10px]">{fmtValue(conv, 'pct')} del paso anterior</span>}
                <strong className="text-tech-text text-sm">{fmtValue(s.current, 'int')}</strong>
              </span>
            </div>
            <div className="h-2.5 bg-tech-carbon border border-tech-border/60 rounded-sm overflow-hidden">
              <div className="h-full bg-tech-yellow/80" style={{ width: `${Math.max(1.5, (s.current / max) * 100)}%` }} />
            </div>
            <div className="text-[9px] font-mono text-tech-muted mt-0.5">
              Periodo anterior: {fmtValue(s.previous, 'int')}{d.text && d.dir !== 'flat' ? ` (${d.text})` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
};
