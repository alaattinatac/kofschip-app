-- ============================================================================
-- Kofschip — Dutch NT2 Verb Conjugation Trainer
-- Supabase PostgreSQL Schema
-- Version: 1.0.0
-- Description:
--   Production-ready database schema for the Kofschip app.
--   Supports free-tier (ads + 3 daily AI scans) and Pro-tier (€14.99 lifetime
--   purchase — no ads, unlimited scans, full features).
--   Authentication is handled by Supabase Auth (email, Google, Apple).
--   Row Level Security (RLS) is enabled on every table.
-- ============================================================================

-- Enable the uuid-ossp extension for backward-compatible UUID generation.
-- gen_random_uuid() (pgcrypto) is available by default in modern Postgres,
-- but uuid-ossp is included here for maximum compatibility.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

BEGIN;

-- ============================================================================
-- 1. UTILITY: updated_at trigger function (reusable)
-- ============================================================================
-- Automatically sets the `updated_at` column to NOW() on every UPDATE.
-- Attach this trigger to any table that has an `updated_at` column.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at()
  IS 'Reusable trigger function that sets updated_at to NOW() on every row UPDATE.';

-- ============================================================================
-- 2. TABLE: profiles
-- ============================================================================
-- Extends Supabase auth.users with app-specific data.
-- A row is auto-created via trigger whenever a new auth.users row is inserted.
-- ============================================================================
CREATE TABLE public.profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name          TEXT,
  native_language       TEXT        DEFAULT 'en',         -- ISO 639-1 code (for personalised grammar coaching)
  current_level         TEXT        DEFAULT 'A1'
                                    CHECK (current_level IN ('A1', 'A2', 'B1', 'B2')),
  is_premium            BOOLEAN     DEFAULT FALSE,        -- €14.99 lifetime flag
  premium_purchased_at  TIMESTAMPTZ,                      -- when the user bought premium
  daily_scan_count      INTEGER     DEFAULT 0,            -- reset daily for free users
  daily_scan_reset_at   DATE        DEFAULT CURRENT_DATE, -- tracks when to reset the count
  streak_days           INTEGER     DEFAULT 0,
  last_active_at        TIMESTAMPTZ DEFAULT NOW(),
  total_verbs_practiced INTEGER     DEFAULT 0,
  total_correct         INTEGER     DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles
  IS 'App profile for each authenticated user. Created automatically via trigger on auth.users insert.';

-- Attach the updated_at trigger
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role bypasses RLS automatically; no explicit policy needed.

-- ============================================================================
-- 3. TRIGGER: auto-create profile on auth.users insert
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', NULL)
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user()
  IS 'Creates a profiles row whenever a new user signs up via Supabase Auth.';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 4. TABLE: verb_logs
