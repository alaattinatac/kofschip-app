/**
 * CookieConsentBanner — AB Cookie & Reclame Toestemmingsbanner
 *
 * AVG/GDPR-eis (Wet 25 Wet bescherming persoonsgegevens / AVG):
 * - Geen tracking-cookies zonder expliciete toestemming.
 * - Toestemming opgeslagen in localStorage (geen server-side verwerking).
 * - Privacyverklaring koppeling aanwezig.
 */

import { useState, useEffect } from 'react';
import { Shield, X, Check } from 'lucide-react';

export interface CookieConsentBannerProps {
  isDarkMode?: boolean;
  onOpenPrivacy?: () => void;
}

const CONSENT_KEY = 'kofschip_cookie_consent';
const CONSENT_VERSION = 'v1';

export function CookieConsentBanner({ isDarkMode = true, onOpenPrivacy }: CookieConsentBannerProps) {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored || stored !== CONSENT_VERSION) {
      // Kleine vertraging zodat de pagina eerst laadt
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
    setVisible(false);
  };

  const handleDecline = () => {
    // Bij weigering: geen extra cookies — app functioneert volledig op lokale opslag
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie- en privacymelding"
      className={`fixed bottom-0 left-0 right-0 z-50 safe-area-bottom animate-slideUp ${
        isDarkMode
          ? 'bg-[#0D1424]/97 border-t border-white/10 backdrop-blur-2xl'
          : 'bg-white/97 border-t border-slate-200 shadow-2xl backdrop-blur-xl'
      }`}
    >
      <div className="max-w-2xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Icon */}
        <div
          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
            isDarkMode ? 'bg-blue-500/15 border border-blue-500/25' : 'bg-blue-50 border border-blue-200'
          }`}
        >
          <Shield className="w-4 h-4 text-[#3B82F6]" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
            🍪 Cookies &amp; Privacy
          </p>
          <p className={`text-[11px] leading-snug mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Wij gebruiken alleen functionele cookies (thema, taalvoorkeur) die lokaal in uw browser worden opgeslagen.
            Er worden <strong>geen persoonsgegevens</strong> verzameld of naar externe servers verzonden.{' '}
            <button
              onClick={onOpenPrivacy}
              className={`underline underline-offset-2 font-medium transition-colors ${
                isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              Meer informatie
            </button>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDecline}
            aria-label="Alleen functionele cookies"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              isDarkMode
                ? 'border-white/15 text-slate-400 hover:text-[#E2E8F0] hover:bg-white/5'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Alleen functioneel
          </button>
          <button
            onClick={handleAccept}
            aria-label="Cookies accepteren"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#3B82F6] hover:bg-blue-600 text-white transition-all active:scale-95 shadow-xs"
          >
            <Check className="w-3.5 h-3.5" />
            Accepteren
          </button>
          <button
            onClick={handleDecline}
            aria-label="Sluiten"
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
