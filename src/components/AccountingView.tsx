import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, Transaction, TransactionType, AppSettings } from '../types';
import { formatMoney, formatDate } from '../utils';
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight, 
  ArrowDownRight, 
  Download, 
  Upload, 
  Filter, 
  Calendar,
  X,
  CreditCard,
  Building2,
  FileText,
  AlertCircle,
  Edit3,
  AlertTriangle,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Firebase import for subview backups
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AccountingViewProps {
  projects: Project[];
  transactions: Transaction[];
  onAddTransaction: (t: Omit<Transaction, 'id'>) => void;
  onUpdateTransaction: (t: Transaction) => void;
  onDeleteTransaction: (transactionId: string) => void;
  onImportBackup: (importedData: { projects?: any[]; tasks?: any[]; materials?: any[]; transactions?: any[] }) => boolean;
  allDataExportString: string; // Ready loaded JSON dump
  settings?: AppSettings;
}

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Elden / Nakit' },
  { key: 'card', label: 'Kredi Kartı' },
  { key: 'bank_transfer', label: 'Banka Havalesi / EFT' },
  { key: 'debt', label: 'Açık Hesap / Veresiye' }
];

const GIDER_KATEGORILERI = [
  'Kaba İnşaat Malzemesi',
  'Tesisat & Altyapı',
  'Usta İşçilik & Hizmet',
  'Taşıma & Nakliye & Moloz',
  'Aydınlatma & Aksesuar',
  'Mobilya & Dolap Kapakları',
  'Ruhsat & Belediye & Harç',
  'Diğer Giderler'
];

