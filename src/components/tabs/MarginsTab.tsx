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
          <div className="overflow-x-auto border border-tech-border rounded-xl">
            <table className="w-full text-xs">
              <thead>
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
