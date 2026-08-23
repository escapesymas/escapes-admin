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

type ViewMode = 'kanban' | 'list';
type SortField = 'id' | 'name' | 'orders_desc' | 'orders_asc' | 'spent_desc' | 'spent_asc' | 'date_desc' | 'date_asc';

export const UsersTab: React.FC<UsersTabProps> = ({ users, adminToken, onUserSaved }) => {
  const { showToast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'address' | 'orders' | 'garage'>('info');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortField>('spent_desc');

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

  // Ordenación
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
        return new Date(a.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
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
    setActiveTab('info');
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
        showToast('Cliente guardado en Odoo CRM con éxito', 'success');
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
      showToast('Error de conexión', 'error');
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
        showToast('Cliente archivado y eliminado de Odoo CRM', 'success');
        setSelectedUser(null);
        onUserSaved();
      } else {
        showToast(data.error || 'Error al eliminar el usuario', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al eliminar usuario', 'error');
    }
  };

  const getCustomerStage = (user: User) => {
    const spent = (user.totalSpentCents || 0) / 100;
    const orders = user.totalOrders || 0;
    if (spent > 1000 || orders >= 5) return { label: 'Cliente VIP / Oro', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    if (spent > 300 || orders >= 2) return { label: 'Cliente Recurrente', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    if (orders === 1) return { label: 'Primera Compra', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    return { label: 'Nuevo Lead / Prospecto', color: 'bg-slate-800 text-slate-400 border-slate-700' };
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* ODOO TOP CONTROL PANEL (Barra superior estilo Odoo CRM) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        
        {/* Izquierda: Selector de Vistas Estilo Odoo */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Kanban (Tarjetas Odoo)"
            >
              <Icons.LayoutGrid className="w-4 h-4" />
              <span>Kanban</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Lista / Tabla Odoo"
            >
              <Icons.List className="w-4 h-4" />
              <span>Lista</span>
            </button>
          </div>

          <span className="text-xs text-slate-400 font-mono hidden sm:inline">
            <strong className="text-white">{filtered.length}</strong> contactos encontrados
          </span>
        </div>

        {/* Centro: Buscador y Filtro por Rol */}
        <div className="flex flex-1 max-w-xl gap-2 items-center">
          <div className="relative flex-1">
            <Icons.Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar en Odoo CRM (Nombre, email, teléfono, ID...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'customer', label: 'Clientes' },
              { id: 'admin', label: 'Admins' }
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setRoleFilter(chip.id)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  roleFilter === chip.id
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Derecha: Ordenación Odoo Group By */}
        <div className="flex items-center gap-2 shrink-0">
          <Icons.SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-orange-500 font-medium"
          >
            <option value="spent_desc">Ordenar: Mayor Gastado (€)</option>
            <option value="spent_asc">Ordenar: Menor Gastado (€)</option>
            <option value="orders_desc">Ordenar: Más Pedidos</option>
            <option value="orders_asc">Ordenar: Menos Pedidos</option>
            <option value="name">Ordenar: Nombre Alfabético</option>
            <option value="id">Ordenar: Nº ID (Antigüedad)</option>
            <option value="date_desc">Ordenar: Más Recientes</option>
          </select>
        </div>

      </div>

      {/* VISTA KANBAN ESTILO ODOO (CARDS CRM) */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 italic bg-slate-900 border border-slate-800 rounded-2xl">
              No hay clientes que coincidan con la búsqueda.
            </div>
          ) : (
            filtered.map((u) => {
              const spentEur = ((u.totalSpentCents || 0) / 100).toFixed(2);
              const stage = getCustomerStage(u);
              let parsedBilling: UserBilling = {};
              try { parsedBilling = typeof u.billing === 'string' ? JSON.parse(u.billing) : (u.billing || {}); } catch {}

              return (
                <div
                  key={u.id}
                  onClick={() => handleOpenDetail(u, false)}
                  className="bg-slate-900 border border-slate-800 hover:border-orange-500/50 rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer group relative flex flex-col justify-between"
                >
                  <div>
                    {/* Top Tag & ID */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">#{u.id}</span>
                    </div>

                    {/* Contact Info Avatar + Name */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-orange-600/15 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400 text-lg shrink-0 group-hover:scale-105 transition-transform">
                        {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-100 text-sm truncate group-hover:text-orange-400 transition-colors">
                          {u.firstName || ''} {u.lastName || ''} {!u.firstName && (u.username || 'Cliente')}
                        </h4>
                        <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">{u.email}</p>
                        {parsedBilling.phone && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5 flex items-center gap-1 font-mono">
                            <Icons.Phone className="w-3 h-3 text-slate-400" />
                            {parsedBilling.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Odoo Card Bottom KPI Metrics */}
                  <div className="border-t border-slate-800/80 pt-3 mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-slate-300 font-mono">
                      <Icons.ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
                      <span>{u.totalOrders || 0} compras</span>
                    </div>
                    <div className="font-bold font-mono text-emerald-400 text-sm">
                      {spentEur} €
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VISTA LISTA ESTILO ODOO (TABLA TRADICIONAL) */}
      {viewMode === 'list' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-widest font-black">
                  <th className="pb-4">ID</th>
                  <th className="pb-4">Contacto / Cliente</th>
                  <th className="pb-4">Email</th>
                  <th className="pb-4">Teléfono</th>
                  <th className="pb-4">Etapa CRM</th>
                  <th className="pb-4">Compras</th>
                  <th className="pb-4">Total Facturado</th>
                  <th className="pb-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 italic text-xs">
                      No se encontraron contactos.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => {
                    const spentEur = ((u.totalSpentCents || 0) / 100).toFixed(2);
                    const stage = getCustomerStage(u);
                    let parsedBilling: UserBilling = {};
                    try { parsedBilling = typeof u.billing === 'string' ? JSON.parse(u.billing) : (u.billing || {}); } catch {}

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="py-4 font-mono text-xs text-slate-500">#{u.id}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center font-bold text-orange-400 text-xs">
                              {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-200 text-xs block group-hover:text-orange-400 transition-colors">
                                {u.firstName || ''} {u.lastName || ''} {!u.firstName && (u.username || 'Cliente')}
                              </span>
                              {u.username && <span className="text-[10px] text-slate-500 font-mono">@{u.username}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 font-mono text-xs text-slate-300">{u.email}</td>
                        <td className="py-4 font-mono text-xs text-slate-400">{parsedBilling.phone || '-'}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${stage.color}`}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg font-mono text-xs text-slate-200">
                            <Icons.ShoppingBag className="w-3 h-3 text-orange-400" />
                            {u.totalOrders || 0}
                          </span>
                        </td>
                        <td className="py-4 font-mono text-xs font-bold text-emerald-400">
                          {spentEur} €
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenDetail(u, false)}
                              className="px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                            >
                              <Icons.ExternalLink className="w-3.5 h-3.5" />
                              Ficha Odoo
                            </button>
                            <button
                              onClick={() => handleOpenDetail(u, true)}
                              className="p-1.5 text-slate-400 hover:text-white bg-slate-950 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                              title="Editar Contacto"
                            >
                              <Icons.Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-red-400/70 hover:text-red-400 bg-red-950/20 hover:bg-red-900/30 rounded-lg border border-red-900/30 transition-colors"
                              title="Archivar / Borrar Contacto"
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
      )}

      {/* ODOO FORM VIEW MODAL (Ficha de Cliente en Formato Odoo CRM) */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl animate-fade-in relative flex flex-col justify-between">
            
            <div>
              {/* Odoo Form Header Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
                
                {/* Action Buttons Left */}
                <div className="flex items-center gap-2">
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg"
                    >
                      <Icons.Edit2 className="w-4 h-4" /> Editar Contacto
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition-all"
                    >
                      Descartar Edición
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteUser(selectedUser)}
                    className="p-2 text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/40 rounded-xl transition-all"
                    title="Archivar / Eliminar Contacto"
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Bar Step (Pipeline Estado Odoo) */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1 text-[11px] font-semibold">
                  {['Prospecto', 'Primera Compra', 'Recurrente', 'VIP / Oro'].map((stg) => {
                    const currentStg = getCustomerStage(selectedUser).label;
                    const isActive = currentStg.includes(stg);
                    return (
                      <span
                        key={stg}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          isActive
                            ? 'bg-orange-600 text-white shadow-md font-bold'
                            : 'text-slate-500'
                        }`}
                      >
                        {stg}
                      </span>
                    );
                  })}
                </div>

                {/* Close Button Right */}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 text-slate-400 hover:text-white bg-slate-950 border border-slate-800 rounded-xl"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              {/* ODOO SMART BUTTONS BAR (Botones inteligentes superiores) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-950 border border-slate-800 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Facturación</span>
                    <span className="text-base font-black font-mono text-emerald-400">
                      {((selectedUser.totalSpentCents || 0) / 100).toFixed(2)} €
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ventas / Pedidos</span>
                    <span className="text-base font-black font-mono text-white">
                      {selectedUser.totalOrders || 0} pedidos
                    </span>
                  </div>
                  <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg">
                    <Icons.ShoppingBag className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">ID Sistema</span>
                    <span className="text-base font-black font-mono text-blue-400">
                      #{selectedUser.id}
                    </span>
                  </div>
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
                    <Icons.UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 hover:border-orange-500/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Rol Odoo</span>
                    <span className="text-sm font-bold uppercase tracking-wider text-purple-400 block mt-0.5">
                      {selectedUser.role || 'customer'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
                    <Icons.Shield className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Title & Contact Header Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mb-6 flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-black text-2xl shrink-0 shadow-lg">
                  {(selectedUser.firstName?.[0] || selectedUser.username?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {selectedUser.firstName} {selectedUser.lastName} {!selectedUser.firstName && (selectedUser.username || 'Contacto Odoo')}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedUser.email}</p>
                  {selectedUser.username && (
                    <span className="inline-block text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono mt-2">
                      @{selectedUser.username}
                    </span>
                  )}
                </div>
              </div>

              {/* ODOO TABS SYSTEM (Navegación por pestañas de la ficha de contacto) */}
              {!isEditing ? (
                <div>
                  <div className="flex border-b border-slate-800 gap-6 mb-6">
                    {[
                      { id: 'info', label: 'Información General', icon: Icons.User },
                      { id: 'address', label: 'Dirección & Envíos', icon: Icons.MapPin },
                      { id: 'orders', label: 'Histórico de Compras', icon: Icons.ShoppingBag },
                      { id: 'garage', label: 'Motos Registradas (Garaje)', icon: Icons.Bike }
                    ].map(tb => {
                      const Icon = tb.icon;
                      return (
                        <button
                          key={tb.id}
                          onClick={() => setActiveTab(tb.id as any)}
                          className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-all ${
                            activeTab === tb.id
                              ? 'border-orange-500 text-orange-400'
                              : 'border-transparent text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{tb.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab 1: Información General */}
                  {activeTab === 'info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
                          Datos de Contacto
                        </span>
                        <p><strong className="text-slate-400">Nombre:</strong> {selectedUser.firstName || '-'}</p>
                        <p><strong className="text-slate-400">Apellidos:</strong> {selectedUser.lastName || '-'}</p>
                        <p><strong className="text-slate-400">Email:</strong> <span className="font-mono text-slate-200">{selectedUser.email}</span></p>
                        <p><strong className="text-slate-400">Nick (@username):</strong> <span className="font-mono text-slate-300">{selectedUser.username || '-'}</span></p>
                        <p><strong className="text-slate-400">Teléfono:</strong> <span className="font-mono text-slate-300">{editForm.phone || '-'}</span></p>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
                          Metadatos de Registro
                        </span>
                        <p><strong className="text-slate-400">Fecha de Alta:</strong> {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('es-ES') : '-'}</p>
                        <p><strong className="text-slate-400">ID de Usuario:</strong> <span className="font-mono">#{selectedUser.id}</span></p>
                        <p><strong className="text-slate-400">Rol en la Web:</strong> <span className="uppercase text-purple-400 font-bold">{selectedUser.role || 'customer'}</span></p>
                        <p><strong className="text-slate-400">Estado CRM:</strong> <span className="text-emerald-400 font-bold">Activo</span></p>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Dirección & Envíos */}
                  {activeTab === 'address' && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-3 text-xs">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-2">
                        Dirección Principal de Facturación y Entrega
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <p><strong className="text-slate-400">Calle / Dirección:</strong> {editForm.address || '-'}</p>
                        <p><strong className="text-slate-400">Ciudad:</strong> {editForm.city || '-'}</p>
                        <p><strong className="text-slate-400">Código Postal:</strong> <span className="font-mono text-slate-200">{editForm.postcode || '-'}</span></p>
                        <p><strong className="text-slate-400">País:</strong> España</p>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Histórico de Compras */}
                  {activeTab === 'orders' && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-xs text-center space-y-2">
                      <Icons.ShoppingBag className="w-8 h-8 text-orange-400 mx-auto" />
                      <p className="font-bold text-slate-200">Total de {selectedUser.totalOrders || 0} pedidos registrados en la tienda</p>
                      <p className="text-slate-400 text-[11px]">Importe total acumulado: <strong className="text-emerald-400 font-mono font-bold text-sm">{((selectedUser.totalSpentCents || 0) / 100).toFixed(2)} €</strong></p>
                    </div>
                  )}

                  {/* Tab 4: Garaje de Motos */}
                  {activeTab === 'garage' && (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 text-xs space-y-3">
                      <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-2 flex items-center gap-2">
                        <Icons.Bike className="w-4 h-4" /> Motos Guardadas en el Garaje del Cliente
                      </span>
                      {selectedUser.garage && Array.isArray(selectedUser.garage) && selectedUser.garage.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {selectedUser.garage.map((m: any, idx: number) => (
                            <span key={idx} className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-slate-200 text-xs">
                              🏍️ {typeof m === 'string' ? m : `${m.brand || ''} ${m.model || ''} (${m.year || ''})`}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 italic">El cliente aún no ha registrado ninguna moto en su garaje virtual.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* FORMULARIO DE EDICIÓN ESTILO ODOO */
                <div className="space-y-6">
                  <span className="text-xs font-bold text-orange-400 uppercase tracking-wider block border-b border-slate-800 pb-3 flex items-center gap-2">
                    <Icons.Edit2 className="w-4 h-4" /> Editando Ficha de Contacto Odoo
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nombre</label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Apellidos</label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Nick (@username)</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Rol en la Plataforma</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none font-semibold"
                      >
                        <option value="customer">Cliente (Customer)</option>
                        <option value="admin">Administrador (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Teléfono</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 font-semibold mb-1">Dirección de Envío</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Ciudad</label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 font-semibold mb-1">Código Postal</label>
                        <input
                          type="text"
                          value={editForm.postcode}
                          onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:border-orange-500 outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all border border-slate-800"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveUser}
                      disabled={saving}
                      className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
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
        </div>
      )}

    </div>
  );
};

export default UsersTab;