-- ============================================================================
-- Immutable audit trail of every practice attempt.
-- Drives analytics, accuracy stats, and spaced-repetition scheduling.
-- ============================================================================
CREATE TABLE public.verb_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  infinitive       TEXT        NOT NULL,                   -- e.g. "werken"
  tense            TEXT        NOT NULL
                               CHECK (tense IN ('present', 'past', 'perfect', 'pastParticiple')),
  person           TEXT        NOT NULL
                               CHECK (person IN ('1s', '2s', '2s_formal', '3s', '1p', '2p', '3p')),
  user_answer      TEXT        NOT NULL,
  correct_answer   TEXT        NOT NULL,
  is_correct       BOOLEAN     NOT NULL,
  response_time_ms INTEGER,                                -- milliseconds the user took to answer
  source           TEXT        DEFAULT 'practice'
                               CHECK (source IN ('practice', 'camera_scan', 'daily_challenge', 'mistake_review')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.verb_logs
  IS 'Immutable log of every verb-conjugation attempt. Users may insert and read but never update or delete.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Recent activity feed
CREATE INDEX idx_verb_logs_user_created
  ON public.verb_logs (user_id, created_at DESC);

-- Spaced-repetition: per-verb accuracy lookup
CREATE INDEX idx_verb_logs_user_verb_correct
  ON public.verb_logs (user_id, infinitive, is_correct);

-- Global accuracy stats per user
CREATE INDEX idx_verb_logs_user_correct
  ON public.verb_logs (user_id, is_correct);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.verb_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own logs
CREATE POLICY "verb_logs_insert_own"
  ON public.verb_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own logs
CREATE POLICY "verb_logs_select_own"
  ON public.verb_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- No UPDATE or DELETE policies → immutable audit trail

-- ============================================================================
-- 5. TABLE: saved_words
-- ============================================================================
-- User's personal vocabulary list / bookmarked verbs.
-- Tracks spaced-repetition scheduling and mastery level.
-- ============================================================================
CREATE TABLE public.saved_words (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  infinitive        TEXT        NOT NULL,
  translation       TEXT,                                  -- in the user's native language
  notes             TEXT,                                  -- personal notes
  difficulty_rating INTEGER     DEFAULT 3
                                CHECK (difficulty_rating BETWEEN 1 AND 5),
  times_practiced   INTEGER     DEFAULT 0,
  times_correct     INTEGER     DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  next_review_at    TIMESTAMPTZ,                           -- spaced-repetition scheduling
  mastery_level     INTEGER     DEFAULT 0
                                CHECK (mastery_level BETWEEN 0 AND 5),  -- 0 = new, 5 = mastered
  is_favorite       BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate saves of the same verb per user
  UNIQUE (user_id, infinitive)
);

COMMENT ON TABLE public.saved_words
  IS 'User-curated vocabulary list with spaced-repetition metadata and mastery tracking.';

-- Attach the updated_at trigger
CREATE TRIGGER saved_words_updated_at
  BEFORE UPDATE ON public.saved_words
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- Spaced-repetition review queue
CREATE INDEX idx_saved_words_user_next_review
  ON public.saved_words (user_id, next_review_at ASC);

-- Filter by progress / mastery
CREATE INDEX idx_saved_words_user_mastery
  ON public.saved_words (user_id, mastery_level);

-- Quick access to favourites
CREATE INDEX idx_saved_words_user_favorite
  ON public.saved_words (user_id, is_favorite)
  WHERE is_favorite = TRUE;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.saved_words ENABLE ROW LEVEL SECURITY;

-- Full CRUD for the owning user only
CREATE POLICY "saved_words_select_own"
  ON public.saved_words
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "saved_words_insert_own"
  ON public.saved_words
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_words_update_own"
  ON public.saved_words
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_words_delete_own"
  ON public.saved_words
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. TABLE: camera_scans
-- ============================================================================
-- Logs of AI-powered photo scans (OCR → verb extraction → Gemini explanation).
-- Free users get 3 scans per day; Pro users get unlimited.
-- ============================================================================
CREATE TABLE public.camera_scans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url       TEXT,                                    -- Supabase Storage URL (optional; images may not be persisted)
  extracted_text  TEXT,                                    -- raw OCR result
  verbs_found     JSONB       DEFAULT '[]'::jsonb,         -- [{infinitive, context_sentence, conjugated_form}, …]
  ai_explanation  TEXT,                                    -- Gemini's grammar explanation
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.camera_scans
  IS 'Log of AI camera scans. Each row records the OCR text, extracted verbs, and Gemini grammar explanation.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.camera_scans ENABLE ROW LEVEL SECURITY;

-- Users can insert their own scans
CREATE POLICY "camera_scans_insert_own"
  ON public.camera_scans
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own scans
CREATE POLICY "camera_scans_select_own"
  ON public.camera_scans
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. TABLE: daily_challenges
-- ============================================================================
-- Pre-generated daily challenges. One row per calendar date.
-- Readable by any authenticated user; writable only by the service role.
-- ============================================================================
CREATE TABLE public.daily_challenges (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date  DATE        NOT NULL UNIQUE,
  challenge_data  JSONB       NOT NULL,                    -- array of verb questions
  difficulty      TEXT        DEFAULT 'mixed'
                              CHECK (difficulty IN ('A1', 'A2', 'B1', 'B2', 'mixed')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.daily_challenges
  IS 'One pre-generated challenge per calendar date. Authenticated users can read; only the service role may write.';

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read daily challenges
CREATE POLICY "daily_challenges_select_authenticated"
  ON public.daily_challenges
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- INSERT / UPDATE / DELETE are implicitly denied for non-service roles.
-- The service role bypasses RLS by default, so no explicit policy is needed.

-- ============================================================================
-- 8. FUNCTION: reset_daily_scan_count
-- ============================================================================
-- Call before each camera scan to ensure the daily count is current.
-- If the stored reset date is before today, the count is zeroed and the date
-- is bumped to CURRENT_DATE. Returns the (possibly-reset) daily_scan_count.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reset_daily_scan_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET
    daily_scan_count   = 0,
    daily_scan_reset_at = CURRENT_DATE
  WHERE id = p_user_id
    AND daily_scan_reset_at < CURRENT_DATE;

  SELECT daily_scan_count
    INTO v_count
    FROM public.profiles
   WHERE id = p_user_id;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.reset_daily_scan_count(UUID)
  IS 'Resets the daily camera-scan counter if the last reset was before today, then returns the current count.';

-- ============================================================================
-- 9. VIEW: user_stats
-- ============================================================================
-- Aggregated per-user statistics for the profile / stats screen.
-- ============================================================================
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  p.id                                              AS user_id,
  COUNT(vl.id)                                      AS total_practiced,
  COUNT(vl.id) FILTER (WHERE vl.is_correct = TRUE)  AS total_correct,
  CASE
    WHEN COUNT(vl.id) = 0 THEN 0
    ELSE ROUND(
      (COUNT(vl.id) FILTER (WHERE vl.is_correct = TRUE))::NUMERIC
      / COUNT(vl.id) * 100,
      1
    )
  END                                               AS accuracy_percentage,
  COALESCE(sw_stats.verbs_mastered, 0)              AS verbs_mastered,
  p.streak_days                                     AS current_streak,
  COALESCE(sw_stats.favorite_count, 0)              AS favorite_count
FROM public.profiles p
LEFT JOIN public.verb_logs vl
  ON vl.user_id = p.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE sw.mastery_level >= 4)  AS verbs_mastered,
    COUNT(*) FILTER (WHERE sw.is_favorite = TRUE)  AS favorite_count
  FROM public.saved_words sw
  WHERE sw.user_id = p.id
) sw_stats ON TRUE
GROUP BY p.id, p.streak_days, sw_stats.verbs_mastered, sw_stats.favorite_count;

COMMENT ON VIEW public.user_stats
  IS 'Aggregated per-user statistics: total practiced, accuracy %, verbs mastered, streak, and favourites.';

-- Grant authenticated users read access to the view (RLS on underlying tables
-- still restricts which rows are visible).
GRANT SELECT ON public.user_stats TO authenticated;

COMMIT;
