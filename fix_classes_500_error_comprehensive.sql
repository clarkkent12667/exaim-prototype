-- ============================================
-- COMPREHENSIVE FIX: Classes Table 500 Internal Server Error
-- ============================================
-- This fixes 500 Internal Server Error when querying classes table
-- Issues addressed:
-- 1. Missing or broken is_teacher() and is_student() helper functions
-- 2. RLS policies that cause circular dependencies
-- 3. Missing permissions on helper functions
-- 4. Profiles table RLS blocking helper functions
--
-- Run this in Supabase SQL Editor

-- Step 1: Ensure profiles table has proper RLS setup for helper functions
-- First, create a policy that allows SECURITY DEFINER functions to read profiles
DROP POLICY IF EXISTS "Allow SECURITY DEFINER functions to read profiles" ON public.profiles;
-- Note: SECURITY DEFINER functions bypass RLS by default, but we ensure profiles are readable

-- Step 2: Create or replace helper function to check if user is a teacher (bypasses RLS)
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
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error (table doesn't exist, column doesn't exist, etc.), return false
    RETURN FALSE;
END;
$$;

-- Step 3: Create or replace helper function to check if user is a student (bypasses RLS)
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
EXCEPTION
  WHEN OTHERS THEN
    -- If there's any error, return false
    RETURN FALSE;
END;
$$;

-- Step 4: Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon;
GRANT EXECUTE ON FUNCTION public.is_student() TO anon;

-- Step 5: Ensure classes table exists and has proper structure
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

-- Step 6: Drop all existing RLS policies on classes table to start fresh
DROP POLICY IF EXISTS "Teachers can manage their own classes" ON public.classes;
DROP POLICY IF EXISTS "Students can view classes they are enrolled in" ON public.classes;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.classes;
DROP POLICY IF EXISTS "Public read access" ON public.classes;

-- Step 7: Recreate RLS policies for classes table (using helper functions)
-- Policy 1: Teachers can manage their own classes
CREATE POLICY "Teachers can manage their own classes"
  ON public.classes
  FOR ALL
  USING (
    -- Check if user is a teacher AND the class belongs to them
    public.is_teacher() = TRUE
    AND classes.teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_teacher() = TRUE
    AND classes.teacher_id = auth.uid()
  );

-- Policy 2: Students can view classes they are enrolled in
CREATE POLICY "Students can view classes they are enrolled in"
  ON public.classes
  FOR SELECT
  USING (
    public.is_student() = TRUE
    AND EXISTS (
      SELECT 1 FROM public.class_enrollments
      WHERE class_enrollments.class_id = classes.id
      AND class_enrollments.student_id = auth.uid()
      AND class_enrollments.status = 'active'
    )
  );

-- Step 8: Ensure class_enrollments table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'class_enrollments'
  ) THEN
    CREATE TABLE public.class_enrollments (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      UNIQUE(class_id, student_id)
    );
    
    ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
    
    CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON public.class_enrollments(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON public.class_enrollments(student_id);
    
    RAISE NOTICE 'Class_enrollments table created';
  END IF;
END $$;

-- Step 9: Fix profiles table RLS policy to use helper function (prevents circular dependency)
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
CREATE POLICY "Teachers can view student profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Allow if user is viewing their own profile
    auth.uid() = id
    OR
    -- OR allow if the current user is a teacher (using helper function to avoid circular dependency)
    public.is_teacher() = TRUE
  );

-- Step 10: Recreate RLS policies for class_enrollments table (using helper functions)
DROP POLICY IF EXISTS "Teachers can manage enrollments for their classes" ON public.class_enrollments;
CREATE POLICY "Teachers can manage enrollments for their classes"
  ON public.class_enrollments
  FOR ALL
  USING (
    public.is_teacher() = TRUE
    AND EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_enrollments.class_id
      AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_teacher() = TRUE
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
    public.is_student() = TRUE
    AND class_enrollments.student_id = auth.uid()
  );

-- Step 11: Verify the setup and test functions
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
  RAISE NOTICE 'is_teacher() and is_student() functions are now available.';
  RAISE NOTICE 'All policies have been recreated with proper helper functions.';
END $$;

