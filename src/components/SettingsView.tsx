import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Coins, 
  Sun, 
  Moon, 
  Clock, 
  Percent, 
  AlertTriangle, 
  Database, 
  RotateCcw, 
  Download, 
  Upload, 
  Check, 
  Sliders, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  User,
  LogOut
} from 'lucide-react';
import { motion } from 'motion/react';
import { AppSettings } from '../types';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetAllData: () => void;
  exportDataJson: string;
  onImportBackup: (backup: any) => boolean;
  currentUser?: { name: string; email: string; role: string; company: string; avatarUrl: string };
  onUpdateUser?: (user: { name: string; email: string; role: string; company: string; avatarUrl: string }) => void;
  onLogout?: () => void;
}

const COMMON_TIMEZONES = [
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (CET/CEST)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'US/Eastern', label: 'US/Eastern (EST/EDT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
];

export default function SettingsView({
  settings,
  onUpdateSettings,
  onResetAllData,
  exportDataJson,
  onImportBackup,
  currentUser,
  onUpdateUser,
  onLogout
}: SettingsViewProps) {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const [profileName, setProfileName] = useState(currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || '');
  const [profileCompany, setProfileCompany] = useState(currentUser?.company || '');
  const [profileRole, setProfileRole] = useState(currentUser?.role || '');

  const t = (key: string) => {
    const lang = settings.lang || 'en';
    const dict: Record<string, { tr: string; en: string; pl: string }> = {
      title: { tr: 'Uygulama Ayarları', en: 'Application Settings', pl: 'Ustawienia Aplikacji' },
      subtitle: { tr: 'Sistem dilini, para birimini, bütçe uyarılarını ve veri yedeklerini buradan kontrol edin.', en: 'Control system language, currency, budget warnings, and data backups here.', pl: 'Kontroluj język systemu, walutę, ostrzeżenia o budżecie i kopie zapasowe danych.' },
      
      // Sections
      general: { tr: 'Genel Tanımlamalar', en: 'General Configurations', pl: 'Ogólne Konfiguracje' },
      appearance: { tr: 'Görünüm ve Arayüz', en: 'Appearance & UI', pl: 'Wygląd i Interfejs' },
      financial: { tr: 'Mali & Bütçe Kuralları', en: 'Financial & Budget Rules', pl: 'Zasady Finansowe i Budżetowe' },
      dataManagement: { tr: 'Veri ve Güvenlik Yönetimi', en: 'Data & Security Management', pl: 'Zarządzanie Danymi i Bezpieczeństwem' },
      
      // Fields
      langLabel: { tr: 'Sistem Dili', en: 'System Language', pl: 'Język Systemu' },
      langDesc: { tr: 'Tüm menüler, tablolar ve raporlarda kullanılacak dil.', en: 'Language used in menus, tables, and reports.', pl: 'Język używany w menu, tabelach i raportach.' },
      currencyLabel: { tr: 'Varsayılan Para Birimi', en: 'Default Currency', pl: 'Domyślna Waluta' },
      currencyDesc: { tr: 'Tüm bütçe, bakiye ve mali hesaplamalarda kullanılan simge.', en: 'Symbol used in budgets, balances, and reports.', pl: 'Symbol używany w budżetach, saldach i raportach.' },
      timezoneLabel: { tr: 'Zaman Dilimi', en: 'Timezone', pl: 'Strefa Czasowa' },
      timezoneDesc: { tr: 'Görev teslim tarihleri ve işlem saat dilimi ayarı.', en: 'Used for task deadlines and ledger logs timezone.', pl: 'Używane do terminów zadań i strefy czasowej księgi.' },
      
      dateFormatLabel: { tr: 'Tarih Formatı', en: 'Date Format', pl: 'Format Daty' },
      dateFormatDesc: { tr: 'Uygulamadaki tüm tarih görünümlerinin biçimlendirilme standardı.', en: 'Standard formatting for all date displays in the application.', pl: 'Standardowe formatowanie dat w całej aplikacji.' },
      
      themeLabel: { tr: 'Görünüm Modu', en: 'Theme Mode', pl: 'Tryb Wyglądu' },
      themeDesc: { tr: 'Görüntüleme modunu açık veya karanlık olarak ayarlayın.', en: 'Toggle application theme between light and dark.', pl: 'Przełącz motyw aplikacji między jasnym a ciemnym.' },
      themeLight: { tr: 'Aydınlık Şablon', en: 'Light Template', pl: 'Jasny Szablon' },
      themeDark: { tr: 'Karanlık Şablon', en: 'Dark Template', pl: 'Ciemny Szablon' },
      
      welcomeBanner: { tr: 'Genel Karşılama Paneli', en: 'Welcome Dashboard Header', pl: 'Nagłówek Pulpitu Powitalnego' },
      welcomeBannerDesc: { tr: 'Genel kontrol panelinde bilgi özet başlığını göster.', en: 'Show information summary card in dashboard.', pl: 'Pokaż podsumowanie informacji na pulpicie nawigacyjnym.' },
      
      vatLabel: { tr: 'Varsayılan KDV Oranı (%)', en: 'Default VAT Rate (%)', pl: 'Domyślna stawka VAT (%)' },
      vatDesc: { tr: 'Yeni malzeme eklerken önerilen vergi oranı çarpanı.', en: 'Proposed tax rate multiplier when introducing materials.', pl: 'Proponowany mnożnik podatku przy dodawaniu materiałów.' },
      warningThreshold: { tr: 'Bütçe Aşım Uyarı Eşiği (%)', en: 'Budget Overrun Limit (%)', pl: 'Limit Przekroczenia Budżetu (%)' },
      warningThresholdDesc: { tr: 'Proje harcamaları bu oranı geçerse kırmızı uyarı gösterilir.', en: 'Highlight project card in crimson if budget usage percentage exceeds this.', pl: 'Wyróżnij projekt na czerwono, jeśli zużycie budżetu przekroczy tę wartość.' },
      decimals: { tr: 'Kuruş Gösterimi / Duyarlılık', en: 'Decimal Precision', pl: 'Precyzja Dziesiętna' },
      decimalsDesc: { tr: 'Parasal değerlerin küsuratlı (kuruşlu) gösterilme biçimi.', en: 'Format in which financial values show decimal parts.', pl: 'Format, w jakim wartości finansowe pokazują części dziesiętne.' },
      decimalsNo: { tr: 'Kuruşsuz (örn. 1.500 ₺)', en: 'No Decimals (e.g., 1,500 ₺)', pl: 'Bez Groszy (np. 1 500 zł)' },
      decimalsYes: { tr: 'Kuruşlu (örn. 1.500,00 ₺)', en: 'With Decimals (e.g., 1,500.00 ₺)', pl: 'Z Groszami (np. 1 500,00 zł)' },
      
      autoSync: { tr: 'Otomatik Muhasebe Entegrasyonu', en: 'Automatic Accounting Ledger Sync', pl: 'Automatyczna Synchronizacja Księgi' },
      autoSyncDesc: { tr: 'Alınan malzemeler ödendi olarak işaretlendiğinde gider defterine otomatik masraf kaydı ekle.', en: 'Automatically inject transaction expense when purchased materials are paid.', pl: 'Automatycznie dodaj wydatek, gdy zakupione materiały zostaną opłacone.' },
      
      exportData: { tr: 'Verileri Dışarı Aktar', en: 'Export Full System Data', pl: 'Eksportuj Pełne Dane Systemu' },
      exportDataDesc: { tr: 'Tüm projelerinizi, görevleri ve bütçe verilerinizi JSON formatında yedekleyin.', en: 'Download all project logs, tasks, and budgets as a lightweight JSON backup.', pl: 'Pobierz wszystkie projekty, zadania i budżety jako plik JSON.' },
      exportBtn: { tr: 'Yedek Dosyasını İndir (JSON)', en: 'Download Backup JSON', pl: 'Pobierz Kopię Zapasową JSON' },
      copyJsonBtn: { tr: 'Panoya Kopyala', en: 'Copy JSON Draft', pl: 'Kopiuj Szkic JSON' },
      
      importData: { tr: 'Yedekten Geri Yükle', en: 'Restore from Backup', pl: 'Przywróć z Kopii Zapasowej' },
      importDataDesc: { tr: 'Önceden indirdiğiniz bir sistem yedeğini veya JSON verisini geri yükleyin.', en: 'Load a saved system state or custom database payload.', pl: 'Wczytaj zapisany stan systemu lub niestandardowe dane JSON.' },
      importBtn: { tr: 'Yedek Yükle panelini Aç', en: 'Open JSON Loader Console', pl: 'Otwórz konsolę ładowania JSON' },
      importSubmit: { tr: 'Yüklemeyi Doğrula ve Tamamla', en: 'Verify and Apply Database Import', pl: 'Zweryfikuj i zastosuj import bazy danych' },
      importError: { tr: 'Hata! Geçersiz yedek JSON yapısı girdiniz.', en: 'Error! You entered an invalid backup JSON structure.', pl: 'Błąd! Wprowadzono nieprawidłową strukturę JSON kopii zapasowej.' },
      importSuccess: { tr: 'Tebrikler! Veriler başarıyla içe aktarıldı.', en: 'Congratulations! Database successfully loaded.', pl: 'Gratulacje! Baza danych została pomyślnie wczytana.' },
      
      resetData: { tr: 'Sistem Verilerini Sıfırla (Fabrika Ayarları)', en: 'Reset All Local Accounts', pl: 'Zresetuj Wszystkie Konta Lokalne' },
      resetDataDesc: { tr: 'Cihazınızdaki tüm proje, faaliyet ve harcamaları temizleyerek uygulamayı ilk veri şablonuna döndürür.', en: 'Destroys all local storage logs and returns applet database to blank skeleton.', pl: 'Usuwa wszystkie lokalne dane i przywraca aplikację do pustego stanu.' },
      resetBtn: { tr: 'Tüm Veriyi Sıfırla', en: 'Destroy All Local Database', pl: 'Zniszcz Wszystkie Dane' },
      resetConfirmTitle: { tr: 'Emin misiniz? Geri Dönüşü Yoktur!', en: 'Are you absolutely sure? This cannot be undone!', pl: 'Czy jesteś absolutnie pewien? Tego nie można cofnąć!' },
      resetConfirmDesc: { tr: 'Bu işlem cihazda kayıtlı tüm projeleri, görevleri, malzeme kalemlerini ve muhasebe kayıtlarını kalıcı olarak siler ve ilk örnek veriyi yükler.', en: 'This will wipe out all project documents, expense entries, tasks and install standard demo logs.', pl: 'To spowoduje usunięcie wszystkich projektów, wydatków, zadań i zainstalowanie standardowych danych demonstracyjnych.' },
      resetDangerVerifyBtn: { tr: 'Sıfırlamayı Kabul Ediyorum, Her Şeyi Sil', en: 'Yes, Destroy All Data', pl: 'Tak, zniszcz wszystkie dane' },
      
      saveSuccess: { tr: 'Ayarlarınız başarıyla kaydedildi!', en: 'System settings successfully updated!', pl: 'Ustawienia systemu zostały pomyślnie zaktualizowane!' },
      cancel: { tr: 'Vazgeç', en: 'Cancel', pl: 'Anuluj' },
      active: { tr: 'Aktif', en: 'Active', pl: 'Aktywne' },
      inactive: { tr: 'Pasif', en: 'Inactive', pl: 'Nieaktywne' },
    };
    if (lang === 'tr') return dict[key] ? dict[key].tr : key;
    if (lang === 'pl') return dict[key] ? dict[key].pl : key;
    return dict[key] ? dict[key].en : key;
  };

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const nextSettings = { ...settings, [key]: value };
    onUpdateSettings(nextSettings);
    triggerSuccess();
  };

  const triggerSuccess = () => {
    setSuccessMsg(t('saveSuccess'));
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(exportDataJson);
    setSuccessMsg(
      settings.lang === 'en' 
        ? 'JSON copied to clipboard!' 
        : (settings.lang === 'pl' ? 'Skopiowano JSON do schowka!' : 'JSON verisi panoya kopyalandı!')
    );
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([exportDataJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ustatakip_tadilat_yedek_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerSuccess();
  };

  const handleImportTextSubmit = () => {
    try {
      const parsed = JSON.parse(importText);
      const isOk = onImportBackup(parsed);
      if (isOk) {
        setSuccessMsg(t('importSuccess'));
        setImportText('');
        setShowImportArea(false);
        setErrorMsg(null);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(t('importError'));
      }
    } catch (e) {
      setErrorMsg(t('importError'));
    }
  };

  return (
    <div className="space-y-8" id="settings-view-container">
      {/* Settings Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white text-slate-900 rounded-xl p-6 md:p-8 border border-slate-200 shadow-xs">
        <div className="space-y-1">
          <span className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wider px-3 py-1 rounded-full">
            {settings.lang === 'tr' ? 'Kontrol Paneli Altyapısı' : 'Platform Configurations'}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-blue-600 animate-spin-slow" /> {t('title')}
          </h1>
          <p className="text-slate-500 text-sm md:text-base font-normal max-w-xl">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {successMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl p-4 text-sm font-semibold flex items-center gap-2"
        >
          <Check className="w-5 h-5 text-emerald-600" /> {successMsg}
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4 text-sm font-semibold flex items-center gap-2"
        >
          <AlertTriangle className="w-5 h-5 text-red-600" /> {errorMsg}
        </motion.div>
      )}

      {/* CARD: USER PROFILE SETTINGS */}
      {currentUser && onUpdateUser && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500 text-slate-950 rounded-lg shadow-sm">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-105">
                {settings.lang === 'en' ? 'User Profile & Settings' : 'Kullanıcı Hesap Bilgileri'}
              </h2>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1 bg-red-50 hover:bg-red-100 dark:bg-rose-950/20 text-red-600 dark:text-rose-400 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all border border-red-105 dark:border-rose-900/30"
              >
                <LogOut className="w-3.5 h-3.5" />
                {settings.lang === 'en' ? 'Sign Out' : 'Çıkış Yap'}
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 items-center">
            {/* Avatar block with customizable preset images */}
            <div className="flex flex-col items-center gap-2 text-center">
              <img
                referrerPolicy="no-referrer"
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120'}
                alt={currentUser.name}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow-2xs"
              />
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {settings.lang === 'en' ? 'Assigned Duty' : 'Tadilat Görevi'}
                </span>
                <p className="text-[10px] bg-slate-100 dark:bg-slate-800 font-mono text-slate-650 dark:text-slate-300 px-2 py-0.5 rounded-md mt-1">
                  {currentUser.role}
                </p>
              </div>
            </div>

            {/* Editing Inputs */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {settings.lang === 'en' ? 'Full Name' : 'Yayınlanan İsim Soyisim'}
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileName(val);
                    onUpdateUser({ ...currentUser, name: val });
                  }}
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {settings.lang === 'en' ? 'Email Address' : 'E-Posta Adresi'}
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileEmail(val);
                    onUpdateUser({ ...currentUser, email: val });
                  }}
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {settings.lang === 'en' ? 'Company Name / Association' : 'Şirket Adı / Bağlantı'}
                </label>
                <input
                  type="text"
                  value={profileCompany}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileCompany(val);
                    onUpdateUser({ ...currentUser, company: val });
                  }}
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {settings.lang === 'en' ? 'Position / Access Title' : 'Pozisyon / Şantiye Yetkisi'}
                </label>
                <input
                  type="text"
                  value={profileRole}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProfileRole(val);
                    onUpdateUser({ ...currentUser, role: val });
                  }}
                  className="w-full text-sm px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 text-slate-800 dark:text-slate-205 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* LEFT COLUMN: Regional & General Settings */}
        <div className="space-y-6">
          
          {/* Card 1: Regional Preferences */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Globe className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800">{t('general')}</h2>
            </div>

            {/* Language Selection */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('langLabel')}</label>
                <p className="text-xs text-slate-400">{t('langDesc')}</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => updateSetting('lang', 'tr')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    settings.lang === 'tr' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  TR Türkçe
                </button>
                <button
                  onClick={() => updateSetting('lang', 'en')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    settings.lang === 'en' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  EN English
                </button>
                <button
                  onClick={() => updateSetting('lang', 'pl')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                    settings.lang === 'pl' 
                      ? 'bg-white text-blue-600 shadow-xs font-bold' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  PL Polski
                </button>
              </div>
            </div>

            {/* Currency Selection */}
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('currencyLabel')}</label>
                <p className="text-xs text-slate-400">{t('currencyDesc')}</p>
              </div>
              <select
                value={settings.currency}
                onChange={(e) => updateSetting('currency', e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-bold focus:ring-1 focus:ring-blue-600 outline-hidden cursor-pointer"
              >
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="PLN">PLN (zł)</option>
              </select>
            </div>

            {/* Timezone dropdown */}
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('timezoneLabel')}</label>
                <p className="text-xs text-slate-400">{t('timezoneDesc')}</p>
              </div>
              <select
                value={settings.timezone}
                onChange={(e) => updateSetting('timezone', e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 max-w-[180px] focus:ring-1 focus:ring-blue-600 outline-hidden cursor-pointer"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Format dropdown */}
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('dateFormatLabel')}</label>
                <p className="text-xs text-slate-400">{t('dateFormatDesc')}</p>
              </div>
              <select
                value={settings.dateFormat || 'DD/MM/YYYY'}
                onChange={(e) => updateSetting('dateFormat', e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 max-w-[180px] focus:ring-1 focus:ring-blue-600 outline-hidden cursor-pointer font-mono"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (02/06/2026)</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY (02.06.2026)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (06/02/2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2026-06-02)</option>
              </select>
            </div>
          </div>

          {/* Card 2: Visual Interface & Styling Preferences */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Sliders className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800">{t('appearance')}</h2>
            </div>

            {/* Light / Dark Mode Buttons */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('themeLabel')}</label>
                <p className="text-xs text-slate-400">{t('themeDesc')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => updateSetting('theme', 'light')}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    settings.theme === 'light'
                      ? 'bg-blue-50/50 border-blue-600 ring-1 ring-blue-600'
                      : 'bg-slate-50 border-slate-250 hover:bg-slate-100/60'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${settings.theme === 'light' ? 'bg-white text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                    <Sun className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block text-slate-700">{t('themeLight')}</span>
                    <span className="text-[10px] text-slate-400">#F8FAFC Cool Gray</span>
                  </div>
                </button>

                <button
                  onClick={() => updateSetting('theme', 'dark')}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    settings.theme === 'dark'
                      ? 'bg-slate-900 border-slate-700 ring-1 ring-slate-600 text-white'
                      : 'bg-slate-50 border-slate-250 hover:bg-slate-100/60'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${settings.theme === 'dark' ? 'bg-slate-850 text-amber-500' : 'bg-slate-200 text-slate-500'}`}>
                    <Moon className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-bold block">{t('themeDark')}</span>
                    <span className="text-[10px] text-slate-400">#0F172A Deep Slate</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Dashboard Welcome view toggle */}
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('welcomeBanner')}</label>
                <p className="text-xs text-slate-400">{t('welcomeBannerDesc')}</p>
              </div>
              <button
                onClick={() => updateSetting('showWelcomeBanner', !settings.showWelcomeBanner)}
                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              >
                {settings.showWelcomeBanner ? (
                  <ToggleRight className="w-10 h-10 text-blue-600" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-300" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Financial Rules & System Logs Backup */}
        <div className="space-y-6">
          
          {/* Card 3: Fiscal Rules */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Percent className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800">{t('financial')}</h2>
            </div>

            {/* VAT Rate input */}
            <div className="flex justify-between items-center gap-4">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('vatLabel')}</label>
                <p className="text-xs text-slate-400">{t('vatDesc')}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg max-w-[100px]">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.defaultVatRate}
                  onChange={(e) => updateSetting('defaultVatRate', parseFloat(e.target.value) || 0)}
                  className="bg-transparent w-full text-xs font-bold text-slate-700 text-center outline-hidden"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
            </div>

            {/* Warning threshold */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-800">{t('warningThreshold')}</label>
                  <p className="text-xs text-slate-400">{t('warningThresholdDesc')}</p>
                </div>
                <span className="text-sm font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-center min-w-[50px]">
                  %{settings.budgetWarningThreshold}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={settings.budgetWarningThreshold}
                onChange={(e) => updateSetting('budgetWarningThreshold', parseInt(e.target.value))}
                className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Currency Decimals toggle */}
            <div className="flex justify-between items-start gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('decimals')}</label>
                <p className="text-xs text-slate-400">{t('decimalsDesc')}</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => updateSetting('decimalPlaces', 0)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    settings.decimalPlaces === 0 
                      ? 'bg-white text-blue-600 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t('decimalsNo')}
                </button>
                <button
                  onClick={() => updateSetting('decimalPlaces', 2)}
                  className={`px-3 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    settings.decimalPlaces === 2 
                      ? 'bg-white text-blue-600 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t('decimalsYes')}
                </button>
              </div>
            </div>

            {/* Auto Ledger Sync Switch */}
            <div className="flex justify-between items-start gap-4 pt-4 border-t border-slate-100">
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-800">{t('autoSync')}</label>
                <p className="text-xs text-slate-400">{t('autoSyncDesc')}</p>
              </div>
              <button
                onClick={() => updateSetting('autoSyncMaterialToLedger', !settings.autoSyncMaterialToLedger)}
                className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
              >
                {settings.autoSyncMaterialToLedger ? (
                  <ToggleRight className="w-10 h-10 text-blue-600" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-slate-300" />
                )}
              </button>
            </div>
          </div>

          {/* Card 4: Backup, Import, Factoty Defaults */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Database className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-800">{t('dataManagement')}</h2>
            </div>

            {/* Backups buttons */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-800">{t('exportData')}</label>
              <p className="text-xs text-slate-400">{t('exportDataDesc')}</p>
              
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleDownloadBackup}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold px-4 py-2.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" /> {t('exportBtn')}
                </button>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold px-4 py-2.5 transition-colors cursor-pointer"
                >
                  {t('copyJsonBtn')}
                </button>
              </div>
            </div>

            {/* Import JSON */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-start">
                <div>
                  <label className="text-sm font-bold text-slate-800 block">{t('importData')}</label>
                  <p className="text-xs text-slate-400">{t('importDataDesc')}</p>
                </div>
                <button
                  onClick={() => setShowImportArea(!showImportArea)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  {showImportArea ? t('cancel') : t('importBtn')}
                </button>
              </div>

              {showImportArea && (
                <div className="space-y-3 pt-1">
                  <textarea
                    placeholder='{"projects": [...], "tasks": [...]}'
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-750 font-mono outline-hidden focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    onClick={handleImportTextSubmit}
                    disabled={!importText.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-xs"
                  >
                    <Upload className="w-3.5 h-3.5" /> {t('importSubmit')}
                  </button>
                </div>
              )}
            </div>

            {/* Factor Default Factory Reset */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-red-650 block text-red-600">{t('resetData')}</label>
                  <p className="text-xs text-slate-400 leading-relaxed">{t('resetDataDesc')}</p>
                </div>
                {!showConfirmReset && (
                  <button
                    onClick={() => {
                      setShowConfirmReset(true);
                      setShowImportArea(false);
                    }}
                    className="flex-shrink-0 flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold py-1.5 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {settings.lang === 'en' ? 'Reset' : 'Sıfırla'}
                  </button>
                )}
              </div>

              {showConfirmReset && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold">{t('resetConfirmTitle')}</h4>
                      <p className="text-[11px] text-red-650 opacity-90 leading-relaxed mt-1">
                        {t('resetConfirmDesc')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowConfirmReset(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-md text-xs font-semibold transition-colors cursor-pointer hover:bg-slate-50"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      id="factory-reset-action-btn"
                      onClick={() => {
                        onResetAllData();
                        setShowConfirmReset(false);
                        triggerSuccess();
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-semibold transition-colors cursor-pointer hover:bg-red-700 shadow-xs text-center"
                    >
                      {t('resetDangerVerifyBtn')}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
