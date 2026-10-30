export interface KofschipLogoProps {
  /** Size variant or explicit pixel size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero' | number;
  /** Whether to render the brand text beside the emblem */
  showText?: boolean;
  /** Whether to render the NT2 badge and subtitle */
  showSubtitle?: boolean;
  /** Optional custom class name */
  className?: string;
  /** Pulse or glow effect */
  glow?: boolean;
  /** Dark mode toggle (default: true) */
  isDarkMode?: boolean;
}

/**
 * Custom 't Kofschip Emblem & Logo
 * Sleek, modern Apple-aesthetic emblem uniting:
 * 1. An elegant Dutch grammar feather pen (quill) with golden nib
 * 2. Billowing sails and fluid hull curves of the historic 't Kofschip vessel
 * 3. Modern, high-contrast typography and subtle glowing gradients
 */
export function KofschipEmblem({
  size = 40,
  glow = false,
  className = '',
  isDarkMode = true,
}: {
  size?: number;
  glow?: boolean;
  className?: string;
  isDarkMode?: boolean;
}) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Background ambient glow if requested */}
      {glow && (
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-indigo-500/40 via-purple-500/30 to-emerald-400/30 blur-md pointer-events-none"
          style={{ transform: 'scale(1.2)' }}
        />
      )}

      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
      >
        <defs>
          {/* Outer Squircle Container Gradient */}
          <linearGradient id="kofschipBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="50%" stopColor="#1e1e38" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Quill Body & Plume Gradient */}
          <linearGradient id="plumeGrad" x1="20%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C7D2FE" />
            <stop offset="30%" stopColor="#818CF8" />
            <stop offset="70%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>

          {/* Sail & Wave Gradient */}
          <linearGradient id="sailWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6EE7B7" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Gold Nib Gradient */}
          <linearGradient id="goldNibGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="45%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Glass Rim Border Highlight */}
          <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A5B4FC" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.4" />
          </linearGradient>

          {/* Shadow Filter */}
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Squircle Shield Container with Crisp Rim */}
        <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#kofschipBg)" />
        <rect
          x="4"
          y="4"
          width="112"
          height="112"
          rx="28"
          fill="none"
          stroke={isDarkMode ? 'url(#rimGrad)' : '#CBD5E1'}
          strokeWidth={isDarkMode ? '1.5' : '2.5'}
        />

        {/* 2. Historic Kofschip Sail & Calligraphy Wave swoosh */}
        <path
          d="M 22 84 C 36 74, 54 82, 70 78 C 84 75, 96 68, 100 64 C 94 76, 78 86, 62 88 C 42 90, 30 88, 22 84 Z"
          fill="url(#sailWaveGrad)"
          opacity="0.85"
        />
        <path
          d="M 26 90 C 44 86, 68 93, 94 84 C 84 94, 58 97, 34 94 C 29 93, 26 91, 26 90 Z"
          fill="url(#sailWaveGrad)"
          opacity="0.4"
        />

        {/* 3. Billowing Secondary Sail Curve */}
        <path
          d="M 52 36 C 40 48, 38 66, 44 76 C 48 72, 54 64, 58 52 C 60 46, 58 40, 52 36 Z"
          fill="#38BDF8"
          opacity="0.65"
        />

        {/* 4. The Grand Feather Quill Plume (Dutch Grammar Pen) */}
        <path
          d="M 88 18 C 94 28, 95 44, 88 56 C 85 53, 84 49, 87 45 C 80 55, 78 64, 73 70 C 70 67, 70 63, 73 59 C 68 66, 64 73, 58 78 L 52 74 C 62 64, 76 46, 84 28 C 86 24, 87 20, 88 18 Z"
          fill="url(#plumeGrad)"
        />

        {/* Main feather body & spine */}
        <path
          d="M 91 16 C 72 26, 56 46, 46 68 L 44 73 L 49 76 C 58 56, 74 36, 91 16 Z"
          fill="#E0E7FF"
        />

        {/* Quill Shaft descending into the Golden Nib */}
        <path d="M 48 68 L 38 84 L 43 87 L 53 71 Z" fill="url(#plumeGrad)" />

        {/* 5. Golden Calligraphy Nib */}
        <path d="M 38 84 L 28 98 L 41 93 L 43 87 Z" fill="url(#goldNibGrad)" />
        <line x1="28" y1="98" x2="36" y2="88" stroke="#78350F" strokeWidth="1" strokeLinecap="round" />
        <circle cx="36" cy="88" r="1.2" fill="#78350F" />

        {/* 6. Grammar Twinkle Spark at the Nib Tip */}
        <g transform="translate(26, 96)">
          <circle cx="0" cy="0" r="2.5" fill="#FDE68A" />
          <line x1="-4" y1="0" x2="4" y2="0" stroke="#FDE68A" strokeWidth="1" strokeLinecap="round" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="#FDE68A" strokeWidth="1" strokeLinecap="round" />
        </g>

        {/* Subtle 't K monogram curve embedded in the plume */}
        <path d="M 74 38 Q 78 40, 82 36" stroke="#EEF2FF" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      </svg>
    </div>
  );
}

