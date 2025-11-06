-- ============================================
-- FIX: Exams RLS Policy for Exam Assignments
-- ============================================
-- This fixes 406 (Not Acceptable) errors when querying exams through exam_assignments
-- The issue: Teachers can see exam_assignments but can't view the exam details
-- Solution: Add policy to allow teachers to view exams assigned to their classes
--
-- Run this in Supabase SQL Editor

-- Step 1: Ensure helper functions exist (from fix_rls_circular_dependency.sql)
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

-- Step 2: Ensure is_student function exists
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

-- Step 3: Add policy to allow teachers to view exams assigned to their classes
DROP POLICY IF EXISTS "Teachers can view exams assigned to their classes" ON public.exams;
CREATE POLICY "Teachers can view exams assigned to their classes"
  ON public.exams
  FOR SELECT
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exam_assignments
      JOIN public.classes ON exam_assignments.class_id = classes.id
      WHERE exam_assignments.exam_id = exams.id
      AND classes.teacher_id = auth.uid()
      AND exam_assignments.is_active = TRUE
    )
  );

-- Step 4: Also allow students to view exams assigned to their classes (even if not published)
DROP POLICY IF EXISTS "Students can view exams assigned to their classes" ON public.exams;
CREATE POLICY "Students can view exams assigned to their classes"
  ON public.exams
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_assignments
      JOIN public.class_enrollments ON exam_assignments.class_id = class_enrollments.class_id
      WHERE exam_assignments.exam_id = exams.id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
      AND exam_assignments.is_active = TRUE
    )
  );

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'Exams RLS policies updated! Teachers and students can now view exams assigned to their classes.';
END $$;

