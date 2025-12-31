-- Migration: Security Hardening (Functions & Search Path)
-- Description: Sets the search_path for database functions to prevent search path injection.

-- 1. Fix mutable search_path for link_user_to_costalero
ALTER FUNCTION public.link_user_to_costalero() SET search_path = public;

-- 2. Fix mutable search_path for sync_existing_user_to_new_costalero
ALTER FUNCTION public.sync_existing_user_to_new_costalero() SET search_path = public;

-- 3. Fix mutable search_path for handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Note: To fix the "Leaked Password Protection" warning, you must enable it in the Supabase Dashboard:
-- 1. Go to Authentication -> Settings
-- 2. Scroll down to Password Protection
-- 3. Enable "Enable leaked password protection"
