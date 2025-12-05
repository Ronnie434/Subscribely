// @ts-ignore - expo-localization may not have types
import * as Localization from 'expo-localization';

/**
 * Currency interface defining supported currencies
 */
export interface Currency {
  code: string;
  symbol: string;
  name: string;
  symbolNative: string;
  decimalDigits: number;
  rounding: number;
  namePlural: string;
}

/**
 * Supported currencies for the app
 * Includes ~20 major world currencies
 */
export const SUPPORTED_CURRENCIES: Currency[] = [
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'US dollars',
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    symbolNative: '€',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'euros',
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    symbolNative: '£',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'British pounds',
  },
  {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    symbolNative: '¥',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'Japanese yen',
  },
  {
    code: 'CAD',
    symbol: 'CA$',
    name: 'Canadian Dollar',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Canadian dollars',
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Australian dollars',
  },
  {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    symbolNative: 'CHF',
    decimalDigits: 2,
    rounding: 0.05,
    namePlural: 'Swiss francs',
  },
  {
    code: 'CNY',
    symbol: '¥',
    name: 'Chinese Yuan',
    symbolNative: '¥',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Chinese yuan',
  },
  {
    code: 'INR',
    symbol: '₹',
    name: 'Indian Rupee',
    symbolNative: '₹',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Indian rupees',
  },
  {
    code: 'MXN',
    symbol: 'MX$',
    name: 'Mexican Peso',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Mexican pesos',
  },
  {
    code: 'BRL',
    symbol: 'R$',
    name: 'Brazilian Real',
    symbolNative: 'R$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Brazilian reals',
  },
  {
    code: 'KRW',
    symbol: '₩',
    name: 'South Korean Won',
    symbolNative: '₩',
    decimalDigits: 0,
    rounding: 0,
    namePlural: 'South Korean won',
  },
  {
    code: 'SGD',
    symbol: 'S$',
    name: 'Singapore Dollar',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Singapore dollars',
  },
  {
    code: 'NZD',
    symbol: 'NZ$',
    name: 'New Zealand Dollar',
    symbolNative: '$',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'New Zealand dollars',
  },
  {
    code: 'SEK',
    symbol: 'kr',
    name: 'Swedish Krona',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Swedish kronor',
  },
  {
    code: 'NOK',
    symbol: 'kr',
    name: 'Norwegian Krone',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Norwegian kroner',
  },
  {
    code: 'DKK',
    symbol: 'kr',
    name: 'Danish Krone',
    symbolNative: 'kr',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Danish kroner',
  },
  {
    code: 'PLN',
    symbol: 'zł',
    name: 'Polish Zloty',
    symbolNative: 'zł',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Polish zlotys',
  },
  {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    symbolNative: '฿',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'Thai baht',
  },
  {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    symbolNative: 'R',
    decimalDigits: 2,
    rounding: 0,
    namePlural: 'South African rand',
  },
];

/**
 * Map of country codes to currency codes for locale detection
 */
const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  EU: 'EUR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
  GR: 'EUR',
  JP: 'JPY',
  CA: 'CAD',
  AU: 'AUD',
  CH: 'CHF',
  CN: 'CNY',
  IN: 'INR',
  MX: 'MXN',
  BR: 'BRL',
  KR: 'KRW',
  SG: 'SGD',
  NZ: 'NZD',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  TH: 'THB',
  ZA: 'ZAR',
};

/**
 * Get currency by code
 */
export const getCurrencyByCode = (code: string): Currency | undefined => {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
};

/**
 * Get currency symbol by code
 */
export const getCurrencySymbol = (code: string): string => {
  const currency = getCurrencyByCode(code);
  return currency?.symbol || '$';
};

/**
 * Get native currency symbol by code (used in the country of origin)
 */
export const getNativeCurrencySymbol = (code: string): string => {
  const currency = getCurrencyByCode(code);
  return currency?.symbolNative || '$';
};

/**
 * Format a number as currency
 */
export const formatCurrency = (
  amount: number,
  currencyCode: string,
  options?: {
    useNativeSymbol?: boolean;
    showCode?: boolean;
  }
): string => {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `$${amount.toFixed(2)}`;
  }

  const symbol = options?.useNativeSymbol ? currency.symbolNative : currency.symbol;
  const formattedAmount = amount.toFixed(currency.decimalDigits);

  if (options?.showCode) {
    return `${symbol}${formattedAmount} ${currency.code}`;
  }

  return `${symbol}${formattedAmount}`;
};

/**
 * Detect default currency based on device locale
 * Returns currency code (e.g., 'USD', 'EUR', 'GBP')
 */
export const detectDefaultCurrency = (): string => {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const primaryLocale = locales[0];

      // Try to get currency from locale's currency code first
      if (primaryLocale.currencyCode) {
        const currency = getCurrencyByCode(primaryLocale.currencyCode);
        if (currency) {
          return primaryLocale.currencyCode;
        }
      }

      // Fallback to country code mapping
      if (primaryLocale.regionCode) {
        const currencyCode = COUNTRY_TO_CURRENCY[primaryLocale.regionCode];
        if (currencyCode) {
          return currencyCode;
        }
      }
    }
  } catch (error) {
    console.error('Error detecting default currency:', error);
  }

  // Default to USD if detection fails
  return 'USD';
};

/**
 * Validate if a currency code is supported
 */
export const isSupportedCurrency = (code: string): boolean => {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
};

/**
 * Get all currency codes
 */
export const getAllCurrencyCodes = (): string[] => {
  return SUPPORTED_CURRENCIES.map((c) => c.code);
};

/**
 * Get currency name by code
 */
export const getCurrencyName = (code: string): string => {
  const currency = getCurrencyByCode(code);
  return currency?.name || 'Unknown Currency';
};

/**
 * Format currency for display in lists (shorter format)
 */
export const formatCurrencyCompact = (amount: number, currencyCode: string): string => {
  const currency = getCurrencyByCode(currencyCode);
  if (!currency) {
    return `$${amount.toFixed(2)}`;
  }

  const symbol = currency.symbolNative;
  const formattedAmount = amount.toFixed(currency.decimalDigits);

  return `${symbol}${formattedAmount}`;
};