/**
 * Delete Recent Attempts Script
 * 
 * This script deletes exam attempts for students in a class
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function main() {
  console.log('🗑️  Deleting recent attempts...\n')
  
  // Get the class
  const { data: classData } = await supabase
    .from('classes')
    .select('id, name')
    .limit(1)
    .single()
  
  if (!classData) {
    console.error('No class found')
    return
  }
  
  console.log(`Found class: ${classData.name}\n`)
  
  // Get students in the class
  const { data: enrollments } = await supabase
    .from('class_enrollments')
    .select('student_id')
    .eq('class_id', classData.id)
    .eq('status', 'active')
  
  if (!enrollments || enrollments.length === 0) {
    console.log('No students in class')
    return
  }
  
  const studentIds = enrollments.map(e => e.student_id)
  console.log(`Found ${studentIds.length} students in class\n`)
  
  // Get the exam (Bonding Exam)
  const { data: exam } = await supabase
    .from('exams')
    .select('id, title')
    .eq('title', 'Bonding Exam')
    .limit(1)
    .single()
  
  if (!exam) {
    console.error('Bonding Exam not found')
    return
  }
  
  console.log(`Found exam: ${exam.title}\n`)
  
  // Get attempts for these students on this exam
  const { data: attempts } = await supabase
    .from('exam_attempts')
    .select('id, student_id, total_score, created_at')
    .in('student_id', studentIds)
    .eq('exam_id', exam.id)
  
  if (!attempts || attempts.length === 0) {
    console.log('No attempts found to delete')
    return
  }
  
  console.log(`Found ${attempts.length} attempts to delete\n`)
  
  // Delete student answers first (foreign key constraint)
  const attemptIds = attempts.map(a => a.id)
  
  const { error: answersError } = await supabase
    .from('student_answers')
    .delete()
    .in('attempt_id', attemptIds)
  
  if (answersError) {
    console.error('Error deleting answers:', answersError.message)
    return
  }
  
  console.log('✓ Deleted student answers')
  
  // Delete exam statistics
  const { error: statsError } = await supabase
    .from('exam_statistics')
    .delete()
    .in('attempt_id', attemptIds)
  
  if (statsError) {
    console.error('Error deleting statistics:', statsError.message)
    return
  }
  
  console.log('✓ Deleted exam statistics')
  
  // Delete attempts
  const { error: attemptsError } = await supabase
    .from('exam_attempts')
    .delete()
    .in('id', attemptIds)
  
  if (attemptsError) {
    console.error('Error deleting attempts:', attemptsError.message)
    return
  }
  
  console.log(`✓ Deleted ${attempts.length} exam attempts`)
  console.log('\n✅ All attempts deleted successfully!')
}

main().catch(console.error)

