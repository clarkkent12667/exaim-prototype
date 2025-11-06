-- ============================================
-- CLASS MANAGEMENT SYSTEM TABLES
-- ============================================
-- Run this script in Supabase SQL Editor after running supabase_setup.sql
-- This adds class management functionality

-- Step 1: Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create class_enrollments table
CREATE TABLE IF NOT EXISTS public.class_enrollments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  UNIQUE(class_id, student_id)
);

-- Step 3: Create exam_assignments table
CREATE TABLE IF NOT EXISTS public.exam_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(class_id, exam_id)
);

-- Step 4: Enable Row Level Security
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_assignments ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS Policies for classes table
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

-- Step 6: Create RLS Policies for class_enrollments table
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

-- Step 7: Create RLS Policies for exam_assignments table
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

-- Step 8: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_classes_teacher_id ON public.classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON public.class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON public.class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_status ON public.class_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_class_id ON public.exam_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id ON public.exam_assignments(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_is_active ON public.exam_assignments(is_active);

-- Step 9: Create trigger for updated_at on classes
DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

