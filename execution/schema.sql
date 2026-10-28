-- ============================================================================
-- Kofschip — Supabase Production Database Schema
-- File: /execution/schema.sql
-- ============================================================================

-- Ensure uuid generation extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. Table: profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE, -- Default false (€14.99 Pro tier lifetime access)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to auth.users, tracking account status and tier.';
COMMENT ON COLUMN public.profiles.is_premium IS 'Indicates whether the user has purchased the €14.99 Pro tier.';

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger: auto-create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. Table: verb_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.verb_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    infinitive TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    error_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.verb_logs IS 'Audit log of user verb conjugation attempts and mistake diagnostics.';

CREATE INDEX IF NOT EXISTS idx_verb_logs_user_id ON public.verb_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_verb_logs_user_created_at ON public.verb_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verb_logs_user_infinitive ON public.verb_logs(user_id, infinitive);

-- RLS: verb_logs
ALTER TABLE public.verb_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verb_logs_select_own"
    ON public.verb_logs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "verb_logs_insert_own"
    ON public.verb_logs
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "verb_logs_delete_own"
    ON public.verb_logs
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Table: saved_words
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    infinitive TEXT NOT NULL,
    mastery_score INTEGER NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_saved_words_user_infinitive UNIQUE (user_id, infinitive)
);

COMMENT ON TABLE public.saved_words IS 'User saved vocabulary and spaced-repetition mastery scores.';

CREATE INDEX IF NOT EXISTS idx_saved_words_user_id ON public.saved_words(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_words_user_mastery ON public.saved_words(user_id, mastery_score);
CREATE INDEX IF NOT EXISTS idx_saved_words_user_last_reviewed ON public.saved_words(user_id, last_reviewed_at);

-- RLS: saved_words
ALTER TABLE public.saved_words ENABLE ROW LEVEL SECURITY;

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
