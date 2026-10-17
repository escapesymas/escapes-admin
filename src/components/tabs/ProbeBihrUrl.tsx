import React, { useState } from 'react';
import * as Icons from 'lucide-react';

interface ProbeResult {
  variant: string;
  status?: number;
  contentType?: string;
  bytes?: number;
  truncated?: boolean;
  isImage?: boolean;
  headers?: Record<string, string>;
  bodyStart?: string;
  error?: string;
}

interface Props { adminToken: string }

/** Pega un enlace de foto de Bihr y mira qué contesta el CDN al servidor según cómo se la pida. */
const ProbeBihrUrl: React.FC<Props> = ({ adminToken }) => {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [out, setOut] = useState<{ url: string; results: ProbeResult[] } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setOut(null);
    try {
      const r = await fetch('/api/admin/catalog/probe-image-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.error || `HTTP ${r.status}`);
      setOut(body);
    } catch (e: any) {
      setError(e?.message || 'No se pudo hacer la prueba');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="bg-tech-card border border-tech-border rounded-2xl p-5">
      <summary className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-tech-text flex items-center gap-2">
        <Icons.FlaskConical size={14} className="text-tech-yellow" /> Probar un enlace de foto de Bihr desde el servidor
      </summary>
      <div className="mt-4 space-y-3">
        <p className="text-[11px] text-tech-muted leading-relaxed max-w-3xl">
          Pega un enlace de foto de Bihr que sí se vea en tu navegador (<span className="font-mono">api.mybihr.com/medias/…</span>). El servidor lo pide de cuatro formas distintas y te dice qué contesta Bihr a cada una.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://api.mybihr.com/medias/…"
            aria-label="Enlace de la foto de Bihr"
            className="flex-1 min-w-0 bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-xs text-tech-text font-mono outline-none focus:border-tech-yellow"
          />
          <button
            onClick={run}
            disabled={busy || !url.trim()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-tech-yellow text-black hover:bg-yellow-500 transition-all disabled:opacity-40"
          >
            {busy ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Play size={14} />} Probar
          </button>
        </div>
        {error && <div className="bg-red-950/20 border border-red-900/30 text-red-400 rounded-xl px-4 py-3 text-xs">{error}</div>}
        {out && (
          <div className="space-y-2">
            <div className="text-[10px] text-tech-muted font-mono break-all">{out.url}</div>
            {out.results.map(r => {
              const ok = r.status === 200 && r.isImage;
              return (
                <div key={r.variant} className={`rounded-xl border px-4 py-3 text-[11px] ${ok ? 'border-green-900/40 bg-green-950/10' : 'border-tech-border bg-[#1a1b1e]'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-black text-tech-text">{r.variant}</span>
                    {r.error
                      ? <span className="text-red-400">Error: {r.error}</span>
                      : <span className={ok ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {ok ? 'Foto recibida' : `HTTP ${r.status}`}{r.contentType ? ` · ${r.contentType}` : ''}{r.bytes !== undefined ? ` · ${r.bytes.toLocaleString('es-ES')} bytes${r.truncated ? '+' : ''}` : ''}
                        </span>}
                  </div>
                  {r.headers && Object.keys(r.headers).length > 0 && (
                    <div className="mt-1 text-tech-muted font-mono break-all">{Object.entries(r.headers).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
                  )}
                  {r.bodyStart && <div className="mt-1 text-tech-muted font-mono break-all">«{r.bodyStart}»</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
};

export default ProbeBihrUrl;
