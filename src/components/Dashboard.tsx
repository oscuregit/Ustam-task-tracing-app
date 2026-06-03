import { useMemo } from 'react';
import { Project, Task, Material, Transaction, AppSettings } from '../types';
import { formatMoney, formatDate, translateCategory } from '../utils';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardProps {
  projects: Project[];
  tasks: Task[];
  materials: Material[];
  transactions: Transaction[];
  onNavigate: (tab: string, arg?: string) => void;
  settings?: AppSettings;
}

export default function Dashboard({ 
  projects, 
  tasks, 
  materials, 
  transactions, 
  onNavigate,
  settings
}: DashboardProps) {

  // Default fallback settings
  const activeSettings: AppSettings = settings || {
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

  const t = (en: string, tr: string, pl: string) => {
    if (activeSettings.lang === 'tr') return tr;
    if (activeSettings.lang === 'pl') return pl;
    return en;
  };

  // Calculate high-level financial stats
  const stats = useMemo(() => {
    // Total funding received (incomes)
    const totalReceived = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    // Total actual expenses paid or recorded
    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    // Sum of unpaid materials (planned / purchased but unpaid)
    const totalUnpaidMaterials = materials
      .filter((m) => !m.isPaid && m.status !== 'planned')
      .reduce((sum, m) => sum + m.totalPrice, 0);

    // Sum of planned material budget (not yet purcahsed or paid)
    const totalPlannedMaterials = materials
      .filter((m) => m.status === 'planned')
      .reduce((sum, m) => sum + m.totalPrice, 0);

    // Total allocated project budgets
    const totalAllocatedBudget = projects.reduce((sum, p) => sum + p.allocatedBudget, 0);

    // Current Cash Balance (Funds received - actually paid out from transactions)
    const cashBalance = totalReceived - totalExpenses;

    return {
      totalReceived,
      totalExpenses,
      totalUnpaidMaterials,
      totalPlannedMaterials,
      totalAllocatedBudget,
      cashBalance,
    };
  }, [projects, materials, transactions]);

  // Projects completion rate
  const projectStats = useMemo(() => {
    const total = projects.length;
    if (total === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = projects.filter((p) => p.status === 'completed').length;
    const ongoing = projects.filter((p) => p.status === 'ongoing').length;
    const planning = projects.filter((p) => p.status === 'planning').length;
    return {
      total,
      completed,
      ongoing,
      planning,
      percentage: Math.round((completed / total) * 100),
    };
  }, [projects]);

  // Tasks status check
  const taskStats = useMemo(() => {
    const total = tasks.length;
    if (total === 0) return { total: 0, done: 0, percentage: 0 };
    const done = tasks.filter((t) => t.status === 'done').length;
    return {
      total,
      done,
      percentage: Math.round((done / total) * 100),
    };
  }, [tasks]);

  // Urgent and high priority tasks
  const dangerousTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high'))
      .slice(0, 4);
  }, [tasks]);

  // Upcoming projects (closest deadlines)
  const upcomingDeadlines = useMemo(() => {
    return projects
      .filter((p) => p.status !== 'completed')
      .sort((a, b) => new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime())
      .slice(0, 3);
  }, [projects]);

  // Spending per category for SVG Chart
  const categorySpending = useMemo(() => {
    const spending: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        spending[t.category] = (spending[t.category] || 0) + t.amount;
      });

    const items = Object.entries(spending).map(([name, value]) => ({ name, value }));
    const total = items.reduce((sum, item) => sum + item.value, 0);

    return {
      items: items.sort((a, b) => b.value - a.value),
      total,
    };
  }, [transactions]);

  // Color generator for category tags
  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      'Kaba İnşaat': '#f59e0b', // Amber
      'Tesisat (Elektrik/Su)': '#3b82f6', // Blue
      'Zemin & Seramik': '#8b5cf6', // Purple
      'Boya & Badana': '#10b981', // Emerald
      'Aydınlatma & Elektrik': '#eab308', // Yellow
      'Mobilya & Dolap': '#ec4899', // Pink
      'Hizmet & İşçilik': '#f43f5e', // Rose
      'Diğer': '#6b7280', // Gray
    };
    return colors[cat] || '#06b6d4'; // Cyan default
  };

  return (
    <div className="space-y-8">
      {/* Upper banner section */}
      {activeSettings.showWelcomeBanner && (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl p-6 md:p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="space-y-2">
            <span className="bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full">
              {t('Renovation & Dashboard Portal', 'Tadilat & Kontrol Paneli', 'Portal Remontowy i Pulpit')}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {t('Are Your Renovation Tasks On-Track?', 'Tadilat İşleriniz Yolunda Mı?', 'Czy Twoje Zadania Remontowe Są na Czas?')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-xl font-normal">
              {t(
                'Track active construction operations, preserve material budgets, and log transactions simultaneously.',
                'Aynı anda yürütülen projeleri takip edin, malzeme bütçesini kontrol altında tutun ve ödemelerinizi kaydedin.',
                'Śledź aktywne operacje budowlane, kontroluj budżet materiałów i rejestruj transakcje jednocześnie.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 mt-6 md:mt-0">
            <button 
              id="dashboard-new-proj-btn"
              onClick={() => onNavigate('projects')}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white font-semibold px-4 py-2.5 rounded-lg text-sm cursor-pointer shadow-xs"
            >
              <Building2 className="w-4 h-4" /> {t('Manage Projects', 'Projeleri Yönet', 'Zarządzaj Projektami')}
            </button>
            <button 
              id="dashboard-new-trans-btn"
              onClick={() => onNavigate('accounting')}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-4 py-2.5 rounded-lg text-sm cursor-pointer"
            >
              <DollarSign className="w-4 h-4 text-slate-500" /> {t('Ledger Book', 'Muhasebe Defteri', 'Księga Główna')}
            </button>
          </div>
        </div>
      )}

      {/* Financial stats summary blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t('Total Allocated Budget', 'Toplam Atanan Bütçe', 'Całkowity Budżet')}
            </span>
            <span className="p-2 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 rounded-xl">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {formatMoney(stats.totalAllocatedBudget, activeSettings)}
            </h3>
            <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
              {projectStats.total} {t('active projects', 'aktif tadilat projesi', 'aktywne projekty')}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t('Total Seed Funds', 'Kasadaki Finansman', 'Całkowity Kapitał')}
            </span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(stats.totalReceived, activeSettings)}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 flex flex-wrap items-center gap-1">
              {t('Cash Net Balance: ', 'Kalan Net Nakit: ', 'Saldo Gotówkowe Netto: ')} 
              <strong className="font-semibold text-slate-800 dark:text-slate-200">
                {formatMoney(stats.cashBalance, activeSettings)}
              </strong>
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t('Actual Expenditures', 'Yapılan Harcamalar', 'Rzeczywiste Wydatki')}
            </span>
            <span className="p-2 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-300 rounded-xl">
              <TrendingDown className="w-4 h-4 animate-bounce-slow" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatMoney(stats.totalExpenses, activeSettings)}
            </h3>
            <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
              {t(
                `Spent ${stats.totalAllocatedBudget > 0 ? Math.round((stats.totalExpenses / stats.totalAllocatedBudget) * 100) : 0}% of budget`,
                `Bütçe harcama oranı: %${stats.totalAllocatedBudget > 0 ? Math.round((stats.totalExpenses / stats.totalAllocatedBudget) * 100) : 0}`,
                `Wydano ${stats.totalAllocatedBudget > 0 ? Math.round((stats.totalExpenses / stats.totalAllocatedBudget) * 100) : 0}% budżetu`
              )}
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
        >
          <div className="flex justify-between items-start">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t('Outstanding Supplier Debt', 'Kalan Malzeme Borçları', 'Zaległe Zadłużenie u Dostawców')}
            </span>
            <span className="p-2 bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {formatMoney(stats.totalUnpaidMaterials, activeSettings)}
            </h3>
            <p className="text-slate-450 dark:text-slate-500 text-xs mt-1">
              {t('Purchased but unpaid invoices', 'Alınan ancak ödenmemiş faturalar', 'Zakupione, ale nieopłacone faktury')}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core Project Timeline Deadlines and Priority Tasks list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Upcoming Project Goals / Deadlines */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  {t('Renovation Deadlines & Target Goals', 'Son Teslim Tarihi Yaklaşan Projeler', 'Terminy Remontów i Cele')}
                </h2>
              </div>
              <button 
                onClick={() => onNavigate('projects')} 
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
              >
                {t('View All', 'Hepsini Gör', 'Zobacz Wszystko')} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {projects.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-sm py-4">
                {t('No active renovation projects registered yet.', 'Kayıtlı aktif bir proje bulunmamaktadır.', 'Brak aktywnych projektów remontowych.')}
              </p>
            ) : (
              <div className="space-y-4">
                {upcomingDeadlines.map((p) => {
                  const now = new Date();
                  const target = new Date(p.targetDate);
                  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                  // Calculate project cost within budget
                  const projExpenses = transactions
                    .filter((t) => t.projectId === p.id && t.type === 'expense')
                    .reduce((sum, t) => sum + t.amount, 0);
                  const progressPercentage = p.allocatedBudget > 0 ? Math.round((projExpenses / p.allocatedBudget) * 100) : 0;

                  return (
                    <div key={p.id} className="p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-colors flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm md:text-base">{p.name}</h4>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'ongoing' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {p.status === 'ongoing' ? t('Ongoing', 'Devam Ediyor', 'W toku') : t('Planning', 'Planlanıyor', 'Planowane')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {formatDate(p.targetDate, activeSettings)}
                          </span>
                          <span className={`${daysLeft < 0 ? 'text-red-500 font-bold' : daysLeft <= 10 ? 'text-rose-650 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                            {daysLeft < 0 
                              ? t('Delayed!', 'Gecikti!', 'Opóźnione!') 
                              : daysLeft === 0 
                                ? t('Due today!', 'Bugün son gün!', 'Na dzisiaj!') 
                                : t(`${daysLeft} days remaining`, `${daysLeft} gün kaldı`, `Pozostało dni: ${daysLeft}`)}
                          </span>
                        </div>
                      </div>

                      <div className="w-full md:w-48 space-y-1">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>{t('Budget Consumption State', 'Bütçe Harcama Oranı', 'Stan Zużycia Budżetu')}</span>
                          <span className="font-semibold text-slate-705 dark:text-slate-300">{progressPercentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${progressPercentage > activeSettings.budgetWarningThreshold ? 'bg-red-500' : 'bg-blue-600'}`}
                            style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Urgent & High Priority Tasks list */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-slate-800">
                  {t('Priority Tasks to Do', 'Öncelikli Yapılacak Görevler', 'Zadania Priorytetowe do Wykonania')}
                </h2>
              </div>
              <button 
                onClick={() => onNavigate('projects')} 
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                {t('View All Tasks', 'Tüm Görevleri Gör', 'Zobacz Wszystkie Zadania')} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {dangerousTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                <p className="text-sm">
                  {t('There are no high-priority urgent tasks!', 'Yüksek öncelikli acil bir görev bulunmamaktadır!', 'Brak pilnych zadań o wysokim priorytecie!')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dangerousTasks.map((tItem) => {
                  const projName = projects.find((p) => p.id === tItem.projectId)?.name || t('Unknown Project', 'Bilinmeyen Proje', 'Nieznany Projekt');
                  return (
                    <div 
                      key={tItem.id} 
                      className={`p-4 rounded-xl border border-slate-100 bg-slate-50 relative overflow-hidden transition-all hover:shadow-xs`}
                    >
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${tItem.priority === 'urgent' ? 'bg-red-500' : 'bg-slate-400'}`} />
                      
                      <div className="pl-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] text-slate-440 font-medium tracking-wide uppercase block truncate max-w-[150px]">
                            {projName}
                          </span>
                          <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full font-bold ${
                            tItem.priority === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {tItem.priority === 'urgent' ? t('URGENT', 'ACİL', 'PILNE') : t('HIGH', 'YÜKSEK', 'WYSOKI')}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{tItem.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                          {tItem.description || t('No description provided', 'Detay girilmemiş', 'Brak szczegółowego opisu')}
                        </p>
                        
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/55">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {formatDate(tItem.dueDate, activeSettings)}
                          </span>
                          <span className="font-medium text-slate-650 truncate max-w-[100px]" title={tItem.assignedTo}>
                            {tItem.assignedTo || t('Artisan Not Specified', 'Belirtilmemiş', 'Fachowiec nieokreślony')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Financial custom SVG visualizer / side panel */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {t('Expenditure Distribution', 'Giderlerin Dağılımı', 'Rozkład Wydatków')}
            </h2>
            <p className="text-xs text-slate-400 dark:text-slate-400 mb-6 font-medium">
              {t('Cash spent sorted by construction categories', 'Kategorilere göre harcanan nakit bütçe', 'Wydatki gotówkowe według kategorii budowlanych')}
            </p>

            {categorySpending.total === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-450 gap-2">
                <DollarSign className="w-10 h-10 stroke-[1.5] text-slate-350" />
                <p className="text-xs text-center text-slate-400">
                  {t('No actual expense entries recorded yet.', 'Henüz herhangi bir gider işlemi girilmemiştir.', 'Nie zarejestrowano jeszcze żadnych wydatków.')}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Clean Custom Responsive SVG Stacked Bar Charts */}
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-slate-650 bg-slate-100 dark:bg-slate-800 dark:text-slate-300">
                        {t('Total Outflow', 'Harcama Toplamı', 'Całkowity Odpływ')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-slate-650 dark:text-slate-300">
                        {formatMoney(categorySpending.total, activeSettings)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Colorful Multi-Segment horizontal bar */}
                  <div className="overflow-hidden h-4 text-xs flex rounded-xl bg-slate-100 dark:bg-slate-800">
                    {categorySpending.items.map((catValue, idx) => {
                      const share = (catValue.value / categorySpending.total) * 100;
                      return (
                        <div
                          key={catValue.name}
                          style={{ 
                            width: `${share}%`, 
                            backgroundColor: getCategoryColor(catValue.name) 
                          }}
                          title={`${translateCategory(catValue.name, activeSettings.lang)}: ${Math.round(share)}%`}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all first:rounded-l-lg last:rounded-r-lg"
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Legend list with actual amounts */}
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {categorySpending.items.slice(0, 5).map((cat) => {
                    const share = Math.round((cat.value / categorySpending.total) * 100);
                    return (
                      <div key={cat.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getCategoryColor(cat.name) }}
                          />
                          <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[140px]">
                            {translateCategory(cat.name, activeSettings.lang)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                          <span className="font-semibold">{formatMoney(cat.value, activeSettings)}</span>
                          <span className="text-slate-400 font-normal">({share}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  {categorySpending.items.length > 5 && (
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 text-center italic mt-2">
                      {t(
                        `and ${categorySpending.items.length - 5} more categories...`,
                        `ve ${categorySpending.items.length - 5} kategori daha...`,
                        `oraz ${categorySpending.items.length - 5} więcej kategorii...`
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats - Work progress */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('Work Progress Summary', 'İş İlerleme Özeti', 'Podsumowanie Postępu Prac')}</h2>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  <span>{t('Projects', 'Projeler', 'Projekty')} ({projectStats.completed}/{projectStats.total})</span>
                  <span>{projectStats.percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 rounded-full" 
                    style={{ width: `${projectStats.percentage}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  <span>{t('Tasks', 'Görevler', 'Zadania')} ({taskStats.done}/{taskStats.total})</span>
                  <span>{taskStats.percentage}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-slate-850 rounded-full" 
                    style={{ width: `${taskStats.percentage}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">{t('Completed', 'Biten', 'Zakończone')}</span>
                <span className="text-base font-bold text-slate-700 dark:text-slate-300">{projectStats.completed}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">{t('Ongoing', 'Aktif', 'W toku')}</span>
                <span className="text-base font-bold text-blue-600">{projectStats.ongoing}</span>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl">
                <span className="text-slate-400 text-[10px] block font-semibold uppercase tracking-wider">{t('Planning', 'Plan', 'Planowane')}</span>
                <span className="text-base font-bold text-slate-600 dark:text-slate-400">{projectStats.planning}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