export default function AccountingView({
  projects,
  transactions,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onImportBackup,
  allDataExportString,
  settings
}: AccountingViewProps) {
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
  const [projectIdFilter, setProjectIdFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dynamic Transaction Categories
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('tadilat_gider_kategoriler');
    return saved ? JSON.parse(saved) : [
      'Kaba İnşaat Malzemesi',
      'Tesisat & Altyapı',
      'Usta İşçilik & Hizmet',
      'Taşıma & Nakliye & Moloz',
      'Aydınlatma & Aksesuar',
      'Mobilya & Dolap Kapakları',
      'Ruhsat & Belediye & Harç',
      'Diğer Giderler'
    ];
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('tadilat_gelir_kategoriler');
    return saved ? JSON.parse(saved) : [
      'Bütçe Aktarımı',
      'Banka Kredisi',
      'Ortak Sermaye',
      'Yedek Akçe',
      'Müşteri Hak Edişi',
      'Diğer Gelirler'
    ];
  });

  // State to manage dynamic headers view
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [showCategoryPanel, setShowCategoryPanel] = useState(false);

  // Recurring (Monthly Fixed) Ledger Transactions list
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>(() => {
    const saved = localStorage.getItem('tadilat_sabit_islemler');
    return saved ? JSON.parse(saved) : [
      {
        id: 'rec-1',
        title: 'Aylık Şantiye Altyapı Bağlantısı',
        type: 'expense',
        category: 'Tesisat & Altyapı',
        amount: 850,
        dayOfMonth: 15,
        paymentMethod: 'bank_transfer',
        isActive: true,
        notes: 'Fiber Telekom şantiye internet hattı bedeli'
      },
      {
        id: 'rec-2',
        title: 'Aylık Ruhsat Harcı & Danışmanlık',
        type: 'expense',
        category: 'Ruhsat & Belediye & Harç',
        amount: 7500,
        dayOfMonth: 5,
        paymentMethod: 'bank_transfer',
        isActive: true,
        notes: 'Mimari ruhsat müşavirliği sabit takip faturası'
      }
    ];
  });

  // States to add new Recurring item
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recType, setRecType] = useState<'income' | 'expense'>('expense');
  const [recCategory, setRecCategory] = useState('Usta İşçilik & Hizmet');
  const [recAmount, setRecAmount] = useState('');
  const [recDay, setRecDay] = useState(1);
  const [recPayMethod, setRecPayMethod] = useState('bank_transfer');
  const [recNotes, setRecNotes] = useState('');

  // Automatically sync categories and recurring items back to Firestore when changed
  useEffect(() => {
    const syncAccountingConfigs = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const profile = snap.data();
          await setDoc(docRef, {
            ...profile,
            expenseCategories,
            incomeCategories,
            // also backup recurring definitions for complete cloud profile persistence
            recurringTransactions: recurringTransactions || []
          });
        }
      } catch (err) {
        console.error("Failed to sync custom categories to Firestore in background: ", err);
      }
    };
    syncAccountingConfigs();
  }, [expenseCategories, incomeCategories, recurringTransactions]);

  // Modal / Inputs state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
  } | null>(null);

  // Form Inputs
  const [formProjId, setFormProjId] = useState('global');
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<TransactionType>('expense');
  const [formCategory, setFormCategory] = useState('Usta İşçilik & Hizmet');
  const [formAmount, setFormAmount] = useState(0);
  const [formDate, setFormDate] = useState('');
  const [formPayMethod, setFormPayMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'debt'>('bank_transfer');
  const [formNotes, setFormNotes] = useState('');

  // Hidden File input ref for data restoring files
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter transaction records
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchProj = projectIdFilter === 'all' || t.projectId === projectIdFilter;
      const matchType = typeFilter === 'all' || t.type === typeFilter;
      const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
      return matchProj && matchType && matchCat;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, projectIdFilter, typeFilter, categoryFilter]);

  // Financial intelligence calculation block
  const balances = useMemo(() => {
    let totalInjections = 0; // income
    let totalExpenses = 0;   // expense

    // Sum transactions belonging to selected projection view
    transactions.forEach((t) => {
      const isMatchingProject = projectIdFilter === 'all' || t.projectId === projectIdFilter;
      if (!isMatchingProject) return;

      if (t.type === 'income') {
        totalInjections += t.amount;
      } else {
        totalExpenses += t.amount;
      }
    });

    const netBalance = totalInjections - totalExpenses;

    // Get default target budget constraints for visual checks
    let projectBudgetLimit = 0;
    if (projectIdFilter !== 'all' && projectIdFilter !== 'global') {
      projectBudgetLimit = projects.find(p => p.id === projectIdFilter)?.allocatedBudget || 0;
    } else {
      projectBudgetLimit = projects.reduce((sum, p) => sum + p.allocatedBudget, 0);
    }

    return {
      totalInjections,
      totalExpenses,
      netBalance,
      projectBudgetLimit,
      overspent: totalExpenses > projectBudgetLimit && projectBudgetLimit > 0,
    };
  }, [transactions, projects, projectIdFilter]);

  const handleOpenAdd = (type: TransactionType = 'expense') => {
    setEditingTransaction(null);
    setFormProjId(projectIdFilter !== 'all' ? projectIdFilter : 'global');
    setFormTitle('');
    setFormType(type);
    setFormCategory(type === 'income' ? 'Bütçe Girişi' : 'Usta İşçilik & Hizmet');
    setFormAmount(0);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormPayMethod('bank_transfer');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: Transaction) => {
    setEditingTransaction(t);
    setFormProjId(t.projectId);
    setFormTitle(t.title);
    setFormType(t.type);
    setFormCategory(t.category);
    setFormAmount(t.amount);
    setFormDate(t.date);
    setFormPayMethod(t.paymentMethod);
    setFormNotes(t.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formProjId) return;

    const tData = {
      projectId: formProjId,
      title: formTitle,
      type: formType,
      category: formCategory,
      amount: Number(formAmount),
      date: formDate,
      paymentMethod: formPayMethod,
      notes: formNotes || undefined,
    };

    if (editingTransaction) {
      onUpdateTransaction({
        ...editingTransaction,
        ...tData,
      });
    } else {
      onAddTransaction(tData);
    }
    setIsModalOpen(false);
  };

  // Dynamic custom category actions
  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    if (newCatType === 'expense') {
      const updated = [...expenseCategories, newCatName.trim()];
      setExpenseCategories(updated);
      localStorage.setItem('tadilat_gider_kategoriler', JSON.stringify(updated));
    } else {
      const updated = [...incomeCategories, newCatName.trim()];
      setIncomeCategories(updated);
      localStorage.setItem('tadilat_gelir_kategoriler', JSON.stringify(updated));
    }
    setNewCatName('');
  };

  const handleDeleteCategory = (cat: string, type: 'income' | 'expense') => {
    if (type === 'expense') {
      const updated = expenseCategories.filter(c => c !== cat);
      setExpenseCategories(updated);
      localStorage.setItem('tadilat_gider_kategoriler', JSON.stringify(updated));
    } else {
      const updated = incomeCategories.filter(c => c !== cat);
      setIncomeCategories(updated);
      localStorage.setItem('tadilat_gelir_kategoriler', JSON.stringify(updated));
    }
  };

  // Recurring (Monthly Fixed) Transaction Actions
  const handleAddRecurring = () => {
    if (!recTitle.trim() || !recAmount) return;
    const item = {
      id: 'rec-' + Date.now(),
      title: recTitle.trim(),
      type: recType,
      category: recCategory,
      amount: Number(recAmount),
      dayOfMonth: Number(recDay),
      paymentMethod: recPayMethod,
      isActive: true,
      notes: recNotes.trim() || undefined
    };
    const updated = [...recurringTransactions, item];
    setRecurringTransactions(updated);
    localStorage.setItem('tadilat_sabit_islemler', JSON.stringify(updated));

    setRecTitle('');
    setRecAmount('');
    setRecNotes('');
  };

  const handleToggleRecurringActive = (id: string) => {
    const updated = recurringTransactions.map(t => {
      if (t.id === id) return { ...t, isActive: !t.isActive };
      return t;
    });
    setRecurringTransactions(updated);
    localStorage.setItem('tadilat_sabit_islemler', JSON.stringify(updated));
  };

  const handleDeleteRecurring = (id: string) => {
    const updated = recurringTransactions.filter(t => t.id !== id);
    setRecurringTransactions(updated);
    localStorage.setItem('tadilat_sabit_islemler', JSON.stringify(updated));
  };

  const handleLaunchRecurringTransaction = (item: any) => {
    onAddTransaction({
      projectId: 'global',
      title: `[Aylık Sabit] ${item.title}`,
      type: item.type,
      category: item.category,
      amount: item.amount,
      date: new Date().toISOString().split('T')[0],
      paymentMethod: item.paymentMethod,
      notes: `Düzenli şablondan cari aya üretildi. Sabit Not: ${item.notes || ''}`
    });
    alert(`"${item.title}" işlemi cari muhasebe defterine başarıyla eklendi!`);
  };

  // Import Handler (reads JSON and restores application states)
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.projects || json.materials || json.transactions) {
          onImportBackup(json);
          alert('Tadilat muhasebe verileriniz başarıyla geri yüklendi!');
        } else {
          alert('Hata: Geçersiz şablon dosyası! Lütfen doğru yedek dosyasını yükleyin.');
        }
      } catch (err) {
        alert('Dosya okuma hatası! JSON formatı bozuk.');
      }
    };
    reader.readAsText(file);
  };

  const triggerImportClick = () => {
    fileInputRef.current?.click();
  };

  // Download export helper
  const handleDownloadBackup = () => {
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(allDataExportString);
    const exportFileDefaultName = `tadilat_muhasebe_yedek_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      
      {/* Financial health alert for overspending */}
      {balances.overspent && (
        <div className="bg-red-50 dark:bg-rose-950/20 border border-red-200 dark:border-rose-900/40 text-red-800 dark:text-rose-300 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0 text-red-600" />
          <div className="space-y-1">
            <h4 className="font-semibold text-sm">{isEn ? 'Financial Budget Overrun Alert!' : 'Finansal Bütçe Aşımı Riski!'}</h4>
            <p className="text-xs text-red-705 dark:text-rose-350">
              {isEn ? (
                `Total expenditures on this project (${formatMoney(balances.totalExpenses, activeSettings)}) have run past the target allocation limit of ${formatMoney(balances.projectBudgetLimit, activeSettings)}. Please examine actual costs.`
              ) : (
                `Bu projedeki toplam harcama bedelleri (${formatMoney(balances.totalExpenses, activeSettings)}), projeye ayrılan sınır bütçeyi (${formatMoney(balances.projectBudgetLimit, activeSettings)}) aşmış durumda. Lütfen maliyetleri gözden geçirin.`
              )}
            </p>
          </div>
        </div>
      )}

      {/* Accounting Consolidated Reports Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs gap-4">
        <div className="space-y-2 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-850">Kasa &amp; Defter Muhasebe Raporu</h2>
          </div>
          
          {/* Select scope filter */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
            <span>Raporlama Çerçevesi:</span>
            <select
              value={projectIdFilter}
              id="accounting-filter-scope"
              onChange={(e) => setProjectIdFilter(e.target.value)}
              className="bg-slate-50 border border-slate-205 border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-semibold focus:outline-none cursor-pointer max-w-[200px]"
            >
              <option value="all">Genel Muhasebe (Tüm İşler)</option>
              <option value="global">Sadece Bağımsız Giderler / Genel</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Backup and Restore controls */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFileChange}
            accept=".json"
            className="hidden"
          />
          <button 
            id="backup-import-btn"
            onClick={triggerImportClick}
            className="flex items-center gap-1 text-xs font-semibold px-3.5 py-2 bg-slate-100 hover:bg-slate-250 hover:bg-slate-200 text-slate-650 rounded-xl transition-colors cursor-pointer"
            title="Dışarıdan JSON Yedek Dosyası Geri Yükle"
          >
            <Upload className="w-3.5 h-3.5" /> Veri Yükle
          </button>
          <button 
            id="backup-export-btn"
            onClick={handleDownloadBackup}
            className="flex items-center gap-1 text-xs font-semibold px-3.5 py-2 bg-slate-100 hover:bg-slate-250 hover:bg-slate-200 text-slate-650 rounded-xl transition-colors cursor-pointer"
            title="Tüm Proje ve Muhasebe Verilerini Yedekle"
          >
            <Download className="w-3.5 h-3.5" /> Yedek Al (.JSON)
          </button>
        </div>
      </div>

      {/* Accounting balance summaries */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Injections */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider block">{isEn ? 'Inflow / Budgeted Funds' : 'Giriş / Bütçelenen Fon'}</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
              {formatMoney(balances.totalInjections, activeSettings)}
            </h3>
            {projectIdFilter !== 'all' && projectIdFilter !== 'global' && (
              <p className="text-[10px] text-slate-400">{isEn ? 'Project Allocation Limit: ' : 'Proje Sınır Hedefi: '}{formatMoney(balances.projectBudgetLimit, activeSettings)}</p>
            )}
          </div>
        </div>

        {/* Total Outflows */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex items-center gap-4">
          <div className="p-3.5 bg-red-50 dark:bg-rose-950/40 text-red-650 rounded-2xl">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider block font-semibold">{isEn ? 'Total Outflow / Expenses' : 'Toplam Çıkış / Giderler'}</span>
            <h3 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-200 font-mono mt-0.5">
              {formatMoney(balances.totalExpenses, activeSettings)}
            </h3>
            {balances.projectBudgetLimit > 0 && (
              <p className="text-[10px] text-slate-400">
                {isEn ? 'Quota Spent Ratio: ' : 'Limit Doluluk Oranı: '}%{Math.round((balances.totalExpenses / balances.projectBudgetLimit) * 105 / 105 * 100)}
              </p>
            )}
          </div>
        </div>

        {/* Net Remaining Cash in Hand */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs flex items-center gap-4">
          <div className={`p-3.5 rounded-2xl ${balances.netBalance >= 0 ? 'bg-amber-50 dark:bg-amber-955/40 text-amber-500' : 'bg-rose-50 dark:bg-rose-955/40 text-rose-500'}`}>
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] md:text-xs font-bold uppercase tracking-wider block font-semibold">{isEn ? 'Book Balance (Remaining)' : 'Kasa Dengesi (Kalan Nakit)'}</span>
            <h3 className={`text-xl md:text-2xl font-bold font-mono mt-0.5 ${balances.netBalance >= 0 ? 'text-amber-600' : 'text-rose-600'}`}>
              {formatMoney(balances.netBalance, activeSettings)}
            </h3>
            <p className="text-[10px] text-slate-400">{isEn ? 'Net remaining cash pool' : 'Sermaye eksi harcanan net kasa'}</p>
          </div>
        </div>
      </div>

      {/* 4. GELİR-GİDER BAŞLIKLARI VE 5. SABİT AYLIK SİRKÜLASYON YÖNETİMİ PANELİ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* KATEGORİ BAŞLIK VE TANIMLARI YÖNETİMİ */}
        <div id="category-manager-container" className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-500" />
              Gelir &amp; Gider Başlıklarını Düzenle
            </h4>
            <button 
              type="button" 
              onClick={() => setShowCategoryPanel(!showCategoryPanel)}
              className="text-xs text-slate-500 hover:text-amber-500 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {showCategoryPanel ? 'Kapat' : 'Göster & Düzenle'}
            </button>
          </div>

          {showCategoryPanel && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className="bg-slate-50/50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">Bu sayfadan yeni fatura, hakediş veya masraf kalemi başlığı tanımlayabilirsiniz.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="Başlık adı (Örn: Çimento Faturası)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 focus:outline-none focus:border-amber-500 text-slate-800 dark:text-slate-200"
                  />
                  <select 
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as any)}
                    className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                  >
                    <option value="expense">Gider Kalemi</option>
                    <option value="income">Gelir Kalemi</option>
                  </select>
                  <button 
                    type="button"
                    onClick={handleAddCategory}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  >
                    Ekle
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] block">Gider Başlıkları ({expenseCategories.length})</span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {expenseCategories.map(cat => (
                      <div key={cat} className="flex justify-between items-center p-2 rounded-lg bg-red-50/40 dark:bg-rose-950/20 border border-red-100/50 dark:border-rose-900/10">
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">{cat}</span>
                        <button 
                          onClick={() => handleDeleteCategory(cat, 'expense')}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer p-0.5"
                          title="Sil"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-slate-500 uppercase tracking-wide text-[10px] block">Gelir Başlıkları ({incomeCategories.length})</span>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {incomeCategories.map(cat => (
                      <div key={cat} className="flex justify-between items-center p-2 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/10">
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[150px]">{cat}</span>
                        <button 
                          onClick={() => handleDeleteCategory(cat, 'income')}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer p-0.5"
                          title="Sil"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {!showCategoryPanel && (
            <p className="text-xs text-slate-500 leading-relaxed italic">Buradan muhasebe defterinde kullanılan finansal kategorileri özgürce ekleyebilir, silebilir ve özel kalemler üretebilirsiniz.</p>
          )}
        </div>

        {/* RECURRING MONTHLY TRANSACTIONS */}
        <div id="recurring-manager-container" className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-3">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Aylık Sabit Gelir &amp; Gider Şablonları
            </h4>
            <button 
              type="button" 
              onClick={() => setShowRecurringPanel(!showRecurringPanel)}
              className="text-xs text-slate-500 hover:text-emerald-500 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {showRecurringPanel ? 'Kapat' : 'Yönet & Deftere İşle'}
            </button>
          </div>

          {showRecurringPanel && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-4"
            >
              <div className="bg-slate-50/50 dark:bg-slate-950 p-3 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3 text-xs">
                <span className="font-bold text-[10px] block text-slate-500 uppercase">Yeni Düzenli Ödeme / Gelir Şablonu</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input 
                    type="text" 
                    placeholder="Gider / Abone Adı (Örn: Ofis Kirası)"
                    value={recTitle}
                    onChange={(e) => setRecTitle(e.target.value)}
                    className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 focus:outline-none dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                  <div className="flex gap-1.5">
                    <input 
                      type="number" 
                      placeholder="Tutar"
                      value={recAmount}
                      onChange={(e) => setRecAmount(e.target.value)}
                      className="w-1/2 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 focus:outline-none font-mono dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    />
                    <select 
                      value={recType}
                      onChange={(e) => {
                        setRecType(e.target.value as any);
                        setRecCategory(e.target.value === 'income' ? incomeCategories[0] : expenseCategories[0]);
                      }}
                      className="w-1/2 text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      <option value="expense">Gider (-)</option>
                      <option value="income">Gelir (+)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Vade Günü</label>
                    <select 
                      value={recDay}
                      onChange={(e) => setRecDay(Number(e.target.value))}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>Ayın {d}. Günü</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Kategori</label>
                    <select 
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      {recType === 'income' ? (
                        incomeCategories.map(c => <option key={c} value={c}>{c}</option>)
                      ) : (
                        expenseCategories.map(c => <option key={c} value={c}>{c}</option>)
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Kanal</label>
                    <select 
                      value={recPayMethod}
                      onChange={(e) => setRecPayMethod(e.target.value)}
                      className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 cursor-pointer text-slate-800 dark:text-slate-200"
                    >
                      <option value="bank_transfer">Banka Havalesi</option>
                      <option value="card">Kredi Kartı</option>
                      <option value="cash">Nakit / Elden</option>
                      <option value="debt">Açık Hesap</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleAddRecurring}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Sabit Şablon Kaydet
                </button>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {recurringTransactions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 italic">Tanımlı sabit gelir-gider şablonu bulunmamaktadır.</p>
                ) : (
                  recurringTransactions.map(item => (
                    <div key={item.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-xs gap-3">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${item.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <h5 className="font-bold text-slate-800 dark:text-slate-200">{item.title}</h5>
                          <span className="text-[10px] text-slate-400 font-semibold">({item.category})</span>
                        </div>
                        <p className="text-[10px] text-slate-550 pt-0.5">
                          Tutar: <span className="font-mono font-bold text-slate-700 dark:text-slate-350">{formatMoney(item.amount, activeSettings)}</span> • Her Ayın {item.dayOfMonth}. Günü
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button 
                          onClick={() => handleLaunchRecurringTransaction(item)}
                          className="bg-slate-900 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer flex items-center gap-0.5"
                          title="Cari muhasebe defterine bir kayıt işle"
                        >
                          <Plus className="w-3 h-3" /> Deftere İşle
                        </button>
                        <button 
                          onClick={() => handleDeleteRecurring(item.id)}
                          className="p-1 px-2 border border-slate-200 dark:border-slate-800 hover:bg-red-50 text-red-500 rounded-lg text-[10px] cursor-pointer"
                          title="Şablonu Kaldır"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {!showRecurringPanel && (
            <p className="text-xs text-slate-500 leading-relaxed italic">Abonelikler, faturalar veya düzenli kontrat kazançları gibi sabit sirkülasyonları şablon olarak kurup, tek tıkla cari işlem tablonuza işleyebilirsiniz.</p>
          )}
        </div>
      </div>

      {/* Transaction log ledger table & ledger adder */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
        
        {/* Ledger Header with fast action buttons */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-500" /> Finansal Defter Kayıtları
          </h3>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button 
              id="acc-add-income-btn"
              onClick={() => handleOpenAdd('income')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300 text-emerald-800 border border-emerald-200 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Bütçe Ekle
            </button>
            <button 
              id="acc-add-expense-btn"
              onClick={() => handleOpenAdd('expense')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-red-50 hover:bg-red-100 hover:border-red-300 text-red-800 border border-red-200 font-bold px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Gider Ekle
            </button>
          </div>
        </div>

        {/* Ledger table filters */}
        <div className="bg-slate-50/50 p-4 border-b border-slate-105 border-slate-100 flex flex-wrap gap-4 text-xs">
          {/* Record Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">İşlem Tipi:</span>
            <select
              value={typeFilter}
              id="accounting-filter-type"
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-650 cursor-pointer"
            >
              <option value="all">Sermaye &amp; Gider Tümü</option>
              <option value="income">Sadece Fon Bütçe Girişi (Gelir)</option>
              <option value="expense">Sadece Harcama / Maliyet (Gider)</option>
            </select>
          </div>

          {/* Ledger Category lists */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Kategori:</span>
            <select
              value={categoryFilter}
              id="accounting-filter-category"
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-650 cursor-pointer"
            >
              <option value="all">Tüm Kategoriler</option>
              {Array.from(new Set([...incomeCategories, ...expenseCategories])).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Responsive Ledger Data Table */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs italic space-y-2">
              <DollarSign className="w-10 h-10 stroke-[1.5] mx-auto text-slate-300" />
              <p>Eşleşen herhangi bir muhasebe işlemi bulunamadı.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4">Proje</th>
                  <th className="py-3 px-4">Açıklama / Başlık</th>
                  <th className="py-3 px-4">Kategori</th>
                  <th className="py-3 px-4">Ödeme Yöntemi</th>
                  <th className="py-3 px-4 text-right">Tutar</th>
                  <th className="py-3 px-4 text-center">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTransactions.map((t) => {
                  const correlatedProj = projects.find(p => p.id === t.projectId)?.name || 
                    (t.projectId === 'global' ? (isEn ? 'General Overhead / Independent' : 'Genel Gider / Bağımsız') : (isEn ? 'Unknown Project' : 'Bilinmeyen Proje'));

                  // Helper for payment method labels
                  const getPaymentMethodLabel = (methodKey: string) => {
                    if (isEn) {
                      switch(methodKey) {
                        case 'cash': return 'Cash';
                        case 'card': return 'Credit/Debit Card';
                        case 'bank_transfer': return 'Bank Wire / EFT';
                        case 'debt': return 'Deferred / On Credit';
                        default: return methodKey;
                      }
                    } else {
                      switch(methodKey) {
                        case 'cash': return 'Elden / Nakit';
                        case 'card': return 'Kredi Kartı';
                        case 'bank_transfer': return 'Banka Havalesi / EFT';
                        case 'debt': return 'Açık Hesap / Veresiye';
                        default: return methodKey;
                      }
                    }
                  };

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap font-mono">
                        {formatDate(t.date, activeSettings.lang)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-350 max-w-[150px] truncate" title={correlatedProj}>
                        {correlatedProj}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block md:text-sm">{t.title}</span>
                          {t.notes && <span className="text-slate-400 dark:text-slate-500 block text-[10px] italic">{t.notes}</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-550 dark:text-slate-400">
                        {t.category}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-350 font-medium">
                        {getPaymentMethodLabel(t.paymentMethod)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className={`font-bold font-mono text-sm inline-flex items-center gap-0.5 ${
                          t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-650 text-red-600'
                        }`}>
                          {t.type === 'income' ? '+' : '-'} {formatMoney(t.amount, activeSettings)}
                          {t.type === 'income' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button 
                            id={`acc-ledger-edit-btn-${t.id}`}
                            onClick={() => handleOpenEdit(t)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
                            title="İşlemi Düzenle"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            id={`acc-ledger-delete-btn-${t.id}`}
                            onClick={() => {
                              setDeleteConfirmInfo({
                                isOpen: true,
                                id: t.id,
                                title: t.title
                              });
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="İşlemi Sil"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* TRANSACTION ACCOUNTING MODAL (Add / Edit) */}
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
                  {editingTransaction ? 'İşlemi Düzenle' : (formType === 'income' ? 'Bütçe Girişi Yap' : 'Yeni Gider Girişi')}
                </h3>
                <p className="text-xs text-slate-400">Kasaya nakit katkısı veya şantiye masrafları hakediş girdileri</p>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">İlgili Proje Kapsamı</label>
                    <select
                      id="acc-modal-input-proj"
                      required
                      value={formProjId}
                      onChange={(e) => setFormProjId(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                    >
                      <option value="global">Eşlenmemiş / Genel</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Ödeme Türü / Tip</label>
                    <select
                      id="acc-modal-input-type"
                      required
                      value={formType}
                      onChange={(e) => {
                        const newType = e.target.value as TransactionType;
                        setFormType(newType);
                        setFormCategory(newType === 'income' ? 'Bütçe Girişi' : 'Usta İşçilik & Hizmet');
                      }}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                    >
                      <option value="expense">Nakit Çıkışı / Gider</option>
                      <option value="income">Sermaye / Bütçe Aktarımı</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Ödeme/Gider Başlığı</label>
                  <input 
                    type="text" 
                    required
                    id="acc-modal-input-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={formType === 'income' ? 'Kişisel tasarruf birikimi aktarımı' : 'Salih Usta seramik kırma hakedişi'}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Kategori</label>
                    {formType === 'income' ? (
                      <select
                        id="acc-modal-input-cat-income"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                      >
                        {incomeCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <select
                        id="acc-modal-input-cat-expense"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                      >
                        {expenseCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Ödeme Kanalı</label>
                    <select
                      id="acc-modal-input-paymethod"
                      value={formPayMethod}
                      onChange={(e) => setFormPayMethod(e.target.value as any)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 tracking-wide block bg-slate-50/50 cursor-pointer"
                    >
                      {PAYMENT_METHODS.map((p) => (
                        <option key={p.key} value={p.key}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? `Amount (${activeSettings.currency})` : `Tutar (${activeSettings.currency === 'TRY' ? '₺' : activeSettings.currency})`}
                    </label>
                    <input 
                      type="number" 
                      required
                      min={1}
                      id="acc-modal-input-amount"
                      value={formAmount}
                      onChange={(e) => setFormAmount(Number(e.target.value))}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">İşlem Tarihi</label>
                    <input 
                      type="date" 
                      required
                      id="acc-modal-input-date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 bg-slate-50/30"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Not / Detaylar</label>
                  <input 
                    type="text" 
                    id="acc-modal-input-notes"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Fatura No, usta telefon veya teslimat notu..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                  />
                </div>

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
                    id="acc-modal-submit-btn"
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-850 shadow-md transition-colors cursor-pointer"
                  >
                    {editingTransaction ? 'Güncelle' : 'Kaydet'}
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
                  <h3 className="text-base font-bold text-slate-900 font-sans">Kaydı Sil</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    "{deleteConfirmInfo.title}" adlı muhasebe kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
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
                  id="confirm-delete-transaction-btn"
                  onClick={() => {
                    onDeleteTransaction(deleteConfirmInfo.id);
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
