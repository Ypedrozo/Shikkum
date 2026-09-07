import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  RefreshCw,
  Phone,
  Mail,
  FileText,
  BadgeCheck,
  AlertCircle,
  X,
  Info
} from 'lucide-react';
import { Customer } from '../../types';
import { customerService } from '../../services/customer.service';
import { useAuth } from '../../context/AuthContext';

interface CashierCustomersPageProps {
  onNavigate?: (path: string) => void;
}

export const CashierCustomersPage: React.FC<CashierCustomersPageProps> = () => {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Búsqueda
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active'); // Por defecto activos para ventas

  // Modal Registrar Nuevo Cliente desde Cobranzas
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    isCommunityMember: false,
    notes: ''
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal Edición Básica desde Cobranzas (Solo nombre, correo, teléfono, documento)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [basicEditForm, setBasicEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    documentId: '',
    notes: ''
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Modal Ver Detalle
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const loadCustomers = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await customerService.getCustomers();
      setCustomers(data);
    } catch {
      setErrorMessage('Error al consultar clientes desde la terminal de Cobranzas.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  // Filtrado
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

  // Manejar creación rápida por Cobranzas
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const validation = customerService.validateCustomer({
      fullName: newCustomerForm.fullName,
      email: newCustomerForm.email,
      isCommunityMember: newCustomerForm.isCommunityMember
    });

    if (!validation.isValid) {
      setCreateError(validation.error || 'Datos incompletos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const operatorUid = user?.uid || 'usr_cashier';
      const created = await customerService.createCustomer(
        {
          fullName: newCustomerForm.fullName,
          email: newCustomerForm.email,
          phone: newCustomerForm.phone || undefined,
          documentId: newCustomerForm.documentId || undefined,
          isCommunityMember: newCustomerForm.isCommunityMember,
          isActive: true, // Siempre activo al crearse por Cobranzas
          notes: newCustomerForm.notes || undefined
        },
        operatorUid
      );

      setCustomers((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setNewCustomerForm({
        fullName: '',
        email: '',
        phone: '',
        documentId: '',
        isCommunityMember: false,
        notes: ''
      });
    } catch (err: any) {
      setCreateError(err.message || 'No fue posible registrar al cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar edición básica autorizada para Cobranzas
  const handleBasicEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    setEditError(null);

    const validation = customerService.validateCustomer({
      fullName: basicEditForm.fullName,
      email: basicEditForm.email,
      isCommunityMember: editingCustomer.isCommunityMember
    });

    if (!validation.isValid) {
      setEditError(validation.error || 'Datos no válidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const operatorUid = user?.uid || 'usr_cashier';
      // Cobranzas solo actualiza nombre, correo, teléfono, documento y notas
      const updated = await customerService.updateCustomer(
        editingCustomer.id,
        {
          fullName: basicEditForm.fullName,
          email: basicEditForm.email,
          phone: basicEditForm.phone || undefined,
          documentId: basicEditForm.documentId || undefined,
          notes: basicEditForm.notes || undefined
        },
        operatorUid
      );

      setCustomers((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setEditingCustomer(null);
    } catch (err: any) {
      setEditError(err.message || 'Error al actualizar datos del cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                <Users className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Módulo Cobranzas
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Consulta de Clientes
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Búsqueda y verificación de clientes para habilitación de compras y emisión en ventanilla.
            </p>
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Cliente</span>
          </button>
        </div>

        {/* Búsqueda y Filtro */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar cliente por nombre, correo, teléfono o DNI..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
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

          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 self-start">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Habilitados ({customers.filter((c) => c.isActive).length})
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Todos ({customers.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tabla / Lista */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium">Buscando clientes registrados...</p>
        </div>
      ) : errorMessage ? (
        <div className="bg-rose-950/30 border border-rose-800/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-rose-300 mb-1">Error de consulta</h3>
          <p className="text-xs text-rose-400/80 max-w-md mx-auto mb-4">{errorMessage}</p>
          <button
            onClick={loadCustomers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reintentar</span>
          </button>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white mb-1">
            {searchTerm ? 'No se encontraron clientes coincidentes' : 'No hay clientes disponibles'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
            {searchTerm
              ? 'Verifique la ortografía o registre un nuevo cliente para la compra.'
              : 'Puede registrar nuevos clientes en ventanilla utilizando el botón superior.'}
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Cliente en Ventanilla</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-emerald-400" />
              <span>Rol Cobranzas: Consulta, registro y edición de datos comerciales básicos.</span>
            </span>
            <span className="font-semibold text-slate-300">
              {filteredCustomers.length} clientes encontrados
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Cliente</th>
                  <th className="px-6 py-3.5">Correo y Teléfono</th>
                  <th className="px-6 py-3.5">Documento</th>
                  <th className="px-6 py-3.5">Tarifa / Condición</th>
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
                        <span className="text-slate-500 italic">No registrado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cust.isCommunityMember ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          <BadgeCheck className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Miembro Comunitario</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          <span>Tarifa General</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {cust.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Habilitado</span>
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
                          title="Ver Ficha"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingCustomer(cust);
                            setBasicEditForm({
                              fullName: cust.fullName,
                              email: cust.email,
                              phone: cust.phone || '',
                              documentId: cust.documentId || '',
                              notes: cust.notes || ''
                            });
                            setEditError(null);
                          }}
                          title="Editar Datos de Contacto"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden divide-y divide-slate-800">
            {filteredCustomers.map((cust) => (
              <div key={cust.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">{cust.fullName}</h3>
                    <p className="text-[11px] text-slate-400">{cust.email}</p>
                  </div>
                  {cust.isCommunityMember ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                      Miembro
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      General
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                  <span className="text-slate-400 font-mono">{cust.documentId || 'Sin documento'}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewingCustomer(cust)}
                      className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs"
                    >
                      Ficha
                    </button>
                    <button
                      onClick={() => {
                        setEditingCustomer(cust);
                        setBasicEditForm({
                          fullName: cust.fullName,
                          email: cust.email,
                          phone: cust.phone || '',
                          documentId: cust.documentId || '',
                          notes: cust.notes || ''
                        });
                        setEditError(null);
                      }}
                      className="px-2.5 py-1 bg-emerald-600/20 text-emerald-400 font-medium rounded-lg text-xs"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Registrar Cliente Ventanilla */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Registrar Cliente en Ventanilla</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCustomerForm.fullName}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, fullName: e.target.value })}
                  placeholder="Nombre y Apellidos del comprador"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={newCustomerForm.email}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                  placeholder="cliente@correo.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newCustomerForm.phone}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    placeholder="+1 555-0199"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Documento de Identidad (DNI)
                  </label>
                  <input
                    type="text"
                    value={newCustomerForm.documentId}
                    onChange={(e) => setNewCustomerForm({ ...newCustomerForm, documentId: e.target.value })}
                    placeholder="Documento oficial"
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={newCustomerForm.isCommunityMember}
                  onChange={(e) => setNewCustomerForm({ ...newCustomerForm, isCommunityMember: e.target.checked })}
                  className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-semibold text-white block">
                    Miembro de la Comunidad / Sinagoga
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Aplica tarifas especiales de miembro en la cotización.
                  </span>
                </div>
              </label>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Registrando...' : 'Registrar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edición Básica Comercial (Cobranzas) */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Editar Datos de Contacto</h2>
                <p className="text-[11px] text-slate-400">Modificación autorizada de información comercial básica</p>
              </div>
              <button
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBasicEditSubmit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nombre Completo <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={basicEditForm.fullName}
                  onChange={(e) => setBasicEditForm({ ...basicEditForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Correo Electrónico <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={basicEditForm.email}
                  onChange={(e) => setBasicEditForm({ ...basicEditForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={basicEditForm.phone}
                    onChange={(e) => setBasicEditForm({ ...basicEditForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Documento de Identidad (DNI)
                  </label>
                  <input
                    type="text"
                    value={basicEditForm.documentId}
                    onChange={(e) => setBasicEditForm({ ...basicEditForm, documentId: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Restricciones de Cobranzas:</div>
                <p>
                  Cobranzas no puede alterar la condición de miembro de la sinagoga ni el estado de activación de la ficha. Solo un Administrador puede modificar estos campos.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Ficha */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Ficha de Cliente</h3>
              <button
                onClick={() => setViewingCustomer(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Nombre Completo</span>
                <p className="text-base font-bold text-white">{viewingCustomer.fullName}</p>
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
                    {viewingCustomer.isCommunityMember ? 'Miembro de la Sinagoga' : 'Tarifa General'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Estado</span>
                <p className={viewingCustomer.isActive ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                  {viewingCustomer.isActive ? 'Habilitado para Compras' : 'Inactivo'}
                </p>
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
