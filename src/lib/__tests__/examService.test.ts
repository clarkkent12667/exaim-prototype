import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  examService,
  questionService,
  attemptService,
  answerService,
  statisticsService,
} from '../examService'
import { supabase } from '../supabase'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('examService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create a new exam', async () => {
      const mockExam = {
        id: 'exam1',
        teacher_id: 'teacher1',
        title: 'Test Exam',
        qualification_id: 'qual1',
        exam_board_id: 'board1',
        subject_id: 'subject1',
        difficulty: 'medium' as const,
        is_published: false,
        total_marks: 100,
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockExam, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await examService.create({
        teacher_id: 'teacher1',
        title: 'Test Exam',
        qualification_id: 'qual1',
        exam_board_id: 'board1',
        subject_id: 'subject1',
        difficulty: 'medium',
        is_published: false,
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockExam)
    })
  })

  describe('getById', () => {
    it('should get exam by id', async () => {
      const mockExam = {
        id: 'exam1',
        title: 'Test Exam',
        teacher_id: 'teacher1',
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockExam, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await examService.getById('exam1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockExam)
    })
  })

  describe('getByTeacher', () => {
    it('should get all exams for a teacher', async () => {
      const mockExams = [
        { id: 'exam1', teacher_id: 'teacher1', title: 'Exam 1' },
        { id: 'exam2', teacher_id: 'teacher1', title: 'Exam 2' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockExams, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await examService.getByTeacher('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockExams)
    })
  })

  describe('getPublished', () => {
    it('should get all published exams', async () => {
      const mockExams = [
        { id: 'exam1', title: 'Published Exam 1', is_published: true },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockExams, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await examService.getPublished()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockExams)
    })
  })

  describe('update', () => {
    it('should update an exam', async () => {
      const updatedExam = {
        id: 'exam1',
        title: 'Updated Exam',
        teacher_id: 'teacher1',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedExam, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await examService.update('exam1', { title: 'Updated Exam' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedExam)
    })
  })

  describe('delete', () => {
    it('should delete an exam', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await examService.delete('exam1')

      expect(result.error).toBeNull()
    })
  })

  describe('publish', () => {
    it('should publish an exam', async () => {
      vi.spyOn(examService, 'update').mockResolvedValue({
        data: { id: 'exam1', is_published: true },
        error: null,
      })

      const result = await examService.publish('exam1')

      expect(result.error).toBeNull()
      expect(examService.update).toHaveBeenCalledWith('exam1', { is_published: true })
    })
  })

  describe('unpublish', () => {
    it('should unpublish an exam', async () => {
      vi.spyOn(examService, 'update').mockResolvedValue({
        data: { id: 'exam1', is_published: false },
        error: null,
      })

      const result = await examService.unpublish('exam1')

      expect(result.error).toBeNull()
      expect(examService.update).toHaveBeenCalledWith('exam1', { is_published: false })
    })
  })
})

describe('questionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getByExam', () => {
    it('should get all questions for an exam', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          exam_id: 'exam1',
          question_text: 'What is 2+2?',
          question_type: 'mcq' as const,
          marks: 10,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockQuestions, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await questionService.getByExam('exam1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQuestions)
    })
  })

  describe('create', () => {
    it('should create a new question', async () => {
      const mockQuestion = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'Test Question',
        question_type: 'mcq' as const,
        marks: 10,
        model_answer: 'Answer',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockQuestion, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await questionService.create({
        exam_id: 'exam1',
        question_text: 'Test Question',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'Answer',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQuestion)
    })
  })

  describe('createWithOptions', () => {
    it('should create a question with options', async () => {
      const mockQuestion = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'Test Question',
        question_type: 'mcq' as const,
        marks: 10,
        model_answer: 'Answer',
      }

      const mockOptions = [
        { option_text: 'Option 1', is_correct: true, order_index: 0 },
        { option_text: 'Option 2', is_correct: false, order_index: 1 },
      ]

      vi.spyOn(questionService, 'create').mockResolvedValue({
        data: mockQuestion,
        error: null,
      })

      const mockInsert = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'question_options') {
          return { insert: mockInsert } as any
        }
        return {} as any
      })

      const result = await questionService.createWithOptions(
        {
          exam_id: 'exam1',
          question_text: 'Test Question',
          question_type: 'mcq',
          marks: 10,
          model_answer: 'Answer',
        },
        mockOptions
      )

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQuestion)
    })
  })

  describe('update', () => {
    it('should update a question', async () => {
      const updatedQuestion = {
        id: 'q1',
        question_text: 'Updated Question',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedQuestion, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await questionService.update('q1', { question_text: 'Updated Question' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedQuestion)
    })
  })

  describe('delete', () => {
    it('should delete a question', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await questionService.delete('q1')

      expect(result.error).toBeNull()
    })
  })

  describe('getOptions', () => {
    it('should get options for a question', async () => {
      const mockOptions = [
        { id: 'opt1', question_id: 'q1', option_text: 'Option 1', is_correct: true, order_index: 0 },
        { id: 'opt2', question_id: 'q1', option_text: 'Option 2', is_correct: false, order_index: 1 },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockOptions, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await questionService.getOptions('q1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockOptions)
    })
  })

  describe('updateOptions', () => {
    it('should update options for a question', async () => {
      const mockOptions = [
        { option_text: 'New Option 1', is_correct: true, order_index: 0 },
        { option_text: 'New Option 2', is_correct: false, order_index: 1 },
      ]

      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      const mockInsert = vi.fn().mockResolvedValue({ error: null })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'question_options') {
          return {
            delete: mockDelete,
            insert: mockInsert,
          } as any
        }
        return {} as any
      })

      const result = await questionService.updateOptions('q1', mockOptions)

      expect(result.error).toBeNull()
    })
  })
})

