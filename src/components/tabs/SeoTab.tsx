import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import type { SeoLink } from '../../types/admin';

interface SeoTabProps {
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
}

const SeoTab: React.FC<SeoTabProps> = ({ adminWpId, adminEmail, adminToken }) => {
  const { showToast } = useToast();
  const [links, setLinks] = useState<SeoLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(1);

  const fetchLinks = async () => {
    try {
      const res = await fetch(`/api/admin?action=seo-autolinks-list`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.ok) setLinks(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleDelete = async (linkId: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar este enlace SEO automático?')) return;
    try {
      const res = await fetch(`/api/admin?action=seo-autolinks-delete`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId })
      });
      if (res.ok) fetchLinks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || !url) return showToast('Faltan datos obligatorios', 'error');

    try {
      const res = await fetch(`/api/admin?action=seo-autolinks-save`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, url, active })
      });
      if (res.ok) {
        setKeyword('');
        setUrl('');
        fetchLinks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="text-tech-muted italic py-12 text-center animate-pulse flex flex-col items-center justify-center gap-3">
        <Icons.Loader2 className="w-8 h-8 text-tech-yellow animate-spin" />
        <span>Sincronizando SEO Manager...</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 lg:col-span-1 h-fit space-y-4">
        <h3 className="text-md font-black uppercase tracking-tighter italic text-zinc-200">Añadir Palabra Clave</h3>
        <p className="text-[10px] text-tech-muted leading-relaxed">
          Registra una palabra clave. Cuando un rider la emplee en el foro paddock, se inyectará un enlace dofollow a la URL catalogada de forma automática.
        </p>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div>
            <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">Palabra Clave</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="E.g. SC-Project"
              className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-xs font-bold text-tech-text focus:outline-none focus:border-tech-yellow"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-tech-muted uppercase tracking-widest block mb-2">URL del Catálogo</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/escapes/sc-project"
              className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl py-3 px-4 text-xs font-bold text-tech-text focus:outline-none focus:border-tech-yellow"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-tech-yellow hover:bg-orange-600 text-tech-text text-xs font-black uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg"
          >
            Guardar Término
          </button>
        </form>
      </div>

      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 lg:col-span-2 space-y-4">
        <h3 className="text-md font-bold text-zinc-100">Diccionario Dinámico de Enlazado (SEO)</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-3">Palabra Clave</th>
                <th className="pb-3">URL Asociada</th>
                <th className="pb-3">Estado</th>
                <th className="pb-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {links.map((lk: SeoLink) => (
                <tr key={lk.id} className="hover:bg-white/[0.01]">
                  <td className="py-3.5 font-bold text-zinc-200">{lk.keyword}</td>
                  <td className="py-3.5 text-[#cbd5e1] font-mono text-xs">{lk.url}</td>
                  <td className="py-3.5">
                    <span
                      className={`inline-block py-1 px-2.5 rounded text-[9px] font-black uppercase italic border ${
                        lk.active
                          ? 'bg-green-950/20 text-green-400 border-green-900/30'
                          : 'bg-[#1a1b1e] text-tech-muted border-tech-border'
                      }`}
                    >
                      {lk.active ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="py-3.5 text-right">
                    <button onClick={() => handleDelete(lk.id)} className="text-zinc-600 hover:text-red-500 p-1.5 transition-all">
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

export default SeoTab;
