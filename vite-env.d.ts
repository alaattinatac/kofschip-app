/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_REVENUECAT_API_KEY: string;
  readonly VITE_ADMOB_APP_ID: string;
  readonly VITE_ADMOB_BANNER_ID: string;
  readonly VITE_ADMOB_INTERSTITIAL_ID: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_FREE_DAILY_SCAN_LIMIT: string;
  readonly VITE_PREMIUM_PRICE: string;
  readonly VITE_PREMIUM_CURRENCY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
