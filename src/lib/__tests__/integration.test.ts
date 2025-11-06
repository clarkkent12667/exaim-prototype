import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as questionGeneration from '../questionGeneration'
import { evaluationService } from '../evaluationService'
import { classService, enrollmentService, assignmentService } from '../classService'
import { examService, questionService, attemptService, answerService } from '../examService'
import { analyticsService } from '../analyticsService'
import { supabase } from '../supabase'
import type { Question, QuestionOption, ExamAttempt, StudentAnswer } from '../examService'

// Mock all services
vi.mock('../classService')
vi.mock('../examService')
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}))

describe('Integration Tests: Full Exam Workflow', () => {
  let teacherId: string
  let studentId: string
  let classId: string
  let examId: string
  let attemptId: string
  let questionIds: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup IDs
    teacherId = 'teacher-123'
    studentId = 'student-456'
    classId = 'class-789'
    examId = 'exam-101'
    attemptId = 'attempt-202'
    questionIds = ['q1', 'q2', 'q3']
  })

  describe('Complete Workflow: Generation → Assignment → Attempt → Evaluation → Analytics', () => {
    it('should complete full workflow from question generation to analytics', async () => {
      // ============================================
      // STEP 1: Generate Questions
      // ============================================
      const generationRequest = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium' as const,
        question_counts: {
          mcq: 2,
          fib: 1,
          open_ended: 1,
        },
      }

      // Mock question generation
      const generatedQuestions = [
        {
          question_text: 'What is 2 + 2?',
          question_type: 'mcq' as const,
          marks: 25,
          model_answer: 'The answer is 4',
          correct_answer: 'B',
          options: [
            { option_text: '3', is_correct: false, order_index: 0 },
            { option_text: '4', is_correct: true, order_index: 1 },
            { option_text: '5', is_correct: false, order_index: 2 },
            { option_text: '6', is_correct: false, order_index: 3 },
          ],
        },
        {
          question_text: 'What is 3 × 3?',
          question_type: 'mcq' as const,
          marks: 25,
          model_answer: 'The answer is 9',
          correct_answer: 'C',
          options: [
            { option_text: '6', is_correct: false, order_index: 0 },
            { option_text: '8', is_correct: false, order_index: 1 },
            { option_text: '9', is_correct: true, order_index: 2 },
            { option_text: '10', is_correct: false, order_index: 3 },
          ],
        },
        {
          question_text: 'The capital of England is [London].',
          question_type: 'fib' as const,
          marks: 25,
          model_answer: 'London is the capital',
          correct_answer: 'London',
        },
        {
          question_text: 'Explain the process of photosynthesis.',
          question_type: 'open_ended' as const,
          marks: 25,
          model_answer: 'Photosynthesis is the process by which plants convert light energy into chemical energy.',
        },
      ]

      // Validate generation request
      const validation = questionGeneration.validateRequest(generationRequest)
      expect(validation.valid).toBe(true)

      // ============================================
      // STEP 2: Create Exam with Generated Questions
      // ============================================
      const examData = {
        id: examId,
        teacher_id: teacherId,
        title: 'GCSE Mathematics Test',
        description: 'Test on basic arithmetic',
        qualification_id: 'qual-1',
        exam_board_id: 'board-1',
        subject_id: 'subject-1',
        difficulty: 'medium' as const,
        is_published: true,
        total_marks: 100,
      }

      // Mock examService.create since we've mocked the module
      vi.mocked(examService.create).mockResolvedValue({ data: examData, error: null })
      vi.mocked(examService.getById).mockResolvedValue({ data: examData, error: null })
      
      // Mock questionService methods
      let questionIndex = 0
      vi.mocked(questionService.create).mockImplementation((question: any) => {
        const q = generatedQuestions[questionIndex]
        const result = {
          data: { ...q, id: questionIds[questionIndex], exam_id: examId },
          error: null,
        }
        questionIndex++
        return Promise.resolve(result)
      })
      vi.mocked(questionService.createWithOptions).mockImplementation((question: any, options?: any) => {
        const q = generatedQuestions[questionIndex]
        const result = {
          data: { ...q, id: questionIds[questionIndex], exam_id: examId },
          error: null,
        }
        questionIndex++
        return Promise.resolve(result)
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exams') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: examData, error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: examData, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'questions') {
          let questionIndex = 0
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockImplementation(() => {
                  const q = generatedQuestions[questionIndex]
                  const result = {
                    data: { ...q, id: questionIds[questionIndex], exam_id: examId },
                    error: null,
                  }
                  questionIndex++
                  return Promise.resolve(result)
                }),
              }),
            }),
          } as any
        }
        if (table === 'question_options') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          } as any
        }
        return {} as any
      })

      // Create exam
      const { data: exam, error: examError } = await examService.create({
        teacher_id: teacherId,
        title: examData.title,
        description: examData.description,
        qualification_id: examData.qualification_id,
        exam_board_id: examData.exam_board_id,
        subject_id: examData.subject_id,
        difficulty: examData.difficulty,
        is_published: examData.is_published,
      })

      expect(examError).toBeNull()
      expect(exam).toBeDefined()

      // Create questions
      for (const genQuestion of generatedQuestions) {
        if (genQuestion.question_type === 'mcq') {
          const { data: question, error: qError } = await questionService.createWithOptions(
            {
              exam_id: examId,
              question_text: genQuestion.question_text,
              question_type: genQuestion.question_type,
              marks: genQuestion.marks,
              model_answer: genQuestion.model_answer,
              correct_answer: genQuestion.correct_answer,
            },
            genQuestion.options
          )
          expect(qError).toBeNull()
          expect(question).toBeDefined()
        } else {
          const { data: question, error: qError } = await questionService.create({
            exam_id: examId,
            question_text: genQuestion.question_text,
            question_type: genQuestion.question_type,
            marks: genQuestion.marks,
            model_answer: genQuestion.model_answer,
            correct_answer: genQuestion.correct_answer,
          })
          expect(qError).toBeNull()
          expect(question).toBeDefined()
        }
      }

      // ============================================
      // STEP 3: Create Class
      // ============================================
      const classData = {
        id: classId,
        teacher_id: teacherId,
        name: 'Mathematics Class A',
        description: 'Year 10 Mathematics',
      }

      // Mock classService.create
      vi.mocked(classService.create).mockResolvedValue({ data: classData, error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'classes') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: classData, error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: classData, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: createdClass, error: classError } = await classService.create({
        teacher_id: teacherId,
        name: classData.name,
        description: classData.description,
      })

      expect(classError).toBeNull()
      expect(createdClass).toBeDefined()
      expect(createdClass?.name).toBe('Mathematics Class A')

      // ============================================
      // STEP 4: Enroll Student in Class
      // ============================================
      const enrollmentData = {
        id: 'enrollment-1',
        class_id: classId,
        student_id: studentId,
        status: 'active' as const,
      }

      // Mock enrollmentService.enrollStudent
      vi.mocked(enrollmentService.enrollStudent).mockResolvedValue({ data: enrollmentData, error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'class_enrollments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: enrollmentData, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: enrollment, error: enrollmentError } = await enrollmentService.enrollStudent(
        classId,
        studentId
      )

      expect(enrollmentError).toBeNull()
      expect(enrollment).toBeDefined()
      expect(enrollment?.status).toBe('active')

      // ============================================
      // STEP 5: Assign Exam to Class
      // ============================================
      const assignmentData = {
        id: 'assignment-1',
        class_id: classId,
        exam_id: examId,
        assigned_by: teacherId,
        is_active: true,
      }

      // Mock assignmentService methods
      vi.mocked(assignmentService.assignExam).mockResolvedValue({ data: assignmentData, error: null })
      vi.mocked(assignmentService.isAssignedToStudent).mockResolvedValue({ data: true, error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exams') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { is_published: true }, error: null }),
              }),
            }),
          } as any
        }
        if (table === 'exam_assignments') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: assignmentData, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: assignment, error: assignmentError } = await assignmentService.assignExam({
        class_id: classId,
        exam_id: examId,
        assigned_by: teacherId,
      })

      expect(assignmentError).toBeNull()
      expect(assignment).toBeDefined()
      expect(assignment?.is_active).toBe(true)

      // Verify exam is assigned to student
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'class_enrollments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [enrollmentData], error: null }),
                }),
              }),
            }),
          } as any
        }
        if (table === 'exam_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      maybeSingle: vi.fn().mockResolvedValue({ data: assignmentData, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: isAssigned } = await assignmentService.isAssignedToStudent(examId, studentId)
      expect(isAssigned).toBe(true)

      // ============================================
      // STEP 6: Student Starts Attempt
      // ============================================
      const attemptData: ExamAttempt = {
        id: attemptId,
        exam_id: examId,
        student_id: studentId,
        started_at: new Date().toISOString(),
        status: 'in_progress' as const,
        total_score: 0,
      }

      // Mock attemptService.create
      vi.mocked(attemptService.create).mockResolvedValue({ data: attemptData, error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exam_attempts') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: attemptData, error: null }),
              }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: attemptData, error: null }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: attempt, error: attemptError } = await attemptService.create({
        exam_id: examId,
        student_id: studentId,
      })

      expect(attemptError).toBeNull()
      expect(attempt).toBeDefined()
      expect(attempt?.status).toBe('in_progress')

      // ============================================
      // STEP 7: Student Answers Questions
      // ============================================
      const studentAnswers: StudentAnswer[] = [
        {
          id: 'answer-1',
          attempt_id: attemptId,
          question_id: questionIds[0], // MCQ: What is 2 + 2? (correct answer: B/4)
          answer_text: 'B', // Correct
          score: 0, // Will be evaluated
        },
        {
          id: 'answer-2',
          attempt_id: attemptId,
          question_id: questionIds[1], // MCQ: What is 3 × 3? (correct answer: C/9)
          answer_text: 'A', // Incorrect
          score: 0,
        },
        {
          id: 'answer-3',
          attempt_id: attemptId,
          question_id: questionIds[2], // FIB: Capital of England
          answer_text: 'London', // Correct
          score: 0,
        },
        {
          id: 'answer-4',
          attempt_id: attemptId,
          question_id: questionIds[3], // Open-ended: Photosynthesis
          answer_text: 'Photosynthesis is when plants use sunlight to make food.',
          score: 0,
        },
      ]

      // Mock answerService.saveAnswer
      vi.mocked(answerService.saveAnswer).mockImplementation((answer: any) => {
        const savedAnswer = studentAnswers.find(a => a.question_id === answer.question_id)
        return Promise.resolve({ data: savedAnswer || null, error: savedAnswer ? null : { message: 'Answer not found' } })
      })

      // Create a mock that tracks which answer is being saved
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'student_answers') {
          return {
            upsert: vi.fn().mockImplementation((answerData: any) => {
              // Find the matching answer by question_id
              const savedAnswer = studentAnswers.find(a => a.question_id === answerData.question_id)
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: savedAnswer || null,
                    error: savedAnswer ? null : { message: 'Answer not found' },
                  }),
                }),
              }
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: studentAnswers, error: null }),
            }),
          } as any
        }
        return {} as any
      })

      // Save answers
      for (const answer of studentAnswers) {
        const { error: answerError } = await answerService.saveAnswer({
          attempt_id: attemptId,
          question_id: answer.question_id,
          answer_text: answer.answer_text,
          score: 0,
        })
        expect(answerError).toBeNull()
      }

      // ============================================
      // STEP 8: Evaluate Answers
      // ============================================
      const questionsWithOptions: (Question & { options?: QuestionOption[] })[] = [
        {
          id: questionIds[0],
          exam_id: examId,
          question_text: 'What is 2 + 2?',
          question_type: 'mcq',
          marks: 25,
          model_answer: 'The answer is 4',
          correct_answer: 'B',
          options: [
            { id: 'opt1', question_id: questionIds[0], option_text: '3', is_correct: false, order_index: 0 },
            { id: 'opt2', question_id: questionIds[0], option_text: '4', is_correct: true, order_index: 1 },
            { id: 'opt3', question_id: questionIds[0], option_text: '5', is_correct: false, order_index: 2 },
            { id: 'opt4', question_id: questionIds[0], option_text: '6', is_correct: false, order_index: 3 },
          ],
        },
        {
          id: questionIds[1],
          exam_id: examId,
          question_text: 'What is 3 × 3?',
          question_type: 'mcq',
          marks: 25,
          model_answer: 'The answer is 9',
          correct_answer: 'C',
          options: [
            { id: 'opt5', question_id: questionIds[1], option_text: '6', is_correct: false, order_index: 0 },
            { id: 'opt6', question_id: questionIds[1], option_text: '8', is_correct: false, order_index: 1 },
            { id: 'opt7', question_id: questionIds[1], option_text: '9', is_correct: true, order_index: 2 },
            { id: 'opt8', question_id: questionIds[1], option_text: '10', is_correct: false, order_index: 3 },
          ],
        },
        {
          id: questionIds[2],
          exam_id: examId,
          question_text: 'The capital of England is [London].',
          question_type: 'fib',
          marks: 25,
          model_answer: 'London is the capital',
          correct_answer: 'London',
        },
        {
          id: questionIds[3],
          exam_id: examId,
          question_text: 'Explain the process of photosynthesis.',
          question_type: 'open_ended',
          marks: 25,
          model_answer: 'Photosynthesis is the process by which plants convert light energy into chemical energy.',
        },
      ]

      // Mock AI evaluation for open-ended question
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: {
          score: 20, // 20 out of 25 marks
          feedback: 'Good understanding of photosynthesis. Could expand on the chemical process.',
          evaluation_metadata: {
            accuracy: 80,
            completeness: 75,
            relevance: 85,
          },
        },
        error: null,
      })

      // Evaluate all answers
      const evaluationResult = await evaluationService.evaluateAllAnswers(
        questionsWithOptions,
        studentAnswers
      )

      expect(evaluationResult.evaluatedAnswers).toHaveLength(4)
      expect(evaluationResult.totalScore).toBe(70) // 25 (MCQ1) + 0 (MCQ2) + 25 (FIB) + 20 (Open-ended)

      // Verify individual evaluations
      const mcq1Answer = evaluationResult.evaluatedAnswers.find(a => a.question_id === questionIds[0])
      expect(mcq1Answer?.is_correct).toBe(true)
      expect(mcq1Answer?.score).toBe(25)

      const mcq2Answer = evaluationResult.evaluatedAnswers.find(a => a.question_id === questionIds[1])
      expect(mcq2Answer?.is_correct).toBe(false)
      expect(mcq2Answer?.score).toBe(0)

      const fibAnswer = evaluationResult.evaluatedAnswers.find(a => a.question_id === questionIds[2])
      expect(fibAnswer?.is_correct).toBe(true)
      expect(fibAnswer?.score).toBe(25)

      const openEndedAnswer = evaluationResult.evaluatedAnswers.find(a => a.question_id === questionIds[3])
      expect(openEndedAnswer?.score).toBe(20)
      expect(openEndedAnswer?.ai_evaluation).toBeDefined()

      // ============================================
      // STEP 9: Submit Attempt
      // ============================================
      const submittedAttempt = {
        ...attemptData,
        status: 'completed' as const,
        submitted_at: new Date().toISOString(),
        total_score: 70,
      }

      // Mock attemptService.submit
      vi.mocked(attemptService.submit).mockResolvedValue({ data: submittedAttempt, error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exam_attempts') {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: submittedAttempt, error: null }),
                }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      const { data: submitted, error: submitError } = await attemptService.submit(attemptId)
      expect(submitError).toBeNull()
      expect(submitted?.status).toBe('completed')
      expect(submitted?.total_score).toBe(70)

      // ============================================
      // STEP 10: Generate Analytics
      // ============================================
      // Mock all services for analytics
      vi.mocked(classService.getByTeacher).mockResolvedValue({
        data: [classData],
        error: null,
      })

      vi.mocked(enrollmentService.getByClass).mockResolvedValue({
        data: [enrollmentData],
        error: null,
      })

      vi.mocked(examService.getByTeacher).mockResolvedValue({
        data: [examData],
        error: null,
      })

      vi.mocked(examService.getById).mockResolvedValue({
        data: examData,
        error: null,
      })

      vi.mocked(attemptService.getByExam).mockResolvedValue({
        data: [submittedAttempt],
        error: null,
      })

      vi.mocked(attemptService.getByStudent).mockResolvedValue({
        data: [submittedAttempt],
        error: null,
      })

      vi.mocked(attemptService.getByExams).mockResolvedValue({
        data: [submittedAttempt],
        error: null,
      })

      vi.mocked(answerService.getByAttempt).mockResolvedValue({
        data: evaluationResult.evaluatedAnswers,
        error: null,
      })

      vi.mocked(questionService.getByExam).mockResolvedValue({
        data: questionsWithOptions,
        error: null,
      })

      vi.mocked(assignmentService.getByClass).mockResolvedValue({
        data: [assignmentData],
        error: null,
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: studentId,
                    full_name: 'Test Student',
                    email: 'student@example.com',
                  },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      // Get teacher analytics
      const teacherAnalytics = await analyticsService.getTeacherAnalytics(teacherId)
      expect(teacherAnalytics.error).toBeNull()
      expect(teacherAnalytics.data).toBeDefined()
      expect(teacherAnalytics.data?.totalClasses).toBe(1)
      expect(teacherAnalytics.data?.totalStudents).toBe(1)
      expect(teacherAnalytics.data?.totalExams).toBe(1)
      expect(teacherAnalytics.data?.totalAttempts).toBe(1)
      expect(teacherAnalytics.data?.averageScore).toBe(70)
      expect(teacherAnalytics.data?.completionRate).toBe(100)

      // Get student analytics
      const studentAnalytics = await analyticsService.getStudentAnalytics(studentId)
      expect(studentAnalytics.error).toBeNull()
      expect(studentAnalytics.data).toBeDefined()
      expect(studentAnalytics.data?.totalAttempts).toBe(1)
      expect(studentAnalytics.data?.averageScore).toBe(70)
      expect(studentAnalytics.data?.completionRate).toBe(100)
      expect(studentAnalytics.data?.questionTypePerformance.mcq.correct).toBe(1)
      expect(studentAnalytics.data?.questionTypePerformance.mcq.total).toBe(2)
      expect(studentAnalytics.data?.questionTypePerformance.fib.correct).toBe(1)
      expect(studentAnalytics.data?.questionTypePerformance.fib.total).toBe(1)
    })

    it('should handle multiple students attempting the same exam', async () => {
      const examId = 'exam-multi'
      const classId = 'class-multi'
      const student1Id = 'student-1'
      const student2Id = 'student-2'
      const attempt1Id = 'attempt-1'
      const attempt2Id = 'attempt-2'

      // Setup exam and class
      const examData = {
        id: examId,
        teacher_id: teacherId,
        title: 'Multi-Student Test',
        total_marks: 100,
        is_published: true,
      }

      const classData = {
        id: classId,
        teacher_id: teacherId,
        name: 'Test Class',
      }

      // Mock services using vi.mocked for consistency
      vi.mocked(classService.getByTeacher).mockResolvedValue({
        data: [classData],
        error: null,
      })

      vi.mocked(enrollmentService.getByClass).mockResolvedValue({
        data: [
          { id: 'e1', class_id: classId, student_id: student1Id, status: 'active' },
          { id: 'e2', class_id: classId, student_id: student2Id, status: 'active' },
        ],
        error: null,
      })

      vi.mocked(examService.getByTeacher).mockResolvedValue({
        data: [examData],
        error: null,
      })

      vi.mocked(examService.getById).mockResolvedValue({
        data: examData,
        error: null,
      })

      const attempts = [
        {
          id: attempt1Id,
          exam_id: examId,
          student_id: student1Id,
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 85,
          status: 'completed' as const,
        },
        {
          id: attempt2Id,
          exam_id: examId,
          student_id: student2Id,
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 75,
          status: 'completed' as const,
        },
      ]

      vi.mocked(attemptService.getByExam).mockResolvedValue({
        data: attempts,
        error: null,
      })

      vi.mocked(attemptService.getByExams).mockResolvedValue({
        data: attempts,
        error: null,
      })

      // Mock getByStudent for studentProgress - called for each student
      vi.mocked(attemptService.getByStudent).mockImplementation((studentId: string) => {
        const studentAttempts = attempts.filter(a => a.student_id === studentId)
        return Promise.resolve({
          data: studentAttempts,
          error: null,
        })
      })

      vi.mocked(assignmentService.getByClass).mockResolvedValue({
        data: [{ id: 'a1', class_id: classId, exam_id: examId, is_active: true }],
        error: null,
      })

      // Mock supabase.from for profile queries
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { full_name: 'Test Student', email: 'test@example.com' },
                  error: null,
                }),
              }),
            }),
          } as any
        }
        return {} as any
      })

      // Get analytics
      const analytics = await analyticsService.getTeacherAnalytics(teacherId)

      expect(analytics.error).toBeNull()
      expect(analytics.data).toBeDefined()
      expect(analytics.data?.totalStudents).toBe(2)
      expect(analytics.data?.totalAttempts).toBe(2)
      expect(analytics.data?.averageScore).toBe(80) // (85 + 75) / 2
      expect(analytics.data?.completionRate).toBe(100)
    })

    it('should handle incomplete attempts in analytics', async () => {
      const examId = 'exam-incomplete'
      const attempt1Id = 'attempt-complete'
      const attempt2Id = 'attempt-incomplete'

      const examData = {
        id: examId,
        teacher_id: teacherId,
        title: 'Incomplete Test',
        total_marks: 100,
      }

      const attempts = [
        {
          id: attempt1Id,
          exam_id: examId,
          student_id: studentId,
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 80,
          status: 'completed' as const,
        },
        {
          id: attempt2Id,
          exam_id: examId,
          student_id: studentId,
          started_at: new Date().toISOString(),
          total_score: 0,
          status: 'in_progress' as const,
        },
      ]

      vi.spyOn(examService, 'getByTeacher').mockResolvedValue({
        data: [examData],
        error: null,
      })

      vi.spyOn(examService, 'getById').mockResolvedValue({
        data: examData,
        error: null,
      })

      vi.spyOn(attemptService, 'getByExam').mockResolvedValue({
        data: attempts,
        error: null,
      })

      vi.spyOn(attemptService, 'getByStudent').mockResolvedValue({
        data: attempts,
        error: null,
      })

      vi.spyOn(answerService, 'getByAttempt').mockResolvedValue({
        data: [],
        error: null,
      })

      vi.spyOn(questionService, 'getByExam').mockResolvedValue({
        data: [],
        error: null,
      })

      const analytics = await analyticsService.getStudentAnalytics(studentId)

      expect(analytics.error).toBeNull()
      expect(analytics.data).toBeDefined()
      expect(analytics.data?.totalAttempts).toBe(2)
      expect(analytics.data?.completionRate).toBe(50) // 1 completed out of 2
      expect(analytics.data?.averageScore).toBe(80) // Only completed attempts count
    })
  })
})

