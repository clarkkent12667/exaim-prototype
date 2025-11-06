/**
 * Create Attempts for Bruce Wayne's Class
 * 
 * This script:
 * - Finds teacher "Bruce Wayne"
 * - Gets their class and exam
 * - Creates or finds 10 students
 * - Enrolls them in the class
 * - Creates 3 attempts per student (good, bad, average)
 * 
 * Usage:
 * 1. Make sure you have a teacher account named "Bruce Wayne" with a class and exam
 * 2. Set up environment variables:
 *    - VITE_SUPABASE_URL
 *    - VITE_SUPABASE_ANON_KEY
 *    - SUPABASE_SERVICE_ROLE_KEY (recommended to create students)
 * 3. Run: npx tsx scripts/create-bruce-wayne-attempts.ts
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

// Use service role key if available (bypasses RLS), otherwise use anon key
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

interface Student {
  id: string
  email: string
  full_name: string
}

interface ClassData {
  id: string
  name: string
  teacher_id: string
}

// Student data - 10 students
const students = [
  { email: 'student1.bruce@test.com', fullName: 'Alice Johnson', password: 'Test123!@#' },
  { email: 'student2.bruce@test.com', fullName: 'Bob Smith', password: 'Test123!@#' },
  { email: 'student3.bruce@test.com', fullName: 'Charlie Brown', password: 'Test123!@#' },
  { email: 'student4.bruce@test.com', fullName: 'Diana Prince', password: 'Test123!@#' },
  { email: 'student5.bruce@test.com', fullName: 'Ethan Hunt', password: 'Test123!@#' },
  { email: 'student6.bruce@test.com', fullName: 'Fiona Chen', password: 'Test123!@#' },
  { email: 'student7.bruce@test.com', fullName: 'George Wilson', password: 'Test123!@#' },
  { email: 'student8.bruce@test.com', fullName: 'Hannah Davis', password: 'Test123!@#' },
  { email: 'student9.bruce@test.com', fullName: 'Isaac Newton', password: 'Test123!@#' },
  { email: 'student10.bruce@test.com', fullName: 'Julia Roberts', password: 'Test123!@#' },
]

async function getTeacherByName(teacherName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'teacher')
    .ilike('full_name', `%${teacherName}%`)
    .limit(1)
    .maybeSingle()
  
  if (error) {
    console.error('Error finding teacher:', error.message)
    return null
  }
  
  if (!data) {
    console.error(`❌ Teacher "${teacherName}" not found.`)
    return null
  }
  
  console.log(`✓ Found teacher: ${data.full_name} (${data.id})`)
  return data.id
}

async function getClassByTeacher(teacherId: string): Promise<ClassData | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .eq('teacher_id', teacherId)
    .limit(1)
    .maybeSingle()
  
  if (error || !data) {
    console.error('Error finding class:', error?.message)
    return null
  }
  
  console.log(`✓ Found class: ${data.name} (${data.id})`)
  return data
}

async function getExamFromClass(classId: string): Promise<ExamData | null> {
  // Get exam assignment for the class
  const { data: assignments, error: assignmentError } = await supabase
    .from('exam_assignments')
    .select('exam_id')
    .eq('class_id', classId)
    .eq('is_active', true)
    .limit(1)
  
  if (assignmentError) {
    console.error('Error querying exam assignments:', assignmentError.message)
  }
  
  if (!assignments || assignments.length === 0) {
    console.warn('⚠ No exam assigned to class. Looking for any exam from teacher...')
    // Fallback: get any exam from the teacher
    const { data: teacherProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'teacher')
      .limit(1)
      .single()
    
    if (teacherProfile) {
      const { data: anyExam, error: anyError } = await supabase
        .from('exams')
        .select('id, title, teacher_id, total_marks')
        .eq('teacher_id', teacherProfile.id)
        .limit(1)
        .maybeSingle()
      
      if (anyExam && !anyError) {
        console.log('✓ Using exam from teacher as fallback')
        return anyExam
      }
    }
    
    console.error('❌ No exam found. Please assign an exam to the class or create an exam.')
    return null
  }
  
  const assignment = assignments[0]
  
  // Get exam details
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id, title, teacher_id, total_marks')
    .eq('id', assignment.exam_id)
    .single()
  
  if (examError || !exam) {
    console.error('Error fetching exam:', examError?.message)
    return null
  }
  
  console.log(`✓ Found exam: ${exam.title} (${exam.id})`)
  return exam
}

async function getExamQuestions(examId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_type, marks, correct_answer, model_answer')
    .eq('exam_id', examId)
    .order('created_at', { ascending: true })
  
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
      console.warn(`⚠ Cannot create user ${email} - Service Role Key not provided.`)
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
  performance: 'good' | 'bad' | 'average',
  attemptNumber: number
): Promise<string | null> {
  // Calculate time offset - each attempt should be at different times
  const daysAgo = (attemptNumber - 1) * 7 // Each attempt is 7 days apart
  const startedAt = new Date(Date.now() - daysAgo * 24 * 3600000)
  const submittedAt = new Date(startedAt.getTime() + (30 + Math.random() * 30) * 60000) // 30-60 minutes later
  
  // Create attempt
  const { data: attempt, error: attemptError } = await supabase
    .from('exam_attempts')
    .insert({
      exam_id: examId,
      student_id: studentId,
      status: 'completed',
      started_at: startedAt.toISOString(),
      submitted_at: submittedAt.toISOString(),
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
        evaluated_at: submittedAt.toISOString()
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
  
  const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0)
  const percentage = Math.round((totalScore / totalMarks) * 100)
  console.log(`  ✓ Attempt ${attemptNumber}: ${Math.round(totalScore)}/${Math.round(totalMarks)} marks (${percentage}%) - ${performance}`)
  
  return attempt.id
}

async function main() {
  console.log('🚀 Starting attempt creation for Bruce Wayne\'s class...\n')
  
  // Step 1: Find teacher "Bruce Wayne"
  console.log('Step 1: Finding teacher "Bruce Wayne"...')
  const teacherId = await getTeacherByName('Bruce Wayne')
  if (!teacherId) {
    console.error('❌ Teacher "Bruce Wayne" not found. Please create the teacher account first.')
    process.exit(1)
  }
  console.log('')
  
  // Step 2: Get class
  console.log('Step 2: Finding class...')
  const classData = await getClassByTeacher(teacherId)
  if (!classData) {
    console.error('❌ No class found for this teacher. Please create a class first.')
    process.exit(1)
  }
  console.log('')
  
  // Step 3: Get exam
  console.log('Step 3: Finding exam...')
  const exam = await getExamFromClass(classData.id)
  if (!exam) {
    console.error('❌ No exam found. Please assign an exam to the class first.')
    process.exit(1)
  }
  console.log('')
  
  // Step 4: Get exam questions
  console.log('Step 4: Loading exam questions...')
  const questions = await getExamQuestions(exam.id)
  if (questions.length === 0) {
    console.error('❌ Exam has no questions. Please add questions to the exam first.')
    process.exit(1)
  }
  console.log(`✓ Found ${questions.length} questions\n`)
  
  // Step 5: Create or find students
  console.log('Step 5: Creating/finding students...')
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
  
  // Step 6: Enroll students in class
  console.log('Step 6: Enrolling students in class...')
  for (const studentId of studentIds) {
    await enrollStudent(classData.id, studentId)
  }
  console.log(`✓ Enrolled ${studentIds.length} students\n`)
  
  // Step 7: Create 3 attempts per student with good, bad, and average performance
  console.log('Step 7: Creating exam attempts (3 per student: good, bad, average)...\n')
  
  // Performance order: good, bad, average for each student
  const performanceOrder: ('good' | 'bad' | 'average')[] = ['good', 'bad', 'average']
  
  let totalAttempts = 0
  
  for (let i = 0; i < studentIds.length; i++) {
    const studentId = studentIds[i]
    const student = students[i]
    
    console.log(`Creating attempts for ${student.fullName} (${student.email}):`)
    
    // Create 3 attempts: good, bad, average
    for (let attemptNum = 0; attemptNum < 3; attemptNum++) {
      const performance = performanceOrder[attemptNum]
      await createAttempt(exam.id, studentId, questions, performance, attemptNum + 1)
      totalAttempts++
    }
    
    console.log('')
  }
  
  console.log('✅ Attempt creation complete!')
  console.log('\nSummary:')
  console.log(`  - Teacher: Bruce Wayne`)
  console.log(`  - Class: ${classData.name}`)
  console.log(`  - Exam: ${exam.title}`)
  console.log(`  - Students: ${studentIds.length}`)
  console.log(`  - Total attempts created: ${totalAttempts}`)
  console.log(`  - Attempts per student: 3 (good, bad, average)`)
  console.log('\nYou can now view the attempts in the grade sheet and analytics!')
}

main().catch(console.error)

