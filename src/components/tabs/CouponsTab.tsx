import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';
import type { Coupon } from '../../types/admin';

interface CouponsTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
}

const CouponsTab: React.FC<CouponsTabProps> = ({ adminWpId, adminEmail, adminToken }) => {
  const { showToast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [code, setCode] = useState('');
  const [type, setType] = useState('percent');
  const [value, setValue] = useState('');
  const [maxUses, setMaxUses] = useState('999999');
  const [expiresAt, setExpiresAt] = useState('');
  const [active, setActive] = useState(1);

  const fetchCoupons = async () => {
    try {
      const res = await fetch(`/api/admin?action=coupons-list`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) setCoupons(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  const handleDelete = async (couponId: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este cupón?')) return;
    try {
      const res = await fetch(`/api/admin?action=delete-coupon`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponId })
      });
      if (res.ok) {
        fetchCoupons();
        showToast('Cupón eliminado');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !value) return showToast('Faltan datos', 'error');

    try {
      const valNum = type === 'fixed' ? Math.round(parseFloat(value) * 100) : parseFloat(value);
      const res = await fetch(`/api/admin?action=create-coupon`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          type,
          value: valNum,
          active,
          expiresAt: expiresAt || null,
          maxUses: parseInt(maxUses)
        })
      });
      if (res.ok) {
        setShowAddForm(false);
        setCode('');
        setValue('');
        setMaxUses('999999');
        setExpiresAt('');
        fetchCoupons();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="text-tech-muted italic py-12 text-center animate-pulse flex flex-col items-center justify-center gap-3">
        <Icons.Loader2 className="w-8 h-8 text-tech-yellow animate-spin" />
        <span>Sincronizando motor de cupones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-zinc-100 uppercase italic tracking-tighter">Marketing y Cupones</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-tech-yellow hover:bg-orange-600 text-tech-text text-xs font-black uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-orange-950/15"
        >
          <Icons.Plus size={14} /> Crear Cupón
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-tech-carbon/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-tech-card border border-tech-border rounded-3xl p-8 max-w-md w-full space-y-6 animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-between items-center border-b border-tech-border pb-4">
              <h4 className="text-lg font-black uppercase tracking-tighter italic text-zinc-200">Nuevo Cupón</h4>
              <button type="button" onClick={() => setShowAddForm(false)} className="text-tech-muted hover:text-tech-text">
                <Icons.X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Código de Cupón</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="E.g. WELCOME20"
                  className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-sm font-bold placeholder-zinc-700 text-tech-text focus:outline-none focus:border-tech-yellow uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Tipo</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-sm font-bold text-tech-text focus:outline-none focus:border-tech-yellow"
                  >
                    <option value="percent">Porcentaje (%)</option>
                    <option value="fixed">Importe Fijo (€)</option>
                    <option value="free_shipping">Envío Gratis</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Valor</label>
                  <input
                    type="number"
                    step="any"
                    value={value}
                    disabled={type === 'free_shipping'}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === 'percent' ? '20' : '15.00'}
                    className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-sm font-bold placeholder-zinc-700 text-tech-text focus:outline-none focus:border-tech-yellow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Límite Usos</label>
                  <input
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-sm font-bold text-tech-text focus:outline-none focus:border-tech-yellow"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Fecha Expiración</label>
                  <input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-sm font-bold text-tech-text focus:outline-none focus:border-tech-yellow"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-tech-yellow hover:bg-orange-600 text-tech-text text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg"
            >
              Crear Cupón
            </button>
          </form>
        </div>
      )}

      <div className="bg-tech-card border border-tech-border rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-3">Código</th>
                <th className="pb-3">Tipo Descuento</th>
                <th className="pb-3">Valor Real</th>
                <th className="pb-3">Canjes Totales</th>
                <th className="pb-3">Fecha Vencimiento</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {coupons.map((c: Coupon) => (
                <tr key={c.id} className="hover:bg-white/[0.01]">
                  <td className="py-4 font-black italic text-zinc-200 uppercase tracking-wider">{c.code}</td>
                  <td className="py-4 font-bold text-[#cbd5e1]">
                    {c.type === 'percent' ? 'Porcentaje' : c.type === 'fixed' ? 'Importe Fijo' : 'Envío Gratis'}
                  </td>
                  <td className="py-4 font-black text-tech-text italic">
                    {c.type === 'percent' ? `${c.value}%` : c.type === 'fixed' ? formatPrice(c.value) : 'Coste Cero'}
                  </td>
                  <td className="py-4 text-xs text-tech-muted font-bold">
                    <span className="text-zinc-300 font-mono font-black">{c.times_used}</span> /{' '}
                    {c.max_uses === 999999 ? '∞' : c.max_uses}
                  </td>
                  <td className="py-4 text-xs text-tech-muted">
                    {c.expires_at ? new Date(c.expires_at).toLocaleString() : 'Sin expiración'}
                  </td>
                  <td className="py-4">
                    <span
                      className={`inline-block py-1 px-2.5 rounded text-[9px] font-black uppercase italic border ${
                        c.active
                          ? 'bg-green-950/20 text-green-400 border-green-900/30'
                          : 'bg-[#1a1b1e] text-tech-muted border-tech-border'
                      }`}
                    >
                      {c.active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <button onClick={() => handleDelete(c.id)} className="text-zinc-600 hover:text-red-500 p-1.5 transition-all">
                      <Icons.Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CouponsTab;
