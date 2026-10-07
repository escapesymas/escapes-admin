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
  image_prompt?: string | null;
  video_prompt?: string | null;
  final_media?: { url: string; type: 'image' | 'video'; name: string; original?: string }[];
  base_media?: string[];
  campaign?: boolean;
  ig_media?: string[];
  ig_copy?: string | null;
  ig_hashtags?: string | null;
  ig_status?: 'generating' | 'ready' | 'error' | null;
  ig_error?: string | null;
  slides?: { title: string; text: string; scene?: string; kind?: 'scene' | 'card' | 'price'; image?: string }[];
  video_status?: 'generating' | 'done' | 'error' | null;
  video_error?: string | null;
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

/** Prompts por defecto si la publicación se generó antes de que la IA los escribiera. */
const fallbackPrompts = (slot: ContentSlot) => {
  const what = slot.product_name || 'el producto de la foto';
  return {
    image: `Crea una foto vertical 9:16, realista y publicitaria, para TikTok con ${what} de la foto adjunta. `
      + `Escena de garaje o carretera de montaña con buena luz${slot.topic ? `, enfoque: ${slot.topic}` : ''}. `
      + 'Conserva exactamente la forma, los colores y los logotipos del producto. Sin texto.',
    video: `Vídeo vertical 9:16 de 8 segundos para TikTok a partir de la foto de ${what}. `
      + 'Plano de detalle que se abre a la moto en ambiente motero, movimiento de cámara suave, luz cálida y sonido ambiente realista. '
      + 'Sin texto en pantalla y sin cambiar el producto.',
  };
};

/**
 * Hacerlo con el plan Google AI Pro: prompts listos para la app de Gemini
 * (imagen) y Flow/Veo (vídeo), la foto real para adjuntar y la subida del
 * resultado final a la publicación.
 */
