import { AppSettings } from './types';

export function getCurrencySymbol(currency: 'TRY' | 'USD' | 'EUR' | 'PLN'): string {
  switch (currency) {
    case 'USD':
      return '$';
    case 'EUR':
      return '€';
    case 'PLN':
      return 'zł';
    default:
      return '₺';
  }
}

/**
 * Formats a financial value based on the user's currency, language, and decimal preferences.
 */
export function formatMoney(val: number, settings: AppSettings): string {
  const symbol = getCurrencySymbol(settings.currency);
  const locale = settings.lang === 'tr' ? 'tr-TR' : (settings.lang === 'pl' ? 'pl-PL' : 'en-US');
  
  const formattedValue = val.toLocaleString(locale, {
    minimumFractionDigits: settings.decimalPlaces,
    maximumFractionDigits: settings.decimalPlaces,
  });

  // Display symbol after for TR/TRY, before for EN/USD/EUR if preferred, or standard suffix
  return `${formattedValue} ${symbol}`;
}

/**
 * Lightweight translation helper for navigating primary titles or menus.
 */
export function getTranslatedLabel(key: string, lang: 'tr' | 'en' | 'pl'): string {
  const dict: Record<string, { tr: string; en: string; pl: string }> = {
    dashboard: { tr: 'Genel Kontrol Paneli', en: 'Dashboard Overview', pl: 'Panel Główny' },
    projects: { tr: 'Projeler & Görevler', en: 'Projects & Tasks', pl: 'Projekty i Zadania' },
    proposals: { tr: 'Teklifler & Hazırlık', en: 'Quotations & Proposals', pl: 'Oferty i Wyceny' },
    budget: { tr: 'Bütçe & Malzemeler', en: 'Budget & Materials', pl: 'Budżet i Materiały' },
    accounting: { tr: 'Muhasebe Defteri', en: 'Accounting Ledger', pl: 'Księga Rachunkowa' },
    settings: { tr: 'Uygulama Ayarları', en: 'System Settings', pl: 'Ustawienia Systemu' },
  };
  
  return dict[key] ? dict[key][lang] : key;
}

/**
 * Consistently format date inputs into custom user format or standard Day / Month / Year format (DD/MM/YYYY)
 */
export function formatDate(dateString: string, langOrSettings?: 'tr' | 'en' | 'pl' | AppSettings): string {
  if (!dateString) return '';
  
  let d: Date;
  let dateFormat = 'DD/MM/YYYY';

  if (langOrSettings && typeof langOrSettings === 'object') {
    dateFormat = langOrSettings.dateFormat || 'DD/MM/YYYY';
  }
  
  if (typeof dateString === 'string') {
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        // Handle "YYYY-MM-DD" safely without timezone offset shift
        if (parts[0].length === 4) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);
          const day = parseInt(parts[2], 10);
          d = new Date(year, month - 1, day);
        } else {
          d = new Date(dateString);
        }
      } else {
        d = new Date(dateString);
      }
    } else if (dateString.includes('.')) {
      const parts = dateString.split('.');
      if (parts.length === 3) {
        // Handle "DD.MM.YYYY"
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(dateString);
      }
    } else if (dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        // Since we are formatting to DD/MM/YYYY, assume inputs with slashes are formatted similarly or check safely
        const token1 = parseInt(parts[0], 10);
        const token2 = parseInt(parts[1], 10);
        const token3 = parseInt(parts[2], 10);
        if (token3 > 1000) {
          // It's DD/MM/YYYY or MM/DD/YYYY
          if (token1 > 12) {
            // Must be DD/MM/YYYY
            d = new Date(token3, token2 - 1, token1);
          } else {
            // Ambiguous but respect user's requested day/month/year priority
            d = new Date(token3, token2 - 1, token1);
          }
        } else {
          d = new Date(dateString);
        }
      } else {
        d = new Date(dateString);
      }
    } else {
      d = new Date(dateString);
    }
  } else {
    d = new Date(dateString);
  }

  if (isNaN(d.getTime())) return dateString;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  if (dateFormat === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  } else if (dateFormat === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  } else if (dateFormat === 'DD.MM.YYYY') {
    return `${day}.${month}.${year}`;
  }
  
  return `${day}/${month}/${year}`;
}

