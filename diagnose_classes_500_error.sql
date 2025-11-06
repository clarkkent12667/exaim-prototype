-- ============================================
-- DIAGNOSTIC: Classes Table 500 Error
-- ============================================
-- Run this to diagnose the issue with classes table queries
-- This will help identify what's causing the 500 error

-- Check 1: Verify helper functions exist
SELECT 
  routine_name,
  routine_type,
  security_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_teacher', 'is_student');

-- Check 2: Test helper functions (if you're logged in)
SELECT 
  auth.uid() as current_user_id,
  public.is_teacher() as is_teacher_result,
  public.is_student() as is_student_result;

-- Check 3: Check if classes table exists and has RLS enabled
SELECT 
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'classes';

-- Check 4: List all RLS policies on classes table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'classes';

-- Check 5: Check if profiles table exists and user has a profile
SELECT 
  id,
  role,
  email
FROM public.profiles
WHERE id = auth.uid();

-- Check 6: Check permissions on helper functions
SELECT 
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  array_agg(DISTINCT r.rolname) as granted_to
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl pa ON p.oid = pa.prooid
LEFT JOIN pg_roles r ON pa.grantee = r.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('is_teacher', 'is_student')
GROUP BY p.proname, p.oid;

-- Check 7: Try to query classes table directly (this might fail if RLS is blocking)
-- Uncomment the line below to test:
-- SELECT * FROM public.classes LIMIT 1;