describe('attemptService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create a new attempt', async () => {
      const mockAttempt = {
        id: 'attempt1',
        exam_id: 'exam1',
        student_id: 'student1',
        started_at: new Date().toISOString(),
        status: 'in_progress' as const,
        total_score: 0,
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAttempt, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await attemptService.create({
        exam_id: 'exam1',
        student_id: 'student1',
      })

      expect(result.error).toBeNull()
      expect(result.data?.status).toBe('in_progress')
      expect(result.data?.total_score).toBe(0)
    })
  })

  describe('getByStudent', () => {
    it('should get all attempts for a student', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          status: 'completed' as const,
          total_score: 80,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockAttempts, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await attemptService.getByStudent('student1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAttempts)
    })
  })

  describe('getByExam', () => {
    it('should get all attempts for an exam', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          status: 'completed' as const,
          total_score: 80,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockAttempts, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await attemptService.getByExam('exam1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAttempts)
    })
  })

  describe('getByExams', () => {
    it('should get attempts for multiple exams', async () => {
      const mockAttempts = [
        {
          id: 'attempt1',
          exam_id: 'exam1',
          student_id: 'student1',
          status: 'completed' as const,
          total_score: 80,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockAttempts, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await attemptService.getByExams(['exam1', 'exam2'])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAttempts)
    })

    it('should return empty array for empty examIds', async () => {
      const result = await attemptService.getByExams([])

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })
  })

  describe('submit', () => {
    it('should submit an attempt', async () => {
      vi.spyOn(attemptService, 'update').mockResolvedValue({
        data: {
          id: 'attempt1',
          status: 'completed' as const,
          submitted_at: new Date().toISOString(),
        },
        error: null,
      })

      const result = await attemptService.submit('attempt1')

      expect(result.error).toBeNull()
      expect(attemptService.update).toHaveBeenCalledWith('attempt1', {
        status: 'completed',
        submitted_at: expect.any(String),
      })
    })
  })
})

describe('answerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveAnswer', () => {
    it('should save an answer', async () => {
      const mockAnswer = {
        id: 'answer1',
        attempt_id: 'attempt1',
        question_id: 'q1',
        answer_text: 'Answer',
        score: 10,
      }

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAnswer, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
      } as any)

      const result = await answerService.saveAnswer({
        attempt_id: 'attempt1',
        question_id: 'q1',
        answer_text: 'Answer',
        score: 10,
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAnswer)
    })
  })

  describe('getByAttempt', () => {
    it('should get all answers for an attempt', async () => {
      const mockAnswers = [
        {
          id: 'answer1',
          attempt_id: 'attempt1',
          question_id: 'q1',
          answer_text: 'Answer 1',
          score: 10,
        },
        {
          id: 'answer2',
          attempt_id: 'attempt1',
          question_id: 'q2',
          answer_text: 'Answer 2',
          score: 8,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: mockAnswers, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await answerService.getByAttempt('attempt1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAnswers)
    })
  })

  describe('update', () => {
    it('should update an answer', async () => {
      const updatedAnswer = {
        id: 'answer1',
        score: 15,
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedAnswer, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await answerService.update('answer1', { score: 15 })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedAnswer)
    })
  })
})

describe('statisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createOrUpdate', () => {
    it('should create or update statistics', async () => {
      const mockStats = {
        id: 'stats1',
        attempt_id: 'attempt1',
        correct_count: 8,
        incorrect_count: 2,
        partially_correct_count: 0,
        skipped_count: 0,
        total_questions: 10,
      }

      const mockUpsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert,
      } as any)

      const result = await statisticsService.createOrUpdate({
        attempt_id: 'attempt1',
        correct_count: 8,
        incorrect_count: 2,
        partially_correct_count: 0,
        skipped_count: 0,
        total_questions: 10,
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockStats)
    })
  })

  describe('getByAttempt', () => {
    it('should get statistics for an attempt', async () => {
      const mockStats = {
        id: 'stats1',
        attempt_id: 'attempt1',
        correct_count: 8,
        incorrect_count: 2,
        total_questions: 10,
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockStats, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await statisticsService.getByAttempt('attempt1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockStats)
    })
  })
})

