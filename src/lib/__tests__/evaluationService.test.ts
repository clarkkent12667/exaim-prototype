import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluationService } from '../evaluationService'
import type { Question, QuestionOption, StudentAnswer } from '../examService'

// Mock supabase
const mockGetSession = vi.fn()
const mockInvoke = vi.fn()

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
    functions: {
      invoke: (name: string, options: any) => mockInvoke(name, options),
    },
  },
}))

describe('evaluationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: authenticated
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'mock-token' } },
    })
  })

  describe('evaluateMCQ', () => {
    it('should mark MCQ as correct when student selects the correct option by ID', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
      }

      const options: QuestionOption[] = [
        { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
        { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
        { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
        { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
      ]

      const result = await evaluationService.evaluateMCQ(question, 'opt2', options)
      expect(result.is_correct).toBe(true)
      expect(result.score).toBe(10)
    })

    it('should mark MCQ as incorrect when student selects wrong option', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
      }

      const options: QuestionOption[] = [
        { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
        { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
        { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
        { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
      ]

      const result = await evaluationService.evaluateMCQ(question, 'opt1', options)
      expect(result.is_correct).toBe(false)
      expect(result.score).toBe(0)
    })

    it('should mark MCQ as correct when student selects by letter (A, B, C, D)', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
      }

      const options: QuestionOption[] = [
        { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
        { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
        { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
        { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
      ]

      // B is the correct answer (index 1)
      const result = await evaluationService.evaluateMCQ(question, 'B', options)
      expect(result.is_correct).toBe(true)
      expect(result.score).toBe(10)
    })

    it('should return incorrect when no correct option exists', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
      }

      const options: QuestionOption[] = [
        { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
        { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: false, order_index: 1 },
      ]

      const result = await evaluationService.evaluateMCQ(question, 'opt1', options)
      expect(result.is_correct).toBe(false)
      expect(result.score).toBe(0)
    })
  })

  describe('evaluateFIB', () => {
    it('should mark FIB as correct for exact match (case-insensitive)', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'The capital of England is [blank].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London is the capital',
        correct_answer: 'London',
      }

      const result = await evaluationService.evaluateFIB(question, 'London')
      expect(result.is_correct).toBe(true)
      expect(result.score).toBe(10)
    })

    it('should mark FIB as correct ignoring whitespace', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'The capital of England is [blank].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London is the capital',
        correct_answer: 'London',
      }

      const result = await evaluationService.evaluateFIB(question, '  London  ')
      expect(result.is_correct).toBe(true)
      expect(result.score).toBe(10)
    })

    it('should mark FIB as incorrect when answer is wrong', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'The capital of England is [blank].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London is the capital',
        correct_answer: 'London',
      }

      const result = await evaluationService.evaluateFIB(question, 'Paris')
      expect(result.is_correct).toBe(false)
      expect(result.score).toBe(0)
    })

    it('should give partial credit when 70%+ of key terms match', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'The answer is [blank].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London England capital',
        correct_answer: 'London England capital city',
      }

      // "London England capital" matches 3 out of 4 key terms (75%)
      const result = await evaluationService.evaluateFIB(question, 'London England capital')
      expect(result.is_correct).toBe(true)
      expect(result.score).toBeGreaterThan(0)
    })

    it('should return incorrect when no correct_answer is provided', async () => {
      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'The answer is [blank].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'No answer',
      }

      const result = await evaluationService.evaluateFIB(question, 'London')
      expect(result.is_correct).toBe(false)
      expect(result.score).toBe(0)
    })
  })

  describe('evaluateOpenEnded', () => {
    it('should call Supabase function and return evaluation', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          score: 7.5,
          feedback: 'Good answer with some areas for improvement.',
          evaluation_metadata: {
            accuracy: 75,
            completeness: 80,
            relevance: 70,
          },
        },
      })

      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'Explain the process of photosynthesis.',
        question_type: 'open_ended',
        marks: 10,
        model_answer: 'Photosynthesis is the process by which plants convert light energy into chemical energy.',
      }

      const result = await evaluationService.evaluateOpenEnded(
        question,
        'Photosynthesis is when plants use sunlight to make food.'
      )

      expect(mockInvoke).toHaveBeenCalledWith('evaluate-open-ended', {
        body: {
          question_text: question.question_text,
          model_answer: question.model_answer,
          student_answer: 'Photosynthesis is when plants use sunlight to make food.',
          max_marks: 10,
        },
      })

      expect(result.score).toBe(7.5)
      expect(result.ai_evaluation).toBeDefined()
      expect(result.ai_evaluation.feedback).toBe('Good answer with some areas for improvement.')
      expect(result.ai_evaluation.evaluation_metadata.accuracy).toBe(75)
    })

    it('should throw error when not authenticated', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
      })

      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'Explain photosynthesis.',
        question_type: 'open_ended',
        marks: 10,
        model_answer: 'Answer',
      }

      await expect(
        evaluationService.evaluateOpenEnded(question, 'Student answer')
      ).rejects.toThrow('Not authenticated')
    })

    it('should handle API errors gracefully', async () => {
      mockInvoke.mockResolvedValue({
        error: { message: 'API error' },
      })

      const question: Question = {
        id: 'q1',
        exam_id: 'exam1',
        question_text: 'Explain photosynthesis.',
        question_type: 'open_ended',
        marks: 10,
        model_answer: 'Answer',
      }

      await expect(
        evaluationService.evaluateOpenEnded(question, 'Student answer')
      ).rejects.toThrow('API error')
    })
  })

  describe('evaluateAllAnswers', () => {
    it('should evaluate all question types correctly', async () => {
      mockInvoke.mockResolvedValue({
        data: {
          score: 8,
          feedback: 'Good answer',
          evaluation_metadata: { accuracy: 80, completeness: 80, relevance: 80 },
        },
      })

      const questions = [
        {
          id: 'q1',
          exam_id: 'exam1',
          question_text: 'What is 2 + 2?',
          question_type: 'mcq' as const,
          marks: 10,
          model_answer: '4',
          options: [
            { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
            { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
            { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
            { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
          ],
        },
        {
          id: 'q2',
          exam_id: 'exam1',
          question_text: 'The capital of England is [blank].',
          question_type: 'fib' as const,
          marks: 10,
          model_answer: 'London',
          correct_answer: 'London',
        },
        {
          id: 'q3',
          exam_id: 'exam1',
          question_text: 'Explain photosynthesis.',
          question_type: 'open_ended' as const,
          marks: 10,
          model_answer: 'Full answer',
        },
      ]

      const answers: StudentAnswer[] = [
        {
          id: 'a1',
          attempt_id: 'attempt1',
          question_id: 'q1',
          answer_text: 'opt2',
          score: 0,
        },
        {
          id: 'a2',
          attempt_id: 'attempt1',
          question_id: 'q2',
          answer_text: 'London',
          score: 0,
        },
        {
          id: 'a3',
          attempt_id: 'attempt1',
          question_id: 'q3',
          answer_text: 'Student answer',
          score: 0,
        },
      ]

      const result = await evaluationService.evaluateAllAnswers(questions, answers)

      expect(result.evaluatedAnswers).toHaveLength(3)
      expect(result.totalScore).toBe(28) // 10 (MCQ) + 10 (FIB) + 8 (Open-ended)

      // Check MCQ evaluation
      const mcqAnswer = result.evaluatedAnswers.find(a => a.question_id === 'q1')
      expect(mcqAnswer?.is_correct).toBe(true)
      expect(mcqAnswer?.score).toBe(10)

      // Check FIB evaluation
      const fibAnswer = result.evaluatedAnswers.find(a => a.question_id === 'q2')
      expect(fibAnswer?.is_correct).toBe(true)
      expect(fibAnswer?.score).toBe(10)

      // Check Open-ended evaluation
      const openEndedAnswer = result.evaluatedAnswers.find(a => a.question_id === 'q3')
      expect(openEndedAnswer?.score).toBe(8)
      expect(openEndedAnswer?.ai_evaluation).toBeDefined()
      expect(openEndedAnswer?.evaluated_at).toBeDefined()
    })

    it('should skip questions without answers', async () => {
      const questions = [
        {
          id: 'q1',
          exam_id: 'exam1',
          question_text: 'What is 2 + 2?',
          question_type: 'mcq' as const,
          marks: 10,
          model_answer: '4',
          options: [
            { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
            { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
            { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
            { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
          ],
        },
        {
          id: 'q2',
          exam_id: 'exam1',
          question_text: 'Another question?',
          question_type: 'mcq' as const,
          marks: 10,
          model_answer: 'Answer',
          options: [
            { id: 'opt5', question_id: 'q2', option_text: 'A', is_correct: true, order_index: 0 },
            { id: 'opt6', question_id: 'q2', option_text: 'B', is_correct: false, order_index: 1 },
            { id: 'opt7', question_id: 'q2', option_text: 'C', is_correct: false, order_index: 2 },
            { id: 'opt8', question_id: 'q2', option_text: 'D', is_correct: false, order_index: 3 },
          ],
        },
      ]

      const answers: StudentAnswer[] = [
        {
          id: 'a1',
          attempt_id: 'attempt1',
          question_id: 'q1',
          answer_text: 'opt2',
          score: 0,
        },
        // q2 has no answer
      ]

      const result = await evaluationService.evaluateAllAnswers(questions, answers)

      expect(result.evaluatedAnswers).toHaveLength(1)
      expect(result.evaluatedAnswers[0].question_id).toBe('q1')
    })

    it('should handle empty answers array', async () => {
      const questions = [
        {
          id: 'q1',
          exam_id: 'exam1',
          question_text: 'What is 2 + 2?',
          question_type: 'mcq' as const,
          marks: 10,
          model_answer: '4',
          options: [
            { id: 'opt1', question_id: 'q1', option_text: '3', is_correct: false, order_index: 0 },
            { id: 'opt2', question_id: 'q1', option_text: '4', is_correct: true, order_index: 1 },
            { id: 'opt3', question_id: 'q1', option_text: '5', is_correct: false, order_index: 2 },
            { id: 'opt4', question_id: 'q1', option_text: '6', is_correct: false, order_index: 3 },
          ],
        },
      ]

      const answers: StudentAnswer[] = []

      const result = await evaluationService.evaluateAllAnswers(questions, answers)

      expect(result.evaluatedAnswers).toHaveLength(0)
      expect(result.totalScore).toBe(0)
    })
  })
})
