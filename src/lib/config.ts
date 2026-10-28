/**
 * App-wide configuration constants for Kofschip.
 */
export const APP_CONFIG = {
  /** App display name */
  name: 'Kofschip',

  /** App tagline */
  tagline: 'Master Dutch Verbs',

  /** Free tier daily scan limit */
  freeDailyScanLimit: Number(import.meta.env.VITE_FREE_DAILY_SCAN_LIMIT) || 3,

  /** Premium lifetime price */
  premiumPrice: Number(import.meta.env.VITE_PREMIUM_PRICE) || 14.99,
  premiumCurrency: import.meta.env.VITE_PREMIUM_CURRENCY || 'EUR',

  /** CEFR levels supported */
  levels: ['A1', 'A2', 'B1', 'B2'] as const,

  /** Supported source languages for grammar coaching (ISO 639-1) */
  nativeLanguages: [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
    { code: 'tr', label: 'Türkçe' },
    { code: 'uk', label: 'Українська' },
    { code: 'fa', label: 'فارسی' },
    { code: 'ti', label: 'ትግርኛ' },
    { code: 'pl', label: 'Polski' },
    { code: 'es', label: 'Español' },
    { code: 'pt', label: 'Português' },
    { code: 'zh', label: '中文' },
    { code: 'ru', label: 'Русский' },
    { code: 'de', label: 'Deutsch' },
    { code: 'fr', label: 'Français' },
    { code: 'id', label: 'Bahasa Indonesia' },
  ],
} as const;

export type CEFRLevel = (typeof APP_CONFIG.levels)[number];
