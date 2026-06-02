import React, { useState, useMemo } from 'react';
import { Project, Material, MaterialCategory, MaterialStatus, AppSettings } from '../types';
import { formatMoney } from '../utils';
import { 
  Building2, 
  Plus, 
  Trash2, 
  Edit3, 
  ShoppingBag, 
  ShoppingCart, 
  ClipboardList,
  Filter, 
  Check, 
  X,
  CreditCard,
  Briefcase,
  Layers,
  Search,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BudgetViewProps {
  projects: Project[];
  materials: Material[];
  onAddMaterial: (m: Omit<Material, 'id'>) => void;
  onUpdateMaterial: (m: Material) => void;
  onDeleteMaterial: (materialId: string) => void;
  settings?: AppSettings;
}

const CATEGORIES: MaterialCategory[] = [
  'Kaba İnşaat',
  'Tesisat (Elektrik/Su)',
  'Zemin & Seramik',
  'Boya & Badana',
  'Aydınlatma & Elektrik',
  'Mobilya & Dolap',
  'Hizmet & İşçilik',
  'Diğer'
];

export default function BudgetView({
  projects,
  materials,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
  settings
}: BudgetViewProps) {
  // Fallback settings state
  const activeSettings = settings || {
    lang: 'tr',
    currency: 'TRY',
    theme: 'light',
    timezone: 'Europe/Istanbul',
    defaultVatRate: 20,
    budgetWarningThreshold: 90,
    autoSyncMaterialToLedger: true,
    decimalPlaces: 0,
    showWelcomeBanner: true
  };

  const isEn = activeSettings.lang === 'en';
  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
  } | null>(null);

  // Form Inputs
  const [formProjId, setFormProjId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<MaterialCategory>('Kaba İnşaat');
  const [formVendor, setFormVendor] = useState('');
  const [formQuantity, setFormQuantity] = useState(1);
  const [formUnit, setFormUnit] = useState('Adet');
  const [formUnitPrice, setFormUnitPrice] = useState(0);
  const [formStatus, setFormStatus] = useState<MaterialStatus>('planned');
  const [formIsPaid, setFormIsPaid] = useState(true);
  const [formPurchaseDate, setFormPurchaseDate] = useState('');

  // Filter materials based on user interaction
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchProj = selectedProjectId === 'all' || m.projectId === selectedProjectId;
      const matchCat = selectedCategory === 'all' || m.category === selectedCategory;
      const matchStatus = selectedStatus === 'all' || m.status === selectedStatus;
      const matchSearch = searchTerm.trim() === '' || 
        m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.vendor.toLowerCase().includes(searchTerm.toLowerCase());

      return matchProj && matchCat && matchStatus && matchSearch;
    });
  }, [materials, selectedProjectId, selectedCategory, selectedStatus, searchTerm]);

  // Aggregate stats based on matching filters
  const budgetStats = useMemo(() => {
    let totalPlanned = 0; // planned state
    let totalSpent = 0;   // purchased or delivered state
    let totalPaid = 0;    // paid is true
    let totalUnpaid = 0;  // purchased/delivered but unpaid (our current debt to shop)

    filteredMaterials.forEach((m) => {
      const price = m.totalPrice;
      if (m.status === 'planned') {
        totalPlanned += price;
      } else {
        totalSpent += price;
        if (m.isPaid) {
          totalPaid += price;
        } else {
          totalUnpaid += price;
        }
      }
    });

    return {
      totalPlanned,
      totalSpent,
      totalPaid,
      totalUnpaid,
      totalCount: filteredMaterials.length
    };
  }, [filteredMaterials]);

  // Aggregate calculations per Category summary
  const summaryByCategory = useMemo(() => {
    const summary: Record<MaterialCategory, { planned: number; spent: number; count: number }> = {} as any;
    CATEGORIES.forEach((cat) => {
      summary[cat] = { planned: 0, spent: 0, count: 0 };
    });

    materials
      .filter((m) => selectedProjectId === 'all' || m.projectId === selectedProjectId)
      .forEach((m) => {
        if (summary[m.category]) {
          summary[m.category].count += 1;
          if (m.status === 'planned') {
            summary[m.category].planned += m.totalPrice;
          } else {
            summary[m.category].spent += m.totalPrice;
          }
        }
      });

    return Object.entries(summary).map(([category, data]) => ({
      category: category as MaterialCategory,
      ...data,
    }));
  }, [materials, selectedProjectId]);

  const handleOpenAdd = () => {
    setEditingMaterial(null);
    setFormProjId(projects.length > 0 ? projects[0].id : '');
    setFormTitle('');
    setFormCategory('Kaba İnşaat');
    setFormVendor('');
    setFormQuantity(1);
    setFormUnit('Adet');
    setFormUnitPrice(0);
    setFormStatus('planned');
    setFormIsPaid(false);
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditingMaterial(m);
    setFormProjId(m.projectId);
    setFormTitle(m.title);
    setFormCategory(m.category);
    setFormVendor(m.vendor);
    setFormQuantity(m.quantity);
    setFormUnit(m.unit);
    setFormUnitPrice(m.unitPrice);
    setFormStatus(m.status);
    setFormIsPaid(m.isPaid);
    setFormPurchaseDate(m.purchaseDate || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formProjId) return;

    const calculatedTotal = Number(formQuantity) * Number(formUnitPrice);

    const mData = {
      projectId: formProjId,
      title: formTitle,
      category: formCategory,
      vendor: formVendor,
      quantity: Number(formQuantity),
      unit: formUnit,
      unitPrice: Number(formUnitPrice),
      totalPrice: calculatedTotal,
      status: formStatus,
      isPaid: formStatus === 'planned' ? false : formIsPaid,
      purchaseDate: formStatus !== 'planned' ? formPurchaseDate : undefined,
    };

    if (editingMaterial) {
      onUpdateMaterial({
        ...editingMaterial,
        ...mData,
      });
    } else {
      onAddMaterial(mData);
    }
    setIsModalOpen(false);
  };

  // Switch Material Purchase status and Paid Status quickly
  const togglePaidStatus = (m: Material) => {
    onUpdateMaterial({
      ...m,
      isPaid: !m.isPaid
    });
  };

  const changeMaterialStatus = (m: Material, newStatus: MaterialStatus) => {
    onUpdateMaterial({
      ...m,
      status: newStatus,
      purchaseDate: newStatus !== 'planned' ? (m.purchaseDate || new Date().toISOString().split('T')[0]) : undefined
    });
  };

  // Helper colors for Categories summary
  const getCategoryThemeColors = (cat: MaterialCategory) => {
    switch (cat) {
      case 'Kaba İnşaat': return { bg: 'bg-amber-50', text: 'text-amber-800', bar: 'bg-amber-500' };
      case 'Tesisat (Elektrik/Su)': return { bg: 'bg-blue-50', text: 'text-blue-800', bar: 'bg-blue-500' };
      case 'Zemin & Seramik': return { bg: 'bg-purple-50', text: 'text-purple-800', bar: 'bg-purple-500' };
      case 'Boya & Badana': return { bg: 'bg-emerald-50', text: 'text-emerald-800', bar: 'bg-emerald-500' };
      case 'Aydınlatma & Elektrik': return { bg: 'bg-yellow-50', text: 'text-yellow-800', bar: 'bg-yellow-500' };
      case 'Mobilya & Dolap': return { bg: 'bg-pink-50', text: 'text-pink-800', bar: 'bg-pink-500' };
      case 'Hizmet & İşçilik': return { bg: 'bg-rose-50', text: 'text-rose-800', bar: 'bg-rose-500' };
      case 'Diğer': return { bg: 'bg-slate-50', text: 'text-slate-800', bar: 'bg-slate-500' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Upper metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{isEn ? 'Purchased Materials' : 'Satın Alınan Malzemeler'}</span>
            <ShoppingCart className="w-4 h-4 text-emerald-650" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-850 dark:text-slate-100 font-mono">{formatMoney(budgetStats.totalSpent, activeSettings)}</h3>
            <p className="text-slate-450 dark:text-slate-400 text-[11px] mt-1">{isEn ? 'Paid amount: ' : 'Ödemesi yapılan: '} {formatMoney(budgetStats.totalPaid, activeSettings)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{isEn ? 'Material Balance Owed' : 'Malzeme Borç Bakiyemiz'}</span>
            <CreditCard className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400 font-mono">{formatMoney(budgetStats.totalUnpaid, activeSettings)}</h3>
            <p className="text-slate-450 dark:text-slate-400 text-[11px] mt-1">{isEn ? 'Debts, credit or promissory accounts' : 'Veresiye/Senet alınan nakit bedeller'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{isEn ? 'Planned Extra Needs' : 'Öngörülen Ek İhtiyaç'}</span>
            <ClipboardList className="w-4 h-4 text-blue-505" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 font-mono">{formatMoney(budgetStats.totalPlanned, activeSettings)}</h3>
            <p className="text-slate-450 dark:text-slate-400 text-[11px] mt-1">{isEn ? 'Order pending/to purchase' : 'Siparişe hazır / Alınacak malzemeler'}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
          <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>{isEn ? 'Material Types Count' : 'Genel Malzeme Sayısı'}</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-850 dark:text-slate-100 font-mono">{budgetStats.totalCount} {isEn ? 'Items' : 'Kalem'}</h3>
            <p className="text-slate-450 dark:text-slate-400 text-[11px] mt-1">{isEn ? 'Total defined material & labor list' : 'Toplam tanımlı malzeme ve hizmet'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COMPONENT COLUMN: Category allocations details */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs">
            <h3 className="font-bold text-slate-850 dark:text-slate-100 text-base mb-1">{isEn ? 'Expenses by Category' : 'Kategori Bazlı Harcamalar'}</h3>
            <p className="text-slate-450 dark:text-slate-455 text-xs mb-4">{isEn ? 'Cost structure in selected project' : 'Seçili projedeki bütçe kalemleri dağılımı'}</p>

            <div className="space-y-4">
              {summaryByCategory.map((cat) => {
                const colors = getCategoryThemeColors(cat.category);
                const totalEstimatedForCat = cat.planned + cat.spent;
                const progressPercent = totalEstimatedForCat > 0 
                  ? Math.round((cat.spent / totalEstimatedForCat) * 100) 
                  : 0;

                return (
                  <div key={cat.category} className="p-3 rounded-xl border border-slate-50 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full ${colors?.bg} ${colors?.text}`}>
                        {cat.category}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">({cat.count} {isEn ? 'Product' : 'Ürün'})</span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1">
                      <div className="space-y-0.5">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wide">{isEn ? 'Spent/Purchased' : 'Ödenen/Alınan'}</span>
                        <span className="font-bold text-slate-705 dark:text-slate-205 font-mono">{formatMoney(cat.spent, activeSettings)}</span>
                      </div>
                      <div className="space-y-0.5 text-right font-medium">
                        <span className="text-slate-400 block text-[9px] uppercase tracking-wide">{isEn ? 'Planned Extra' : 'Planlanan Ek'}</span>
                        <span className="font-semibold text-slate-500 dark:text-slate-400 font-mono">{formatMoney(cat.planned, activeSettings)}</span>
                      </div>
                    </div>

                    {/* Category bar progress */}
                    {totalEstimatedForCat > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${colors?.bar}`} 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive material table with filters and searching */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filtering bar panel */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input 
                  type="text" 
                  value={searchTerm}
                  id="search-materials-input"
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Malzeme veya satıcı adı ara..."
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/50"
                />
              </div>

              {/* Action Buttons */}
              <button 
                id="budget-add-material-btn"
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 bg-amber-505 hover:bg-amber-600 bg-amber-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer shadow-xs transition-transform hover:-translate-y-0.5 w-full md:w-auto justify-center"
              >
                <Plus className="w-4 h-4" /> Yeni Malzeme Siparişi Ekle
              </button>
            </div>

            {/* Selection tags controls */}
            <div className="flex flex-wrap gap-2 text-xs pt-2 border-t border-slate-100">
              {/* Project Filter */}
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Proje:</span>
                <select
                  value={selectedProjectId}
                  id="filter-materials-projects"
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="bg-slate-50 border border-slate-150 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">Tüm Projeler</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kategori:</span>
                <select
                  value={selectedCategory}
                  id="filter-materials-category"
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-slate-50 border border-slate-150 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="all">Tüm Kategoriler</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Purchase Status Filter */}
              <div className="flex items-center gap-1.5 min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alım Durum:</span>
                <select
                  value={selectedStatus}
                  id="filter-materials-status"
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-slate-50 border border-slate-150 rounded-lg px-2 py-1 text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tümünü Göster</option>
                  <option value="planned">Planlanan (Alınacak)</option>
                  <option value="purchased">Alındı (Fatura Kesildi)</option>
                  <option value="delivered">Şantiyeye Teslim Edildi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive list items */}
          <div className="space-y-3">
            {filteredMaterials.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-250 text-center text-slate-400 space-y-2">
                <ShoppingBag className="w-10 h-10 stroke-[1.5] mx-auto text-slate-300" />
                <h4 className="font-semibold text-slate-700 text-sm">Malzeme Kalemi Bulunamadı</h4>
                <p className="text-xs max-w-xs mx-auto text-slate-450">
                  Filitreleri gevşetmeyi deneyin ya da yeni bir malzeme/sipariş kaydı girmeyi ihmal etmeyin.
                </p>
              </div>
            ) : (
              filteredMaterials.map((m) => {
                const projName = projects.find(p => p.id === m.projectId)?.name || 'Bilinmeyen Proje';
                const colors = getCategoryThemeColors(m.category);

                return (
                  <div 
                    key={m.id}
                    className="bg-white p-4 rounded-xl border border-slate-100 hover:border-slate-300 shadow-2xs group hover:shadow-xs transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative"
                  >
                    <div className="space-y-1.5 flex-grow pr-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${colors?.bg} ${colors?.text}`}>
                          {m.category}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 truncate max-w-[150px]" title={projName}>
                          {projName}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-800 text-sm md:text-base">{m.title}</h4>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-1">
                        <span>{isEn ? 'Vendor:' : 'Satıcı:'} <strong className="text-slate-605 dark:text-slate-350">{m.vendor || (isEn ? 'Not specified' : 'Belirtilmedi')}</strong></span>
                        <span>{isEn ? 'Qty:' : 'Miktar:'} <strong className="text-slate-650 dark:text-slate-300">{m.quantity} {m.unit}</strong></span>
                        <span>{isEn ? 'Unit Price:' : 'Birim Fiyat:'} <strong className="text-slate-650 dark:text-slate-300 font-mono">{formatMoney(m.unitPrice, activeSettings)}</strong></span>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col justify-between items-end gap-3 w-full md:w-auto border-t md:border-none pt-3 md:pt-0">
                      <div className="space-y-0.5 text-left md:text-right">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">{isEn ? 'Total Price' : 'Toplam Bedel'}</span>
                        <span className="font-bold text-slate-805 dark:text-slate-205 font-mono text-base">{formatMoney(m.totalPrice, activeSettings)}</span>
                      </div>

                      {/* Interactive toggle actions buttons and indicators */}
                      <div className="flex items-center gap-2">
                        {/* Status Switcher indicator badge or interactive check */}
                        {m.status === 'planned' ? (
                          <button 
                            id={`btn-mark-purchased-${m.id}`}
                            onClick={() => changeMaterialStatus(m, 'purchased')}
                            className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded font-bold cursor-pointer transition-colors border border-slate-200/50 dark:border-slate-700/60"
                          >
                            {isEn ? 'Mark Purchased' : 'Alındı İşaretle'}
                          </button>
                        ) : (
                          <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                            m.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                          }`}>
                            {m.status === 'delivered' ? (isEn ? 'Delivered' : 'Teslim Edildi') : (isEn ? 'Purchased' : 'Alındı')}
                          </span>
                        )}

                        {/* Paid Toggle badge */}
                        {m.status !== 'planned' && (
                          <button
                            id={`btn-toggle-paid-${m.id}`}
                            onClick={() => togglePaidStatus(m)}
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded cursor-pointer border ${
                              m.isPaid 
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                : 'bg-red-50 border-red-300 text-red-800 animate-pulse'
                            }`}
                            title={m.isPaid ? "Tahsil Edildi (Gider Olarak Ödendi)" : "Borç Olarak Bekliyor! Ödendi Olarak Değiştirmek İçin Dokun"}
                          >
                            {m.isPaid ? 'ÖDENDİ' : 'VERESİYE/BORÇ'}
                          </button>
                        )}

                        <div className="flex gap-1 pl-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            id={`btn-edit-mat-${m.id}`}
                            onClick={() => handleOpenEdit(m)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            id={`btn-delete-mat-${m.id}`}
                            onClick={() => {
                              setDeleteConfirmInfo({
                                isOpen: true,
                                id: m.id,
                                title: m.title
                              });
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* MATERIAL MODAL (Add / Edit) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4 relative"
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-850">
                  {editingMaterial ? 'Malzeme Kartını Düzenle' : 'Yeni Malzeme/Hizmet Girişi'}
                </h3>
                <p className="text-xs text-slate-400">Satın alınan veya alınması planlanan kalemlerin detayları</p>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">İlgili Proje</label>
                    <select
                      id="mat-modal-input-proj"
                      required
                      value={formProjId}
                      onChange={(e) => setFormProjId(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Kategori</label>
                    <select
                      id="mat-modal-input-cat"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as MaterialCategory)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Malzeme / İş Kalemi Adı</label>
                  <input 
                    type="text" 
                    required
                    id="mat-modal-input-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="E.g., 60x120 Seramik Karo, Alçıpan Profili"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Satıcı (Mağaza veya Taşeron)</label>
                  <input 
                    type="text" 
                    id="mat-modal-input-vendor"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    placeholder="Örn: Koçtaş, Mehmet Seramik Usta"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/20"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Miktar</label>
                    <input 
                      type="number" 
                      required
                      min={1}
                      id="mat-modal-input-quantity"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Number(e.target.value))}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono bg-slate-50/10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Birim</label>
                    <input 
                      type="text" 
                      required
                      id="mat-modal-input-unit"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="Adet, Kutu, m², torba"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/10"
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1 space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? `Unit Price (${activeSettings.currency})` : `Birim Fiyat (${activeSettings.currency === 'TRY' ? '₺' : activeSettings.currency})`}
                    </label>
                    <input 
                      type="number" 
                      required
                      min={0}
                      id="mat-modal-input-unitprice"
                      value={formUnitPrice}
                      onChange={(e) => setFormUnitPrice(Number(e.target.value))}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono bg-slate-50/10"
                    />
                  </div>
                </div>

                {/* Auto Calculated Sum indicator tag */}
                <div className="p-3 bg-amber-550/10 dark:bg-amber-500/10 border border-amber-500/20 rounded-xl flex justify-between items-center text-xs text-amber-900 dark:text-amber-200 font-bold">
                  <span>{isEn ? 'Calculated Total Price:' : 'Hesaplanan Toplam Bedel:'}</span>
                  <span className="font-mono text-sm">{formatMoney(formQuantity * formUnitPrice, activeSettings)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{isEn ? 'Order / Acquisition Status' : 'Sipariş / Alım Durumu'}</label>
                    <select
                      id="mat-modal-input-status"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as MaterialStatus)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/20 cursor-pointer"
                    >
                      <option value="planned">{isEn ? 'Planned Only (Extra Budget)' : 'Sadece Planlanan (Ek Bütçe)'}</option>
                      <option value="purchased">{isEn ? 'Purchased / Invoiced' : 'Satın Alındı / Faturası Kesildi'}</option>
                      <option value="delivered">{isEn ? 'Delivered to Site' : 'Şantiyeye Sevk Edildi'}</option>
                    </select>
                  </div>
                  
                  {formStatus !== 'planned' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-600 uppercase">Satın Alma Tarihi</label>
                      <input 
                        type="date" 
                        required
                        id="mat-modal-input-date"
                        value={formPurchaseDate}
                        onChange={(e) => setFormPurchaseDate(e.target.value)}
                        className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/20"
                      />
                    </div>
                  )}
                </div>

                {formStatus !== 'planned' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input 
                      type="checkbox" 
                      id="mat-modal-input-ispaid"
                      checked={formIsPaid}
                      onChange={(e) => setFormIsPaid(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <label htmlFor="mat-modal-input-ispaid" className="text-xs font-semibold text-slate-700 cursor-pointer">
                      Bu malzemeyi peşin ödedim (Kasadaki Nakitten Çıkılsın)
                    </label>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button 
                    type="submit" 
                    id="mat-modal-submit-btn"
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 shadow-md transition-colors cursor-pointer"
                  >
                    {editingMaterial ? 'Güncelle' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteConfirmInfo?.isOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-6 space-y-5 relative"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-50 text-red-650 rounded-xl flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 font-sans">Malzemeyi Sil</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    "{deleteConfirmInfo.title}" adlı malzeme kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                  </p>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button 
                  type="button" 
                  onClick={() => setDeleteConfirmInfo(null)}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button 
                  type="button" 
                  id="confirm-delete-material-btn"
                  onClick={() => {
                    onDeleteMaterial(deleteConfirmInfo.id);
                    setDeleteConfirmInfo(null);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 shadow-xs transition-colors cursor-pointer"
                >
                  Evet, Sil
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
