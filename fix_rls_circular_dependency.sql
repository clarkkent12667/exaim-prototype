-- ============================================
-- FIX: RLS Circular Dependency Issues (500 Errors)
-- ============================================
-- This fixes 500 Internal Server Error caused by circular dependencies in RLS policies
-- The issue: Policies check profiles table to verify role, which triggers RLS again
-- Solution: Use SECURITY DEFINER function to check role without triggering RLS
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

-- Step 3: Fix profiles table RLS policy (remove circular dependency)
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
CREATE POLICY "Teachers can view student profiles"
  ON public.profiles
  FOR SELECT
  USING (
    -- Allow if user is viewing their own profile
    auth.uid() = id
    OR
    -- OR allow if the current user is a teacher (using helper function)
    public.is_teacher()
  );

-- Step 4: Fix exams table RLS policies (remove circular dependency)
DROP POLICY IF EXISTS "Teachers can manage their own exams" ON public.exams;
CREATE POLICY "Teachers can manage their own exams"
  ON public.exams
  FOR ALL
  USING (
    public.is_teacher()
    AND exams.teacher_id = auth.uid()
  )
  WITH CHECK (
    public.is_teacher()
    AND exams.teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can view published exams" ON public.exams;
CREATE POLICY "Students can view published exams"
  ON public.exams
  FOR SELECT
  USING (
    is_published = true
    OR
    (public.is_teacher() AND exams.teacher_id = auth.uid())
  );

-- Step 5: Fix questions table RLS policies
DROP POLICY IF EXISTS "Teachers can manage questions for their exams" ON public.questions;
CREATE POLICY "Teachers can manage questions for their exams"
  ON public.questions
  FOR ALL
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = questions.exam_id
      AND exams.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = questions.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Step 6: Fix question_options table RLS policies
DROP POLICY IF EXISTS "Teachers can manage options for their exam questions" ON public.question_options;
CREATE POLICY "Teachers can manage options for their exam questions"
  ON public.question_options
  FOR ALL
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.exams ON questions.exam_id = exams.id
      WHERE questions.id = question_options.question_id
      AND exams.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.exams ON questions.exam_id = exams.id
      WHERE questions.id = question_options.question_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Step 7: Fix exam_attempts table RLS policies
DROP POLICY IF EXISTS "Students can manage their own attempts" ON public.exam_attempts;
CREATE POLICY "Students can manage their own attempts"
  ON public.exam_attempts
  FOR ALL
  USING (
    public.is_student()
    AND exam_attempts.student_id = auth.uid()
  )
  WITH CHECK (
    public.is_student()
    AND exam_attempts.student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Teachers can view attempts for their exams" ON public.exam_attempts;
CREATE POLICY "Teachers can view attempts for their exams"
  ON public.exam_attempts
  FOR SELECT
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = exam_attempts.exam_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Step 8: Fix student_answers table RLS policies
DROP POLICY IF EXISTS "Students can manage their own answers" ON public.student_answers;
CREATE POLICY "Students can manage their own answers"
  ON public.student_answers
  FOR ALL
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can view answers for their exam attempts" ON public.student_answers;
CREATE POLICY "Teachers can view answers for their exam attempts"
  ON public.student_answers
  FOR SELECT
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.exams ON exam_attempts.exam_id = exams.id
      WHERE exam_attempts.id = student_answers.attempt_id
      AND exams.teacher_id = auth.uid()
    )
  );

-- Step 9: Fix exam_statistics table RLS policies
DROP POLICY IF EXISTS "Students can view their own statistics" ON public.exam_statistics;
CREATE POLICY "Students can view their own statistics"
  ON public.exam_statistics
  FOR SELECT
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers can view statistics for their exam attempts" ON public.exam_statistics;
CREATE POLICY "Teachers can view statistics for their exam attempts"
  ON public.exam_statistics
  FOR SELECT
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.exams ON exam_attempts.exam_id = exams.id
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND exams.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can insert their own statistics" ON public.exam_statistics;
CREATE POLICY "Students can insert their own statistics"
  ON public.exam_statistics
  FOR INSERT
  WITH CHECK (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update their own statistics" ON public.exam_statistics;
CREATE POLICY "Students can update their own statistics"
  ON public.exam_statistics
  FOR UPDATE
  USING (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_student()
    AND EXISTS (
      SELECT 1 FROM public.exam_attempts
      WHERE exam_attempts.id = exam_statistics.attempt_id
      AND exam_attempts.student_id = auth.uid()
    )
  );

-- Step 10: Fix qualifications, exam_boards, subjects, topics, subtopics RLS policies
DROP POLICY IF EXISTS "Teachers can manage qualifications" ON public.qualifications;
CREATE POLICY "Teachers can manage qualifications"
  ON public.qualifications
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can manage exam_boards" ON public.exam_boards;
CREATE POLICY "Teachers can manage exam_boards"
  ON public.exam_boards
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can manage subjects" ON public.subjects;
CREATE POLICY "Teachers can manage subjects"
  ON public.subjects
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can manage topics" ON public.topics;
CREATE POLICY "Teachers can manage topics"
  ON public.topics
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can manage subtopics" ON public.subtopics;
CREATE POLICY "Teachers can manage subtopics"
  ON public.subtopics
  FOR ALL
  USING (public.is_teacher())
  WITH CHECK (public.is_teacher());

-- Step 11: Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_student() TO authenticated;

-- Verification message
DO $$
BEGIN
  RAISE NOTICE 'RLS policies fixed! Circular dependencies removed.';
END $$;

