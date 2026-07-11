import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { GlobalAttribute, AttributeTerm } from '../../types/admin';

export const AttributesManager = ({ userId, adminEmail, adminToken }: { userId: string, adminEmail: string, adminToken: string }) => {
  const [attributes, setAttributes] = useState<GlobalAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAttrName, setNewAttrName] = useState('');
  const [newTermName, setNewTermName] = useState('');
  const [selectedAttrId, setSelectedAttrId] = useState<number | null>(null);

  useEffect(() => {
    if (adminToken) {
      fetchAttributes();
    }
  }, [adminToken]);

  const fetchAttributes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin?action=get-attributes`, { headers: { 'Authorization': `Bearer ${adminToken}` } });
      const data = await res.json();
      setAttributes(data);
    } catch (e) {
      console.error('Failed to fetch attributes', e);
    }
    setLoading(false);
  };

  const addAttribute = async () => {
    if (!newAttrName.trim()) return;
    try {
      await fetch(`/api/admin?action=add-attribute`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAttrName.trim() })
      });
      setNewAttrName('');
      fetchAttributes();
    } catch (e) {
      console.error(e);
    }
  };

  const addTerm = async (attrId: number) => {
    if (!newTermName.trim()) return;
    try {
      await fetch(`/api/admin?action=add-attribute-term`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attribute_id: attrId, name: newTermName.trim() })
      });
      setNewTermName('');
      setSelectedAttrId(null);
      fetchAttributes();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-tech-card border border-tech-border rounded-2xl p-6 shadow-sm mb-6 text-left">
      <h3 className="text-xl font-black italic uppercase tracking-wider text-tech-text mb-4">Gestor de Atributos Globales</h3>
      <p className="text-xs text-tech-muted mb-6">Crea atributos (ej. Talla, Color) y sus términos (ej. S, M, Rojo, Azul) para usarlos en productos variables.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-sm font-bold uppercase text-zinc-300 mb-3">Atributos</h4>
          <div className="flex gap-2 mb-4">
            <input 
              type="text" 
              value={newAttrName} 
              onChange={e => setNewAttrName(e.target.value)} 
              placeholder="Nombre Atributo (Ej: Talla)"
              className="flex-1 bg-[#1a1b1e] border border-tech-border rounded-xl px-4 py-2 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all"
            />
            <button onClick={addAttribute} className="bg-tech-yellow text-black font-black uppercase text-xs px-4 py-2 rounded-xl hover:bg-yellow-400 transition-colors">Añadir</button>
          </div>
          
          <div className="space-y-2">
            {attributes.map(attr => (
              <div key={attr.id} className="bg-[#1a1b1e] border border-tech-border rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-tech-text text-sm">{attr.name}</span>
                  <button 
                    onClick={() => setSelectedAttrId(selectedAttrId === attr.id ? null : attr.id)} 
                    className="text-[10px] text-tech-yellow hover:underline"
                  >
                    + Añadir Término
                  </button>
                </div>
                
                {selectedAttrId === attr.id && (
                  <div className="flex gap-2 mt-3 mb-3">
                    <input 
                      type="text" 
                      value={newTermName} 
                      onChange={e => setNewTermName(e.target.value)} 
                      placeholder="Nuevo término (Ej: XL)"
                      className="flex-1 bg-zinc-900 border border-tech-border rounded-lg px-3 py-1.5 text-xs text-tech-text placeholder-zinc-600 focus:outline-none"
                    />
                    <button onClick={() => addTerm(attr.id)} className="bg-zinc-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg hover:bg-zinc-700">Guardar</button>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {attr.terms?.length > 0 ? (
                    attr.terms.map((t: AttributeTerm) => (
                      <span key={t.id} className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] px-2 py-1 rounded-md">
                        {t.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-tech-muted italic">Sin términos</span>
                  )}
                </div>
              </div>
            ))}
            {attributes.length === 0 && !loading && (
              <div className="text-xs text-tech-muted italic text-center p-4">No hay atributos definidos.</div>
            )}
            {loading && <div className="text-xs text-tech-muted text-center p-4">Cargando...</div>}
          </div>
        </div>
      </div>
    </div>
  );
};
