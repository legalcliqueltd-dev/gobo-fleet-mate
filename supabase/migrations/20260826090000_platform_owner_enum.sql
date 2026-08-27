-- ============================================================================
-- app_role += platform_owner
-- ============================================================================
-- Deliberately alone in its own migration. Postgres allows ALTER TYPE ... ADD
-- VALUE inside a transaction block, but forbids *using* the new value in that
-- same transaction ("unsafe use of new value of enum type"). Supabase runs
-- each migration file in one transaction, so the value has to land here and be
-- used in the next file.
--
-- SAFE TO RE-RUN.
-- ============================================================================

alter type public.app_role add value if not exists 'platform_owner';
