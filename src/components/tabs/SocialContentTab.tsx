import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';
import { displayImage } from '../../utils/image';
import type { ChatProductCard } from '../chat/ProductPicker';

interface ContentSlot {
  id: number;
  scheduled_at: string;
  format: 'video' | 'photo' | 'carousel';
  topic: string | null;
  angle?: string | null;
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
  ready: { label: 'Listo', className: 'bg-emerald-950/50 text-emerald-400' },
  published: { label: 'Publicado', className: 'bg-tech-yellow/10 text-tech-yellow' },
  skipped: { label: 'Omitido', className: 'bg-zinc-800 text-zinc-500' },
};

/** Fecha para <input type="datetime-local"> en la hora del navegador. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Enfoques de las publicaciones de producto (ANGLES en socialContentAI del backend). */
const ANGLE_LABEL: Record<string, string> = {
  consejo: 'Consejo útil',
  pregunta: 'Pregunta-problema',
  tu_moto: 'Para tu moto',
  guia: 'Guía de compra',
  promo: 'Promo directa',
};

const inputClass = 'w-full bg-tech-carbon border border-tech-border rounded-lg px-3 py-2 text-sm text-tech-text';
const labelClass = 'text-[10px] uppercase font-black tracking-widest text-tech-muted mb-1 block';

