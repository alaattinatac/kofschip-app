# 't Kofschip - Dutch Grammar Engine Master Directive

## 1. Primary Rule: 100% Nederlands
- ALL UI strings, badges, labels, and buttons MUST be in authentic Dutch.
- "Düzenli" -> "Regelmatig (Zwak) Werkwoord"
- "Düzensiz" -> "Onregelmatig Werkwoord"
- "Kelime Defterim" -> "Mijn Woorden"

## 2. Grammar Execution Logic
- 't Kofschip logic (-te/-de) ONLY applies to regular (zwak) verbs.
- Irregular verbs (e.g. "nemen", "zijn"):
  * DO NOT calculate 't kofschip endings.
  * Show prominent "Onregelmatig Werkwoord" badge.
  * Output exact irregular forms directly (OVT: nam/namen, VD: genomen).

## 3. Pedagogical Section Sequence
1. Stam & 't Kofschip
2. Voltooid Deelwoord (V.T.T.)
3. Verleden Tijd (O.V.T.)
4. Onvoltooid Tegenwoordige Tijd (O.T.T.)

## 4. Color System
- Light Mode: Cream Slate (#F8FAFC), Dark Slate Text (#0F172A).
- Dark Mode: Deep Night Indigo (#0B0F19), Silver Text (#E2E8F0).
- Grammar Badges: Stem (Blue #3B82F6), Regular (Green #10B981), Irregular (Amber #F59E0B).

## 5. Build Verification
- Before finishing any task, run npm run build.
- Fix any TypeScript errors automatically before returning control to the user.