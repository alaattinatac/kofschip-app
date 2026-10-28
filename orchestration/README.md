# Orchestration Layer

This directory contains the AI reasoning layer for the Kofschip app.

## Responsibilities

1. **Camera Scan OCR** — Gemini Vision API integration for extracting Dutch text from photos
2. **Verb Extraction** — Identifying and parsing conjugated verbs from extracted text
3. **Personalized Coaching** — Gemini Flash for generating grammar explanations in the user's native language
4. **Smart Review Scheduling** — AI-enhanced spaced repetition prioritization

## Planned Modules

- `camera_scan.ts` — Gemini Vision API wrapper for photo → text → verb extraction
- `grammar_coach.ts` — Personalized grammar explanations using Gemini Flash
- `review_scheduler.ts` — Spaced repetition algorithm with AI-enhanced prioritization

## Integration Points

- **Execution layer** (`/execution/verb_engine.ts`) — Called for deterministic rule checking
- **Supabase** — Reads/writes user data, verb logs, and scan history
- **Gemini API** — Vision for OCR, Flash for fast text generation
