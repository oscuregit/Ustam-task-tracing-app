import React, { useState, useMemo } from 'react';
import { Project, ProjectStatus, Task, TaskPriority, TaskStatus, AppSettings, Transaction } from '../types';
import { formatMoney, formatDate } from '../utils';
import { 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  Edit3, 
  AlertTriangle, 
  Clock, 
  User, 
  ChevronRight, 
  Filter,
  Check,
  Briefcase,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  onAddProject: (p: Omit<Project, 'id'>) => void;
  onUpdateProject: (p: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onAddTask: (t: Omit<Task, 'id'>) => void;
  onUpdateTask: (t: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTransaction?: (t: Omit<Transaction, 'id'>) => void;
  initialSelectedProjectId?: string;
  settings?: AppSettings;
}

export default function ProjectsView({
  projects,
  tasks,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onAddTransaction,
  initialSelectedProjectId,
  settings
}: ProjectsViewProps) {
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
  // Set selected project state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialSelectedProjectId || (projects.length > 0 ? projects[0].id : null)
  );

  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{
    isOpen: boolean;
    type: 'project' | 'task';
    id: string;
    title: string;
  } | null>(null);

  // If previous selection was deleted or null, auto-select first available one
  const activeProjectId = useMemo(() => {
    if (selectedProjectId && projects.some(p => p.id === selectedProjectId)) {
      return selectedProjectId;
    }
    return projects.length > 0 ? projects[0].id : null;
  }, [projects, selectedProjectId]);

  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  // Project Filtering
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('all');

  const filteredProjects = useMemo(() => {
    if (projectStatusFilter === 'all') return projects;
    return projects.filter((p) => p.status === projectStatusFilter);
  }, [projects, projectStatusFilter]);

  // Modals / Form States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // State for adding a project
  const [projName, setProjName] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projBudget, setProjBudget] = useState(0);
  const [projStatus, setProjStatus] = useState<ProjectStatus>('planning');
  const [projStart, setProjStart] = useState('');
  const [projTarget, setProjTarget] = useState('');

  // Sate for adding a task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskStatus, setTaskStatus] = useState<TaskStatus>('todo');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskUsta, setTaskUsta] = useState('');

  // Task-based income or expense fields
  const [linkFinance, setLinkFinance] = useState(false);
  const [financeType, setFinanceType] = useState<'income' | 'expense'>('expense');
  const [financeAmount, setFinanceAmount] = useState('');
  const [financeCategory, setFinanceCategory] = useState('Usta İşçilik & Hizmet');
  const [financePaymentMethod, setFinancePaymentMethod] = useState<'cash' | 'card' | 'bank_transfer' | 'debt'>('bank_transfer');

  // Tasks belonging to the active project
  const projectTasks = useMemo(() => {
    if (!activeProjectId) return [];
    return tasks.filter((t) => t.projectId === activeProjectId);
  }, [tasks, activeProjectId]);

  // Task lists split by column status
  const tasksByStatus = useMemo(() => {
    return {
      todo: projectTasks.filter((t) => t.status === 'todo'),
      doing: projectTasks.filter((t) => t.status === 'doing'),
      done: projectTasks.filter((t) => t.status === 'done'),
    };
  }, [projectTasks]);

  // Open Add Project Modal
  const handleOpenAddProject = () => {
    setEditingProject(null);
    setProjName('');
    setProjDesc('');
    setProjBudget(10000);
    setProjStatus('planning');
    setProjStart(new Date().toISOString().split('T')[0]);
    setProjTarget('');
    setIsProjectModalOpen(true);
  };

  // Open Edit Project Modal
  const handleOpenEditProject = (p: Project) => {
    setEditingProject(p);
    setProjName(p.name);
    setProjDesc(p.description);
    setProjBudget(p.allocatedBudget);
    setProjStatus(p.status);
    setProjStart(p.startDate);
    setProjTarget(p.targetDate);
    setIsProjectModalOpen(true);
  };

  const handleTriggerDeleteTask = (taskId: string) => {
    const task = tasks.find(tk => tk.id === taskId);
    if (task) {
      setDeleteConfirmInfo({
        isOpen: true,
        type: 'task',
        id: task.id,
        title: task.title
      });
    }
  };

  const handleSaveProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName.trim()) return;

    if (editingProject) {
      onUpdateProject({
        ...editingProject,
        name: projName,
        description: projDesc,
        allocatedBudget: Number(projBudget),
        status: projStatus,
        startDate: projStart,
        targetDate: projTarget,
      });
    } else {
      onAddProject({
        name: projName,
        description: projDesc,
        allocatedBudget: Number(projBudget),
        status: projStatus,
        startDate: projStart,
        targetDate: projTarget,
      });
    }
    setIsProjectModalOpen(false);
  };

  // Reset Task inputs
  const handleOpenAddTask = () => {
    if (!activeProjectId) return;
    setEditingTask(null);
    setTaskTitle('');
    setTaskDesc('');
    setTaskPriority('medium');
    setTaskStatus('todo');
    setTaskDueDate(new Date().toISOString().split('T')[0]);
    setTaskUsta('');
    setLinkFinance(false);
    setFinanceType('expense');
    setFinanceAmount('');
    setFinanceCategory('Usta İşçilik & Hizmet');
    setFinancePaymentMethod('bank_transfer');
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTask = (t: Task) => {
    setEditingTask(t);
    setTaskTitle(t.title);
    setTaskDesc(t.description);
    setTaskPriority(t.priority);
    setTaskStatus(t.status);
    setTaskDueDate(t.dueDate);
    setTaskUsta(t.assignedTo || '');
    setLinkFinance(false);
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeProjectId) return;

    if (editingTask) {
      onUpdateTask({
        ...editingTask,
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        status: taskStatus,
        dueDate: taskDueDate,
        assignedTo: taskUsta || undefined,
      });
    } else {
      onAddTask({
        projectId: activeProjectId,
        title: taskTitle,
        description: taskDesc,
        priority: taskPriority,
        status: taskStatus,
        dueDate: taskDueDate,
        assignedTo: taskUsta || undefined,
      });

      if (linkFinance && onAddTransaction && Number(financeAmount) > 0) {
        onAddTransaction({
          projectId: activeProjectId,
          title: `${financeType === 'income' ? 'Görev Geliri:' : 'Görev Gideri:'} ${taskTitle}`,
          type: financeType,
          category: financeCategory,
          amount: Number(financeAmount),
          date: taskDueDate || new Date().toISOString().split('T')[0],
          paymentMethod: financePaymentMethod,
          notes: `Yeni görev açılırken otomatik atanan bütçe hareketi. Görev: ${taskTitle}`
        });
      }
    }
    setIsTaskModalOpen(false);
  };

  // Change Task Status on-the-fly inside Kanban columns
  const handleStatusShift = (task: Task, nextStatus: TaskStatus) => {
    onUpdateTask({
      ...task,
      status: nextStatus
    });
  };

  // Quick helper for priority styling
  const getPriorityBadgeClass = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityLabel = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent': return 'Yüksek / Acil';
      case 'high': return 'Yüksek';
      case 'medium': return 'Orta';
      case 'low': return 'Düşük';
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* LEFT COLUMN: Project Selector List */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-2xs">
          <h2 className="font-semibold text-slate-800 text-base flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-500" /> Projeler
          </h2>
          <button 
            id="proj-add-badge-btn"
            onClick={handleOpenAddProject}
            className="p-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-slate-950 hover:scale-105 transition-transform flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Yeni Proje Ekle"
          >
            <Plus className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>

        {/* Status Filters */}
        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs flex flex-wrap gap-1">
          {['all', 'planning', 'ongoing', 'completed', 'suspended'].map((status) => {
            const label = {
              all: 'Tümü',
              planning: 'Planlanan',
              ongoing: 'Aktif',
              completed: 'Biten',
              suspended: 'Durdurulan'
            }[status];

            const isActive = projectStatusFilter === status;
            return (
              <button
                key={status}
                id={`filter-proj-status-${status}`}
                onClick={() => setProjectStatusFilter(status)}
                className={`text-xs px-2.5 py-1.5 rounded-lg transition-all font-medium cursor-pointer ${
                  isActive 
                    ? 'bg-slate-900 text-white shadow-xs' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Project cards items list */}
        <div className="space-y-3 overflow-y-auto max-h-[500px]">
          {filteredProjects.length === 0 ? (
            <div className="bg-white p-6 rounded-xl border border-dashed border-slate-250 text-center text-slate-400 text-xs">
              Eşleşen proje bulunamadı.
            </div>
          ) : (
            filteredProjects.map((p) => {
              const projTasksTotal = tasks.filter(t => t.projectId === p.id);
              const doneTasks = projTasksTotal.filter(t => t.status === 'done').length;
              const completedTasksPercent = projTasksTotal.length > 0 
                ? Math.round((doneTasks / projTasksTotal.length) * 100) 
                : 0;

              const isSelected = p.id === activeProjectId;

              return (
                <div
                  key={p.id}
                  id={`proj-card-${p.id}`}
                  onClick={() => setSelectedProjectId(p.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected 
                      ? 'bg-white border-amber-500 shadow-md ring-1 ring-amber-500/20' 
                      : 'bg-white border-slate-100 hover:border-slate-350 shadow-2xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex justify-between items-start gap-1">
                      <h3 className="font-semibold text-slate-800 text-sm md:text-base group-hover:text-amber-600 transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform ${
                        isSelected ? 'rotate-90 text-amber-500' : ''
                      }`} />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="font-medium bg-slate-100 px-1.5 py-0.5 rounded-md text-slate-655 dark:bg-slate-800 dark:text-slate-350">
                        {formatMoney(p.allocatedBudget, activeSettings)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded bg-slate-50 border ${
                        p.status === 'completed' ? 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60' :
                        p.status === 'ongoing' ? 'text-blue-700 bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60' :
                        p.status === 'suspended' ? 'text-red-700 bg-red-50 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60' :
                        'text-slate-650'
                      }`}>
                        {p.status === 'completed' ? (isEn ? 'Completed' : 'Tamamlandı') :
                         p.status === 'ongoing' ? (isEn ? 'Ongoing' : 'Sürüyor') :
                         p.status === 'suspended' ? (isEn ? 'Suspended' : 'Beklemede') : (isEn ? 'Planning' : 'Planlanıyor')}
                      </span>
                    </div>

                    {/* Progress slider mini */}
                    <div className="space-y-1 pt-1.5">
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Görev İlerlemesi</span>
                        <span>{completedTasksPercent}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full" 
                          style={{ width: `${completedTasksPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Project Details & Tasks Kanban Board */}
      <div className="flex-grow space-y-6">
        {activeProject ? (
          <div>
            {/* Project Header card info */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                    <Building2 className="text-amber-500 w-6 h-6 flex-shrink-0" />
                    {activeProject.name}
                  </h1>
                  <span className="text-xs text-slate-450 font-medium font-mono">
                    PROJE ID: {activeProject.id}
                  </span>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                  <button 
                    id="proj-edit-action-btn"
                    onClick={() => handleOpenEditProject(activeProject)}
                    className="p-2 text-slate-500 hover:text-amber-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-xs flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" /> Düzenle
                  </button>
                  <button 
                    id="proj-delete-action-btn"
                    onClick={() => {
                      setDeleteConfirmInfo({
                        isOpen: true,
                        type: 'project',
                        id: activeProject.id,
                        title: activeProject.name
                      });
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Projeyi Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Description text */}
              <p className="text-slate-600 dark:text-slate-350 text-sm leading-relaxed max-w-2xl bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                {activeProject.description || (isEn ? 'No description entered for this project yet.' : 'Bu proje için herhangi bir açıklama girilmemiştir.')}
              </p>

              {/* Dates & Budgets Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px] mb-1">{isEn ? 'Allocated Budget' : 'Ayrılan Bütçe'}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-sm font-mono">
                    {formatMoney(activeProject.allocatedBudget, activeSettings)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px] mb-1">{isEn ? 'Planned Start' : 'Planlanan Başlama'}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> {formatDate(activeProject.startDate, activeSettings.lang)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px] mb-1">{isEn ? 'Due Date' : 'Teslim Tarihi'}</span>
                  <span className="font-bold text-red-650 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {formatDate(activeProject.targetDate, activeSettings.lang)}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block font-semibold uppercase tracking-wider text-[9px] mb-1">{isEn ? 'Project Status' : 'Proje Durumu'}</span>
                  <span className={`font-bold uppercase tracking-wider text-[10px] ${
                    activeProject.status === 'completed' ? 'text-emerald-500' :
                    activeProject.status === 'ongoing' ? 'text-blue-550' :
                    activeProject.status === 'suspended' ? 'text-rose-500' : 'text-slate-500'
                  }`}>
                    {activeProject.status === 'completed' ? (isEn ? 'Done' : 'Bitti') :
                     activeProject.status === 'ongoing' ? (isEn ? 'Ongoing' : 'Devam Ediyor') :
                     activeProject.status === 'suspended' ? (isEn ? 'Suspended' : 'Askıda') : (isEn ? 'Planning' : 'Planlama')}
                  </span>
                </div>
              </div>
            </div>

            {/* Task Board Management Header */}
            <div className="flex justify-between items-center mt-8 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="text-blue-500 w-5 h-5" /> Görev Panosu
              </h3>
              <button 
                id="task-board-add-btn"
                onClick={handleOpenAddTask}
                className="flex items-center gap-1.5 bg-slate-905 hover:bg-slate-850 bg-slate-900 text-white font-medium px-3.5 py-2 rounded-xl text-xs cursor-pointer shadow-xs transition-transform hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4" /> Yeni Görev Ekle
              </button>
            </div>

            {/* Tasks Kanban Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              
              {/* YAPILACAKLAR COLUMN */}
              <div className="bg-slate-50/40 p-4 rounded-2xl border border-slate-100/60 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    YAPILACAKLAR
                  </h4>
                  <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[11px] font-bold text-slate-500">
                    {tasksByStatus.todo.length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[500px]">
                  {tasksByStatus.todo.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                      Kayıtlı görev yok.
                    </div>
                  ) : (
                    tasksByStatus.todo.map((t) => (
                      <TaskCard 
                        key={t.id} 
                        task={t} 
                        onEdit={handleOpenEditTask}
                        onDelete={handleTriggerDeleteTask}
                        onShiftStatus={(t) => handleStatusShift(t, 'doing')}
                        badgeClass={getPriorityBadgeClass}
                        priorityLabel={getPriorityLabel}
                        nextStatusLabel="Çalışmayı Başlat"
                        lang={activeSettings.lang}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* YAPILIYOR COLUMN */}
              <div className="bg-blue-50/20 p-4 rounded-2xl border border-blue-50/35 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-blue-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    YAPILIYOR
                  </h4>
                  <span className="bg-blue-50 px-2 py-0.5 rounded-full text-[11px] font-bold text-blue-700">
                    {tasksByStatus.doing.length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[500px]">
                  {tasksByStatus.doing.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                      Çalışılan görev yok.
                    </div>
                  ) : (
                    tasksByStatus.doing.map((t) => (
                      <TaskCard 
                        key={t.id} 
                        task={t} 
                        onEdit={handleOpenEditTask}
                        onDelete={handleTriggerDeleteTask}
                        onShiftStatus={(t) => handleStatusShift(t, 'done')}
                        badgeClass={getPriorityBadgeClass}
                        priorityLabel={getPriorityLabel}
                        nextStatusLabel="Tamamlandı Olarak İşaretle"
                        lang={activeSettings.lang}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* BİTENLER COLUMN */}
              <div className="bg-emerald-50/10 p-4 rounded-2xl border border-emerald-50/20 flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    BİTENLER
                  </h4>
                  <span className="bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-bold text-emerald-700">
                    {tasksByStatus.done.length}
                  </span>
                </div>

                <div className="space-y-3 flex-grow overflow-y-auto max-h-[500px]">
                  {tasksByStatus.done.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 rounded-xl">
                      Tamamlanan görev yok.
                    </div>
                  ) : (
                    tasksByStatus.done.map((t) => (
                      <TaskCard 
                        key={t.id} 
                        task={t} 
                        onEdit={handleOpenEditTask}
                        onDelete={handleTriggerDeleteTask}
                        badgeClass={getPriorityBadgeClass}
                        priorityLabel={getPriorityLabel}
                        isCompleted
                        onShiftStatusBack={(t) => handleStatusShift(t, 'doing')}
                        lang={activeSettings.lang}
                      />
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-250 text-center text-slate-400 space-y-4">
            <Briefcase className="w-12 h-12 stroke-[1.5] mx-auto text-slate-300" />
            <h3 className="font-semibold text-slate-755 text-base">Henüz Herhangi Bir Proje Yok</h3>
            <p className="text-xs max-w-sm mx-auto">
              Tadilat işlerinizi başlatmak ve son teslim tarihlerini takip edebilmek için sol üstteki &quot;Ekle&quot; butonuna dokunun.
            </p>
            <button 
              onClick={handleOpenAddProject} 
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 transition-colors text-slate-950 font-semibold text-sm rounded-xl cursor-pointer shadow-xs"
            >
              Hemen İlk Projeyi Ekle
            </button>
          </div>
        )}
      </div>

      {/* PROJECT MODAL (Add / Edit) */}
      <AnimatePresence>
        {isProjectModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4 relative"
            >
              <button 
                onClick={() => setIsProjectModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-850">
                  {editingProject ? 'Projeyi Düzenle' : 'Yeni Tadilat Projesi Başlat'}
                </h3>
                <p className="text-xs text-slate-400">Tadilat detaylarını ve bütçe planını girin</p>
              </div>

              <form onSubmit={handleSaveProject} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Proje Adı</label>
                  <input 
                    type="text" 
                    required
                    id="proj-modal-input-name"
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    placeholder="Mutfak Yenileme, Banyo Seramik vb."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Proje Açıklaması</label>
                  <textarea 
                    value={projDesc}
                    id="proj-modal-input-desc"
                    onChange={(e) => setProjDesc(e.target.value)}
                    placeholder="Mutfakta yapılacak işlemlerin özeti..."
                    rows={3}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all bg-slate-50/30 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">
                      {isEn ? `Allocated Budget (${activeSettings.currency})` : `Ayrılan Bütçe (${activeSettings.currency === 'TRY' ? '₺' : activeSettings.currency})`}
                    </label>
                    <input 
                      type="number" 
                      required
                      id="proj-modal-input-budget"
                      min={0}
                      value={projBudget}
                      onChange={(e) => setProjBudget(Number(e.target.value))}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono focus:ring-1 focus:ring-amber-500/25 transition-all bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{isEn ? 'Status' : 'Durum'}</label>
                    <select
                      id="proj-modal-input-status"
                      value={projStatus}
                      onChange={(e) => setProjStatus(e.target.value as ProjectStatus)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 block bg-slate-50/30 transition-all cursor-pointer"
                    >
                      <option value="planning">{isEn ? 'Planning' : 'Planlama'}</option>
                      <option value="ongoing">{isEn ? 'Ongoing' : 'Devam Ediyor'}</option>
                      <option value="suspended">{isEn ? 'Suspended' : 'Askıya Alındı'}</option>
                      <option value="completed">{isEn ? 'Completed' : 'Tamamlandı'}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Başlangıç Tarihi</label>
                    <input 
                      type="date" 
                      required
                      id="proj-modal-input-start"
                      value={projStart}
                      onChange={(e) => setProjStart(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Bitiş Hedefi</label>
                    <input 
                      type="date" 
                      required
                      id="proj-modal-input-target"
                      value={projTarget}
                      onChange={(e) => setProjTarget(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsProjectModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button 
                    type="submit" 
                    id="proj-modal-submit-btn"
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-600 shadow-md transition-colors cursor-pointer"
                  >
                    {editingProject ? 'Güncelle' : 'Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TASK MODAL (Add / Edit) */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full p-6 space-y-4 relative"
            >
              <button 
                onClick={() => setIsTaskModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-850">
                  {editingTask ? 'Görevi Düzenle' : 'Yeni Görev Tanımla'}
                </h3>
                <p className="text-xs text-slate-400">Tadilat elemanına atanacak iş adımlarını oluşturun</p>
              </div>

              <form onSubmit={handleSaveTask} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">Görev Başlığı</label>
                  <input 
                    type="text" 
                    required
                    id="task-modal-input-title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Eğrileri şaküle al, Asma tavanı karkasla vb."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all bg-slate-50/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 uppercase">İş Detayı / Açıklama</label>
                  <textarea 
                    value={taskDesc}
                    id="task-modal-input-desc"
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Görevin ayrıntılı açıklaması, kullanılacak malzemeler..."
                    rows={2}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 transition-all bg-slate-50/30 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Öncelik Derecesi</label>
                    <select
                      id="task-modal-input-priority"
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 block bg-slate-50/30 transition-all cursor-pointer"
                    >
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                      <option value="urgent">Çok Acil</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Durum</label>
                    <select
                      id="task-modal-input-status"
                      value={taskStatus}
                      onChange={(e) => setTaskStatus(e.target.value as TaskStatus)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/25 block bg-slate-50/30 transition-all cursor-pointer"
                    >
                      <option value="todo">Yapılacaklar</option>
                      <option value="doing">Yapılıyor</option>
                      <option value="done">Bitti</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Son Tarih</label>
                    <input 
                      type="date" 
                      required
                      id="task-modal-input-duedate"
                      value={taskDueDate}
                      onChange={(e) => setTaskDueDate(e.target.value)}
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600 uppercase">Sorumlu Kişi / Usta</label>
                    <input 
                      type="text" 
                      id="task-modal-input-assignee"
                      value={taskUsta}
                      onChange={(e) => setTaskUsta(e.target.value)}
                      placeholder="Örn: Salih Usta (Seramik)"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 transition-all bg-slate-50/30"
                    />
                  </div>
                </div>

                {!editingTask && (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300 tracking-wide select-none">
                      <input 
                        type="checkbox"
                        checked={linkFinance}
                        onChange={(e) => setLinkFinance(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Görevli finansal işlem (Gelir/Gider) ekle</span>
                    </label>

                    {linkFinance && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3 pt-2 border-t border-slate-200/50 dark:border-slate-800/50"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">İşlem Tipi</label>
                            <select
                              value={financeType}
                              onChange={(e) => setFinanceType(e.target.value as any)}
                              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:border-amber-500 cursor-pointer text-slate-800 dark:text-slate-200"
                            >
                              <option value="expense">Harcama / Gider (Masraf)</option>
                              <option value="income">Gelir (Hakediş / Ödeme)</option>
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">İşlem Tutarı ({activeSettings.currency})</label>
                            <input 
                              type="number"
                              required={linkFinance}
                              min={1}
                              placeholder="0"
                              value={financeAmount}
                              onChange={(e) => setFinanceAmount(e.target.value)}
                              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:border-amber-500 font-mono text-slate-800 dark:text-slate-200"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">İşlem Kategorisi</label>
                            {financeType === 'income' ? (
                              <select
                                value={financeCategory}
                                onChange={(e) => setFinanceCategory(e.target.value)}
                                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:border-amber-500 cursor-pointer text-slate-800 dark:text-slate-200"
                              >
                                <option value="Bütçe Aktarımı">Bütçe Aktarımı</option>
                                <option value="Banka Kredisi">Banka Kredisi</option>
                                <option value="Ortak Sermaye">Ortak Sermaye</option>
                                <option value="Yedek Akçe">Yedek Akçe</option>
                                <option value="Müşteri Hak Edişi">Müşteri Hak Edişi</option>
                                <option value="Diğer">Diğer</option>
                              </select>
                            ) : (
                              <select
                                value={financeCategory}
                                onChange={(e) => setFinanceCategory(e.target.value)}
                                className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:border-amber-500 cursor-pointer text-slate-800 dark:text-slate-200"
                              >
                                <option value="Kaba İnşaat Malzemesi">Kaba İnşaat Malzemesi</option>
                                <option value="Tesisat & Altyapı">Tesisat & Altyapı</option>
                                <option value="Usta İşçilik & Hizmet">Usta İşçilik & Hizmet</option>
                                <option value="Taşıma & Nakliye & Moloz">Taşıma & Nakliye & Moloz</option>
                                <option value="Aydınlatma & Aksesuar">Aydınlatma & Aksesuar</option>
                                <option value="Mobilya & Dolap Kapakları">Mobilya & Dolap Kapakları</option>
                                <option value="Ruhsat & Belediye & Harç">Ruhsat & Belediye & Harç</option>
                                <option value="Diğer Giderler">Diğer Giderler</option>
                              </select>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase">Ödeme Kanalı</label>
                            <select
                              value={financePaymentMethod}
                              onChange={(e) => setFinancePaymentMethod(e.target.value as any)}
                              className="w-full text-xs px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:border-amber-500 cursor-pointer text-slate-800 dark:text-slate-200"
                            >
                              <option value="cash">Elden / Nakit</option>
                              <option value="card">Kredi Kartı</option>
                              <option value="bank_transfer">Banka Havalesi / EFT</option>
                              <option value="debt">Açık Hesap / Veresiye</option>
                            </select>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setIsTaskModalOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    Vazgeç
                  </button>
                  <button 
                    type="submit" 
                    id="task-modal-submit-btn"
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-850 shadow-md transition-colors cursor-pointer"
                  >
                    {editingTask ? 'Güncelle' : 'Kaydet'}
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
                  <h3 className="text-base font-bold text-slate-900">
                    {deleteConfirmInfo.type === 'project' ? 'Projeyi Sil' : 'Görevi Sil'}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {deleteConfirmInfo.type === 'project' 
                      ? `"${deleteConfirmInfo.title}" projesini silmek istediğinize emin misiniz? Projeye bağlı tüm görevler silinecektir. Bu işlem geri alınamaz.`
                      : `"${deleteConfirmInfo.title}" görevini kaldırmak istediğinize emin misiniz? Bu işlem geri alınamaz.`
                    }
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
                  id="confirm-delete-action-btn"
                  onClick={() => {
                    if (deleteConfirmInfo.type === 'project') {
                      onDeleteProject(deleteConfirmInfo.id);
                    } else {
                      onDeleteTask(deleteConfirmInfo.id);
                    }
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

// Sub Component for Kanban Tasks cards inside columns
interface TaskCardProps {
  key?: React.Key;
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onShiftStatus?: (t: Task) => void;
  onShiftStatusBack?: (t: Task) => void;
  badgeClass: (p: TaskPriority) => string;
  priorityLabel: (p: TaskPriority) => string;
  isCompleted?: boolean;
  nextStatusLabel?: string;
  lang?: 'tr' | 'en';
}

function TaskCard({
  task,
  onEdit,
  onDelete,
  onShiftStatus,
  onShiftStatusBack,
  badgeClass,
  priorityLabel,
  isCompleted = false,
  nextStatusLabel,
  lang = 'tr'
}: TaskCardProps) {
  return (
    <div className={`p-4 rounded-xl border bg-white shadow-xs hover:shadow-md transition-all space-y-3 relative group overflow-hidden ${
      isCompleted ? 'border-slate-150 bg-slate-50/40 opacity-80' : 'border-slate-100'
    }`}>
      <div className="space-y-1.5 pl-1">
        <div className="flex justify-between items-start gap-1">
          <span className={`text-[9px] font-bold border rounded-full px-2 py-0.5 ${badgeClass(task.priority)}`}>
            {priorityLabel(task.priority)}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
            <button 
              id={`task-card-edit-btn-${task.id}`}
              onClick={() => onEdit(task)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition-colors cursor-pointer"
              title="Görevi Düzenle"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
             <button 
              id={`task-card-delete-btn-${task.id}`}
              onClick={() => onDelete(task.id)}
              className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-650 transition-colors cursor-pointer"
              title="Görevi Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <h5 className={`font-semibold text-slate-800 text-sm ${isCompleted ? 'line-through text-slate-450' : ''}`}>
          {task.title}
        </h5>
        
        {task.description && (
          <p className="text-slate-500 text-xs line-clamp-2">{task.description}</p>
        )}
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span className="flex items-center gap-1 font-mono text-[10px]">
          <Calendar className="w-3.5 h-3.5 text-slate-450" /> {formatDate(task.dueDate, lang)}
        </span>
        {task.assignedTo && (
          <span className="font-semibold text-slate-650 flex items-center gap-0.5 truncate max-w-[120px]" title={task.assignedTo}>
            <User className="w-3 h-3 text-slate-400" /> {task.assignedTo}
          </span>
        )}
      </div>

      {/* Manual Status shifts button helper for seamless tracking */}
      <div className="flex gap-1.5 pt-1">
        {onShiftStatusBack && (
          <button 
            id={`task-card-shift-back-${task.id}`}
            onClick={() => onShiftStatusBack(task)}
            className="flex-1 text-center py-1 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold rounded-lg text-slate-600 cursor-pointer"
          >
            ← Geri Al
          </button>
        )}
        {onShiftStatus && (
          <button
            id={`task-card-shift-${task.id}`}
            onClick={() => onShiftStatus(task)}
            className="flex-1 inline-flex items-center justify-center gap-1 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/50 text-[10px] font-extrabold rounded-lg cursor-pointer transition-colors"
            title={nextStatusLabel}
          >
            <Check className="w-3 h-3 text-amber-700" /> {task.status === 'todo' ? 'Başlat →' : 'Tamamla ✓'}
          </button>
        )}
      </div>
    </div>
  );
}
