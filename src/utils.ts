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
  const locale = settings.lang === 'tr' ? 'tr-TR' : 'en-US';
  
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
export function getTranslatedLabel(key: string, lang: 'tr' | 'en'): string {
  const dict: Record<string, { tr: string; en: string }> = {
    dashboard: { tr: 'Genel Kontrol Paneli', en: 'Dashboard Overview' },
    projects: { tr: 'Projeler & Görevler', en: 'Projects & Tasks' },
    budget: { tr: 'Bütçe & Malzemeler', en: 'Budget & Materials' },
    accounting: { tr: 'Muhasebe Defteri', en: 'Accounting Ledger' },
    settings: { tr: 'Uygulama Ayarları', en: 'System Settings' },
  };
  
  return dict[key] ? (lang === 'en' ? dict[key].en : dict[key].tr) : key;
}

/**
 * Consistently format date inputs into Day / Month / Year format (DD/MM/YYYY)
 */
export function formatDate(dateString: string, lang: 'tr' | 'en' = 'tr'): string {
  if (!dateString) return '';
  
  let d: Date;
  
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
  
  return `${day}/${month}/${year}`;
}

