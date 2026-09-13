import React, { useState, useMemo, useEffect } from 'react';
import { Project, Task, Material, MaterialCategory, AppSettings, Proposal, ProposalTask, ProposalMaterial, Customer } from '../types';
import { formatMoney, translateCategory } from '../utils';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Printer, 
  ArrowRight, 
  DollarSign, 
  Calendar, 
  Building2, 
  Briefcase, 
  Search, 
  X, 
  ClipboardList, 
  Check, 
  AlertTriangle,
  ShoppingBag,
  Phone,
  Mail,
  MapPin,
  User,
  Info,
  Pencil
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, where } from 'firebase/firestore';

interface ProposalsViewProps {
  userUid: string;
  userProfile: any;
  projects: Project[];
  tasks: Task[];
  materials: Material[];
  settings: AppSettings;
  onNavigate: (tab: string, pid?: string) => void;
  customers?: Customer[];
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

export default function ProposalsView({
  userUid,
  userProfile,
  projects,
  tasks,
  materials,
  settings,
  onNavigate,
  customers
}: ProposalsViewProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState<string | null>(null);

  const [clientName, setClientName] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientClientId, setClientClientId] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [pricingType, setPricingType] = useState<'project' | 'itemized'>('project');
  const [laborPrice, setLaborPrice] = useState<number>(0);
  const [totalProjectPrice, setTotalProjectPrice] = useState<number>(0);
  const [autoIncludeMaterials, setAutoIncludeMaterials] = useState<boolean>(true);
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<Proposal['status']>('draft');

  // Multi-item form sub-states
  const [proposalTasks, setProposalTasks] = useState<ProposalTask[]>([]);
  const [proposalMaterials, setProposalMaterials] = useState<ProposalMaterial[]>([]);

