import { Project, Task, Material, Transaction } from './types';

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-mutfak',
    name: 'Mutfak Komple Yenileme',
    description: 'Tezgah, dolaplar, tesisat yenileme ve seramik döşeme işleri dahil komple mutfak tadilatı.',
    status: 'ongoing',
    startDate: '2026-05-10',
    targetDate: '2026-06-25',
    allocatedBudget: 120000,
  },
  {
    id: 'proj-banyo',
    name: 'Ebeveyn Banyosu Dekorasyonu',
    description: 'Duşakabin yenileme, gizli aydınlatma, banyo dolabı ve yeni klozet montajı.',
    status: 'planning',
    startDate: '2026-06-15',
    targetDate: '2026-07-05',
    allocatedBudget: 55000,
  },
  {
    id: 'proj-salon',
    name: 'Salon Alçıpan ve Boya',
    description: 'TV ünitesi arkası patlatılmış taş döşeme, asma tavan yapımı ve Jotun boya ile boyama.',
    status: 'completed',
    startDate: '2026-04-01',
    targetDate: '2026-04-20',
    allocatedBudget: 35000,
  }
];

export const INITIAL_TASKS: Task[] = [
  // Mutfak tasks
  {
    id: 'task-1',
    projectId: 'proj-mutfak',
    title: 'Eski dolapların sökülmesi',
    description: 'Eski mutfak dolaplarının ve tezgah üstü mermerin kırılarak molozların atılması.',
    priority: 'high',
    status: 'done',
    dueDate: '2026-05-12',
    assignedTo: 'Ahmet Usta (Yıkım)'
  },
  {
    id: 'task-2',
    projectId: 'proj-mutfak',
    title: 'Elektrik & Su Tesisat Altyapısı',
    description: 'Priz yerlerinin kaydırılması ve ankastre için yeni tesisat çekilmesi.',
    priority: 'urgent',
    status: 'done',
    dueDate: '2026-05-18',
    assignedTo: 'Kemal Usta (Tesisat)'
  },
  {
    id: 'task-3',
    projectId: 'proj-mutfak',
    title: 'Mutfak Tezgahı Siparişi',
    description: 'Ölçü alındıktan sonra Belenco tezgah siparişinin geçilmesi.',
    priority: 'medium',
    status: 'doing',
    dueDate: '2026-06-05',
    assignedTo: 'Mermerci Hüseyin'
  },
  {
    id: 'task-4',
    projectId: 'proj-mutfak',
    title: 'Mutfak Dolapları Montajı',
    description: 'Lake mutkap kapakları ve gövdelerinin montajının tamamlanması.',
    priority: 'high',
    status: 'todo',
    dueDate: '2026-06-12',
    assignedTo: 'Mehmet Usta (Mobilya)'
  },
  {
    id: 'task-5',
    projectId: 'proj-mutfak',
    title: 'Tezgah arası seramik döşeme',
    description: '60x120 porselen seramiklerin tezgah arasına döşenmesi ve derz çekilmesi.',
    priority: 'medium',
    status: 'todo',
    dueDate: '2026-06-18',
    assignedTo: 'Salih Usta (Seramik)'
  },

  // Banyo tasks
  {
    id: 'task-6',
    projectId: 'proj-banyo',
    title: 'Yüzey su yalıtımı yapılması',
    description: 'Duş içi alanın çift bileşenli su yalıtım malzemesiyle kaplanması.',
    priority: 'urgent',
    status: 'todo',
    dueDate: '2026-06-16',
    assignedTo: 'Salih Usta (Seramik)'
  },
  {
    id: 'task-7',
    projectId: 'proj-banyo',
    title: 'Asma Tavan Malzemeleri Alımı',
    description: 'Banyo için yeşil alçıpan ve ankrajların temin edilmesi.',
    priority: 'low',
    status: 'todo',
    dueDate: '2026-06-20',
    assignedTo: 'Kendi Alımımız'
  },

  // Salon tasks
  {
    id: 'task-8',
    projectId: 'proj-salon',
    title: 'Kartonpiyer ve boya uygulaması',
    description: 'Asma tavan sonrası boyacı ustasının astar ve 2 kat boya uygulaması.',
    priority: 'medium',
    status: 'done',
    dueDate: '2026-04-18',
    assignedTo: 'Ömer Usta (Boyacı)'
  }
];

