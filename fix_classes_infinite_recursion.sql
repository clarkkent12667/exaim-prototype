-- ============================================
-- FIX: Infinite Recursion in Classes RLS Policies
-- ============================================
-- This fixes the "infinite recursion detected in policy for relation 'classes'" error
-- The issue: Circular dependency between classes and class_enrollments RLS policies
-- Solution: Use SECURITY DEFINER helper functions to bypass RLS when checking enrollments
--
-- Run this in Supabase SQL Editor

-- Step 1: Ensure helper functions exist and are properly configured
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
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
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Step 2: Create helper function to check enrollment (bypasses RLS to break circular dependency)
CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(class_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- This function bypasses RLS to check enrollments directly
  -- This breaks the circular dependency between classes and class_enrollments policies
  RETURN EXISTS (
    SELECT 1 FROM public.class_enrollments
    WHERE class_enrollments.class_id = class_id_param
    AND class_enrollments.student_id = auth.uid()
    AND class_enrollments.status = 'active'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Step 3: Create helper function to check if user owns a class (bypasses RLS)
CREATE OR REPLACE FUNCTION public.owns_class(class_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- This function bypasses RLS to check class ownership directly
  RETURN EXISTS (
    SELECT 1 FROM public.classes
    WHERE classes.id = class_id_param
    AND classes.teacher_id = auth.uid()
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Step 4: Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_class(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.owns_class(UUID) TO anon;

-- Step 5: Drop all existing RLS policies on classes table
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view classes they are enrolled in" ON public.classes;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.classes;
DROP POLICY IF EXISTS "Public read access" ON public.classes;

-- Step 6: Recreate RLS policies for classes table (using helper functions to avoid circular dependency)
-- Policy 1: Teachers can manage their own classes
CREATE POLICY "Teachers can manage their own classes"
  ON public.classes
  FOR ALL
  USING (
    public.is_teacher() = TRUE
    AND classes.teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_teacher() = TRUE
    AND classes.teacher_id = auth.uid()
  );

-- Policy 2: Students can view classes they are enrolled in (using helper function to break circular dependency)
CREATE POLICY "Students can view classes they are enrolled in"
  ON public.classes
  FOR SELECT
  USING (
    public.is_student() = TRUE
    AND public.is_enrolled_in_class(classes.id) = TRUE
  );

-- Step 7: Drop all existing RLS policies on class_enrollments table
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON public.class_enrollments;
DROP POLICY IF EXISTS "Students can view their own enrollments" ON public.class_enrollments;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.class_enrollments;

-- Step 8: Recreate RLS policies for class_enrollments table (using helper functions to avoid circular dependency)
-- Policy 1: Teachers can manage enrollments for their classes (using helper function to break circular dependency)
CREATE POLICY "Teachers can manage enrollments for their classes"
  ON public.class_enrollments
  FOR ALL
  USING (
    public.is_teacher() = TRUE
    AND public.owns_class(class_enrollments.class_id) = TRUE
  )
  WITH CHECK (
    public.is_teacher() = TRUE
    AND public.owns_class(class_enrollments.class_id) = TRUE
  );

-- Policy 2: Students can view their own enrollments
CREATE POLICY "Students can view their own enrollments"
  ON public.class_enrollments
  FOR SELECT
  USING (
    public.is_student() = TRUE
    AND class_enrollments.student_id = auth.uid()
  );

-- Step 9: Verify the setup
DO $$
DECLARE
  test_result BOOLEAN;
BEGIN
  -- Test if functions exist and are callable
  SELECT public.is_teacher() INTO test_result;
  RAISE NOTICE 'is_teacher() function test: %', test_result;
  
  SELECT public.is_student() INTO test_result;
  RAISE NOTICE 'is_student() function test: %', test_result;
  
  RAISE NOTICE 'Classes RLS policies fixed!';
  RAISE NOTICE 'Circular dependency broken using SECURITY DEFINER helper functions.';
  RAISE NOTICE 'is_enrolled_in_class() and owns_class() functions bypass RLS to prevent recursion.';
END $$;


