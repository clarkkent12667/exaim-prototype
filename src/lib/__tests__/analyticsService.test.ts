import { describe, it, expect, vi, beforeEach } from 'vitest'
import { analyticsService } from '../analyticsService'
import { classService, enrollmentService, assignmentService } from '../classService'
import { examService, attemptService, answerService, questionService } from '../examService'
import { supabase } from '../supabase'

// Mock all dependencies
vi.mock('../classService')
vi.mock('../examService')
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTeacherAnalytics', () => {
    it('should return analytics with correct structure', async () => {
      const mockClasses = [
        { id: 'class1', name: 'Class A', teacher_id: 'teacher1' },
        { id: 'class2', name: 'Class B', teacher_id: 'teacher1' },
      ]

      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
        { id: 'e2', class_id: 'class1', student_id: 'student2', status: 'active' },
      ]

      const mockExams = [
        { id: 'exam1', title: 'Exam 1', teacher_id: 'teacher1', total_marks: 100 },
        { id: 'exam2', title: 'Exam 2', teacher_id: 'teacher1', total_marks: 100 },
      ]

      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 80,
          status: 'completed',
        },
        {
          id: 'attempt2',
          exam_id: 'exam1',
          student_id: 'student2',
          started_at: new Date().toISOString(),
          total_score: 0,
          status: 'in_progress',
        },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      // Mock getByClass to return enrollments for each class
      vi.mocked(enrollmentService.getByClass).mockImplementation((classId: string) => {
        if (classId === 'class1' || classId === 'class2') {
          return Promise.resolve({ data: mockEnrollments, error: null })
        }
        return Promise.resolve({ data: [], error: null })
      })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: mockExams, error: null })
      // Mock getByExam to return attempts for each exam - return 1 attempt per exam
      vi.mocked(attemptService.getByExam).mockImplementation((examId: string) => {
        // Return 1 attempt per exam to get total of 2 attempts for 2 exams
        const examAttempt = examId === 'exam1' 
          ? [mockAttempts[0]] 
          : [mockAttempts[1]]
        return Promise.resolve({ data: examAttempt, error: null })
      })
      // Mock getByStudent for studentProgress
      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      // Mock getByClass for assignmentService - called for each class in classPerformance loop
      vi.mocked(assignmentService.getByClass).mockImplementation((classId: string) => {
        return Promise.resolve({ data: [], error: null })
      })
      
      // Mock supabase.from for profile queries - need to handle multiple calls
      // The service calls supabase.from('profiles') multiple times
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

      let result
      try {
        result = await analyticsService.getTeacherAnalytics('teacher1')
      } catch (error: any) {
        // If there's an error, check what went wrong
        console.error('Error in test:', error)
        throw error
      }

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.totalClasses).toBe(2)
      expect(result.data?.totalStudents).toBe(2)
      expect(result.data?.totalExams).toBe(2)
      expect(result.data?.totalAttempts).toBe(2)
      expect(result.data?.averageScore).toBe(80)
      expect(result.data?.completionRate).toBe(50)
    })

    it('should handle empty data gracefully', async () => {
      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: [], error: null })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: [], error: null })

      const result = await analyticsService.getTeacherAnalytics('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.totalClasses).toBe(0)
      expect(result.data?.totalStudents).toBe(0)
      expect(result.data?.totalExams).toBe(0)
      expect(result.data?.totalAttempts).toBe(0)
      expect(result.data?.averageScore).toBe(0)
      expect(result.data?.completionRate).toBe(0)
    })

    it('should filter by classId when provided', async () => {
      const mockClasses = [
        { id: 'class1', name: 'Class A', teacher_id: 'teacher1' },
        { id: 'class2', name: 'Class B', teacher_id: 'teacher1' },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: [], error: null })
      vi.mocked(enrollmentService.getByClass).mockResolvedValue({ data: [], error: null })
      vi.mocked(assignmentService.getByClass).mockResolvedValue({ data: [], error: null })

      const result = await analyticsService.getTeacherAnalytics('teacher1', 'class1')

      expect(result.error).toBeNull()
      expect(result.data?.totalClasses).toBe(1)
    })

    it('should filter by dateRange when provided', async () => {
      const mockClasses = [{ id: 'class1', name: 'Class A', teacher_id: 'teacher1' }]
      const mockExams = [{ id: 'exam1', title: 'Exam 1', teacher_id: 'teacher1', total_marks: 100 }]
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date('2024-01-15').toISOString(),
          submitted_at: new Date('2024-01-15').toISOString(),
          total_score: 80,
          status: 'completed',
        },
        {
          id: 'attempt2',
          exam_id: 'exam1',
          student_id: 'student2',
          started_at: new Date('2024-02-15').toISOString(),
          submitted_at: new Date('2024-02-15').toISOString(),
          total_score: 90,
          status: 'completed',
        },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      vi.mocked(enrollmentService.getByClass).mockResolvedValue({ data: [], error: null })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: mockExams, error: null })
      vi.mocked(attemptService.getByExam).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(assignmentService.getByClass).mockResolvedValue({ data: [], error: null })

      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      }

      const result = await analyticsService.getTeacherAnalytics('teacher1', undefined, dateRange)

      expect(result.data?.totalAttempts).toBe(1)
      expect(result.data?.averageScore).toBe(80)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(classService.getByTeacher).mockRejectedValue(new Error('Database error'))

      const result = await analyticsService.getTeacherAnalytics('teacher1')

      expect(result.error).toBeDefined()
      expect(result.data).toBeNull()
    })
  })

  describe('getStudentAnalytics', () => {
    it('should return analytics for student with attempts', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 80,
          status: 'completed',
        },
        {
          id: 'attempt2',
          exam_id: 'exam2',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 90,
          status: 'completed',
        },
      ]

      const mockExam = {
        id: 'exam1',
        title: 'Test Exam',
        total_marks: 100,
      }

      const mockQuestions = [
        {
          id: 'q1',
          exam_id: 'exam1',
          question_type: 'mcq',
          marks: 10,
        },
        {
          id: 'q2',
          exam_id: 'exam1',
          question_type: 'fib',
          marks: 10,
        },
      ]

      const mockAnswers = [
        {
          id: 'a1',
          attempt_id: 'attempt1',
          question_id: 'q1',
          is_correct: true,
          score: 10,
        },
        {
          id: 'a2',
          attempt_id: 'attempt1',
          question_id: 'q2',
          is_correct: false,
          score: 0,
        },
      ]

      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(examService.getById).mockResolvedValue({ data: mockExam, error: null })
      vi.mocked(answerService.getByAttempt).mockResolvedValue({ data: mockAnswers, error: null })
      vi.mocked(questionService.getByExam).mockResolvedValue({ data: mockQuestions, error: null })

      const result = await analyticsService.getStudentAnalytics('student1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.totalAttempts).toBe(2)
      expect(result.data?.averageScore).toBe(85)
      expect(result.data?.completionRate).toBe(100)
      // Both attempts have MCQ questions, so correct count is 2 (one correct per attempt)
      expect(result.data?.questionTypePerformance.mcq.correct).toBe(2)
      expect(result.data?.questionTypePerformance.mcq.total).toBe(2)
    })

    it('should return empty analytics for student with no attempts', async () => {
      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: [], error: null })

      const result = await analyticsService.getStudentAnalytics('student1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.totalAttempts).toBe(0)
      expect(result.data?.averageScore).toBe(0)
      expect(result.data?.completionRate).toBe(0)
      expect(result.data?.scoreTrend).toEqual([])
    })

    it('should calculate strengths and weaknesses correctly', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 80,
          status: 'completed',
        },
      ]

      const mockExam = { id: 'exam1', title: 'Test', total_marks: 100 }
      const mockQuestions = [
        { id: 'q1', exam_id: 'exam1', question_type: 'mcq', marks: 10 },
        { id: 'q2', exam_id: 'exam1', question_type: 'fib', marks: 10 },
        { id: 'q3', exam_id: 'exam1', question_type: 'open_ended', marks: 10 },
      ]

      const mockAnswers = [
        { id: 'a1', attempt_id: 'attempt1', question_id: 'q1', is_correct: true, score: 10 },
        { id: 'a2', attempt_id: 'attempt1', question_id: 'q2', is_correct: false, score: 0 },
        { id: 'a3', attempt_id: 'attempt1', question_id: 'q3', is_correct: false, score: 3 },
      ]

      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(examService.getById).mockResolvedValue({ data: mockExam, error: null })
      vi.mocked(answerService.getByAttempt).mockResolvedValue({ data: mockAnswers, error: null })
      vi.mocked(questionService.getByExam).mockResolvedValue({ data: mockQuestions, error: null })

      const result = await analyticsService.getStudentAnalytics('student1')

      expect(result.data?.strengths).toContain('Multiple Choice Questions')
      expect(result.data?.weaknesses.length).toBeGreaterThan(0)
    })

    it('should filter by dateRange when provided', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date('2024-01-15').toISOString(),
          submitted_at: new Date('2024-01-15').toISOString(),
          total_score: 80,
          status: 'completed',
        },
        {
          id: 'attempt2',
          exam_id: 'exam2',
          student_id: 'student1',
          started_at: new Date('2024-02-15').toISOString(),
          submitted_at: new Date('2024-02-15').toISOString(),
          total_score: 90,
          status: 'completed',
        },
      ]

      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(examService.getById).mockResolvedValue({ data: { id: 'exam1', title: 'Test', total_marks: 100 }, error: null })
      vi.mocked(answerService.getByAttempt).mockResolvedValue({ data: [], error: null })
      vi.mocked(questionService.getByExam).mockResolvedValue({ data: [], error: null })

      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      }

      const result = await analyticsService.getStudentAnalytics('student1', dateRange)

      expect(result.data?.totalAttempts).toBe(1)
      expect(result.data?.averageScore).toBe(80)
    })
  })

  describe('getGradesHeatMapData', () => {
    it('should return heat map data with students and exams', async () => {
      const mockClasses = [{ id: 'class1', name: 'Class A', teacher_id: 'teacher1' }]
      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
      ]
      const mockExams = [
        { id: 'exam1', title: 'Exam 1', teacher_id: 'teacher1', total_marks: 100 },
      ]
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 80,
          status: 'completed',
        },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      vi.mocked(enrollmentService.getByClass).mockResolvedValue({ data: mockEnrollments, error: null })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: mockExams, error: null })
      vi.mocked(attemptService.getByExams).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'student1', full_name: 'Test Student', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await analyticsService.getGradesHeatMapData('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.students.length).toBe(1)
      expect(result.data?.exams.length).toBe(1)
      expect(result.data?.cells.length).toBe(1)
      expect(result.data?.cells[0].score).toBe(80)
      expect(result.data?.cells[0].percentage).toBe(80)
    })

    it('should filter by subjectId and examBoardId when provided', async () => {
      const mockClasses = [{ id: 'class1', name: 'Class A', teacher_id: 'teacher1' }]
      const mockExams = [
        { id: 'exam1', title: 'Exam 1', teacher_id: 'teacher1', total_marks: 100, subject_id: 'subject1' },
        { id: 'exam2', title: 'Exam 2', teacher_id: 'teacher1', total_marks: 100, subject_id: 'subject2' },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      vi.mocked(enrollmentService.getByClass).mockResolvedValue({ data: [], error: null })
      vi.mocked(examService.getByTeacher).mockResolvedValue({ data: mockExams, error: null })
      vi.mocked(attemptService.getByExams).mockResolvedValue({ data: [], error: null })

      const result = await analyticsService.getGradesHeatMapData('teacher1', undefined, undefined, 'subject1')

      expect(result.data?.exams.length).toBe(1)
      expect(result.data?.exams[0].id).toBe('exam1')
    })
  })

  describe('getInterventionData', () => {
    it('should return intervention data for students', async () => {
      const mockClasses = [{ id: 'class1', name: 'Class A', teacher_id: 'teacher1' }]
      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
      ]
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          total_score: 70,
          status: 'completed',
        },
      ]

      vi.mocked(classService.getByTeacher).mockResolvedValue({ data: mockClasses, error: null })
      vi.mocked(enrollmentService.getByClass).mockResolvedValue({ data: mockEnrollments, error: null })
      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { full_name: 'Test Student', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await analyticsService.getInterventionData('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.length).toBe(1)
      expect(result.data?.[0].average_score).toBe(70)
      expect(result.data?.[0].time_spent_minutes).toBeCloseTo(30, 0)
    })
  })

  describe('getStudentGradesHeatMap', () => {
    it('should return heat map data for a single student', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          started_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          total_score: 85,
          status: 'completed',
        },
      ]

      const mockExam = {
        id: 'exam1',
        title: 'Test Exam',
        total_marks: 100,
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'student1', full_name: 'Test Student', email: 'test@example.com' },
              error: null,
            }),
          }),
        }),
      } as any)
      vi.mocked(attemptService.getByStudent).mockResolvedValue({ data: mockAttempts, error: null })
      vi.mocked(examService.getById).mockResolvedValue({ data: mockExam, error: null })

      const result = await analyticsService.getStudentGradesHeatMap('student1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.student.id).toBe('student1')
      expect(result.data?.exams.length).toBe(1)
      expect(result.data?.cells.length).toBe(1)
      expect(result.data?.cells[0].percentage).toBe(85)
    })

    it('should handle student with no profile', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      } as any)

      const result = await analyticsService.getStudentGradesHeatMap('student1')

      expect(result.data?.student.name).toBe('Unknown')
    })
  })
})

