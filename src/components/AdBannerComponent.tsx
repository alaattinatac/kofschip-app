/**
 * AdBannerComponent — Freemium advertentieband (GDPR/AVG-conform)
 *
 * - TEST MODU GARANTİSİ: adFree varsayılan olarak false (localStorage'dan bağımsız).
 * - Verwijst naar Stripe Payment Link.
 * - Verzendt geen gebruikersgegevens (100% lokale controle).
 */

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

export interface AdBannerComponentProps {
  isDarkMode?: boolean;
  stripePaymentLink?: string;
  adFree?: boolean;
}

const STRIPE_DEFAULT_URL = 'https://buy.stripe.com/kofschip_lifetime_1499';

export function AdBannerComponent({
  isDarkMode = true,
  stripePaymentLink = STRIPE_DEFAULT_URL,
  adFree: adFreeProp = false,
}: AdBannerComponentProps) {
  // TEST MODU GARANTİSİ: adFree durumunu test aşamasında varsayılan olarak false yap
  // (localStorage'dan bağımsız ekranları görünür kıl).
  const [isAdFree, setIsAdFree] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // TEST MODU: localStorage kontrolü yerine test aşamasında varsayılan false
    // Ekranları görünür kılmak için isAdFree false tutulur.
    setIsAdFree(false);

    const handlePremiumChange = (e: Event) => {
      const custom = e as CustomEvent<{ isPremium: boolean }>;
      if (custom.detail?.isPremium) setIsAdFree(true);
    };
    window.addEventListener('kofschip_premium_changed', handlePremiumChange);
    return () => window.removeEventListener('kofschip_premium_changed', handlePremiumChange);
  }, []);

  // Volledig verbergen wanneer adFree actief is (via prop of state) of weggedrukt
  if (adFreeProp || isAdFree || dismissed) return null;

  return (
    <aside
      aria-label="Advertentieruimte — upgrade naar Pro voor een reclamevrije ervaring"
      className={`w-full rounded-2xl border-2 border-dashed transition-colors ${
        isDarkMode
          ? 'border-blue-500/40 bg-[#151D2A]/60'
          : 'border-blue-300 bg-blue-50/60'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Placeholder tekst */}
        <p
          className={`flex-1 text-xs font-semibold text-center select-none ${
            isDarkMode ? 'text-blue-400' : 'text-blue-600'
          }`}
        >
          📢 Advertentieruimte · Upgrade naar Pro voor €14.99 om reclamevrij te gebruiken
        </p>

        {/* CTA */}
        <a
          href={stripePaymentLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Upgrade naar Pro voor €14.99 om reclamevrij te gebruiken"
          className="shrink-0 inline-flex items-center gap-1.5 bg-[#3B82F6] hover:bg-blue-600 active:scale-95 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-xs transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>PRO</span>
        </a>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Advertentie sluiten"
          className={`shrink-0 p-1 rounded-lg transition-colors ${
            isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
