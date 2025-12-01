-- Supabase Realtime RLS Policies for Spell Coven
--
-- These policies control access to Realtime Broadcast and Presence channels.
-- Run this in your Supabase SQL Editor to enable secure channels.
--
-- Prerequisites:
-- 1. Enable Discord OAuth provider in Supabase Dashboard
-- 2. Users must be authenticated to access game channels

-- ============================================================================
-- REALTIME CHANNEL POLICIES
-- ============================================================================
--
-- Supabase Realtime uses the special "realtime.messages" table for RLS.
-- These policies determine who can read from and write to channels.

-- Allow authenticated users to receive messages on game channels
-- Channel pattern: game:* (e.g., game:ABC123)
CREATE POLICY "authenticated users can receive on game channels"
ON "realtime"."messages"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'game:%'
);

-- Allow authenticated users to broadcast on game channels
CREATE POLICY "authenticated users can broadcast on game channels"
ON "realtime"."messages"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'game:%'
);

-- ============================================================================
-- OPTIONAL: More restrictive policies
-- ============================================================================
--
-- If you want to restrict channels to specific users (e.g., room members only),
-- you would need to create a rooms table and check membership.
--
-- Example (commented out - implement if needed):
--
-- CREATE TABLE IF NOT EXISTS public.game_rooms (
--   id TEXT PRIMARY KEY,
--   created_by UUID REFERENCES auth.users(id),
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
--
-- CREATE TABLE IF NOT EXISTS public.room_members (
--   room_id TEXT REFERENCES public.game_rooms(id) ON DELETE CASCADE,
--   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
--   joined_at TIMESTAMPTZ DEFAULT NOW(),
--   PRIMARY KEY (room_id, user_id)
-- );
--
-- ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
--
-- -- Then update the realtime policy to check membership:
-- CREATE POLICY "members can receive on their game channels"
-- ON "realtime"."messages"
-- FOR SELECT
-- TO authenticated
-- USING (
--   EXISTS (
--     SELECT 1 FROM public.room_members
--     WHERE room_id = REPLACE(realtime.topic(), 'game:', '')
--     AND user_id = auth.uid()
--   )
-- );

-- ============================================================================
-- VERIFICATION
-- ============================================================================
--
-- After running this migration, verify policies are active:
-- SELECT * FROM pg_policies WHERE tablename = 'messages' AND schemaname = 'realtime';

