---
title: "Dutch Verb Grammar Rules — Standard Operating Procedure"
version: "1.0.0"
last_updated: "2025-10-25"
audience: "NT2 students (A1–B2), Inburgering candidates"
app: "Kofschip — Dutch Verb Master"
---

# Dutch Verb Grammar Rules — SOP

> This document is the **single source of truth** for all deterministic grammar rules
> used by the Kofschip verb engine. Every rule described here maps 1:1 to code in
> `/execution/verb_engine.ts`.

---

## Table of Contents

1. [Stem Derivation (Stam Afleiden)](#1-stem-derivation)
2. ['t Kofschip Rule (Past Tense)](#2-t-kofschip-rule)
3. [Past Participle (Voltooid Deelwoord)](#3-past-participle)
4. [Present Tense Conjugation](#4-present-tense-conjugation)
5. [Irregular Verbs (Sterke Werkwoorden)](#5-irregular-verbs)
6. [Separable Verbs (Scheidbare Werkwoorden)](#6-separable-verbs)
7. [Hebben vs. Zijn (Auxiliary Selection)](#7-hebben-vs-zijn)
8. [Common Pitfalls & Gotchas](#8-common-pitfalls)

---

## 1. Stem Derivation

The **stem** (stam) is the foundation of all Dutch conjugation. Every rule depends on
correctly deriving the stem from the infinitive.

### Algorithm

```
INPUT:  infinitive (e.g., "werken", "leven", "pakken", "maken")
OUTPUT: spelled stem + original end consonant

Step 1: Remove the "-en" suffix → raw stem
        "werken" → "werk"
        "maken"  → "mak"
        "pakken" → "pakk"
        "leven"  → "lev"

Step 2: Apply Dutch spelling rules to raw stem:

  Rule A — Double Consonant Reduction:
    If raw stem ends in a doubled consonant → reduce to single.
    "pakk" → "pak"   |   "renn" → "ren"   |   "zett" → "zet"

  Rule B — Open Syllable Vowel Doubling:
    If the infinitive has a single vowel in an open syllable (CV-Cen pattern),
    double the vowel in the stem to preserve the long sound.
    "ma-ken" (long a) → stem "maak"
    "lo-pen" (long o) → stem "loop"
    "le-ren" (long e) → stem "leer"
    "bo-ren" (long o) → stem "boor"
    "spe-len" (long e) → stem "speel"

  Rule C — v → f (end of stem):
    "lev" → "leef"    (store originalEndConsonant = 'v')
    "schrijv" → "schrijf"
    "gev" → "geef"

  Rule D — z → s (end of stem):
    "reiz" → "reis"    (store originalEndConsonant = 'z')
    "verhuis" (already 's'? No: "verhuizen" → "verhuiz" → "verhuis")
    "leez" → "lees"    (from "lezen")

Step 3: Record the originalEndConsonant BEFORE the v→f / z→s change.
        This is CRITICAL for the kofschip check (see Section 2).
```

### Stem Examples Table

| Infinitive   | Raw Stem  | Spelling Rule Applied     | Spelled Stem | Original End |
|-------------|-----------|---------------------------|-------------|-------------|
| werken      | werk      | (none)                    | werk        | k           |
| maken       | mak       | vowel doubling (a→aa)     | maak        | k           |
| pakken      | pakk      | double consonant → single | pak         | k           |
| fietsen     | fiets     | (none)                    | fiets       | s           |
| wonen       | won       | vowel doubling (o→oo)     | woon        | n           |
| leven       | lev       | v→f + vowel doubling      | leef        | **v**       |
| reizen      | reiz      | z→s + vowel doubling      | reis        | **z**       |
| hopen       | hop       | vowel doubling (o→oo)     | hoop        | p           |
| lachen      | lach      | (none)                    | lach        | ch          |
| straffen    | straff    | double consonant → single | straf       | f           |
| zetten      | zett      | double consonant → single | zet         | t           |
| rennen      | renn      | double consonant → single | ren         | n           |
| bellen      | bell      | double consonant → single | bel         | l           |
| leren       | ler       | vowel doubling (e→ee)     | leer        | r           |
| verhuizen   | verhuiz   | z→s                       | verhuis     | **z**       |
| schrijven   | schrijv   | v→f                       | schrijf     | **v**       |

---

## 2. 't Kofschip Rule

> **Mnemonic:** **'t kofschip**, **fokschaap**, or extended as **'t ex-kofschip** / **'t kofschip-taxi** — the voiceless consonants **t, k, f, s, ch, p, x**.

### Rule

The last consonant of the stem (infinitive minus *-en*, before spelling changes) determines the past tense suffix:

```
                ┌─────────────────────────────────────────┐
                │    STEM's original end consonant         │
                │    (BEFORE v→f, z→s spelling changes!)   │
                └──────────┬──────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
    ∈ {t, k, f, s, ch, p, x}   NOT in {t, k, f, s, ch, p, x}
    (= "'t ex-kofschip")       (all other consonants & vowels)
              │                         │
         -te / -ten                -de / -den
         (singular/plural)         (singular/plural)
```

> **Note on 'x':** Loanwords and modern verbs ending in 'x' (such as *mixen*, *faxen*, *relaxen*) end in the voiceless sound /ks/, so 'x' is part of the extended rule: *ik mixte / gefaxt*, *ik faxte / gefaxt*.

### ⚠️ CRITICAL: The v/z Rule

This is the **#1 mistake** NT2 students make:

| Infinitive | Spelled Stem | Original End | In Kofschip? | Past Tense      |
|-----------|-------------|-------------|-------------|-----------------|
| leven     | leef        | **v**       | ❌ NO        | leef**de**/leef**den** |
| reizen    | reis        | **z**       | ❌ NO        | reis**de**/reis**den** |
| schrijven | schrijf     | **v**       | ❌ NO        | schreef/schreven (irregular!) |
| verhuizen | verhuis     | **z**       | ❌ NO        | verhuis**de**/verhuis**den** |

> **The stem LOOKS like it ends in 'f' or 's' (kofschip letters), but the
> ORIGINAL consonant was 'v' or 'z' — which are NOT in kofschip!**
> → Always use **-de/-den** for v→f and z→s verbs.

### Past Tense Examples

| Infinitive | Stem  | Original End | Kofschip? | Past Sing. | Past Plur. |
|-----------|-------|-------------|-----------|-----------|------------|
| werken    | werk  | k           | ✅ YES    | werkte    | werkten    |
| maken     | maak  | k           | ✅ YES    | maakte    | maakten    |
| fietsen   | fiets | s           | ✅ YES    | fietste   | fietsten   |
| koken     | kook  | k           | ✅ YES    | kookte    | kookten    |
| hopen     | hoop  | p           | ✅ YES    | hoopte    | hoopten    |
| lachen    | lach  | ch          | ✅ YES    | lachte    | lachten    |
| straffen  | straf | f           | ✅ YES    | strafte   | straften   |
| pakken    | pak   | k           | ✅ YES    | pakte     | pakten     |
| zetten    | zet   | t           | ✅ YES    | zette     | zetten     |
| wonen     | woon  | n           | ❌ NO     | woonde    | woonden    |
| leren     | leer  | r           | ❌ NO     | leerde    | leerden    |
| bellen    | bel   | l           | ❌ NO     | belde     | belden     |
| rennen    | ren   | n           | ❌ NO     | rende     | renden     |
| leven     | leef  | **v**       | ❌ NO     | leefde    | leefden    |
| reizen    | reis  | **z**       | ❌ NO     | reisde    | reisden    |
| verhuizen | verhuis| **z**      | ❌ NO     | verhuisde | verhuisden |
| antwoorden| antwoord| d         | ❌ NO     | antwoordde| antwoordden|
| studeren  | studeer| r          | ❌ NO     | studeerde | studeerden |
| bouwen    | bouw  | w           | ❌ NO     | bouwde    | bouwden    |

---

## 3. Past Participle (Voltooid Deelwoord)

### Regular Verbs

```
Formula:  ge- + stem + t  (if kofschip)
          ge- + stem + d  (if NOT kofschip)
```

> **Double -t / -d rule:** If the stem already ends in `-t` or `-d`, do **not** add another `t` or `d`. Dutch spelling forbids double consonants at the end of a word:
> - *zetten* → stem *zet* → participle is **gezet** (never *~~gezett~~*)
> - *antwoorden* → stem *antwoord* → participle is **geantwoord** (never *~~geantwoordd~~*)
> - *landen* → stem *land* → participle is **geland**

Again, check the **original** end consonant for v→f and z→s verbs!

| Infinitive | Stem   | Original End | Kofschip? | Participle  |
|-----------|--------|-------------|-----------|-------------|
| werken    | werk   | k           | ✅        | ge**werk**t |
| maken     | maak   | k           | ✅        | ge**maak**t |
| fietsen   | fiets  | s           | ✅        | ge**fiets**t|
| koken     | kook   | k           | ✅        | ge**kook**t |
| pakken    | pak    | k           | ✅        | ge**pak**t  |
| lachen    | lach   | ch          | ✅        | ge**lach**t |
| wonen     | woon   | n           | ❌        | ge**woon**d |
| leren     | leer   | r           | ❌        | ge**leer**d |
| bellen    | bel    | l           | ❌        | ge**bel**d  |
| leven     | leef   | **v**       | ❌        | ge**leef**d |
| reizen    | reis   | **z**       | ❌        | ge**reis**d |
| bouwen    | bouw   | w           | ❌        | ge**bouw**d |

### Exceptions to the ge- Prefix

Verbs with the following **inseparable prefixes** do NOT get `ge-`:

| Prefix | Example          | Participle     |
|--------|-----------------|----------------|
| be-    | betalen         | betaal**d**    |
| er-    | erkennen        | erkend         |
| ge-    | gebruiken       | gebruik**t**   |
| her-   | herhalen        | herhaald       |
| ont-   | ontmoeten       | ontmoet        |
| ver-   | vertellen       | verteld        |

### Separable Verbs: ge- Goes Between Prefix and Stem

```
op + bellen  → op + ge + bel + d  = opgebeld
aan + kijken → aan + ge + kek + en = aangekeken (irregular)
mee + maken  → mee + ge + maak + t = meegemaakt
```

---

## 4. Present Tense Conjugation

### Standard Pattern

| Person       | Pattern     | Example (werken) |
|-------------|-------------|-----------------|
| ik          | stem        | werk            |
| jij/je      | stem + t    | werkt           |
| u           | stem + t    | werkt           |
| hij/zij/het | stem + t    | werkt           |
| wij/we      | infinitive  | werken          |
| jullie      | infinitive  | werken          |
| zij (pl.)   | infinitive  | werken          |

### Special Rules

**Rule 1: Stem already ends in -t**

If the stem already ends in `t`, do NOT add another `t` for 2nd/3rd person:

- "zitten" → stem "zit" → "jij zit" (not ~~"jij zitt"~~)
- "praten" → stem "praat" → "jij praat" (not ~~"jij praatt"~~)

**Rule 2: Jij-inversie (jij inversion)**

When `jij/je` comes AFTER the verb (in questions or inverted sentences), 
the `-t` is dropped:

- Normal: "Jij **werkt** hard."
- Inverted: "**Werk** jij hard?" (drop the -t!)
- Normal: "Jij **fietst** naar school."
- Inverted: "**Fiets** jij naar school?"

**Rule 3: Separable verbs split in main clauses**

- "opbellen" → "Ik **bel** je **op**." / "Jij **belt** me **op**."
- "aankomen" → "De trein **komt** om 9 uur **aan**."
- BUT in subordinate clauses: "...dat ik je **opbel**" (stays together)

### Present Tense with v→f and z→s

The spelled stem is used in present tense:

- "leven" → stem "leef" → "ik leef, jij leeft, wij leven"
- "reizen" → stem "reis" → "ik reis, jij reist, wij reizen"
- "geven" → stem "geef" → "ik geef, jij geeft, wij geven"

---

## 5. Irregular Verbs (Sterke Werkwoorden)

Irregular verbs do **NOT** follow the 't kofschip rule for past tense.
Their past tense forms must be memorized.

### Priority List — Top 20 Most Common

| #  | Infinitive | Past Sing. | Past Plur. | Participle  | Aux.   |
|----|-----------|-----------|------------|-------------|--------|
| 1  | zijn      | was       | waren      | geweest     | zijn   |
| 2  | hebben    | had       | hadden     | gehad       | hebben |
| 3  | worden    | werd      | werden     | geworden    | zijn   |
| 4  | kunnen    | kon       | konden     | gekund      | hebben |
| 5  | zullen    | zou       | zouden     | —           | —      |
| 6  | moeten    | moest     | moesten    | gemoeten    | hebben |
| 7  | gaan      | ging      | gingen     | gegaan      | zijn   |
| 8  | komen     | kwam      | kwamen     | gekomen     | zijn   |
| 9  | willen    | wilde/wou | wilden     | gewild      | hebben |
| 10 | zien      | zag       | zagen      | gezien      | hebben |
| 11 | doen      | deed      | deden      | gedaan      | hebben |
| 12 | zeggen    | zei       | zeiden     | gezegd      | hebben |
| 13 | mogen     | mocht     | mochten    | gemogen     | hebben |
| 14 | staan     | stond     | stonden    | gestaan     | hebben |
| 15 | denken    | dacht     | dachten    | gedacht     | hebben |
| 16 | geven     | gaf       | gaven      | gegeven     | hebben |
| 17 | nemen     | nam       | namen      | genomen     | hebben |
| 18 | vinden    | vond      | vonden     | gevonden    | hebben |
| 19 | weten     | wist      | wisten     | geweten     | hebben |
| 20 | krijgen   | kreeg     | kregen     | gekregen    | hebben |

### Grouped by Vowel Pattern

**Pattern: ij → ee → e (schrijven-type)**
| schrijven → schreef / schreven / geschreven |
| blijven → bleef / bleven / gebleven |
| rijden → reed / reden / gereden |
| kijken → keek / keken / gekeken |
| krijgen → kreeg / kregen / gekregen |
| lijken → leek / leken / geleken |

**Pattern: ie → oo → o (bieden-type)**
| bieden → bood / boden / geboden |
| schieten → schoot / schoten / geschoten |
| sluiten → sloot / sloten / gesloten |
| kiezen → koos / kozen / gekozen |
| kruipen → kroop / kropen / gekropen |
| schuiven → schoof / schoven / geschoven |

**Pattern: i → o → o (drinken-type)**
| drinken → dronk / dronken / gedronken |
| vinden → vond / vonden / gevonden |
| zingen → zong / zongen / gezongen |
| winnen → won / wonnen / gewonnen |
| beginnen → begon / begonnen / begonnen |

**Pattern: e → a → o/e (spreken-type)**
| spreken → sprak / spraken / gesproken |
| breken → brak / braken / gebroken |
| nemen → nam / namen / genomen |
| stelen → stal / stalen / gestolen |

**Pattern: e → a → e (eten-type)**
| eten → at / aten / gegeten |
| lezen → las / lazen / gelezen |
| vergeten → vergat / vergaten / vergeten |
| geven → gaf / gaven / gegeven |

**Pattern: a → ie → a (slapen-type)**
| slapen → sliep / sliepen / geslapen |
| laten → liet / lieten / gelaten |
| vallen → viel / vielen / gevallen |
| houden → hield / hielden / gehouden |
| lopen → liep / liepen / gelopen |
| roepen → riep / riepen / geroepen |

### Additional Common Irregulars

| Infinitive  | Past Sing. | Past Plur. | Participle   | Aux.   |
|------------|-----------|------------|-------------|--------|
| brengen    | bracht    | brachten   | gebracht    | hebben |
| kopen      | kocht     | kochten    | gekocht     | hebben |
| zoeken     | zocht     | zochten    | gezocht     | hebben |
| helpen     | hielp     | hielpen    | geholpen    | hebben |
| sterven    | stierf    | stierven   | gestorven   | zijn   |
| trekken    | trok      | trokken    | getrokken   | hebben |
| zitten     | zat       | zaten      | gezeten     | hebben |
| liggen     | lag       | lagen      | gelegen     | hebben |
| zwemmen    | zwom      | zwommen    | gezwommen   | hebben/zijn |
| besluiten  | besloot   | besloten   | besloten    | hebben |
| begrijpen  | begreep   | begrepen   | begrepen    | hebben |
| vertrekken | vertrok   | vertrokken | vertrokken  | zijn   |

---

## 6. Separable Verbs (Scheidbare Werkwoorden)

### Separable Prefixes

| Prefix  | Example      | Meaning           |
|---------|-------------|-------------------|
| aan     | aankomen    | to arrive         |
| af      | afwassen    | to do dishes      |
| bij     | bijdragen   | to contribute     |
| door    | doorgaan    | to continue       |
| in      | instappen   | to board/get in   |
| mee     | meebrengen  | to bring along    |
| na      | nadenken    | to think about    |
| om      | omdraaien   | to turn around    |
| op      | opbellen    | to call (phone)   |
| rond    | rondkijken  | to look around    |
| tegen   | tegenkomen  | to encounter      |
| terug   | terugkomen  | to come back      |
| toe     | toevoegen   | to add            |
| uit     | uitleggen   | to explain        |
| voor    | voorstellen | to introduce      |
| voort   | voortduren  | to continue       |
| weg     | weggaan     | to go away        |

### Inseparable Prefixes (NEVER separate)

**be-, er-, ge-, her-, ont-, ver-**

| Prefix | Example     | Meaning       | Participle (no ge-!) |
|--------|-----------|---------------|---------------------|
| be-    | betalen   | to pay        | betaald             |
| er-    | erkennen  | to recognize  | erkend              |
| ge-    | gebruiken | to use        | gebruikt            |
| her-   | herhalen  | to repeat     | herhaald            |
| ont-   | ontmoeten | to meet       | ontmoet             |
| ver-   | vertellen | to tell       | verteld             |

### Separation Rules

```
┌─────────────────────────────────────────────────────────┐
│                  SENTENCE TYPE                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Main clause (present/past):                            │
│    → SPLIT: conjugated verb in position 2,              │
│             prefix at END of clause                     │
│    "Ik bel je morgen op."                               │
│    "Hij kwam gisteren aan."                             │
│                                                         │
│  Subordinate clause (dat/omdat/als/want...):            │
│    → TOGETHER: verb stays as one word at END            │
│    "...dat ik je morgen opbel."                         │
│    "...omdat hij gisteren aankwam."                     │
│                                                         │
│  Past participle:                                       │
│    → ge- BETWEEN prefix and stem                        │
│    "opgebeld", "aangekomen", "meegebracht"              │
│                                                         │
│  Infinitive with te:                                    │
│    → te BETWEEN prefix and stem                         │
│    "op te bellen", "aan te komen"                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Common Separable Verbs (20+)

| Infinitive    | Present (ik)     | Past (ik)        | Participle     |
|--------------|-----------------|-----------------|----------------|
| opbellen     | bel op          | belde op        | opgebeld       |
| aankomen     | kom aan         | kwam aan        | aangekomen     |
| meebrengen   | breng mee       | bracht mee      | meegebracht    |
| uitleggen    | leg uit         | legde uit       | uitgelegd      |
| terugkomen   | kom terug       | kwam terug      | teruggekomen   |
| doorgaan     | ga door         | ging door       | doorgegaan     |
| voorstellen  | stel voor       | stelde voor     | voorgesteld    |
| weggaan      | ga weg          | ging weg        | weggegaan      |
| nadenken     | denk na         | dacht na        | nagedacht      |
| afwassen     | was af          | waste af        | afgewassen     |
| opstaan      | sta op          | stond op        | opgestaan      |
| instappen    | stap in         | stapte in       | ingestapt      |
| uitnodigen   | nodig uit       | nodigde uit     | uitgenodigd    |
| opruimen     | ruim op         | ruimde op       | opgeruimd      |
| meemaken     | maak mee        | maakte mee      | meegemaakt     |
| afdrogen     | droog af        | droogde af      | afgedroogd     |
| bijdragen    | draag bij       | droeg bij       | bijgedragen    |
| omdraaien    | draai om        | draaide om      | omgedraaid     |
| rondkijken   | kijk rond       | keek rond       | rondgekeken    |
| tegenkomen   | kom tegen       | kwam tegen      | tegengekomen   |
| toevoegen    | voeg toe        | voegde toe      | toegevoegd     |

---

## 7. Hebben vs. Zijn (Auxiliary Selection)

### Decision Tree

```
                    ┌──────────────────┐
                    │   Which verb?     │
                    └────────┬─────────┘
                             │
                ┌────────────┴────────────┐
                │                         │
        Is it "zijn",              Is the verb
        "blijven", or              INTRANSITIVE?
        "worden"?                  (no direct object)
                │                         │
            YES → zijn              ┌─────┴─────┐
                                    NO          YES
                                    │           │
                               → hebben    Does it express
                                           CHANGE of state
                                           or location?
                                                │
                                          ┌─────┴─────┐
                                          NO          YES
                                          │           │
                                     → hebben      → zijn
```

### Always "ZIJN" Verbs

| Verb        | Meaning              | Example                          |
|------------|---------------------|----------------------------------|
| zijn       | to be               | Ik ben geweest                  |
| worden     | to become           | Hij is geworden                 |
| blijven    | to stay             | Wij zijn gebleven               |
| gaan       | to go               | Zij is gegaan                   |
| komen      | to come             | Hij is gekomen                  |
| vertrekken | to depart           | De trein is vertrokken          |
| beginnen   | to begin            | De film is begonnen             |
| stoppen    | to stop             | De bus is gestopt               |
| vallen     | to fall             | Hij is gevallen                 |
| groeien    | to grow             | De plant is gegroeid            |
| sterven    | to die              | Hij is gestorven                |
| slagen     | to pass/succeed     | Zij is geslaagd                 |
| zakken     | to fail/sink        | Hij is gezakt                   |
| verschijnen| to appear           | Het boek is verschenen          |
| verdwijnen | to disappear        | De kat is verdwenen             |
| opstaan    | to get up           | Ik ben opgestaan                |
| gebeuren   | to happen           | Het is gebeurd                  |
| genezen    | to heal             | De patiënt is genezen           |
| stijgen    | to rise             | De prijs is gestegen            |
| dalen      | to decrease         | De temperatuur is gedaald       |
| trouwen    | to get married      | Zij is getrouwd                 |

### "BOTH" Verbs (hebben OR zijn)

These verbs use **zijn** when expressing movement **with a destination**,
and **hebben** when expressing the **activity itself**:

| Verb     | Met hebben (activity)           | Met zijn (destination)              |
|---------|-------------------------------|-------------------------------------|
| rijden  | Hij **heeft** gereden (drove)  | Hij **is** naar huis gereden        |
| fietsen | Zij **heeft** gefietst         | Zij **is** naar school gefietst     |
| lopen   | Ik **heb** gelopen (walked)    | Ik **ben** naar de winkel gelopen   |
| zwemmen | Wij **hebben** gezwommen       | Wij **zijn** naar de overkant gezwommen |
| vliegen | Het vliegtuig **heeft** gevlogen| Hij **is** naar Londen gevlogen    |
| wandelen| Zij **heeft** gewandeld        | Zij **is** naar het park gewandeld  |
| rennen  | Hij **heeft** gerend           | Hij **is** naar de bus gerend       |
| reizen  | Wij **hebben** gereisd         | Wij **zijn** naar Spanje gereisd   |
| klimmen | Zij **heeft** geklommen        | Zij **is** op de berg geklommen     |
| smelten | De zon **heeft** het ijs gesmolten | Het ijs **is** gesmolten       |

---

## 8. Common Pitfalls & Gotchas

### ⚠️ Pitfall #1: v→f / z→s Kofschip Trap

**Wrong:** "leven" → stem "leef" → f is in kofschip → "leefte" ❌  
**Right:** "leven" → original consonant is "v" → v NOT in kofschip → "leefde" ✅

> Always check the ORIGINAL consonant, not the spelled one!

### ⚠️ Pitfall #2: Double Vowel Forgetting

**Wrong:** "maken" → stem "mak" → "makte" ❌  
**Right:** "maken" → open syllable → stem "maak" → "maakte" ✅

### ⚠️ Pitfall #3: Stem Ending in -t

**Wrong:** "praten" → stem "praat" → "jij praatt" ❌  
**Right:** "praten" → stem "praat" → "jij praat" ✅ (no extra t)

### ⚠️ Pitfall #4: Jij-inversie Forgetting

**Wrong:** "Werk**t** jij vandaag?" ❌  
**Right:** "Werk jij vandaag?" ✅ (drop -t when jij follows verb)

### ⚠️ Pitfall #5: ge- with Inseparable Prefixes

**Wrong:** "betalen" → "gebetaald" ❌  
**Right:** "betalen" → "betaald" ✅ (be- is inseparable, no ge-)

### ⚠️ Pitfall #6: Separable Participle ge- Placement

**Wrong:** "opbellen" → "geopbeld" ❌  
**Right:** "opbellen" → "opgebeld" ✅ (ge- between prefix and stem)

### ⚠️ Pitfall #7: Hebben vs. Zijn with Movement Verbs

**Wrong:** "Ik heb naar school gefietst" ❌ (destination present!)  
**Right:** "Ik ben naar school gefietst" ✅

**But:** "Ik heb de hele dag gefietst" ✅ (no destination, activity only)

---

## Appendix: Decision Flowchart for Past Tense

```
Student needs to conjugate a verb in the past tense:

  1. Is the verb IRREGULAR?
     ├── YES → Look up past tense form from the irregular verb list.
     │         Done.
     └── NO  → Continue to step 2.

  2. Derive the STEM from the infinitive.
     (Apply all spelling rules from Section 1.)

  3. What is the ORIGINAL end consonant?
     (Before v→f or z→s changes!)
     ├── ∈ {t, k, f, s, ch, p} → Use -te (singular) / -ten (plural)
     └── NOT in that set         → Use -de (singular) / -den (plural)

  4. For separable verbs:
     Past tense: conjugated part + ... + prefix at end
     "Ik belde haar op."

  Result: stem + te/de (singular) or stem + ten/den (plural)
```

---

*End of SOP — Version 1.0.0*
