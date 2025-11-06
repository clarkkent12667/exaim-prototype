-- ============================================
-- SUPABASE AUTHENTICATION SETUP SQL
-- ============================================
-- Run this entire script in Supabase SQL Editor
-- Go to: Dashboard > SQL Editor > New Query > Paste this > Run

-- Step 1: Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Step 4: Create RLS Policies

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (for signup)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Teachers can view student profiles (for viewing attempts)
-- This allows teachers to see student information when viewing exam attempts
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;
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

-- Step 5: Function to create profile automatically (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Step 6: Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Step 7: Function to manually create profile (for existing users or if trigger fails)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  user_full_name TEXT DEFAULT NULL
)
RETURNS void 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (user_id, user_email, user_role, user_full_name)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating profile: %', SQLERRM;
END;
$$;

-- Step 8: Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;

-- Step 9: Verify the setup (optional - you can comment this out)
DO $$
BEGIN
  RAISE NOTICE 'Setup completed successfully!';
  RAISE NOTICE 'Profiles table created';
  RAISE NOTICE 'RLS policies created';
  RAISE NOTICE 'Trigger function created';
  RAISE NOTICE 'Manual profile creation function created';
END $$;

-- ============================================
-- EXAM MANAGEMENT SYSTEM TABLES
-- ============================================

-- Step 10: Create qualifications table
CREATE TABLE IF NOT EXISTS public.qualifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 11: Create exam_boards table
CREATE TABLE IF NOT EXISTS public.exam_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, qualification_id)
);

-- Step 12: Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  exam_board_id UUID NOT NULL REFERENCES public.exam_boards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, exam_board_id)
);

-- Step 13: Create topics table
CREATE TABLE IF NOT EXISTS public.topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, subject_id)
);

-- Step 14: Create subtopics table
CREATE TABLE IF NOT EXISTS public.subtopics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, topic_id)
);

-- Step 15: Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE RESTRICT,
  exam_board_id UUID NOT NULL REFERENCES public.exam_boards(id) ON DELETE RESTRICT,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  topic_id UUID REFERENCES public.topics(id) ON DELETE RESTRICT,
  subtopic_id UUID REFERENCES public.subtopics(id) ON DELETE RESTRICT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  time_limit_minutes INTEGER,
  is_published BOOLEAN DEFAULT FALSE,
  total_marks DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 16: Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('mcq', 'fib', 'open_ended')),
  marks DECIMAL(10, 2) NOT NULL,
  model_answer TEXT NOT NULL,
  correct_answer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 17: Create question_options table (for MCQ)
CREATE TABLE IF NOT EXISTS public.question_options (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- Step 18: Create exam_attempts table
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  total_score DECIMAL(10, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 19: Create student_answers table
CREATE TABLE IF NOT EXISTS public.student_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer_text TEXT,
  is_correct BOOLEAN,
  score DECIMAL(10, 2) DEFAULT 0,
  ai_evaluation JSONB,
  evaluated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(attempt_id, question_id)
);

-- Step 20: Create exam_statistics table
CREATE TABLE IF NOT EXISTS public.exam_statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL UNIQUE REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  correct_count INTEGER DEFAULT 0,
  incorrect_count INTEGER DEFAULT 0,
  partially_correct_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 21: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_exam_boards_qualification_id ON public.exam_boards(qualification_id);
CREATE INDEX IF NOT EXISTS idx_subjects_exam_board_id ON public.subjects(exam_board_id);
CREATE INDEX IF NOT EXISTS idx_topics_subject_id ON public.topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_subtopics_topic_id ON public.subtopics(topic_id);
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id ON public.exams(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exams_qualification_id ON public.exams(qualification_id);
CREATE INDEX IF NOT EXISTS idx_exams_exam_board_id ON public.exams(exam_board_id);
CREATE INDEX IF NOT EXISTS idx_exams_subject_id ON public.exams(subject_id);
CREATE INDEX IF NOT EXISTS idx_exams_is_published ON public.exams(is_published);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON public.question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON public.exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_id ON public.student_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id ON public.student_answers(question_id);

-- Step 22: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 23: Create triggers for updated_at
DROP TRIGGER IF EXISTS update_exams_updated_at ON public.exams;
CREATE TRIGGER update_exams_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Step 24: Enable RLS on all exam tables
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_statistics ENABLE ROW LEVEL SECURITY;

-- Step 25: RLS Policies for qualifications (teachers can manage, students can view)
DROP POLICY IF EXISTS "Teachers can manage qualifications" ON public.qualifications;
DROP POLICY IF EXISTS "Everyone can view qualifications" ON public.qualifications;

CREATE POLICY "Teachers can manage qualifications"
  ON public.qualifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Everyone can view qualifications"
  ON public.qualifications
  FOR SELECT
  USING (true);

-- Step 26: RLS Policies for exam_boards (teachers can manage, students can view)
DROP POLICY IF EXISTS "Teachers can manage exam_boards" ON public.exam_boards;
DROP POLICY IF EXISTS "Everyone can view exam_boards" ON public.exam_boards;

CREATE POLICY "Teachers can manage exam_boards"
  ON public.exam_boards
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Everyone can view exam_boards"
  ON public.exam_boards
  FOR SELECT
  USING (true);

-- Step 27: RLS Policies for subjects (teachers can manage, students can view)
DROP POLICY IF EXISTS "Teachers can manage subjects" ON public.subjects;
DROP POLICY IF EXISTS "Everyone can view subjects" ON public.subjects;

CREATE POLICY "Teachers can manage subjects"
  ON public.subjects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Everyone can view subjects"
  ON public.subjects
  FOR SELECT
  USING (true);

-- Step 28: RLS Policies for topics (teachers can manage, students can view)
DROP POLICY IF EXISTS "Teachers can manage topics" ON public.topics;
DROP POLICY IF EXISTS "Everyone can view topics" ON public.topics;

CREATE POLICY "Teachers can manage topics"
  ON public.topics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Everyone can view topics"
  ON public.topics
  FOR SELECT
  USING (true);

-- Step 29: RLS Policies for subtopics (teachers can manage, students can view)
DROP POLICY IF EXISTS "Teachers can manage subtopics" ON public.subtopics;
DROP POLICY IF EXISTS "Everyone can view subtopics" ON public.subtopics;

CREATE POLICY "Teachers can manage subtopics"
  ON public.subtopics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Everyone can view subtopics"
  ON public.subtopics
  FOR SELECT
  USING (true);

-- Step 30: RLS Policies for exams
DROP POLICY IF EXISTS "Teachers can manage their own exams" ON public.exams;
DROP POLICY IF EXISTS "Students can view published exams" ON public.exams;

CREATE POLICY "Teachers can manage their own exams"
  ON public.exams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
      AND exams.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Students can view published exams"
  ON public.exams
  FOR SELECT
  USING (
    is_published = true OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
      AND exams.teacher_id = auth.uid()
    )
  );

-- Step 31: RLS Policies for questions
DROP POLICY IF EXISTS "Teachers can manage questions for their exams" ON public.questions;
DROP POLICY IF EXISTS "Students can view questions for published exams" ON public.questions;

CREATE POLICY "Teachers can manage questions for their exams"
  ON public.questions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      JOIN public.profiles ON exams.teacher_id = profiles.id
      WHERE exams.id = questions.exam_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Students can view questions for published exams"
  ON public.questions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      WHERE exams.id = questions.exam_id
      AND exams.is_published = true
    )
  );