export const INITIAL_MATERIALS: Material[] = [
  // Mutfak materials
  {
    id: 'mat-1',
    projectId: 'proj-mutfak',
    title: 'Lake Mutfak Dolapları',
    category: 'Mobilya & Dolap',
    vendor: 'Decoline Line Tasarım',
    quantity: 1,
    unit: 'Takım',
    unitPrice: 58000,
    totalPrice: 58000,
    status: 'purchased',
    purchaseDate: '2026-05-15',
    isPaid: true
  },
  {
    id: 'mat-2',
    projectId: 'proj-mutfak',
    title: '60x120 Bien Seramik Karo',
    category: 'Zemin & Seramik',
    vendor: 'Yurtbay Seramik Bayii',
    quantity: 12,
    unit: 'Kutu',
    unitPrice: 450,
    totalPrice: 5400,
    status: 'delivered',
    purchaseDate: '2026-05-12',
    isPaid: true
  },
  {
    id: 'mat-3',
    projectId: 'proj-mutfak',
    title: 'Belenco Kuvars Mutfak Tezgahı',
    category: 'Mobilya & Dolap',
    vendor: 'Mermerci Hüseyin',
    quantity: 1,
    unit: 'Adet',
    unitPrice: 28000,
    totalPrice: 28000,
    status: 'planned',
    isPaid: false
  },
  {
    id: 'mat-4',
    projectId: 'proj-mutfak',
    title: 'ECA Evye Bataryası',
    category: 'Tesisat (Elektrik/Su)',
    vendor: 'Tekzen Yapı Market',
    quantity: 1,
    unit: 'Adet',
    unitPrice: 3200,
    totalPrice: 3200,
    status: 'delivered',
    purchaseDate: '2026-05-20',
    isPaid: true
  },

  // Banyo materials
  {
    id: 'mat-5',
    projectId: 'proj-banyo',
    title: 'Siyah Profilli Duşakabin (90x95)',
    category: 'Zemin & Seramik',
    vendor: 'Duş Duş Ltd.',
    quantity: 1,
    unit: 'Adet',
    unitPrice: 12500,
    totalPrice: 12500,
    status: 'planned',
    isPaid: false
  },
  {
    id: 'mat-6',
    projectId: 'proj-banyo',
    title: 'Banyo Batarya Seti (Artema)',
    category: 'Tesisat (Elektrik/Su)',
    vendor: 'Hepsiburada Satıcısı',
    quantity: 1,
    unit: 'Set',
    unitPrice: 6800,
    totalPrice: 6800,
    status: 'purchased',
    purchaseDate: '2026-05-28',
    isPaid: true
  },

  // Salon materials
  {
    id: 'mat-7',
    projectId: 'proj-salon',
    title: 'Jotun Fenomastic Mat Boya',
    category: 'Boya & Badana',
    vendor: 'Jotun Merkez Mağaza',
    quantity: 2,
    unit: 'Kova',
    unitPrice: 2900,
    totalPrice: 5800,
    status: 'delivered',
    purchaseDate: '2026-04-03',
    isPaid: true
  }
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // Budget infusions (Incomes)
  {
    id: 'trans-inc-1',
    projectId: 'proj-mutfak',
    title: 'Tadilat Birikimi - Katılım Payı',
    type: 'income',
    category: 'Bütçe Aktarımı',
    amount: 100000,
    date: '2026-05-01',
    paymentMethod: 'bank_transfer',
    notes: 'Mutfak tadilatı için ayrılan nakit birikim hesaptan aktarıldı.'
  },
  {
    id: 'trans-inc-2',
    projectId: 'proj-banyo',
    title: 'Banyo Tadilat Fonu',
    type: 'income',
    category: 'Bütçe Aktarımı',
    amount: 50000,
    date: '2026-05-25',
    paymentMethod: 'bank_transfer',
    notes: 'Banyo bütçesi için sisteme eklenen nakit.'
  },
  {
    id: 'trans-inc-3',
    projectId: 'proj-salon',
    title: 'Salon Ek Bütçe',
    type: 'income',
    category: 'Bütçe Aktarımı',
    amount: 35000,
    date: '2026-04-01',
    paymentMethod: 'cash',
    notes: 'Salon bütçesinin tamamı nakit olarak sağlandı.'
  },
  {
    id: 'trans-inc-4',
    projectId: 'global',
    title: 'Genel Acil Durum Rezervi',
    type: 'income',
    category: 'Yedek Akçe',
    amount: 30000,
    date: '2026-05-01',
    paymentMethod: 'bank_transfer',
    notes: 'Herhangi bir projede çıkabilecek ek maliyetler için genel yedek fon.'
  },

  // Expenses (Material Payments & Labor Payments)
  {
    id: 'trans-exp-1',
    projectId: 'proj-mutfak',
    title: 'Lake Mutfak Dolabı Peşinatı',
    type: 'expense',
    category: 'Mobilya & Dolap',
    amount: 58000,
    date: '2026-05-15',
    paymentMethod: 'bank_transfer',
    notes: 'Decoline dolap siparişi için ödenen bedel.'
  },
  {
    id: 'trans-exp-2',
    projectId: 'proj-mutfak',
    title: 'Yıkım ve Moloz Söküm İşçiliği',
    type: 'expense',
    category: 'Hizmet & İşçilik',
    amount: 12000,
    date: '2026-05-12',
    paymentMethod: 'cash',
    notes: 'Ahmet Usta ve ekibinin yıkım ve moloz taşıma işçiliği ücreti.'
  },
  {
    id: 'trans-exp-3',
    projectId: 'proj-mutfak',
    title: 'Bien Seramik Alımı',
    type: 'expense',
    category: 'Zemin & Seramik',
    amount: 5400,
    date: '2026-05-12',
    paymentMethod: 'card',
    notes: 'Zemin ve tezgah arkası seramik bedeli.'
  },
  {
    id: 'trans-exp-4',
    projectId: 'proj-mutfak',
    title: 'ECA Evye Bataryası Alımı',
    type: 'expense',
    category: 'Tesisat (Elektrik/Su)',
    amount: 3200,
    date: '2026-05-20',
    paymentMethod: 'card',
  },
  {
    id: 'trans-exp-5',
    projectId: 'proj-banyo',
    title: 'Artema Banyo Batarya Seti Alımı',
    type: 'expense',
    category: 'Tesisat (Elektrik/Su)',
    amount: 6800,
    date: '2026-05-28',
    paymentMethod: 'card',
  },
  {
    id: 'trans-exp-6',
    projectId: 'proj-salon',
    title: 'Boya ve Alçı Malzemeleri',
    type: 'expense',
    category: 'Boya & Badana',
    amount: 5800,
    date: '2026-04-03',
    paymentMethod: 'card',
  },
  {
    id: 'trans-exp-7',
    projectId: 'proj-salon',
    title: 'Asma Tavan ve Boya İşçiliği',
    type: 'expense',
    category: 'Hizmet & İşçilik',
    amount: 22000,
    date: '2026-04-18',
    paymentMethod: 'bank_transfer',
    notes: 'Asma tavan alçıpan ustası ve boyacı Ömer Usta hakediş ödemesi.'
  }
];
