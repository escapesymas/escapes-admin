import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';

interface MarginsTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
}

interface Preview {
  candidates: number; changed: number; down: number; up: number;
  avgOld: number; avgNew: number; avgMarginNew: number; belowPvp: number;
  sample: { sku: string; name: string; old: number; new: number; pvp: number }[];
}

interface BrandSuggestion { brand: string; products: number; discount: number; avgMargin: number; avgVsPvp: number }
interface Promotion { id: number; name: string; scope: string; target: string | null; level: string; percent: string | null; starts_at: string | null; ends_at: string | null; active: boolean; products: number }

const eur = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const input = 'w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-tech-text focus:outline-none focus:border-tech-yellow font-medium';
const label = 'block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-2';

/**
 * Precio de venta = máx(PVP de Bihr − descuento, suelo de margen mínimo).
 * El suelo cubre coste real (catálogo Prices de Bihr), IVA y comisión de pago.
 * Ver lib/pricing.ts en el backend.
 */
const MarginsTab: React.FC<MarginsTabProps> = ({ adminToken }) => {
  const { showToast } = useToast();
  const auth = { Authorization: `Bearer ${adminToken}` };
  const [rules, setRules] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [auto, setAuto] = useState<boolean | null>(null);
  const [newRule, setNewRule] = useState({ ruleType: 'global', targetId: '', discountPercent: '0', minMarginPercent: '15' });
  // DTO1 por marca
  const [target, setTarget] = useState({ targetMargin: '30', minMargin: '15', maxDiscount: '40' });
  const [suggestions, setSuggestions] = useState<BrandSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  // Promociones DTO2
  const [promos, setPromos] = useState<Promotion[]>([]);
  const emptyPromo = { name: '', scope: 'brand', target: '', level: 'dto2', percent: '10', startsAt: '', endsAt: '' };
  const [promo, setPromo] = useState(emptyPromo);

  const fetchPromos = async () => {
    const res = await fetch(`/api/admin?action=promotions-list`, { headers: auth });
    if (res.ok) setPromos(await res.json());
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const q = new URLSearchParams(target).toString();
      const res = await fetch(`/api/admin?action=brand-rules-suggest&${q}`, { headers: auth });
      if (res.ok) setSuggestions(await res.json());
      else showToast(`Error: ${(await res.json()).error}`, 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSaveBrandRules = async () => {
    if (!suggestions || !confirm(`Se guardarán ${suggestions.length} reglas de marca (sustituyen a las actuales). Los precios no cambian hasta «Aplicar precios».`)) return;
    setSuggesting(true);
    try {
      const res = await fetch(`/api/admin?action=brand-rules-save`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMargin: Number(target.targetMargin), minMargin: Number(target.minMargin), maxDiscount: Number(target.maxDiscount) }),
      });
      const data = await res.json();
      if (res.ok) { showToast(`Reglas de marca guardadas: ${data.saved}`); setPreview(null); fetchRules(); }
      else showToast(`Error: ${data.error}`, 'error');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin?action=save-promotion`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...promo,
        target: promo.scope === 'all' ? null : promo.target,
        percent: promo.level === 'percent' ? Number(promo.percent) : null,
        startsAt: promo.startsAt ? new Date(promo.startsAt).toISOString() : null,
        endsAt: promo.endsAt ? new Date(promo.endsAt).toISOString() : null,
      }),
    });
    const data = await res.json();
    if (res.ok) { showToast(`Promoción guardada: ${data.applied} productos con precio de promoción`); setPromo(emptyPromo); fetchPromos(); }
    else showToast(`Error: ${data.error}`, 'error');
  };

  const handleDeletePromo = async (id: number) => {
    if (!confirm('¿Terminar y eliminar esta promoción? Sus productos vuelven a DTO1.')) return;
    const res = await fetch(`/api/admin?action=delete-promotion`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    });
    if (res.ok) fetchPromos();
  };

  const promoState = (p: Promotion) => {
    const now = Date.now();
    if (!p.active) return 'Pausada';
    if (p.starts_at && new Date(p.starts_at).getTime() > now) return 'Programada';
    if (p.ends_at && new Date(p.ends_at).getTime() <= now) return 'Terminada';
    return 'Activa';
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=pricing-rules-list`, { headers: auth });
      if (res.ok) setRules(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
    fetchPromos();
    fetch(`/api/admin?action=pricing-auto`, { headers: auth }).then((r) => (r.ok ? r.json() : null)).then((d) => d && setAuto(!!d.enabled)).catch(() => {});
    fetch('/api/catalog/categories').then((r) => (r.ok ? r.json() : [])).then((cats: any[]) =>
      setCategories(cats.filter((c) => !c.parentId && !String(c.slug).startsWith('old-')).map((c) => ({ id: c.id, name: c.name }))),
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=save-pricing-rule`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleType: newRule.ruleType,
          targetId: newRule.ruleType === 'global' ? null : newRule.targetId,
          discountPercent: Number(newRule.discountPercent),
          minMarginPercent: Number(newRule.minMarginPercent),
        }),
      });
      if (res.ok) {
        setNewRule({ ruleType: 'global', targetId: '', discountPercent: '0', minMarginPercent: '15' });
        setPreview(null);
        fetchRules();
      } else {
        showToast(`Error: ${(await res.json()).error}`, 'error');
      }
    } catch (err) {
      showToast(`Error de red: ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('¿Eliminar esta regla?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=delete-pricing-rule`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setPreview(null); fetchRules(); }
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch(`/api/admin?action=pricing-preview`, { headers: auth });
      if (res.ok) setPreview(await res.json());
      else showToast('No se pudo calcular la vista previa', 'error');
    } finally {
      setPreviewing(false);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    if (!confirm(`Se cambiarán ${preview.changed.toLocaleString('es-ES')} precios. ¿Aplicar ahora?`)) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/admin?action=recalculate-all-prices`, { method: 'POST', headers: auth });
      const data = await res.json();
      if (res.ok) { showToast(`Precios actualizados: ${data.updatedCount} productos`); setPreview(null); }
      else showToast(`Error: ${data.error}`, 'error');
    } catch (err) {
      showToast(`Error de red: ${(err as Error).message}`, 'error');
    } finally {
      setApplying(false);
    }
  };

  const toggleAuto = async () => {
    const enabled = !auto;
    const res = await fetch(`/api/admin?action=pricing-auto`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }),
    });
    if (res.ok) setAuto(!!(await res.json()).enabled);
  };

  const targetName = (rule: any) =>
    rule.rule_type === 'global' ? 'Todo el catálogo'
      : rule.rule_type === 'brand' ? rule.target_id
      : categories.find((c) => String(c.id) === String(rule.target_id))?.name || `Categoría #${rule.target_id}`;

  return (
    <div className="space-y-8 animate-fade-in text-left">
      {/* Vista previa y aplicación */}
      <div className="bg-tech-card border border-tech-yellow/30 rounded-2xl p-6 md:p-8 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider italic text-tech-text">Precios de venta</h3>
            <p className="text-xs text-[#cbd5e1] mt-1 max-w-2xl">
              Precio = PVP de Bihr menos el descuento de la regla, sin bajar nunca del margen mínimo (coste real, IVA y comisión de pago incluidos).
              Los precios cambiados a mano en la ficha del producto no se tocan.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <button onClick={handlePreview} disabled={previewing || applying}
              className="bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow text-tech-text px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
              {previewing ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Eye className="w-4 h-4" />}
              <span>Vista previa</span>
            </button>
            <button onClick={handleApply} disabled={!preview || preview.changed === 0 || applying}
              className="bg-tech-yellow disabled:opacity-40 text-black px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2">
              {applying ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.RefreshCw className="w-4 h-4" />}
              <span>Aplicar precios</span>
            </button>
          </div>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-[#1a1b1e] rounded-xl p-3"><div className="text-tech-muted">Precios que cambian</div><div className="text-lg font-black text-tech-text">{preview.changed.toLocaleString('es-ES')} <span className="text-[10px] text-tech-muted font-medium">de {preview.candidates.toLocaleString('es-ES')}</span></div><div className="text-[10px] text-tech-muted">{preview.down.toLocaleString('es-ES')} bajan · {preview.up.toLocaleString('es-ES')} suben</div></div>
              <div className="bg-[#1a1b1e] rounded-xl p-3"><div className="text-tech-muted">Precio medio</div><div className="text-lg font-black text-tech-text">{eur(preview.avgOld)} → {eur(preview.avgNew)}</div></div>
              <div className="bg-[#1a1b1e] rounded-xl p-3"><div className="text-tech-muted">Margen neto medio</div><div className="text-lg font-black text-tech-text">{preview.avgMarginNew.toLocaleString('es-ES')} %</div></div>
              <div className="bg-[#1a1b1e] rounded-xl p-3"><div className="text-tech-muted">Por debajo del PVP</div><div className="text-lg font-black text-tech-text">{preview.belowPvp.toLocaleString('es-ES')}</div></div>
            </div>
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto border border-tech-border rounded-xl">
                <table className="w-full text-xs">
                  <thead><tr className="text-[9px] uppercase tracking-wider text-tech-muted border-b border-tech-border">
                    <th className="p-3 text-left">Producto</th><th className="p-3 text-right">PVP</th><th className="p-3 text-right">Ahora</th><th className="p-3 text-right">Nuevo</th>
                  </tr></thead>
                  <tbody className="divide-y divide-zinc-900/60">
                    {preview.sample.map((s) => (
                      <tr key={s.sku}><td className="p-3 text-tech-text">{s.name} <span className="text-tech-muted">({s.sku})</span></td>
                        <td className="p-3 text-right tabular-nums">{eur(s.pvp)}</td><td className="p-3 text-right tabular-nums">{eur(s.old)}</td>
                        <td className="p-3 text-right tabular-nums font-bold text-tech-yellow">{eur(s.new)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <label className="flex items-center gap-3 text-xs text-tech-text cursor-pointer select-none">
          <input type="checkbox" checked={!!auto} disabled={auto === null} onChange={toggleAuto} className="w-4 h-4 accent-yellow-500" />
          Recalcular los precios automáticamente después de cada importación de Bihr
        </label>
      </div>

      {/* DTO1 por marca */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text">DTO1 · descuento por marca</h3>
          <p className="text-xs text-tech-muted mt-1 max-w-3xl">
            Para cada marca, el mayor descuento sobre el PVP que mantiene su margen neto medio en el objetivo, sin bajar nunca del mínimo en ningún producto.
            Guardar sustituye las reglas de marca; los precios cambian al pulsar «Aplicar precios».
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
          <div><label className={label} htmlFor="t-target">Margen medio objetivo (%)</label>
            <input id="t-target" type="number" min={0} max={60} value={target.targetMargin} onChange={(e) => setTarget({ ...target, targetMargin: e.target.value })} className={input} /></div>
          <div><label className={label} htmlFor="t-min">Margen mínimo por producto (%)</label>
            <input id="t-min" type="number" min={0} max={60} value={target.minMargin} onChange={(e) => setTarget({ ...target, minMargin: e.target.value })} className={input} /></div>
          <div><label className={label} htmlFor="t-max">Descuento máximo (%)</label>
            <input id="t-max" type="number" min={1} max={60} value={target.maxDiscount} onChange={(e) => setTarget({ ...target, maxDiscount: e.target.value })} className={input} /></div>
          <div className="flex gap-2">
            <button type="button" onClick={handleSuggest} disabled={suggesting}
              className="flex-1 bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow text-tech-text py-3 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2">
              {suggesting ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.Calculator className="w-4 h-4" />}<span>Calcular</span>
            </button>
            <button type="button" onClick={handleSaveBrandRules} disabled={!suggestions || suggesting}
              className="flex-1 bg-tech-yellow disabled:opacity-40 text-black py-3 rounded-xl font-black uppercase tracking-wider">Guardar</button>
          </div>
        </div>
        {suggestions && (
          <div className="overflow-auto max-h-96 border border-tech-border rounded-xl">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-tech-card"><tr className="text-[9px] uppercase tracking-wider text-tech-muted border-b border-tech-border">
                <th className="p-3 text-left">Marca</th><th className="p-3 text-right">Productos</th><th className="p-3 text-right">Descuento s/ PVP</th>
                <th className="p-3 text-right">Precio vs PVP</th><th className="p-3 text-right">Margen medio</th></tr></thead>
              <tbody className="divide-y divide-zinc-900/60">
                {suggestions.map((s) => (
                  <tr key={s.brand}><td className="p-3 text-tech-text">{s.brand}</td><td className="p-3 text-right tabular-nums">{s.products.toLocaleString('es-ES')}</td>
                    <td className="p-3 text-right tabular-nums font-bold text-tech-yellow">{s.discount ? `−${s.discount} %` : 'a PVP'}</td>
                    <td className="p-3 text-right tabular-nums">{s.avgVsPvp.toLocaleString('es-ES')} %</td>
                    <td className="p-3 text-right tabular-nums">{s.avgMargin.toLocaleString('es-ES')} %</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Promociones DTO2 */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 space-y-4">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text">DTO2 · promociones</h3>
          <p className="text-xs text-tech-muted mt-1 max-w-3xl">
            DTO2 es el precio mínimo sin pérdidas (coste + IVA + comisión de pago). Una promoción pone sus productos a DTO2, o a un % sobre DTO1 sin bajar de DTO2,
            entre las fechas indicadas, y los devuelve solos a DTO1 al terminar. Los productos en promoción no admiten cupones ni descuentos por importe.
          </p>
        </div>
        <form onSubmit={handleSavePromo} className="grid grid-cols-1 md:grid-cols-6 gap-3 text-xs items-end">
          <div className="md:col-span-2"><label className={label} htmlFor="p-name">Nombre</label>
            <input id="p-name" required value={promo.name} onChange={(e) => setPromo({ ...promo, name: e.target.value })} placeholder="Ej.: Semana Brembo" className={input} /></div>
          <div><label className={label} htmlFor="p-scope">Ámbito</label>
            <select id="p-scope" value={promo.scope} onChange={(e) => setPromo({ ...promo, scope: e.target.value, target: '' })} className={input}>
              <option value="brand">Marca</option><option value="category">Categoría</option><option value="skus">Referencias</option><option value="all">Todo el catálogo</option>
            </select></div>
          <div className="md:col-span-3">
            {promo.scope === 'category' ? (<>
              <label className={label} htmlFor="p-target">Categoría</label>
              <select id="p-target" required value={promo.target} onChange={(e) => setPromo({ ...promo, target: e.target.value })} className={input}>
                <option value="">Elige una categoría</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></>) : promo.scope === 'all' ? (<p className="text-tech-muted pb-3">Se aplica a todos los productos con coste conocido.</p>) : (<>
              <label className={label} htmlFor="p-target">{promo.scope === 'brand' ? 'Marca' : 'Referencias (separadas por comas)'}</label>
              <input id="p-target" required value={promo.target} onChange={(e) => setPromo({ ...promo, target: e.target.value })} placeholder={promo.scope === 'brand' ? 'Ej.: BREMBO' : 'Ej.: 07YA23SA, CR9EK'} className={input} /></>)}
          </div>
          <div><label className={label} htmlFor="p-level">Precio</label>
            <select id="p-level" value={promo.level} onChange={(e) => setPromo({ ...promo, level: e.target.value })} className={input}>
              <option value="dto2">DTO2 (mínimo)</option><option value="percent">% sobre DTO1</option>
            </select></div>
          {promo.level === 'percent' && <div><label className={label} htmlFor="p-pct">Descuento (%)</label>
            <input id="p-pct" type="number" min={1} max={89} value={promo.percent} onChange={(e) => setPromo({ ...promo, percent: e.target.value })} className={input} /></div>}
          <div><label className={label} htmlFor="p-from">Desde</label>
            <input id="p-from" type="datetime-local" value={promo.startsAt} onChange={(e) => setPromo({ ...promo, startsAt: e.target.value })} className={input} /></div>
          <div><label className={label} htmlFor="p-to">Hasta</label>
            <input id="p-to" type="datetime-local" value={promo.endsAt} onChange={(e) => setPromo({ ...promo, endsAt: e.target.value })} className={input} /></div>
          <button type="submit" className="bg-tech-yellow text-black py-3 rounded-xl font-black uppercase tracking-wider">Crear promoción</button>
        </form>
        <div className="overflow-x-auto border border-tech-border rounded-xl">
          <table className="w-full text-xs">
            <thead><tr className="text-[9px] uppercase tracking-wider text-tech-muted border-b border-tech-border">
              <th className="p-3 text-left">Promoción</th><th className="p-3 text-left">Ámbito</th><th className="p-3 text-left">Precio</th>
              <th className="p-3 text-left">Fechas</th><th className="p-3 text-right">Productos</th><th className="p-3 text-left">Estado</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-zinc-900/60">
              {promos.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-tech-muted">No hay promociones.</td></tr> : promos.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 text-tech-text font-bold">{p.name}</td>
                  <td className="p-3">{p.scope === 'all' ? 'Todo' : p.scope === 'category' ? categories.find((c) => String(c.id) === p.target)?.name || `Categoría #${p.target}` : p.target}</td>
                  <td className="p-3">{p.level === 'dto2' ? 'DTO2' : `DTO1 −${Number(p.percent)} %`}</td>
                  <td className="p-3">{p.starts_at ? new Date(p.starts_at).toLocaleString('es-ES') : 'Ya'} → {p.ends_at ? new Date(p.ends_at).toLocaleString('es-ES') : 'sin fin'}</td>
                  <td className="p-3 text-right tabular-nums">{p.products.toLocaleString('es-ES')}</td>
                  <td className="p-3">{promoState(p)}</td>
                  <td className="p-3 text-center"><button onClick={() => handleDeletePromo(p.id)} aria-label="Eliminar promoción"
                    className="bg-red-950/20 border border-red-900/20 text-red-500 p-2 rounded-lg"><Icons.Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-tech-card border border-tech-border p-6 rounded-2xl">
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text mb-6 border-b border-tech-border pb-3 flex items-center gap-2">
            <Icons.PlusCircle className="w-4 h-4 text-tech-yellow" /><span>Nueva regla</span>
          </h3>
          <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
            <div>
              <label className={label} htmlFor="rule-type">Ámbito</label>
              <select id="rule-type" value={newRule.ruleType} onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value, targetId: '' })} className={input}>
                <option value="global">Todo el catálogo</option>
                <option value="category">Categoría</option>
                <option value="brand">Marca</option>
              </select>
            </div>
            {newRule.ruleType === 'category' && (
              <div>
                <label className={label} htmlFor="rule-cat">Categoría</label>
                <select id="rule-cat" value={newRule.targetId} onChange={(e) => setNewRule({ ...newRule, targetId: e.target.value })} required className={input}>
                  <option value="">Elige una categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {newRule.ruleType === 'brand' && (
              <div>
                <label className={label} htmlFor="rule-brand">Marca</label>
                <input id="rule-brand" type="text" placeholder="Ej.: BREMBO" value={newRule.targetId}
                  onChange={(e) => setNewRule({ ...newRule, targetId: e.target.value })} required className={input} />
              </div>
            )}
            <div>
              <label className={label} htmlFor="rule-discount">Descuento sobre el PVP (%)</label>
              <input id="rule-discount" type="number" min={0} max={60} step={0.5} value={newRule.discountPercent}
                onChange={(e) => setNewRule({ ...newRule, discountPercent: e.target.value })} required className={input} />
            </div>
            <div>
              <label className={label} htmlFor="rule-margin">Margen neto mínimo (%)</label>
              <input id="rule-margin" type="number" min={0} max={60} step={0.5} value={newRule.minMarginPercent}
                onChange={(e) => setNewRule({ ...newRule, minMarginPercent: e.target.value })} required className={input} />
              <p className="text-[9px] text-tech-muted mt-1">Sobre el precio sin IVA, después del coste y de la comisión de pago.</p>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow text-tech-text py-3.5 rounded-xl font-black uppercase tracking-wider flex items-center justify-center gap-2">
              {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CheckCircle className="w-4 h-4 text-tech-yellow" />}
              <span>Guardar regla</span>
            </button>
          </form>
        </div>

        <div className="bg-tech-card border border-tech-border p-6 rounded-2xl lg:col-span-2">
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text mb-6 border-b border-tech-border pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2"><Icons.Sliders className="w-4 h-4 text-tech-yellow" />Reglas activas</span>
            <button onClick={fetchRules} aria-label="Recargar reglas" className="p-1 rounded-lg text-tech-muted hover:text-tech-text"><Icons.RotateCw className="w-4 h-4" /></button>
          </h3>
          <div className="overflow-auto max-h-[32rem] border border-tech-border rounded-xl">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-tech-card">
                <tr className="border-b border-tech-border text-tech-muted text-[9px] font-black uppercase tracking-wider">
                  <th className="p-4 text-left">Ámbito</th><th className="p-4 text-left">Aplica a</th>
                  <th className="p-4 text-right">Descuento s/ PVP</th><th className="p-4 text-right">Margen mínimo</th><th className="p-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {rules.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-tech-muted">
                    Sin reglas: se vende a PVP, con un margen mínimo del 15 %. La regla de marca manda sobre la de categoría, y esta sobre la global.
                  </td></tr>
                ) : rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="p-4 font-black uppercase text-zinc-300">{rule.rule_type === 'global' ? 'Global' : rule.rule_type === 'category' ? 'Categoría' : 'Marca'}</td>
                    <td className="p-4 text-tech-text">{targetName(rule)}</td>
                    <td className="p-4 text-right font-black text-tech-yellow tabular-nums">−{Number(rule.discount_percent)} %</td>
                    <td className="p-4 text-right tabular-nums">{Number(rule.min_margin_percent)} %</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleDeleteRule(rule.id)} aria-label="Eliminar regla"
                        className="bg-red-950/20 border border-red-900/20 text-red-500 p-2 rounded-lg"><Icons.Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarginsTab;