  // Task inline insert states
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDuration, setNewTaskDuration] = useState(3);
  const [newTaskPrice, setNewTaskPrice] = useState(0);

  // Task inline editing states
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskDuration, setEditTaskDuration] = useState(1);
  const [editTaskPrice, setEditTaskPrice] = useState(0);

  // Material inline insert states
  const [newMatTitle, setNewMatTitle] = useState('');
  const [newMatCategory, setNewMatCategory] = useState<MaterialCategory>('Kaba İnşaat');
  const [newMatQuantity, setNewMatQuantity] = useState(1);
  const [newMatUnit, setNewMatUnit] = useState('adet');
  const [newMatUnitPrice, setNewMatUnitPrice] = useState(0);

  // Material inline editing states
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMatTitle, setEditMatTitle] = useState('');
  const [editMatCategory, setEditMatCategory] = useState<MaterialCategory>('Kaba İnşaat');
  const [editMatQuantity, setEditMatQuantity] = useState(1);
  const [editMatUnit, setEditMatUnit] = useState('adet');
  const [editMatUnitPrice, setEditMatUnitPrice] = useState(0);

  // Listing states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Preview / Presentation template modal
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);

  // State for customized confirmation popups in iframe
  const [proposalToConvert, setProposalToConvert] = useState<Proposal | null>(null);
  const [proposalToDelete, setProposalToDelete] = useState<string | null>(null);

  // Multi-lingual Helper
  const t = (en: string, tr: string, pl: string) => {
    if (settings.lang === 'tr') return tr;
    if (settings.lang === 'pl') return pl;
    return en;
  };

  // Helper to extract all registered customer data (phone, email, address, notes, company)
  const getProposalCustomerDetails = (p: Proposal) => {
    let matchedCustomer: Customer | undefined;
    if (p.clientId && customers && customers.length > 0) {
      matchedCustomer = customers.find(c => c.id === p.clientId);
    }
    if (!matchedCustomer && p.clientName && customers && customers.length > 0) {
      const cleanName = p.clientName.trim().toLowerCase();
      matchedCustomer = customers.find(c => c.name.trim().toLowerCase() === cleanName);
    }

    return {
      name: p.clientName || matchedCustomer?.name || '',
      company: p.clientCompany || matchedCustomer?.company || '',
      phone: p.clientPhone || matchedCustomer?.phone || '',
      email: p.clientEmail || matchedCustomer?.email || '',
      address: p.clientAddress || matchedCustomer?.address || '',
      notes: p.clientNotes || matchedCustomer?.notes || '',
      matchedCustomer,
      isRegistered: !!matchedCustomer
    };
  };

  // Real-time proposals stream subscription
  useEffect(() => {
    if (!userUid) return;
    const qProposals = query(collection(db, 'proposals'), where('userId', '==', userUid));
    const unsubscribe = onSnapshot(qProposals, (snapshot) => {
      const list: Proposal[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as Proposal);
      });
      // Sort recently created first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProposals(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'proposals');
    });

    return () => unsubscribe();
  }, [userUid]);

  // Handle opening editor for creation
  const handleOpenCreate = () => {
    setEditorId(null);
    setClientName('');
    setClientCompany('');
    setClientClientId('');
    setClientPhone('');
    setClientEmail('');
    setClientAddress('');
    setClientNotes('');
    setProjectName('');
    setProjectDescription('');
    setPricingType('project');
    setLaborPrice(0);
    setTotalProjectPrice(0);
    setAutoIncludeMaterials(true);
    // Draft absolute default limit: 30 days from now
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + 30);
    setValidUntil(limitDate.toISOString().split('T')[0]);
    setNotes('');
    setStatus('draft');
    setProposalTasks([]);
    setProposalMaterials([]);
    setEditingTaskId(null);
    setEditingMaterialId(null);
    setIsEditorOpen(true);
  };

  // Handle opening editor for edit mode
  const handleOpenEdit = (p: Proposal) => {
    setEditorId(p.id);
    setEditingTaskId(null);
    setEditingMaterialId(null);
    const custInfo = getProposalCustomerDetails(p);
    setClientName(p.clientName);
    setClientCompany(p.clientCompany || custInfo.company || '');
    setClientClientId(p.clientId || custInfo.matchedCustomer?.id || '');
    setClientPhone(p.clientPhone || custInfo.phone || '');
    setClientEmail(p.clientEmail || custInfo.email || '');
    setClientAddress(p.clientAddress || custInfo.address || '');
    setClientNotes(p.clientNotes || custInfo.notes || '');
    setProjectName(p.projectName);
    setProjectDescription(p.projectDescription || '');
    setPricingType(p.pricingType);
    
    const matSum = (p.materials || []).reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.unitPrice) || 0)), 0);
    const tasksSum = (p.tasks || []).reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    const shouldInclude = p.autoIncludeMaterials !== false;
    setAutoIncludeMaterials(shouldInclude);

    if (p.laborPrice !== undefined) {
      setLaborPrice(p.laborPrice);
    } else {
      if (p.pricingType === 'project') {
        setLaborPrice(p.totalProjectPrice > matSum ? p.totalProjectPrice - matSum : p.totalProjectPrice);
      } else {
        setLaborPrice(tasksSum);
      }
    }
    setTotalProjectPrice(p.totalProjectPrice || 0);
    setValidUntil(p.validUntil);
    setNotes(p.notes || '');
    setStatus(p.status);
    setProposalTasks(p.tasks || []);
    setProposalMaterials(p.materials || []);
    setIsEditorOpen(true);
  };

  // Inline ADD task to local draft state
  const handleAddLocalTask = () => {
    if (!newTaskTitle.trim()) return;
    const item: ProposalTask = {
      id: `task-local-${Date.now()}`,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      durationDays: Number(newTaskDuration) || 1,
      price: pricingType === 'itemized' ? Number(newTaskPrice) || 0 : 0
    };
    setProposalTasks([...proposalTasks, item]);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDuration(3);
    setNewTaskPrice(0);
  };

  // Start editing existing task item
  const handleStartEditTask = (tk: ProposalTask) => {
    setEditingTaskId(tk.id);
    setEditTaskTitle(tk.title);
    setEditTaskDesc(tk.description || '');
    setEditTaskDuration(tk.durationDays || 1);
    setEditTaskPrice(tk.price || 0);
  };

  // Cancel editing task item
  const handleCancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditTaskDesc('');
    setEditTaskDuration(1);
    setEditTaskPrice(0);
  };

  // Save changes to existing task item
  const handleSaveEditTask = () => {
    if (!editingTaskId) return;
    if (!editTaskTitle.trim()) {
      alert(t('Please enter a task title.', 'Lütfen görev başlığı girin.', 'Proszę podać tytuł zadania.'));
      return;
    }

    setProposalTasks(prevTasks => prevTasks.map(tk => {
      if (tk.id === editingTaskId) {
        return {
          ...tk,
          title: editTaskTitle.trim(),
          description: editTaskDesc.trim(),
          durationDays: Math.max(1, Number(editTaskDuration) || 1),
          price: pricingType === 'itemized' ? Math.max(0, Number(editTaskPrice) || 0) : 0
        };
      }
      return tk;
    }));

    handleCancelEditTask();
  };

  // Inline DELETE task from local draft state
  const handleRemoveLocalTask = (id: string) => {
    if (editingTaskId === id) {
      handleCancelEditTask();
    }
    setProposalTasks(proposalTasks.filter(item => item.id !== id));
  };

  // Inline ADD material to local draft state
  const handleAddLocalMaterial = () => {
    if (!newMatTitle.trim()) return;
    const item: ProposalMaterial = {
      id: `mat-local-${Date.now()}`,
      title: newMatTitle.trim(),
      category: newMatCategory,
      quantity: Number(newMatQuantity) || 1,
      unit: newMatUnit.trim() || 'adet',
      unitPrice: Number(newMatUnitPrice) || 0
    };
    setProposalMaterials([...proposalMaterials, item]);
    setNewMatTitle('');
    setNewMatQuantity(1);
    setNewMatUnitPrice(0);
  };

  // Start editing existing material item
  const handleStartEditMaterial = (mat: ProposalMaterial) => {
    setEditingMaterialId(mat.id);
    setEditMatTitle(mat.title);
    setEditMatCategory(mat.category);
    setEditMatQuantity(mat.quantity || 1);
    setEditMatUnit(mat.unit || 'adet');
    setEditMatUnitPrice(mat.unitPrice || 0);
  };

  // Cancel editing material item
  const handleCancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditMatTitle('');
    setEditMatCategory('Kaba İnşaat');
    setEditMatQuantity(1);
    setEditMatUnit('adet');
    setEditMatUnitPrice(0);
  };

  // Save changes to existing material item
  const handleSaveEditMaterial = () => {
    if (!editingMaterialId) return;
    if (!editMatTitle.trim()) {
      alert(t('Please enter a material name.', 'Lütfen malzeme adı girin.', 'Proszę podać nazwę materiału.'));
      return;
    }

    setProposalMaterials(prevMaterials => prevMaterials.map(mat => {
      if (mat.id === editingMaterialId) {
        return {
          ...mat,
          title: editMatTitle.trim(),
          category: editMatCategory,
          quantity: Math.max(1, Number(editMatQuantity) || 1),
          unit: editMatUnit.trim() || 'adet',
          unitPrice: Math.max(0, Number(editMatUnitPrice) || 0)
        };
      }
      return mat;
    }));

    handleCancelEditMaterial();
  };

  // Inline DELETE material from local draft state
  const handleRemoveLocalMaterial = (id: string) => {
    if (editingMaterialId === id) {
      handleCancelEditMaterial();
    }
    setProposalMaterials(proposalMaterials.filter(item => item.id !== id));
  };

  // Save proposal to Firestore
  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !projectName.trim()) {
      alert(t('Please fill in required fields.', 'Lütfen zorunlu alanları doldurun.', 'Proszę wypełnić wymagane pola.'));
      return;
    }

    const nextId = editorId || `prop-${Date.now()}`;
    
    const matTotal = autoIncludeMaterials ? proposalMaterials.reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.unitPrice) || 0)), 0) : 0;
    const tasksTotal = proposalTasks.reduce((sum, current) => sum + (Number(current.price) || 0), 0);
    
    let finalProjectPrice = 0;
    let savedLaborPrice = 0;
    if (pricingType === 'itemized') {
      savedLaborPrice = tasksTotal;
      finalProjectPrice = tasksTotal + matTotal;
    } else {
      savedLaborPrice = Number(laborPrice) || 0;
      finalProjectPrice = savedLaborPrice + matTotal;
    }

    const payload: Proposal = {
      id: nextId,
      userId: userUid,
      clientName: clientName.trim(),
      clientCompany: clientCompany.trim() || undefined,
      clientId: clientClientId || undefined,
      clientPhone: clientPhone.trim() || undefined,
      clientEmail: clientEmail.trim() || undefined,
      clientAddress: clientAddress.trim() || undefined,
      clientNotes: clientNotes.trim() || undefined,
      projectName: projectName.trim(),
      projectDescription: projectDescription.trim() || '',
      pricingType,
      laborPrice: savedLaborPrice,
      autoIncludeMaterials,
      totalProjectPrice: finalProjectPrice,
      tasks: proposalTasks,
      materials: proposalMaterials,
      status,
      createdAt: editorId ? proposals.find(p => p.id === editorId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      validUntil,
      notes: notes.trim() || undefined,
      convertedToProjectId: editorId ? proposals.find(p => p.id === editorId)?.convertedToProjectId : undefined
    };

    try {
      await setDoc(doc(db, 'proposals', nextId), payload);
      setIsEditorOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `proposals/${nextId}`);
    }
  };

  // CUSTOM PRINT FUNCTION WITH A BEAUTIFULLY STYLED NEW TAB/WINDOW GENERATOR
  const handlePrint = () => {
    if (!previewProposal) return;
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        // Pop-up blocked, fallback to standard print
        window.print();
        return;
      }

      const clientInfo = getProposalCustomerDetails(previewProposal);
      
      const htmlContent = `
        <html>
          <head>
            <title>${previewProposal.projectName || 'Teklif'}</title>
            <style>
              body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; padding: 40px; line-height: 1.5; background: #ffffff; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
              .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0; }
              .subtitle { font-size: 14px; color: #64748b; margin: 5px 0 0 0; }
              .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
              .meta-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #f1f5f9; }
              .meta-label { font-size: 10px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 5px; }
              .meta-val { font-size: 13px; font-weight: 600; color: #334155; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 12px; font-weight: bold; color: #475569; border-bottom: 2px solid #cbd5e1; }
              td { padding: 12px 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .total-box { display: flex; flex-direction: column; align-items: flex-end; margin-top: 20px; }
              .total-row { display: flex; justify-content: space-between; width: 300px; padding: 5px 0; font-size: 13px; }
              .total-final { border-top: 2px solid #1e293b; padding-top: 10px; margin-top: 10px; font-size: 16px; font-weight: 800; }
              .footer-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; font-size: 12px; }
              .sig-line { border-top: 1px solid #cbd5e1; margin-top: 50px; padding-top: 10px; font-weight: bold; }
              .notes { font-size: 11px; color: #64748b; font-style: italic; max-width: 500px; margin-bottom: 30px; }
              @media print {
                body { padding: 20px; }
                @page { margin: 1.5cm; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="title">${userProfile?.company || 'Ustam Entegrasyon Proje'}</div>
                <div class="subtitle">${userProfile?.name || ''}</div>
              </div>
              <div class="text-right">
                <div style="font-size: 20px; font-weight: 800; color: #f59e0b;">${t('PROPOSAL', 'FİYAT TEKLİFİ', 'OFERTA')}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">No: ${previewProposal.id}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-box">
                <div class="meta-label">${t('Client Info', 'Alıcı Müşteri / Kurum Bilgileri', 'Dane Klienta')}</div>
                <div class="meta-val" style="font-size: 15px; color: #0f172a; margin-bottom: 4px;">${clientInfo.name}</div>
                ${clientInfo.company ? `<div style="font-size: 12px; color: #475569; font-weight: 600; margin-bottom: 6px;">${clientInfo.company}</div>` : ''}
                <div style="font-size: 11px; color: #64748b; line-height: 1.6; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                  ${clientInfo.phone ? `<div><strong style="color: #334155;">${t('Phone:', 'Telefon:', 'Tel:')}</strong> ${clientInfo.phone}</div>` : ''}
                  ${clientInfo.email ? `<div><strong style="color: #334155;">${t('Email:', 'E-posta:', 'Email:')}</strong> ${clientInfo.email}</div>` : ''}
                  ${clientInfo.address ? `<div><strong style="color: #334155;">${t('Client Address:', 'Müşteri Adresi:', 'Adres:')}</strong> ${clientInfo.address}</div>` : ''}
                  <div><strong style="color: #334155;">${t('Target Site:', 'Tadilat Şantiyesi:', 'Obiekt:')}</strong> ${previewProposal.projectName}</div>
                  ${clientInfo.notes ? `<div style="font-style: italic; color: #94a3b8; margin-top: 4px;"><strong>${t('Notes:', 'Müşteri Notu:', 'Uwagi:')}</strong> ${clientInfo.notes}</div>` : ''}
                </div>
              </div>
              <div class="meta-box">
                <div class="meta-label">${t('Proposal Details', 'Teklif Koşulları', 'Szczegóły oferty')}</div>
                <div class="meta-val">${t('Project name:', 'Proje Adı:', 'Nazwa projektu:')} ${previewProposal.projectName}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                  ${t('Created Date:', 'Teklif Tarihi:', 'Data utworzenia:')} ${previewProposal.createdAt ? new Date(previewProposal.createdAt).toLocaleDateString() : ''}
                </div>
                <div style="font-size: 12px; color: #64748b;">
                  ${t('Valid Until:', 'Geçerlilik Tarihi:', 'Ważne do:')} ${previewProposal.validUntil ? new Date(previewProposal.validUntil).toLocaleDateString() : ''}
                </div>
              </div>
            </div>

            ${previewProposal.projectDescription ? `
              <div style="margin-bottom: 30px;">
                <div class="meta-label">${t('Project Description', 'Proje Kapsamı / Açıklama', 'Opis projektu')}</div>
                <div style="font-size: 13px; color: #475569; white-space: pre-wrap; margin-top: 5px;">${previewProposal.projectDescription}</div>
              </div>
            ` : ''}

            <!-- Tasks -->
            ${previewProposal.tasks && previewProposal.tasks.length > 0 ? `
              <div class="meta-label" style="margin-bottom: 10px;">${t('Tasks & Milestones', 'Yapılacak İşler / İşçilik Listesi', 'Zadania i Etapy')}</div>
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>${t('Task / Job Title', 'İş Tanımı / Hizmet Başlığı', 'Zadanie')}</th>
                    <th class="text-center">${t('Duration', 'Planlanan Süre', 'Czas trwania')}</th>
                    ${previewProposal.pricingType === 'itemized' ? `<th class="text-right">${t('Price', 'Tutar', 'Cena')}</th>` : ''}
                  </tr>
                </thead>
                <tbody>
                  ${previewProposal.tasks.map((tk, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>
                        <div style="font-weight: bold; color: #1e293b;">${tk.title}</div>
                        ${tk.description ? `<div style="font-size: 11px; color: #64748b; margin-top: 3px;">${tk.description}</div>` : ''}
                      </td>
                      <td class="text-center">${tk.durationDays} ${t('Days', 'Gün', 'Dni')}</td>
                      ${previewProposal.pricingType === 'itemized' ? `<td class="text-right" style="font-weight: bold; font-family: monospace;">${formatMoney(tk.price, settings)}</td>` : ''}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <!-- Materials -->
            ${previewProposal.materials && previewProposal.materials.length > 0 ? `
              <div class="meta-label" style="margin-bottom: 10px;">${t('Required Materials Specification', 'Kapsama Dahil Malzemeler', 'Specyfikacja materiałów')}</div>
              <table>
                <thead>
                  <tr>
                    <th>${t('Material Name', 'Malzeme Tanımı', 'Materiał')}</th>
                    <th>${t('Category', 'Kategori', 'Kategoria')}</th>
                    <th class="text-center">${t('Qty', 'Miktar', 'Ilość')}</th>
                    <th class="text-right">${t('Unit Cost', 'Birim Fiyat', 'Cena jedn.')}</th>
                    <th class="text-right">${t('Subtotal', 'Bedel', 'Suma')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${previewProposal.materials.map((mat) => `
                    <tr>
                      <td style="font-weight: bold; color: #1e293b;">${mat.title}</td>
                      <td>${translateCategory(mat.category, settings.lang)}</td>
                      <td class="text-center">${mat.quantity} ${mat.unit}</td>
                      <td class="text-right" style="font-family: monospace;">${formatMoney(mat.unitPrice, settings)}</td>
                      <td class="text-right" style="font-weight: bold; font-family: monospace;">${formatMoney(mat.quantity * mat.unitPrice, settings)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : ''}

            <div class="notes">
              <div class="meta-label">${t('Payment Terms & Special Notes', 'Ödeme ve Sözleşme Notları', 'Uwagi i Warunki płatności')}</div>
              <div style="margin-top: 5px; color: #475569;">
                ${previewProposal.notes || t('Standard contract terms apply. Turnkey handover is subject to stage payments verification.', 'Standart tadilat sözleşmesi kuralları geçerlidir. Ödemelerin belirtilen vadelerde yapılması taahhüt edilir.', 'Obowiązują standardowe warunki umowy.')}
              </div>
            </div>

            <div class="total-box">
              ${(() => {
                const previewMaterialsCost = (previewProposal.materials || []).reduce((sum, m) => sum + ((m.quantity || 0) * (m.unitPrice || 0)), 0);
                const previewLaborCost = previewProposal.laborPrice !== undefined ? previewProposal.laborPrice : Math.max(0, (previewProposal.totalProjectPrice || 0) - previewMaterialsCost);
                if (previewMaterialsCost > 0) {
                  return `
                    <div class="total-row">
                      <span>${t('Labor & Works Total:', 'İşçilik ve Hizmet Bedeli:', 'Robocizna i usługi:')}</span>
                      <span style="font-family: monospace; font-weight: bold;">${formatMoney(previewLaborCost, settings)}</span>
                    </div>
                    <div class="total-row">
                      <span>${t('Materials & Allocation:', 'Malzeme ve Tedarik Bedeli:', 'Materiały i zaopatrzenie:')}</span>
                      <span style="font-family: monospace; font-weight: bold; color: #d97706;">${formatMoney(previewMaterialsCost, settings)}</span>
                    </div>
                  `;
                }
                return `
                  <div class="total-row">
                    <span>${t('Remodeling Base Total:', 'Teklif Temel Bedeli:', 'Wartość netto:')}</span>
                    <span style="font-family: monospace; font-weight: bold;">${formatMoney(previewProposal.totalProjectPrice || 0, settings)}</span>
                  </div>
                `;
              })()}
              <div class="total-row">
                <span>${t('VAT / KDV (0%):', 'KDV (%0):', 'Podatek VAT (%0):')}</span>
                <span style="font-family: monospace; color: #94a3b8;">${formatMoney(0, settings)}</span>
              </div>
              <div class="total-row total-final">
                <span>${t('Proposed Net Total:', 'Teklif Toplam Bedeli:', 'Suma Netto do zapłaty:')}</span>
                <span style="color: #f59e0b; font-family: monospace; font-weight: bold;">${formatMoney(previewProposal.totalProjectPrice || 0, settings)}</span>
              </div>
            </div>

            <div class="footer-sigs">
              <div>
                <div style="color: #94a3b8; font-style: italic; margin-bottom: 40px;">${t('Prepared by Consultant / Contractor', 'Teklifi Hazırlayan Yetkili', 'Przygotował')}</div>
                <div class="sig-line">${userProfile?.name || 'Ustam Contractor Signature'}</div>
              </div>
              <div>
                <div style="color: #94a3b8; font-style: italic; margin-bottom: 40px;">${t('Approved Sign of Client / Buyer', 'Tadilatı Onaylayan İşveren', 'Akceptacja Klienta')}</div>
                <div class="sig-line">${clientInfo.name} ${clientInfo.company ? `(${clientInfo.company})` : ''}</div>
              </div>
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    } catch (printErr) {
      console.error('Failed to open print tab, falling back to local print:', printErr);
      window.print();
    }
  };

  // Delete proposal wrapper
  const handleDeleteProposal = (id: string) => {
    setProposalToDelete(id);
  };

  // ACTUAL DELETE FUNCTION CALLED AFTER CUSTOM CONFIRMATION
  const executeDeleteProposal = async (id: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'proposals', id));
      setProposalToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `proposals/${id}`);
    }
  };

  // Convert proposal wrapper
  const handleConvertProposalToProject = (p: Proposal) => {
    // Allow re-instantiating projects from proposal even if they have been previously converted
    setProposalToConvert(p);
  };

  // ACTUAL CONVERT FUNCTION CALLED AFTER CUSTOM CONFIRMATION
  const executeConvertProposalToProject = async (p: Proposal) => {
    try {
      const generatedProjectId = `proj-${Date.now()}`;
      
      // 1. Create Project
      const newProject: Project = {
        id: generatedProjectId,
        name: p.projectName,
        description: `${p.projectDescription || ''}\n\n[${t('Generated from Proposal for', 'Müşteri teklifinden otomatik oluşturuldu:', 'Wygenerowano z oferty dla:')} ${p.clientName}]`,
        status: 'planning',
        startDate: new Date().toISOString().split('T')[0],
        targetDate: p.validUntil,
        allocatedBudget: p.totalProjectPrice,
        clientId: p.clientId,
        clientName: p.clientName
      };
      await setDoc(doc(db, 'projects', generatedProjectId), { ...newProject, userId: userUid });

      // 2. Add tasks in loop
      if (p.tasks && p.tasks.length > 0) {
        let cumulativeDays = 0;
        for (let idx = 0; idx < p.tasks.length; idx++) {
          const pt = p.tasks[idx];
          const taskId = `task-${Date.now()}-${idx}`;
          
          cumulativeDays += pt.durationDays;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + cumulativeDays);

          const newTask: Task = {
            id: taskId,
            projectId: generatedProjectId,
            userId: userUid,
            title: pt.title,
            description: pt.description || '',
            priority: 'medium',
            status: 'todo',
            dueDate: dueDate.toISOString().split('T')[0],
            assignedTo: p.clientName?.substring(0, 100) || undefined
          };
          await setDoc(doc(db, 'tasks', taskId), newTask);
        }
      }

      // 3. Add Materials in loop
      if (p.materials && p.materials.length > 0) {
        for (let idx = 0; idx < p.materials.length; idx++) {
          const pm = p.materials[idx];
          const materialId = `mat-${Date.now()}-${idx}`;

          const newMaterial: Material = {
            id: materialId,
            projectId: generatedProjectId,
            userId: userUid,
            title: pm.title,
            category: pm.category,
            vendor: (p.clientCompany || t('Specified in Quote', 'Teklifte Belirtildi', 'Określone w ofercie')).substring(0, 200),
            quantity: pm.quantity,
            unit: pm.unit,
            unitPrice: pm.unitPrice,
            totalPrice: pm.quantity * pm.unitPrice,
            status: 'planned',
            isPaid: false
          };
          await setDoc(doc(db, 'materials', materialId), newMaterial);
        }
      }

      // 4. Update Proposal with the link
      await setDoc(doc(db, 'proposals', p.id), {
        ...p,
        status: 'accepted',
        convertedToProjectId: generatedProjectId
      });

      setProposalToConvert(null);
      
      onNavigate('projects', generatedProjectId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `instantiate_project_from_proposal`);
    }
  };

  // Filtered Proposals
  const filteredProposals = useMemo(() => {
    return proposals.filter((p) => {
      const matchSearch = 
        p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.projectName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [proposals, searchTerm, statusFilter]);

  // Pricing total sum of draft/editor state
  const computedMaterialsTotal = useMemo(() => {
    return proposalMaterials.reduce((sum, m) => sum + ((Number(m.quantity) || 0) * (Number(m.unitPrice) || 0)), 0);
  }, [proposalMaterials]);

  const computedTasksTotal = useMemo(() => {
    return proposalTasks.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  }, [proposalTasks]);

  const computedDraftTotal = useMemo(() => {
    const matTotal = autoIncludeMaterials ? computedMaterialsTotal : 0;
    if (pricingType === 'project') {
      return (Number(laborPrice) || 0) + matTotal;
    }
    return computedTasksTotal + matTotal;
  }, [pricingType, laborPrice, computedTasksTotal, computedMaterialsTotal, autoIncludeMaterials]);

  const getStatusBadgeStyles = (st: Proposal['status']) => {
    switch (st) {
      case 'accepted':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60';
      case 'sent':
        return 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60';
      case 'declined':
        return 'bg-rose-50 dark:bg-rose-950/40 text-rose-750 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-350 border border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusLabel = (st: Proposal['status']) => {
    switch (st) {
      case 'accepted': return t('Accepted', 'Kabul Edildi', 'Zaakceptowana');
      case 'sent': return t('Sent to Client', 'Müşteriye Gönderildi', 'Wysłana');
      case 'declined': return t('Declined', 'Reddedildi', 'Odrzucona');
      default: return t('Draft', 'Taslak', 'Szkic');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-amber-500" />
            {t('Proposals & Quotations', 'Teklifler ve Sunum Hazırlığı', 'Oferty i Kosztorysy')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs">
            {t(
              'Create quotes with tasks, prices, and materials. Export as a client presentation presentation and instantiate projects immediately.', 
              'Müşteri taleplerine göre hızlıca listeleri ve malzemeleri belirleyin, PDF çıktı sunumu alın ve anında projeye dönüştürün.', 
              'Twórz profesjonalne wyceny z zadaniami i materiałami, drukuj prezentacje i automatycznie inicjuj projekty.'
            )}
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-4.5 py-3 rounded-xl text-xs cursor-pointer shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          {t('Prepare New Quotation', 'Yeni Fiyat Teklifi Hazırla', 'Przygotuj Nową Ofertę')}
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <span>{t('Loading quotes...', 'Teklifler yükleniyor...', 'Ładowanie ofert...')}</span>
        </div>
      ) : (
        <>
          {/* SEARCH & FILTER CONTROLS */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-wrap gap-4 items-center">
            <div className="relative flex-grow max-w-md">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('Search by client, project, company...', 'Müşteri, proje ya da firma adı ara...', 'Szukaj według klienta, projektu...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 custom-input bg-slate-50 border border-slate-205 focus:border-amber-500 focus:outline-none rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold uppercase">{t('Status:', 'Durum:', 'Status:')}</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">{t('All', 'Tümü', 'Wszystko')}</option>
                <option value="draft">{t('Draft', 'Taslak', 'Szkic')}</option>
                <option value="sent">{t('Sent', 'Müşteriye İletildi', 'Wysłana')}</option>
                <option value="accepted">{t('Accepted', 'Kabul Edildi', 'Zaakceptowana')}</option>
                <option value="declined">{t('Declined', 'Reddedildi', 'Odrzucona')}</option>
              </select>
            </div>
          </div>

          {/* LIST */}
          {filteredProposals.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-12 text-center text-slate-400 rounded-2xl">
              <FileText className="w-12 h-12 stroke-[1.2] mx-auto text-slate-300 mb-2" />
              <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{t('No Quotations Found', 'Kayıtlı Fiyat Teklifi Bulunamadı', 'Nie znaleziono ofert')}</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                {t('Create your first quote/proposal and present it beautifully.', 'Hemen yeni bir fiyat teklifi hazırlayarak görsel sunum oluşturabilirsiniz.', 'Utwórz swoją pierwszą ofertę i zaprezentuj ją profesjonalnie.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredProposals.map((p) => {
                const isProjectBased = p.pricingType === 'project';
                const cardClient = getProposalCustomerDetails(p);
                
                return (
                  <div 
                    key={p.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-xs hover:border-amber-325 transition-all relative flex flex-col justify-between"
                  >
                    <div>
                      {/* Top bar with status and actions */}
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full ${getStatusBadgeStyles(p.status)}`}>
                          {getStatusLabel(p.status)}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewProposal(p)}
                            title={t('Print Presentation / PDF', 'Müşteri Sunumu / Yazdır', 'Drukuj / Prezentacja PDF')}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(p)}
                            title={t('Edit Quote', 'Teklifi Düzenle', 'Edytuj ofertę')}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProposal(p.id)}
                            title={t('Delete Quote', 'Teklifi Sil', 'Usuń ofertę')}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 text-rose-600 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Main info client */}
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-850 dark:text-slate-100 text-base flex items-center gap-1.5">
                          {p.projectName}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-450 dark:text-slate-400 font-medium">
                          <span>{t('Client:', 'Müşteri / Kurum:', 'Klient:')} <strong className="text-slate-750 dark:text-slate-200">{cardClient.name}</strong> {cardClient.company && `(${cardClient.company})`}</span>
                          {cardClient.isRegistered && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-semibold">
                              {t('Registered', 'Kayıtlı', 'Zarejestrowany')}
                            </span>
                          )}
                        </div>

                        {(cardClient.phone || cardClient.email || cardClient.address) && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                            {cardClient.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                {cardClient.phone}
                              </span>
                            )}
                            {cardClient.email && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]" title={cardClient.email}>
                                <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{cardClient.email}</span>
                              </span>
                            )}
                            {cardClient.address && (
                              <span className="flex items-center gap-1 truncate max-w-[220px]" title={cardClient.address}>
                                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{cardClient.address}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Description extract */}
                      {p.projectDescription && (
                        <p className="text-slate-500 font-sans text-xs line-clamp-2 mt-2 pt-2 border-t border-slate-50 dark:border-slate-800/40">
                          {p.projectDescription}
                        </p>
                      )}

                      {/* Specs pills */}
                      <div className="flex flex-wrap gap-2.5 mt-4 text-[11px] text-slate-450 font-medium">
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {p.tasks?.length || 0} {t('Tasks', 'Görev', 'Zadań')}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                          {p.materials?.length || 0} {t('Materials', 'Malzeme', 'Materiałów')}
                        </span>
                        <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-md">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {p.validUntil}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {(() => {
                        const cardMatTotal = (p.materials || []).reduce((sum, m) => sum + ((m.quantity || 0) * (m.unitPrice || 0)), 0);
                        const cardLabor = p.laborPrice !== undefined ? p.laborPrice : Math.max(0, (p.totalProjectPrice || 0) - cardMatTotal);
                        return (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-bold">
                              {t('Proposed Cost', 'Teklif Edilen Tutar', 'Zaproponowany Koszt')}
                            </span>
                            <div className="flex flex-wrap items-baseline gap-2">
                              <span className="font-mono text-base font-black text-amber-500">
                                {formatMoney(p.totalProjectPrice, settings)}
                              </span>
                              {cardMatTotal > 0 && (
                                <span className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/60 flex items-center gap-1">
                                  <ShoppingBag className="w-2.5 h-2.5 flex-shrink-0" />
                                  <span>{t('Materials: ', 'Malzeme: ', 'Materiały: ')}{formatMoney(cardMatTotal, settings)}</span>
                                </span>
                              )}
                            </div>
                            {p.materials && p.materials.length > 0 && (
                              <div className="text-[9px] text-slate-400 flex items-center gap-1.5">
                                <span>{t('Labor: ', 'İşçilik: ', 'Robocizna: ')}{formatMoney(cardLabor, settings)}</span>
                                <span>•</span>
                                <span>{p.materials.length} {t('materials included', 'malzeme dahil', 'materiałów')}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {p.convertedToProjectId ? (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {t('Project Live', 'Aktif Şantiyede', 'Mieszka w Projekcie')}
                          </span>
                          <button
                            onClick={() => handleConvertProposalToProject(p)}
                            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] px-3 py-1.5 rounded-xl cursor-pointer transition-colors shadow-xs"
                            title={t('Re-create Project from Proposal', 'Projeyi Tekliften Tekrar Oluştur', 'Utwórz projekt ponownie z oferty')}
                          >
                            <ArrowRight className="w-3 h-3 animate-pulse" />
                            {t('Re-instantiate', 'Tekrar Oluştur', 'Odtwórz')}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConvertProposalToProject(p)}
                          className="flex items-center gap-1 bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl cursor-pointer transition-colors shadow-xs"
                        >
                          {t('Instantiate Project', 'Projeyi Otomatik Oluştur', 'Utwórz Projekt')}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* COMPACT EDITOR MODAL / DIALOG */}
      <AnimatePresence>
        {isEditorOpen && (
          <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto text-slate-800 dark:text-slate-100"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-black tracking-tight text-slate-850 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  {editorId ? t('Edit Proposal Spec', 'Fiyat Teklifini Düzenle', 'Edytuj Specyfikację Oferty') : t('Create Proposal Spec', 'Yeni Fiyat Teklifi Hazırla', 'Przygotuj Specyfikację Oferty')}
                </h3>
                <button
                  onClick={() => {
                    setIsEditorOpen(false);
                    handleCancelEditTask();
                    handleCancelEditMaterial();
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProposal} className="space-y-6">
                {/* Section 1: Core Client Information */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">
                    1. {t('Client & Renovation Goals', 'Müşteri ve Şantiye Başlığı', 'Klient i Cele Remontowe')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {customers && customers.length > 0 && (
                      <div className="md:col-span-2 space-y-1 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-150 dark:border-slate-800">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          {t('Select Registered Customer (Optional)', 'Kayıtlı Müşteri Seç (İsteğe Bağlı)', 'Wybierz zarejestrowanego klienta (Opcjonalnie)')}
                        </label>
                        <select
                          value={clientClientId}
                          onChange={(e) => {
                            const cid = e.target.value;
                            setClientClientId(cid);
                            if (cid) {
                              const found = customers.find(c => c.id === cid);
                              if (found) {
                                setClientName(found.name);
                                setClientCompany(found.company || '');
                                setClientPhone(found.phone || '');
                                setClientEmail(found.email || '');
                                setClientAddress(found.address || '');
                                setClientNotes(found.notes || '');
                              }
                            } else {
                              setClientName('');
                              setClientCompany('');
                              setClientPhone('');
                              setClientEmail('');
                              setClientAddress('');
                              setClientNotes('');
                            }
                          }}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900 font-sans cursor-pointer text-slate-850 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                        >
                          <option value="">{t('--- New/Unregistered Customer ---', '--- Kayıtlı Olmayan / Yeni Müşteri ---', '--- Nowy / Niezarejestrowany Klient ---')}</option>
                          {customers.map(cust => (
                            <option key={cust.id} value={cust.id}>{cust.name} ({cust.company || t('Individual', 'Bireysel', 'Indywidualny')})</option>
                          ))}
                        </select>

                        {clientClientId && (() => {
                          const selectedCust = customers.find(c => c.id === clientClientId);
                          if (!selectedCust) return null;
                          return (
                            <div className="mt-2 pt-2 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-amber-900 dark:text-amber-200">
                              {selectedCust.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span>{selectedCust.phone}</span>
                                </div>
                              )}
                              {selectedCust.email && (
                                <div className="flex items-center gap-1 truncate">
                                  <Mail className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span className="truncate">{selectedCust.email}</span>
                                </div>
                              )}
                              {selectedCust.address && (
                                <div className="flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 text-amber-600 flex-shrink-0" />
                                  <span className="truncate">{selectedCust.address}</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">{t('Client Name *', 'Müşteri Adı / Unvanı *', 'Nazwa Klienta *')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('e.g., John Doe', 'Örn: Ahmet Yılmaz', 'np. Jan Kowalski')}
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">{t('Client Company / Brand', 'Şirket Adı / Alıcı Kurum', 'Firma Klienta / Marka')}</label>
                      <input
                        type="text"
                        placeholder={t('e.g., Acme Corp LLC', 'Örn: Yılmaz Gıda Ltd. Şti.', 'np. Acme Sp. z o.o.')}
                        value={clientCompany}
                        onChange={(e) => setClientCompany(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{t('Client Phone', 'Müşteri Telefonu', 'Telefon klienta')}</span>
                      </label>
                      <input
                        type="tel"
                        placeholder={t('e.g., +90 532 000 00 00', 'Örn: +90 532 000 00 00', 'np. +48 500 000 000')}
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{t('Client Email', 'Müşteri E-posta Adresi', 'Adres e-mail klienta')}</span>
                      </label>
                      <input
                        type="email"
                        placeholder={t('e.g., client@example.com', 'Örn: musteri@sirket.com', 'np. klient@example.com')}
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{t('Client Address / Billing Address', 'Müşteri Fatura / İkamet Adresi', 'Adres rozliczeniowy klienta')}</span>
                      </label>
                      <input
                        type="text"
                        placeholder={t('e.g., Barbaros Bulvarı No:42 D:6 Beşiktaş / İstanbul', 'Örn: Barbaros Bulvarı No:42 D:6 Beşiktaş / İstanbul', 'np. ul. Marszałkowska 10, Warszawa')}
                        value={clientAddress}
                        onChange={(e) => setClientAddress(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">{t('Project Target Title *', 'Şantiye / Tadilat Başlığı *', 'Nazwa Projektu *')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('e.g., Luxury 3-Bedroom Apartment Renovation', 'Örn: Beşiktaş 3+1 Daire Tadilatı', 'np. Luksusowy remont mieszkania 3-pokojowego')}
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">{t('Proposal Valid Until', 'Teklif Geçerlilik Tarihi', 'Oferta ważna do')}</label>
                      <input
                        type="date"
                        required
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs font-bold text-slate-500">{t('Project Goal / Description', 'Yapılacak İşlerin Özeti', 'Opis Projektu / Cele')}</label>
                      <textarea
                        rows={2}
                        placeholder={t('Summary of remodeling requirements and scope of work...', 'Şantiyede yapılacak kırıp dökme, tesisat yenileme işlerinin kapsam ve özeti...', 'Podsumowanie wymagań remontowych i zakresu prac...')}
                        value={projectDescription}
                        onChange={(e) => setProjectDescription(e.target.value)}
                        className="w-full text-xs p-3 custom-input border rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Task details & delivery schedule */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">
                    2. {t('Duties, Scope & Complete Schedule', 'Yapılacak Görevler ve İş Listesi', 'Obowiązki, Zakres i Harmonogram')}
                  </h4>
                  <p className="text-[10px] text-slate-450 mb-3">
                    {t(
                      'Describe specific work tasks. Every task entered here will automatically populate your real live task board later.', 
                      'Müşteriye gururla sunacağınız her bir görev kalemi. Bu görevlerin her biri, proje başlatıldığında otomatik olarak iş listesine eklenir.', 
                      'Opisz konkretne zadania. Każde wpisane tutaj zadanie automatycznie zapełni tablicę zadań.'
                    )}
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                    {/* Entry Form */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500">{t('Job Title', 'Sorumluluk / Görev Başlığı', 'Tytuł zadania')}</label>
                        <input
                          type="text"
                          placeholder={t('e.g., Kitchen Countertop Demolition & Plumbing Renewal', 'Örn: Mutfak Tezgahı Söküm ve Tesisat Yenileme', 'np. Demontaż blatu kuchennego i wymiana instalacji wod-kan')}
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">{t('Est. Duration (Days)', 'Süre (Gün)', 'Czas trwania (Dni)')}</label>
                        <input
                          type="number"
                          min={1}
                          value={newTaskDuration}
                          onChange={(e) => setNewTaskDuration(Number(e.target.value))}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg"
                        />
                      </div>

                      {pricingType === 'itemized' ? (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500">{t('Task Price', 'Birim Maliyet / Bedel', 'Cena zadania')}</label>
                          <input
                            type="number"
                            min={0}
                            value={newTaskPrice}
                            onChange={(e) => setNewTaskPrice(Number(e.target.value))}
                            className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg font-mono font-bold"
                          />
                        </div>
                      ) : (
                        <div className="h-[43px] flex items-center justify-center">
                          <span className="text-[10px] text-slate-400 font-semibold">{t('Global Fixed Pricing Active', 'Kademesiz Sabit Fiyat Aktif', 'Aktywna wycena ryczałtowa')}</span>
                        </div>
                      )}

                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">{t('Special Instructions (Optional)', 'Açıklama / Detaylar (İsteğe Bağlı)', 'Szczegóły zadania (Opcjonalnie)')}</label>
                        <input
                          type="text"
                          placeholder={t('e.g., Including replacement of old steel pipes with PPRC.', 'Örn: Çelik boruların plastik pprc ile değiştirilmesi dahil.', 'np. Obejmuje wymianę rur stalowych na polipropylenowe (PPRC).')}
                          value={newTaskDesc}
                          onChange={(e) => setNewTaskDesc(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddLocalTask}
                        className="bg-slate-800 hover:bg-slate-850 text-white font-bold text-xs p-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        {t('Append Task', 'Listeye Görevi Ekle', 'Dodaj Zadanie')}
                      </button>
                    </div>

                    {/* Local Selected Table */}
                    {proposalTasks.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Pencil className="w-3 h-3 text-amber-500" />
                            {t('Click pencil or double-click to edit any task', 'Görevi düzenlemek için kalem simgesine veya satıra çift tıklayın', 'Kliknij ołówek lub dwuklik, aby edytować zadanie')}
                          </span>
                          <span className="font-bold text-slate-500">{proposalTasks.length} {t('tasks', 'görev', 'zadań')}</span>
                        </div>

                        <div className="border border-slate-200/50 dark:border-slate-800 rounded-xl overflow-x-auto bg-white dark:bg-slate-900 text-xs shadow-xs">
                          <table className="w-full text-left min-w-[500px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 dark:text-slate-400">
                              <tr>
                                <th className="p-2.5">{t('Task Spec', 'Görev / Açıklama', 'Zadanie')}</th>
                                <th className="p-2.5 w-24 text-center">{t('Duration', 'Süre', 'Czas')}</th>
                                {pricingType === 'itemized' && <th className="p-2.5 w-28 text-right">{t('Price', 'Tutar', 'Cena')}</th>}
                                <th className="p-2.5 w-24 text-center">{t('Actions', 'İşlemler', 'Akcje')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {proposalTasks.map((tk) => {
                                if (editingTaskId === tk.id) {
                                  return (
                                    <tr key={tk.id} className="bg-amber-50/60 dark:bg-amber-950/30">
                                      <td colSpan={pricingType === 'itemized' ? 4 : 3} className="p-3">
                                        <div className="bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-600/70 rounded-xl p-3.5 shadow-md space-y-3">
                                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 dark:text-amber-300">
                                              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                              <span>{t('Editing Task Item', 'Görevi Düzenle', 'Edycja Zadania')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={handleSaveEditTask}
                                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                                              >
                                                <Check className="w-3.5 h-3.5" />
                                                <span>{t('Save', 'Kaydet', 'Zapisz')}</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditTask}
                                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-colors cursor-pointer"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                                <span>{t('Cancel', 'Vazgeç', 'Anuluj')}</span>
                                              </button>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                            <div className="sm:col-span-2 space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Job Title *', 'Görev Başlığı *', 'Tytuł zadania *')}</label>
                                              <input
                                                type="text"
                                                value={editTaskTitle}
                                                onChange={(e) => setEditTaskTitle(e.target.value)}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                placeholder={t('e.g., Kitchen Demolition', 'Örn: Mutfak Sökümü', 'np. Demontaż')}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveEditTask();
                                                  if (e.key === 'Escape') handleCancelEditTask();
                                                }}
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Est. Duration (Days)', 'Süre (Gün)', 'Czas trwania (Dni)')}</label>
                                              <input
                                                type="number"
                                                min={1}
                                                value={editTaskDuration}
                                                onChange={(e) => setEditTaskDuration(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-medium text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveEditTask();
                                                  if (e.key === 'Escape') handleCancelEditTask();
                                                }}
                                              />
                                            </div>

                                            {pricingType === 'itemized' ? (
                                              <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-500">{t('Task Price', 'Birim Maliyet / Bedel', 'Cena zadania')}</label>
                                                <input
                                                  type="number"
                                                  min={0}
                                                  value={editTaskPrice}
                                                  onChange={(e) => setEditTaskPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono font-bold text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEditTask();
                                                    if (e.key === 'Escape') handleCancelEditTask();
                                                  }}
                                                />
                                              </div>
                                            ) : (
                                              <div className="flex items-center justify-center p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] text-slate-400 font-semibold text-center">
                                                {t('Fixed Price Mode Active', 'Götürü Fiyat Aktif', 'Ryczałt')}
                                              </div>
                                            )}

                                            <div className="sm:col-span-4 space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Special Instructions (Optional)', 'Açıklama / Detaylar (İsteğe Bağlı)', 'Szczegóły (Opcjonalnie)')}</label>
                                              <input
                                                type="text"
                                                value={editTaskDesc}
                                                onChange={(e) => setEditTaskDesc(e.target.value)}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                placeholder={t('Specific details or scope of this task...', 'Bu görevin şantiye kapsamı ve detayları...', 'Szczegóły dotyczące zadania...')}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveEditTask();
                                                  if (e.key === 'Escape') handleCancelEditTask();
                                                }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr 
                                    key={tk.id} 
                                    onDoubleClick={() => handleStartEditTask(tk)}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                    title={t('Double-click to edit', 'Düzenlemek için çift tıklayın', 'Kliknij dwukrotnie, aby edytować')}
                                  >
                                    <td className="p-2.5">
                                      <div className="font-semibold text-slate-800 dark:text-slate-200">{tk.title}</div>
                                      {tk.description && <div className="text-[10px] text-slate-400 dark:text-slate-500">{tk.description}</div>}
                                    </td>
                                    <td className="p-2.5 text-center text-slate-500 dark:text-slate-400 font-medium">
                                      {tk.durationDays} {t('days', 'gün', 'dni')}
                                    </td>
                                    {pricingType === 'itemized' && (
                                      <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {formatMoney(tk.price, settings)}
                                      </td>
                                    )}
                                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditTask(tk)}
                                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title={t('Edit task', 'Görevi Düzenle', 'Edytuj zadanie')}
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLocalTask(tk.id)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title={t('Delete task', 'Görevi Sil', 'Usuń zadanie')}
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
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Material elements */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-2">
                    3. {t('Proposed Materials Checklist', 'Alınacak ve Kullanılacak Malzemeler', 'Wymagane Materiały i Zaopatrzenie')}
                  </h4>
                  <p className="text-[10px] text-slate-450 mb-3">
                    {t(
                      'Outline which products and materials will be purchased for this renovation. This creates pre-filled material allocation orders automatically.', 
                      'Şantiyeye siparişi yapılacak olan kaba inşaat, elektrik/su ve diğer mobilya malzemeleri. Proje başladığında bütçe sayfasına aktarılır.', 
                      'Określ materiały. Te pozycje zostaną automatycznie zaimportowane jako planowane zamówienia materiałowe.'
                    )}
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500">{t('Material Name', 'Malzeme Tanımı', 'Nazwa materiału')}</label>
                        <input
                          type="text"
                          placeholder={t('e.g., Ready-to-Use Premium Ceramics Adhesive Glue', 'Örn: Kalekim Hazır Seramik Yapıştırıcı', 'np. Elastyczny klej do płytek ceramicznych')}
                          value={newMatTitle}
                          onChange={(e) => setNewMatTitle(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">{t('Category', 'Kategori', 'Kategoria')}</label>
                        <select
                          value={newMatCategory}
                          onChange={(e) => setNewMatCategory(e.target.value as MaterialCategory)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg cursor-pointer"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{translateCategory(cat, settings.lang)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">{t('Qty / Unit', 'Miktar / Birim', 'Ilość / Jedn.')}</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min={1}
                            value={newMatQuantity}
                            onChange={(e) => setNewMatQuantity(Number(e.target.value))}
                            className="w-16 text-xs p-2.5 bg-white border border-slate-205 rounded-lg text-center"
                          />
                          <input
                            type="text"
                            placeholder="torba"
                            value={newMatUnit}
                            onChange={(e) => setNewMatUnit(e.target.value)}
                            className="w-16 text-xs p-2.5 bg-white border border-slate-205 rounded-lg text-center"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500">{t('Est Unit Cost', 'Tahmini Birim Fiyat', 'Cena jedn.')}</label>
                        <input
                          type="number"
                          min={0}
                          value={newMatUnitPrice}
                          onChange={(e) => setNewMatUnitPrice(Number(e.target.value))}
                          className="w-full text-xs p-2.5 bg-white border border-slate-205 rounded-lg font-mono"
                        />
                      </div>

                      <div className="md:col-span-4 justify-start text-[10px] font-bold text-amber-600 pl-1">
                        {t('Subtotal: ', 'Ara Toplam: ', 'Suma częściowa: ')} 
                        <span className="font-mono text-xs">{formatMoney(newMatQuantity * newMatUnitPrice, settings)}</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddLocalMaterial}
                        className="bg-slate-800 hover:bg-slate-850 text-white font-bold text-xs p-2.5 rounded-lg cursor-pointer transition-colors"
                      >
                        {t('Append Material', 'Listeye Ekle', 'Dodaj Materiał')}
                      </button>
                    </div>

                    {proposalMaterials.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                          <span className="flex items-center gap-1 font-medium">
                            <Pencil className="w-3 h-3 text-amber-500" />
                            {t('Click pencil or double-click to edit any material', 'Malzemeyi düzenlemek için kalem simgesine veya satıra çift tıklayın', 'Kliknij ołówek lub dwuklik, aby edytować materiał')}
                          </span>
                          <span className="font-bold text-slate-500">{proposalMaterials.length} {t('materials', 'malzeme', 'materiałów')}</span>
                        </div>

                        <div className="border border-slate-200/50 dark:border-slate-800 rounded-xl overflow-x-auto bg-white dark:bg-slate-900 text-xs shadow-xs">
                          <table className="w-full text-left min-w-[560px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold text-slate-500 dark:text-slate-400">
                              <tr>
                                <th className="p-2.5">{t('Material Spec', 'Malzeme / Kategori', 'Materiał')}</th>
                                <th className="p-2.5 w-28 text-center">{t('Qty', 'Miktar', 'Ilość')}</th>
                                <th className="p-2.5 w-28 text-right">{t('Est Unit Price', 'Birim Fiyat', 'Cena jedn.')}</th>
                                <th className="p-2.5 w-28 text-right">{t('Subtotal', 'Tutar', 'Łącznie')}</th>
                                <th className="p-2.5 w-24 text-center">{t('Actions', 'İşlemler', 'Akcje')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {proposalMaterials.map((mat) => {
                                if (editingMaterialId === mat.id) {
                                  return (
                                    <tr key={mat.id} className="bg-amber-50/60 dark:bg-amber-950/30">
                                      <td colSpan={5} className="p-3">
                                        <div className="bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-600/70 rounded-xl p-3.5 shadow-md space-y-3">
                                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900 dark:text-amber-300">
                                              <Pencil className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                              <span>{t('Editing Material Item', 'Malzemeyi Düzenle', 'Edycja Materiału')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={handleSaveEditMaterial}
                                                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                                              >
                                                <Check className="w-3.5 h-3.5" />
                                                <span>{t('Save', 'Kaydet', 'Zapisz')}</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={handleCancelEditMaterial}
                                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-colors cursor-pointer"
                                              >
                                                <X className="w-3.5 h-3.5" />
                                                <span>{t('Cancel', 'Vazgeç', 'Anuluj')}</span>
                                              </button>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                            <div className="sm:col-span-2 space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Material Name *', 'Malzeme Tanımı *', 'Nazwa materiału *')}</label>
                                              <input
                                                type="text"
                                                value={editMatTitle}
                                                onChange={(e) => setEditMatTitle(e.target.value)}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                placeholder={t('e.g., Ceramics Adhesive Glue', 'Örn: Kalekim Hazır Seramik Yapıştırıcı', 'np. Klej do płytek')}
                                                autoFocus
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveEditMaterial();
                                                  if (e.key === 'Escape') handleCancelEditMaterial();
                                                }}
                                              />
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Category', 'Kategori', 'Kategoria')}</label>
                                              <select
                                                value={editMatCategory}
                                                onChange={(e) => setEditMatCategory(e.target.value as MaterialCategory)}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-850 dark:text-slate-100 cursor-pointer focus:bg-white focus:border-amber-500 focus:outline-none"
                                              >
                                                {CATEGORIES.map(cat => (
                                                  <option key={cat} value={cat}>{translateCategory(cat, settings.lang)}</option>
                                                ))}
                                              </select>
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Qty / Unit', 'Miktar / Birim', 'Ilość / Jedn.')}</label>
                                              <div className="flex gap-1.5">
                                                <input
                                                  type="number"
                                                  min={1}
                                                  value={editMatQuantity}
                                                  onChange={(e) => setEditMatQuantity(Math.max(1, parseFloat(e.target.value) || 1))}
                                                  className="w-16 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-medium text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEditMaterial();
                                                    if (e.key === 'Escape') handleCancelEditMaterial();
                                                  }}
                                                />
                                                <input
                                                  type="text"
                                                  value={editMatUnit}
                                                  onChange={(e) => setEditMatUnit(e.target.value)}
                                                  className="w-16 text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-center text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                  placeholder="adet"
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEditMaterial();
                                                    if (e.key === 'Escape') handleCancelEditMaterial();
                                                  }}
                                                />
                                              </div>
                                            </div>

                                            <div className="space-y-1">
                                              <label className="text-[10px] font-bold text-slate-500">{t('Est Unit Cost', 'Birim Fiyat', 'Cena jedn.')}</label>
                                              <input
                                                type="number"
                                                min={0}
                                                value={editMatUnitPrice}
                                                onChange={(e) => setEditMatUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono font-medium text-slate-900 dark:text-slate-100 focus:bg-white focus:border-amber-500 focus:outline-none"
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') handleSaveEditMaterial();
                                                  if (e.key === 'Escape') handleCancelEditMaterial();
                                                }}
                                              />
                                            </div>

                                            <div className="sm:col-span-5 flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs gap-2">
                                              <div className="flex items-center gap-1.5 text-slate-500">
                                                <span className="text-[11px] font-semibold">{t('Calculated Subtotal:', 'Hesaplanan Kalem Tutarı:', 'Suma częściowa:')}</span>
                                                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                                                  {formatMoney((Number(editMatQuantity) || 0) * (Number(editMatUnitPrice) || 0), settings)}
                                                </span>
                                              </div>
                                              <span className="text-[10px] text-slate-400">
                                                {t('Press Enter to save, Esc to cancel', 'Kaydetmek için Enter, çıkmak için Esc tuşuna basın', 'Enter: zapisz, Esc: anuluj')}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }

                                return (
                                  <tr 
                                    key={mat.id} 
                                    onDoubleClick={() => handleStartEditMaterial(mat)}
                                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                    title={t('Double-click to edit', 'Düzenlemek için çift tıklayın', 'Kliknij dwukrotnie, aby edytować')}
                                  >
                                    <td className="p-2.5">
                                      <div className="font-semibold text-slate-850 dark:text-slate-200">{mat.title}</div>
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{translateCategory(mat.category, settings.lang)}</div>
                                    </td>
                                    <td className="p-2.5 text-center text-slate-600 dark:text-slate-400 font-medium">
                                      {mat.quantity} {mat.unit}
                                    </td>
                                    <td className="p-2.5 text-right font-mono text-slate-500 dark:text-slate-400">
                                      {formatMoney(mat.unitPrice, settings)}
                                    </td>
                                    <td className="p-2.5 text-right font-mono font-bold text-slate-700 dark:text-slate-200">
                                      {formatMoney(mat.quantity * mat.unitPrice, settings)}
                                    </td>
                                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditMaterial(mat)}
                                          className="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title={t('Edit material', 'Malzemeyi Düzenle', 'Edytuj materiał')}
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLocalMaterial(mat.id)}
                                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title={t('Delete material', 'Malzemeyi Sil', 'Usuń materiał')}
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
                        </div>

                        <div className="flex items-center justify-between p-3 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 rounded-xl text-xs mt-3">
                          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-300 font-bold">
                            <ShoppingBag className="w-4 h-4 text-amber-600" />
                            <span>{t('Total Material Cost for Quotation:', 'Teklife Eklenen Malzeme Maliyeti Toplamı:', 'Łączny koszt materiałów do oferty:')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-black text-amber-700 dark:text-amber-400">
                              {formatMoney(computedMaterialsTotal, settings)}
                            </span>
                            <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md font-bold">
                              {proposalMaterials.length} {t('items', 'kalem', 'pozycji')}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 4: Pricing Model & Terms */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider mb-3">
                    4. {t('Financial Structuring & Terms', 'Fiyatlandırma, Vergi ve Ödeme Koşulları', 'Struktura Finansowa i Warunki')}
                  </h4>

                  <div className="space-y-4 p-4 rounded-xl border border-slate-150 bg-slate-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 block">{t('Pricing Strategy', 'Hesaplama Yöntemi', 'Metoda wyceny')}</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className={`flex items-start gap-2 text-xs font-bold cursor-pointer p-3 rounded-xl border transition-colors ${pricingType === 'project' ? 'bg-amber-500/10 border-amber-400 text-slate-900' : 'bg-white border-slate-150 text-slate-700 hover:border-slate-300'}`}>
                            <input
                              type="radio"
                              name="pricingType"
                              checked={pricingType === 'project'}
                              onChange={() => setPricingType('project')}
                              className="accent-amber-500 mt-0.5"
                            />
                            <div>
                              <div>{t('Lump Sum / Labor Price', 'Götürü / İşçilik Hizmet Bedeli', 'Kwota ryczałtowa')}</div>
                              <span className="text-[9px] text-slate-400 font-normal block leading-tight mt-0.5">{t('Fixed labor cost + auto material cost', 'İşçilik bedelini girin, malzeme otomatik eklenir', 'Wpisz robociznę, materiały doliczą się')}</span>
                            </div>
                          </label>

                          <label className={`flex items-start gap-2 text-xs font-bold cursor-pointer p-3 rounded-xl border transition-colors ${pricingType === 'itemized' ? 'bg-amber-500/10 border-amber-400 text-slate-900' : 'bg-white border-slate-150 text-slate-700 hover:border-slate-300'}`}>
                            <input
                              type="radio"
                              name="pricingType"
                              checked={pricingType === 'itemized'}
                              onChange={() => setPricingType('itemized')}
                              className="accent-amber-500 mt-0.5"
                            />
                            <div>
                              <div>{t('Itemized Task Sum', 'Görev Birim Toplamı', 'Suma zadań jednostkowych')}</div>
                              <span className="text-[9px] text-slate-400 font-normal block leading-tight mt-0.5">{t('Sum of tasks prices + material cost', 'Görev bedelleri + malzeme maliyeti toplanır', 'Koszty zadań + materiały')}</span>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Material Auto-Include Toggle */}
                      <div className="space-y-2 flex flex-col justify-end">
                        <label className="text-xs font-bold text-slate-500 block">{t('Material Integration', 'Malzeme Maliyeti Entegrasyonu', 'Integracja materiałów')}</label>
                        <label className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-amber-400 transition-colors">
                          <input
                            type="checkbox"
                            checked={autoIncludeMaterials}
                            onChange={(e) => setAutoIncludeMaterials(e.target.checked)}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-800 block">{t('Include Material Costs in Total Budget', 'Malzeme Maliyetlerini Teklif Toplamına Ekle', 'Uwzględnij materiały w całkowitym budżecie')}</span>
                            <span className="text-[10px] text-slate-400 block">{t('Automatically appends the materials calculated in Step 3 to the grand proposal total', '3. Adımda girilen malzeme tutarını genel teklif bütçesine otomatik ekler', 'Automatycznie dodaje koszt materiałów do sumy')}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Cost Breakdown Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      {/* Labor / Services */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {pricingType === 'project' ? t('Labor / Service Base Price', 'İşçilik / Hizmet Bedeli', 'Robocizna / Usługi') : t('Tasks Sum (Labor)', 'Görevler Toplamı', 'Suma zadań')}
                        </span>
                        {pricingType === 'project' ? (
                          <div className="space-y-1">
                            <input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={laborPrice}
                              onChange={(e) => setLaborPrice(Number(e.target.value))}
                              className="w-full font-mono text-base font-bold p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-850"
                            />
                            <span className="text-[9px] text-slate-400 block">{t('Enter net labor & service fee', 'İşçilik & taşeron bedelini girin', 'Podaj koszt robocizny')}</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="font-mono text-base font-bold text-slate-800 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                              {formatMoney(computedTasksTotal, settings)}
                            </div>
                            <span className="text-[9px] text-slate-400 block">{proposalTasks.length} {t('tasks itemized', 'kalem görev', 'zadań')}</span>
                          </div>
                        )}
                      </div>

                      {/* Materials Component */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {t('Materials Total', 'Malzeme Maliyeti', 'Materiały łącznie')}
                        </span>
                        <div className="p-2 bg-amber-50/60 border border-amber-200/80 rounded-lg flex items-center justify-between">
                          <span className="font-mono text-base font-bold text-amber-700">
                            {formatMoney(computedMaterialsTotal, settings)}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600">
                            {autoIncludeMaterials ? t('+ Included', '+ Dahil Edildi', '+ Wliczone') : t('Excluded', 'Dahil Değil', 'Nie wliczone')}
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 block">
                          {proposalMaterials.length > 0 ? `${proposalMaterials.length} ${t('materials from list', 'malzeme listelendi', 'materiałów')}` : t('No materials added in Step 3', 'Henüz malzeme eklenmedi', 'Brak materiałów')}
                        </span>
                      </div>

                      {/* Grand Total */}
                      <div className="p-3 bg-amber-500/10 rounded-xl border-2 border-amber-400/60 space-y-1.5">
                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                          {t('Total Proposal Budget', 'Toplam Teklif Bütçesi', 'Całkowita wycena')}
                        </span>
                        <div className="p-2 bg-white/90 border border-amber-300/60 rounded-lg font-mono text-lg font-black text-amber-600">
                          {formatMoney(computedDraftTotal, settings)}
                        </div>
                        <span className="text-[9px] text-amber-700 font-medium block">
                          {autoIncludeMaterials && computedMaterialsTotal > 0
                            ? t('Labor + Materials calculated automatically', 'İşçilik + Malzemeler otomatik toplandı', 'Robocizna + Materiały')
                            : t('Based on labor/tasks only', 'Yalnızca işçilik/görevler', 'Tylko robocizna')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">{t('Status', 'Teklif Durumu', 'Status oferty')}</label>
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value as Proposal['status'])}
                          className="w-full text-xs p-3 custom-input border rounded-xl bg-white cursor-pointer"
                        >
                          <option value="draft">{t('Draft (Internal)', 'Taslak (Henüz İletilmedi)', 'Szkic (Wewnętrzny)')}</option>
                          <option value="sent">{t('Sent to Client', 'Müşteriye Gönderildi', 'Wysłana do klienta')}</option>
                          <option value="accepted">{t('Accepted (Approved)', 'Müşteri Tarafından Kabul Edildi', 'Zaakceptowana przez klienta')}</option>
                          <option value="declined">{t('Declined (Rejected)', 'Reddedildi / Revize Bekliyor', 'Odrzucona przez klienta')}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500">{t('Payment & Guarantee Notes', 'Ödeme ve Sözleşme Notları', 'Uwagi dotyczące płatności i gwarancji')}</label>
                        <input
                          type="text"
                          placeholder={t('e.g., 40% upfront deposit, 40% post construction phase, 20% key handover commission.', 'Örn: %40 avans, %40 kaba inşaat bitimi, %20 anahtar tesliminde.', 'np. 40% zaliczki, 40% po stanie surowym, 20% przy odbiorze kluczy.')}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full text-xs p-3 custom-input border rounded-xl"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">{t('Total Proposal Budget:', 'Genel Teklif Tutarı:', 'Całkowita wartość:')}</span>
                    <span className="font-mono text-base font-black text-amber-600 dark:text-amber-400">{formatMoney(computedDraftTotal, settings)}</span>
                    {autoIncludeMaterials && computedMaterialsTotal > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">({t('Includes materials: ', 'Malzeme dahil: ', 'W tym materiały: ')}{formatMoney(computedMaterialsTotal, settings)})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditorOpen(false)}
                      className="px-5 py-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold cursor-pointer"
                    >
                      {t('Cancel', 'İptal', 'Anuluj')}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer shadow-xs"
                    >
                      {editorId ? t('Update Proposal Spec', 'Güncelle ve Kaydet', 'Aktualizuj ofertę') : t('Create Proposal', 'Teklifi Oluştur', 'Utwórz ofertę')}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED PRINTABLE PROPOSAL PRESENTATION MODAL */}
      <AnimatePresence>
        {previewProposal && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto print:static print:bg-white print:p-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto print:shadow-none print:p-0 print:max-h-full print:overflow-hidden print:w-full"
            >
              {/* Desktop Only controls inside dialog */}
              <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100 dark:border-slate-800 print:hidden">
                <span className="text-xs font-extrabold uppercase bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full">{t('Official Presentation Preview', 'Resmi Proje & Fiyat Teklifi Sunumu', 'Oficjalny podgląd prezentacji')}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    {t('Export / Print PDF', 'Yazdır / PDF Olarak Kaydet', 'Drukuj / Zapisz jako PDF')}
                  </button>
                  <button
                    onClick={() => setPreviewProposal(null)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer text-slate-400"
                  >
                    <X className="w-5 h-5 animate-spin-hover" />
                  </button>
                </div>
              </div>

              {/* PRINT AREA CONTAINER */}
              <div id="proposal-printable-invoice" className="font-sans text-slate-850 dark:text-slate-100 p-0 sm:p-4 bg-white dark:bg-transparent print:bg-white print:text-black">
                
                {/* Visual header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b-2 border-slate-100">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white print:text-black tracking-tight">{userProfile?.company || 'Ustam Entegrasyon Proje'}</h2>
                    <p className="text-xs text-slate-500 font-sans">
                      {userProfile?.name || 'Müteahhit / Sorumlu Usta'} • {userProfile?.email || ''}
                    </p>
                  </div>
                  <div className="text-left sm:text-right text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div className="font-black text-slate-800 dark:text-white print:text-black text-sm uppercase tracking-wide">{t('PROPOSAL PRESENTATION', 'REVİZYON VE TADİLAT TEKLİFİ', 'OFERTA REMONTOWA')}</div>
                    <div>{t('Proposal Reference ID:', 'Teklif Referans No:', 'Nr referencyjny oferty:')} <strong className="font-mono text-slate-700 dark:text-slate-200 print:text-black font-bold">{previewProposal.id}</strong></div>
                    <div>{t('Issue Date:', 'Teklif Tarihi:', 'Data wystawienia:')} <strong className="font-bold text-slate-705 dark:text-slate-205 print:text-black">{new Date(previewProposal.createdAt).toLocaleDateString(settings.lang)}</strong></div>
                    <div>{t('Valid Until:', 'Valör / Son Geçerlilik:', 'Ważność oferty:')} <strong className="font-bold text-slate-705 dark:text-slate-205 print:text-black">{previewProposal.validUntil}</strong></div>
                  </div>
                </div>

                {/* Client detail column */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 text-xs mb-8">
                  {(() => {
                    const clientDetails = getProposalCustomerDetails(previewProposal);
                    return (
                      <div className="p-4 bg-slate-50 dark:bg-slate-800/20 print:bg-slate-50 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                            {t('PREPARED FOR / CLIENT INFO', 'ALICI VE MÜŞTERİ BİLGİLERİ', 'DANE KLIENTA')}
                          </span>
                          {clientDetails.isRegistered && (
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold">
                              {t('Registered Client', 'Kayıtlı Müşteri', 'Zarejestrowany Klient')}
                            </span>
                          )}
                        </div>

                        <div className="font-extrabold text-sm text-slate-850 dark:text-white print:text-black flex items-center gap-1.5">
                          <User className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>{clientDetails.name}</span>
                        </div>

                        {clientDetails.company && (
                          <div className="font-medium text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{clientDetails.company}</span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                          {clientDetails.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{clientDetails.phone}</span>
                            </div>
                          )}

                          {clientDetails.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span>{clientDetails.email}</span>
                            </div>
                          )}

                          {clientDetails.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span><strong className="text-slate-500">{t('Address:', 'Müşteri Adresi:', 'Adres:')}</strong> {clientDetails.address}</span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 text-slate-500">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span><strong className="text-slate-700 dark:text-slate-300">{t('Target Site:', 'Tadilat Şantiyesi:', 'Miejsce prac:')}</strong> {previewProposal.projectName}</span>
                          </div>

                          {clientDetails.notes && (
                            <div className="flex items-start gap-2 text-[11px] italic text-slate-500 bg-slate-100/50 dark:bg-slate-800/40 p-2 rounded-lg mt-1">
                              <Info className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                              <span><strong>{t('Customer Notes:', 'Müşteri Kayıt Notu:', 'Uwagi klienta:')}</strong> {clientDetails.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="p-4 bg-slate-50 dark:bg-slate-800/20 print:bg-slate-50 border border-slate-100 dark:border-slate-800 rounded-xl space-y-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">{t('SCOPE OF WORK', 'PLANLANAN TADİLAT KAPSAMI', 'ZAKRES PRAC')}</span>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{previewProposal.projectName}</h4>
                    <p className="text-slate-500 font-sans italic">{previewProposal.projectDescription || t('Detailed home/office renovation under specification lists.', 'Detaylı ev/ofis tadilatı ve yenileme projesi.',  'Szczegółowy remont domu/biura według list specyfikacji.')}</p>
                  </div>
                </div>

                {/* Scope item list */}
                {previewProposal.tasks && previewProposal.tasks.length > 0 && (
                  <div className="space-y-3 mb-8">
                    <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b pb-2 mb-2">
                      {t('1. Detailed Works & Delivery Deadlines', '1. Yapılacak Detaylı İşler ve Teslimat Süreleri', '1. Szczegółowe Prace i Terminy')}
                    </h3>

                    <div className="overflow-hidden border border-slate-150 rounded-xl bg-white text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-550 font-bold border-b border-slate-150">
                          <tr>
                            <th className="p-3">{t('Service / Operation Name', 'Operasyon / Görev Kapsamı', 'Opis usługi')}</th>
                            <th className="p-3 w-36 text-center">{t('Completion Stage', 'Teslimat Hedefi', 'Harmonogram')}</th>
                            {previewProposal.pricingType === 'itemized' && <th className="p-3 w-32 text-right">{t('Unit Bedel', 'Hizmet Bedeli', 'Cena')}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewProposal.tasks.map((tk, idx) => (
                            <tr key={tk.id} className="hover:bg-slate-50/20">
                              <td className="p-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{idx + 1}. {tk.title}</div>
                                {tk.description && <p className="text-[10px] text-slate-500 font-sans pl-3.5 mt-0.5">{tk.description}</p>}
                              </td>
                              <td className="p-3 text-center text-slate-600 font-medium">
                                {tk.durationDays} {t('Working Days', 'İş Günü', 'Dni Roboczych')}
                              </td>
                              {previewProposal.pricingType === 'itemized' && (
                                <td className="p-3 text-right font-mono text-slate-800 font-bold">
                                  {formatMoney(tk.price, settings)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Materials item list */}
                {previewProposal.materials && previewProposal.materials.length > 0 && (
                  <div className="space-y-3 mb-8">
                    <h3 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider flex items-center gap-1.5 border-b pb-2 mb-2">
                      {t('2. Materials & Allocation Specification', '2. Tedarik Edilecek Malzeme ve Ürün Listesi', '2. Specyfikacja Materiałów i Zaopatrzenia')}
                    </h3>

                    <div className="overflow-hidden border border-slate-150 rounded-xl bg-white text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 text-slate-550 font-bold border-b border-slate-150">
                          <tr>
                            <th className="p-3">{t('Product Title / Category', 'Malzeme Tanımı / Kategori', 'Materiał')}</th>
                            <th className="p-3 w-36 text-center">{t('Quantity', 'Miktar / Hacim', 'Ilość')}</th>
                            <th className="p-3 w-32 text-right">{t('Est Unit Cost', 'Birim maliyet', 'Cena jedn.')}</th>
                            <th className="p-3 w-32 text-right">{t('Subtotal', 'Hacim Bedeli', 'Suma częściowa')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {previewProposal.materials.map((mat, idx) => (
                            <tr key={mat.id} className="hover:bg-slate-50/20">
                              <td className="p-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200 print:text-black">{mat.title}</div>
                                <span className="text-[9px] font-semibold text-slate-400 uppercase">{translateCategory(mat.category, settings.lang)}</span>
                              </td>
                              <td className="p-3 text-center text-slate-600 font-medium">
                                {mat.quantity} {mat.unit}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-500">
                                {formatMoney(mat.unitPrice, settings)}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-800 font-bold">
                                {formatMoney(mat.quantity * mat.unitPrice, settings)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Total calculations invoice block */}
                <div className="flex flex-col sm:flex-row justify-between items-start pt-6 border-t-2 border-slate-150 gap-6 text-xs mb-8">
                  <div className="max-w-md space-y-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">{t('TERMS & NOTES', 'SUNUM NOTLARI VE KOŞULLAR', 'WARUNKI')}</span>
                    <p className="text-slate-500 font-sans italic">{previewProposal.notes || t('Standard contract terms apply. Turnkey handover is subject to stage payments verification.', 'Standart tadilat sözleşmesi kuralları geçerlidir. Ödemelerin belirtilen vadelerde yapılması taahhüt edilir.', 'Obowiązują standardowe warunki umowy. Przekazanie pod klucz zależy od weryfikacji etapów płatności.')}</p>
                  </div>

                  <div className="w-full sm:w-80 bg-slate-50 dark:bg-slate-800/10 print:bg-slate-50 p-4 border border-slate-150 rounded-xl space-y-2 text-right">
                    {(() => {
                      const prevMatCost = (previewProposal.materials || []).reduce((sum, m) => sum + ((m.quantity || 0) * (m.unitPrice || 0)), 0);
                      const prevLaborCost = previewProposal.laborPrice !== undefined ? previewProposal.laborPrice : Math.max(0, (previewProposal.totalProjectPrice || 0) - prevMatCost);
                      return (
                        <>
                          {prevMatCost > 0 ? (
                            <>
                              <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300 print:text-slate-600">
                                <span>{t('Labor & Works:', 'İşçilik ve Hizmet Bedeli:', 'Robocizna i usługi:')}</span>
                                <strong className="font-mono text-slate-800 dark:text-slate-200 print:text-black">{formatMoney(prevLaborCost, settings)}</strong>
                              </div>
                              <div className="flex justify-between font-medium text-amber-700 dark:text-amber-400 print:text-amber-700">
                                <span>{t('Materials Cost:', 'Malzeme Tutarı:', 'Koszty materiałów:')}</span>
                                <strong className="font-mono">{formatMoney(prevMatCost, settings)}</strong>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between font-medium text-slate-600">
                              <span>{t('Remodeling Base Total:', 'Teklif Temel Bedeli:', 'Częściowa sumaryczna:')}</span>
                              <strong className="font-mono text-slate-800 dark:text-slate-200 print:text-black">{formatMoney(previewProposal.totalProjectPrice, settings)}</strong>
                            </div>
                          )}
                          <div className="flex justify-between font-medium text-slate-400">
                            <span>{t('VAT / KDV (Exempt/0%):', 'KDV İndirimi (%0):', 'Podatek VAT (%0):')}</span>
                            <strong className="font-mono">{formatMoney(0, settings)}</strong>
                          </div>
                          <div className="h-px bg-slate-200 my-2" />
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm font-black text-slate-850 dark:text-white print:text-black uppercase">{t('Proposed Net Total:', 'Teklif Toplam Bedeli:', 'Ostateczny koszt netto:')}</span>
                            <strong className="font-mono text-base font-black text-amber-500">
                              {formatMoney(previewProposal.totalProjectPrice, settings)}
                            </strong>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Acceptance signs */}
                <div className="grid grid-cols-2 gap-8 pt-8 mt-8 border-t border-dashed border-slate-200 text-center text-xs">
                  <div className="space-y-12">
                    <p className="text-slate-400 italic block">{t('Prepared & Authorized by', 'Teklifi Hazırlayan Müteahhit', 'Przygotowane przez')}</p>
                    <div className="border-t border-slate-205 pt-2 font-bold text-slate-700 dark:text-slate-200 print:text-black">
                      {userProfile?.name || 'Ustam Contractor Signature'}
                    </div>
                  </div>

                  <div className="space-y-12">
                    <p className="text-slate-400 italic block">{t('Approval Signature of Client', 'Teklif Onaylayan Müşteri', 'Podpis Akceptacyjny Klienta')}</p>
                    <div className="border-t border-slate-205 pt-2 font-bold text-slate-700 dark:text-slate-200 print:text-black">
                      {previewProposal.clientName} {previewProposal.clientCompany ? `(${previewProposal.clientCompany})` : ''}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom, safe confirmation dialogue for proposal-to-project Conversion */}
      <AnimatePresence>
        {proposalToConvert && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-5"
            >
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <Printer className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('Instantiate Project?', 'Proje Otomatik Oluşturulsun Mu?', 'Uruchomić projekt?')}
                </h3>
                {proposalToConvert.convertedToProjectId ? (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-500 bg-amber-500/10 p-3 rounded-xl">
                    ⚠️ {t(
                      'Warning: This proposal was already converted into a project. Creating a new project again will set up duplicate project specifications. Do you want to proceed?',
                      'Uyarı: Bu teklif daha önce bir projeye dönüştürülmüştü. Tekrar proje oluşturmak, yinelenen şantiye görevleri ve malzeme listesi oluşturacaktır. Yine de devam etmek istiyor musunuz?',
                      'Uwaga: Ta oferta została już przekształcona w projekt. Ponowne kliknięcie może utworzyć zduplikowane zadania. Czy chcesz kontynuować?'
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    {t(
                      'Are you sure you want to automatically instantiate a live Project with all tasks and materials checks loaded from this proposal?', 
                      'Bu bütçe ve görev listesi teklifini resmi şantiye projesine çevirmek ister misiniz? Bu işlem, ilgili proje ve işleri otomatik olarak oluşturacaktır.', 
                      'Czy na pewno chcesz automatycznie skonfigurować projekt z zadaniami i materiałami z tej oferty?'
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-3 justify-center text-xs pt-2">
                <button
                  onClick={() => setProposalToConvert(null)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-350 font-bold cursor-pointer"
                >
                  {t('Cancel', 'İptal', 'Anuluj')}
                </button>
                <button
                  onClick={() => executeConvertProposalToProject(proposalToConvert)}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl cursor-pointer"
                >
                  {t('Yes, Create', 'Evet, Oluştur', 'Tak, utwórz')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom, safe confirmation dialogue for proposal Deletion */}
      <AnimatePresence>
        {proposalToDelete && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-2xl max-w-md w-full text-center space-y-5"
            >
              <div className="mx-auto w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                <X className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('Delete Proposal?', 'Teklifi Sil?', 'Usunąć ofertę?')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'Are you sure you want to permanently delete this quote? This action cannot be undone.', 
                    'Bu fiyat teklifini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', 
                    'Czy na pewno chcesz na stałe usunąć tę ofertę? Tej operacji nie można cofnąć.'
                  )}
                </p>
              </div>
              <div className="flex gap-3 justify-center text-xs pt-2">
                <button
                  onClick={() => setProposalToDelete(null)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-600 dark:text-slate-350 font-bold cursor-pointer"
                >
                  {t('Cancel', 'İptal', 'Anuluj')}
                </button>
                <button
                  onClick={() => executeDeleteProposal(proposalToDelete)}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl cursor-pointer"
                >
                  {t('Delete', 'Sil', 'Usuń')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Styled Printable specific CSS blocks injected strictly to avoid side fxs */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #proposal-printable-invoice, #proposal-printable-invoice * {
            visibility: visible;
          }
          #proposal-printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          /* Dark mode overrides forced for prints */
          #proposal-printable-invoice {
            color: #000000 !important;
            background: #ffffff !important;
          }
        }
      `}</style>
    </div>
  );
}
