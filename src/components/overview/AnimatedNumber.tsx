import React, { useEffect, useRef, useState } from 'react';

const reduced = (): boolean => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Cifra que cuenta hasta su valor: al aparecer sube desde 0 y, cuando el valor cambia (otro periodo, refresco), pasa del que se
 * veía al nuevo. Quien pide menos movimiento ve el valor directamente. El formato lo decide quien lo usa (euros, %, enteros).
 */
export const AnimatedNumber: React.FC<{ value: number; format: (v: number) => string; duration?: number }> = ({ value, format, duration = 750 }) => {
  const [shown, setShown] = useState(() => (reduced() ? value : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (reduced() || !Number.isFinite(value)) { from.current = value; setShown(value); return; }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // empieza rápido y frena al llegar
      const v = origin + (value - origin) * eased;
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular-nums" aria-label={format(value)}>{format(shown)}</span>;
};
