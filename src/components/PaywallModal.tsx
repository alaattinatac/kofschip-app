import { useState } from 'react';
import { APP_CONFIG } from '../lib/config';
import { purchaseLifetimePro, restorePurchases } from '../lib/purchases';
import {
  X,
  Check,
  Crown,
  Sparkles,
  Zap,
  ShieldCheck,
  Scan,
  Brain,
  Languages,
  EyeOff,
  ArrowRight,
  RotateCw,
} from 'lucide-react';

export interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgradeSuccess?: () => void;
}

export function PaywallModal({
  isOpen,
  onClose,
  onUpgradeSuccess,
}: PaywallModalProps) {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await purchaseLifetimePro();
      if (result.success) {
        setPurchaseSuccess(true);
        setTimeout(() => {
          setIsProcessing(false);
          if (onUpgradeSuccess) {
            onUpgradeSuccess();
          }
        }, 1200);
      } else {
        setIsProcessing(false);
        setErrorMessage(result.error || 'Aankoop kon niet worden voltooid.');
      }
    } catch {
      setIsProcessing(false);
      setErrorMessage('Er is een onverwachte fout opgetreden bij de aankoop.');
    }
  };

  const handleRestore = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const result = await restorePurchases();
      if (result.isPremium) {
        alert('Je Pro-licentie is hersteld!');
        onClose();
        if (onUpgradeSuccess) onUpgradeSuccess();
      } else {
        alert(result.error || 'Geen eerdere aankoop gevonden voor dit account.');
      }
    } catch {
      alert('Kon aankopen niet herstellen. Probeer het later opnieuw.');
    } finally {
      setIsProcessing(false);
    }
  };

  const PRO_FEATURES = [
    {
      icon: Scan,
      title: 'Onbeperkt AI Camera Scans',
      desc: 'Scan brieven van de gemeente, Inburgeringsteksten en boeken (gratis: max 3/dag).',
    },
    {
      icon: EyeOff,
      title: '100% Advertentievrij',
      desc: 'Geen storende banner- of videoadvertenties meer tijdens het oefenen.',
    },
    {
      icon: Brain,
      title: 'Volledig Spaced Repetition Systeem',
      desc: 'Onbeperkt werkwoorden opslaan in Mijn Fouten met slimme herinneringsintervallen.',
    },
    {
      icon: Languages,
      title: 'Moedertaal Grammatica Coach',
      desc: 'Persoonlijke AI-uitleg in het Engels, Arabisch, Turks, Oekraïens of 10+ andere talen.',
    },
    {
      icon: Zap,
      title: 'Levenslange Toegang & Updates',
      desc: 'Eénmalig betalen, voor altijd toegang. Inclusief alle toekomstige uitbreidingen.',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
    >
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-lg backdrop-blur-2xl bg-[#0B0F19]/95 rounded-t-3xl sm:rounded-3xl shadow-[0_0_60px_rgba(99,102,241,0.25)] border border-indigo-500/25 overflow-hidden max-h-[92vh] flex flex-col safe-area-bottom text-left text-slate-100">
        {/* Subtle radial gradient glows inside modal */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-[100px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, rgba(16, 185, 129, 0.08) 50%, transparent 70%)',
          }}
        />

        {/* Top Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-indigo-500/15 relative z-10">
          <button
            onClick={onClose}
            aria-label="Sluit upgrade venster"
            className="absolute top-4 right-4 inline-flex items-center justify-center p-2 text-slate-400 hover:text-slate-100 backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/50 rounded-xl border border-indigo-500/20 transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>

          <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-xl bg-emerald-950/40 text-emerald-300 text-xs font-semibold border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lifetime Pro Toegang</span>
          </span>

          <h2 id="paywall-title" className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100 leading-tight">
            Word Meester in Nederlandse Werkwoorden
          </h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Leer foutloos vervoegen voor Inburgering A2 en Staatsexamen NT2 B1/B2.
          </p>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 relative z-10">
          {purchaseSuccess ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <Check className="w-7 h-7 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 tracking-tight">
                Welkom bij Kofschip Pro!
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Je account is succesvol opgewaardeerd. Geniet van onbeperkte scans, spaced repetition en geen reclame!
              </p>
            </div>
          ) : (
            <>
              {/* Premium Glassmorphic 14.99 € Pro Upgrade Card with Glowing Emerald Badges */}
              <div className="rounded-2xl p-5 border border-emerald-500/30 backdrop-blur-2xl bg-gradient-to-br from-indigo-950/40 via-indigo-900/30 to-emerald-950/30 shadow-[0_0_35px_rgba(16,185,129,0.18)] flex items-center justify-between relative overflow-hidden group">
                <div className="relative z-10">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Eenmalige Betaling • Lifetime</span>
                  </span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-emerald-300">
                      €{APP_CONFIG.premiumPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      / levenslang
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Geen maandelijks abonnement. Nooit herhaalkosten.
                  </p>
                </div>

                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/40 shrink-0 relative z-10">
                  <Crown className="w-6 h-6" />
                </div>
              </div>

              {/* Pro Feature Checklist in frosted panels */}
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Wat je krijgt met Pro:
                </h4>
                {PRO_FEATURES.map((feat, idx) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3.5 rounded-xl border border-indigo-500/15 backdrop-blur-xl bg-indigo-950/20 shadow-sm hover:border-indigo-500/30 transition-all"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-950/50 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-xs">
                        <h5 className="font-bold text-slate-100">{feat.title}</h5>
                        <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">
                          {feat.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Guarantees with Glowing Emerald Badge */}
              <div className="flex justify-center pt-1">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>30 dagen tevredenheidsgarantie • Veilig afrekenen</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3.5 bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs rounded-xl font-semibold shadow-md">
                  {errorMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom CTA / Action Bar */}
        {!purchaseSuccess && (
          <div className="p-5 sm:p-6 pt-3.5 border-t border-indigo-500/15 backdrop-blur-xl bg-[#0B0F19]/90 relative z-10">
            <button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-600/30 hover:shadow-[0_0_25px_rgba(16,185,129,0.35)] border border-indigo-400/30 transition-all active:scale-95 inline-flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Aankoop verwerken...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Ontgrendel Nu voor €{APP_CONFIG.premiumPrice.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Sub-actions */}
            <div className="flex items-center justify-between text-xs text-slate-400 mt-3 px-1">
              <button
                onClick={handleRestore}
                disabled={isProcessing}
                className="hover:text-slate-200 underline underline-offset-2 transition-colors"
              >
                Aankopen herstellen
              </button>
              <span className="font-medium text-slate-500">iDEAL • Apple Pay • Card</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mobile Banner Ad Container for the Free Tier.
 * Renders non-intrusive mobile banner ad with quick Pro upgrade button in Neo-Glass style.
 */
export interface BannerAdContainerProps {
  isPremium?: boolean;
  onOpenPaywall: () => void;
  className?: string;
}

export function BannerAdContainer({
  isPremium = false,
  onOpenPaywall,
  className = '',
}: BannerAdContainerProps) {
  // If user is already Pro, do not display ad
  if (isPremium) {
    return null;
  }

  return (
    <aside
      aria-label="Advertentie en Pro promotie"
      className={`w-full max-w-xl mx-auto ${className}`}
    >
      <div className="rounded-2xl border border-indigo-500/20 backdrop-blur-2xl bg-indigo-950/20 shadow-2xl p-3.5 px-4 flex items-center justify-between transition-colors">
        {/* Ad Marker & Copy */}
        <div className="flex items-center gap-2.5 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            Ad
          </span>
          <div className="text-xs">
            <p className="font-bold text-slate-100 line-clamp-1">
              🇳🇱 Oefen zonder reclame met Kofschip Pro
            </p>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              Onbeperkte scans & spaced repetition voor €14.99 lifetime
            </p>
          </div>
        </div>

        {/* Upgrade Button */}
        <button
          onClick={onOpenPaywall}
          aria-label="Verwijder advertenties met Pro"
          className="shrink-0 inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all ml-2"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>Ga Pro</span>
        </button>
      </div>
    </aside>
  );
}
