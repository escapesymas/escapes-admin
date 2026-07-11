import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Save, Edit2, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '../ToastContext';
import { formatPrice } from '../../utils/format';

interface Method {
  id?: number;
  zone_id: number;
  name: string;
  cost: number;
  active: number;
  free_shipping_threshold: number | null;
}

interface Zone {
  id: number;
  name: string;
  regions: string[];
  methods: Method[];
}

interface ShippingTabProps {
  adminWpId: string;
  adminEmail: string;
  adminToken: string;
}

export default function ShippingTab({ adminWpId, adminEmail, adminToken }: ShippingTabProps) {
  const { showToast } = useToast();
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingZone, setEditingZone] = useState<Partial<Zone> | null>(null);
  const [editingMethod, setEditingMethod] = useState<Partial<Method> | null>(null);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=shipping-zones-list`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setZones(data);
      } else {
        console.error('API Error:', data);
        setError(data.error || 'Error al cargar las zonas de envío');
        setZones([]);
      }
    } catch (err) {
      console.error(err);
      setError('Error al cargar las zonas de envío');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!editingZone?.name || !editingZone?.regions) {
      showToast('Rellena todos los campos', 'error');
      return;
    }
    
    // Convert regions string "ES, ES-07" to array
    let regionsArray: string[] = [];
    if (typeof editingZone.regions === 'string') {
      regionsArray = (editingZone.regions as string).split(',').map(r => r.trim()).filter(r => r);
    } else {
      regionsArray = editingZone.regions;
    }

    try {
      await fetch(`/api/admin?action=save-shipping-zone`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingZone.id,
          name: editingZone.name,
          regions: regionsArray
        })
      });
      setEditingZone(null);
      fetchZones();
    } catch (err) {
      showToast('Error guardando la zona', 'error');
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    if (!window.confirm('¿Seguro que quieres borrar esta zona? Se borrarán sus tarifas.')) return;
    try {
      await fetch(`/api/admin?action=delete-shipping-zone`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ zoneId })
      });
      fetchZones();
    } catch (err) {
      showToast('Error borrando la zona', 'error');
    }
  };

  const handleSaveMethod = async () => {
    if (!editingMethod?.name || editingMethod?.cost === undefined || !editingMethod?.zone_id) {
      showToast('Rellena los campos mínimos: Nombre y Coste', 'error');
      return;
    }
    try {
      await fetch(`/api/admin?action=save-shipping-method`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMethod.id,
          zoneId: editingMethod.zone_id,
          name: editingMethod.name,
          cost: editingMethod.cost,
          active: editingMethod.active ?? 1,
          freeShippingThreshold: editingMethod.free_shipping_threshold || null
        })
      });
      setEditingMethod(null);
      fetchZones();
    } catch (err) {
      showToast('Error guardando el método', 'error');
    }
  };

  const handleDeleteMethod = async (methodId: number) => {
    if (!window.confirm('¿Seguro que quieres borrar este método de envío?')) return;
    try {
      await fetch(`/api/admin?action=delete-shipping-method`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodId })
      });
      fetchZones();
    } catch (err) {
      showToast('Error borrando el método', 'error');
    }
  };

  if (loading && zones.length === 0) {
    return <div className="p-8 flex items-center justify-center text-tech-muted"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex justify-between items-center bg-tech-card p-6 rounded-md border border-tech-border">
        <div>
          <h2 className="text-2xl font-mono font-bold text-tech-text flex items-center gap-2">
            <Truck className="w-6 h-6 text-tech-yellow" /> Zonas y Tarifas de Envío
          </h2>
          <p className="text-tech-muted mt-1 text-sm">Gestiona dónde envías y cuánto cuesta. Los clientes pagarán según su país o código postal.</p>
        </div>
        <button
          onClick={() => setEditingZone({ name: '', regions: [] })}
          className="bg-tech-yellow text-black font-bold px-4 py-2 rounded-md flex items-center gap-2 hover:opacity-80 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> Añadir Zona
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-500 px-4 py-3 rounded-md flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Editor de Zona */}
      {editingZone && (
        <div className="bg-tech-card border border-tech-yellow/50 p-6 rounded-md">
          <h3 className="text-lg font-mono font-bold text-tech-yellow mb-4">
            {editingZone.id ? 'Editar Zona' : 'Nueva Zona'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Nombre de la Zona</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingZone.name || ''} 
                onChange={e => setEditingZone({...editingZone, name: e.target.value})}
                placeholder="Ej. España Península"
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Regiones (separadas por coma)</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none font-mono text-sm"
                value={typeof editingZone.regions === 'string' ? editingZone.regions : (editingZone.regions || []).join(', ')} 
                onChange={e => setEditingZone({...editingZone, regions: e.target.value as unknown as string[]})}
                placeholder="Ej. ES, FR, IT, ES-07"
              />
              <p className="text-[10px] text-tech-muted mt-1">Usa códigos de país (ES) o prefijos postales (ES-07 para Baleares).</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditingZone(null)} className="px-4 py-2 border border-tech-border text-tech-muted rounded-md hover:text-tech-text">Cancelar</button>
            <button onClick={handleSaveZone} className="px-4 py-2 bg-tech-yellow text-black rounded-md font-bold hover:opacity-80 flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
          </div>
        </div>
      )}

      {/* Editor de Método */}
      {editingMethod && (
        <div className="bg-tech-card border border-tech-yellow/50 p-6 rounded-md">
          <h3 className="text-lg font-mono font-bold text-tech-yellow mb-4">
            {editingMethod.id ? 'Editar Tarifa' : 'Nueva Tarifa'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Nombre de Tarifa</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingMethod.name || ''} 
                onChange={e => setEditingMethod({...editingMethod, name: e.target.value})}
                placeholder="Ej. Envío Estándar"
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Coste (Céntimos)</label>
              <input 
                type="number"
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none font-mono"
                value={editingMethod.cost ?? ''} 
                onChange={e => setEditingMethod({...editingMethod, cost: e.target.value === '' ? undefined : parseInt(e.target.value)})}
                placeholder="Ej. 499 para 4.99€"
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Gratis a partir de (€)</label>
              <input 
                type="number"
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none font-mono"
                value={editingMethod.free_shipping_threshold ?? ''} 
                onChange={e => setEditingMethod({...editingMethod, free_shipping_threshold: e.target.value ? parseFloat(e.target.value) : null})}
                placeholder="Ej. 50 (Opcional)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditingMethod(null)} className="px-4 py-2 border border-tech-border text-tech-muted rounded-md hover:text-tech-text">Cancelar</button>
            <button onClick={handleSaveMethod} className="px-4 py-2 bg-tech-yellow text-black rounded-md font-bold hover:opacity-80 flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
          </div>
        </div>
      )}

      {/* Lista de Zonas */}
      <div className="space-y-4">
        {zones.map(zone => (
          <div key={zone.id} className="bg-tech-card border border-tech-border rounded-md overflow-hidden">
            <div className="bg-tech-carbon p-4 border-b border-tech-border flex justify-between items-center">
              <div>
                <h3 className="font-bold text-tech-text font-mono">{zone.name}</h3>
                <p className="text-xs text-tech-muted mt-1">
                  Regiones: <span className="font-mono bg-tech-carbon px-1 py-0.5 rounded border border-tech-border">{zone.regions.join(', ')}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingZone(zone)} className="p-2 text-tech-muted hover:text-tech-yellow bg-tech-carbon rounded border border-tech-border"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => handleDeleteZone(zone.id)} className="p-2 text-tech-muted hover:text-red-500 bg-tech-carbon rounded border border-tech-border"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-tech-text">Tarifas Disponibles</h4>
                <button 
                  onClick={() => setEditingMethod({ zone_id: zone.id, name: '', cost: 0, active: 1, free_shipping_threshold: null })}
                  className="text-xs font-bold text-tech-yellow flex items-center gap-1 hover:opacity-80"
                >
                  <Plus className="w-3 h-3" /> Añadir Tarifa
                </button>
              </div>
              
              {zone.methods.length === 0 ? (
                <p className="text-xs text-tech-muted italic">No hay tarifas configuradas para esta zona.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {zone.methods.map(method => (
                    <div key={method.id} className="border border-tech-border rounded-md p-3 flex justify-between items-center bg-[#1a1b1e]">
                      <div>
                        <span className="font-bold text-tech-text text-sm">{method.name}</span>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-mono text-black bg-tech-yellow px-1.5 py-0.5 rounded-md">{formatPrice(method.cost)}</span>
                          {method.free_shipping_threshold ? (
                            <span className="text-[10px] text-tech-yellow border border-tech-yellow/30 rounded-md px-1.5 py-0.5">Gratis {'>'} {method.free_shipping_threshold}€</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingMethod(method)} className="text-tech-muted hover:text-tech-yellow"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteMethod(method.id!)} className="text-tech-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
