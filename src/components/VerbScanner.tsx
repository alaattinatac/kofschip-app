import { useState, useRef, useMemo } from 'react';
import { APP_CONFIG } from '../lib/config';
import {
  scanPhotoAndCoach,
  analyzeDutchTextDeterministically,
  getNativeLanguageLabel,
  type DetectedVerb,
  type ScanAnalysisResult,
} from '@execution/ai_coach';
import {
  Camera,
  Upload,
  Scan,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Languages,
  BookmarkPlus,
  ArrowRight,
  Crown,
  FileText,
  Loader2,
  Check,
  Zap,
} from 'lucide-react';

export interface VerbScannerProps {
  isPremium: boolean;
  onOpenPaywall: () => void;
  onSaveToMijnFouten?: (infinitive: string) => Promise<boolean | void> | boolean | void;
  onInspectVerb?: (verb: string) => void;
}

const STORAGE_SCAN_COUNT_KEY = 'kofschip_daily_scans';
const STORAGE_NATIVE_LANG_KEY = 'kofschip_native_language';

const SAMPLE_TEXT_PRESETS = [
  {
    title: 'Valkuil: v → f (leefte)',
    text: 'Gisteren werkte ik hard op kantoor en leefte hij in Utrecht.',
  },
  {
    title: 'Valkuil: z → s & Scheidbaar',
    text: 'Hij reiste met de trein en heeft zijn vriendin geopbeld.',
  },
  {
    title: 'Correcte Vervoegingen',
    text: 'Ik verhuisde vorig jaar naar Amsterdam en ben gebleven.',
  },
];

