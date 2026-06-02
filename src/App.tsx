import { useState, useEffect, useMemo } from 'react';
import { 
  Project, 
  Task, 
  Material, 
  Transaction,
  MaterialStatus,
  AppSettings
} from './types';
import { 
  INITIAL_PROJECTS, 
  INITIAL_TASKS, 
  INITIAL_MATERIALS, 
  INITIAL_TRANSACTIONS 
} from './initialData';
import { 
  LayoutDashboard, 
  Building2, 
  FileText, 
  ShoppingBag, 
  Calculator,
  User,
  LogOut,
  Sparkles,
  Layers,
  CheckCircle2,
  Calendar,
  AlertOctagon,
  Settings as SettingsIcon
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import ProjectsView from './components/ProjectsView';
import BudgetView from './components/BudgetView';
import AccountingView from './components/AccountingView';
import SettingsView from './components/SettingsView';
import LoginView from './components/LoginView';
import { getTranslatedLabel } from './utils';
import { motion, AnimatePresence } from 'motion/react';

// Firebase imports
import { 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export default function App() {
  // --- REAL-TIME DATABASE STATES ---
  const [user, setUser] = useState<any | null>(null);
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [settings, setSettings] = useState<AppSettings>({
    lang: 'tr',
    currency: 'TRY',
    theme: 'light',
    timezone: 'Europe/Istanbul',
    defaultVatRate: 20,
    budgetWarningThreshold: 90,
    autoSyncMaterialToLedger: true,
    decimalPlaces: 0,
    showWelcomeBanner: true
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [deepSelectProjectId, setDeepSelectProjectId] = useState<string | undefined>(undefined);

  // Seeding default sandbox projects data on brand new accounts
  const seedDefaultData = async (uid: string) => {
    try {
      for (const p of INITIAL_PROJECTS) {
        await setDoc(doc(db, 'projects', p.id), { ...p, userId: uid });
      }
      for (const t of INITIAL_TASKS) {
        await setDoc(doc(db, 'tasks', t.id), { ...t, userId: uid });
      }
      for (const m of INITIAL_MATERIALS) {
        await setDoc(doc(db, 'materials', m.id), { ...m, userId: uid });
      }
      for (const tr of INITIAL_TRANSACTIONS) {
        await setDoc(doc(db, 'transactions', tr.id), { ...tr, userId: uid });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'seeding_initial_data');
    }
  };

  // Firebase Authentication State Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setProjects([]);
        setTasks([]);
        setMaterials([]);
        setTransactions([]);
        setAuthLoading(false);
      } else {
        setUser(firebaseUser);
        
        try {
          // Load or instantiate UserProfile in Firestore
          const profileRef = doc(db, 'users', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);
          
          let profile;
          if (profileSnap.exists()) {
            profile = profileSnap.data();
          } else {
            // Instantiate default profile structures
            profile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Seçkin Kullanıcı',
              email: firebaseUser.email || '',
              role: 'Yol Gösteren Usta',
              company: 'Bireysel Şantiyeler ve Proje',
              avatarUrl: firebaseUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
              expenseCategories: [
                'Kaba İnşaat',
                'Tesisat & Altyapı',
                'Usta İşçilik & Hizmet',
                'Taşıma & Nakliye & Moloz',
                'Aydınlatma & Aksesuar',
                'Mobilya & Dolap Kapakları',
                'Ruhsat & Belediye & Harç',
                'Diğer Giderler'
              ],
              incomeCategories: [
                'Bütçe Aktarımı',
                'Banka Kredisi',
                'Ortak Sermaye',
                'Yedek Akçe',
                'Müşteri Hak Edişi',
                'Diğer Gelirler'
              ],
              settings: {
                lang: 'tr',
                currency: 'TRY',
                theme: 'light',
                timezone: 'Europe/Istanbul',
                defaultVatRate: 20,
                budgetWarningThreshold: 90,
                autoSyncMaterialToLedger: true,
                decimalPlaces: 0,
                showWelcomeBanner: true
              }
            };
            await setDoc(profileRef, profile);
          }
          
          setUserProfile(profile);
          if (profile.settings) {
            setSettings(profile.settings);
            if (profile.settings.theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          }
        } catch (error) {
          console.error("Error loading profile: ", error);
        } finally {
          setAuthLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Real-time Firestore document streams subscriptions
  useEffect(() => {
    if (!user) return;

    const uid = user.uid;

    const qProjects = query(collection(db, 'projects'), where('userId', '==', uid));
    const unsubscribeProjects = onSnapshot(qProjects, (snapshot) => {
      const items: Project[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Project);
      });
      setProjects(items);
      
      // Auto seed initial backup projects to empty databases
      if (snapshot.empty && snapshot.metadata.fromCache === false) {
        seedDefaultData(uid);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'projects');
    });

    const qTasks = query(collection(db, 'tasks'), where('userId', '==', uid));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      const items: Task[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Task);
      });
      setTasks(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tasks');
    });

    const qMaterials = query(collection(db, 'materials'), where('userId', '==', uid));
    const unsubscribeMaterials = onSnapshot(qMaterials, (snapshot) => {
      const items: Material[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Material);
      });
      setMaterials(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'materials');
    });

    const qTransactions = query(collection(db, 'transactions'), where('userId', '==', uid));
    const unsubscribeTransactions = onSnapshot(qTransactions, (snapshot) => {
      const items: Transaction[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as Transaction);
      });
      setTransactions(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => {
      unsubscribeProjects();
      unsubscribeTasks();
      unsubscribeMaterials();
      unsubscribeTransactions();
    };
  }, [user]);

  // Sync settings actions back to User Profiles
  const saveSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (newSettings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    if (user && userProfile) {
      try {
        const profileRef = doc(db, 'users', user.uid);
        await setDoc(profileRef, {
          ...userProfile,
          settings: newSettings
        });
        setUserProfile(prev => ({ ...prev, settings: newSettings }));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      }
    }
  };

  const handleResetAllData = async () => {
    if (!user) return;
    try {
      for (const p of projects) {
        await deleteDoc(doc(db, 'projects', p.id));
      }
      for (const t of tasks) {
        await deleteDoc(doc(db, 'tasks', t.id));
      }
      for (const m of materials) {
        await deleteDoc(doc(db, 'materials', m.id));
      }
      for (const tr of transactions) {
        await deleteDoc(doc(db, 'transactions', tr.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'reset_all_data');
    }
  };

  // --- CLOUD PROJECT ACTIONS ---
  const handleAddProject = async (p: Omit<Project, 'id'>) => {
    if (!user) return;
    const nextId = `proj-${Date.now()}`;
    const newProject: Project = { ...p, id: nextId };
    try {
      await setDoc(doc(db, 'projects', nextId), { ...newProject, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${nextId}`);
    }
  };

  const handleUpdateProject = async (p: Project) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'projects', p.id), { ...p, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${p.id}`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      
      // Cascade delete tasks, materials, transactions
      const tasksToDelete = tasks.filter((t) => t.projectId === projectId);
      for (const t of tasksToDelete) {
        await deleteDoc(doc(db, 'tasks', t.id));
      }
      
      const matsToDelete = materials.filter((m) => m.projectId === projectId);
      for (const m of matsToDelete) {
        await deleteDoc(doc(db, 'materials', m.id));
      }
      
      const transToDelete = transactions.filter((tr) => tr.projectId === projectId);
      for (const tr of transToDelete) {
        await deleteDoc(doc(db, 'transactions', tr.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  // --- CLOUD TASK ACTIONS ---
  const handleAddTask = async (t: Omit<Task, 'id'>) => {
    if (!user) return;
    const nextId = `task-${Date.now()}`;
    const newTask: Task = { ...t, id: nextId };
    try {
      await setDoc(doc(db, 'tasks', nextId), { ...newTask, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `tasks/${nextId}`);
    }
  };

  const handleUpdateTask = async (t: Task) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'tasks', t.id), { ...t, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${t.id}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  // --- CLOUD MATERIAL BUDGET ACTIONS ---
  const handleAddMaterial = async (m: Omit<Material, 'id'>) => {
    if (!user) return;
    const nextId = `mat-${Date.now()}`;
    const newMaterial: Material = { ...m, id: nextId };
    try {
      await setDoc(doc(db, 'materials', nextId), { ...newMaterial, userId: user.uid });

      // Automatic Transaction integration
      if (settings.autoSyncMaterialToLedger && m.status !== 'planned' && m.isPaid) {
        const autoTransId = `trans-auto-${Date.now()}`;
        const autoTransaction: Transaction = {
          id: autoTransId,
          projectId: m.projectId,
          title: `${m.title} Alımı (${m.quantity} ${m.unit})`,
          type: 'expense',
          category: m.category,
          amount: m.totalPrice,
          date: m.purchaseDate || new Date().toISOString().split('T')[0],
          paymentMethod: 'bank_transfer',
          notes: `Malzeme modülü üzerinden otomatik muhasebeleştirilen sipariş. Satıcı: ${m.vendor || 'Bilinmiyor'}`,
        };
        await setDoc(doc(db, 'transactions', autoTransId), { ...autoTransaction, userId: user.uid });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `materials/${nextId}`);
    }
  };

  const handleUpdateMaterial = async (m: Material) => {
    if (!user) return;
    const origMaterial = materials.find((orig) => orig.id === m.id);
    try {
      await setDoc(doc(db, 'materials', m.id), { ...m, userId: user.uid });

      // Sync accounting logic
      if (
        settings.autoSyncMaterialToLedger &&
        origMaterial &&
        m.status !== 'planned' &&
        m.isPaid &&
        (!origMaterial.isPaid || origMaterial.status === 'planned')
      ) {
        const autoTransId = `trans-auto-${Date.now()}`;
        const autoTransaction: Transaction = {
          id: autoTransId,
          projectId: m.projectId,
          title: `${m.title} Alımı (${m.quantity} ${m.unit})`,
          type: 'expense',
          category: m.category,
          amount: m.totalPrice,
          date: m.purchaseDate || new Date().toISOString().split('T')[0],
          paymentMethod: 'bank_transfer',
          notes: `Ödeme durumu güncellendiğinde otomatik eklenen masraf. Satıcı: ${m.vendor || 'Bilinmiyor'}`,
        };
        await setDoc(doc(db, 'transactions', autoTransId), { ...autoTransaction, userId: user.uid });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `materials/${m.id}`);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'materials', materialId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `materials/${materialId}`);
    }
  };

  // --- CLOUD LEDGER TRANSACTION ACTIONS ---
  const handleAddTransaction = async (t: Omit<Transaction, 'id'>) => {
    if (!user) return;
    const nextId = `trans-${Date.now()}`;
    const newTransaction: Transaction = { ...t, id: nextId };
    try {
      await setDoc(doc(db, 'transactions', nextId), { ...newTransaction, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `transactions/${nextId}`);
    }
  };

  const handleUpdateTransaction = async (t: Transaction) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'transactions', t.id), { ...t, userId: user.uid });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `transactions/${t.id}`);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'transactions', transactionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${transactionId}`);
    }
  };

  // --- CLOUD IMPORT BACKUP RESTORE HANDLER ---
  const handleImportBackup = (backup: {
    projects?: any[];
    tasks?: any[];
    materials?: any[];
    transactions?: any[];
  }): boolean => {
    if (!user) return false;
    
    // Process backend injections asynchronously in the background
    const executeInjections = async () => {
      try {
        if (backup.projects) {
          for (const p of backup.projects) {
            await setDoc(doc(db, 'projects', p.id), { ...p, userId: user.uid });
          }
        }
        if (backup.tasks) {
          for (const t of backup.tasks) {
            await setDoc(doc(db, 'tasks', t.id), { ...t, userId: user.uid });
          }
        }
        if (backup.materials) {
          for (const m of backup.materials) {
            await setDoc(doc(db, 'materials', m.id), { ...m, userId: user.uid });
          }
        }
        if (backup.transactions) {
          for (const tr of backup.transactions) {
            await setDoc(doc(db, 'transactions', tr.id), { ...tr, userId: user.uid });
          }
        }
      } catch (error) {
        console.error("Backup restoration asynchronous injection failure: ", error);
      }
    };
    
    executeInjections();
    return true;
  };

  // Compile export data schema
  const allDataExportString = useMemo(() => {
    return JSON.stringify({
      projects,
      tasks,
      materials,
      transactions,
      exportedAt: new Date().toISOString(),
      version: '1.2'
    }, null, 2);
  }, [projects, tasks, materials, transactions]);

  // Navigate scope helper
  const handleDeepNavigate = (tab: string, pid?: string) => {
    setDeepSelectProjectId(pid);
    setActiveTab(tab);
  };

  // Loading Splash Screen
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-white font-sans transition-colors duration-200">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-sm font-semibold tracking-tight">Ustam Bulut Veritabanı Açılıyor...</div>
        </div>
      </div>
    );
  }

  // Route to Login View if not authenticated
  if (!user) {
    return <LoginView lang={settings.lang} />;
  }

  const activeUserName = userProfile?.name || user.displayName || user.email?.split('@')[0] || 'Kullanıcı';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] transition-colors duration-200 flex flex-col font-sans select-none antialiased">
      
      {/* GLOBAL BANNER HEADER */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          
          {/* Logo Name */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-xs flex items-center justify-center font-bold text-lg">
              🔨
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                Ustam <span className="text-[10px] bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2.0 py-0.5 rounded-full font-semibold">
                  {settings.lang === 'en' ? 'Renovation Hub' : 'Tadilat Portalı'}
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {settings.lang === 'en' ? 'Site operations, material budget and cash accounts' : 'Şantiye yönetimi, bütçe ve nakit muhasebesi'}
              </p>
            </div>
          </div>

          {/* Connected state summary bar */}
          <div className="flex items-center gap-5 text-slate-500 dark:text-slate-400 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>
                {settings.lang === 'en' ? 'Data Source: ' : 'Veri Kaynağı: '}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  {settings.lang === 'en' ? 'Cloud Firestore DB' : 'Bulut Veritabanı'}
                </strong>
              </span>
            </div>
            
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5" title={user.email || ''}>
                <User className="w-3.5 h-3.5 text-slate-450 dark:text-slate-400 font-bold" />
                <span className="font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                  {activeUserName}
                </span>
              </div>
              
              <button
                onClick={() => signOut(auth)}
                title={settings.lang === 'en' ? 'Log Out' : 'Oturumu Kapat'}
                className="flex items-center gap-1.5 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/25 text-slate-550 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-200 border border-slate-200/40 dark:border-slate-700/50"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-mono text-[10px] uppercase">
                  {settings.lang === 'en' ? 'Exit' : 'Çıkış'}
                </span>
              </button>
            </div>
          </div>

        </div>
      </header>

      {/* TABS CONTAINER */}
      <div className="flex-grow w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col md:flex-row gap-6">
        
        {/* RESPONSIVE FLOATING SIDEBAR NAVIGATION */}
        <nav className="w-full md:w-64 flex-shrink-0 space-y-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-255 border-slate-200 dark:border-slate-800 shadow-xs self-start">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 mb-3">
            {settings.lang === 'en' ? 'MANAGEMENT CONSOLE' : 'YÖNETİM PANELİ'}
          </div>
          
          <button
            id="tab-btn-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'dashboard' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'dashboard' ? 'bg-blue-600' : 'bg-transparent'}`} />
            <LayoutDashboard className="w-4 h-4 flex-shrink-0 text-slate-400" /> {getTranslatedLabel('dashboard', settings.lang)}
          </button>

          <button
            id="tab-btn-projects"
            onClick={() => {
              setDeepSelectProjectId(undefined);
              setActiveTab('projects');
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'projects' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'projects' ? 'bg-blue-600' : 'bg-transparent'}`} />
            <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" /> {getTranslatedLabel('projects', settings.lang)}
          </button>

          <button
            id="tab-btn-budget"
            onClick={() => setActiveTab('budget')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'budget' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'budget' ? 'bg-blue-600' : 'bg-transparent'}`} />
            <ShoppingBag className="w-4 h-4 flex-shrink-0 text-slate-400" /> {getTranslatedLabel('budget', settings.lang)}
          </button>

          <button
            id="tab-btn-accounting"
            onClick={() => setActiveTab('accounting')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'accounting' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'accounting' ? 'bg-blue-600' : 'bg-transparent'}`} />
            <Calculator className="w-4 h-4 flex-shrink-0 text-slate-400" /> {getTranslatedLabel('accounting', settings.lang)}
          </button>

          <button
            id="tab-btn-settings"
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-950 dark:hover:text-white'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeTab === 'settings' ? 'bg-blue-600' : 'bg-transparent'}`} />
            <SettingsIcon className="w-4 h-4 flex-shrink-0 text-slate-400 animate-spin-slow" /> {getTranslatedLabel('settings', settings.lang)}
          </button>

          <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />

          {/* Quick utility section stats */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              {settings.lang === 'en' ? 'LIVE STATS' : 'Canlı Performans'}
            </div>
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span>{settings.lang === 'en' ? 'Active Projects' : 'Aktif Projeler'}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{projects.filter(p => p.status === 'ongoing').length}</span>
              </div>
              <div className="flex justify-between">
                <span>{settings.lang === 'en' ? 'Pending Tasks' : 'Bekleyen İşler'}</span>
                <span className="font-bold text-slate-850 dark:text-slate-200">{tasks.filter(t => t.status !== 'done').length}</span>
              </div>
              <div className="flex justify-between">
                <span>{settings.lang === 'en' ? 'Material Orders' : 'Malzeme Alımı'}</span>
                <span className="font-bold text-slate-850 dark:text-slate-200">
                  {materials.filter(m => m.status !== 'planned').length} {settings.lang === 'en' ? 'Orders' : 'Sipariş'}
                </span>
              </div>
            </div>
          </div>
        </nav>

        {/* MAIN VISUAL CONTENT AREA */}
        <main className="flex-grow min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'dashboard' && (
                <Dashboard 
                  projects={projects}
                  tasks={tasks}
                  materials={materials}
                  transactions={transactions}
                  onNavigate={handleDeepNavigate}
                  settings={settings}
                />
              )}

              {activeTab === 'projects' && (
                <ProjectsView 
                  projects={projects}
                  tasks={tasks}
                  onAddProject={handleAddProject}
                  onUpdateProject={handleUpdateProject}
                  onDeleteProject={handleDeleteProject}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  initialSelectedProjectId={deepSelectProjectId}
                  settings={settings}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetView 
                  projects={projects}
                  materials={materials}
                  onAddMaterial={handleAddMaterial}
                  onUpdateMaterial={handleUpdateMaterial}
                  onDeleteMaterial={handleDeleteMaterial}
                  settings={settings}
                />
              )}

              {activeTab === 'accounting' && (
                <AccountingView 
                  projects={projects}
                  transactions={transactions}
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onImportBackup={handleImportBackup}
                  allDataExportString={allDataExportString}
                  settings={settings}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView 
                  settings={settings}
                  onUpdateSettings={saveSettings}
                  onResetAllData={handleResetAllData}
                  exportDataJson={allDataExportString}
                  onImportBackup={handleImportBackup}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* FOOTER METRICS AND META */}
      <footer className="bg-white border-t border-slate-100 py-4 px-6 text-center text-xs text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3">
          <span>{settings.lang === 'en' ? 'Renovation Budget & Job Tracker System © 2026. All Rights Reserved.' : 'Tadilat Bütçe ve İş Takip Sistemi © 2026. Tüm Hakları Saklıdır.'}</span>
          <div className="flex gap-4">
            <span className="font-medium text-slate-500">{settings.lang === 'en' ? 'Crafted UI' : 'Milli Üretim'}</span>
            <span className="text-slate-350">|</span>
            <span className="font-semibold text-slate-500">{settings.lang === 'en' ? 'Time & Budget Efficiency' : 'Zaman ve Bütçe Tasarrufu'}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
