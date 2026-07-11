import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import type { User, UserBilling, UserRole } from '../../types/admin';

interface UsersTabProps {
  users: User[];
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
  onUserSaved: () => void;
}

const UsersTab: React.FC<UsersTabProps> = ({ users, adminWpId, adminEmail, adminToken, onUserSaved }) => {
  const { showToast } = useToast();
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleSave = async () => {
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin?action=save-user`, {
        method: 'POST',
        headers: { ...{ 'Authorization': `Bearer ${adminToken}` }, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          firstName: editingUser.firstName,
          lastName: editingUser.lastName,
          email: editingUser.email,
          role: editingUser.role,
          phone: editingUser.phone,
          address: editingUser.address,
          city: editingUser.city,
          postcode: editingUser.postcode
        })
      });
      const data = await res.json();
      if (data.success) {
        setEditingUser(null);
        onUserSaved();
      } else {
        showToast(data.error || 'Error al guardar el usuario', 'error');
      }
    } catch (err) {
      showToast('Error en la conexión', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {editingUser && (
        <div className="bg-tech-card border border-tech-yellow/50 p-6 rounded-md">
          <h3 className="text-lg font-mono font-bold text-tech-yellow mb-4">Editar Usuario #{editingUser.id}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Nombre</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.firstName || ''} 
                onChange={e => setEditingUser({...editingUser, firstName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Apellidos</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.lastName || ''} 
                onChange={e => setEditingUser({...editingUser, lastName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Email</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.email || ''} 
                onChange={e => setEditingUser({...editingUser, email: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Rol</label>
              <select 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.role || 'customer'} 
                onChange={e => setEditingUser({...editingUser, role: e.target.value as UserRole})}
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Dirección</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.address || ''} 
                onChange={e => setEditingUser({...editingUser, address: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Ciudad</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.city || ''} 
                onChange={e => setEditingUser({...editingUser, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Código Postal</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.postcode || ''} 
                onChange={e => setEditingUser({...editingUser, postcode: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs text-tech-muted mb-1 font-bold">Teléfono</label>
              <input 
                className="w-full bg-[#1a1b1e] border border-tech-border p-2 rounded-md text-tech-text focus:border-tech-yellow outline-none"
                value={editingUser.phone || ''} 
                onChange={e => setEditingUser({...editingUser, phone: e.target.value})}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditingUser(null)} className="px-4 py-2 border border-tech-border text-tech-muted rounded-md hover:text-tech-text">Cancelar</button>
            <button onClick={handleSave} className="px-4 py-2 bg-tech-yellow text-black rounded-md font-bold hover:opacity-80 flex items-center gap-2">
              <Icons.Save className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>
      )}

      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-4">ID</th>
                <th className="pb-4">Nombre Completo</th>
                <th className="pb-4">Email</th>
                <th className="pb-4">Teléfono</th>
                <th className="pb-4">Rol</th>
                <th className="pb-4">Fecha Registro</th>
                <th className="pb-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-tech-muted italic">No hay usuarios registrados.</td>
                </tr>
              ) : users.map((u) => {
                let billing: UserBilling = { phone: '' };
                try {
                  billing = typeof u.billing === 'string' ? JSON.parse(u.billing) : (u.billing || {});
                } catch(e) {}
                return (
                <tr key={u.id} className="hover:bg-white/[0.01]">
                  <td className="py-4 font-mono text-xs text-tech-muted">#{u.id}</td>
                  <td className="py-4 font-bold text-tech-text">
                    {u.firstName || 'Cliente'} {u.lastName || ''}
                  </td>
                  <td className="py-4 font-mono text-xs text-[#cbd5e1]">{u.email}</td>
                  <td className="py-4 font-mono text-xs text-tech-muted">{billing.phone || '-'}</td>
                  <td className="py-4">
                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                      u.role === 'admin'
                        ? 'bg-red-950/20 text-red-500 border border-red-900/30'
                        : 'bg-[#1a1b1e] text-[#cbd5e1] border border-tech-border'
                    }`}>
                      {u.role || 'customer'}
                    </span>
                  </td>
                  <td className="py-4 text-xs text-tech-muted">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-ES') : '-'}
                  </td>
                  <td className="py-4 text-right">
                    <button onClick={() => {
                      let parsedBilling = { address_1: '', city: '', postcode: '', phone: '' };
                      try {
                        parsedBilling = typeof u.billing === 'string' ? JSON.parse(u.billing) : (u.billing || {});
                      } catch(e) {}
                      setEditingUser({
                        ...u,
                        address: parsedBilling.address_1 || '',
                        city: parsedBilling.city || '',
                        postcode: parsedBilling.postcode || '',
                        phone: parsedBilling.phone || ''
                      });
                    }} className="p-2 text-tech-muted hover:text-tech-yellow bg-tech-carbon rounded border border-tech-border transition-colors">
                      <Icons.Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UsersTab;
