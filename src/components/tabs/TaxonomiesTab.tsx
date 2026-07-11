import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import type { Category, VehicleBrand, VehicleModel } from '../../types/admin';

interface TaxonomiesTabProps {
  userId: string;
  adminEmail: string;
  adminToken: string;
  onSelectCategory?: (category: Category) => void;
}

export const TaxonomiesTab: React.FC<TaxonomiesTabProps> = ({ userId, adminEmail, adminToken, onSelectCategory }) => {
  const [activeSection, setActiveSection] = useState<'categories' | 'tags' | 'vehicles'>('categories');
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  
  const [loading, setLoading] = useState(true);

  // Forms states
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catParent, setCatParent] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const handleEditCategoryClick = (category: Category) => {
    setEditingCategory(category);
    setCatName(category.name || '');
    setCatSlug(category.slug || '');
    setCatParent(category.parent_id ? category.parent_id.toString() : '');
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatParent('');
  };

  const handleSaveCategory = () => {
    const payload = {
      id: editingCategory ? editingCategory.id : undefined,
      name: catName,
      slug: catSlug,
      parent_id: catParent ? parseInt(catParent) : null
    };
    handleAction('save-category', payload);
    setCatName('');
    setCatSlug('');
    setCatParent('');
    setEditingCategory(null);
  };
  
  const [tagName, setTagName] = useState('');
  const [tagSlug, setTagSlug] = useState('');

  const [brandName, setBrandName] = useState('');
  const [modelBrandId, setModelBrandId] = useState('');
  const [modelName, setModelName] = useState('');
  
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, tagRes, brRes] = await Promise.all([
        fetch(`/api/admin?action=get-categories`, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch(`/api/admin?action=get-tags`, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json()),
        fetch(`/api/admin?action=get-vehicle-brands`, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json())
      ]);
      setCategories(Array.isArray(catRes) ? catRes : []);
      setTags(Array.isArray(tagRes) ? tagRes : []);
      setBrands(Array.isArray(brRes) ? brRes : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const fetchModels = async (brandFilter: string) => {
    if (!brandFilter) {
      setModels([]);
      return;
    }
    try {
      const modRes = await fetch(`/api/admin?action=get-vehicle-models`, { headers: { 'Authorization': `Bearer ${adminToken}` } }).then(r => r.json());
      const allModels: VehicleModel[] = Array.isArray(modRes) ? modRes : [];
      setModels(allModels.filter(m => m.brand_id.toString() === brandFilter));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchData();
    }
  }, [adminToken]);

  useEffect(() => {
    fetchModels(selectedBrandFilter);
  }, [selectedBrandFilter, adminToken]);

  const handleAction = async (action: string, payload: any) => {
    try {
      await fetch(`/api/admin?action=${action}`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const inputClass = "w-full bg-zinc-900 border border-tech-border rounded-lg px-3 py-2 text-xs text-tech-text placeholder-zinc-600 focus:outline-none focus:border-tech-yellow transition-all";
  const btnClass = "bg-tech-yellow text-black font-bold uppercase tracking-widest text-[10px] px-4 py-2 rounded-lg hover:bg-yellow-400 flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(255,221,0,0.2)]";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-4 border-b border-tech-border pb-4">
        <button onClick={() => setActiveSection('categories')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${activeSection === 'categories' ? 'bg-tech-yellow text-black' : 'text-tech-muted hover:text-tech-text'}`}>Categorías</button>
        <button onClick={() => setActiveSection('tags')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${activeSection === 'tags' ? 'bg-tech-yellow text-black' : 'text-tech-muted hover:text-tech-text'}`}>Etiquetas</button>
        <button onClick={() => setActiveSection('vehicles')} className={`text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg transition-all ${activeSection === 'vehicles' ? 'bg-tech-yellow text-black' : 'text-tech-muted hover:text-tech-text'}`}>Motos Compatibles</button>
      </div>

      {loading ? (
        <div className="text-tech-muted text-xs italic">Cargando taxonomías...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CATEGORIES SECTION */}
          {activeSection === 'categories' && (
            <>
              <div className="md:col-span-1 bg-[#1a1b1e] border border-tech-border rounded-xl p-5">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.FolderTree className="w-4 h-4 text-tech-yellow"/> {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                <div className="space-y-3">
                  <input placeholder="Nombre de categoría" value={catName} onChange={e => {setCatName(e.target.value); setCatSlug(e.target.value.toLowerCase().replace(/ /g, '-'));}} className={inputClass} />
                  <input placeholder="Slug (url-amigable)" value={catSlug} onChange={e => setCatSlug(e.target.value)} className={inputClass} />
                  <select value={catParent} onChange={e => setCatParent(e.target.value)} className={inputClass}>
                    <option value="">Ninguna (Categoría Padre)</option>
                    {categories.filter(c => !editingCategory || c.id !== editingCategory.id).map(c => (
                      <option key={c.id} value={c.id}>
                        {c.depth > 1 ? '—'.repeat(c.depth - 1) + ' ' : ''}{c.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleSaveCategory} className={btnClass + " w-full mt-2"}>
                    {editingCategory ? 'Guardar Cambios' : 'Añadir Categoría'}
                  </button>
                  {editingCategory && (
                    <button onClick={handleCancelEdit} className="w-full mt-2 bg-zinc-900 hover:bg-zinc-800 text-[#cbd5e1] border border-tech-border rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors">
                      Cancelar Edición
                    </button>
                  )}
                </div>
              </div>
              <div className="md:col-span-2 bg-[#1a1b1e] border border-tech-border rounded-xl p-5 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] text-tech-muted uppercase border-b border-tech-border">
                    <tr>
                      <th className="pb-2">Nombre</th>
                      <th className="pb-2">Slug</th>
                      <th className="pb-2">Productos</th>
                      <th className="pb-2 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(c => (
                      <tr key={c.id} className="border-b border-zinc-800/50">
                        <td className="py-2">
                          {onSelectCategory ? (
                            <button
                              type="button"
                              onClick={() => onSelectCategory(c)}
                              className="text-left font-bold text-tech-text hover:text-tech-yellow hover:underline cursor-pointer transition-colors"
                              title={`Ver productos de la categoría: ${c.name}`}
                            >
                              {c.depth > 1 ? '—'.repeat(c.depth - 1) + ' ' : ''}{c.name}
                            </button>
                          ) : (
                            <span>{c.depth > 1 ? '—'.repeat(c.depth - 1) + ' ' : ''}{c.name}</span>
                          )}
                        </td>
                        <td className="py-2 text-tech-muted">{c.slug}</td>
                        <td className="py-2 text-tech-muted font-mono">{c.product_count || 0}</td>
                        <td className="py-2 text-right flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditCategoryClick(c)}
                            className="text-[#cbd5e1] hover:text-tech-yellow p-1 transition-colors"
                            title={`Editar: ${c.name}`}
                          >
                            <Icons.Edit3 className="w-4 h-4 inline"/>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAction('delete-category', { id: c.id })}
                            className="text-red-500 hover:text-red-400 p-1 transition-colors"
                            title={`Eliminar: ${c.name}`}
                          >
                            <Icons.Trash2 className="w-4 h-4 inline"/>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAGS SECTION */}
          {activeSection === 'tags' && (
            <>
              <div className="md:col-span-1 bg-[#1a1b1e] border border-tech-border rounded-xl p-5">
                <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.Tags className="w-4 h-4 text-tech-yellow"/> Nueva Etiqueta</h3>
                <div className="space-y-3">
                  <input placeholder="Nombre etiqueta" value={tagName} onChange={e => {setTagName(e.target.value); setTagSlug(e.target.value.toLowerCase().replace(/ /g, '-'));}} className={inputClass} />
                  <input placeholder="Slug" value={tagSlug} onChange={e => setTagSlug(e.target.value)} className={inputClass} />
                  <button onClick={() => { handleAction('save-tag', { name: tagName, slug: tagSlug }); setTagName(''); setTagSlug(''); }} className={btnClass + " w-full mt-2"}>Añadir Etiqueta</button>
                </div>
              </div>
              <div className="md:col-span-2 bg-[#1a1b1e] border border-tech-border rounded-xl p-5 overflow-x-auto">
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-zinc-900 border border-tech-border px-3 py-1.5 rounded-full text-xs">
                      <span>{t.name}</span>
                      <button onClick={() => handleAction('delete-tag', { id: t.id })} className="text-red-500 hover:text-red-400"><Icons.X size={12}/></button>
                    </div>
                  ))}
                  {tags.length === 0 && <span className="text-tech-muted text-xs italic">No hay etiquetas.</span>}
                </div>
              </div>
            </>
          )}

          {/* VEHICLES SECTION */}
          {activeSection === 'vehicles' && (
            <>
              <div className="md:col-span-1 space-y-6">
                <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-5">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.Settings2 className="w-4 h-4 text-tech-yellow"/> Nueva Marca</h3>
                  <div className="space-y-3">
                    <input placeholder="Ej. Yamaha" value={brandName} onChange={e => setBrandName(e.target.value)} className={inputClass} />
                    <button onClick={() => { handleAction('save-vehicle-brand', { name: brandName }); setBrandName(''); }} className={btnClass + " w-full"}>Añadir Marca</button>
                  </div>
                </div>

                <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-5">
                  <h3 className="text-sm font-black uppercase tracking-widest mb-4 flex items-center gap-2"><Icons.Settings2 className="w-4 h-4 text-tech-yellow"/> Nuevo Modelo</h3>
                  <div className="space-y-3">
                    <select value={modelBrandId} onChange={e => setModelBrandId(e.target.value)} className={inputClass}>
                      <option value="">Seleccionar Marca</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <input placeholder="Ej. MT-07" value={modelName} onChange={e => setModelName(e.target.value)} className={inputClass} />
                    <button onClick={() => { handleAction('save-vehicle-model', { brand_id: modelBrandId, name: modelName }); setModelName(''); }} className={btnClass + " w-full"}>Añadir Modelo</button>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-[#1a1b1e] border border-tech-border rounded-xl p-5 overflow-x-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest">Catálogo de Vehículos</h3>
                  <select value={selectedBrandFilter} onChange={e => setSelectedBrandFilter(e.target.value)} className="bg-zinc-900 border border-tech-border rounded-lg px-3 py-1.5 text-xs text-tech-text">
                    <option value="">-- Todas las Marcas --</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                
                  <table className="w-full text-left text-xs">
                    <thead className="text-[10px] text-tech-muted uppercase border-b border-tech-border"><tr><th className="pb-2">Marca</th><th className="pb-2">Modelo</th><th className="pb-2 text-right">Acciones</th></tr></thead>
                    <tbody>
                      {(() => {
                        if (!selectedBrandFilter) {
                          return (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-tech-muted italic text-[10px]">
                                Selecciona una marca en el filtro superior para ver sus modelos.
                              </td>
                            </tr>
                          );
                        }
                        if (models.length === 0) {
                          const brand = brands.find(b => b.id.toString() === selectedBrandFilter);
                          return (
                            <tr key={'b'+selectedBrandFilter} className="border-b border-zinc-800/50">
                              <td className="py-2 font-bold">{brand?.name || 'Marca'}</td>
                              <td className="py-2 text-tech-muted italic">(Sin modelos)</td>
                              <td className="py-2 text-right">
                                <button onClick={() => handleAction('delete-vehicle-brand', { id: selectedBrandFilter })} className="text-red-500 hover:text-red-400"><Icons.Trash2 className="w-4 h-4 inline"/></button>
                              </td>
                            </tr>
                          );
                        }
                        return models.map(m => (
                          <tr key={m.id} className="border-b border-zinc-800/50">
                            <td className="py-2 font-bold">{m.brand_name}</td>
                            <td className="py-2 text-tech-muted">{m.name}</td>
                            <td className="py-2 text-right">
                              <button onClick={() => handleAction('delete-vehicle-model', { id: m.id })} className="text-red-500 hover:text-red-400"><Icons.Trash2 className="w-4 h-4 inline"/></button>
                            </td>
                          </tr>
                        ));
                      })()}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};