-- Step 32: RLS Policies for question_options
DROP POLICY IF EXISTS "Teachers can manage options for their exam questions" ON public.question_options;
DROP POLICY IF EXISTS "Students can view options for published exam questions" ON public.question_options;

CREATE POLICY "Teachers can manage options for their exam questions"
  ON public.question_options
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.exams ON questions.exam_id = exams.id
      JOIN public.profiles ON exams.teacher_id = profiles.id
      WHERE questions.id = question_options.question_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Students can view options for published exam questions"
  ON public.question_options
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions
      JOIN public.exams ON questions.exam_id = exams.id
      WHERE questions.id = question_options.question_id
      AND exams.is_published = true
    )
  );

-- Step 33: RLS Policies for exam_attempts
DROP POLICY IF EXISTS "Students can manage their own attempts" ON public.exam_attempts;
DROP POLICY IF EXISTS "Teachers can view attempts for their exams" ON public.exam_attempts;

CREATE POLICY "Students can manage their own attempts"
  ON public.exam_attempts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'student'
      AND exam_attempts.student_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can view attempts for their exams"
  ON public.exam_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exams
      JOIN public.profiles ON exams.teacher_id = profiles.id
      WHERE exams.id = exam_attempts.exam_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- Step 34: RLS Policies for student_answers
DROP POLICY IF EXISTS "Students can manage their own answers" ON public.student_answers;
DROP POLICY IF EXISTS "Teachers can view answers for their exam attempts" ON public.student_answers;

CREATE POLICY "Students can manage their own answers"
  ON public.student_answers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.profiles ON exam_attempts.student_id = profiles.id
      WHERE exam_attempts.id = student_answers.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'student'
    )
  );

CREATE POLICY "Teachers can view answers for their exam attempts"
  ON public.student_answers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.exam_attempts
      JOIN public.exams ON exam_attempts.exam_id = exams.id
      JOIN public.profiles ON exams.teacher_id = profiles.id
      WHERE exam_attempts.id = student_answers.attempt_id
      AND profiles.id = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

-- Step 35: RLS Policies for exam_statistics
DROP POLICY IF EXISTS "Students can view their own statistics" ON public.exam_statistics;
DROP POLICY IF EXISTS "Teachers can view statistics for their exam attempts" ON public.exam_statistics;
DROP POLICY IF EXISTS "Students can insert their own statistics" ON public.exam_statistics;
DROP POLICY IF EXISTS "Students can update their own statistics" ON public.exam_statistics;

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

-- Step 36: Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_boards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtopics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_statistics TO authenticated;

-- Step 37: Create function to calculate exam total marks
CREATE OR REPLACE FUNCTION public.calculate_exam_total_marks(exam_uuid UUID)
RETURNS DECIMAL(10, 2) AS $$
BEGIN
  RETURN COALESCE(
    (SELECT SUM(marks) FROM public.questions WHERE exam_id = exam_uuid),
    0
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 38: Create trigger to update exam total_marks when questions change
CREATE OR REPLACE FUNCTION public.update_exam_total_marks()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.exams
    SET total_marks = public.calculate_exam_total_marks(OLD.exam_id)
    WHERE id = OLD.exam_id;
    RETURN OLD;
  ELSE
    UPDATE public.exams
    SET total_marks = public.calculate_exam_total_marks(NEW.exam_id)
    WHERE id = NEW.exam_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_exam_total_marks ON public.questions;
CREATE TRIGGER trigger_update_exam_total_marks
  AFTER INSERT OR UPDATE OR DELETE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_exam_total_marks();

