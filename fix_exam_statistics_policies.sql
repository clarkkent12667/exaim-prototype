-- Fix RLS Policies for exam_statistics table
-- This fixes the 403 Forbidden and 406 Not Acceptable errors

-- Drop existing policies
DROP POLICY IF EXISTS "Students can view their own statistics" ON public.exam_statistics;
DROP POLICY IF EXISTS "Teachers can view statistics for their exam attempts" ON public.exam_statistics;
DROP POLICY IF EXISTS "Students can insert their own statistics" ON public.exam_statistics;
DROP POLICY IF EXISTS "Students can update their own statistics" ON public.exam_statistics;

-- Recreate SELECT policies
CREATE POLICY "Students can view their own statistics"
  ON public.exam_statistics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.profiles ON exam_attempts.student_id = profiles.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

CREATE POLICY "Teachers can view statistics for their exam attempts"
  ON public.exam_statistics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.exams ON exam_attempts.exam_id = exams.id
      JOIN public.profiles ON exams.teacher_id = profiles.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- Add INSERT policy (was missing - this fixes the 403 Forbidden on POST)
CREATE POLICY "Students can insert their own statistics"
  ON public.exam_statistics
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.profiles ON exam_attempts.student_id = profiles.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

-- Add UPDATE policy (was missing - this fixes the 403 Forbidden on POST upsert)
CREATE POLICY "Students can update their own statistics"
  ON public.exam_statistics
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.profiles ON exam_attempts.student_id = profiles.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.profiles ON exam_attempts.student_id = profiles.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

