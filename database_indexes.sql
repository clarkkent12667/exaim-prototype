-- Database Indexes for Performance Optimization
-- Run this SQL in your Supabase SQL Editor to add indexes for faster queries

-- ============================================
-- EXAM ATTEMPTS INDEXES
-- ============================================

-- Index for filtering attempts by exam_id (used in analytics)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id 
ON exam_attempts(exam_id);

-- Index for filtering attempts by student_id (used in analytics)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id 
ON exam_attempts(student_id);

-- Index for filtering by status (used in analytics)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status 
ON exam_attempts(status);

-- Index for date range filtering (used in analytics)
CREATE INDEX IF NOT EXISTS idx_exam_attempts_started_at 
ON exam_attempts(started_at);

-- Composite index for common query pattern: exam_id + status
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_status 
ON exam_attempts(exam_id, status);

-- Composite index for common query pattern: student_id + status
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_status 
ON exam_attempts(student_id, status);

-- Composite index for date range queries with status
CREATE INDEX IF NOT EXISTS idx_exam_attempts_date_status 
ON exam_attempts(started_at, status);

-- ============================================
-- CLASS ENROLLMENTS INDEXES
-- ============================================

-- Index for filtering enrollments by class_id (used in analytics)
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id 
ON class_enrollments(class_id);

-- Index for filtering enrollments by student_id
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id 
ON class_enrollments(student_id);

-- Composite index for active enrollments lookup
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_status 
ON class_enrollments(class_id, status);

-- ============================================
-- EXAM ASSIGNMENTS INDEXES
-- ============================================

-- Index for filtering assignments by class_id
CREATE INDEX IF NOT EXISTS idx_exam_assignments_class_id 
ON exam_assignments(class_id);

-- Index for filtering assignments by exam_id
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id 
ON exam_assignments(exam_id);

-- Composite index for active assignments lookup
CREATE INDEX IF NOT EXISTS idx_exam_assignments_class_exam_active 
ON exam_assignments(class_id, exam_id, is_active);

-- ============================================
-- EXAMS INDEXES
-- ============================================

-- Index for filtering exams by teacher_id
CREATE INDEX IF NOT EXISTS idx_exams_teacher_id 
ON exams(teacher_id);

-- Index for filtering by subject_id (used in filters)
CREATE INDEX IF NOT EXISTS idx_exams_subject_id 
ON exams(subject_id);

-- Index for filtering by exam_board_id (used in filters)
CREATE INDEX IF NOT EXISTS idx_exams_exam_board_id 
ON exams(exam_board_id);

-- Index for published exams
CREATE INDEX IF NOT EXISTS idx_exams_published 
ON exams(is_published) WHERE is_published = true;

-- ============================================
-- STUDENT ANSWERS INDEXES
-- ============================================

-- Index for filtering answers by attempt_id
CREATE INDEX IF NOT EXISTS idx_student_answers_attempt_id 
ON student_answers(attempt_id);

-- Index for filtering answers by question_id
CREATE INDEX IF NOT EXISTS idx_student_answers_question_id 
ON student_answers(question_id);

-- ============================================
-- QUESTIONS INDEXES
-- ============================================

-- Index for filtering questions by exam_id
CREATE INDEX IF NOT EXISTS idx_questions_exam_id 
ON questions(exam_id);

-- ============================================
-- PROFILES INDEXES
-- ============================================

-- Index for role-based queries (already likely exists, but ensure it)
CREATE INDEX IF NOT EXISTS idx_profiles_role 
ON profiles(role);

-- ============================================
-- NOTES
-- ============================================
-- 
-- These indexes will significantly improve query performance for:
-- 1. Analytics queries (teacher/student analytics)
-- 2. Grades heat map queries
-- 3. Intervention data queries
-- 4. Filter operations (by class, subject, exam board, date range)
--
-- Index maintenance:
-- - PostgreSQL automatically maintains indexes
-- - Indexes use additional storage space (~10-20% of table size)
-- - Write operations (INSERT/UPDATE/DELETE) are slightly slower with more indexes
-- - Read operations (SELECT) are much faster with proper indexes
--
-- To verify indexes are being used:
-- EXPLAIN ANALYZE SELECT * FROM exam_attempts WHERE exam_id = '...';
--
-- To drop an index if needed:
-- DROP INDEX IF EXISTS idx_exam_attempts_exam_id;

