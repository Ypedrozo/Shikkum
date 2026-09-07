import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  AlertCircle,
  RefreshCw,
  Phone,
  Mail,
  FileText,
  BadgeCheck,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import { Customer } from '../../types';
import { customerService } from '../../services/customer.service';
import { useAuth } from '../../context/AuthContext';

interface CustomersPageProps {
  onNavigate?: (path: string) => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    isCommunityMember: true,
    isActive: true,
    notes: ''
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal Ver Detalle
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  // Cargar clientes
  const loadCustomers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch {
      setErrorMessage('No fue posible cargar la lista de clientes. Por favor intente nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Filtrado reactivo
  const filteredCustomers = useMemo(() => {
    const cleanTerm = searchTerm.trim().toLowerCase();
    return customers.filter((c) => {
      if (statusFilter === 'active' && !c.isActive) return false;
      if (statusFilter === 'inactive' && c.isActive) return false;
      if (!cleanTerm) return true;

      const matchName = c.fullName.toLowerCase().includes(cleanTerm);
      const matchEmail = c.email.toLowerCase().includes(cleanTerm);
      const matchPhone = c.phone ? c.phone.toLowerCase().includes(cleanTerm) : false;
      const matchDoc = c.documentId ? c.documentId.toLowerCase().includes(cleanTerm) : false;

      return matchName || matchEmail || matchPhone || matchDoc;
    });
  }, [customers, searchTerm, statusFilter]);

  // Abrir modal de creación
  const handleOpenCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      documentId: '',
      isCommunityMember: true,
      isActive: true,
      notes: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setFormData({
      fullName: cust.fullName,
      email: cust.email,
      phone: cust.phone || '',
      documentId: cust.documentId || '',
      isCommunityMember: cust.isCommunityMember,
      isActive: cust.isActive,
      notes: cust.notes || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  // Guardar cliente (Crear o Actualizar)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = customerService.validateCustomer({
      fullName: formData.fullName,
      email: formData.email,
      isCommunityMember: formData.isCommunityMember
    });

    if (!validation.isValid) {
      setFormError(validation.error || 'Datos no válidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const operatorUid = user?.uid || 'usr_admin';

      if (editingCustomer) {
        const updated = await customerService.updateCustomer(
          editingCustomer.id,
          {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone || undefined,
            documentId: formData.documentId || undefined,
            isCommunityMember: formData.isCommunityMember,
            isActive: formData.isActive,
            notes: formData.notes || undefined
          },
          operatorUid
        );

        setCustomers((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const created = await customerService.createCustomer(
          {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone || undefined,
            documentId: formData.documentId || undefined,
            isCommunityMember: formData.isCommunityMember,
            isActive: formData.isActive,
            notes: formData.notes || undefined
          },
          operatorUid
        );

        setCustomers((prev) => [created, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Ocurrió un error al guardar el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Activar / Desactivar cliente (Soft delete)
  const handleToggleStatus = async (cust: Customer) => {
    try {
      const operatorUid = user?.uid || 'usr_admin';
      const updated = await customerService.toggleCustomerStatus(
        cust.id,
        !cust.isActive,
        operatorUid
      );
      setCustomers((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
    } catch {
      alert('Error al cambiar el estado del cliente.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Gestión Comercial
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Clientes
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Registro comercial de compradores, titulares y miembros comunitarios para SHIKKUM.
            </p>
          </div>

          <button
            id="btn-create-customer"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Cliente</span>
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-search-customers"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, correo, teléfono o documento..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Activos / Inactivos */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({customers.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Activos ({customers.filter((c) => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'inactive'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inactivos ({customers.filter((c) => !c.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* Estados de Carga, Error y Lista */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Cargando catálogo de clientes...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-rose-300 mb-1">Error de sincronización</h3>
          <p className="text-xs text-rose-400/80 max-w-md mx-auto mb-4">{errorMessage}</p>
          <button
            onClick={loadCustomers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm || statusFilter !== 'all'
              ? 'No se encontraron clientes coincidentes'
              : 'No existen clientes registrados.'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            {searchTerm || statusFilter !== 'all'
              ? 'Intente modificar los términos de búsqueda o cambiar el filtro de estado.'
              : 'Empiece registrando al primer comprador titular para habilitar las compras.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>Crear primer cliente</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          {/* Tabla para pantallas medianas/grandes */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5">Contacto</th>
                  <th className="px-6 py-3.5">Documento</th>
                  <th className="px-6 py-3.5">Comunidad</th>
                  <th className="px-6 py-3.5">Estado</th>
                  <th className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs">
                {filteredCustomers.map((cust) => (
                  <tr key={cust.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{cust.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{cust.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{cust.email}</span>
                      </div>
                      {cust.phone && (
                        <div className="flex items-center gap-1.5 text-slate-400 mt-1">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          <span>{cust.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cust.documentId ? (
                        <span className="font-mono bg-slate-950 px-2 py-1 rounded text-slate-300 border border-slate-800">
                          {cust.documentId}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">No especificado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cust.isCommunityMember ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <BadgeCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Miembro</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          <span>No Miembro</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cust.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Activo</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span>Inactivo</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setViewingCustomer(cust)}
                          title="Ver detalle"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(cust)}
                          title="Editar cliente"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(cust)}
                          title={cust.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                          className={`p-1.5 rounded-lg transition ${
                            cust.isActive
                              ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {cust.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tarjetas responsivas para móviles y tablets */}
          <div className="lg:hidden divide-y divide-slate-800">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{cust.fullName}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">{cust.id}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {cust.isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        Inactivo
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500" />
                    <span>{cust.email}</span>
                  </div>
                  {cust.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                      <span>{cust.phone}</span>
                    </div>
                  )}
                  {cust.documentId && (
                    <div className="text-[11px] text-slate-400">
                      Doc: <span className="font-mono text-slate-200">{cust.documentId}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                  <div>
                    {cust.isCommunityMember ? (
                      <span className="text-[11px] text-indigo-400 font-bold">● Miembro</span>
                    ) : (
                      <span className="text-[11px] text-slate-500">○ No Miembro</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingCustomer(cust)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
                    >
                      Ver
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(cust)}
                      className="px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs rounded-lg font-medium"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleToggleStatus(cust)}
                      className={`px-2 py-1 text-xs rounded-lg font-medium ${
                        cust.isActive
                          ? 'bg-rose-500/10 text-rose-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {cust.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">
                {editingCustomer ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Ej. David Ben-Gurion"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="ejemplo@dominio.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  El cliente es un registro comercial. No se crea cuenta Firebase Auth ni contraseña.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555-0100"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Documento de Identidad (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.documentId}
                    onChange={(e) => setFormData({ ...formData, documentId: e.target.value })}
                    placeholder="DNI / Cédula / Pasaporte"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={formData.isCommunityMember}
                    onChange={(e) => setFormData({ ...formData, isCommunityMember: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Miembro de la Comunidad / Sinagoga
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Habilita tarifas preferenciales según las reglas de precio del evento.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Cliente Activo
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Disponible para operaciones comerciales y compras en ventanilla.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notas Internas (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones comerciales o de contacto..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : editingCustomer ? 'Actualizar Cliente' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Detalle */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Detalle del Cliente</h3>
              <button
                onClick={() => setViewingCustomer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Nombre Completo</span>
                <p className="text-sm font-bold text-white">{viewingCustomer.fullName}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Correo Electrónico</span>
                  <p className="text-slate-200">{viewingCustomer.email}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Teléfono</span>
                  <p className="text-slate-200">{viewingCustomer.phone || 'No registrado'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Documento ID</span>
                  <p className="text-slate-200 font-mono">{viewingCustomer.documentId || 'No registrado'}</p>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Condición</span>
                  <p className={viewingCustomer.isCommunityMember ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                    {viewingCustomer.isCommunityMember ? 'Miembro de la Sinagoga' : 'No Miembro'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Estado de la Ficha</span>
                <p className={viewingCustomer.isActive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {viewingCustomer.isActive ? 'Activo (Habilitado para compras)' : 'Inactivo'}
                </p>
              </div>

              {viewingCustomer.notes && (
                <div>
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">Notas</span>
                  <p className="text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    {viewingCustomer.notes}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-500 space-y-1 font-mono">
                <div>ID: {viewingCustomer.id}</div>
                <div>Creado: {new Date(viewingCustomer.createdAt).toLocaleString()}</div>
                <div>Actualizado: {new Date(viewingCustomer.updatedAt).toLocaleString()}</div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-950/50 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