/**
 * Converts a DD/MM/YYYY text input format back to standard YYYY-MM-DD for database storage and sorting.
 * If the input doesn't match DD/MM/YYYY, it attempts standard parsing or returns original.
 */
export function toDbDate(displayString: string): string {
  if (!displayString) return '';
  const trimmed = displayString.trim();
  
  // If it's already YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Handle DD/MM/YYYY or DD.MM.YYYY
  const match = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }
  
  // Fallback to parsing as Date
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }
  
  return trimmed;
}

/**
 * Dynamic mapping to translate database category names to selected system language on-the-fly.
 */
export function translateCategory(cat: string, lang: 'tr' | 'en' | 'pl'): string {
  if (!cat) return cat;
  const dict: Record<string, { tr: string; en: string; pl: string }> = {
    // Expense / Material Categories
    'Kaba İnşaat': { tr: 'Kaba İnşaat', en: 'Rough Construction', pl: 'Stan surowy' },
    'Kaba İnşaat Malzemesi': { tr: 'Kaba İnşaat Malzemesi', en: 'Rough Construction Material', pl: 'Materiały stanu surowego' },
    'Tesisat (Elektrik/Su)': { tr: 'Tesisat (Elektrik/Su)', en: 'Plumbing & Electrical', pl: 'Instalacje (elektr./wod.)' },
    'Tesisat & Altyapı': { tr: 'Tesisat & Altyapı', en: 'Plumbing & Infrastructure', pl: 'Instalacje i infrastruktura' },
    'Zemin & Seramik': { tr: 'Zemin & Seramik', en: 'Flooring & Ceramics', pl: 'Podłogi i ceramika' },
    'Boya & Badana': { tr: 'Boya & Badana', en: 'Painting & Plastering', pl: 'Malowanie i gładź' },
    'Aydınlatma & Elektrik': { tr: 'Aydınlatma & Elektrik', en: 'Lighting & Electrical', pl: 'Oświetlenie i elektryka' },
    'Aydınlatma & Aksesuar': { tr: 'Aydınlatma & Aksesuar', en: 'Lighting & Accessories', pl: 'Oświetlenie i akcesoria' },
    'Mobilya & Dolap': { tr: 'Mobilya & Dolap', en: 'Furniture & Cabinets', pl: 'Meble i szafki' },
    'Mobilya & Dolap Kapakları': { tr: 'Mobilya & Dolap Kapakları', en: 'Furniture & Cabinet Doors', pl: 'Meble i fronty szafek' },
    'Hizmet & İşçilik': { tr: 'Hizmet & İşçilik', en: 'Labour & Services', pl: 'Robocizna i usługi' },
    'Usta İşçilik & Hizmet': { tr: 'Usta İşçilik & Hizmet', en: 'Labour & Craftsmanship', pl: 'Robocizna i usługi rzemieślnicze' },
    'Taşıma & Nakliye & Moloz': { tr: 'Taşıma & Nakliye & Moloz', en: 'Transport & Rubble Disposal', pl: 'Transport i wywóz gruzu' },
    'Ruhsat & Belediye & Harç': { tr: 'Ruhsat & Belediye & Harç', en: 'Permit & Municipality Fees', pl: 'Pozwolenia i opłaty' },
    'Diğer': { tr: 'Diğer', en: 'Other', pl: 'Inne' },
    'Diğer Giderler': { tr: 'Diğer Giderler', en: 'Other Expenses', pl: 'Inne wydatki' },
    
    // Income Categories
    'Bütçe Aktarımı': { tr: 'Bütçe Aktarımı', en: 'Budget Allocation', pl: 'Przelew budżetowy' },
    'Banka Kredisi': { tr: 'Banka Kredisi', en: 'Bank Loan', pl: 'Kredyt bankowy' },
    'Ortak Sermaye': { tr: 'Ortak Sermaye', en: 'Shared Capital', pl: 'Wspólny kapitał' },
    'Yedek Akçe': { tr: 'Yedek Akçe', en: 'Emergency Reserves', pl: 'Rezerwa awaryjna' },
    'Müşteri Hak Edişi': { tr: 'Müşteri Hak Edişi', en: 'Client Progress Payment', pl: 'Płatność od klienta' },
    'Diğer Gelirler': { tr: 'Diğer Gelirler', en: 'Other Incomes', pl: 'Inne przychody' }
  };
  
  return dict[cat] ? dict[cat][lang] : cat;
}


