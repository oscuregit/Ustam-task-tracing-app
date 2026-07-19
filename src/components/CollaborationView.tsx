import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Shield, 
  Mail, 
  FolderLock, 
  Eye, 
  Edit3, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Briefcase,
  ChevronRight,
  ChevronDown,
  EyeOff,
  Settings as SettingsIcon,
  Sparkles,
  Info
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Project, Collaborator, AppSettings, CollaboratorPermissions, PermissionLevel } from '../types';
import { formatDate, getCollaboratorPermissions } from '../utils';

interface CollaborationViewProps {
  userUid: string;
  userEmail: string;
  projects: Project[];
  collaborations: Collaborator[]; // Collaborations where user is the owner or the collaborator
  settings: AppSettings;
}

export default function CollaborationView({
  userUid,
  userEmail,
  projects,
  collaborations,
  settings
}: CollaborationViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<'admin' | 'editor' | 'viewer' | 'custom'>('editor');
  const [editingCollabId, setEditingCollabId] = useState<string | null>(null);

  // Advanced section permissions
  const [permProjectDetails, setPermProjectDetails] = useState<PermissionLevel>('view');
  const [permTasks, setPermTasks] = useState<PermissionLevel>('edit');
  const [permBudget, setPermBudget] = useState<PermissionLevel>('edit');
  const [permAccounting, setPermAccounting] = useState<PermissionLevel>('view');

  // Collapsible headers state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    projectDetails: true,
    tasks: false,
    budget: false,
    accounting: false
  });

  const t = (en: string, tr: string, pl: string) => {
    if (settings.lang === 'tr') return tr;
    if (settings.lang === 'pl') return pl;
    return en;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Sync role selection with predefined permission matrices
  const selectRoleAndFillPermissions = (role: 'admin' | 'editor' | 'viewer' | 'custom') => {
    setCollabRole(role);
    if (role === 'admin') {
      setPermProjectDetails('full');
      setPermTasks('full');
      setPermBudget('full');
      setPermAccounting('full');
    } else if (role === 'editor') {
      setPermProjectDetails('view');
      setPermTasks('edit');
      setPermBudget('edit');
      setPermAccounting('view');
    } else if (role === 'viewer') {
      setPermProjectDetails('view');
      setPermTasks('view');
      setPermBudget('view');
      setPermAccounting('view');
    }
  };

  const handlePermissionChange = (field: keyof CollaboratorPermissions, value: PermissionLevel) => {
    setCollabRole('custom');
    if (field === 'projectDetails') setPermProjectDetails(value);
    if (field === 'tasks') setPermTasks(value);
    if (field === 'budget') setPermBudget(value);
    if (field === 'accounting') setPermAccounting(value);
  };

  // Divide collaborations into:
  // 1. Shares I created (My Projects shared with others)
  const sharesICreated = useMemo(() => {
    return collaborations.filter(c => c.ownerId === userUid);
  }, [collaborations, userUid]);

  // 2. Shares shared with me (Projects shared by others to my email)
  const sharesWithMe = useMemo(() => {
    return collaborations.filter(c => c.userEmail.toLowerCase().trim() === userEmail.toLowerCase().trim());
  }, [collaborations, userEmail]);

  // Only allow sharing projects that the user owns (not projects shared with them)
  const myProjects = useMemo(() => {
    const sharedProjectIds = new Set(sharesWithMe.map(s => s.projectId));
    return projects.filter(p => !sharedProjectIds.has(p.id));
  }, [projects, sharesWithMe]);

  const handleOpenAddModal = () => {
    setEditingCollabId(null);
    if (myProjects.length > 0) {
      setSelectedProjectId(myProjects[0].id);
    } else {
      setSelectedProjectId('');
    }
    setCollabEmail('');
    selectRoleAndFillPermissions('editor');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (share: Collaborator) => {
    setEditingCollabId(share.id);
    setSelectedProjectId(share.projectId);
    setCollabEmail(share.userEmail);
    setCollabRole(share.role);

    const perms = getCollaboratorPermissions(share, false);
    setPermProjectDetails(perms.projectDetails);
    setPermTasks(perms.tasks);
    setPermBudget(perms.budget);
    setPermAccounting(perms.accounting);

    setIsModalOpen(true);
  };

  const handleSaveCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !collabEmail.trim()) return;

    const emailClean = collabEmail.trim().toLowerCase();
    if (emailClean === userEmail.toLowerCase() && !editingCollabId) {
      alert(t('You cannot share a project with yourself!', 'Bir projeyi kendinizle paylaşamazsınız!', 'Nie możesz udostępnić projektu samemu sobie!'));
      return;
    }

    try {
      const selectedProj = projects.find(p => p.id === selectedProjectId);
      const projName = selectedProj ? selectedProj.name : '';
      
      // Document ID is "projectId_userEmail"
      const collaboratorId = editingCollabId || `${selectedProjectId}_${emailClean}`;
      const collaboratorData: Collaborator = {
        id: collaboratorId,
        projectId: selectedProjectId,
        projectName: projName,
        ownerId: userUid,
        userEmail: emailClean,
        role: collabRole,
        createdAt: editingCollabId ? (collaborations.find(c => c.id === editingCollabId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
        permissions: {
          projectDetails: permProjectDetails,
          tasks: permTasks,
          budget: permBudget,
          accounting: permAccounting
        }
      };

      await setDoc(doc(db, 'collaborators', collaboratorId), collaboratorData);
      
      // Reset
      setIsModalOpen(false);
      setEditingCollabId(null);
      setCollabEmail('');
      selectRoleAndFillPermissions('editor');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'add_collaborator');
    }
  };

  const handleRevokeShare = async (id: string) => {
    if (confirm(t('Are you sure you want to revoke access for this user?', 'Bu kullanıcının erişim yetkisini iptal etmek istediğinizden emin misiniz?', 'Czy na pewno chcesz cofnąć dostęp dla tego użytkownika?'))) {
      try {
        await deleteDoc(doc(db, 'collaborators', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `collaborators/${id}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="text-amber-500 w-7 h-7" />
            {t('Authorization & Shared Projects', 'Proje Yetkilendirme', 'Upoważnienia i Współpraca')}
          </h1>
          <p className="text-sm text-slate-500">
            {t('Grant access to other contractors, foreman, or clients to view, edit or manage your renovation projects.', 'Diğer ustaları, şantiye sorumlularını veya müşterileri projelerinize dahil edin ve yetkilerini yönetin.', 'Przyznaj dostęp innym wykonawcom, rzemieślnikom lub klientom, aby mogli przeglądać, edytować lub zarządzać projektami.')}
          </p>
        </div>

        {myProjects.length > 0 && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-2xs hover:shadow-sm cursor-pointer text-sm"
          >
            <Plus className="w-5 h-5" />
            {t('Authorize Collaborator', 'Ortak / Usta Yetkilendir', 'Dodaj Współpracownika')}
          </button>
        )}
      </div>

      {/* Role Explainer Info Card */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="flex gap-2.5 items-start">
          <Shield className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-slate-700">Admin</h4>
            <p className="text-slate-500 mt-0.5">
              {t('Full read and write permissions. Can edit everything including details, tasks, ledger items, and project budget.', 'Tam okuma ve yazma yetkisi. Proje detayları, görevler, malzemeler ve muhasebe kayıtları dahil her şeyi düzenleyebilir.', 'Pełne uprawnienia do odczytu i zapisu. Może edytować wszystko, w tym szczegóły projektu, zadania, budżet.')}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 items-start">
          <Edit3 className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-slate-700">Editor ({t('Foreman / Assistant', 'Usta / Kalfa', 'Edytor')})</h4>
            <p className="text-slate-500 mt-0.5">
              {t('Can read everything and add/edit tasks, materials, and time logs. Cannot alter the core project budget or settings.', 'Görevleri, malzemeleri ve zaman çizelgelerini okuyabilir, ekleyebilir veya düzenleyebilir. Ana bütçeyi değiştiremez.', 'Może przeglądać wszystko oraz dodawać/edytować zadania i materiały. Nie może modyfikować głównego budżetu.')}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 items-start">
          <Eye className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-slate-700">Viewer ({t('Client / Tenant', 'Müşteri / Malik', 'Widz')})</h4>
            <p className="text-slate-500 mt-0.5">
              {t('Read-only access. Perfect for allowing homeowners to watch the progress, daily logs, and task statuses live.', 'Sadece okuma yetkisi. Müşterilerin inşaatın ilerlemesini, günlük işleri ve malzeme listelerini izlemesi için idealdir.', 'Dostęp tylko do odczytu. Idealny dla klienta, aby mógł na bieżąco śledzić postępy prac i statusy zadań.')}
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout: Shares list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Card: Projects I Shared (My Shares) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
            <FolderLock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">
              {t('My Shared Projects', 'Yetki Verdiğim Ortaklar', 'Moje Udostępnione Projekty')}
            </h3>
            <span className="bg-slate-100 text-slate-650 font-mono text-xs px-2 py-0.5 rounded-full font-bold ml-auto">
              {sharesICreated.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {sharesICreated.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <Users className="w-8 h-8 mx-auto text-slate-300" />
                <p>{t('You have not shared any projects yet.', 'Henüz hiçbir projede yetkilendirme yapmadınız.', 'Nie udostępniłeś jeszcze żadnych projektów.')}</p>
              </div>
            ) : (
              sharesICreated.map(share => (
                <div key={share.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-center text-xs">
                  <div className="space-y-1.5 min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 truncate flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-slate-450" />
                      {share.projectName}
                    </p>
                    <p className="text-[11px] text-slate-550 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {share.userEmail}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {t('Authorized:', 'Yetkilendirildi:', 'Dodano:')} {formatDate(share.createdAt, settings)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-sm font-bold uppercase text-[9px] ${
                      share.role === 'admin' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                      share.role === 'editor' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      share.role === 'custom' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                      'bg-blue-50 text-blue-600 border border-blue-100'
                    }`}>
                      {share.role === 'custom' ? t('Custom', 'Özel Yetki', 'Własne') : share.role}
                    </span>
                    <button
                      onClick={() => handleOpenEditModal(share)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                      title={t('Edit Permissions', 'Yetkileri Düzenle', 'Edytuj Uprawnienia')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRevokeShare(share.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title={t('Revoke Access', 'Yetkiyi İptal Et', 'Cofnij Dostęp')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Card: Projects Shared With Me */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-150">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-sm">
              {t('Shared With Me', 'Dahil Olduğum Ortak Projeler', 'Udostępnione Dla Mnie')}
            </h3>
            <span className="bg-slate-100 text-slate-650 font-mono text-xs px-2 py-0.5 rounded-full font-bold ml-auto">
              {sharesWithMe.length}
            </span>
          </div>

          <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1">
            {sharesWithMe.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                <FolderLock className="w-8 h-8 mx-auto text-slate-300" />
                <p>{t('No projects have been shared with you yet.', 'Henüz sizinle paylaşılmış bir ortak proje bulunmamaktadır.', 'Żaden projekt nie został jeszcze dla Ciebie udostępniony.')}</p>
              </div>
            ) : (
              sharesWithMe.map(share => (
                <div key={share.id} className="p-4 border border-slate-100 rounded-xl bg-slate-50/55 hover:bg-slate-50 transition-colors flex justify-between items-center text-xs">
                  <div className="space-y-1.5 min-w-0 pr-2">
                    <p className="font-semibold text-slate-800 truncate flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-amber-500" />
                      {share.projectName}
                    </p>
                    <p className="text-[10px] text-slate-450">
                      {t('Shared by Account ID:', 'Paylaşan Hesap ID:', 'Udostępnił:')} <span className="font-mono">{share.ownerId}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {t('Shared on:', 'Paylaşım Tarihi:', 'Udostępniono:')} {formatDate(share.createdAt, settings)}
                    </p>
                  </div>

                  <span className={`px-2 py-0.5 rounded-sm font-bold uppercase text-[9px] ${
                    share.role === 'admin' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                    share.role === 'editor' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    share.role === 'custom' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                    'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {share.role === 'custom' ? t('Custom', 'Özel Yetki', 'Własne') : share.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Share / Authorization Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs" onClick={() => setIsModalOpen(false)} />
          
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg w-full relative z-10 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-md font-bold text-slate-900">
                {editingCollabId 
                  ? t('Edit Collaborator Permissions', 'Ortak Yetkilerini Düzenle', 'Edytuj Uprawnienia Współpracownika')
                  : t('Authorize Access to Project', 'Yeni İş Ortağı Yetkilendir', 'Upoważnij do Projektu')
                }
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <Plus className="w-5 h-5 transform rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSaveCollaborator} className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Select Project */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Select Project *', 'Paylaşılacak Proje *', 'Wybierz Projekt *')}
                </label>
                <select
                  required
                  disabled={!!editingCollabId}
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {myProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  {editingCollabId && (
                    <option value={selectedProjectId}>
                      {collaborations.find(c => c.id === editingCollabId)?.projectName || selectedProjectId}
                    </option>
                  )}
                </select>
              </div>

              {/* Collaborator Email */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Collaborator Email Address *', 'İş Ortağının E-posta Adresi *', 'Adres E-mail Współpracownika *')}
                </label>
                <input
                  type="email"
                  required
                  disabled={!!editingCollabId}
                  value={collabEmail}
                  onChange={e => setCollabEmail(e.target.value)}
                  placeholder="e.g. usta@gmail.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-1 focus:ring-amber-500 disabled:bg-slate-50 disabled:text-slate-500"
                />
                {!editingCollabId && (
                  <span className="text-[10px] text-slate-400 block pt-0.5">
                    {t('The user must log in using this email address to see this project.', 'Kullanıcı bu projeyi görebilmek için bu e-posta adresi ile giriş yapmalıdır.', 'Współpracownik musi zalogować się tym e-mailem, aby zobaczyć projekt.')}
                  </span>
                )}
              </div>

              {/* Collaborator Role */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Access Role *', 'Erişim Yetki Derecesi *', 'Poziom Uprawnień *')}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['viewer', 'editor', 'admin', 'custom'] as const).map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => selectRoleAndFillPermissions(role)}
                      className={`py-2 px-1 text-[10px] font-bold rounded-lg border uppercase transition-all cursor-pointer truncate ${
                        collabRole === role 
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500' 
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {role === 'custom' ? t('Custom', 'Özel', 'Własne') : role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customizable Permissions Accordion List */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  {t('Detailed Section Permissions', 'Bölüm Yetki Detayları', 'Szczegółowe Uprawnienia Sekcji')}
                </label>
                
                {[
                  {
                    key: 'projectDetails' as const,
                    title: t('Project Details & Core Info', 'Proje Bilgileri & Detaylar', 'Szczegóły Projektu'),
                    desc: t('Name, dates, descriptions, settings & project status', 'Proje adı, bütçesi, tarihleri ve gidişatı', 'Nazwa projektu, budżet, daty, status'),
                    state: permProjectDetails
                  },
                  {
                    key: 'tasks' as const,
                    title: t('Tasks & Milestones', 'Şantiye İşleri & Günlük Rapor', 'Zadania i etapy'),
                    desc: t('Adding, editing and deleting renovation tasks', 'Yapılacak işler listesi ve günlük iş takipleri', 'Zadania remontowe, postęp i statusy'),
                    state: permTasks
                  },
                  {
                    key: 'budget' as const,
                    title: t('Materials & Budget', 'Malzemeler & Sipariş Listeleri', 'Materiały i budżet'),
                    desc: t('Unit prices, material costs and planning', 'Malzeme listeleri, birim fiyatlar ve satın alma', 'Lista materiałów, planowanie, koszty'),
                    state: permBudget
                  },
                  {
                    key: 'accounting' as const,
                    title: t('Accounting & Financial Ledger', 'Muhasebe Defteri & Kasalar', 'Księga Rachunkowa'),
                    desc: t('Ledger records, cash registry, payments & income', 'Para giriş çıkışları, kasa defteri ve ödemeler', 'Transakcje finansowe, płatności, dochody'),
                    state: permAccounting
                  }
                ].map(sec => {
                  const isExpanded = expandedSections[sec.key];
                  
                  const getLevelLabel = (level: PermissionLevel) => {
                    switch (level) {
                      case 'full': return t('Full Access', 'Tam Yetki', 'Pełny');
                      case 'edit': return t('Edit', 'Düzenleme', 'Edycja');
                      case 'view': return t('View Only', 'Görüntüleme', 'Podgląd');
                      case 'hide': return t('Hidden', 'Gizle', 'Ukryte');
                    }
                  };

                  const getLevelColor = (level: PermissionLevel) => {
                    switch (level) {
                      case 'full': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
                      case 'edit': return 'text-indigo-600 bg-indigo-50 border-indigo-100';
                      case 'view': return 'text-blue-600 bg-blue-50 border-blue-100';
                      case 'hide': return 'text-slate-500 bg-slate-50 border-slate-100';
                    }
                  };

                  return (
                    <div key={sec.key} className="border border-slate-250/70 rounded-xl overflow-hidden bg-white shadow-2xs">
                      {/* Header */}
                      <button
                        type="button"
                        onClick={() => toggleSection(sec.key)}
                        className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-800">{sec.title}</p>
                            <p className="text-[10px] text-slate-400 font-normal truncate">{sec.desc}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-sm font-bold uppercase text-[8px] border flex-shrink-0 ${getLevelColor(sec.state)}`}>
                          {getLevelLabel(sec.state)}
                        </span>
                      </button>

                      {/* Body */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-50/80 border-t border-slate-100 grid grid-cols-2 gap-2">
                          {(['full', 'edit', 'view', 'hide'] as const).map(level => {
                            const isSelected = sec.state === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() => handlePermissionChange(sec.key, level)}
                                className={`p-2 rounded-lg border text-left text-[11px] transition-all flex flex-col justify-between h-14 ${
                                  isSelected 
                                    ? 'bg-white border-amber-500 shadow-2xs ring-2 ring-amber-500/10 text-slate-900 font-medium' 
                                    : 'bg-white border-slate-200 hover:bg-white text-slate-500'
                                }`}
                              >
                                <span className={`font-bold block text-xs ${isSelected ? 'text-amber-600' : 'text-slate-700'}`}>
                                  {getLevelLabel(level)}
                                </span>
                                <span className="text-[9px] text-slate-400 block truncate leading-tight w-full">
                                  {level === 'full' && t('View, edit & delete', 'Görüntüle, düzenle, sil', 'Podgląd, edycja i usuwanie')}
                                  {level === 'edit' && t('View & edit (no delete)', 'Görüntüle ve düzenle', 'Podgląd i edycja')}
                                  {level === 'view' && t('View only (read-only)', 'Sadece görüntüle', 'Tylko podgląd')}
                                  {level === 'hide' && t('Cannot view or access', 'Girişi tamamen gizle', 'Całkowicie ukryj')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {t('Cancel', 'Vazgeç', 'Anuluj')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  {editingCollabId ? t('Update', 'Güncelle', 'Aktualizuj') : t('Authorize', 'Yetkilendir', 'Upoważnij')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
