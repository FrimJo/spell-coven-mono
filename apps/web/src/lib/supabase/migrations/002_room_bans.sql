-- Room Bans Migration for Spell Coven
--
-- This migration adds the ability to ban users from game rooms.
-- Banned users cannot access the room's Realtime channel.
--
-- Prerequisites:
-- 1. Run 001_realtime_rls_policies.sql first
-- 2. Users must be authenticated

-- ============================================================================
-- ROOM BANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.room_bans (
  room_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  reason TEXT,
  PRIMARY KEY (room_id, user_id)
);

-- Enable RLS on the bans table
ALTER TABLE public.room_bans ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read bans (to check if they're banned)
CREATE POLICY "authenticated users can read bans"
ON public.room_bans
FOR SELECT
TO authenticated
USING (true);

-- Only the user who created the room can ban (we'll track room ownership too)
-- For now, allow any authenticated user to insert bans
-- In production, you'd want to check room ownership
CREATE POLICY "authenticated users can create bans"
ON public.room_bans
FOR INSERT
TO authenticated
WITH CHECK (banned_by = auth.uid());

-- Only the banner can remove bans
CREATE POLICY "banner can remove bans"
ON public.room_bans
FOR DELETE
TO authenticated
USING (banned_by = auth.uid());

-- ============================================================================
-- UPDATED REALTIME POLICIES (replaces basic policies from 001)
-- ============================================================================
--
-- Drop the existing permissive policies and create stricter ones
-- that check for bans before allowing channel access.

-- First, drop the old policies from migration 001
DROP POLICY IF EXISTS "authenticated users can receive on game channels" ON "realtime"."messages";
DROP POLICY IF EXISTS "authenticated users can broadcast on game channels" ON "realtime"."messages";

-- Policy: Allow authenticated users to receive on game channels UNLESS banned
CREATE POLICY "authenticated users can receive on game channels unless banned"
ON "realtime"."messages"
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'game:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.room_bans
    WHERE room_id = REPLACE(realtime.topic(), 'game:', '')
    AND user_id = auth.uid()
  )
);

-- Policy: Allow authenticated users to broadcast on game channels UNLESS banned
CREATE POLICY "authenticated users can broadcast on game channels unless banned"
ON "realtime"."messages"
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'game:%'
  AND NOT EXISTS (
    SELECT 1 FROM public.room_bans
    WHERE room_id = REPLACE(realtime.topic(), 'game:', '')
    AND user_id = auth.uid()
  )
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
--
-- Test ban functionality:
-- 1. Insert a ban: INSERT INTO public.room_bans (room_id, user_id, banned_by) VALUES ('ABC123', 'user-uuid', 'banner-uuid');
-- 2. The banned user should no longer be able to join the 'game:ABC123' channel
-- 3. Remove ban: DELETE FROM public.room_bans WHERE room_id = 'ABC123' AND user_id = 'user-uuid';

