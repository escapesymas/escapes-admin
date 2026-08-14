import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import type { Review, ReviewStatus } from '../../types/admin';

interface ReviewsTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
  onReviewsUpdated?: () => void;
}

interface ReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  average: number;
}

const ReviewsTab: React.FC<ReviewsTabProps> = ({ adminToken, onReviewsUpdated }) => {
  const { showToast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, pending: 0, approved: 0, rejected: 0, average: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const authHeaders = () => ({ 'Authorization': `Bearer ${adminToken}` });

  const fetchReviews = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        action: 'reviews-list',
        search,
        status: statusFilter,
        rating: ratingFilter,
        page: page.toString(),
        limit: '20'
      });

      const res = await fetch(`/api/admin?${queryParams.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setTotal(data.total || 0);
        if (data.stats) setStats(data.stats);
      } else {
        showToast('Error al obtener reseñas del servidor', 'error');
      }
    } catch (err) {
      console.error('[FETCH REVIEWS ERROR]:', err);
      if (!isSilent) showToast('Error de conexión al cargar las reseñas', 'error');
    } font-sans finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [search, statusFilter, ratingFilter, page]);

  const handleUpdateStatus = async (reviewId: number, status: ReviewStatus) => {
    setActionLoadingId(reviewId);
    try {
      const res = await fetch('/api/admin?action=update-review-status', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, status })
      });
      if (res.ok) {
        showToast(`Estado de la reseña #${reviewId} actualizado a ${status.toUpperCase()}`, 'success');
        fetchReviews(true);
        if (onReviewsUpdated) onReviewsUpdated();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Error actualizando estado', 'error');
      }
    } catch (e) {
      showToast('Error de red al actualizar estado', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    setActionLoadingId(reviewId);
    try {
      const res = await fetch('/api/admin?action=delete-review', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId })
      });
      if (res.ok) {
        showToast(`Reseña #${reviewId} eliminada permanentemente`, 'success');
        setDeletingId(null);
        fetchReviews(true);
        if (onReviewsUpdated) onReviewsUpdated();
      } else {
        const errData = await res.json();
        showToast(errData.error || 'Error al eliminar reseña', 'error');
      }
    } catch (e) {
      showToast('Error de red al eliminar reseña', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => (
          <Icons.Star
            key={star}
            className={`w-3.5 h-3.5 ${star <= rating ? 'fill-amber-400' : 'text-zinc-700'}`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1 w-fit">
            <Icons.CheckCircle2 className="w-3 h-3" /> Aprobada
          </span>
        );
      case 'pending':
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center gap-1 w-fit animate-pulse">
            <Icons.Clock className="w-3 h-3" /> Pendiente
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-950/40 text-red-400 border border-red-800/40 flex items-center gap-1 w-fit">
            <Icons.XCircle className="w-3 h-3" /> Rechazada
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-tech-card border border-tech-border p-4 rounded-xl shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-bold uppercase tracking-widest">Total Reseñas</span>
            <Icons.MessageSquare className="w-4 h-4 text-tech-yellow" />
          </div>
          <p className="text-2xl font-black italic text-tech-text">{stats.total}</p>
        </div>

        <div className="bg-tech-card border border-tech-border p-4 rounded-xl shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Pendientes</span>
            <Icons.Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black italic text-amber-400">{stats.pending}</p>
        </div>

        <div className="bg-tech-card border border-tech-border p-4 rounded-xl shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Aprobadas</span>
            <Icons.CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black italic text-emerald-400">{stats.approved}</p>
        </div>

        <div className="bg-tech-card border border-tech-border p-4 rounded-xl shadow-lg">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Rechazadas</span>
            <Icons.XCircle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-black italic text-red-400">{stats.rejected}</p>
        </div>

        <div className="bg-tech-card border border-tech-border p-4 rounded-xl shadow-lg col-span-2 md:col-span-1">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] text-tech-muted font-bold uppercase tracking-widest">Puntuación Media</span>
            <Icons.Star className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-black italic text-tech-yellow">{stats.average}</p>
            <span className="text-xs text-tech-muted font-bold">/ 5.0</span>
          </div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-tech-card border border-tech-border p-4 rounded-2xl">
        <div className="relative w-full md:max-w-md">
          <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por producto, SKU, cliente o comentario..."
            className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl pl-11 pr-4 py-3 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all shadow-inner font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pending', label: 'Pendientes' },
              { id: 'approved', label: 'Aprobadas' },
              { id: 'rejected', label: 'Rechazadas' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => { setStatusFilter(chip.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all border ${
                  statusFilter === chip.id
                    ? 'bg-tech-yellow/15 text-tech-yellow border-tech-yellow/30'
                    : 'bg-[#1a1b1e] text-tech-muted border-tech-border hover:text-zinc-300'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Rating Filter Dropdown */}
          <select
            value={ratingFilter}
            onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}
            className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-1.5 text-xs text-tech-text focus:outline-none focus:border-tech-yellow uppercase font-bold"
          >
            <option value="all">Todas las Estrellas</option>
            <option value="5">5 Estrellas</option>
            <option value="4">4 Estrellas</option>
            <option value="3">3 Estrellas</option>
            <option value="2">2 Estrellas</option>
            <option value="1">1 Estrella</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-tech-card border border-tech-border rounded-2xl p-12 text-center text-tech-muted">
            <Icons.Loader2 className="w-8 h-8 text-tech-yellow animate-spin mx-auto mb-3" />
            <span className="text-xs font-bold uppercase tracking-wider italic">Cargando valoraciones de clientes...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-tech-card border border-tech-border rounded-2xl p-12 text-center text-tech-muted">
            <Icons.MessageSquareOff className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm font-bold text-zinc-400">No se encontraron reseñas que coincidan con los filtros seleccionados.</p>
            <p className="text-xs mt-1">Prueba a modificar la búsqueda o cambiar el estado de filtrado.</p>
          </div>
        ) : (
          reviews.map((review) => {
            let imageSrc = '/placeholder.png';
            if (review.product_images) {
              try {
                const imgs = typeof review.product_images === 'string' ? JSON.parse(review.product_images) : review.product_images;
                if (Array.isArray(imgs) && imgs.length > 0) {
                  imageSrc = imgs[0]?.src || imgs[0]?.url || imgs[0] || imageSrc;
                }
              } catch (e) {}
            }

            return (
              <div
                key={review.id}
                className="bg-tech-card border border-tech-border hover:border-tech-border/80 rounded-2xl p-5 shadow-lg transition-all space-y-4"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-tech-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={imageSrc}
                      alt={review.product_name || 'Producto'}
                      className="w-12 h-12 object-contain bg-[#1a1b1e] border border-tech-border rounded-lg p-1 shrink-0"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-tech-text hover:text-tech-yellow transition-colors line-clamp-1">
                        {review.product_name || `Producto #${review.product_id}`}
                      </h4>
                      <p className="text-[10px] font-mono text-tech-muted">
                        SKU: <span className="text-zinc-400 font-bold">{review.product_sku || 'N/A'}</span> | Reseña ID: <span className="text-zinc-400">#{review.id}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {getStatusBadge(review.status)}
                    <span className="text-[10px] font-mono text-tech-muted">
                      {new Date(review.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {/* Review Body */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  <div className="md:col-span-1 bg-[#1a1b1e]/60 p-3 rounded-xl border border-tech-border/50 text-xs space-y-2">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-tech-muted tracking-wider block">Usuario / Cliente</span>
                      <span className="font-bold text-zinc-300 block">{review.username || 'Anónimo'}</span>
                      <span className="text-[10px] font-mono text-tech-muted truncate block">{review.user_email || 'Sin correo registrado'}</span>
                    </div>

                    {review.verified_purchase && (
                      <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/40">
                        <Icons.ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Compra Verificada</span>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <div className="flex items-center gap-3">
                      {renderStars(review.rating)}
                      {review.title && (
                        <h5 className="text-xs font-black text-tech-text uppercase tracking-wider">{review.title}</h5>
                      )}
                    </div>
                    {review.content ? (
                      <p className="text-xs text-[#cbd5e1] leading-relaxed bg-[#1a1b1e]/30 p-3 rounded-xl border border-tech-border/40 font-medium">
                        "{review.content}"
                      </p>
                    ) : (
                      <p className="text-xs italic text-tech-muted">El cliente no dejó comentario escrito.</p>
                    )}
                  </div>
                </div>

                {/* Action Buttons & Confirmation */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 border-t border-tech-border/60 pt-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {review.status !== 'approved' && (
                      <button
                        disabled={actionLoadingId === review.id}
                        onClick={() => handleUpdateStatus(review.id, 'approved')}
                        className="bg-emerald-950/30 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-800/40 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Icons.CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprobar Reseña</span>
                      </button>
                    )}

                    {review.status !== 'rejected' && (
                      <button
                        disabled={actionLoadingId === review.id}
                        onClick={() => handleUpdateStatus(review.id, 'rejected')}
                        className="bg-red-950/30 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/40 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Icons.XCircle className="w-3.5 h-3.5" />
                        <span>Rechazar Reseña</span>
                      </button>
                    )}

                    {review.status !== 'pending' && (
                      <button
                        disabled={actionLoadingId === review.id}
                        onClick={() => handleUpdateStatus(review.id, 'pending')}
                        className="bg-amber-950/30 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-800/40 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Icons.Clock className="w-3.5 h-3.5" />
                        <span>Marcar Pendiente</span>
                      </button>
                    )}
                  </div>

                  {/* Delete Button / Confirmation */}
                  {deletingId === review.id ? (
                    <div className="flex items-center gap-2 bg-red-950/40 border border-red-800/60 p-1.5 rounded-xl animate-pulse">
                      <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider px-2">¿Eliminar permanentemente?</span>
                      <button
                        onClick={() => handleDeleteReview(review.id)}
                        className="bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Sí, Borrar
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="bg-[#1a1b1e] hover:bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      disabled={actionLoadingId === review.id}
                      onClick={() => setDeletingId(review.id)}
                      className="text-tech-muted hover:text-red-400 p-2 hover:bg-red-950/20 rounded-xl transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                      title="Eliminar Reseña"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-between items-center border-t border-tech-border pt-4">
          <span className="text-xs text-tech-muted font-mono">
            Mostrando {((page - 1) * 20) + 1} - {Math.min(page * 20, total)} de {total} reseñas
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="bg-[#1a1b1e] border border-tech-border px-3 py-1.5 rounded-lg text-xs font-bold text-tech-text disabled:opacity-40 hover:border-tech-yellow transition-all"
            >
              Anterior
            </button>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage(prev => prev + 1)}
              className="bg-[#1a1b1e] border border-tech-border px-3 py-1.5 rounded-lg text-xs font-bold text-tech-text disabled:opacity-40 hover:border-tech-yellow transition-all"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewsTab;
