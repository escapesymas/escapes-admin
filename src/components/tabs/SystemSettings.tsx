import React from 'react';
import * as Icons from 'lucide-react';

interface VpsStats {
  cores: number;
  cpu: number;
  ramUsed: string;
  ramTotal: string;
  ramPercent: number;
  disk: { used: string; total: string; percent: string };
  imageStats?: {
    regenerating: boolean;
    status: string;
    regenProcessed: number;
    regenSuccess: number;
    optimized: number;
    total: number;
    regenCurrentSku?: string;
  };
  os: string;
  uptime: string;
}

/** Barra de uso (CPU, memoria, disco): amarilla, y roja cuando pasa del 90 %. */
const UsageBar: React.FC<{ label: string; percentText: string; percent: number }> = ({ label, percentText, percent }) => {
  const hot = percent >= 90;
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-2 text-tech-muted">
        <span>{label}</span>
        <span className={hot ? 'text-red-400 font-bold' : 'text-tech-yellow'}>{percentText}</span>
      </div>
      <div className="w-full bg-tech-carbon h-1.5 rounded-sm overflow-hidden border border-tech-border/50">
        <div className={`${hot ? 'bg-red-500' : 'bg-tech-yellow'} h-full transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  );
};

/** Ajustes del sistema: estado del servidor (VPS) y del procesador de imágenes. Antes vivía en la Vista general. */
export const SystemSettings: React.FC<{ adminToken: string }> = ({ adminToken }) => {
  const [vps, setVps] = React.useState<VpsStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/admin?action=dashboard-stats', { headers: { Authorization: `Bearer ${adminToken}` } });
        if (!res.ok) { if (alive) setError('No se pudo leer el estado del servidor.'); return; }
        const data = await res.json();
        if (alive) { setVps(data && !data.error ? data.vps || null : null); setError(null); }
      } catch (err) {
        console.error('[FETCH SYSTEM STATS ERROR]:', err);
        if (alive) setError('No se pudo leer el estado del servidor.');
      }
    };
    load();
    const interval = setInterval(() => { if (!document.hidden) load(); }, 15000);
    return () => { alive = false; clearInterval(interval); };
  }, [adminToken]);

  if (!vps) {
    return (
      <div className="flex items-center justify-center h-48 text-tech-muted text-xs font-mono">
        {error ? <><Icons.AlertCircle size={16} className="mr-2 text-red-400" /> {error}</> : <><Icons.Loader2 size={20} className="animate-spin mr-3" /> Leyendo el estado del servidor...</>}
      </div>
    );
  }

  const img = vps.imageStats;
  const diskPct = parseFloat(String(vps.disk.percent)) || 0;

  return (
    <div className="bg-tech-card border border-tech-border rounded-md p-6 shadow-xl animate-fade-in">
      <h2 className="text-sm font-mono uppercase tracking-wider mb-6 flex items-center gap-2 text-tech-text border-b border-tech-border pb-4">
        <Icons.Cpu className="text-tech-yellow w-4 h-4" /> Telemetría del Servidor (VPS)
      </h2>

      <div className="space-y-6">
        <UsageBar label={`Uso de CPU (${vps.cores} Cores)`} percentText={`${vps.cpu}%`} percent={vps.cpu} />
        <UsageBar label={`Memoria RAM (${vps.ramUsed} / ${vps.ramTotal})`} percentText={`${vps.ramPercent}%`} percent={vps.ramPercent} />
        <UsageBar label={`Almacenamiento SSD (${vps.disk.used} / ${vps.disk.total})`} percentText={String(vps.disk.percent).endsWith('%') ? String(vps.disk.percent) : `${vps.disk.percent}%`} percent={diskPct} />

        {img && (
          <div className="pt-6 border-t border-tech-border border-dashed">
            <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-4 text-tech-text">
              <span className="flex items-center gap-2"><Icons.Image className="w-3 h-3 text-tech-muted" /> Procesador de Imágenes WebP</span>
              <span className={img.regenerating ? 'text-green-500 flex items-center gap-1' : 'text-tech-muted'}>
                {img.regenerating && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                {img.status}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Procesados', value: img.regenProcessed, cls: 'text-tech-text' },
                { label: 'Éxitos', value: img.regenSuccess, cls: 'text-green-500' },
                { label: 'Optimizadas', value: img.optimized, cls: 'text-tech-yellow' },
                { label: 'Total DB', value: img.total, cls: 'text-tech-text' },
              ].map((c) => (
                <div key={c.label} className="bg-tech-carbon border border-tech-border p-3 rounded-md flex flex-col gap-1 items-center justify-center">
                  <span className="text-[9px] text-tech-muted font-mono uppercase tracking-widest">{c.label}</span>
                  <div className={`${c.cls} font-mono font-bold text-lg`}>{c.value}</div>
                </div>
              ))}
            </div>
            {img.regenerating && img.regenCurrentSku && (
              <div className="mt-4 p-2 bg-[#1a1b1e] border border-[#2a2b2e] rounded-sm text-[10px] text-tech-yellow font-mono truncate flex items-center gap-2">
                <Icons.Terminal className="w-3 h-3" /> Procesando SKU: {img.regenCurrentSku}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t border-tech-border flex flex-wrap justify-between gap-2 text-[10px] text-tech-muted font-mono uppercase tracking-widest">
        <span>SO: <strong className="text-tech-text font-normal">{vps.os}</strong></span>
        <span>Uptime: <strong className="text-tech-text font-normal">{vps.uptime}</strong></span>
      </div>
    </div>
  );
};
