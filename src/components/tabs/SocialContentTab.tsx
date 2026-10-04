import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';
import type { ChatProductCard } from '../chat/ProductPicker';

interface ContentSlot {
  id: number;
  scheduled_at: string;
  format: 'video' | 'photo' | 'carousel';
  topic: string | null;
  product_sku: string | null;
  product_name?: string | null;
  product_brand?: string | null;
  product_image?: string | null;
  copy: string | null;
  hashtags: string | null;
  script: string | null;
  media_urls: string[];
  status: 'draft' | 'generating' | 'ready' | 'published' | 'skipped';
  error: string | null;
}

interface SocialContentTabProps {
  adminToken: string;
  initialSlotId?: number | null;
}

const FORMAT_LABEL: Record<string, string> = { video: 'Vídeo', photo: 'Foto', carousel: 'Carrusel' };
const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: 'Borrador', className: 'bg-zinc-800 text-zinc-300' },
  generating: { label: 'Generando…', className: 'bg-blue-950/50 text-blue-400' },
  ready: { label: 'Listo para publicar', className: 'bg-emerald-950/50 text-emerald-400' },
  published: { label: 'Publicado', className: 'bg-tech-yellow/10 text-tech-yellow' },
  skipped: { label: 'Omitido', className: 'bg-zinc-800 text-zinc-500' },
};

