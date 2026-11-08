/**
 * InterstitialAdModal — Geçiş Reklam Modalı
 *
 * Her 3 fiil aramasında bir kez tam ekran olarak gösterilir.
 * Kullanıcı adFree/Pro ise hiçbir zaman açılmaz.
 *
 * Metinler %100 Hollandaca.
 */

import { X, Sparkles, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { restorePurchases } from '../lib/purchases';

export interface InterstitialAdModalProps {
  /** Modalın açık/kapalı durumu */
  isOpen: boolean;
  /** Modal kapatma callback'i */
  onClose: () => void;
  /** Dark/Light mod */
  isDarkMode?: boolean;
  /** Pro yükseltme sayfasına yönlendirme URL'si */
  stripePaymentLink?: string;
}

export function InterstitialAdModal({
  isOpen,
  onClose,
  isDarkMode = true,
  stripePaymentLink,
}: InterstitialAdModalProps) {
  const [isRestoring, setIsRestoring] = useState<boolean>(false);

  if (!isOpen) return null;

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
        // Arka plana tıklamayı engelle — reklam modalı yalnızca butonlarla kapanır
        e.stopPropagation();
      }}
    >
      {/* Modal Kutusu */}
      <div
        className={`relative w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden flex flex-col ${
          isDarkMode
            ? 'bg-[#0B0F19]/98 border-white/10 text-[#E2E8F0]'
            : 'bg-white border-slate-200 text-[#0F172A]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Üst Alan: Başlık ── */}
        <div
          className={`px-5 pt-5 pb-4 border-b ${
            isDarkMode ? 'border-white/8' : 'border-slate-100'
          }`}
        >
          {/* "Advertentie" etiketi */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-3 ${
              isDarkMode
                ? 'bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981]'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}
          >
            Advertentie
          </span>

          {/* Merkez ikon */}
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

          {/* Başlık */}
          <h2
            id="interstitial-ad-title"
            className={`text-center text-lg font-extrabold tracking-tight leading-tight ${
              isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'
            }`}
          >
            Advertentie
          </h2>
        </div>

        {/* ── İçerik Alanı ── */}
        <div className="px-5 py-5 space-y-4">
          {/* Sahte reklam içeriği (placeholder banner) */}
          <div
            className={`w-full h-24 rounded-2xl flex items-center justify-center border ${
              isDarkMode
                ? 'bg-[#151D2A] border-white/8'
                : 'bg-slate-50 border-slate-200'
            }`}
            aria-label="Advertentie ruimte"
          >
            <p
              className={`text-xs font-medium ${
                isDarkMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              [ Advertentie ]
            </p>
          </div>

          {/* Alt Metin — Pro upgrade daveti */}
          <p
            className={`text-xs text-center leading-relaxed ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Wilt u geen advertenties meer zien?{' '}
            <a
              href={stripePaymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`font-semibold underline underline-offset-2 transition-colors ${
                isDarkMode
                  ? 'text-blue-400 hover:text-blue-300'
                  : 'text-blue-600 hover:text-blue-800'
              }`}
            >
              Upgrade naar Pro voor €15.99
            </a>
          </p>
        </div>

        {/* ── Butonlar ── */}
        <div
          className={`px-5 pb-5 pt-1 flex flex-col gap-2.5 border-t ${
            isDarkMode ? 'border-white/8' : 'border-slate-100'
          }`}
        >
          {/* Herstel Aankoop butonu */}
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

          {/* Sluiten (X) butonu */}
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
