export type ProjectStatus = 'planning' | 'ongoing' | 'suspended' | 'completed';

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  targetDate: string;
  allocatedBudget: number;
  clientId?: string;
  clientName?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  projectId: string;
  userId?: string;
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
  userId?: string;
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
  lang: 'tr' | 'en' | 'pl';
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

export interface ProposalTask {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  price: number;
}

export interface ProposalMaterial {
  id: string;
  title: string;
  category: MaterialCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface Proposal {
  id: string;
  userId: string;
  clientName: string;
  clientCompany?: string;
  clientId?: string;
  projectName: string;
  projectDescription: string;
  pricingType: 'project' | 'itemized';
  totalProjectPrice: number;
  tasks: ProposalTask[];
  materials: ProposalMaterial[];
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  createdAt: string;
  validUntil: string;
  notes?: string;
  convertedToProjectId?: string;
}

export interface TimeLog {
  id: string;
  userId: string;
  projectId: string;
  taskId?: string;
  startTime: string; // ISO-8601 String
  endTime?: string; // ISO-8601 String, empty if running
  notes?: string;
  durationMinutes?: number;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  projectId: string; // can match a Project ID, or 'none' for general
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime?: string; // HH:MM, optional
  endTime?: string; // HH:MM, optional
  color?: string; // Tailwind bg class name or Hex
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  company?: string;
  phone: string;
  email: string;
  address?: string;
  notes?: string;
  createdAt: string;
}

export type PermissionLevel = 'full' | 'view' | 'edit' | 'hide';

export interface CollaboratorPermissions {
  projectDetails: PermissionLevel;
  tasks: PermissionLevel;
  budget: PermissionLevel;
  accounting: PermissionLevel;
}

export interface Collaborator {
  id: string; // Formed as projectId_userEmail
  projectId: string;
  projectName: string;
  ownerId: string;
  userEmail: string;
  role: 'admin' | 'editor' | 'viewer' | 'custom';
  permissions?: CollaboratorPermissions;
  createdAt: string;
}