/** Fecha para <input type="datetime-local"> en la hora del navegador. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const inputClass = 'w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text';
const labelClass = 'text-[10px] uppercase font-black tracking-widest text-tech-muted mb-1 block';

/** Buscador de productos del catálogo (mismo buscador que el chat). */
const ProductSearch: React.FC<{ adminToken: string; onPick: (p: ChatProductCard) => void }> = ({ adminToken, onPick }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ChatProductCard[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`/api/admin/chat-products?q=${encodeURIComponent(q.trim())}`, { headers: { Authorization: `Bearer ${adminToken}` } })
        .then((r) => (r.ok ? r.json() : { products: [] }))
        .then((d) => setResults(d.products || []))
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q, adminToken]);
  return (
    <div className="space-y-1">
      <div className="relative">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto por nombre, marca o referencia…" className={inputClass} />
        {busy && <Icons.Loader2 className="w-4 h-4 animate-spin absolute right-3 top-2.5 text-tech-muted" />}
      </div>
      {results.length > 0 && (
        <div className="max-h-60 overflow-y-auto border border-tech-border rounded-lg divide-y divide-tech-border">
          {results.map((p) => (
            <button key={p.id} onClick={() => { onPick(p); setQ(''); setResults([]); }}
              className="w-full flex items-center gap-2 p-2 text-left hover:bg-tech-border/30">
              {p.image ? <img src={p.image} alt="" className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 rounded bg-tech-border" />}
              <span className="flex-1 min-w-0">
                <span className="block text-xs text-tech-text truncate">{p.name}</span>
                <span className="block text-[10px] text-tech-muted">{p.brand} · {p.sku} · {formatPrice(p.sale_price ?? p.price)} · {p.in_stock ? 'en stock' : 'sin stock'}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Ajustes y contenido de una publicación (al desplegarla). */
const SlotEditor: React.FC<{
  slot: ContentSlot;
  adminToken: string;
  onChanged: () => void;
}> = ({ slot, adminToken, onChanged }) => {
  const { showToast } = useToast();
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const [when, setWhen] = useState(toLocalInput(slot.scheduled_at));
  const [format, setFormat] = useState(slot.format);
  const [topic, setTopic] = useState(slot.topic || '');
  const [product, setProduct] = useState<{ sku: string; name: string; image: string | null } | null>(
    slot.product_sku ? { sku: slot.product_sku, name: slot.product_name || slot.product_sku, image: slot.product_image || null } : null);
  const [copy, setCopy] = useState(slot.copy || '');
  const [hashtags, setHashtags] = useState(slot.hashtags || '');
  const [script, setScript] = useState(slot.script || '');
  const [saving, setSaving] = useState(false);

  // Al terminar de generar llega contenido nuevo: se refleja en los campos.
  useEffect(() => { setCopy(slot.copy || ''); setHashtags(slot.hashtags || ''); setScript(slot.script || ''); }, [slot.copy, slot.hashtags, slot.script]);
  useEffect(() => {
    setProduct(slot.product_sku ? { sku: slot.product_sku, name: slot.product_name || slot.product_sku, image: slot.product_image || null } : null);
  }, [slot.product_sku, slot.product_name, slot.product_image]);

  const generating = slot.status === 'generating';
  const settingsDirty = when !== toLocalInput(slot.scheduled_at) || format !== slot.format
    || topic !== (slot.topic || '') || (product?.sku || null) !== (slot.product_sku || null);
  const textDirty = copy !== (slot.copy || '') || hashtags !== (slot.hashtags || '') || script !== (slot.script || '');

  const patch = async (body: Record<string, unknown>, ok: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/social-content/${slot.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo guardar', 'error'); return false; }
      showToast(ok, 'success');
      onChanged();
      return true;
    } catch {
      showToast('Error de conexión', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = () => patch({
    scheduledAt: new Date(when).toISOString(), format, topic, productSku: product?.sku || null,
  }, 'Publicación actualizada');

  const generate = async () => {
    // Guarda antes los ajustes cambiados para que la IA los use.
    if (settingsDirty && !(await saveSettings())) return;
    try {
      const res = await fetch(`/api/social-content/${slot.id}/generate`, { method: 'POST', headers });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo generar', 'error'); return; }
      showToast('Generando contenido… tarda 1-2 minutos', 'success');
      onChanged();
    } catch {
      showToast('Error de conexión al generar', 'error');
    }
  };

  const action = async (path: string, method: string, ok: string) => {
    try {
      const res = await fetch(`/api/social-content/${slot.id}${path}`, { method, headers });
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || 'No se pudo completar', 'error'); return; }
      showToast(ok, 'success');
      onChanged();
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard?.writeText(value);
    showToast('Copiado al portapapeles', 'success');
  };

  const hasContent = !!(slot.copy || slot.media_urls?.length);

  return (
    <div className="px-5 pb-5 border-t border-tech-border/50 pt-4 space-y-4">
      {slot.error && (
        <div className={`rounded-lg p-3 text-xs border ${slot.status === 'ready' ? 'bg-amber-950/30 border-amber-800/50 text-amber-400' : 'bg-red-950/30 border-red-800/50 text-red-400'}`}>
          {slot.error}
        </div>
      )}

      {/* Ajustes: cuándo, formato, producto y enfoque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Fecha y hora</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} disabled={generating} />
        </div>
        <div>
          <label className={labelClass}>Formato</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as ContentSlot['format'])} className={inputClass} disabled={generating}>
            <option value="video">Vídeo (guion + imágenes de apoyo)</option>
            <option value="photo">Foto</option>
            <option value="carousel">Carrusel (hasta 4 imágenes)</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Producto</label>
          {product ? (
            <div className="flex items-center gap-2 bg-tech-carbon border border-tech-border rounded-lg p-2">
              {product.image ? <img src={product.image} alt="" className="w-10 h-10 object-cover rounded" /> : <Icons.Package className="w-5 h-5 text-tech-muted" />}
              <span className="flex-1 min-w-0 text-xs text-tech-text truncate">{product.name} <span className="text-tech-muted">· {product.sku}</span></span>
              {!generating && <button onClick={() => setProduct(null)} className="text-tech-muted hover:text-red-400" aria-label="Quitar producto"><Icons.X size={14} /></button>}
            </div>
          ) : (
            <>
              {!generating && <ProductSearch adminToken={adminToken} onPick={(p) => setProduct({ sku: p.sku, name: p.name, image: p.image })} />}
              <p className="text-[10px] text-tech-muted mt-1">Si no eliges ninguno, la IA usa un producto con stock de IXIL, BELL o RST que no se haya publicado en los últimos 60 días.</p>
            </>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Enfoque (opcional)</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} disabled={generating}
            placeholder="Ej.: sonido del escape al arrancar, comparativa con el de serie, look de invierno…" className={inputClass} />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {settingsDirty && !generating && (
          <button onClick={saveSettings} disabled={saving}
            className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Icons.Save size={13} /> Guardar cambios
          </button>
        )}
        {slot.status !== 'published' && (
          <button onClick={generate} disabled={generating || saving}
            className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-4 py-2 rounded-lg text-xs font-black uppercase italic tracking-wider flex items-center gap-2">
            {generating ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : hasContent ? <Icons.RefreshCw size={13} /> : <Icons.Sparkles size={14} />}
            {generating ? 'Generando… (1-2 min)' : hasContent ? 'Regenerar con IA' : 'Generar con IA'}
          </button>
        )}
      </div>

      {/* Contenido generado */}
      {hasContent && !generating && (
        <div className="space-y-4 border-t border-tech-border/30 pt-4">
          {!!slot.media_urls?.length && (
            <div>
              <label className={labelClass}>Imágenes</label>
              <div className="flex gap-2 flex-wrap">
                {slot.media_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" download className="relative group">
                    <img src={url} alt={`Imagen ${i + 1}`} className="w-28 h-28 object-cover rounded-lg border border-tech-border" />
                    <span className="absolute bottom-1 right-1 bg-black/70 rounded p-1 text-white opacity-80 group-hover:opacity-100"><Icons.Download size={12} /></span>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>Texto de la publicación</label>
              <button onClick={() => copyToClipboard(`${copy}\n\n${hashtags}`.trim())} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1"><Icons.Copy size={11} /> Copiar texto + hashtags</button>
            </div>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={4} className={`${inputClass} resize-y`} />
          </div>
          <div>
            <label className={labelClass}>Hashtags</label>
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} className={`${inputClass} text-tech-yellow`} />
          </div>
          <div>
            <label className={labelClass}>Guion</label>
            <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={6} className={`${inputClass} text-xs resize-y`} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {textDirty && (
              <button onClick={() => patch({ copy, hashtags, script }, 'Texto guardado')} disabled={saving}
                className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                <Icons.Save size={13} /> Guardar texto
              </button>
            )}
            {slot.status !== 'published' && (
              <button onClick={() => action('/published', 'POST', 'Marcado como publicado')}
                className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
                <Icons.Check size={13} /> Marcar publicado
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-4 pt-2 border-t border-tech-border/30">
        {(slot.status === 'draft' || slot.status === 'ready') && (
          <button onClick={() => patch({ status: 'skipped' }, 'Publicación omitida')} className="text-tech-muted hover:text-tech-text text-xs font-bold flex items-center gap-1">
            <Icons.SkipForward size={12} /> Omitir
          </button>
        )}
        {slot.status === 'skipped' && (
          <button onClick={() => patch({ status: hasContent ? 'ready' : 'draft' }, 'Publicación recuperada')} className="text-tech-muted hover:text-tech-text text-xs font-bold flex items-center gap-1">
            <Icons.Undo2 size={12} /> Recuperar
          </button>
        )}
        <button
          onClick={() => { if (window.confirm('¿Eliminar esta publicación del calendario?')) action('', 'DELETE', 'Publicación eliminada'); }}
          className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1">
          <Icons.Trash2 size={12} /> Eliminar
        </button>
      </div>
    </div>
  );
};

const SocialContentTab: React.FC<SocialContentTabProps> = ({ adminToken, initialSlotId }) => {
  const { showToast } = useToast();
  const [slots, setSlots] = useState<ContentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(initialSlotId || null);
  const [autoScheduling, setAutoScheduling] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newWhen, setNewWhen] = useState('');
  const [newFormat, setNewFormat] = useState<ContentSlot['format']>('video');
  const slotsRef = useRef<ContentSlot[]>([]);

  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' });

  const fetchSlots = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const res = await fetch(`/api/social-content?from=${from.toISOString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSlots(data.items || []);
        slotsRef.current = data.items || [];
      } else if (!silent) {
        showToast('Error al cargar el calendario de contenido', 'error');
      }
    } catch (err) {
      if (!silent) showToast('Error de conexión al cargar el calendario', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  // Mientras algo se está generando, se consulta cada 4 s hasta que termine.
  const anyGenerating = slots.some((s) => s.status === 'generating');
  useEffect(() => {
    if (!anyGenerating) return;
    const t = setInterval(() => {
      const before = slotsRef.current.filter((s) => s.status === 'generating').map((s) => s.id);
      fetchSlots(true).then(() => {
        for (const id of before) {
          const s = slotsRef.current.find((x) => x.id === id);
          if (s?.status === 'ready') showToast('Contenido generado', 'success');
          else if (s?.status === 'draft' && s.error) showToast('No se pudo generar el contenido', 'error');
        }
      });
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyGenerating, fetchSlots]);

  const handleAutoSchedule = async () => {
    setAutoScheduling(true);
    try {
      const res = await fetch('/api/social-content/auto-schedule', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ days: 7 }) });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.created?.length || 0} huecos nuevos añadidos al calendario`, 'success');
        fetchSlots(true);
      } else {
        showToast(data.error || 'No se pudo generar el calendario', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleCreate = async () => {
    if (!newWhen) return;
    try {
      const res = await fetch('/api/social-content', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ scheduledAt: new Date(newWhen).toISOString(), format: newFormat }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'No se pudo crear', 'error'); return; }
      setShowNew(false);
      setNewWhen('');
      setExpandedId(data.slot?.id || null);
      fetchSlots(true);
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-tech-muted"><Icons.Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  // Agrupado por día para leerlo como un calendario.
  const groups: { day: string; items: ContentSlot[] }[] = [];
  for (const slot of slots) {
    const day = new Date(slot.scheduled_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(slot); else groups.push({ day, items: [slot] });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 flex-wrap">
        <button onClick={() => setShowNew((v) => !v)}
          className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <Icons.Plus size={14} /> Nueva publicación
        </button>
        <button
          onClick={handleAutoSchedule}
          disabled={autoScheduling}
          className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
        >
          {autoScheduling ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CalendarPlus size={14} />}
          Rellenar próximos 7 días
        </button>
      </div>

      {showNew && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <label className={labelClass}>Fecha y hora</label>
            <input type="datetime-local" value={newWhen} onChange={(e) => setNewWhen(e.target.value)} className={inputClass} />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Formato</label>
            <select value={newFormat} onChange={(e) => setNewFormat(e.target.value as ContentSlot['format'])} className={inputClass}>
              <option value="video">Vídeo</option>
              <option value="photo">Foto</option>
              <option value="carousel">Carrusel</option>
            </select>
          </div>
          <button onClick={handleCreate} disabled={!newWhen}
            className="bg-tech-yellow text-tech-text px-4 py-2.5 rounded-lg text-xs font-black uppercase disabled:opacity-40">Crear</button>
        </div>
      )}

      {!slots.length && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-10 text-center text-tech-muted text-sm">
          No hay nada programado. Pulsa "Rellenar próximos 7 días" para crear los huecos recomendados.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.day} className="space-y-2">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-tech-muted first-letter:uppercase">{g.day}</h3>
          {g.items.map((slot) => {
            const status = STATUS_LABEL[slot.status] || STATUS_LABEL.draft;
            const expanded = expandedId === slot.id;
            const date = new Date(slot.scheduled_at);
            return (
              <div key={slot.id} className={`bg-tech-card border rounded-xl overflow-hidden ${expanded ? 'border-tech-yellow/40' : 'border-tech-border'} ${slot.status === 'skipped' ? 'opacity-60' : ''}`}>
                <button
                  onClick={() => setExpandedId(expanded ? null : slot.id)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-tech-border/20 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-lg font-black text-tech-text w-14 shrink-0">{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                    {(slot.media_urls?.[0] || slot.product_image)
                      ? <img src={slot.media_urls?.[0] || slot.product_image || ''} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                      : <div className="w-10 h-10 rounded bg-tech-border/50 shrink-0 grid place-items-center"><Icons.Image size={14} className="text-tech-muted" /></div>}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-tech-text">{FORMAT_LABEL[slot.format] || slot.format}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status.className}`}>{status.label}</span>
                        {slot.error && slot.status === 'draft' && <Icons.AlertTriangle size={12} className="text-red-400" />}
                      </div>
                      <p className="text-xs text-tech-muted truncate mt-0.5">
                        {slot.product_name || slot.topic || 'Producto automático (IXIL, BELL o RST)'}
                      </p>
                    </div>
                  </div>
                  <Icons.ChevronDown className={`w-4 h-4 shrink-0 text-tech-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && <SlotEditor key={slot.id} slot={slot} adminToken={adminToken} onChanged={() => fetchSlots(true)} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default SocialContentTab;
