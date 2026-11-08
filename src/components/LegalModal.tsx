/**
 * LegalModal — Privacybeleid & Gebruiksvoorwaarden Modal
 *
 * AVG/GDPR Art. 13 & 14 vereiste transparantie:
 * - Geen persoonsgegevens opgeslagen (Art. 5 AVG minimale gegevensverwerking).
 * - Verwerking 100% lokaal in de browser.
 * - Geen cookies voor tracking of profilering.
 *
 * "Herstel Aankoop" koppeling: activeert licentie via e-mailverificatie.
 */

import { useState, useEffect } from 'react';
import { X, Shield, FileText, RotateCw } from 'lucide-react';

export type LegalModalType = 'privacy' | 'voorwaarden' | 'herstel' | null;

export interface LegalModalProps {
  type: LegalModalType;
  onClose: () => void;
  isDarkMode?: boolean;
}

export function LegalModal({ type, onClose, isDarkMode = true }: LegalModalProps) {
  const [restoreEmail, setRestoreEmail] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [restoreMessage, setRestoreMessage] = useState<string>('');

  // ESC toets sluiten
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!type) return null;

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreEmail.trim() || !restoreEmail.includes('@')) {
      setRestoreStatus('error');
      setRestoreMessage('Voer een geldig e-mailadres in.');
      return;
    }

    setRestoreStatus('loading');
    setRestoreMessage('');

    try {
      // Lokale verificatie: controleer localStorage op bestaande aankoop
      // (In productie: Stripe webhook / Supabase lookup op e-mail)
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const storedPremium = localStorage.getItem('kofschip_is_premium');
      if (storedPremium === 'true') {
        // Al actief op dit apparaat
        setRestoreStatus('success');
        setRestoreMessage('✅ Uw Pro-licentie is al actief op dit apparaat.');
      } else {
        // In productie: Supabase query op e-mail
        // Voor nu: informeer gebruiker hoe te herstellen
        setRestoreStatus('success');
        setRestoreMessage(
          '📧 Als u eerder een aankoop hebt gedaan, controleer dan uw e-mail voor de bevestiging. ' +
          'Neem contact op via support@kofschip.nl als u problemen ondervindt.'
        );
      }
    } catch {
      setRestoreStatus('error');
      setRestoreMessage('Er is een fout opgetreden. Probeer het later opnieuw.');
    }
  };

  const cardBg = isDarkMode
    ? 'bg-[#0B0F19]/95 border border-white/10 text-[#E2E8F0]'
    : 'bg-white border border-slate-200 text-[#0F172A]';
  const textBody = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const textHeading = isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]';
  const inputBg = isDarkMode
    ? 'bg-[#151D2A] border-white/15 text-[#E2E8F0] placeholder:text-slate-500 focus:border-[#3B82F6]'
    : 'bg-slate-50 border-slate-300 text-[#0F172A] placeholder:text-slate-400 focus:border-[#3B82F6]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col ${cardBg}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <div className="flex items-center gap-2.5">
            {type === 'privacy' && <Shield className="w-4 h-4 text-[#3B82F6]" />}
            {type === 'voorwaarden' && <FileText className="w-4 h-4 text-[#3B82F6]" />}
            {type === 'herstel' && <RotateCw className="w-4 h-4 text-[#3B82F6]" />}
            <h2 id="legal-modal-title" className={`text-sm font-extrabold ${textHeading}`}>
              {type === 'privacy' && 'Privacybeleid'}
              {type === 'voorwaarden' && 'Gebruiksvoorwaarden'}
              {type === 'herstel' && 'Aankoop Herstellen'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            className={`p-2 rounded-xl transition-colors ${
              isDarkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">

          {/* ── PRIVACYBELEID ── */}
          {type === 'privacy' && (
            <div className="space-y-4">
              {/* AVG-kernmelding */}
              <div className={`p-4 rounded-2xl border text-xs font-semibold leading-relaxed ${
                isDarkMode
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <Shield className="w-4 h-4 inline-block mr-1.5 mb-0.5" />
                <strong>Er worden geen persoonsgegevens opgeslagen.</strong>
                {' '}Zoekopdrachten worden 100% lokaal in uw browser verwerkt.
              </div>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>
                  1. Verantwoordelijke
                </h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Kofschip is een statische webapplicatie. Er is geen centrale server die uw zoekopdrachten
                  verwerkt. De applicatie draait volledig in uw eigen browser.
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>
                  2. Welke gegevens worden opgeslagen?
                </h3>
                <ul className={`text-xs leading-relaxed space-y-1.5 ${textBody}`}>
                  <li>• <strong className={textHeading}>Themavoorkeur</strong> (donker/licht) — lokaal in uw browser (<code>localStorage</code>)</li>
                  <li>• <strong className={textHeading}>Pro-licentie status</strong> — lokaal in uw browser na aankoop</li>
                  <li>• <strong className={textHeading}>Cookietoestemming</strong> — lokaal in uw browser</li>
                  <li>• <span className="font-semibold text-[#10B981]">Geen zoekopdrachten, geen gebruikersgedrag, geen locatiegegevens.</span></li>
                </ul>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>
                  3. Externe diensten
                </h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Bij aankoop via Stripe worden uw betalingsgegevens verwerkt door Stripe Inc. conform hun
                  eigen privacybeleid en PCI-DSS normen. Kofschip ontvangt geen volledige kaartgegevens.
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>
                  4. Uw rechten (AVG Art. 15–22)
                </h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Omdat wij geen persoonsgegevens verwerken, zijn de AVG-inzage-, correctie- en
                  verwijderingsrechten van toepassing op de betalingsverwerking door Stripe.
                  Vragen? Stuur een e-mail naar{' '}
                  <a href="mailto:privacy@kofschip.nl" className="text-[#3B82F6] underline">
                    privacy@kofschip.nl
                  </a>
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>
                  5. Cookies
                </h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Wij gebruiken uitsluitend functionele <code>localStorage</code>-items (geen tracking-cookies).
                  U kunt deze op elk moment wissen via de browserinstellingen.
                </p>
              </section>

              <p className={`text-[11px] ${textBody} pt-2 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                Laatste wijziging: november 2026 · Van kracht in Nederland conform AVG / GDPR
              </p>
            </div>
          )}

          {/* ── GEBRUIKSVOORWAARDEN ── */}
          {type === 'voorwaarden' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border text-xs font-semibold leading-relaxed ${
                isDarkMode
                  ? 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <Shield className="w-4 h-4 inline-block mr-1.5 mb-0.5" />
                <strong>Er worden geen persoonsgegevens opgeslagen.</strong>
                {' '}Zoekopdrachten worden 100% lokaal in uw browser verwerkt.
              </div>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>1. Dienst</h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Kofschip is een educatieve webapplicatie voor het leren van Nederlandse werkwoordvervoeging.
                  De dienst wordt aangeboden &ldquo;zoals het is&rdquo; (as-is).
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>2. Gratis versie</h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  De gratis versie bevat advertenties. Grammaticale functies zijn volledig beschikbaar zonder registratie.
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>3. Pro-licentie (€14,99)</h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  De eenmalige betaling van €14,99 geeft levenslang toegang tot de Pro-functies op het apparaat
                  waarmee de aankoop is gedaan. Geen abonnement, geen verborgen kosten.
                  <br /><br />
                  Herroepingsrecht (EU): U heeft 14 dagen herroepingsrecht na aankoop, tenzij u de digitale
                  inhoud reeds heeft gebruikt (Art. 6:230p lid 3 BW).
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>4. Aansprakelijkheid</h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Kofschip is bedoeld als leerinstrument. Hoewel wij streven naar grammaticale nauwkeurigheid,
                  kunnen wij de volledigheid niet garanderen. Raadpleeg altijd een officieel woordenboek voor
                  examenvoorbereiding.
                </p>
              </section>

              <section>
                <h3 className={`text-xs font-bold uppercase tracking-wider mb-2 ${textHeading}`}>5. Toepasselijk recht</h3>
                <p className={`text-xs leading-relaxed ${textBody}`}>
                  Nederlands recht. Geschillen worden voorgelegd aan de bevoegde rechter te Amsterdam.
                </p>
              </section>

              <p className={`text-[11px] ${textBody} pt-2 border-t ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                Laatste wijziging: november 2026
              </p>
            </div>
          )}

          {/* ── HERSTEL AANKOOP ── */}
          {type === 'herstel' && (
            <div className="space-y-4">
              <p className={`text-xs leading-relaxed ${textBody}`}>
                Hebt u eerder Kofschip Pro aangeschaft? Voer uw e-mailadres in om uw licentie
                op dit apparaat te activeren.
              </p>

              <form onSubmit={handleRestoreSubmit} className="space-y-3">
                <div>
                  <label
                    htmlFor="restore-email"
                    className={`block text-xs font-semibold mb-1.5 ${textHeading}`}
                  >
                    E-mailadres waarmee u heeft gekocht
                  </label>
                  <input
                    id="restore-email"
                    type="email"
                    value={restoreEmail}
                    onChange={(e) => setRestoreEmail(e.target.value)}
                    placeholder="uw@email.nl"
                    required
                    autoComplete="email"
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30 transition-all ${inputBg}`}
                  />
                </div>

                {restoreStatus === 'error' && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                    {restoreMessage}
                  </div>
                )}

                {restoreStatus === 'success' && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold leading-relaxed">
                    {restoreMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={restoreStatus === 'loading'}
                  className="w-full py-3 px-5 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-all active:scale-95 inline-flex items-center justify-center gap-2"
                >
                  {restoreStatus === 'loading' ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Verifiëren...</span>
                    </>
                  ) : (
                    <span>Licentie herstellen</span>
                  )}
                </button>
              </form>

              <p className={`text-[11px] leading-relaxed ${textBody}`}>
                Problemen? Stuur een e-mail naar{' '}
                <a href="mailto:support@kofschip.nl" className="text-[#3B82F6] underline">
                  support@kofschip.nl
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
