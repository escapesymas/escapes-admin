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

type SortField = 'id' | 'name' | 'orders_desc' | 'orders_asc' | 'spent_desc' | 'spent_asc' | 'date_desc' | 'date_asc';

export const UsersTab: React.FC<UsersTabProps> = ({ users, adminToken, onUserSaved }) => {
  const { showToast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('id');

  // Filtrado de usuarios
  let filtered = users.filter(u => {
    if (roleFilter !== 'all' && (u.role || 'customer') !== roleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const phone = (u.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || username.includes(q) || phone.includes(q) || u.id.toString().includes(q);
    }
    return true;
  });

  // Ordenación de usuarios
  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'id':
        return a.id - b.id;
      case 'name': {
        const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.username || a.email;
        const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim() || b.username || b.email;
        return nameA.localeCompare(nameB);
      }
      case 'orders_desc':
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      case 'orders_asc':
        return (a.totalOrders || 0) - (b.totalOrders || 0);
      case 'spent_desc':
        return (b.totalSpentCents || 0) - (a.totalSpentCents || 0);
      case 'spent_asc':
        return (a.totalSpentCents || 0) - (b.totalSpentCents || 0);
      case 'date_desc':
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      case 'date_asc':
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      default:
        return 0;
    }
  });

  const handleOpenDetail = (user: User, editMode = false) => {
    let parsedBilling: UserBilling = {};
    try {
      parsedBilling = typeof user.billing === 'string' ? JSON.parse(user.billing) : (user.billing || {});
    } catch (e) {}

    setSelectedUser(user);
    setIsEditing(editMode);
    setEditForm({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'customer',
      address: parsedBilling.address_1 || user.address || '',
      city: parsedBilling.city || user.city || '',
      postcode: parsedBilling.postcode || user.postcode || '',
      phone: parsedBilling.phone || user.phone || ''
    });
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin?action=save-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editForm.id,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          username: editForm.username,
          email: editForm.email,
          role: editForm.role,
          phone: editForm.phone,
          address: editForm.address,
          city: editForm.city,
          postcode: editForm.postcode
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Cliente actualizado con éxito', 'success');
        setIsEditing(false);
        onUserSaved();
        setSelectedUser({
          ...selectedUser,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          username: editForm.username,
          email: editForm.email,
          role: editForm.role,
          billing: {
            address_1: editForm.address,
            city: editForm.city,
            postcode: editForm.postcode,
            phone: editForm.phone
          }
        });
      } else {
        showToast(data.error || 'Error al guardar el usuario', 'error');
      }
    } catch (err) {
      showToast('Error en la conexión con el servidor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.email;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente al cliente ${name} (#${user.id})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin?action=delete-user`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Cliente eliminado correctamente', 'success');
        setSelectedUser(null);
        onUserSaved();
      } else {
        showToast(data.error || 'Error al eliminar el usuario', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al eliminar usuario', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra de Filtros, Búsqueda y Ordenación */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between bg-tech-card border border-tech-border rounded-2xl p-4 shadow-xl">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Icons.Search className="absolute left-4 top-3.5 w-4 h-4 text-tech-muted" />
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar por cliente, email, nick o ID..."
            className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl pl-11 pr-4 py-2.5 text-xs text-tech-text placeholder-zinc-500 focus:outline-none focus:border-tech-yellow transition-all"
          />
        </div>

        {/* Filtro por Rol */}
        <div className="flex items-center gap-1.5 shrink-0">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'customer', label: 'Clientes' },
            { id: 'admin', label: 'Admins' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setRoleFilter(chip.id)}
              className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                roleFilter === chip.id
                  ? 'bg-tech-yellow/15 text-tech-yellow border-tech-yellow/30'
                  : 'bg-[#1a1b1e] text-tech-muted border-tech-border hover:text-zinc-300'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Criterio de Ordenación */}
        <div className="flex items-center gap-2 shrink-0">
          <Icons.ArrowUpDown className="w-4 h-4 text-tech-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="bg-[#1a1b1e] border border-tech-border text-tech-text text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-tech-yellow font-medium"
          >
            <option value="id">Orden: Nº ID (Antigüedad)</option>
            <option value="name">Alfabético (Nombre)</option>
            <option value="orders_desc">Más Compras realizadas</option>
            <option value="orders_asc">Menos Compras realizadas</option>
            <option value="spent_desc">Mayor Gastado (€)</option>
            <option value="spent_asc">Menor Gastado (€)</option>
            <option value="date_desc">Más Recientes primero</option>
            <option value="date_asc">Más Antiguos primero</option>
          </select>
        </div>
      </div>

      {/* Tabla de Clientes */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                <th className="pb-4">ID</th>
                <th className="pb-4">Cliente</th>
                <th className="pb-4">Email</th>
                <th className="pb-4">Compras</th>
                <th className="pb-4">Total Gastado</th>
                <th className="pb-4">Rol</th>
                <th className="pb-4">Registro</th>
                <th className="pb-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-tech-muted italic text-xs">
                    No se encontraron clientes con el criterio de búsqueda seleccionado.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => {
                  const spentEur = ((u.totalSpentCents || 0) / 100).toFixed(2);
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 font-mono text-xs text-tech-muted">#{u.id}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-tech-yellow/10 border border-tech-yellow/30 flex items-center justify-center font-bold text-tech-yellow text-xs">
                            {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-tech-text text-xs block group-hover:text-tech-yellow transition-colors">
                              {u.firstName || ''} {u.lastName || ''} {!u.firstName && (u.username || 'Cliente')}
                            </span>
                            {u.username && <span className="text-[10px] text-tech-muted font-mono">@{u.username}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 font-mono text-xs text-[#cbd5e1]">{u.email}</td>
                      <td className="py-4">
                        <span className="inline-flex items-center gap-1 bg-[#1a1b1e] border border-tech-border px-2.5 py-1 rounded-lg font-mono text-xs text-tech-text">
                          <Icons.ShoppingBag className="w-3 h-3 text-tech-yellow" />
                          {u.totalOrders || 0}
                        </span>
                      </td>
                      <td className="py-4 font-mono text-xs font-bold text-emerald-400">
                        {spentEur} €
                      </td>
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
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetail(u, false)}
                            className="px-3 py-1.5 bg-tech-yellow/10 hover:bg-tech-yellow/20 text-tech-yellow border border-tech-yellow/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                          >
                            <Icons.UserCheck className="w-3.5 h-3.5" />
                            Ver Dashboard
                          </button>
                          <button
                            onClick={() => handleOpenDetail(u, true)}
                            className="p-1.5 text-tech-muted hover:text-tech-text bg-[#1a1b1e] hover:bg-tech-border rounded-lg border border-tech-border transition-colors"
                            title="Editar Cliente"
                          >
                            <Icons.Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-red-400/70 hover:text-red-400 bg-red-950/20 hover:bg-red-900/30 rounded-lg border border-red-900/30 transition-colors"
                            title="Eliminar Cliente"
                          >
                            <Icons.Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DASHBOARD / EDIT MODAL DEL CLIENTE */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-tech-carbon/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl animate-fade-in relative">
            
            {/* Cabecera del Modal */}
            <div className="flex justify-between items-start border-b border-tech-border pb-6 mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-tech-yellow/15 border border-tech-yellow/40 rounded-2xl flex items-center justify-center text-tech-yellow font-black text-xl shadow-lg">
                  {(selectedUser.firstName?.[0] || selectedUser.username?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black italic uppercase tracking-wider text-tech-text">
                      {selectedUser.firstName} {selectedUser.lastName} {!selectedUser.firstName && (selectedUser.username || 'Cliente')}
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      selectedUser.role === 'admin' ? 'bg-red-950/40 text-red-400 border border-red-900/40' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {selectedUser.role || 'customer'}
                    </span>
                  </div>
                  <p className="text-xs text-tech-muted font-mono mt-0.5">
                    ID Cliente: #{selectedUser.id} | Registrado: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('es-ES') : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 rounded-xl text-xs font-black uppercase italic tracking-wider transition-all flex items-center gap-2 shadow-lg"
                  >
                    <Icons.Edit2 className="w-4 h-4" /> Editar Datos
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
                  >
                    Ver Dashboard
                  </button>
                )}

                <button
                  onClick={() => handleDeleteUser(selectedUser)}
                  className="p-2 text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/40 rounded-xl transition-all"
                  title="Eliminar Cliente"
                >
                  <Icons.Trash2 className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 text-tech-muted hover:text-tech-text bg-[#1a1b1e] border border-tech-border rounded-xl"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODO VISTA: DASHBOARD DEL CLIENTE */}
            {!isEditing ? (
              <div className="space-y-6">
                {/* Tarjetas resumen de métricas del cliente */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-4 flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
                      <Icons.DollarSign className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] text-tech-muted font-black uppercase tracking-widest block">Total Gastado</span>
                      <span className="text-lg font-black font-mono text-emerald-400">
                        {((selectedUser.totalSpentCents || 0) / 100).toFixed(2)} €
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-4 flex items-center gap-3">
                    <div className="p-3 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg">
                      <Icons.ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] text-tech-muted font-black uppercase tracking-widest block">Pedidos Realizados</span>
                      <span className="text-lg font-black font-mono text-white">
                        {selectedUser.totalOrders || 0} compras
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-4 flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
                      <Icons.ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] text-tech-muted font-black uppercase tracking-widest block">Nivel / Rango</span>
                      <span className="text-lg font-black font-mono text-blue-400">
                        Rango #{selectedUser.id}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalles Personales y de Contacto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-[#1a1b1e]/40 border border-tech-border rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2 border-b border-tech-border/60 pb-2">
                      <Icons.User className="w-4 h-4" /> Información Personal
                    </h4>
                    <div className="text-xs space-y-2 text-slate-300">
                      <p><span className="text-tech-muted font-semibold">Nombre:</span> {selectedUser.firstName || '-'} {selectedUser.lastName || ''}</p>
                      <p><span className="text-tech-muted font-semibold">Email:</span> <span className="font-mono text-white">{selectedUser.email}</span></p>
                      <p><span className="text-tech-muted font-semibold">Nick (@username):</span> <span className="font-mono">{selectedUser.username || '-'}</span></p>
                      <p><span className="text-tech-muted font-semibold">Teléfono:</span> <span className="font-mono">{editForm.phone || '-'}</span></p>
                    </div>
                  </div>

                  <div className="bg-[#1a1b1e]/40 border border-tech-border rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2 border-b border-tech-border/60 pb-2">
                      <Icons.MapPin className="w-4 h-4" /> Dirección de Facturación / Envío
                    </h4>
                    <div className="text-xs space-y-2 text-slate-300">
                      <p><span className="text-tech-muted font-semibold">Calle / Dirección:</span> {editForm.address || '-'}</p>
                      <p><span className="text-tech-muted font-semibold">Ciudad:</span> {editForm.city || '-'}</p>
                      <p><span className="text-tech-muted font-semibold">Código Postal:</span> <span className="font-mono">{editForm.postcode || '-'}</span></p>
                      <p><span className="text-tech-muted font-semibold">País:</span> España</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* MODO EDICIÓN INTEGRADO */
              <div className="space-y-6">
                <h4 className="text-xs font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2 border-b border-tech-border pb-3">
                  <Icons.Edit2 className="w-4 h-4" /> Formulario de Edición de Cliente
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Nombre</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Apellidos</label>
                    <input
                      type="text"
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Nombre de Usuario (@username)</label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Rol en la Plataforma</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none font-semibold"
                    >
                      <option value="customer">Cliente (Customer)</option>
                      <option value="admin">Administrador (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Teléfono</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Dirección de Envío</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Ciudad</label>
                      <input
                        type="text"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-tech-muted mb-1.5">Código Postal</label>
                      <input
                        type="text"
                        value={editForm.postcode}
                        onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-3 text-xs text-tech-text focus:border-tech-yellow outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-tech-border pt-6">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-5 py-2.5 bg-[#1a1b1e] hover:bg-tech-border text-slate-300 rounded-xl text-xs font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveUser}
                    disabled={saving}
                    className="px-6 py-2.5 bg-tech-yellow hover:bg-yellow-500 text-tech-carbon font-black uppercase italic tracking-wider text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <span>Guardando...</span>
                    ) : (
                      <>
                        <Icons.Save className="w-4 h-4" />
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
