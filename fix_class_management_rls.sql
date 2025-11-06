-- ============================================
-- FIX: Class Management RLS 500 Errors
-- ============================================
-- This fixes 500 Internal Server Error for class_enrollments and classes tables
-- The issue: RLS policies reference is_teacher() and is_student() functions that don't exist
-- Solution: Create these helper functions with SECURITY DEFINER to bypass RLS
--
-- Run this in Supabase SQL Editor

-- Step 1: Create helper function to check if user is a teacher (bypasses RLS)
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

-- Step 2: Create helper function to check if user is a student (bypasses RLS)
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

-- Step 3: Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;

-- Step 4: Recreate RLS policies for classes table (using helper functions)
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
CREATE POLICY "Teachers can manage their own classes"
  ON public.classes
  FOR ALL
  USING (
    public.is_teacher()
    AND classes.teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_teacher()
    AND classes.teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can view classes they are enrolled in" ON public.classes;
CREATE POLICY "Students can view classes they are enrolled in"
  ON public.classes
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.class_enrollments
      WHERE class_enrollments.class_id = classes.id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
    )
  );

-- Step 5: Recreate RLS policies for class_enrollments table (using helper functions)
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON public.class_enrollments;
CREATE POLICY "Teachers can manage enrollments for their classes"
  ON public.class_enrollments
  FOR ALL
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_enrollments.class_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_enrollments.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_enrollments;
CREATE POLICY "Students can view their own enrollments"
  ON public.class_enrollments
  FOR SELECT
  USING (
    public.is_student()
    AND class_enrollments.student_id = auth.uid()
  );

-- Step 6: Recreate RLS policies for exam_assignments table (using helper functions)
DROP POLICY IF EXISTS "Teachers can manage assignments for their classes" ON public.exam_assignments;
CREATE POLICY "Teachers can manage assignments for their classes"
  ON public.exam_assignments
  FOR ALL
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = exam_assignments.class_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = exam_assignments.class_id
      AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can view assignments for their classes" ON public.exam_assignments;
CREATE POLICY "Students can view assignments for their classes"
  ON public.exam_assignments
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.class_enrollments
      WHERE class_enrollments.class_id = exam_assignments.class_id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
    )
    AND exam_assignments.is_active = TRUE
  );

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'Class management RLS policies fixed! Helper functions created.';
  RAISE NOTICE 'is_teacher() and is_student() functions are now available.';
END $$;

