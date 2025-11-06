-- ============================================
-- FIX: Classes Table 500 Internal Server Error
-- ============================================
-- This fixes 500 Internal Server Error when querying classes table
-- The issue: Circular dependency in RLS policies or missing helper functions
-- Solution: Ensure helper functions exist and properly bypass RLS
--
-- Run this in Supabase SQL Editor

-- Step 1: Create or replace helper function to check if user is a teacher (bypasses RLS)
-- This function uses SECURITY DEFINER to run with elevated privileges and bypass RLS
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Use SECURITY DEFINER to bypass RLS when querying profiles
  -- This prevents circular dependencies
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
  );
END;
$$;

-- Step 2: Create or replace helper function to check if user is a student (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Use SECURITY DEFINER to bypass RLS when querying profiles
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

-- Step 4: Fix profiles table RLS policy to use helper function (prevents circular dependency)
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
CREATE POLICY "Teachers can view student profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Allow if user is viewing their own profile
    auth.uid() = id
    OR
    -- OR allow if the current user is a teacher (using helper function to avoid circular dependency)
    public.is_teacher()
  );

-- Step 5: Recreate RLS policies for classes table (using helper functions)
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

-- Step 6: Recreate RLS policies for class_enrollments table (using helper functions)
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

-- Step 7: Recreate RLS policies for exam_assignments table (using helper functions)
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

-- Step 8: Ensure classes table exists and has proper structure
DO $$
BEGIN
  -- Check if classes table exists, if not create it
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'classes'
  ) THEN
    CREATE TABLE public.classes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
    
    RAISE NOTICE 'Classes table created';
  ELSE
    RAISE NOTICE 'Classes table already exists';
  END IF;
END $$;

-- Step 9: Verify the setup
DO $$
BEGIN
  RAISE NOTICE 'Classes RLS policies fixed!';
  RAISE NOTICE 'is_teacher() and is_student() functions are now available.';
  RAISE NOTICE 'All policies have been recreated with proper helper functions.';
END $$;

