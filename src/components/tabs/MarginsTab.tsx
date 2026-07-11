import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';

interface MarginsTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
}

const MarginsTab: React.FC<MarginsTabProps> = ({ adminWpId, adminEmail, adminToken }) => {
  const { showToast } = useToast();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [newRule, setNewRule] = useState({
    ruleType: 'global',
    targetId: '',
    marginPercent: ''
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=pricing-rules-list`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRules(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRule.ruleType || newRule.marginPercent === '') return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=save-pricing-rule`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      if (res.ok) {
        setNewRule({ ruleType: 'global', targetId: '', marginPercent: '' });
        fetchRules();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error de red: ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar esta regla?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=delete-pricing-rule`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculatePrices = async () => {
    if (!confirm('⚠️ ¿Estás seguro? Esto recalculará y actualizará de inmediato el precio de venta de TODOS los productos en base a las reglas activas.')) return;
    setRecalculating(true);
    try {
      const res = await fetch(`/api/admin?action=recalculate-all-prices`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`¡Completado! Precios recalculados: ${data.updatedCount} productos modificados.`);
      } else {
        showToast(`Error: ${data.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error de red: ${(err as Error).message}`, 'error');
    } finally {
      setRecalculating(false);
    }
  };

  const getCategoryName = (idStr: string) => {
    const cats: Record<string, string> = {
      '1': 'Hard Parts',
      '6': 'Oils (Aceites)',
      '7': 'Tyres (Neumáticos)',
      '9': 'Rider Gear',
      '10': 'Accessories (Accesorios)'
    };
    return cats[idStr] || `Categoría #${idStr}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Recalculate Prices Alert Card */}
      <div className="bg-gradient-to-r from-racing-orange/10 via-orange-950/20 to-zinc-950 border border-tech-yellow/30 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-left">
          <div className="w-12 h-12 rounded-xl bg-tech-yellow/10 border border-tech-yellow/35 flex items-center justify-center text-tech-yellow shrink-0">
            <Icons.TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase tracking-wider italic text-tech-text">Recálculo Masivo de Tarifas</h3>
            <p className="text-xs text-[#cbd5e1] mt-1 max-w-xl">
              Aplica de manera global las reglas de margen sobre el coste de distribuidor y actualiza el precio de venta final de tu catálogo en PostgreSQL al instante.
            </p>
          </div>
        </div>
        <button
          onClick={handleRecalculatePrices}
          disabled={recalculating || loading}
          className="w-full md:w-auto bg-tech-yellow hover:bg-orange-600 disabled:bg-[#1a1b1e] border border-tech-yellow/20 hover:border-orange-500/30 text-tech-text px-6 py-4 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-950/20 shrink-0"
        >
          {recalculating ? (
            <>
              <Icons.Loader2 className="w-4 h-4 animate-spin" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <Icons.RefreshCw className="w-4 h-4" />
              <span>Ejecutar Recálculo</span>
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Edit Rule Form */}
        <div className="bg-tech-card border border-tech-border p-6 rounded-2xl">
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text mb-6 border-b border-tech-border pb-3 flex items-center gap-2">
            <Icons.PlusCircle className="w-4 h-4 text-tech-yellow" />
            <span>Crear Regla de Margen</span>
          </h3>

          <form onSubmit={handleSaveRule} className="space-y-4 text-xs text-left">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-2">Ámbito de la Regla</label>
              <select
                value={newRule.ruleType}
                onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value, targetId: '' })}
                className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-tech-text focus:outline-none focus:border-tech-yellow font-medium"
              >
                <option value="global">Margen Global (Default)</option>
                <option value="category">Margen por Categoría</option>
                <option value="brand">Margen por Marca</option>
              </select>
            </div>

            {newRule.ruleType === 'category' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-2">Seleccionar Categoría</label>
                <select
                  value={newRule.targetId}
                  onChange={(e) => setNewRule({ ...newRule, targetId: e.target.value })}
                  required
                  className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-tech-text focus:outline-none focus:border-tech-yellow font-medium"
                >
                  <option value="">-- Elige una categoría --</option>
                  <option value="1">Hard Parts (1)</option>
                  <option value="6">Oils (6)</option>
                  <option value="7">Tyres (7)</option>
                  <option value="9">Rider Gear (9)</option>
                  <option value="10">Accessories (10)</option>
                </select>
              </div>
            )}

            {newRule.ruleType === 'brand' && (
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-2">Nombre de la Marca</label>
                <input
                  type="text"
                  placeholder="Ej: Akrapovic, Bihr, Alpinestars"
                  value={newRule.targetId}
                  onChange={(e) => setNewRule({ ...newRule, targetId: e.target.value })}
                  required
                  className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 text-tech-text focus:outline-none focus:border-tech-yellow font-medium"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-2">Margen Comercial (%)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Ej: 25"
                  value={newRule.marginPercent}
                  onChange={(e) => setNewRule({ ...newRule, marginPercent: e.target.value })}
                  required
                  className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-3 pr-10 text-tech-text focus:outline-none focus:border-tech-yellow font-medium"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-550 font-bold">%</span>
              </div>
              <p className="text-[9px] text-zinc-550 mt-1">Suma el porcentaje indicado sobre el coste neto.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1a1b1e] hover:bg-zinc-850 border border-tech-border hover:border-zinc-700 text-tech-text py-3.5 rounded-xl font-black uppercase italic tracking-wider transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Icons.Loader2 className="w-4 h-4 animate-spin" /> : <Icons.CheckCircle className="w-4 h-4 text-tech-yellow" />}
              <span>Guardar Regla</span>
            </button>
          </form>
        </div>

        {/* Rules List */}
        <div className="bg-tech-card border border-tech-border p-6 rounded-2xl lg:col-span-2 text-left">
          <h3 className="text-sm font-black uppercase tracking-wider italic text-tech-text mb-6 border-b border-tech-border pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icons.Sliders className="w-4 h-4 text-tech-yellow" />
              <span>Reglas de Precios Activas</span>
            </div>
            <button
              onClick={fetchRules}
              className="p-1 hover:bg-[#1a1b1e] rounded-lg text-tech-muted hover:text-tech-text transition-all"
            >
              <Icons.RotateCw className="w-4 h-4" />
            </button>
          </h3>

          <div className="overflow-hidden border border-tech-border rounded-xl">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#1a1b1e]/40 border-b border-tech-border text-zinc-550 text-[9px] font-black uppercase tracking-wider">
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Objetivo</th>
                  <th className="p-4 text-right">Margen</th>
                  <th className="p-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 bg-tech-card">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-tech-muted font-medium">
                      No hay reglas de precios configuradas. Se aplicará un margen del +20% por defecto.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-[#1a1b1e]/20 transition-colors">
                      <td className="p-4 font-black italic uppercase tracking-wider text-zinc-300">
                        {rule.rule_type === 'global' && <span className="text-orange-400">Global</span>}
                        {rule.rule_type === 'category' && <span className="text-blue-400">Categoría</span>}
                        {rule.rule_type === 'brand' && <span className="text-purple-400">Marca</span>}
                      </td>
                      <td className="p-4 font-medium text-tech-text">
                        {rule.rule_type === 'global' && 'Catálogo Completo'}
                        {rule.rule_type === 'category' && getCategoryName(rule.target_id)}
                        {rule.rule_type === 'brand' && rule.target_id}
                      </td>
                      <td className="p-4 text-right font-black italic text-tech-yellow text-sm">
                        +{rule.margin_percent}%
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="bg-red-950/20 hover:bg-red-950/40 border border-red-900/20 hover:border-red-900/40 text-red-500 p-2 rounded-lg transition-all"
                        >
                          <Icons.Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarginsTab;
