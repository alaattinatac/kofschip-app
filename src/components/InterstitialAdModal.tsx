/**
 * InterstitialAdModal — Tussenliggende Advertentiepop-up
 *
 * Wordt elke 3 werkwoordzoekopdrachten één keer schermvullend getoond.
 * TEST MODU GARANTİSİ: adFree varsayılan olarak false (localStorage'dan bağımsız ekranları görünür kıl).
 *
 * Alle teksten zijn 100% Nederlandstalig.
 */

import { X, Sparkles, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { restorePurchases } from '../lib/purchases';

export interface InterstitialAdModalProps {
  /** Open/gesloten toestand van het modaal */
  isOpen: boolean;
  /** Callback om het modaal te sluiten */
  onClose: () => void;
  /** Dark/Light modus */
  isDarkMode?: boolean;
  /** URL voor Pro-upgrade via Stripe */
  stripePaymentLink?: string;
  /** Wanneer true: modaal wordt nooit getoond (TEST MODU: standaard false) */
  adFree?: boolean;
}

const STRIPE_DEFAULT_URL = 'https://buy.stripe.com/kofschip_lifetime_1599';

export function InterstitialAdModal({
  isOpen,
  onClose,
  isDarkMode = true,
  stripePaymentLink = STRIPE_DEFAULT_URL,
  adFree = false,
}: InterstitialAdModalProps) {
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  // Nooit tonen wanneer adFree actief is, of modaal gesloten is
  if (!isOpen || adFree) return null;

  const handleHerstelAankoop = async () => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.isPremium) {
        alert('Uw aankoop is hersteld! U heeft nu Pro toegang.');
        onClose();
      } else {
        alert(result.error || 'Geen eerdere aankoop gevonden voor dit account.');
      }
    } catch {
      alert('Kon aankopen niet herstellen. Probeer het later opnieuw.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="interstitial-ad-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn"
      onClick={(e) => {
        // Klikken op achtergrond geblokkeerd — advertentiepop-up sluit alleen via knoppen
        e.stopPropagation();
      }}
    >
      {/* Modaalvenster */}
      <div
        className={`relative w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden flex flex-col ${
          isDarkMode
            ? 'bg-[#0B0F19]/98 border-white/10 text-[#E2E8F0]'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Sluiten (X) knop — rechtsboven ── */}
        <button
          onClick={onClose}
          className={`absolute top-3 right-3 z-10 p-1.5 rounded-lg border transition-all active:scale-95 ${
            isDarkMode
              ? 'text-slate-400 hover:text-slate-200 hover:bg-white/10 border-white/10'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-slate-200'
          }`}
          aria-label="Sluit advertentie"
        >
          <X className="w-4 h-4" />
        </button>

        {/* ── Bovenste sectie: Titel ── */}
        <div
          className={`px-5 pt-5 pb-4 border-b ${
            isDarkMode ? 'border-white/8' : 'border-slate-100'
          }`}
        >
          {/* "Advertentie" label */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3 ${
              isDarkMode
                ? 'bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}
          >
            Advertentie
          </span>

          {/* Centraal icoon */}
          <div className="flex justify-center mb-4">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                isDarkMode
                  ? 'bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-600/30'
                  : 'bg-gradient-to-tr from-indigo-500 to-blue-400 shadow-indigo-400/30'
              }`}
            >
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Titel */}
          <h2
            id="interstitial-ad-title"
            className={`text-center text-lg font-extrabold tracking-tight leading-tight ${
              isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'
            }`}
          >
            Advertentie
          </h2>
        </div>

        {/* ── Inhoudsgebied ── */}
        <div className="px-5 py-5 space-y-4">
          {/* ── Belirgin test banner kutusu ── */}
          <div
            className={`w-full rounded-2xl border-2 overflow-hidden ${
              isDarkMode
                ? 'border-[#3B82F6]/40 bg-gradient-to-br from-indigo-950/80 to-blue-950/60'
                : 'border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50'
            }`}
            aria-label="Advertentie test banner"
          >
            {/* Banner başlık şeridi */}
            <div
              className={`px-4 py-2 flex items-center gap-2 border-b ${
                isDarkMode
                  ? 'bg-[#3B82F6]/20 border-[#3B82F6]/30'
                  : 'bg-blue-100 border-blue-200'
              }`}
            >
              <span className="text-sm">📢</span>
              <span
                className={`text-xs font-extrabold uppercase tracking-wider ${
                  isDarkMode ? 'text-blue-300' : 'text-blue-700'
                }`}
              >
                Advertentie (Pop-up Test)
              </span>
            </div>
            {/* Banner içerik */}
            <div className="px-4 py-3">
              <p
                className={`text-xs leading-relaxed ${
                  isDarkMode ? 'text-slate-300' : 'text-slate-600'
                }`}
              >
                Geniet van een snelle en reclamevrije ervaring op al uw apparaten.
              </p>
            </div>
          </div>

          {/* Hoofd-CTA knop */}
          <a
            href={stripePaymentLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Upgrade naar Pro voor €15.99 om reclamevrij te gebruiken"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#3B82F6] hover:bg-blue-600 active:scale-95 text-white font-bold text-sm transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Upgrade naar Pro (€15.99)</span>
          </a>
        </div>

        {/* ── Knoppen ── */}
        <div
          className={`px-5 pb-5 pt-1 flex flex-col gap-2.5 border-t ${
            isDarkMode ? 'border-white/8' : 'border-slate-100'
          }`}
        >
          {/* Herstel Aankoop knop */}
          <button
            onClick={handleHerstelAankoop}
            disabled={isRestoring}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all active:scale-95 disabled:opacity-50 ${
              isDarkMode
                ? 'bg-indigo-950/60 border-indigo-500/30 text-indigo-300 hover:border-indigo-400/50 hover:bg-indigo-950/80'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            }`}
            aria-label="Herstel eerdere aankoop"
          >
            {isRestoring ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                <span>Herstellen...</span>
              </>
            ) : (
              <span>Herstel Aankoop</span>
            )}
          </button>

          {/* Sluiten (X) knop */}
          <button
            onClick={onClose}
            className={`w-full flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              isDarkMode
                ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Sluit advertentie"
          >
            <X className="w-3.5 h-3.5" />
            <span>Sluiten (X)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
