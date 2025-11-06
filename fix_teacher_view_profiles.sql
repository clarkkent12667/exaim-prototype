-- ============================================
-- FIX: Allow Teachers to View Student Profiles
-- ============================================
-- This fixes the 406 (Not Acceptable) error when teachers try to view student attempts
-- The issue is that RLS policies only allow users to view their own profile
-- Teachers need to view student profiles to see who attempted their exams
--
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing policy if it exists (to avoid conflicts)
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;

-- Step 2: Create new policy allowing teachers to view all profiles
-- This is safe because:
-- 1. Only teachers can use this policy (checked via role)
-- 2. Teachers only need to view profiles, not modify them
-- 3. The existing policies still protect UPDATE and INSERT operations
CREATE POLICY "Teachers can view student profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Allow if user is viewing their own profile (existing behavior)
    auth.uid() = id
    OR
    -- OR allow if the current user is a teacher (new behavior)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- Step 3: Verify the policy was created
-- You can run this to check:
-- SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- ============================================
-- ALTERNATIVE: More Restrictive Approach
-- ============================================
-- If you want a more restrictive policy that only allows teachers to view
-- profiles of students who have attempted their exams, use this instead:
--
-- DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
-- CREATE POLICY "Teachers can view student profiles"
--   ON public.profiles
--   FOR SELECT
--   USING (
--     auth.uid() = id
--     OR
--     (
--       EXISTS (
--         SELECT 1 FROM public.profiles
--         WHERE profiles.id = auth.uid()
--         AND profiles.role = 'teacher'
--       )
--       AND
--       EXISTS (
--         SELECT 1 FROM public.exam_attempts
--         JOIN public.exams ON exam_attempts.exam_id = exams.id
--         WHERE exam_attempts.student_id = profiles.id
--         AND exams.teacher_id = auth.uid()
--       )
--     )
--   );
--
-- This alternative is more secure but might be slower for large datasets
-- ============================================