/** Apartado plegable del editor: en el móvil solo queda a la vista lo necesario para publicar. */
const Section: React.FC<{ icon: React.ReactNode; title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ icon, title, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-tech-border/60 rounded-xl overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-tech-border/20 transition-colors">
        {icon}
        <span className="flex-1 text-xs font-bold text-tech-text">{title}</span>
        <Icons.ChevronDown size={14} className={`text-tech-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-3">{children}</div>}
    </div>
  );
};

/**
 * ¿El navegador puede compartir archivos? En el iPhone (panel instalado como app de inicio) es la única forma
 * cómoda de guardar un vídeo o una foto: la hoja de compartir ofrece «Guardar vídeo» / «Guardar imagen» (a Fotos).
 */
const shareFilesSupported = (() => {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare
      && navigator.canShare({ files: [new File([''], 'prueba.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
})();

const fileNameOf = (url: string, name?: string) => name || decodeURIComponent(url.split('?')[0].split('/').pop() || 'archivo');

/**
 * Guardar archivos de una publicación. Safari solo deja abrir la hoja de compartir justo después del toque, así
 * que los archivos se descargan antes, en cuanto se abre la publicación; en el ordenador se descargan sin más.
 */
function useSaveFiles(items: { url: string; name?: string }[]) {
  const { showToast } = useToast();
  const [files, setFiles] = useState<Record<string, File>>({});
  const key = items.map((i) => i.url).join('|');
  useEffect(() => {
    if (!shareFilesSupported) return;
    let cancelled = false;
    (async () => {
      for (const it of items) {
        if (cancelled) return;
        try {
          const res = await fetch(it.url);
          if (!res.ok) continue;
          const blob = await res.blob();
          if (cancelled) return;
          const file = new File([blob], fileNameOf(it.url, it.name), { type: blob.type });
          setFiles((prev) => ({ ...prev, [it.url]: file }));
        } catch { /* si falla, al pulsar se avisa */ }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const ready = (urls: string[]) => !shareFilesSupported || urls.every((u) => files[u]);
  const save = (urls: string[]) => {
    if (!urls.length) return;
    if (shareFilesSupported) {
      const list = urls.map((u) => files[u]).filter(Boolean);
      if (list.length < urls.length) { showToast('Preparando los archivos… vuelve a pulsar en unos segundos', 'error'); return; }
      navigator.share({ files: list }).catch((err) => {
        if (err?.name !== 'AbortError') showToast('No se pudo abrir el menú para guardar. Vuelve a pulsar', 'error');
      });
      return;
    }
    for (const u of urls) {
      const a = document.createElement('a');
      a.href = u;
      a.download = fileNameOf(u, items.find((i) => i.url === u)?.name);
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };
  return { save, ready };
}

/**
 * Lo que se sube a TikTok, arriba del todo: los vídeos finales primero y después las imágenes promocionales.
 * Los botones van debajo de cada archivo (encima del vídeo chocaban con los controles del iPhone).
 */
const MediaToSave: React.FC<{ slot: ContentSlot; adminToken: string; onChanged: () => void; onRecompose?: () => void }> = ({ slot, adminToken, onChanged, onRecompose }) => {
  const { showToast } = useToast();
  const items = [
    ...(slot.final_media || []).map((m) => ({ url: m.url, name: m.name, video: m.type === 'video', final: true })),
    ...(slot.media_urls || []).map((url, i) => ({ url, name: undefined as string | undefined, video: false, final: false, index: i })),
  ];
  const { save, ready } = useSaveFiles(items);
  if (!items.length) return null;
  const vertical = slot.campaign || !!slot.slides?.[0]?.kind;
  const allUrls = items.map((i) => i.url);
  const allReady = ready(allUrls);

  const remove = async (url: string) => {
    if (!window.confirm('¿Quitar este archivo de la publicación?')) return;
    const res = await fetch(`/api/social-content/${slot.id}/final?url=${encodeURIComponent(url)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
    if (res.ok) onChanged(); else showToast('No se pudo quitar', 'error');
  };

  const saveLabel = shareFilesSupported ? 'Guardar' : 'Descargar';
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className={labelClass + ' mb-0'}>Para publicar</label>
        {onRecompose && !!slot.media_urls?.length && (
          <button onClick={onRecompose} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1">
            <Icons.BadgeCheck size={11} /> Rehacer logos
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 sm:flex-wrap">
        {items.map((it) => (
          <div key={it.url} className="shrink-0 snap-start space-y-1.5">
            {it.video
              ? <video src={it.url} controls playsInline preload="metadata" className="w-40 h-[17.8rem] object-cover rounded-lg border border-tech-border bg-black" />
              : <img src={displayImage(it.url, 800)} alt="" className={`${vertical || it.final ? 'w-32 h-[14.2rem]' : 'w-36 h-36'} object-cover rounded-lg border border-tech-border`} />}
            <div className="flex gap-1.5">
              <button onClick={() => save([it.url])} disabled={!ready([it.url])}
                className="flex-1 bg-tech-border hover:bg-tech-border/70 disabled:opacity-60 text-tech-text px-2 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                {ready([it.url]) ? <Icons.Download size={14} /> : <Icons.Loader2 size={14} className="animate-spin" />}
                {it.video ? `${saveLabel} vídeo` : saveLabel}
              </button>
              {it.final && (
                <button onClick={() => remove(it.url)} className="bg-tech-border hover:bg-red-950/50 text-red-300 px-2.5 rounded-lg" aria-label="Quitar archivo">
                  <Icons.Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <button onClick={() => save(allUrls)} disabled={!allReady}
          className="w-full sm:w-auto bg-sky-500/20 hover:bg-sky-500/30 disabled:opacity-60 text-sky-200 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
          {allReady ? <Icons.Download size={14} /> : <Icons.Loader2 size={14} className="animate-spin" />}
          {allReady ? `${saveLabel} todo (${items.length})` : 'Preparando archivos…'}
        </button>
      )}
    </div>
  );
};

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
        // Los productos de Bihr (nuestro proveedor) no se publican en redes.
        .then((d) => setResults((d.products || []).filter((p: ChatProductCard) => !/bihr/i.test(`${p.brand || ''} ${p.name || ''}`))))
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
              {p.image ? <img src={displayImage(p.image)} alt="" className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 rounded bg-tech-border" />}
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
      + 'Plano de detalle que se abre a la moto en ambiente motero, movimiento de cámara suave, luz cálida y música suave, sin sonido de motor ni de escape. '
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

  const btn = 'bg-tech-border hover:bg-tech-border/70 text-tech-text px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5';

  return (
    <Section icon={<Icons.Wand2 size={14} className="text-sky-300" />} title={`Con tu plan de Gemini${slot.final_media?.length ? ` · ${slot.final_media.length} archivo${slot.final_media.length > 1 ? 's' : ''} final${slot.final_media.length > 1 ? 'es' : ''}` : ''}`}>
      <p className="text-[11px] text-tech-muted">
        1. Guarda la foto del producto. 2. Copia el prompt y pégalo en Gemini (imagen) o en Flow (vídeo) adjuntando la foto.
        3. Descarga el resultado y súbelo aquí.
      </p>

      <div className="flex gap-2 flex-wrap">
        {photo && <a href={displayImage(photo, 800)} target="_blank" rel="noreferrer" download className={btn}><Icons.Download size={13} /> Foto del producto</a>}
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
        <p className="text-[10px] text-tech-muted">Lo que subas aparece arriba, en «Para publicar», listo para guardar.</p>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
          {uploading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Upload size={13} />}
          {uploading ? 'Subiendo…' : 'Subir imagen o vídeo final'}
        </button>
      </div>
    </Section>
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
    <Section icon={<Icons.Clapperboard size={14} className="text-purple-300" />} title={generating ? 'Vídeo con IA · generando…' : 'Vídeo con IA (Hailuo o Veo)'} defaultOpen={generating || slot.video_status === 'error'}>
      {slot.video_status === 'error' && slot.video_error && (
        <div className="rounded-lg p-2 text-xs border bg-red-950/30 border-red-800/50 text-red-400">{slot.video_error}</div>
      )}
      {generating ? (
        <p className="text-xs text-purple-200 flex items-center gap-2"><Icons.Loader2 className="w-4 h-4 animate-spin" /> Generando el vídeo… tarda 2-5 minutos. Aparecerá arriba, en «Para publicar», con los logos puestos.</p>
      ) : (
        <>
          <div>
            <label className={labelClass}>Imagen de partida (primer fotograma)</label>
            <div className="flex gap-2 flex-wrap">
              {sources.map((u) => (
                <button key={u} onClick={() => setSource(u)}
                  className={`rounded-lg overflow-hidden border-2 ${source === u ? 'border-purple-400' : 'border-transparent opacity-70'}`}>
                  <img src={displayImage(u)} alt="" className="w-16 h-28 object-cover bg-white" />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Qué tiene que pasar en el vídeo</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={2000} className={`${inputClass} text-xs resize-y`} />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <select value={model} onChange={(e) => setModel(e.target.value)} className={`${inputClass} sm:w-auto`}>
              {VIDEO_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button onClick={start} disabled={busy || !source || prompt.trim().length < 10}
              className="bg-purple-500/80 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-50">
              {busy ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Sparkles size={14} />} Generar vídeo de {opt.seconds} s
            </button>
          </div>
          <p className="text-[10px] text-tech-muted">Coste: {opt.cost}. Hailuo no lleva sonido (pon música en TikTok); Veo sí, pero nunca de motor ni de escape.</p>
        </>
      )}
    </Section>
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
  const igMedia = slot.ig_media || [];
  const { save, ready } = useSaveFiles(igMedia.map((url) => ({ url })));
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
    <Section icon={<Icons.Instagram size={14} className="text-pink-300" />} title={`Versión Instagram (4:5)${generating ? ' · preparando…' : has ? ' · lista' : ''}`} defaultOpen={generating}>
      {has && !generating && (
        <div className="flex gap-4">
          <button onClick={() => create(false)} disabled={busy} className="text-pink-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"><Icons.RefreshCw size={11} /> Rehacer imágenes</button>
          <button onClick={() => create(true)} disabled={busy} className="text-pink-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"><Icons.Sparkles size={11} /> Rehacer todo</button>
        </div>
      )}
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
          <div className="flex gap-2 overflow-x-auto pb-1">
            {igMedia.map((url, i) => (
              <img key={url} src={url} alt={`Instagram ${i + 1}`} className="shrink-0 w-24 h-[7.5rem] object-cover rounded-lg border border-tech-border" />
            ))}
          </div>
          <button onClick={() => save(igMedia)} disabled={!ready(igMedia)}
            className="w-full sm:w-auto bg-pink-500/20 hover:bg-pink-500/30 disabled:opacity-60 text-pink-200 px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
            {ready(igMedia) ? <Icons.Download size={14} /> : <Icons.Loader2 size={14} className="animate-spin" />}
            {ready(igMedia) ? `${shareFilesSupported ? 'Guardar' : 'Descargar'} imágenes (${igMedia.length})` : 'Preparando imágenes…'}
          </button>
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
    </Section>
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
/** Nombre corto para el enlace de producto de TikTok: marca primero, máx. 30 caracteres, sin cortar palabras. */
const shortProductName = (name: string, brand?: string | null, max = 30) => {
  let clean = name.replace(/\s*·\s*Ref\..*$/i, '').replace(/\s+-\s+[A-Z0-9]{5,}$/, '').replace(/,/g, '').trim();
  if (brand) {
    const re = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    clean = `${brand} ${clean.replace(re, '').replace(/\s+/g, ' ').trim()}`;
  }
  const words: string[] = [];
  for (const word of clean.split(/\s+/)) {
    if ([...words, word].join(' ').length > max) break;
    words.push(word);
  }
  // El color o la variante van detrás de un guion («Casco … 500 - negro mate»): fuera.
  const dash = words.findIndex((w, i) => i > 1 && /^[-–—]$/.test(w));
  if (dash > 0) words.splice(dash);
  while (words.length > 1 && /^(de|del|con|para|y|a|en|la|el|los|las|tipo|[-–—+·&\/])$/i.test(words[words.length - 1])) words.pop();
  return words.join(' ') || clean.slice(0, max);
};

/** Neumáticos: Bihr no trae su compatibilidad, así que el enlace lleva al buscador por medida. */
const isTyre = (name?: string | null) => /^neum[aá]tico\b/i.test((name || '').trim());

/**
 * Datos para crear el enlace de producto en la app de TikTok (no hay API para
 * crearlo): URL con UTM para ver las visitas en Umami, nombre corto y foto.
 */
const TikTokProductLink: React.FC<{ slot: ContentSlot; onCopy: (value: string) => void }> = ({ slot, onCopy }) => {
  if (!slot.product_sku || slot.campaign) return null;
  const utm = `utm_source=tiktok&utm_medium=social&utm_campaign=publicacion-${slot.id}`;
  const tyre = isTyre(slot.product_name);
  const url = tyre
    ? `https://escapesymas.com/universales/neumaticos?${utm}`
    : `https://escapesymas.com/producto/${encodeURIComponent(slot.product_sku)}?${utm}`;
  const name = tyre ? 'Busca tu neumático por medida' : shortProductName(slot.product_name || slot.product_sku, slot.product_brand);
  return (
    <div className="bg-tech-carbon border border-tech-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icons.Link2 size={14} className="text-tech-yellow" />
        <span className={labelClass + ' mb-0'}>Enlace de producto para TikTok</span>
      </div>
      <p className="text-[10px] text-tech-muted">Al publicar: «Añadir enlace» → «Producto» → pega la URL y el nombre.<span className="hidden sm:inline"> Las visitas salen en Umami como tiktok / publicacion-{slot.id}.</span></p>
      {tyre && <p className="text-[10px] text-tech-yellow">Neumático: el enlace lleva al buscador por medida (los neumáticos no traen compatibilidad con motos).</p>}
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-xs text-tech-text truncate font-mono">{url}</span>
        <button onClick={() => onCopy(url)} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1 shrink-0"><Icons.Copy size={11} /> URL</button>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 text-xs text-tech-text truncate">{name} <span className="text-tech-muted">({name.length}/30)</span></span>
        <button onClick={() => onCopy(name)} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1 shrink-0"><Icons.Copy size={11} /> Nombre</button>
        {slot.product_image && (
          <a href={displayImage(slot.product_image, 800)} target="_blank" rel="noreferrer" download className="text-tech-yellow text-[10px] font-bold flex items-center gap-1 shrink-0"><Icons.Download size={11} /> Foto</a>
        )}
      </div>
    </div>
  );
};

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
  const [angle, setAngle] = useState(slot.angle || '');
  const [product, setProduct] = useState<{ sku: string; name: string; image: string | null } | null>(
    slot.product_sku ? { sku: slot.product_sku, name: slot.product_name || slot.product_sku, image: slot.product_image || null } : null);
  const [copy, setCopy] = useState(slot.copy || '');
  const [hashtags, setHashtags] = useState(slot.hashtags || '');
  const [script, setScript] = useState(slot.script || '');
  const [saving, setSaving] = useState(false);

  // Al terminar de generar llega contenido nuevo: se refleja en los campos.
  useEffect(() => { setCopy(slot.copy || ''); setHashtags(slot.hashtags || ''); setScript(slot.script || ''); }, [slot.copy, slot.hashtags, slot.script]);
  useEffect(() => { setAngle(slot.angle || ''); }, [slot.angle]);
  useEffect(() => {
    setProduct(slot.product_sku ? { sku: slot.product_sku, name: slot.product_name || slot.product_sku, image: slot.product_image || null } : null);
  }, [slot.product_sku, slot.product_name, slot.product_image]);

  const generating = slot.status === 'generating';
  const settingsDirty = when !== toLocalInput(slot.scheduled_at) || format !== slot.format
    || topic !== (slot.topic || '') || angle !== (slot.angle || '') || (product?.sku || null) !== (slot.product_sku || null);

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
    scheduledAt: new Date(when).toISOString(), format, topic, angle, productSku: product?.sku || null,
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

  const saveTextButton = (
    <button onClick={() => patch({ copy, hashtags, script }, 'Texto guardado')} disabled={saving}
      className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
      <Icons.Save size={13} /> Guardar texto
    </button>
  );

  // Cuándo, formato, producto, tipo e idea, con el botón de generar.
  const settings = (
    <>
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
              {product.image ? <img src={displayImage(product.image)} alt="" className="w-10 h-10 object-cover rounded" /> : <Icons.Package className="w-5 h-5 text-tech-muted" />}
              <span className="flex-1 min-w-0 text-xs text-tech-text truncate">{product.name} <span className="text-tech-muted">· {product.sku}</span></span>
              {!generating && <button onClick={() => setProduct(null)} className="text-tech-muted hover:text-red-400 p-1" aria-label="Quitar producto"><Icons.X size={14} /></button>}
            </div>
          ) : (
            <>
              {!generating && <ProductSearch adminToken={adminToken} onPick={(p) => setProduct({ sku: p.sku, name: p.name, image: p.image })} />}
              <p className="text-[10px] text-tech-muted mt-1">Si no eliges ninguno, se sortea uno con stock, fotos y de 30 € o más, sin repetir marca ni producto recientes.</p>
            </>
          )}
        </div>}
        {!slot.campaign && <div className="md:col-span-2">
          <label className={labelClass}>Tipo de publicación</label>
          <select value={angle} onChange={(e) => setAngle(e.target.value)} className={inputClass} disabled={generating}>
            <option value="">Automático</option>
            {Object.entries(ANGLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="text-[10px] text-tech-muted mt-1">Automático: va rotando para no repetir la promo. «Para tu moto» solo si hay motos compatibles. La IA usa solo datos reales.</p>
        </div>}
        <div className="md:col-span-2">
          <label className={labelClass}>{slot.campaign ? 'Tema de la publicación de marca' : 'Idea concreta (opcional)'}</label>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={500} disabled={generating}
            placeholder={slot.campaign ? 'Ej.: tenemos un chat con asesores expertos de verdad' : 'Ej.: look de invierno'} className={inputClass} />
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {settingsDirty && !generating && (
          <button onClick={saveSettings} disabled={saving}
            className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50">
            <Icons.Save size={13} /> Guardar cambios
          </button>
        )}
        {slot.status !== 'published' && (
          <button onClick={generate} disabled={generating || saving}
            className="flex-1 sm:flex-none justify-center bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-4 py-2.5 rounded-lg text-xs font-black uppercase italic tracking-wider flex items-center gap-2">
            {generating ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : hasContent ? <Icons.RefreshCw size={13} /> : <Icons.Sparkles size={14} />}
            {generating ? 'Generando… (1-2 min)' : hasContent ? 'Regenerar con IA' : 'Generar con IA'}
          </button>
        )}
      </div>
    </>
  );

  const showPublish = hasContent && !generating;
  const vertical = slot.campaign || !!slot.slides?.[0]?.kind;

  return (
    <div className="px-3 sm:px-5 pb-4 border-t border-tech-border/50 pt-3 space-y-3">
      {slot.error && (
        <div className={`rounded-lg p-3 text-xs border ${slot.status === 'ready' ? 'bg-amber-950/30 border-amber-800/50 text-amber-400' : 'bg-red-950/30 border-red-800/50 text-red-400'}`}>
          {slot.error}
        </div>
      )}

      {/* Vídeos e imágenes listos para guardar, siempre lo primero. */}
      {!generating && (
        <MediaToSave slot={slot} adminToken={adminToken} onChanged={onChanged}
          onRecompose={slot.campaign ? undefined : () => action('/recompose', 'POST', 'Logos actualizados')} />
      )}

      {/* Sin contenido (o generando): los ajustes a la vista para preparar la publicación. */}
      {!showPublish && settings}

      {/* Con contenido: lo necesario para publicar arriba y lo demás en apartados plegables. */}
      {showPublish && (
        <>
          <div className="space-y-2">
            <label className={labelClass}>Texto de la publicación</label>
            <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={5} className={`${inputClass} resize-y`} />
            <input value={hashtags} onChange={(e) => setHashtags(e.target.value)} aria-label="Hashtags" className={`${inputClass} text-tech-yellow text-xs`} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copyToClipboard(`${copy}\n\n${hashtags}`.trim())}
                className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                <Icons.Copy size={13} /> Copiar texto
              </button>
              {slot.status !== 'published' ? (
                <button onClick={() => action('/published', 'POST', 'Marcado como publicado')}
                  className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 px-3 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5">
                  <Icons.Check size={13} /> Marcar publicado
                </button>
              ) : (
                <span className="text-tech-yellow text-xs font-bold flex items-center justify-center gap-1.5"><Icons.CheckCircle2 size={13} /> Publicado</span>
              )}
            </div>
            {(copy !== (slot.copy || '') || hashtags !== (slot.hashtags || '')) && saveTextButton}
          </div>

          <TikTokProductLink slot={slot} onCopy={copyToClipboard} />

          <div className="space-y-2 pt-1">
            <Section icon={<Icons.SlidersHorizontal size={14} className="text-tech-muted" />}
              title={`Ajustes y regenerar${!slot.campaign && slot.angle && ANGLE_LABEL[slot.angle] ? ` · ${ANGLE_LABEL[slot.angle]}` : ''}`}>
              {settings}
            </Section>
            {vertical && (
              <Section icon={<Icons.Layers size={14} className="text-tech-muted" />} title="Texto de las diapositivas">
                <SlidesEditor slot={slot} adminToken={adminToken} onChanged={onChanged} />
              </Section>
            )}
            {(slot.script || script) && (
              <Section icon={<Icons.ScrollText size={14} className="text-tech-muted" />} title="Guion">
                <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={8} className={`${inputClass} text-xs resize-y`} />
                {script !== (slot.script || '') && saveTextButton}
              </Section>
            )}
            <InstagramStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />
          </div>
        </>
      )}

      {(hasContent || slot.product_sku) && !generating && (
        <div className="space-y-2">
          <VideoStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />
          {!slot.campaign && <ManualStudio slot={slot} adminToken={adminToken} onChanged={onChanged} />}
        </div>
      )}

      <div className="flex justify-end gap-5 pt-2 border-t border-tech-border/30">
        {(slot.status === 'draft' || slot.status === 'ready') && (
          <button onClick={() => patch({ status: 'skipped' }, 'Publicación omitida')} className="text-tech-muted hover:text-tech-text text-xs font-bold flex items-center gap-1 py-1">
            <Icons.SkipForward size={12} /> Omitir
          </button>
        )}
        {slot.status === 'skipped' && (
          <button onClick={() => patch({ status: hasContent ? 'ready' : 'draft' }, 'Publicación recuperada')} className="text-tech-muted hover:text-tech-text text-xs font-bold flex items-center gap-1 py-1">
            <Icons.Undo2 size={12} /> Recuperar
          </button>
        )}
        <button
          onClick={() => { if (window.confirm('¿Eliminar esta publicación del calendario?')) action('', 'DELETE', 'Publicación eliminada'); }}
          className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1 py-1">
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
  const [generatingAll, setGeneratingAll] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showLogos, setShowLogos] = useState(false);
  const [newWhen, setNewWhen] = useState('');
  const [newFormat, setNewFormat] = useState<ContentSlot['format']>('video');
  const [newCampaign, setNewCampaign] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  // Historial: publicaciones de los últimos 90 días, de la más reciente a la más antigua.
  const [history, setHistory] = useState(false);
  const slotsRef = useRef<ContentSlot[]>([]);

  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' });

  const fetchSlots = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - (history ? 90 : 1));
      const range = history ? `&to=${new Date().toISOString()}` : '';
      const res = await fetch(`/api/social-content?from=${from.toISOString()}${range}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items: ContentSlot[] = history ? [...(data.items || [])].reverse() : data.items || [];
        setSlots(items);
        slotsRef.current = items;
      } else if (!silent) {
        showToast('Error al cargar el calendario de contenido', 'error');
      }
    } catch (err) {
      if (!silent) showToast('Error de conexión al cargar el calendario', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, history]);

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

  // Borradores sin contenido de los próximos 7 días (los de marca necesitan tema).
  const weekEnd = Date.now() + 7 * 86400000;
  const pendingCount = slots.filter((s) => s.status === 'draft' && !s.copy
    && +new Date(s.scheduled_at) > Date.now() && +new Date(s.scheduled_at) <= weekEnd
    && (!s.campaign || !!s.topic)).length;

  const handleGenerateAll = async () => {
    if (!window.confirm(`¿Generar con IA las ${pendingCount} publicaciones pendientes de los próximos 7 días? Se hacen una detrás de otra (1-2 min cada una).`)) return;
    setGeneratingAll(true);
    try {
      const res = await fetch('/api/social-content/generate-pending', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ days: 7 }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(data.queued ? `Generando ${data.queued} publicaciones… puedes cerrar el panel` : 'No hay publicaciones pendientes', 'success');
        fetchSlots(true);
      } else {
        showToast(data.error || 'No se pudo empezar a generar', 'error');
      }
    } catch {
      showToast('Error de conexión', 'error');
    } finally {
      setGeneratingAll(false);
    }
  };

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
      {/* Barra: en el móvil, iconos; las etiquetas salen en pantallas anchas. */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-tech-border/50 rounded-xl p-1">
          {[{ v: false, label: 'Calendario', icon: <Icons.CalendarDays size={13} /> }, { v: true, label: 'Historial', icon: <Icons.History size={13} /> }].map((o) => (
            <button key={o.label} onClick={() => { if (history !== o.v) { setHistory(o.v); setExpandedId(null); } }}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${history === o.v ? 'bg-tech-yellow text-tech-text' : 'text-tech-muted hover:text-tech-text'}`}>
              <span className="hidden sm:inline">{o.icon}</span> {o.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowNew((v) => !v)} title="Nueva publicación" aria-label="Nueva publicación"
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${showNew ? 'bg-tech-yellow/20 text-tech-yellow' : 'bg-tech-border hover:bg-tech-border/70 text-tech-text'}`}>
          <Icons.Plus size={15} /> <span className="hidden md:inline">Nueva publicación</span>
        </button>
        <button onClick={() => setShowLogos((v) => !v)} title="Logos de marcas" aria-label="Logos de marcas"
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${showLogos ? 'bg-tech-yellow/20 text-tech-yellow' : 'bg-tech-border hover:bg-tech-border/70 text-tech-text'}`}>
          <Icons.BadgeCheck size={15} /> <span className="hidden md:inline">Logos de marcas</span>
        </button>
        {!history && (
          <button onClick={handleAutoSchedule} disabled={autoScheduling} title="Rellenar próximos 7 días" aria-label="Rellenar próximos 7 días"
            className="bg-tech-border hover:bg-tech-border/70 disabled:opacity-50 text-tech-text p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            {autoScheduling ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CalendarPlus size={15} />}
            <span className="hidden md:inline">Rellenar 7 días</span>
          </button>
        )}
        {pendingCount > 0 && !history && (
          <button
            onClick={handleGenerateAll}
            disabled={generatingAll || anyGenerating}
            className="w-full md:w-auto justify-center bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
          >
            {generatingAll || anyGenerating ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Sparkles size={14} />}
            Generar pendientes ({pendingCount})
          </button>
        )}
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

      {history && (
        <p className="text-xs text-tech-muted">Publicaciones de los últimos 90 días, de la más reciente a la más antigua. Ábrelas para descargar el vídeo o las fotos y copiar el texto.</p>
      )}

      {!slots.length && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-10 text-center text-tech-muted text-sm">
          {history ? 'No hay publicaciones en los últimos 90 días.' : 'No hay nada programado. Pulsa "Rellenar próximos 7 días" para crear los huecos recomendados.'}
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
                  className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-tech-border/20 transition-colors"
                >
                  <div className="relative shrink-0">
                    {(slot.media_urls?.[0] || slot.product_image)
                      ? <img src={displayImage(slot.media_urls?.[0] || slot.product_image)} alt="" className="w-12 h-12 object-cover rounded-lg" />
                      : <div className="w-12 h-12 rounded-lg bg-tech-border/50 grid place-items-center"><Icons.Image size={15} className="text-tech-muted" /></div>}
                    {!!slot.final_media?.length && (
                      <Icons.CheckCircle2 size={15} className="absolute -top-1 -right-1 text-sky-400 bg-tech-card rounded-full" aria-label="Con archivo final" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-black text-tech-text shrink-0">{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[11px] text-tech-muted truncate">
                        {FORMAT_LABEL[slot.format] || slot.format}
                        {slot.campaign ? ' · De marca' : slot.angle && ANGLE_LABEL[slot.angle] ? ` · ${ANGLE_LABEL[slot.angle]}` : ''}
                      </span>
                      {slot.error && slot.status === 'draft' && <Icons.AlertTriangle size={12} className="text-red-400 shrink-0" />}
                      <span className={`ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-tech-text/80 truncate mt-0.5">
                      {slot.campaign ? slot.topic || 'Publicación de marca' : (slot.product_name || slot.topic || 'Producto automático')}
                    </p>
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
