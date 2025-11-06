/**
 * Create Reattempts Script
 * 
 * This script creates 2-3 exam attempts for students enrolled in an existing class
 * on an exam assigned to that class, with varying performance levels (good, bad, in-between).
 * 
 * Usage:
 * 1. Make sure you have a class with at least 10 enrolled students
 * 2. Make sure an exam is assigned to that class
 * 3. Set up environment variables:
 *    - VITE_SUPABASE_URL
 *    - VITE_SUPABASE_ANON_KEY
 *    - SUPABASE_SERVICE_ROLE_KEY (recommended to bypass RLS)
 * 4. Run: npx tsx scripts/create-reattempts.ts
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

interface ExamAssignment {
  id: string
  class_id: string
  exam_id: string
  is_active: boolean
}

async function getExistingClass(): Promise<ClassData | null> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .limit(1)
    .single()
  
  if (error || !data) {
    console.error('Error finding class:', error?.message)
    return null
  }
  
  return data
}

async function getStudentsFromClass(classId: string): Promise<Student[]> {
  // Get enrollments for the class
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('class_enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('status', 'active')
  
  if (enrollmentError || !enrollments || enrollments.length === 0) {
    console.error('Error fetching enrollments:', enrollmentError?.message)
    return []
  }
  
  // Get student profiles
  const studentIds = enrollments.map(e => e.student_id)
  const { data: students, error: studentsError } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', studentIds)
    .eq('role', 'student')
  
  if (studentsError || !students) {
    console.error('Error fetching student profiles:', studentsError?.message)
    return []
  }
  
  return students
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
    console.error('Code:', assignmentError.code)
    // Try to continue with any exam if assignment query fails
  }
  
  if (!assignments || assignments.length === 0) {
    console.warn('⚠ No exam assigned to class. Looking for any exam...')
    // Fallback: get any exam (preferably published)
    const { data: publishedExam, error: publishedError } = await supabase
      .from('exams')
      .select('id, title, teacher_id, total_marks')
      .eq('is_published', true)
      .limit(1)
      .maybeSingle()
    
    if (publishedExam && !publishedError) {
      console.log('✓ Using published exam as fallback')
      return publishedExam
    }
    
    // If no published exam, get any exam
    const { data: anyExam, error: anyError } = await supabase
      .from('exams')
      .select('id, title, teacher_id, total_marks')
      .limit(1)
      .maybeSingle()
    
    if (anyExam && !anyError) {
      console.log('✓ Using any available exam as fallback')
      return anyExam
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
  const hoursAgo = attemptNumber * 24 // Each attempt is 24 hours apart
  const startedAt = new Date(Date.now() - hoursAgo * 3600000)
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
  console.log('🚀 Starting reattempt creation...\n')
  
  // Step 1: Get existing class
  console.log('Step 1: Finding existing class...')
  const classData = await getExistingClass()
  if (!classData) {
    console.error('❌ No class found. Please create a class first.')
    process.exit(1)
  }
  console.log(`✓ Found class: ${classData.name} (${classData.id})\n`)
  
  // Step 2: Get students from class
  console.log('Step 2: Fetching students enrolled in class...')
  const students = await getStudentsFromClass(classData.id)
  if (students.length === 0) {
    console.error('❌ No students found in class. Please enroll at least 10 students in the class.')
    process.exit(1)
  }
  if (students.length < 10) {
    console.warn(`⚠ Only found ${students.length} students in class. Will create attempts for all of them.`)
  }
  console.log(`✓ Found ${students.length} students in class\n`)
  
  // Step 3: Get exam assigned to class
  console.log('Step 3: Finding exam assigned to class...')
  const exam = await getExamFromClass(classData.id)
  if (!exam) {
    console.error('❌ No exam assigned to class. Please assign an exam to the class first.')
    process.exit(1)
  }
  console.log(`✓ Found exam: ${exam.title} (${exam.id})\n`)
  
  // Step 4: Get exam questions
  console.log('Step 4: Loading exam questions...')
  const questions = await getExamQuestions(exam.id)
  if (questions.length === 0) {
    console.error('❌ Exam has no questions. Please add questions to the exam first.')
    process.exit(1)
  }
  console.log(`✓ Found ${questions.length} questions\n`)
  
  // Step 5: Create attempts with varying performance
  console.log('Step 5: Creating exam attempts with reattempts...\n')
  
  // Performance distribution for first attempts
  const performanceDistribution: ('good' | 'bad' | 'average')[] = [
    'good', 'good', 'good', // 3 good
    'average', 'average', 'average', 'average', // 4 average
    'bad', 'bad', 'bad' // 3 bad
  ]
  
  // Ensure we have enough performance levels for all students
  while (performanceDistribution.length < students.length) {
    performanceDistribution.push('average')
  }
  
  let totalAttempts = 0
  
  for (let i = 0; i < students.length; i++) {
    const student = students[i]
    const firstAttemptPerformance = performanceDistribution[i]
    
    console.log(`Creating attempts for ${student.full_name} (${student.email}):`)
    
    // Create 2-3 attempts per student
    const numAttempts = Math.floor(Math.random() * 2) + 2 // 2 or 3 attempts
    
    // Performance progression: can improve, stay same, or get worse
    const performances: ('good' | 'bad' | 'average')[] = [firstAttemptPerformance]
    
    for (let j = 1; j < numAttempts; j++) {
      const prevPerf = performances[j - 1]
      // 60% chance of improvement, 20% same, 20% worse
      const rand = Math.random()
      if (rand < 0.6) {
        // Improvement
        if (prevPerf === 'bad') {
          performances.push('average')
        } else if (prevPerf === 'average') {
          performances.push('good')
        } else {
          performances.push('good') // stay good
        }
      } else if (rand < 0.8) {
        // Same
        performances.push(prevPerf)
      } else {
        // Worse
        if (prevPerf === 'good') {
          performances.push('average')
        } else if (prevPerf === 'average') {
          performances.push('bad')
        } else {
          performances.push('bad') // stay bad
        }
      }
    }
    
    // Create attempts
    for (let attemptNum = 0; attemptNum < numAttempts; attemptNum++) {
      const performance = performances[attemptNum]
      await createAttempt(exam.id, student.id, questions, performance, attemptNum + 1)
      totalAttempts++
    }
    
    console.log('')
  }
  
  console.log('✅ Reattempt creation complete!')
  console.log('\nSummary:')
  console.log(`  - Class: ${classData.name}`)
  console.log(`  - Students: ${students.length}`)
  console.log(`  - Exam: ${exam.title}`)
  console.log(`  - Total attempts created: ${totalAttempts}`)
  console.log(`  - Average attempts per student: ${(totalAttempts / students.length).toFixed(1)}`)
  console.log('\nYou can now test the grade sheet and analytics!')
}

main().catch(console.error)

