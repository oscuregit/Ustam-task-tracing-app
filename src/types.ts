export type ProjectStatus = 'planning' | 'ongoing' | 'suspended' | 'completed';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  allocatedBudget: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  assignedTo?: string;
}

export type MaterialCategory =
  | 'Kaba İnşaat'
  | 'Tesisat (Elektrik/Su)'
  | 'Zemin & Seramik'
  | 'Boya & Badana'
  | 'Aydınlatma & Elektrik'
  | 'Mobilya & Dolap'
  | 'Hizmet & İşçilik'
  | 'Diğer';

export type MaterialStatus = 'planned' | 'purchased' | 'delivered';

export interface Material {
  id: string;
  projectId: string;
  title: string;
  category: MaterialCategory;
  vendor: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  status: MaterialStatus;
  purchaseDate?: string;
  isPaid: boolean; // Tells us if this was fully paid or is on credit/debt
}

export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  projectId: string; // "global" for common/undistributed transactions
  title: string;
  type: TransactionType;
  category: string; // "bütçe", material category, "işçilik", "nakliye", etc.
  amount: number;
  date: string;
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'debt'; // Nakit, Kart, Havale, Borç
  notes?: string;
}

export interface MaterialCategorySummary {
  category: MaterialCategory;
  totalPlanned: number;
  totalSpent: number;
  itemCount: number;
}

export interface AppSettings {
  lang: 'tr' | 'en';
  currency: 'TRY' | 'USD' | 'EUR' | 'PLN';
  theme: 'light' | 'dark';
  timezone: string;
  defaultVatRate: number;
  budgetWarningThreshold: number;
  autoSyncMaterialToLedger: boolean;
  decimalPlaces: 0 | 2;
  showWelcomeBanner: boolean;
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD.MM.YYYY';
}

export interface AccountingSummary {
  totalAllocatedBudget: number;
  totalExpenses: number; // Sum of expenses (including unpaid)
  totalPaid: number;     // Cash flowing out
  totalUnpaid: number;   // Our debt to suppliers
  totalReceived: number; // Funds we injected
  cashBalance: number;   // totalReceived - totalPaid
}
