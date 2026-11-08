/**
 * AdBannerComponent — Freemium reklam bandı (GDPR/AVG uyumlu)
 *
 * - localStorage'da `adFree: true` ise görünmez.
 * - Stripe Payment Link'e yönlendirir.
 * - Kullanıcı verisini dışarıya göndermez (100% yerel kontrol).
 *
 * TEST MODU: TEST_AD_BANNER=true ise gerçek banner yerine
 * görsel placeholder kutusu gösterilir (build'e dahil olmaz).
 */

import { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// TEST ÇERÇEVE — localStorage kontrolünü devre dışı bırakır, her koşulda
// kesikli çerçeveli test kutusunu gösterir.
// ---------------------------------------------------------------------------
const TEST_AD_BANNER = true;
// ---------------------------------------------------------------------------

export interface AdBannerComponentProps {
  isDarkMode?: boolean;
  stripePaymentLink?: string;
}

const STRIPE_DEFAULT_URL = 'https://buy.stripe.com/kofschip_lifetime_1499';

export function AdBannerComponent({
  isDarkMode = true,
  stripePaymentLink = STRIPE_DEFAULT_URL,
}: AdBannerComponentProps) {
  const [isAdFree, setIsAdFree] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Lokaal controleren — geen externe API-aanroep (AVG-eis)
    const adFree = localStorage.getItem('adFree') === 'true';
    setIsAdFree(adFree);

    const handlePremiumChange = (e: Event) => {
      const custom = e as CustomEvent<{ isPremium: boolean }>;
      if (custom.detail?.isPremium) setIsAdFree(true);
    };
    window.addEventListener('kofschip_premium_changed', handlePremiumChange);
    return () => window.removeEventListener('kofschip_premium_changed', handlePremiumChange);
  }, []);

  // -------------------------------------------------------------------------
  // TEST ÇERÇEVE MODU — localStorage kontrolü devre dışı, her koşulda görünür
  // -------------------------------------------------------------------------
  if (TEST_AD_BANNER) {
    return (
      <div
        role="presentation"
        aria-label="Reklam alanı (test modu)"
        style={{
          border: '2px dashed #ef4444',
          borderRadius: '12px',
          backgroundColor: '#fff5f5',
          padding: '1rem',
          margin: '1rem 0',
          textAlign: 'center',
          color: '#b91c1c',
          fontSize: '14px',
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          letterSpacing: '0.01em',
          userSelect: 'none',
        }}
      >
        📢 TEST REKLAM ALANI (AdBannerComponent Burada Duruyor)
      </div>
    );
  }
  // -------------------------------------------------------------------------

  if (isAdFree || dismissed) return null;

  return (
    <aside
      aria-label="Advertentie — klik om advertenties te verwijderen"
      className={`w-full rounded-2xl border transition-colors ${
        isDarkMode
          ? 'bg-[#151D2A]/80 border-white/10 backdrop-blur-xl'
          : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Ad label */}
        <span
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
            isDarkMode
              ? 'text-[#10B981] bg-[#10B981]/15 border-[#10B981]/30'
              : 'text-emerald-700 bg-emerald-50 border-emerald-200'
          }`}
        >
          Ad
        </span>

        {/* Copy */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
            🚫 Geen advertenties meer &amp; 🧠 AI NT2 Zinsbouwer
          </p>
          <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Eenmalig &euro;14,99 · Levenslang Pro · Geen abonnement
          </p>
        </div>

        {/* CTA */}
        <a
          href={stripePaymentLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Verwijder advertenties voor €14,99 eenmalig"
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
