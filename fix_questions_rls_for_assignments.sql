-- ============================================
-- FIX: Questions RLS Policy for Exam Assignments
-- ============================================
-- This fixes the issue where students can't view questions for assigned exams
-- The issue: Students can only view questions for published exams
-- Solution: Add policy to allow students to view questions for exams that have been assigned to their classes
-- NOTE: This only allows viewing questions for exams that are ALREADY assigned, not for assigning unpublished exams
-- The assignment itself is still controlled by the teacher and requires the exam to be published
--
-- Run this in Supabase SQL Editor

-- Step 1: Ensure helper functions exist
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'student'
  );
END;
$$;

-- Step 2: Add policy to allow students to view questions for assigned exams
DROP POLICY IF EXISTS "Students can view questions for assigned exams" ON public.questions;
CREATE POLICY "Students can view questions for assigned exams"
  ON public.questions
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_assignments
      JOIN public.class_enrollments ON exam_assignments.class_id = class_enrollments.class_id
      WHERE exam_assignments.exam_id = questions.exam_id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
      AND exam_assignments.is_active = TRUE
    )
  );

-- Step 3: Add policy to allow students to view question options for assigned exams
DROP POLICY IF EXISTS "Students can view options for assigned exam questions" ON public.question_options;
CREATE POLICY "Students can view options for assigned exam questions"
  ON public.question_options
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.exam_assignments ON questions.exam_id = exam_assignments.exam_id
      JOIN public.class_enrollments ON exam_assignments.class_id = class_enrollments.class_id
      WHERE questions.id = question_options.question_id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
      AND exam_assignments.is_active = TRUE
    )
  );

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'Questions RLS policies updated! Students can now view questions for assigned exams.';
END $$;

