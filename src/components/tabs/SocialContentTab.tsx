import React, { useState, useEffect, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';

interface ContentSlot {
  id: number;
  scheduled_at: string;
  format: 'video' | 'photo' | 'carousel';
  topic: string | null;
  product_sku: string | null;
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

const SocialContentTab: React.FC<SocialContentTabProps> = ({ adminToken, initialSlotId }) => {
  const { showToast } = useToast();
  const [slots, setSlots] = useState<ContentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(initialSlotId || null);
  const [autoScheduling, setAutoScheduling] = useState(false);

  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' });

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const res = await fetch(`/api/social-content?from=${from.toISOString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSlots(data.items || []);
      } else {
        showToast('Error al cargar el calendario de contenido', 'error');
      }
    } catch (err) {
      console.error('[SOCIAL CONTENT FETCH ERROR]:', err);
      showToast('Error de conexión al cargar el calendario', 'error');
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  const handleAutoSchedule = async () => {
    setAutoScheduling(true);
    try {
      const res = await fetch('/api/social-content/auto-schedule', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ days: 7 }) });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.created?.length || 0} huecos nuevos añadidos al calendario`, 'success');
        fetchSlots();
      } else {
        showToast(data.error || 'No se pudo generar el calendario', 'error');
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    } finally {
      setAutoScheduling(false);
    }
  };

  const handleGenerate = async (id: number) => {
    setGeneratingId(id);
    try {
      const res = await fetch(`/api/social-content/${id}/generate`, { method: 'POST', headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        showToast('Contenido generado', 'success');
        setExpandedId(id);
        fetchSlots();
      } else {
        showToast(data.error || 'No se pudo generar el contenido', 'error');
        fetchSlots();
      }
    } catch (err) {
      showToast('Error de conexión al generar', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleMarkPublished = async (id: number) => {
    try {
      await fetch(`/api/social-content/${id}/published`, { method: 'POST', headers: authHeaders() });
      showToast('Marcado como publicado', 'success');
      fetchSlots();
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/social-content/${id}`, { method: 'DELETE', headers: authHeaders() });
      fetchSlots();
    } catch {
      showToast('Error de conexión', 'error');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text);
    showToast('Copiado al portapapeles', 'success');
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-tech-muted"><Icons.Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleAutoSchedule}
          disabled={autoScheduling}
          className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-orange-950/20"
        >
          {autoScheduling ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CalendarPlus size={14} />}
          Rellenar próximos 7 días
        </button>
      </div>

      {!slots.length && (
        <div className="bg-tech-card border border-tech-border rounded-xl p-10 text-center text-tech-muted text-sm">
          No hay nada programado. Pulsa "Rellenar próximos 7 días" para crear los huecos recomendados.
        </div>
      )}

      <div className="space-y-3">
        {slots.map((slot) => {
          const status = STATUS_LABEL[slot.status] || STATUS_LABEL.draft;
          const expanded = expandedId === slot.id;
          const date = new Date(slot.scheduled_at);
          return (
            <div key={slot.id} className="bg-tech-card border border-tech-border rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : slot.id)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-tech-border/20 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-center shrink-0 w-14">
                    <div className="text-[10px] uppercase font-black text-tech-muted">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                    <div className="text-lg font-black text-tech-text leading-none">{date.getDate()}</div>
                    <div className="text-[10px] text-tech-muted">{date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-tech-text">{FORMAT_LABEL[slot.format] || slot.format}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="text-xs text-tech-muted truncate mt-0.5">{slot.topic || 'Sin tema definido (se elige automáticamente al generar)'}</p>
                  </div>
                </div>
                <Icons.ChevronDown className={`w-4 h-4 shrink-0 text-tech-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="px-5 pb-5 border-t border-tech-border/50 pt-4 space-y-4">
                  {slot.error && (
                    <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-xs text-red-400">{slot.error}</div>
                  )}

                  {slot.status === 'draft' || slot.status === 'generating' ? (
                    <button
                      onClick={() => handleGenerate(slot.id)}
                      disabled={generatingId === slot.id}
                      className="bg-tech-yellow hover:bg-orange-600 disabled:opacity-50 text-tech-text px-4 py-2.5 rounded-lg text-xs font-black uppercase italic tracking-wider flex items-center gap-2"
                    >
                      {generatingId === slot.id ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Sparkles size={14} />}
                      Generar con IA
                    </button>
                  ) : (
                    <>
                      {!!slot.media_urls?.length && (
                        <div className="flex gap-2 flex-wrap">
                          {slot.media_urls.map((url, i) => (
                            <img key={i} src={url} alt={`Media ${i + 1}`} className="w-28 h-28 object-cover rounded-lg border border-tech-border" />
                          ))}
                        </div>
                      )}
                      {slot.copy && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] uppercase font-black tracking-widest text-tech-muted">Copy</label>
                            <button onClick={() => copyToClipboard(`${slot.copy}\n\n${slot.hashtags || ''}`)} className="text-tech-yellow text-[10px] font-bold flex items-center gap-1"><Icons.Copy size={11} /> Copiar</button>
                          </div>
                          <p className="text-sm text-tech-text whitespace-pre-wrap bg-black/20 rounded-lg p-3">{slot.copy}</p>
                        </div>
                      )}
                      {slot.hashtags && (
                        <p className="text-xs text-tech-yellow">{slot.hashtags}</p>
                      )}
                      {slot.script && (
                        <div>
                          <label className="text-[10px] uppercase font-black tracking-widest text-tech-muted mb-1 block">Guion</label>
                          <p className="text-xs text-tech-muted whitespace-pre-wrap bg-black/20 rounded-lg p-3">{slot.script}</p>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleGenerate(slot.id)}
                          disabled={generatingId === slot.id}
                          className="bg-tech-border hover:bg-tech-border/70 text-tech-text px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                        >
                          <Icons.RefreshCw size={13} /> Regenerar
                        </button>
                        {slot.status !== 'published' && (
                          <button
                            onClick={() => handleMarkPublished(slot.id)}
                            className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
                          >
                            <Icons.Check size={13} /> Marcar publicado
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  <div className="flex justify-end pt-2 border-t border-tech-border/30">
                    <button onClick={() => handleDelete(slot.id)} className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1">
                      <Icons.Trash2 size={12} /> Eliminar slot
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SocialContentTab;
