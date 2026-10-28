# 🇳🇱 Kofschip — Dutch NT2 Verb Master

> Master Dutch verb conjugation with AI-powered learning. Built for NT2 students (A1–B2) and Inburgering candidates.

## ✨ Features

- **'t Kofschip Rule Engine** — Deterministic past tense & participle checker
- **AI Camera Scan** — Point your camera at Dutch text, get instant verb analysis (Gemini Vision)
- **Separable Verb Trainer** — Interactive drills for scheidbare werkwoorden
- **Hebben/Zijn Coach** — Master auxiliary verb selection
- **Mijn Fouten** — Spaced repetition for your personal mistake patterns
- **Native Language Coach** — Grammar explanations in your own language

## 🏗️ Architecture (DOE Framework)

```
kofschip/
├── directives/          # SOPs — Dutch grammar rules & decision trees
│   └── verb_rules_sop.md
├── orchestration/       # AI reasoning layer (Gemini integration)
├── execution/           # Deterministic TypeScript rule engine
│   └── verb_engine.ts
├── supabase/            # Database schema & Edge Functions
│   └── schema.sql
├── src/                 # React PWA frontend
└── public/              # Static assets
```

## 💰 Business Model

| Feature | Free | Pro (€14.99 Lifetime) |
|---------|------|-----------------------|
| Verb conjugation drills | ✅ | ✅ |
| AI Camera Scans | 3/day | Unlimited |
| Ads | Banner + Interstitial | None |
| Mijn Fouten (spaced repetition) | Limited | Full |
| Native language grammar coach | ❌ | ✅ |

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS (PWA / Capacitor-ready)
- **Database & Auth:** Supabase (PostgreSQL + RLS)
- **AI:** Google Gemini Vision API + Gemini Flash
- **Payments:** RevenueCat (€14.99 one-time)
- **Ads:** Google AdMob

## 🚀 Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

Copy `.env.example` to `.env` and fill in your API keys.

## 📄 License

Proprietary — All rights reserved.