const ManualStudio: React.FC<{ slot: ContentSlot; adminToken: string; onChanged: () => void }> = ({ slot, adminToken, onChanged }) => {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const fallback = fallbackPrompts(slot);
  const imagePrompt = slot.image_prompt || fallback.image;
  const videoPrompt = slot.video_prompt || fallback.video;
  const photo = slot.product_image || slot.media_urls?.find((u) => !u.includes('/social-content/')) || null;

  const copy = (value: string, what: string) => {
    navigator.clipboard?.writeText(value);
    showToast(`${what} copiado`, 'success');
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/social-content/${slot.id}/final`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo subir', 'error'); return; }
      showToast('Archivo final guardado', 'success');
      onChanged();
    } catch {
      showToast('Error de conexión al subir', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (url: string) => {
    if (!window.confirm('¿Quitar este archivo de la publicación?')) return;
    const res = await fetch(`/api/social-content/${slot.id}/final?url=${encodeURIComponent(url)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    if (res.ok) onChanged(); else showToast('No se pudo quitar', 'error');
  };

  const btn = 'bg-tech-border hover:bg-tech-border/70 text-tech-text px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5';

  return (
    <div className="border border-sky-500/30 bg-sky-500/5 rounded-xl p-4 space-y-4">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5"><Icons.Wand2 size={14} /> Con tu plan de Gemini</p>
        <p className="text-[11px] text-tech-muted mt-1">
          1. Guarda la foto del producto. 2. Copia el prompt y pégalo en Gemini (imagen) o en Flow (vídeo) adjuntando la foto.
          3. Descarga el resultado y súbelo aquí.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {photo && <a href={photo} target="_blank" rel="noreferrer" download className={btn}><Icons.Download size={13} /> Foto del producto</a>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-tech-carbon border border-tech-border rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase font-black tracking-widest text-tech-muted flex items-center gap-1"><Icons.Image size={12} /> Imagen · app de Gemini</p>
          <p className="text-xs text-tech-text whitespace-pre-wrap line-clamp-6">{imagePrompt}</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => copy(imagePrompt, 'Prompt de imagen')} className={btn}><Icons.Copy size={13} /> Copiar prompt</button>
            <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer" className={btn}><Icons.ExternalLink size={13} /> Abrir Gemini</a>
          </div>
        </div>
        <div className="bg-tech-carbon border border-tech-border rounded-lg p-3 space-y-2">
          <p className="text-[10px] uppercase font-black tracking-widest text-tech-muted flex items-center gap-1"><Icons.Clapperboard size={12} /> Vídeo · Flow (Veo)</p>
          <p className="text-xs text-tech-text whitespace-pre-wrap line-clamp-6">{videoPrompt}</p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => copy(videoPrompt, 'Prompt de vídeo')} className={btn}><Icons.Copy size={13} /> Copiar prompt</button>
            <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noreferrer" className={btn}><Icons.ExternalLink size={13} /> Abrir Flow</a>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase font-black tracking-widest text-tech-muted">Imagen o vídeo final</p>
        {!!slot.final_media?.length && (
          <div className="flex gap-2 flex-wrap">
            {slot.final_media.map((m) => (
              <div key={m.url} className="relative">
                {m.type === 'video'
                  ? <video src={m.url} controls playsInline className="w-36 h-64 object-cover rounded-lg border border-tech-border bg-black" />
                  : <a href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.name} className="w-36 h-64 object-cover rounded-lg border border-tech-border" /></a>}
                <div className="absolute top-1 right-1 flex gap-1">
                  <a href={m.url} download={m.name} className="bg-black/70 text-white rounded p-1" aria-label="Descargar"><Icons.Download size={12} /></a>
                  <button onClick={() => remove(m.url)} className="bg-black/70 text-red-300 rounded p-1" aria-label="Quitar"><Icons.Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          {uploading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Upload size={13} />}
          {uploading ? 'Subiendo…' : 'Subir imagen o vídeo final'}
        </button>
      </div>
    </div>
  );
};

const VIDEO_OPTIONS = [
  { id: 'hailuo', label: 'Hailuo 2.3 (MiniMax) · 6 s en 1080p, sin sonido', cost: 'incluido en tu plan de MiniMax', seconds: 6 },
  { id: 'hailuo-fast', label: 'Hailuo 2.3 Fast (MiniMax) · más rápido, sin sonido', cost: 'incluido en tu plan de MiniMax', seconds: 6 },
  { id: 'fast', label: 'Veo 3.1 Fast (Google) · 8 s con sonido', cost: '≈ 1,10 € de los créditos de Google Cloud', seconds: 8 },
  { id: 'lite', label: 'Veo 3.1 Lite (Google) · 8 s con sonido', cost: '≈ 0,40 € de los créditos de Google Cloud', seconds: 8 },
];

/**
 * Vídeo con Veo desde el panel: se elige una imagen de apoyo como primer
 * fotograma, se revisa el prompt y Veo lo anima (8 s, vertical). El servidor
 * le pone los logos y lo deja en los archivos finales.
 */
const VideoStudio: React.FC<{ slot: ContentSlot; adminToken: string; onChanged: () => void }> = ({ slot, adminToken, onChanged }) => {
  const { showToast } = useToast();
  // Imágenes sin logos (Veo deformaría los logotipos): las base y la foto del producto.
  const sources = Array.from(new Set([...(slot.base_media || []), slot.product_image || ''].filter(Boolean)));
  const [source, setSource] = useState(sources[0] || '');
  const [prompt, setPrompt] = useState(slot.video_prompt || fallbackPrompts(slot).video);
  const [model, setModel] = useState('hailuo');
  const opt = VIDEO_OPTIONS.find((o) => o.id === model) || VIDEO_OPTIONS[0];
  const [busy, setBusy] = useState(false);
  const generating = slot.video_status === 'generating';

  useEffect(() => { if (!source && sources[0]) setSource(sources[0]); }, [sources, source]);

  const start = async () => {
    if (!window.confirm(`¿Generar un vídeo de ${opt.seconds} s con ${opt.label.split(' · ')[0]}? Coste: ${opt.cost}.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/social-content/${slot.id}/video`, {
        method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl: source, prompt, model }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo empezar el vídeo', 'error'); onChanged(); return; }
      showToast('Generando el vídeo… tarda 2-5 minutos', 'success');
      onChanged();
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!sources.length) return null;
  return (
    <div className="border border-purple-500/30 bg-purple-500/5 rounded-xl p-4 space-y-3">
      <p className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5"><Icons.Clapperboard size={14} /> Vídeo con IA (Hailuo o Veo)</p>
      {slot.video_status === 'error' && slot.video_error && (
        <div className="rounded-lg p-2 text-xs border bg-red-950/30 border-red-800/50 text-red-400">{slot.video_error}</div>
      )}
      {generating ? (
        <p className="text-xs text-purple-200 flex items-center gap-2"><Icons.Loader2 className="w-4 h-4 animate-spin" /> Generando el vídeo… tarda 2-5 minutos. Aparecerá abajo, en «Imagen o vídeo final», con los logos puestos.</p>
      ) : (
        <>
          <div>
            <label className={labelClass}>Imagen de partida (primer fotograma)</label>
            <div className="flex gap-2 flex-wrap">
              {sources.map((u) => (
                <button key={u} onClick={() => setSource(u)}
                  className={`rounded-lg overflow-hidden border-2 ${source === u ? 'border-purple-400' : 'border-transparent opacity-70'}`}>
                  <img src={u} alt="" className="w-16 h-28 object-cover bg-white" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Qué tiene que pasar en el vídeo</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={2000} className={`${inputClass} text-xs resize-y`} />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={model} onChange={(e) => setModel(e.target.value)} className={`${inputClass} w-auto`}>
              {VIDEO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button onClick={start} disabled={busy || !source || prompt.trim().length < 10}
              className="bg-purple-500/80 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50">
              {busy ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Sparkles size={14} />} Generar vídeo de {opt.seconds} s
            </button>
          </div>
          <p className="text-[10px] text-tech-muted">Coste: {opt.cost}. Hailuo no lleva sonido (pon música en TikTok); Veo sí.</p>
        </>
      )}
    </div>
  );
};

/**
 * Versión de Instagram: las mismas imágenes en 4:5 (1080x1350) y la descripción
 * adaptada. Los vídeos de TikTok sirven tal cual para Reels.
 */
const InstagramStudio: React.FC<{ slot: ContentSlot; adminToken: string; onChanged: () => void }> = ({ slot, adminToken, onChanged }) => {
  const { showToast } = useToast();
  const [copy, setCopy] = useState(slot.ig_copy || '');
  const [hashtags, setHashtags] = useState(slot.ig_hashtags || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setCopy(slot.ig_copy || ''); setHashtags(slot.ig_hashtags || ''); }, [slot.ig_copy, slot.ig_hashtags]);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
  const generating = slot.ig_status === 'generating';
  const has = !!slot.ig_media?.length;
  const dirty = copy !== (slot.ig_copy || '') || hashtags !== (slot.ig_hashtags || '');

  const create = async (caption: boolean) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/social-content/${slot.id}/instagram`, { method: 'POST', headers, body: JSON.stringify({ caption }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo crear la versión de Instagram', 'error'); return; }
      showToast('Preparando la versión de Instagram…', 'success');
      onChanged();
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveText = async () => {
    const res = await fetch(`/api/social-content/${slot.id}`, { method: 'PATCH', headers, body: JSON.stringify({ igCopy: copy, igHashtags: hashtags }) });
    if (res.ok) { showToast('Texto de Instagram guardado', 'success'); onChanged(); } else showToast('No se pudo guardar', 'error');
  };

  return (
    <div className="border border-pink-500/30 bg-pink-500/5 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="flex-1 text-xs font-black uppercase tracking-wider text-pink-300 flex items-center gap-1.5"><Icons.Instagram size={14} /> Versión Instagram (4:5)</p>
        {has && !generating && (
          <>
            <button onClick={() => create(false)} disabled={busy} className="text-pink-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"><Icons.RefreshCw size={11} /> Rehacer imágenes</button>
            <button onClick={() => create(true)} disabled={busy} className="text-pink-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"><Icons.Sparkles size={11} /> Rehacer todo</button>
          </>
        )}
      </div>
      {slot.ig_status === 'error' && slot.ig_error && <div className="rounded-lg p-2 text-xs border bg-red-950/30 border-red-800/50 text-red-400">{slot.ig_error}</div>}
      {generating ? (
        <p className="text-xs text-pink-200 flex items-center gap-2"><Icons.Loader2 className="w-4 h-4 animate-spin" /> Adaptando imágenes y texto… (unos segundos)</p>
      ) : !has ? (
        <>
          <p className="text-[11px] text-tech-muted">Crea las mismas imágenes en el formato del feed de Instagram (1080×1350) y un texto adaptado, con «enlace en la bio» y más hashtags. Los vídeos sirven tal cual para Reels.</p>
          <button onClick={() => create(true)} disabled={busy}
            className="bg-pink-500/80 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50">
            {busy ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Instagram size={14} />} Crear versión Instagram
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {slot.ig_media!.map((url, i) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" download className="relative group">
                <img src={url} alt={`Instagram ${i + 1}`} className="w-24 h-[7.5rem] object-cover rounded-lg border border-tech-border" />
                <span className="absolute bottom-1 right-1 bg-black/70 rounded p-1 text-white opacity-80 group-hover:opacity-100"><Icons.Download size={12} /></span>
              </a>
            ))}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass}>Texto para Instagram</label>
              <button onClick={() => { navigator.clipboard?.writeText(`${copy}\n\n${hashtags}`.trim()); showToast('Copiado al portapapeles', 'success'); }}
                className="text-pink-300 text-[10px] font-bold flex items-center gap-1"><Icons.Copy size={11} /> Copiar texto + hashtags</button>
            </div>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={5} maxLength={2200} className={`${inputClass} resize-y`} />
          </div>
          <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} maxLength={600} className={`${inputClass} text-pink-300 text-xs`} />
          {dirty && (
            <button onClick={saveText} className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
              <Icons.Save size={13} /> Guardar texto
            </button>
          )}
        </>
      )}
    </div>
  );
};

/** Textos de las diapositivas de una publicación de marca: se editan y se vuelven a componer (sin IA). */
const SlidesEditor: React.FC<{ slot: ContentSlot; adminToken: string; onChanged: () => void }> = ({ slot, adminToken, onChanged }) => {
  const { showToast } = useToast();
  const [slides, setSlides] = useState(slot.slides || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setSlides(slot.slides || []); }, [slot.slides]);
  const dirty = JSON.stringify(slides) !== JSON.stringify(slot.slides || []);
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const save = async () => {
    setBusy(true);
    try {
      const r1 = await fetch(`/api/social-content/${slot.id}`, { method: 'PATCH', headers, body: JSON.stringify({ slides }) });
      if (!r1.ok) { const d = await r1.json().catch(() => ({})); showToast(d.error || 'No se pudo guardar', 'error'); return; }
      const r2 = await fetch(`/api/social-content/${slot.id}/recompose`, { method: 'POST', headers });
      if (!r2.ok) { showToast('Textos guardados, pero no se pudieron rehacer las imágenes', 'error'); }
      else showToast('Diapositivas actualizadas', 'success');
      onChanged();
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!slides.length) return null;
  const set = (i: number, k: 'title' | 'text', v: string) => setSlides((arr) => arr.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <div className="space-y-2">
      <label className={labelClass}>Texto de cada diapositiva</label>
      {slides.map((sl, i) => (
        <div key={i} className="flex gap-2 items-start bg-tech-carbon border border-tech-border rounded-lg p-2">
          <span className="text-[10px] font-black text-tech-muted w-5 pt-2">{i + 1}</span>
          {sl.kind === 'price' && <span className="sr-only">Diapositiva del precio</span>}
          <div className="flex-1 space-y-1.5">
            <input value={sl.title} onChange={(e) => set(i, 'title', e.target.value)} maxLength={80} placeholder="Título" className={`${inputClass} font-bold`} />
            {sl.kind === 'price' && <p className="text-[10px] text-tech-muted">Diapositiva del precio: el precio (y el anterior tachado si está en oferta) lo pone el sistema con el del catálogo.</p>}
            <textarea value={sl.text} onChange={(e) => set(i, 'text', e.target.value)} maxLength={220} rows={2} placeholder="Texto" className={`${inputClass} text-xs resize-y`} />
          </div>
        </div>
      ))}
      {dirty && (
        <button onClick={save} disabled={busy}
          className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          {busy ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Save size={13} />} Guardar textos y rehacer imágenes
        </button>
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
        {!slot.campaign && <div className="md:col-span-2">
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
              <p className="text-[10px] text-tech-muted mt-1">Si no eliges ninguno, se sortea una marca (de todas, sin repetir las de las últimas 10 publicaciones) y un producto suyo con stock, fotos y de 30 € o más que no se haya publicado en 120 días.</p>
            </>
          )}
        </div>}
        <div className="md:col-span-2">
          <label className={labelClass}>{slot.campaign ? 'Tema de la publicación de marca' : 'Enfoque (opcional)'}</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} disabled={generating}
            placeholder={slot.campaign ? 'Ej.: tenemos un chat con asesores expertos de verdad' : 'Ej.: sonido del escape al arrancar, comparativa con el de serie, look de invierno…'} className={inputClass} />
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
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass}>Imágenes promocionales</label>
                {!slot.campaign && (
                  <button onClick={() => action('/recompose', 'POST', 'Logos actualizados')} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1">
                    <Icons.BadgeCheck size={11} /> Rehacer con logos
                  </button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {slot.media_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noreferrer" download className="relative group">
                    <img src={url} alt={`Imagen ${i + 1}`} className={`${slot.campaign || slot.slides?.[0]?.kind ? 'w-24 h-[10.6rem]' : 'w-28 h-28'} object-cover rounded-lg border border-tech-border`} />
                    <span className="absolute bottom-1 right-1 bg-black/70 rounded p-1 text-white opacity-80 group-hover:opacity-100"><Icons.Download size={12} /></span>
                  </a>
                ))}
              </div>
            </div>
          )}
          {(slot.campaign || !!slot.slides?.[0]?.kind) && <SlidesEditor slot={slot} adminToken={adminToken} onChanged={onChanged} />}
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

      {hasContent && !generating && (
        <InstagramStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />
      )}

      {(hasContent || slot.product_sku) && !generating && (
        <VideoStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />
      )}

      {(hasContent || slot.product_sku) && !generating && !slot.campaign && (
        <ManualStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />
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

/** Logos oficiales de las marcas para las imágenes promocionales. */
const BrandLogos: React.FC<{ adminToken: string; onClose: () => void }> = ({ adminToken, onClose }) => {
  const { showToast } = useToast();
  const [brands, setBrands] = useState<{ brand: string; url: string | null }[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string>('');

  const load = () => fetch('/api/social-content/brand-logos', { headers: { Authorization: `Bearer ${adminToken}` } })
    .then((r) => (r.ok ? r.json() : { brands: [] })).then((d) => setBrands(d.brands || [])).catch(() => setBrands([]));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminToken]);

  const pick = (brand: string) => { target.current = brand; fileRef.current?.click(); };

  const upload = async (file: File) => {
    const brand = target.current;
    setBusy(brand);
    try {
      const form = new FormData();
      form.append('brand', brand);
      form.append('file', file);
      const res = await fetch('/api/social-content/brand-logos', { method: 'POST', headers: { Authorization: `Bearer ${adminToken}` }, body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(d.error || 'No se pudo subir el logo', 'error'); return; }
      showToast(`Logo de ${d.brand} guardado. Pulsa «Rehacer con logos» en sus publicaciones.`, 'success');
      setCustom('');
      load();
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async (brand: string) => {
    if (!window.confirm(`¿Quitar el logo de ${brand}?`)) return;
    await fetch(`/api/social-content/brand-logos/${encodeURIComponent(brand)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    load();
  };

  return (
    <div className="bg-tech-card border border-tech-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-xs font-black uppercase tracking-wider text-tech-text flex items-center gap-1.5"><Icons.BadgeCheck size={14} className="text-tech-yellow" /> Logos de marcas</p>
        <button onClick={onClose} className="text-tech-muted hover:text-tech-text" aria-label="Cerrar"><Icons.X size={16} /></button>
      </div>
      <p className="text-[11px] text-tech-muted">
        Salen las marcas de las publicaciones del calendario. Se ponen en las imágenes promocionales junto al logo de escapesymas.com. Mejor en PNG con fondo transparente o SVG,
        descargado de la web oficial o del material de prensa de la marca.
      </p>
      <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      {!brands && <p className="text-xs text-tech-muted">Cargando…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {brands?.map((b) => (
          <div key={b.brand} className="flex items-center gap-2 bg-tech-carbon border border-tech-border rounded-lg p-2">
            <div className="w-24 h-12 rounded bg-white grid place-items-center shrink-0">
              {b.url ? <img src={b.url} alt={b.brand} className="max-w-[88px] max-h-10 object-contain" /> : <Icons.ImageOff size={16} className="text-zinc-400" />}
            </div>
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-bold text-tech-text truncate">{b.brand}</span>
              <span className={`block text-[10px] ${b.url ? 'text-emerald-400' : 'text-amber-400'}`}>{b.url ? 'Logo subido' : 'Sin logo: sale su nombre'}</span>
            </span>
            <button onClick={() => pick(b.brand)} disabled={busy === b.brand} className="text-tech-yellow hover:text-orange-400 disabled:opacity-50" aria-label="Subir logo">
              {busy === b.brand ? <Icons.Loader2 size={15} className="animate-spin" /> : <Icons.Upload size={15} />}
            </button>
            {b.url && <button onClick={() => remove(b.brand)} className="text-tech-muted hover:text-red-400" aria-label="Quitar logo"><Icons.Trash2 size={14} /></button>}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Otra marca (tal como sale en el producto)" maxLength={60} className={inputClass} />
        <button onClick={() => custom.trim() && pick(custom.trim())} disabled={!custom.trim()}
          className="bg-tech-border text-tech-text px-3 rounded-lg text-xs font-bold disabled:opacity-40 shrink-0">Subir logo</button>
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
  const [showLogos, setShowLogos] = useState(false);
  const [newWhen, setNewWhen] = useState('');
  const [newFormat, setNewFormat] = useState<ContentSlot['format']>('video');
  const [newCampaign, setNewCampaign] = useState(false);
  const [newTopic, setNewTopic] = useState('');
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
  const anyGenerating = slots.some((s) => s.status === 'generating' || s.video_status === 'generating' || s.ig_status === 'generating');
  useEffect(() => {
    if (!anyGenerating) return;
    const t = setInterval(() => {
      const before = slotsRef.current.filter((s) => s.status === 'generating').map((s) => s.id);
      const videosBefore = slotsRef.current.filter((s) => s.video_status === 'generating').map((s) => s.id);
      fetchSlots(true).then(() => {
        for (const id of before) {
          const s = slotsRef.current.find((x) => x.id === id);
          if (s?.status === 'ready') showToast('Contenido generado', 'success');
          else if (s?.status === 'draft' && s.error) showToast('No se pudo generar el contenido', 'error');
        }
        for (const id of videosBefore) {
          const s = slotsRef.current.find((x) => x.id === id);
          if (s?.video_status === 'done') showToast('Vídeo listo', 'success');
          else if (s?.video_status === 'error') showToast('No se pudo generar el vídeo', 'error');
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
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ scheduledAt: new Date(newWhen).toISOString(), format: newFormat, campaign: newCampaign, topic: newTopic.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'No se pudo crear', 'error'); return; }
      setShowNew(false);
      setNewWhen('');
      setNewTopic('');
      setNewCampaign(false);
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
        <button onClick={() => setShowLogos((v) => !v)}
          className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2">
          <Icons.BadgeCheck size={14} /> Logos de marcas
        </button>
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

      {showLogos && <BrandLogos adminToken={adminToken} onClose={() => setShowLogos(false)} />}

      {showNew && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
          <label className="w-full text-xs text-tech-text flex items-center gap-2">
            <input type="checkbox" checked={newCampaign} onChange={(e) => { setNewCampaign(e.target.checked); if (e.target.checked) setNewFormat('carousel'); }} />
            Publicación de marca (sin producto): p. ej. dar a conocer el chat con asesores
          </label>
          {newCampaign && (
            <div className="w-full">
              <label className={labelClass}>Tema</label>
              <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} maxLength={500} className={inputClass}
                placeholder="Ej.: tenemos un chat con asesores expertos humanos que te ayudan a elegir y te preparan el pedido" />
            </div>
          )}
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
          <button onClick={handleCreate} disabled={!newWhen || (newCampaign && !newTopic.trim())}
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
                    {slot.final_media?.length ? <Icons.CheckCircle2 size={14} className="text-sky-400 shrink-0" /> : null}
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
                        {slot.campaign ? `De marca · ${slot.topic || ''}` : (slot.product_name || slot.topic || 'Producto automático (cualquier marca)')}
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
