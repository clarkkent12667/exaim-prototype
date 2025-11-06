/**
 * Setup Test Data Script
 * 
 * This script creates:
 * - 10 students
 * - A "Chemistry Class" 
 * - Enrolls all students in the class
 * - Assigns an existing exam to the class
 * - Creates exam attempts with varying results (good, bad, in-between)
 * 
 * Usage:
 * 1. Make sure you have a teacher account and at least one published exam
 * 2. Set up environment variables:
 *    - VITE_SUPABASE_URL
 *    - VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY for creating users)
 * 3. Run: npx tsx scripts/setup-test-data.ts
 * 
 * Note: To create users, you need the Supabase Service Role Key.
 * If you don't have it, create the students manually first via the UI.
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

// Use service role key if available (for creating users), otherwise use anon key
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

// Student data
const students = [
  { email: 'student1.chemistry@test.com', fullName: 'Alice Johnson', password: 'Test123!@#' },
  { email: 'student2.chemistry@test.com', fullName: 'Bob Smith', password: 'Test123!@#' },
  { email: 'student3.chemistry@test.com', fullName: 'Charlie Brown', password: 'Test123!@#' },
  { email: 'student4.chemistry@test.com', fullName: 'Diana Prince', password: 'Test123!@#' },
  { email: 'student5.chemistry@test.com', fullName: 'Ethan Hunt', password: 'Test123!@#' },
  { email: 'student6.chemistry@test.com', fullName: 'Fiona Chen', password: 'Test123!@#' },
  { email: 'student7.chemistry@test.com', fullName: 'George Wilson', password: 'Test123!@#' },
  { email: 'student8.chemistry@test.com', fullName: 'Hannah Davis', password: 'Test123!@#' },
  { email: 'student9.chemistry@test.com', fullName: 'Isaac Newton', password: 'Test123!@#' },
  { email: 'student10.chemistry@test.com', fullName: 'Julia Roberts', password: 'Test123!@#' },
]

interface Question {
  id: string
  question_type: 'mcq' | 'fib' | 'open_ended'
  marks: number
  correct_answer?: string
  model_answer: string
}

interface ExamData {
  id: string
  title: string
  teacher_id: string
  total_marks: number
}

async function createStudent(email: string, fullName: string, password: string): Promise<string | null> {
  try {
    if (supabaseServiceKey) {
      // Use admin API to create user
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: 'student',
          full_name: fullName
        }
      })
      
      if (error) {
        console.error(`Error creating user ${email}:`, error.message)
        return null
      }
      
      console.log(`✓ Created student: ${fullName} (${email})`)
      return data.user.id
    } else {
      console.warn(`⚠ Cannot create user ${email} - Service Role Key not provided. Please create manually.`)
      return null
    }
  } catch (error: any) {
    console.error(`Error creating student ${email}:`, error.message)
    return null
  }
}

async function findOrCreateStudent(email: string, fullName: string): Promise<string | null> {
  // First, try to find existing user
  const { data: existingUser, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .eq('role', 'student')
    .maybeSingle()
  
  if (existingUser && !error) {
    console.log(`✓ Found existing student: ${fullName} (${email})`)
    return existingUser.id
  }
  
  // If not found and we have service key, create it
  if (supabaseServiceKey) {
    return await createStudent(email, fullName, 'Test123!@#')
  }
  
  console.warn(`⚠ Student ${email} not found and cannot be created (no service key)`)
  return null
}

async function getTeacherId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'teacher')
    .limit(1)
    .single()
  
  if (error || !data) {
    console.error('Error finding teacher:', error?.message)
    return null
  }
  
  return data.id
}

async function getPublishedExam(teacherId: string): Promise<ExamData | null> {
  const { data, error } = await supabase
    .from('exams')
    .select('id, title, teacher_id, total_marks')
    .eq('teacher_id', teacherId)
    .eq('is_published', true)
    .limit(1)
    .single()
  
  if (error || !data) {
    console.error('Error finding published exam:', error?.message)
    console.log('Available exams:')
    const { data: allExams } = await supabase
      .from('exams')
      .select('id, title, is_published')
      .eq('teacher_id', teacherId)
    
    if (allExams) {
      allExams.forEach(exam => {
        console.log(`  - ${exam.title} (${exam.is_published ? 'published' : 'unpublished'})`)
      })
    }
    return null
  }
  
  return data
}

async function getExamQuestions(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_type, marks, correct_answer, model_answer')
    .eq('exam_id', examId)
  
  if (error || !data) {
    console.error('Error fetching questions:', error?.message)
    return []
  }
  
  return data
}

async function getQuestionOptions(questionId: string): Promise<any[]> {
  const { data } = await supabase
    .from('question_options')
    .select('*')
    .eq('question_id', questionId)
    .order('order_index')
  
  return data || []
}

async function createClass(teacherId: string, className: string): Promise<string | null> {
  // Check if class already exists
  const { data: existing } = await supabase
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('name', className)
    .limit(1)
    .single()
  
  if (existing) {
    console.log(`✓ Class "${className}" already exists`)
    return existing.id
  }
  
  const { data, error } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      name: className,
      description: 'Test class for Chemistry students'
    })
    .select('id')
    .single()
  
  if (error || !data) {
    console.error('Error creating class:', error?.message)
    return null
  }
  
  console.log(`✓ Created class: ${className}`)
  return data.id
}

async function enrollStudent(classId: string, studentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('class_enrollments')
    .upsert({
      class_id: classId,
      student_id: studentId,
      status: 'active'
    }, {
      onConflict: 'class_id,student_id'
    })
  
  if (error) {
    console.error(`Error enrolling student ${studentId}:`, error.message)
    return false
  }
  
  return true
}

async function assignExam(classId: string, examId: string, teacherId: string): Promise<boolean> {
  const { error } = await supabase
    .from('exam_assignments')
    .upsert({
      class_id: classId,
      exam_id: examId,
      assigned_by: teacherId,
      is_active: true
    }, {
      onConflict: 'class_id,exam_id'
    })
  
  if (error) {
    console.error('Error assigning exam:', error.message)
    return false
  }
  
  console.log(`✓ Assigned exam to class`)
  return true
}

function generateAnswer(question: Question, options: any[], performance: 'good' | 'bad' | 'average'): string {
  if (question.question_type === 'mcq') {
    if (performance === 'good') {
      // Always pick the correct answer
      const correctOption = options.find(opt => opt.is_correct)
      return correctOption ? correctOption.option_text : options[0]?.option_text || ''
    } else if (performance === 'bad') {
      // Pick a wrong answer
      const wrongOption = options.find(opt => !opt.is_correct)
      return wrongOption ? wrongOption.option_text : options[0]?.option_text || ''
    } else {
      // 50% chance of correct
      const correctOption = options.find(opt => opt.is_correct)
      return Math.random() > 0.5 && correctOption 
        ? correctOption.option_text 
        : options.find(opt => !opt.is_correct)?.option_text || options[0]?.option_text || ''
    }
  } else if (question.question_type === 'fib') {
    if (performance === 'good') {
      return question.correct_answer || question.model_answer.split(' ')[0] || 'correct'
    } else if (performance === 'bad') {
      return 'wrong'
    } else {
      return Math.random() > 0.5 
        ? (question.correct_answer || question.model_answer.split(' ')[0] || 'correct')
        : 'partial'
    }
  } else {
    // open_ended
    if (performance === 'good') {
      return question.model_answer.substring(0, Math.min(question.model_answer.length, 200))
    } else if (performance === 'bad') {
      return 'I do not know the answer.'
    } else {
      return question.model_answer.substring(0, Math.min(question.model_answer.length, 100)) + '... but incomplete.'
    }
  }
}

async function createAttempt(
  examId: string,
  studentId: string,
  questions: Question[],
  performance: 'good' | 'bad' | 'average'
): Promise<string | null> {
  // Create attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('exam_attempts')
    .insert({
      exam_id: examId,
      student_id: studentId,
      status: 'completed',
      started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      submitted_at: new Date().toISOString(),
      total_score: 0
    })
    .select('id')
    .single()
  
  if (attemptError || !attempt) {
    console.error('Error creating attempt:', attemptError?.message)
    return null
  }
  
  let totalScore = 0
  
  // Create answers for each question
  for (const question of questions) {
    const options = question.question_type === 'mcq' 
      ? await getQuestionOptions(question.id)
      : []
    
    const answerText = generateAnswer(question, options, performance)
    
    // Calculate score based on performance
    let score = 0
    let isCorrect: boolean | undefined = undefined
    
    if (question.question_type === 'mcq') {
      const selectedOption = options.find(opt => opt.option_text === answerText)
      isCorrect = selectedOption?.is_correct || false
      score = isCorrect ? question.marks : 0
    } else if (question.question_type === 'fib') {
      if (performance === 'good') {
        score = question.marks
        isCorrect = true
      } else if (performance === 'bad') {
        score = 0
        isCorrect = false
      } else {
        score = question.marks * 0.5
        isCorrect = undefined // partially correct
      }
    } else {
      // open_ended - simulate scoring
      if (performance === 'good') {
        score = question.marks * 0.9 // 90% of marks
        isCorrect = undefined
      } else if (performance === 'bad') {
        score = question.marks * 0.2 // 20% of marks
        isCorrect = false
      } else {
        score = question.marks * 0.6 // 60% of marks
        isCorrect = undefined
      }
    }
    
    totalScore += score
    
    const { error: answerError } = await supabase
      .from('student_answers')
      .insert({
        attempt_id: attempt.id,
        question_id: question.id,
        answer_text: answerText,
        is_correct: isCorrect,
        score: Math.round(score * 100) / 100,
        evaluated_at: new Date().toISOString()
      })
    
    if (answerError) {
      console.error(`Error creating answer for question ${question.id}:`, answerError.message)
    }
  }
  
  // Update attempt with total score
  await supabase
    .from('exam_attempts')
    .update({ total_score: Math.round(totalScore * 100) / 100 })
    .eq('id', attempt.id)
  
  // Create statistics
  const correctCount = questions.filter((q, i) => {
    if (q.question_type === 'mcq') {
      return performance === 'good' || (performance === 'average' && i % 2 === 0)
    }
    return performance === 'good'
  }).length
  
  const incorrectCount = questions.filter((q, i) => {
    if (q.question_type === 'mcq') {
      return performance === 'bad' || (performance === 'average' && i % 2 === 1)
    }
    return performance === 'bad'
  }).length
  
  const partiallyCorrectCount = questions.length - correctCount - incorrectCount
  
  await supabase
    .from('exam_statistics')
    .insert({
      attempt_id: attempt.id,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      partially_correct_count: partiallyCorrectCount,
      skipped_count: 0,
      total_questions: questions.length
    })
  
  console.log(`  ✓ Created attempt with ${Math.round(totalScore)}/${Math.round(questions.reduce((sum, q) => sum + q.marks, 0))} marks (${performance})`)
  
  return attempt.id
}

async function main() {
  console.log('🚀 Starting test data setup...\n')
  
  // Step 1: Get or create teacher
  console.log('Step 1: Finding teacher...')
  const teacherId = await getTeacherId()
  if (!teacherId) {
    console.error('❌ No teacher found. Please create a teacher account first.')
    process.exit(1)
  }
  console.log(`✓ Found teacher: ${teacherId}\n`)
  
  // Step 2: Get published exam
  console.log('Step 2: Finding published exam...')
  const exam = await getPublishedExam(teacherId)
  if (!exam) {
    console.error('❌ No published exam found. Please create and publish an exam first.')
    process.exit(1)
  }
  console.log(`✓ Found exam: ${exam.title} (${exam.id})\n`)
  
  // Step 3: Get exam questions
  console.log('Step 3: Loading exam questions...')
  const questions = await getExamQuestions(exam.id)
  if (questions.length === 0) {
    console.error('❌ Exam has no questions. Please add questions to the exam first.')
    process.exit(1)
  }
  console.log(`✓ Found ${questions.length} questions\n`)
  
  // Step 4: Create or find students
  console.log('Step 4: Creating/finding students...')
  const studentIds: string[] = []
  for (const student of students) {
    const studentId = await findOrCreateStudent(student.email, student.fullName)
    if (studentId) {
      studentIds.push(studentId)
    } else {
      console.warn(`⚠ Skipping ${student.fullName} - could not create or find`)
    }
  }
  
  if (studentIds.length === 0) {
    console.error('❌ No students created. Please create students manually or provide SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  console.log(`✓ Processed ${studentIds.length} students\n`)
  
  // Step 5: Create class
  console.log('Step 5: Creating Chemistry Class...')
  const classId = await createClass(teacherId, 'Chemistry Class')
  if (!classId) {
    console.error('❌ Failed to create class')
    process.exit(1)
  }
  console.log(`✓ Class ID: ${classId}\n`)
  
  // Step 6: Enroll students
  console.log('Step 6: Enrolling students...')
  for (const studentId of studentIds) {
    await enrollStudent(classId, studentId)
  }
  console.log(`✓ Enrolled ${studentIds.length} students\n`)
  
  // Step 7: Assign exam
  console.log('Step 7: Assigning exam to class...')
  await assignExam(classId, exam.id, teacherId)
  console.log('✓ Exam assigned\n')
  
  // Step 8: Create attempts with varying performance
  console.log('Step 8: Creating exam attempts...')
  const performanceDistribution: ('good' | 'bad' | 'average')[] = [
    'good', 'good', 'good', // 3 good
    'average', 'average', 'average', 'average', // 4 average
    'bad', 'bad', 'bad' // 3 bad
  ]
  
  for (let i = 0; i < studentIds.length && i < performanceDistribution.length; i++) {
    const performance = performanceDistribution[i]
    const studentId = studentIds[i]
    await createAttempt(exam.id, studentId, questions, performance)
  }
  
  console.log('\n✅ Test data setup complete!')
  console.log('\nSummary:')
  console.log(`  - Students: ${studentIds.length}`)
  console.log(`  - Class: Chemistry Class`)
  console.log(`  - Exam: ${exam.title}`)
  console.log(`  - Attempts: ${Math.min(studentIds.length, performanceDistribution.length)}`)
  console.log('\nYou can now test the app, analytics, and grades!')
}

main().catch(console.error)