/**
 * Full 't Kofschip Brand Logo Component
 * Available in Header, Hero, and Custom variations with crisp typography.
 */
export function KofschipLogo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  className = '',
  glow = false,
  isDarkMode = true,
}: KofschipLogoProps) {
  const pixelSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 32
      : size === 'md'
      ? 40
      : size === 'lg'
      ? 52
      : size === 'xl'
      ? 68
      : 84; // hero

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <KofschipEmblem size={pixelSize} glow={glow} isDarkMode={isDarkMode} />

      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className={`font-extrabold tracking-tight text-base sm:text-lg ${
              isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'
            }`}>
              <span className={`font-bold mr-0.5 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>'t</span>
              Kofschip
            </span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${
              isDarkMode
                ? 'backdrop-blur-xl bg-indigo-950/60 text-indigo-300 border-indigo-500/30'
                : 'bg-indigo-50 text-indigo-900 border-slate-300'
            }`}>
              NT2
            </span>
          </div>
          {showSubtitle && (
            <span className={`text-[11px] font-semibold tracking-normal mt-0.5 block leading-tight ${
              isDarkMode ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Nederlandse Werkwoorden NT2
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Hero Section Emblem with subtle glowing pedestal & 't Kofschip grammar badge
 */
export function KofschipHeroBadge({
  className = '',
  isDarkMode = true,
}: {
  className?: string;
  isDarkMode?: boolean;
}) {
  return (
    <div
      className={`relative inline-flex items-center gap-3 p-2 pr-4 rounded-2xl border transition-all group ${
        isDarkMode
          ? 'backdrop-blur-2xl bg-indigo-950/30 border-indigo-500/20 shadow-xl shadow-indigo-950/50 hover:border-indigo-400/40'
          : 'bg-white border-slate-300 shadow-md hover:border-slate-400'
      } ${className}`}
    >
      {/* Radiant glow under the emblem */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-indigo-500/20 via-emerald-500/15 to-purple-500/20 blur-md opacity-70 group-hover:opacity-100 transition duration-300 pointer-events-none" />

      <KofschipEmblem size={44} glow={true} isDarkMode={isDarkMode} />

      <div className="relative z-10 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-extrabold tracking-tight ${isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>
            't Kofschip Vervoeging
          </span>
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
            isDarkMode
              ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
            Vervoeging A1–B2
          </span>
        </div>
        <p className={`text-[11px] mt-0.5 font-normal leading-tight ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Stamregel • Klankvalkuilen{' '}
          <span className={`font-semibold ${isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>v/f</span>{' '}
          &amp;{' '}
          <span className={`font-semibold ${isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]'}`}>z/s</span>
        </p>
      </div>
    </div>
  );
}
