import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { useToast } from '../ToastContext';
import { OrderStatusBadge, DropshippingStatusBadge } from '../Badges';
import { formatPrice } from '../../utils/format';
import type { User, UserBilling, UserRole, Order } from '../../types/admin';

interface UsersTabProps {
  users: User[];
  orders?: Order[];
  adminWpId: string | number;
  adminEmail: string;
  adminToken: string;
  onUserSaved: () => void;
  onSelectOrder?: (order: Order) => void;
}

type ViewMode = 'kanban' | 'list';
type SortField = 'id' | 'name' | 'orders_desc' | 'orders_asc' | 'spent_desc' | 'spent_asc' | 'date_desc' | 'date_asc';

export const UsersTab: React.FC<UsersTabProps> = ({ users, orders = [], adminToken, onUserSaved, onSelectOrder }) => {
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

  // Estados selector de motos (Marcas -> Modelos -> Años) desde la BD
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [showBikeForm, setShowBikeForm] = useState(false);
  const [isAddingBike, setIsAddingBike] = useState(false);

  // Estados gestión de direcciones múltiples del cliente
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    alias: 'Principal',
    type: 'envio' as 'envio' | 'fiscal',
    address_1: '',
    city: '',
    postcode: '',
    phone: '',
    nif: ''
  });
  const [savingAddress, setSavingAddress] = useState(false);

  const handleOpenNewAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      alias: 'Nueva Dirección',
      type: 'envio',
      address_1: '',
      city: '',
      postcode: '',
      phone: selectedUser?.phone || '',
      nif: ''
    });
    setShowAddressForm(true);
  };

  const handleOpenEditAddressForm = (addr: any) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      alias: addr.alias || 'Dirección',
      type: addr.type || 'envio',
      address_1: addr.address_1 || '',
      city: addr.city || '',
      postcode: addr.postcode || '',
      phone: addr.phone || '',
      nif: addr.nif || ''
    });
    setShowAddressForm(true);
  };

  const handleAdminSaveAddress = async () => {
    if (!selectedUser || !addressForm.address_1.trim() || !addressForm.city.trim() || !addressForm.postcode.trim()) {
      showToast('Por favor, completa los campos obligatorios de la dirección', 'error');
      return;
    }
    setSavingAddress(true);
    try {
      const parsedBilling = typeof selectedUser.billing === 'string'
        ? (() => { try { return JSON.parse(selectedUser.billing); } catch { return {}; } })()
        : (selectedUser.billing || {});

      const currentAddresses: any[] = Array.isArray(parsedBilling.addresses) ? [...parsedBilling.addresses] : [];

      const targetId = editingAddressId || `addr-${Date.now()}`;
      const updatedAddrObj = {
        id: targetId,
        alias: addressForm.alias.trim() || 'Dirección',
        type: addressForm.type,
        address_1: addressForm.address_1.trim(),
        city: addressForm.city.trim(),
        postcode: addressForm.postcode.trim(),
        phone: addressForm.phone.trim(),
        nif: addressForm.type === 'fiscal' ? addressForm.nif.trim() : undefined
      };

      const existingIdx = currentAddresses.findIndex((a: any) => a.id === targetId);
      if (existingIdx !== -1) {
        currentAddresses[existingIdx] = updatedAddrObj;
      } else {
        currentAddresses.push(updatedAddrObj);
      }

      const newBilling = {
        ...parsedBilling,
        address_1: addressForm.address_1.trim(),
        city: addressForm.city.trim(),
        postcode: addressForm.postcode.trim(),
        phone: addressForm.phone.trim(),
        addresses: currentAddresses
      };

      const res = await fetch('/api/admin?action=save-user', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedUser.id,
          firstName: selectedUser.firstName || '',
          lastName: selectedUser.lastName || '',
          username: selectedUser.username || '',
          email: selectedUser.email || '',
          role: selectedUser.role || 'customer',
          phone: addressForm.phone.trim(),
          address: addressForm.address_1.trim(),
          city: addressForm.city.trim(),
          postcode: addressForm.postcode.trim(),
          billing: newBilling
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Dirección guardada con éxito', 'success');
        setSelectedUser({
          ...selectedUser,
          billing: newBilling,
          phone: addressForm.phone.trim(),
          address: addressForm.address_1.trim(),
          city: addressForm.city.trim(),
          postcode: addressForm.postcode.trim()
        });
        setShowAddressForm(false);
        setEditingAddressId(null);
        onUserSaved();
      } else {
        showToast(data.error || `Error ${res.status}: no se pudo guardar la dirección`, 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error de conexión', 'error');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleAdminDeleteAddress = async (addressId: string) => {
    if (!selectedUser || !addressId) return;
    try {
      const parsedBilling = typeof selectedUser.billing === 'string'
        ? (() => { try { return JSON.parse(selectedUser.billing); } catch { return {}; } })()
        : (selectedUser.billing || {});

      const currentAddresses: any[] = Array.isArray(parsedBilling.addresses) ? [...parsedBilling.addresses] : [];
      const updatedAddresses = currentAddresses.filter((a: any) => a.id !== addressId);

      const newBilling = {
        ...parsedBilling,
        addresses: updatedAddresses
      };

      const res = await fetch('/api/admin?action=save-user', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedUser.id,
          firstName: selectedUser.firstName || '',
          lastName: selectedUser.lastName || '',
          username: selectedUser.username || '',
          email: selectedUser.email || '',
          role: selectedUser.role || 'customer',
          billing: newBilling
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('Dirección eliminada', 'success');
        setSelectedUser({ ...selectedUser, billing: newBilling });
        onUserSaved();
      } else {
        showToast(data.error || 'Error al eliminar dirección', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  };

  // 1. Cargar Marcas al montar
  React.useEffect(() => {
    fetch('/api/vehicles?action=brands')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setBrands(data); })
      .catch(() => setBrands([]));
  }, []);

  // 2. Cargar Modelos al seleccionar Marca
  React.useEffect(() => {
    if (!selectedBrand) {
      setModels([]);
      return;
    }
    setLoadingModels(true);
    fetch(`/api/vehicles?action=models&brand=${encodeURIComponent(selectedBrand)}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setModels(data); })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [selectedBrand]);

  // 3. Cargar Años al seleccionar Modelo
  React.useEffect(() => {
    if (!selectedBrand || !selectedModel) {
      setYears([]);
      return;
    }
    setLoadingYears(true);
    fetch(`/api/vehicles?action=years&brand=${encodeURIComponent(selectedBrand)}&model=${encodeURIComponent(selectedModel)}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setYears(data); })
      .catch(() => setYears([]))
      .finally(() => setLoadingYears(false));
  }, [selectedBrand, selectedModel]);

  const handleAddBike = async () => {
    if (!selectedUser || !selectedBrand || !selectedModel || !selectedYear) return;
    const bikeStr = `${selectedBrand} ${selectedModel} (${selectedYear})`;
    setIsAddingBike(true);
    try {
      const res = await fetch('/api/admin?action=admin-add-garage-bike', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          bike: { brand: selectedBrand, model: selectedModel, year: selectedYear }
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Moto añadida al garaje del cliente', 'success');
        const updatedGarage = [bikeStr, ...(selectedUser.garage || [])];
        setSelectedUser({ ...selectedUser, garage: updatedGarage });
        setSelectedBrand('');
        setSelectedModel('');
        setSelectedYear('');
        setShowBikeForm(false);
        onUserSaved();
      } else {
        showToast(data.error || 'Error al añadir moto', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    } finally {
      setIsAddingBike(false);
    }
  };

  const handleRemoveBike = async (bikeLabel: string) => {
    if (!selectedUser || !bikeLabel) return;
    try {
      const res = await fetch('/api/admin?action=admin-remove-garage-bike', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, bikeLabel })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Moto eliminada del garaje', 'success');
        const updatedGarage = (selectedUser.garage || []).filter((item: any) => {
          const label = typeof item === 'string'
            ? item.trim()
            : `${item.brand || ''} ${item.model || ''} ${item.year ? `(${item.year})` : ''}`.trim();
          return label.toLowerCase() !== bikeLabel.toLowerCase();
        });
        setSelectedUser({ ...selectedUser, garage: updatedGarage });
        onUserSaved();
      } else {
        showToast(data.error || 'Error al eliminar moto', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  };

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
        showToast('Cliente guardado con éxito', 'success');
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

  const getCustomerStage = (user: User) => {
    const spent = (user.totalSpentCents || 0) / 100;
    const ordersCount = user.totalOrders || 0;
    if (spent > 1000 || ordersCount >= 5) return { label: 'VIP / Oro', color: 'bg-tech-yellow/20 text-tech-yellow border-tech-yellow/40' };
    if (spent > 300 || ordersCount >= 2) return { label: 'Recurrente', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
    if (ordersCount === 1) return { label: 'Primera Compra', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' };
    return { label: 'Prospecto', color: 'bg-tech-card text-tech-muted border-tech-border' };
  };

  // Obtener pedidos específicos del usuario seleccionado
  const userOrders = selectedUser ? orders.filter(o => {
    const userEmail = (selectedUser.email || '').toLowerCase();
    const orderEmail = (o.shippingData?.email || '').toLowerCase();
    return (
      (o.shippingData && orderEmail === userEmail) ||
      (o as any).user_id === selectedUser.id
    );
  }) : [];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* BARRA SUPERIOR DE CONTROL (ESTÉTICT TECH CARBON / YELLOW) */}
      <div className="bg-tech-card border border-tech-border rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        
        {/* Izquierda: Selector de Vistas */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#1a1b1e] border border-tech-border rounded-xl p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                viewMode === 'kanban'
                  ? 'bg-tech-yellow text-tech-carbon shadow-md'
                  : 'text-tech-muted hover:text-tech-text'
              }`}
              title="Vista Tarjetas (Kanban)"
            >
              <Icons.LayoutGrid className="w-4 h-4" />
              <span>Tarjetas</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                viewMode === 'list'
                  ? 'bg-tech-yellow text-tech-carbon shadow-md'
                  : 'text-tech-muted hover:text-tech-text'
              }`}
              title="Vista Lista / Tabla"
            >
              <Icons.List className="w-4 h-4" />
              <span>Lista</span>
            </button>
          </div>

          <span className="text-xs text-tech-muted font-mono hidden sm:inline">
            <strong className="text-tech-text">{filtered.length}</strong> contactos encontrados
          </span>
        </div>

        {/* Centro: Buscador y Filtro por Rol */}
        <div className="flex flex-1 max-w-xl gap-2 items-center">
          <div className="relative flex-1">
            <Icons.Search className="absolute left-3.5 top-3 w-4 h-4 text-tech-muted" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Buscar cliente (Nombre, email, teléfono, ID...)"
              className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-tech-text placeholder-zinc-500 focus:outline-none focus:border-tech-yellow transition-all"
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
        </div>

        {/* Derecha: Ordenación */}
        <div className="flex items-center gap-2 shrink-0">
          <Icons.SlidersHorizontal className="w-4 h-4 text-tech-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="bg-[#1a1b1e] border border-tech-border text-tech-text text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-tech-yellow font-medium"
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

      {/* VISTA TARJETAS (KANBAN TECH) */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-full py-16 text-center text-tech-muted italic bg-tech-card border border-tech-border rounded-2xl">
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
                  className="bg-tech-card border border-tech-border hover:border-tech-yellow/50 rounded-2xl p-5 shadow-xl hover:shadow-2xl transition-all cursor-pointer group relative flex flex-col justify-between"
                >
                  <div>
                    {/* Top Tag & ID */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="font-mono text-[10px] text-tech-muted">#{u.id}</span>
                    </div>

                    {/* Contact Info Avatar + Name */}
                    <div className="flex items-start gap-3.5 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-tech-yellow/15 border border-tech-yellow/30 flex items-center justify-center font-bold text-tech-yellow text-lg shrink-0 group-hover:scale-105 transition-transform">
                        {(u.firstName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-tech-text text-sm truncate group-hover:text-tech-yellow transition-colors">
                          {u.firstName || ''} {u.lastName || ''} {!u.firstName && (u.username || 'Cliente')}
                        </h4>
                        <p className="text-xs text-tech-muted truncate mt-0.5 font-mono">{u.email}</p>
                        {parsedBilling.phone && (
                          <p className="text-[11px] text-tech-muted truncate mt-0.5 flex items-center gap-1 font-mono">
                            <Icons.Phone className="w-3 h-3 text-tech-muted" />
                            {parsedBilling.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom KPI Metrics */}
                  <div className="border-t border-tech-border pt-3 mt-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 text-tech-text font-mono">
                      <Icons.ShoppingBag className="w-3.5 h-3.5 text-tech-yellow" />
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

      {/* VISTA LISTA (TABLA TECH) */}
      {viewMode === 'list' && (
        <div className="bg-tech-card border border-tech-border rounded-2xl p-6 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-tech-border text-[10px] text-tech-muted uppercase tracking-widest font-black">
                  <th className="pb-4">ID</th>
                  <th className="pb-4">Contacto / Cliente</th>
                  <th className="pb-4">Email</th>
                  <th className="pb-4">Teléfono</th>
                  <th className="pb-4">Fidelidad</th>
                  <th className="pb-4">Compras</th>
                  <th className="pb-4">Total Facturado</th>
                  <th className="pb-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-tech-muted italic text-xs">
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
                        <td className="py-4 font-mono text-xs text-tech-text">{u.email}</td>
                        <td className="py-4 font-mono text-xs text-tech-muted">{parsedBilling.phone || '-'}</td>
                        <td className="py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${stage.color}`}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="inline-flex items-center gap-1 bg-[#1a1b1e] border border-tech-border px-2.5 py-1 rounded-lg font-mono text-xs text-tech-text">
                            <Icons.ShoppingBag className="w-3 h-3 text-tech-yellow" />
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
                              className="px-3 py-1.5 bg-tech-yellow/10 hover:bg-tech-yellow/20 text-tech-yellow border border-tech-yellow/30 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
                            >
                              <Icons.ExternalLink className="w-3.5 h-3.5" />
                              Ver Ficha
                            </button>
                            <button
                              onClick={() => handleOpenDetail(u, true)}
                              className="p-1.5 text-tech-muted hover:text-tech-text bg-[#1a1b1e] hover:bg-tech-border rounded-lg border border-tech-border transition-colors"
                              title="Editar Contacto"
                            >
                              <Icons.Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-red-400/70 hover:text-red-400 bg-red-950/20 hover:bg-red-900/30 rounded-lg border border-red-900/30 transition-colors"
                              title="Borrar Contacto"
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

      {/* FICHA MODAL DETALLADA DEL CLIENTE */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-tech-carbon/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-tech-card border border-tech-border rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 md:p-8 shadow-2xl animate-fade-in relative flex flex-col justify-between">
            
            <div>
              {/* Controles superiores */}
              <div className="flex items-start justify-between gap-3 border-b border-tech-border pb-4 mb-6 relative">
                
                {/* Botones de acción e insignias */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pr-10">
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
                        Descartar Edición
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteUser(selectedUser)}
                      className="p-2 text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/40 rounded-xl transition-all"
                      title="Eliminar Contacto"
                    >
                      <Icons.Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Etapas de fidelización */}
                  <div className="flex items-center gap-1 bg-[#1a1b1e] border border-tech-border rounded-xl p-1 text-[10px] font-black uppercase tracking-wider overflow-x-auto max-w-full">
                    {['Prospecto', 'Primera Compra', 'Recurrente', 'VIP / Oro'].map((stg) => {
                      const currentStg = getCustomerStage(selectedUser).label;
                      const isActive = currentStg.includes(stg);
                      return (
                        <span
                          key={stg}
                          className={`px-2.5 py-1 rounded-lg shrink-0 transition-all ${
                            isActive
                              ? 'bg-tech-yellow text-tech-carbon shadow-md font-bold'
                              : 'text-tech-muted'
                          }`}
                        >
                          {stg}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Botón cerrar X siempre arriba a la derecha */}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 text-tech-muted hover:text-tech-text bg-[#1a1b1e] hover:bg-tech-border border border-tech-border rounded-xl absolute right-0 top-0 transition-all shrink-0"
                  title="Cerrar Ficha"
                >
                  <Icons.X className="w-5 h-5" />
                </button>
              </div>

              {/* BARRA SUPERIOR DE TARJETAS DE MÉTRICAS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-tech-muted font-black uppercase tracking-wider block">Facturación</span>
                    <span className="text-base font-black font-mono text-emerald-400">
                      {((selectedUser.totalSpentCents || 0) / 100).toFixed(2)} €
                    </span>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg">
                    <Icons.DollarSign className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-tech-muted font-black uppercase tracking-wider block">Ventas / Pedidos</span>
                    <span className="text-base font-black font-mono text-tech-text">
                      {selectedUser.totalOrders || 0} pedidos
                    </span>
                  </div>
                  <div className="p-2.5 bg-tech-yellow/10 border border-tech-yellow/30 text-tech-yellow rounded-lg">
                    <Icons.ShoppingBag className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-tech-muted font-black uppercase tracking-wider block">ID Sistema</span>
                    <span className="text-base font-black font-mono text-blue-400">
                      #{selectedUser.id}
                    </span>
                  </div>
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-lg">
                    <Icons.UserCheck className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-[#1a1b1e] border border-tech-border hover:border-tech-yellow/40 rounded-xl p-3 flex items-center justify-between transition-all">
                  <div>
                    <span className="text-[10px] text-tech-muted font-black uppercase tracking-wider block">Rol Permisos</span>
                    <span className="text-xs font-black uppercase tracking-wider text-purple-400 block mt-0.5">
                      {selectedUser.role || 'customer'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-lg">
                    <Icons.Shield className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Cabecera del Contacto */}
              <div className="bg-[#1a1b1e] border border-tech-border rounded-xl p-5 mb-6 flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-tech-yellow/15 border border-tech-yellow/40 flex items-center justify-center text-tech-yellow font-black text-2xl shrink-0 shadow-lg">
                  {(selectedUser.firstName?.[0] || selectedUser.username?.[0] || 'U').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-black italic uppercase tracking-wider text-tech-text">
                    {selectedUser.firstName} {selectedUser.lastName} {!selectedUser.firstName && (selectedUser.username || 'Contacto')}
                  </h2>
                  <p className="text-xs text-tech-muted font-mono mt-0.5">{selectedUser.email}</p>
                  {selectedUser.username && (
                    <span className="inline-block text-[11px] bg-tech-card border border-tech-border px-2 py-0.5 rounded text-tech-muted font-mono mt-2">
                      @{selectedUser.username}
                    </span>
                  )}
                </div>
              </div>

              {/* SISTEMA DE PESTAÑAS */}
              {!isEditing ? (
                <div>
                  <div className="flex border-b border-tech-border gap-3 sm:gap-6 mb-6 overflow-x-auto no-scrollbar pb-1">
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
                          className={`flex items-center gap-2 pb-3 text-xs font-black uppercase tracking-wider border-b-2 shrink-0 transition-all ${
                            activeTab === tb.id
                              ? 'border-tech-yellow text-tech-yellow'
                              : 'border-transparent text-tech-muted hover:text-tech-text'
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
                      <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-tech-yellow block border-b border-tech-border pb-2">
                          Datos de Contacto
                        </span>
                        <p><strong className="text-tech-muted">Nombre:</strong> {selectedUser.firstName || '-'}</p>
                        <p><strong className="text-tech-muted">Apellidos:</strong> {selectedUser.lastName || '-'}</p>
                        <p><strong className="text-tech-muted">Email:</strong> <span className="font-mono text-tech-text">{selectedUser.email}</span></p>
                        <p><strong className="text-tech-muted">Nick (@username):</strong> <span className="font-mono text-tech-muted">{selectedUser.username || '-'}</span></p>
                        <p><strong className="text-tech-muted">Teléfono:</strong> <span className="font-mono text-tech-text">{editForm.phone || '-'}</span></p>
                      </div>

                      <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-4 space-y-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-tech-yellow block border-b border-tech-border pb-2">
                          Metadatos de Registro
                        </span>
                        <p><strong className="text-tech-muted">Fecha de Alta:</strong> {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('es-ES') : '-'}</p>
                        <p><strong className="text-tech-muted">ID de Usuario:</strong> <span className="font-mono">#{selectedUser.id}</span></p>
                        <p><strong className="text-tech-muted">Rol en la Web:</strong> <span className="uppercase text-purple-400 font-bold">{selectedUser.role || 'customer'}</span></p>
                        <p><strong className="text-tech-muted">Estado:</strong> <span className="text-emerald-400 font-bold">Activo</span></p>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Dirección & Envíos (LIBRETA DE DIRECCIONES MÚLTIPLES CON FORMULARIO DESPLEGABLE) */}
                  {activeTab === 'address' && (
                    <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-5 space-y-4 text-xs">
                      {/* Cabecera del Tab con Botón + Añadir Dirección */}
                      <div className="flex items-center justify-between border-b border-tech-border pb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2">
                          <Icons.MapPin className="w-4 h-4" /> Libreta de Direcciones del Cliente
                        </span>

                        <button
                          onClick={() => {
                            if (showAddressForm) {
                              setShowAddressForm(false);
                              setEditingAddressId(null);
                            } else {
                              handleOpenNewAddressForm();
                            }
                          }}
                          className="px-3 py-1.5 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all flex items-center gap-1 shadow"
                        >
                          {showAddressForm ? (
                            <>
                              <Icons.X className="w-3.5 h-3.5" /> Ocultar Formulario
                            </>
                          ) : (
                            <>
                              <Icons.Plus className="w-3.5 h-3.5" /> Añadir Dirección
                            </>
                          )}
                        </button>
                      </div>

                      {/* Formulario colapsable (Añadir o Editar) */}
                      {showAddressForm && (
                        <div className="bg-tech-card p-4 rounded-xl border border-tech-border space-y-3 animate-fade-in">
                          <span className="text-[10px] font-black uppercase tracking-wider text-tech-yellow block border-b border-tech-border pb-2">
                            {editingAddressId ? 'Editar Dirección' : 'Añadir Nueva Dirección'}
                          </span>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Nombre / Alias (ej: Casa, Taller)</label>
                              <input
                                type="text"
                                value={addressForm.alias}
                                onChange={(e) => setAddressForm({ ...addressForm, alias: e.target.value })}
                                placeholder="Ej: Dirección Principal"
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Tipo de Dirección</label>
                              <select
                                value={addressForm.type}
                                onChange={(e) => setAddressForm({ ...addressForm, type: e.target.value as 'envio' | 'fiscal' })}
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none text-xs font-semibold"
                              >
                                <option value="envio">Envío de Pedidos</option>
                                <option value="fiscal">Facturación / Fiscal</option>
                              </select>
                            </div>

                            <div className="sm:col-span-2">
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Dirección / Calle y Número *</label>
                              <input
                                type="text"
                                value={addressForm.address_1}
                                onChange={(e) => setAddressForm({ ...addressForm, address_1: e.target.value })}
                                placeholder="Ej: Calle Gran Vía 12, 3ºA"
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Ciudad *</label>
                              <input
                                type="text"
                                value={addressForm.city}
                                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                                placeholder="Ej: Madrid"
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Código Postal *</label>
                              <input
                                type="text"
                                value={addressForm.postcode}
                                onChange={(e) => setAddressForm({ ...addressForm, postcode: e.target.value })}
                                placeholder="Ej: 28001"
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none font-mono text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">Teléfono de Contacto</label>
                              <input
                                type="text"
                                value={addressForm.phone}
                                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                                placeholder="Ej: 600112233"
                                className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none font-mono text-xs"
                              />
                            </div>

                            {addressForm.type === 'fiscal' && (
                              <div>
                                <label className="block text-tech-muted font-bold mb-1 uppercase text-[9px] tracking-wider">NIF / CIF / DNI (Para factura)</label>
                                <input
                                  type="text"
                                  value={addressForm.nif}
                                  onChange={(e) => setAddressForm({ ...addressForm, nif: e.target.value })}
                                  placeholder="Ej: 12345678Z"
                                  className="w-full bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-tech-text focus:border-tech-yellow outline-none font-mono text-xs"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <button
                              onClick={() => {
                                setShowAddressForm(false);
                                setEditingAddressId(null);
                              }}
                              className="px-4 py-2 bg-[#1a1b1e] border border-tech-border text-tech-muted hover:text-tech-text rounded-lg text-[10px] font-bold uppercase transition-all"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={handleAdminSaveAddress}
                              disabled={savingAddress}
                              className="px-4 py-2 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 disabled:opacity-50 font-black uppercase text-[10px] tracking-wider rounded-lg shadow transition-all flex items-center gap-1"
                            >
                              <Icons.Save className="w-3.5 h-3.5" />
                              {savingAddress ? 'Guardando...' : 'Guardar Dirección'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de direcciones guardadas */}
                      {(() => {
                        const parsedBilling = typeof selectedUser.billing === 'string'
                          ? (() => { try { return JSON.parse(selectedUser.billing); } catch { return {}; } })()
                          : (selectedUser.billing || {});

                        let addressList: any[] = Array.isArray(parsedBilling.addresses) ? parsedBilling.addresses : [];

                        // Si no hay array de direcciones pero hay address_1 legacy, incluirla como principal
                        if (addressList.length === 0 && (parsedBilling.address_1 || selectedUser.address)) {
                          addressList = [{
                            id: 'legacy-primary',
                            alias: 'Dirección Principal',
                            type: 'envio',
                            address_1: parsedBilling.address_1 || selectedUser.address || '',
                            city: parsedBilling.city || selectedUser.city || '',
                            postcode: parsedBilling.postcode || selectedUser.postcode || '',
                            phone: parsedBilling.phone || selectedUser.phone || ''
                          }];
                        }

                        return addressList.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {addressList.map((addr: any, index: number) => (
                              <div
                                key={addr.id || index}
                                className="bg-tech-card border border-tech-border p-4 rounded-xl space-y-2 relative flex flex-col justify-between hover:border-tech-yellow/40 transition-all"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-tech-text uppercase text-xs flex items-center gap-1.5">
                                      <Icons.MapPin className="w-3.5 h-3.5 text-tech-yellow" />
                                      {addr.alias || `Dirección #${index + 1}`}
                                    </span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                      addr.type === 'fiscal'
                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                      {addr.type === 'fiscal' ? 'Fiscal' : 'Envío'}
                                    </span>
                                  </div>

                                  <p className="text-tech-text font-medium text-xs pt-1">{addr.address_1 || '-'}</p>
                                  <p className="text-tech-muted text-[11px] font-mono">
                                    {addr.postcode || ''} {addr.city || ''}
                                  </p>
                                  {addr.phone && (
                                    <p className="text-tech-muted text-[11px] font-mono">
                                      📞 {addr.phone}
                                    </p>
                                  )}
                                  {addr.nif && (
                                    <p className="text-tech-muted text-[11px] font-mono">
                                      🪪 NIF: {addr.nif}
                                    </p>
                                  )}
                                </div>

                                <div className="flex justify-end gap-2 border-t border-tech-border/60 pt-3.5 mt-2">
                                  <button
                                    onClick={() => handleOpenEditAddressForm(addr)}
                                    className="px-2.5 py-1.5 bg-[#1a1b1e] hover:bg-tech-border text-tech-text border border-tech-border rounded-lg text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                                  >
                                    <Icons.Edit2 className="w-3 h-3" /> Editar
                                  </button>
                                  <button
                                    onClick={() => handleAdminDeleteAddress(addr.id)}
                                    className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 rounded-lg transition-all"
                                    title="Eliminar dirección"
                                  >
                                    <Icons.Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-8 text-center text-tech-muted italic">
                            El cliente aún no ha guardado ninguna dirección de envío o facturación.
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Tab 3: Histórico de Compras (LISTADO INTERACTIVO DE PEDIDOS) */}
                  {activeTab === 'orders' && (
                    <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-5 text-xs space-y-4">
                      <div className="flex items-center justify-between border-b border-tech-border pb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2">
                          <Icons.ShoppingBag className="w-4 h-4" /> Histórico de Pedidos del Cliente ({userOrders.length})
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold">
                          Total Facturado: {((selectedUser.totalSpentCents || 0) / 100).toFixed(2)} €
                        </span>
                      </div>

                      {userOrders.length === 0 ? (
                        <div className="py-8 text-center text-tech-muted italic">
                          No hay pedidos registrados en el sistema para este cliente.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-tech-border text-[9px] text-tech-muted uppercase tracking-widest font-black">
                                <th className="pb-3">ID Pedido</th>
                                <th className="pb-3">Fecha</th>
                                <th className="pb-3">Importe</th>
                                <th className="pb-3">Estado</th>
                                <th className="pb-3">Dropshipping (Bihr)</th>
                                <th className="pb-3 text-right">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-900/50">
                              {userOrders.map((ord) => (
                                <tr key={ord.id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-3 font-bold text-tech-text">#{ord.id}</td>
                                  <td className="py-3 text-tech-muted">{new Date(ord.createdAt).toLocaleDateString('es-ES')}</td>
                                  <td className="py-3 font-black text-tech-text">{formatPrice(ord.total)}</td>
                                  <td className="py-3"><OrderStatusBadge status={ord.status} /></td>
                                  <td className="py-3">
                                    <DropshippingStatusBadge
                                      status={ord.dropshippingStatus}
                                      trackingNumber={ord.trackingNumber}
                                      trackingUrl={ord.trackingUrl}
                                    />
                                  </td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() => {
                                        if (onSelectOrder) {
                                          setSelectedUser(null);
                                          onSelectOrder(ord);
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all inline-flex items-center gap-1 shadow"
                                    >
                                      <Icons.ExternalLink className="w-3 h-3" />
                                      Gestionar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Garaje de Motos (CON AÑADIR / ELIMINAR DIRECTO) */}
                  {activeTab === 'garage' && (
                    <div className="bg-[#1a1b1e]/60 border border-tech-border rounded-xl p-5 text-xs space-y-4">
                      {/* Botón superior para desplegar el selector de moto */}
                      <div className="flex items-center justify-between border-b border-tech-border pb-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-tech-yellow flex items-center gap-2">
                          <Icons.Bike className="w-4 h-4" /> Motos Guardadas en el Garaje del Cliente
                        </span>

                        <button
                          onClick={() => setShowBikeForm(!showBikeForm)}
                          className="px-3 py-1.5 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 rounded-lg font-black uppercase text-[10px] tracking-wider transition-all flex items-center gap-1 shadow"
                        >
                          {showBikeForm ? (
                            <>
                              <Icons.X className="w-3.5 h-3.5" /> Ocultar Formulario
                            </>
                          ) : (
                            <>
                              <Icons.Plus className="w-3.5 h-3.5" /> Añadir Moto
                            </>
                          )}
                        </button>
                      </div>

                      {/* Desplegable para seleccionar moto desde la BD */}
                      {showBikeForm && (
                        <div className="bg-tech-card p-4 rounded-xl border border-tech-border space-y-3 animate-fade-in">
                          <span className="text-[10px] font-black uppercase tracking-wider text-tech-muted block">
                            Seleccionar vehículo del catálogo de la tienda
                          </span>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* 1. Selección de Marca */}
                            <select
                              value={selectedBrand}
                              onChange={(e) => {
                                setSelectedBrand(e.target.value);
                                setSelectedModel('');
                                setSelectedYear('');
                              }}
                              className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-xs text-tech-text focus:border-tech-yellow outline-none font-medium"
                            >
                              <option value="">-- Marca --</option>
                              {brands.map(b => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>

                            {/* 2. Selección de Modelo */}
                            <select
                              value={selectedModel}
                              onChange={(e) => {
                                setSelectedModel(e.target.value);
                                setSelectedYear('');
                              }}
                              disabled={!selectedBrand || loadingModels}
                              className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-xs text-tech-text focus:border-tech-yellow outline-none font-medium disabled:opacity-50"
                            >
                              <option value="">{loadingModels ? 'Cargando...' : '-- Modelo --'}</option>
                              {models.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>

                            {/* 3. Selección de Año */}
                            <select
                              value={selectedYear}
                              onChange={(e) => setSelectedYear(e.target.value)}
                              disabled={!selectedModel || loadingYears}
                              className="bg-[#1a1b1e] border border-tech-border rounded-lg px-3 py-2 text-xs text-tech-text focus:border-tech-yellow outline-none font-medium disabled:opacity-50"
                            >
                              <option value="">{loadingYears ? 'Cargando...' : '-- Año --'}</option>
                              {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                              ))}
                              {years.length > 0 && <option value="Todos">Todos los años</option>}
                            </select>
                          </div>

                          <div className="flex justify-end pt-1">
                            <button
                              onClick={handleAddBike}
                              disabled={isAddingBike || !selectedBrand || !selectedModel || !selectedYear}
                              className="px-4 py-2 bg-tech-yellow text-tech-carbon hover:bg-yellow-500 disabled:opacity-40 font-black uppercase text-[10px] tracking-wider rounded-lg transition-all flex items-center justify-center gap-1 shrink-0 shadow"
                            >
                              <Icons.Plus className="w-3.5 h-3.5" />
                              {isAddingBike ? 'Guardando...' : 'Confirmar y Guardar Moto'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de motos */}
                      {(() => {
                        const rawGarage = selectedUser.garage && Array.isArray(selectedUser.garage) ? selectedUser.garage : [];
                        const seen = new Set<string>();
                        const uniqueGarage: any[] = [];

                        for (const item of rawGarage) {
                          const label = typeof item === 'string'
                            ? item.trim()
                            : `${item.brand || ''} ${item.model || ''} ${item.year ? `(${item.year})` : ''}`.trim();
                          const key = label.toLowerCase();
                          if (key && !seen.has(key)) {
                            seen.add(key);
                            uniqueGarage.push({ original: item, label });
                          }
                        }

                        return uniqueGarage.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {uniqueGarage.map((m, idx) => (
                              <div key={idx} className="bg-tech-card border border-tech-border px-3.5 py-2.5 rounded-xl font-mono text-tech-text text-xs flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-base">🏍️</span>
                                  <span className="font-bold truncate">{m.label}</span>
                                </div>

                                <button
                                  onClick={() => handleRemoveBike(m.label)}
                                  className="p-1.5 text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 border border-red-900/30 rounded-lg transition-all"
                                  title="Eliminar esta moto del garaje del cliente"
                                >
                                  <Icons.Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-tech-muted italic">El cliente aún no ha registrado ninguna moto en su garaje virtual.</p>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* FORMULARIO DE EDICIÓN */
                <div className="space-y-6">
                  <span className="text-xs font-black uppercase tracking-widest text-tech-yellow block border-b border-tech-border pb-3 flex items-center gap-2">
                    <Icons.Edit2 className="w-4 h-4" /> Formulario de Edición de Contacto
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Nombre</label>
                      <input
                        type="text"
                        value={editForm.firstName}
                        onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Apellidos</label>
                      <input
                        type="text"
                        value={editForm.lastName}
                        onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Nick (@username)</label>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Rol en la Plataforma</label>
                      <select
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none font-semibold"
                      >
                        <option value="customer">Cliente (Customer)</option>
                        <option value="admin">Administrador (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Teléfono</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Dirección de Envío</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Ciudad</label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-tech-muted font-bold mb-1 uppercase text-[10px] tracking-wider">Código Postal</label>
                        <input
                          type="text"
                          value={editForm.postcode}
                          onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                          className="w-full bg-[#1a1b1e] border border-tech-border rounded-xl p-2.5 text-tech-text focus:border-tech-yellow outline-none font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-tech-border pt-5">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-5 py-2.5 bg-[#1a1b1e] hover:bg-tech-border text-tech-muted rounded-xl text-xs font-bold uppercase transition-all border border-tech-border"
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
        </div>
      )}

    </div>
  );
};

export default UsersTab;