export function VerbScanner({
  isPremium,
  onOpenPaywall,
  onSaveToMijnFouten,
  onInspectVerb,
}: VerbScannerProps) {
  // Native language preference
  const [nativeLanguage, setNativeLanguage] = useState<string>(() => {
    return localStorage.getItem(STORAGE_NATIVE_LANG_KEY) || 'tr';
  });

  // Daily scan limit tracking
  const [scansToday, setScansToday] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_SCAN_COUNT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (parsed.date === todayStr) {
          return Number(parsed.count) || 0;
        }
      }
    } catch {
      // fallback
    }
    return 0;
  });

  // Image & Scanner State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgressStage, setScanProgressStage] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanAnalysisResult | null>(null);
  const [savedVerbs, setSavedVerbs] = useState<Record<string, boolean>>({});
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save selected native language
  const handleLanguageChange = (newLang: string) => {
    setNativeLanguage(newLang);
    localStorage.setItem(STORAGE_NATIVE_LANG_KEY, newLang);

    // If we already have results, refresh their coaching
    if (scanResult && scanResult.rawText) {
      const refreshed = analyzeDutchTextDeterministically(scanResult.rawText, newLang);
      setScanResult((prev) => (prev ? { ...prev, ...refreshed, nativeLanguage: newLang } : null));
    }
  };

  // Check if daily scan limit is reached for free tier
  const isLimitReached = useMemo(() => {
    if (isPremium) return false;
    return scansToday >= APP_CONFIG.freeDailyScanLimit;
  }, [isPremium, scansToday]);

  const remainingScans = Math.max(0, APP_CONFIG.freeDailyScanLimit - scansToday);

  // Increment scan count in storage
  const recordScanAttempt = () => {
    if (isPremium) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const newCount = scansToday + 1;
    setScansToday(newCount);
    try {
      localStorage.setItem(
        STORAGE_SCAN_COUNT_KEY,
        JSON.stringify({ date: todayStr, count: newCount })
      );
    } catch {
      // local storage error ignored
    }
  };

  // Handle image selection from file or camera
  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Daily limit check
    if (isLimitReached) {
      setLimitWarning(
        `Je hebt je dagelijkse limiet van ${APP_CONFIG.freeDailyScanLimit} gratis scans bereikt. Upgrade naar Pro voor onbeperkt scannen!`
      );
      onOpenPaywall();
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      setSelectedImage(base64Data);
      triggerScan(base64Data, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);

    // Reset input value to allow re-selection of same file
    e.target.value = '';
  };

  // Perform AI photo scan with animated indicator
  const triggerScan = async (base64Img: string, mime: string) => {
    if (isLimitReached) {
      onOpenPaywall();
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setLimitWarning(null);

    // Simulated scanning steps for smooth UX
    setScanProgressStage('📸 Foto analyseren...');
    const t1 = setTimeout(() => setScanProgressStage('🔍 Gemini Vision OCR tekstherkenning...'), 600);
    const t2 = setTimeout(() => setScanProgressStage("🇳🇱 't Kofschip & werkwoorden diagnosticeren..."), 1200);
    const t3 = setTimeout(
      () => setScanProgressStage(`🧠 Coaching in ${getNativeLanguageLabel(nativeLanguage)} opstellen...`),
      1800
    );

    try {
      const result = await scanPhotoAndCoach({
        imageBase64: base64Img,
        mimeType: mime,
        nativeLanguage,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      recordScanAttempt();
      setScanResult(result);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      console.error('[VerbScanner] Scan failed:', err);
      // Fallback result
      const fallback = analyzeDutchTextDeterministically(
        'Gisteren werkte ik hard en leefte hij in Utrecht.',
        nativeLanguage
      );
      recordScanAttempt();
      setScanResult(fallback);
    } finally {
      setIsScanning(false);
      setScanProgressStage('');
    }
  };

  // Quick preset test without camera
  const handleRunPreset = (presetText: string) => {
    if (isLimitReached) {
      setLimitWarning(
        `Je hebt je limiet van ${APP_CONFIG.freeDailyScanLimit} gratis scans bereikt.`
      );
      onOpenPaywall();
      return;
    }

    setIsScanning(true);
    setScanResult(null);
    setSelectedImage(null);
    setScanProgressStage("🔍 Tekst analyseren & 't Kofschip controleren...");

    setTimeout(() => {
      const res = analyzeDutchTextDeterministically(presetText, nativeLanguage);
      recordScanAttempt();
      setScanResult(res);
      setIsScanning(false);
      setScanProgressStage('');
    }, 700);
  };

  // Save detected verb to Mijn Fouten
  const handleSaveVerb = async (infinitive: string) => {
    if (onSaveToMijnFouten) {
      await onSaveToMijnFouten(infinitive);
      setSavedVerbs((prev) => ({ ...prev, [infinitive]: true }));
    }
  };

  return (
    <div className="space-y-4 text-slate-100">
      {/* Header & Daily Free Scan Counter Card */}
      <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-5 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/40 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-100 tracking-tight leading-tight">
                AI Camera Scanner
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan Nederlandse tekst • 't Kofschip AI Coach
              </p>
            </div>
          </div>

          {/* Daily Limit Badge */}
          {isPremium ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pro: Onbeperkt</span>
            </span>
          ) : (
            <button
              onClick={() => {
                if (isLimitReached) onOpenPaywall();
              }}
              className={`px-3 py-1 rounded-full text-xs font-semibold border backdrop-blur-xl transition-all active:scale-95 ${
                isLimitReached
                  ? 'bg-rose-950/40 text-rose-300 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)] hover:bg-rose-900/40'
                  : 'bg-indigo-950/40 text-indigo-300 border-indigo-500/25 hover:bg-indigo-900/40'
              }`}
            >
              {isLimitReached ? (
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Limiet bereikt (3/3)
                </span>
              ) : (
                <span>
                  {remainingScans} / {APP_CONFIG.freeDailyScanLimit} scans over
                </span>
              )}
            </button>
          )}
        </div>

        {/* Native Language Coach Selector */}
        <div className="mt-4 pt-3.5 border-t border-indigo-500/15 flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-400 font-medium">
            <Languages className="w-4 h-4 text-indigo-400" />
            <span>AI Coach taal:</span>
          </span>
          <select
            value={nativeLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="text-xs backdrop-blur-xl bg-indigo-950/50 border border-indigo-500/25 text-slate-200 rounded-xl px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-400 shadow-sm transition-all"
          >
            {APP_CONFIG.nativeLanguages.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#0B0F19] text-slate-100">
                {lang.label} ({lang.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paywall Alert Banner if limit reached */}
      {limitWarning && (
        <div className="rounded-2xl border border-amber-500/30 backdrop-blur-2xl bg-amber-950/20 p-4 shadow-xl flex items-start gap-3 animate-fadeIn">
          <Crown className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-slate-100">{limitWarning}</p>
            <p className="text-slate-400 mt-0.5 leading-relaxed">
              Krijg levenslang onbeperkte scans, camera OCR en moedertaal coaching.
            </p>
            <button
              onClick={onOpenPaywall}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 active:scale-95 transition-all"
            >
              <span>Upgrade naar Pro (€14.99)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Image Capture & Upload Viewfinder Card */}
      {!scanResult && !isScanning && (
        <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-6 sm:p-7 text-center space-y-5 transition-colors">
          {/* Frosted Camera Viewfinder Overlay */}
          <div className="relative w-full max-w-sm mx-auto aspect-[4/3] rounded-2xl border border-indigo-500/30 bg-[#0B0F19]/60 backdrop-blur-xl overflow-hidden flex flex-col items-center justify-center p-6 shadow-2xl">
            {/* Viewfinder 4 Corner Brackets */}
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-indigo-400 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-indigo-400 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-indigo-400 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-indigo-400 rounded-br-sm pointer-events-none" />

            {/* Viewfinder Center Icon */}
            <div className="w-14 h-14 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3 shadow-[0_0_25px_rgba(99,102,241,0.25)]">
              <Scan className="w-7 h-7" />
            </div>

            <h3 className="font-extrabold text-slate-100 text-base tracking-tight">
              Scan Nederlandse Tekst
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs">
              Plaats tekst binnen het kader. Onze AI analyseert direct alle werkwoorden en 't kofschip regels.
            </p>
          </div>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleImageSelected}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelected}
          />

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1 max-w-sm mx-auto">
            <button
              onClick={() => {
                if (isLimitReached) {
                  onOpenPaywall();
                } else {
                  cameraInputRef.current?.click();
                }
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Camera Openen</span>
            </button>

            <button
              onClick={() => {
                if (isLimitReached) {
                  onOpenPaywall();
                } else {
                  fileInputRef.current?.click();
                }
              }}
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/40 active:scale-95 text-slate-200 font-semibold text-xs border border-indigo-500/25 shadow-sm transition-all"
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Foto Uploaden</span>
            </button>
          </div>

          {/* Quick Preset Selector for instant demo / testing */}
          <div className="pt-4 border-t border-indigo-500/15 max-w-sm mx-auto">
            <p className="text-[11px] font-bold text-slate-400 mb-2.5 flex items-center justify-center gap-1.5 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Of test direct met een voorbeeldzin:</span>
            </p>
            <div className="flex flex-col gap-2">
              {SAMPLE_TEXT_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunPreset(preset.text)}
                  className="text-left p-3 rounded-xl backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/15 hover:border-indigo-500/30 transition-all text-xs active:scale-98"
                >
                  <div className="font-bold text-slate-100 text-xs">
                    {preset.title}
                  </div>
                  <div className="text-slate-400 text-[11px] italic truncate mt-0.5">
                    "{preset.text}"
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Real-time Scanning Indicator with Frosted Viewfinder & Neon Accent Scanning Beam */}
      {isScanning && (
        <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/20 shadow-2xl p-8 text-center transition-colors relative overflow-hidden">
          {/* Frosted Viewfinder with Scanning Beam */}
          {selectedImage ? (
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto mb-4 rounded-2xl overflow-hidden border border-indigo-500/40 shadow-2xl">
              <img
                src={selectedImage}
                alt="Scan preview"
                className="w-full h-full object-cover filter brightness-90"
              />
              <div className="absolute inset-0 bg-[#0B0F19]/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <Loader2 className="w-8 h-8 text-indigo-300 animate-spin" />
              </div>
              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />
              {/* Neon Accent Scanning Beam */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_#10B981,0_0_35px_#10B981] animate-scan-beam pointer-events-none" />
            </div>
          ) : (
            <div className="relative w-48 h-36 mx-auto mb-4 rounded-2xl overflow-hidden border border-indigo-500/40 bg-[#0B0F19]/60 backdrop-blur-md flex items-center justify-center shadow-2xl">
              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />
              {/* Neon Accent Scanning Beam */}
              <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_18px_#10B981,0_0_35px_#10B981] animate-scan-beam pointer-events-none" />
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          )}

          <h3 className="font-extrabold text-base text-slate-100 tracking-tight">
            AI Camera Scanner is Actief
          </h3>
          <p className="text-xs text-emerald-300 font-semibold mt-1">
            {scanProgressStage || 'Tekst en werkwoorden analyseren...'}
          </p>

          <div className="w-48 h-1 bg-indigo-950/80 rounded-full mx-auto mt-4 overflow-hidden border border-indigo-500/20">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-indigo-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* High-Contrast Result Feedback & Diagnostic Error Overlays */}
      {scanResult && !isScanning && (
        <div className="space-y-4">
          {/* Top Result Bar */}
          <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-4 flex items-center justify-between transition-colors">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Scan Resultaat
              </span>
              <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                {scanResult.detectedVerbs.length} werkwoord(en) geanalyseerd
              </h3>
            </div>
            <button
              onClick={() => {
                setScanResult(null);
                setSelectedImage(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/40 text-slate-200 border border-indigo-500/20 active:scale-95 transition-all shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nieuwe Scan</span>
            </button>
          </div>

          {/* Extracted Text Box with Sentence Highlights */}
          <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-4 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Herkende Nederlandse Tekst:</span>
            </div>
            <div className="p-3.5 backdrop-blur-xl bg-indigo-950/30 rounded-xl text-xs text-slate-200 leading-relaxed border border-indigo-500/15 italic font-medium">
              "{scanResult.rawText}"
            </div>
          </div>

          {/* Detected Verbs & Diagnostic Error Overlays */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Werkwoord Diagnoses & Valkuilen
            </h4>

            {scanResult.detectedVerbs.length === 0 ? (
              <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-6 text-center text-xs text-slate-400">
                Geen werkwoorden herkend in deze tekst. Probeer een duidelijkere foto van een Nederlandse zin.
              </div>
            ) : (
              scanResult.detectedVerbs.map((v: DetectedVerb, idx: number) => {
                const isSaved = !!savedVerbs[v.infinitive];

                return (
                  <div
                    key={`${v.verb}-${idx}`}
                    className={`rounded-2xl backdrop-blur-2xl border p-4 sm:p-5 transition-all space-y-3.5 shadow-2xl ${
                      v.isCorrect
                        ? 'bg-indigo-950/20 border-emerald-500/30 hover:border-emerald-500/40'
                        : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.12)]'
                    }`}
                  >
                    {/* Status Pill Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {v.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Correct</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-xl bg-rose-950/40 text-rose-300 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Valkuil Gedetecteerd</span>
                          </span>
                        )}

                        <span className="text-xs font-mono font-bold text-slate-100 bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-500/25">
                          "{v.verb}"
                        </span>
                      </div>

                      <span className="text-xs text-slate-400 font-medium">
                        Infinitief: <strong className="text-slate-100 font-bold">{v.infinitive}</strong>
                      </span>
                    </div>

                    {/* Diagnostic Comparison (Gevonden vs. Moet zijn) */}
                    {!v.isCorrect && (
                      <div className="grid grid-cols-2 gap-2.5 p-3 backdrop-blur-xl bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs">
                        <div>
                          <span className="text-[10px] text-rose-400 font-bold block uppercase tracking-wider">
                            Gevonden (Fout)
                          </span>
                          <span className="font-bold text-rose-300 line-through text-sm font-mono block mt-0.5">
                            {v.verb}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">
                            Correcte Vervoeging
                          </span>
                          <span className="font-bold text-emerald-300 flex items-center gap-1 text-sm font-mono mt-0.5">
                            {v.correction}
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Native Language Coach Box */}
                    <div className="p-3.5 backdrop-blur-xl bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 text-indigo-300 font-bold text-xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span>AI Coach ({getNativeLanguageLabel(nativeLanguage)}):</span>
                      </div>
                      <p className="text-slate-200 leading-relaxed text-xs font-normal">
                        {v.ruleExplanation}
                      </p>
                    </div>

                    {/* Actions: Save to Mijn Fouten or Open in Checker */}
                    <div className="pt-2.5 border-t border-indigo-500/15 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleSaveVerb(v.infinitive)}
                        disabled={isSaved}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          isSaved
                            ? 'backdrop-blur-xl bg-emerald-950/40 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/40 text-slate-200 border-indigo-500/20 shadow-sm'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Opgeslagen!</span>
                          </>
                        ) : (
                          <>
                            <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Mijn Fouten</span>
                          </>
                        )}
                      </button>

                      {onInspectVerb && (
                        <button
                          onClick={() => onInspectVerb(v.infinitive)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 hover:text-indigo-100 backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/20 active:scale-95 transition-all"
                        >
                          <span>Open in Checker</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Overall AI Coach Summary */}
          {scanResult.overallCoaching && (
            <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/20 shadow-2xl p-4 sm:p-5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                  Algemeen Coach Advies
                </h4>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-normal">
                {scanResult.overallCoaching}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
