import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Building2, 
  DollarSign, 
  ArrowRight, 
  PlusCircle, 
  CheckCircle,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  Briefcase
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Customer, Project, Proposal, AppSettings, Transaction } from '../types';
import { formatMoney, formatDate } from '../utils';

interface CustomerManagementViewProps {
  userUid: string;
  customers: Customer[];
  projects: Project[];
  proposals: Proposal[];
  transactions: Transaction[];
  settings: AppSettings;
}

export default function CustomerManagementView({
  userUid,
  customers,
  projects,
  proposals,
  transactions,
  settings
}: CustomerManagementViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const t = (en: string, tr: string, pl: string) => {
    if (settings.lang === 'tr') return tr;
    if (settings.lang === 'pl') return pl;
    return en;
  };

  // 1. Identify Unregistered Clients from existing proposals and projects
  const unregisteredClients = useMemo(() => {
    const registeredNames = new Set(customers.map(c => c.name.toLowerCase().trim()));
    const unregistered = new Map<string, { name: string; company?: string; email?: string }>();

    // Scan proposals
    proposals.forEach(p => {
      if (p.clientName && !registeredNames.has(p.clientName.toLowerCase().trim())) {
        const key = p.clientName.trim();
        if (!unregistered.has(key)) {
          unregistered.set(key, { name: p.clientName, company: p.clientCompany });
        }
      }
    });

    // Scan projects description or metadata for generic client names
    projects.forEach(p => {
      if (p.clientName && !registeredNames.has(p.clientName.toLowerCase().trim())) {
        const key = p.clientName.trim();
        if (!unregistered.has(key)) {
          unregistered.set(key, { name: p.clientName });
        }
      }
    });

    return Array.from(unregistered.values());
  }, [customers, proposals, projects]);

  // Create a customer record
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const customerId = editingCustomer ? editingCustomer.id : `cust-${Date.now()}`;
      const customerData: Customer = {
        id: customerId,
        userId: userUid,
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date().toISOString()
      };

      await setDoc(doc(db, 'customers', customerId), customerData);
      
      // Reset & close
      setIsModalOpen(false);
      setEditingCustomer(null);
      setName('');
      setCompany('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'save_customer');
    }
  };

  // Convert an unregistered discovered client into a registered customer on-the-fly
  const handleRegisterUnregistered = async (client: { name: string; company?: string }) => {
    try {
      const customerId = `cust-${Date.now()}`;
      const customerData: Customer = {
        id: customerId,
        userId: userUid,
        name: client.name,
        company: client.company || '',
        phone: '',
        email: '',
        address: '',
        notes: t('Auto-imported from proposal or project registry.', 'Teklif veya proje kaydından otomatik aktarıldı.', 'Automatycznie zaimportowane z bazy ofert lub projektów.'),
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'customers', customerId), customerData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'register_unregistered_client');
    }
  };

  // Trigger Edit modal
  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setCompany(c.company || '');
    setPhone(c.phone);
    setEmail(c.email);
    setAddress(c.address || '');
    setNotes(c.notes || '');
    setIsModalOpen(true);
  };

  // Handle Delete
  const handleDeleteCustomer = async (id: string) => {
    if (confirm(t('Are you sure you want to delete this customer?', 'Bu müşteriyi silmek istediğinizden emin misiniz?', 'Czy na pewno chcesz usunąć tego klienta?'))) {
      try {
        await deleteDoc(doc(db, 'customers', id));
        if (selectedCustomerId === id) {
          setSelectedCustomerId(null);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `customers/${id}`);
      }
    }
  };

  // Filter customers list
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const search = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(search) ||
        (c.company && c.company.toLowerCase().includes(search)) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.includes(search)
      );
    });
  }, [customers, searchTerm]);

  // Find selected customer object
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Calculate detailed financial and history data for selected customer
  const customerStats = useMemo(() => {
    if (!activeCustomer) return null;

    // A customer is matched to projects by:
    // a) project.clientId === activeCustomer.id
    // b) OR project.clientName matches activeCustomer.name (case-insensitive)
    const matchingProjects = projects.filter(p => 
      p.clientId === activeCustomer.id || 
      (p.clientName && p.clientName.toLowerCase().trim() === activeCustomer.name.toLowerCase().trim())
    );

    const matchingProposals = proposals.filter(prop => 
      prop.clientId === activeCustomer.id || 
      (prop.clientName && prop.clientName.toLowerCase().trim() === activeCustomer.name.toLowerCase().trim())
    );

    // Sum allocated budgets of matching projects
    const totalProjectBudgets = matchingProjects.reduce((sum, p) => sum + p.allocatedBudget, 0);

    // Find all income transactions linked to these projects
    const projectIds = new Set(matchingProjects.map(p => p.id));
    const customerIncomes = transactions.filter(tr => 
      tr.type === 'income' && projectIds.has(tr.projectId)
    );
    const totalPaidToUs = customerIncomes.reduce((sum, tr) => sum + tr.amount, 0);

    // Remaining receivables (alacak)
    const remainingReceivable = Math.max(0, totalProjectBudgets - totalPaidToUs);

    return {
      projects: matchingProjects,
      proposals: matchingProposals,
      totalProjectBudgets,
      totalPaidToUs,
      remainingReceivable,
      incomesList: customerIncomes
    };
  }, [activeCustomer, projects, proposals, transactions]);

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="text-amber-500 w-7 h-7" />
            {t('Customer Management', 'Müşteri Yönetimi', 'Zarządzanie Klientami')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('Manage all customer cards, communications, project histories, and outstanding receivables in one single dashboard.', 'Tüm müşterilerin iletişim bilgilerini, geçmiş projelerini, bekleyen tekliflerini ve alacak durumunu yönetin.', 'Zarządzaj wszystkimi danymi kontaktowymi klientów, historią projektów i zaległymi płatnościami w jednym miejscu.')}
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCustomer(null);
            setName('');
            setCompany('');
            setPhone('');
            setEmail('');
            setAddress('');
            setNotes('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-2xs hover:shadow-sm cursor-pointer text-sm"
        >
          <Plus className="w-5 h-5" />
          {t('Add Customer', 'Yeni Müşteri Ekle', 'Dodaj Klienta')}
        </button>
      </div>

      {/* Discovered Unregistered Clients alert */}
      {unregisteredClients.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900">
                {t('Unregistered Clients Detected', 'Kayıtlı Olmayan Müşteriler Tespit Edildi', 'Wykryto niezarejestrowanych klientów')}
              </h4>
              <p className="text-xs text-amber-700 mt-1">
                {t(
                  'There are clients listed in your active proposals or projects who do not have customer cards yet. Quickly create customer cards for them below.',
                  'Tekliflerde veya projelerde oluşturulmuş fakat sistemde kayıtlı müşteri kartı bulunmayan kişiler mevcut. Tek tıkla müşteri listesine ekleyin.',
                  'W aktywnych ofertach lub projektach znajdują się klienci, którzy nie mają jeszcze kart klienta. Kliknij, aby ich szybko zarejestrować.'
                )}
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unregisteredClients.map((client, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRegisterUnregistered(client)}
                    className="inline-flex items-center gap-1 text-[11px] bg-white border border-amber-200 text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-100 transition-all font-medium cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-500" />
                    {client.name} {client.company ? `(${client.company})` : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Grid: Customers List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('Search customer...', 'Müşteri ara...', 'Szukaj klienta...')}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Customers list stack */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredCustomers.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs space-y-2">
                  <User className="w-8 h-8 mx-auto text-slate-300 opacity-80" />
                  <p>{t('No customers found', 'Müşteri bulunamadı', 'Brak klientów')}</p>
                </div>
              ) : (
                filteredCustomers.map(c => {
                  const isSelected = selectedCustomerId === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCustomerId(isSelected ? null : c.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                        isSelected 
                          ? 'bg-amber-500/10 border-amber-500/30' 
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <h4 className="font-semibold text-slate-900 text-sm truncate flex items-center gap-1.5">
                          <Building2 className={`w-3.5 h-3.5 ${c.company ? 'text-amber-500' : 'text-slate-400'}`} />
                          {c.name}
                        </h4>
                        {c.company && (
                          <p className="text-xs text-slate-500 truncate">{c.company}</p>
                        )}
                        <div className="flex gap-2 text-[10px] text-slate-400">
                          {c.phone && <span className="truncate">{c.phone}</span>}
                          {c.phone && c.email && <span>•</span>}
                          {c.email && <span className="truncate">{c.email}</span>}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isSelected ? 'transform rotate-90 text-amber-500' : ''}`} />
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* Right Grid: Customer Detail Card */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {!activeCustomer ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-50/30 border border-dashed border-slate-200 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center min-h-[350px]"
              >
                <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-3xs mb-4">
                  <User className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-sm font-semibold text-slate-700">
                  {t('No Customer Selected', 'Seçili Müşteri Yok', 'Nie wybrano klienta')}
                </h3>
                <p className="text-xs text-slate-450 mt-1 max-w-sm">
                  {t(
                    'Select a customer from the left side panel to view detailed project histories, sent proposals, contact communication channels, and accounts receivable logs.',
                    'Detaylı şantiye geçmişini, gönderilen teklifleri, iletişim kanallarını ve mali alacak-borç kaydını görüntülemek için sol panelden bir müşteri seçin.',
                    'Wybierz klienta z panelu po lewej stronie, aby wyświetlić historię projektów, oferty, dane kontaktowe i stan rozliczeń.'
                  )}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={activeCustomer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-2xs p-6 space-y-6"
              >
                
                {/* Header card details */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-sm">
                      {activeCustomer.id}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      {activeCustomer.name}
                    </h2>
                    {activeCustomer.company && (
                      <p className="text-sm text-amber-600 font-medium">{activeCustomer.company}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                    <button
                      onClick={() => handleOpenEdit(activeCustomer)}
                      className="p-2 text-slate-500 hover:text-amber-600 hover:bg-slate-50 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 cursor-pointer border border-slate-100"
                    >
                      <Edit3 className="w-4 h-4" />
                      {t('Edit', 'Düzenle', 'Edytuj')}
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(activeCustomer.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                      title={t('Delete Customer', 'Müşteriyi Sil', 'Usuń Klienta')}
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>

                {/* Subgrid: Communication Info & Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left: Communication */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {t('Contact Details', 'İletişim Bilgileri', 'Dane Kontaktowe')}
                    </h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      {activeCustomer.phone ? (
                        <div className="flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <a href={`tel:${activeCustomer.phone}`} className="hover:text-amber-600 hover:underline">{activeCustomer.phone}</a>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 flex items-center gap-2.5">
                          <Phone className="w-4 h-4 text-slate-300" />
                          <i>{t('No phone number entered', 'Telefon girilmemiş', 'Brak numeru telefonu')}</i>
                        </p>
                      )}

                      {activeCustomer.email ? (
                        <div className="flex items-center gap-2.5">
                          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <a href={`mailto:${activeCustomer.email}`} className="hover:text-amber-600 hover:underline break-all">{activeCustomer.email}</a>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 flex items-center gap-2.5">
                          <Mail className="w-4 h-4 text-slate-300" />
                          <i>{t('No email address entered', 'E-posta girilmemiş', 'Brak adresu e-mail')}</i>
                        </p>
                      )}

                      {activeCustomer.address ? (
                        <div className="flex items-start gap-2.5">
                          <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                          <p className="leading-relaxed">{activeCustomer.address}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 flex items-center gap-2.5">
                          <MapPin className="w-4 h-4 text-slate-300" />
                          <i>{t('No physical address entered', 'Adres girilmemiş', 'Brak adresu')}</i>
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    {activeCustomer.notes && (
                      <div className="pt-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          {t('Special Notes', 'Özel Notlar', 'Uwagi')}
                        </h4>
                        <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap leading-relaxed">
                          {activeCustomer.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right: Financial Receivables Statement */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-slate-400" />
                      {t('Financial Ledger Status', 'Alacak-Verecek Cari Durumu', 'Stan Rozliczeń')}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-450 uppercase block font-semibold mb-0.5">{t('Total Project Volume', 'Toplam Proje Bedeli', 'Suma Projektów')}</span>
                        <span className="font-bold text-slate-700 text-sm font-mono">
                          {formatMoney(customerStats?.totalProjectBudgets || 0, settings)}
                        </span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                        <span className="text-[10px] text-slate-450 uppercase block font-semibold mb-0.5">{t('Total Invoiced/Received', 'Tahsil Edilen Tutar', 'Łącznie wpłacono')}</span>
                        <span className="font-bold text-emerald-600 text-sm font-mono">
                          {formatMoney(customerStats?.totalPaidToUs || 0, settings)}
                        </span>
                      </div>
                    </div>

                    {/* Outstanding Balance receivable */}
                    <div className={`p-3 rounded-lg border text-center ${
                      (customerStats?.remainingReceivable || 0) > 0 
                        ? 'bg-amber-50 border-amber-200/60' 
                        : 'bg-emerald-50 border-emerald-200/40'
                    }`}>
                      <span className="text-[10px] uppercase font-bold tracking-wider block text-slate-450 mb-0.5">
                        {t('Remaining Unpaid Receivable', 'Kalan Bekleyen Alacak', 'Należność zaległa')}
                      </span>
                      <span className={`text-lg font-extrabold font-mono ${
                        (customerStats?.remainingReceivable || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {formatMoney(customerStats?.remainingReceivable || 0, settings)}
                      </span>
                    </div>
                  </div>

                </div>

                {/* Subgrid 2: Associated Active Projects & Proposals lists */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    {t('Project & Quotation History', 'Proje ve Teklif Geçmişi', 'Historia Projektów i Ofert')}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Active/Past Projects */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <span>{t('Projects', 'Projeler', 'Projekty')}</span>
                        <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.2 rounded-full">
                          {customerStats?.projects.length || 0}
                        </span>
                      </h4>

                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs">
                        {customerStats?.projects.length === 0 ? (
                          <p className="text-slate-400 italic py-2">{t('No active projects listed.', 'Kayıtlı aktif projesi bulunmamaktadır.', 'Brak przypisanych projektów.')}</p>
                        ) : (
                          customerStats?.projects.map(p => (
                            <div key={p.id} className="p-2 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50/40 hover:bg-slate-50 transition-colors">
                              <div>
                                <p className="font-semibold text-slate-800">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{t('Due:', 'Teslim:', 'Termin:')} {formatDate(p.targetDate, settings)}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                p.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                p.status === 'ongoing' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {p.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Active/Past Proposals */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-600 flex items-center gap-1">
                        <span>{t('Quotations / Proposals', 'Teklifler', 'Oferty')}</span>
                        <span className="bg-slate-100 text-slate-600 font-mono text-[10px] px-1.5 py-0.2 rounded-full">
                          {customerStats?.proposals.length || 0}
                        </span>
                      </h4>

                      <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 text-xs">
                        {customerStats?.proposals.length === 0 ? (
                          <p className="text-slate-400 italic py-2">{t('No proposals found for this client.', 'Kayıtlı aktif teklifi bulunmamaktadır.', 'Brak ofert.')}</p>
                        ) : (
                          customerStats?.proposals.map(prop => (
                            <div key={prop.id} className="p-2 border border-slate-100 rounded-lg flex justify-between items-center bg-slate-50/40 hover:bg-slate-50 transition-colors">
                              <div>
                                <p className="font-semibold text-slate-800">{prop.projectName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">{formatMoney(prop.totalProjectPrice, settings)}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                prop.status === 'accepted' ? 'bg-emerald-50 text-emerald-600' :
                                prop.status === 'sent' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {prop.status}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Subgrid 3: Tahsilat (Payments received list) */}
                <div className="space-y-3 pt-4 border-t border-slate-100 text-xs">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t('Customer Payment Logs', 'Müşteri Ödeme & Tahsilat Kayıtları', 'Historia Wpłat Klienta')}
                  </h3>

                  <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                    {customerStats?.incomesList.length === 0 ? (
                      <p className="text-slate-400 italic py-1">{t('No payment records have been ledgered for this client yet.', 'Bu müşteri adına henüz bir tahsilat girişi yapılmamıştır.', 'Brak wpłat.')}</p>
                    ) : (
                      customerStats?.incomesList.map(tr => (
                        <div key={tr.id} className="p-2 border border-slate-100 rounded-lg flex justify-between items-center bg-emerald-50/20">
                          <div>
                            <p className="font-semibold text-slate-700">{tr.title}</p>
                            <p className="text-[10px] text-slate-400">{formatDate(tr.date, settings)} ({tr.paymentMethod})</p>
                          </div>
                          <span className="font-mono font-bold text-emerald-600">
                            + {formatMoney(tr.amount, settings)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Customer Add/Edit Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full relative z-10 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {editingCustomer 
                  ? t('Edit Customer Card', 'Müşteri Kartını Düzenle', 'Edytuj Kartę Klienta') 
                  : t('Create New Customer Card', 'Yeni Müşteri Kartı Oluştur', 'Dodaj Nowego Klienta')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-5 h-5 transform rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Customer / Contact Name', 'Müşteri Adı / Yetkili Kişi *', 'Imię i nazwisko / Kontakt *')}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ahmet Yılmaz"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Company */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Company Name (Optional)', 'Şirket Ünvanı (İsteğe Bağlı)', 'Nazwa Firmy (Opcjonalnie)')}
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Yılmaz İnşaat Ltd."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Phone Number', 'Telefon Numarası', 'Numer Telefonu')}
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. +90 532 000 0000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Email Address', 'E-posta Adresi', 'Adres E-mail')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="e.g. ahmet@yilmaz.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Physical Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Address', 'Şantiye / İkametgah Adresi', 'Adres')}
                </label>
                <textarea
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Kadıköy, İstanbul"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Special Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Special Notes', 'Müşteriyle İlgili Notlar', 'Uwagi')}
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Ödemeleri düzenli yapar, malzeme kalitesine dikkat eder."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {t('Cancel', 'Vazgeç', 'Anuluj')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {t('Save', 'Kaydet', 'Zapisz')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
