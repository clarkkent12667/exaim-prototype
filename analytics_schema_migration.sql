-- Analytics Schema Migration
-- Add time tracking and analytics indexes

-- Add time_spent_seconds column to student_answers table
ALTER TABLE public.student_answers 
ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER DEFAULT 0;

-- Add indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_student_answers_question_correct 
ON public.student_answers(question_id, is_correct);

CREATE INDEX IF NOT EXISTS idx_exams_topic_subtopic 
ON public.exams(topic_id, subtopic_id);

-- Add index for time-based analytics
CREATE INDEX IF NOT EXISTS idx_student_answers_time_spent 
ON public.student_answers(time_spent_seconds) 
WHERE time_spent_seconds > 0;

