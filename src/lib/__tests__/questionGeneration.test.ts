import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  validateRequest,
  buildContext,
  calculateMarks,
  parseOpenAIResponse,
  processMCQQuestions,
  processFIBQuestions,
  processOpenEndedQuestions,
  buildMCQPrompt,
  buildFIBPrompt,
  buildOpenEndedPrompt,
  validateGeneratedQuestion,
  type QuestionGenerationRequest,
  type GeneratedQuestion,
} from '../questionGeneration'

describe('Question Generation for GCSE', () => {
  describe('validateRequest', () => {
    it('should validate a valid GCSE request', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: {
          mcq: 5,
          fib: 3,
          open_ended: 2,
        },
      }

      const result = validateRequest(request)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject request with missing qualification', () => {
      const request = {
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      } as any

      const result = validateRequest(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('qualification')
    })

    it('should reject request with empty qualification', () => {
      const request: QuestionGenerationRequest = {
        qualification: '',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      }

      const result = validateRequest(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('qualification')
    })

    it('should reject request with missing exam_board', () => {
      const request = {
        qualification: 'GCSE',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      } as any

      const result = validateRequest(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('exam_board')
    })

    it('should reject request with invalid difficulty', () => {
      const request = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'very_hard',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      } as any

      const result = validateRequest(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('difficulty')
    })

    it('should reject request with invalid question_counts', () => {
      const request = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: { mcq: '5', fib: 3, open_ended: 2 },
      } as any

      const result = validateRequest(request)
      expect(result.valid).toBe(false)
      expect(result.error).toContain('question_counts')
    })
  })

  describe('buildContext', () => {
    it('should build context for GCSE without topic/subtopic', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      }

      const context = buildContext(request)
      expect(context).toContain('GCSE')
      expect(context).toContain('AQA')
      expect(context).toContain('Mathematics')
      expect(context).toContain('medium')
      expect(context).not.toContain('Topic:')
      expect(context).not.toContain('Subtopic:')
    })

    it('should build context for GCSE with topic', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        topic: 'Algebra',
        difficulty: 'hard',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      }

      const context = buildContext(request)
      expect(context).toContain('GCSE')
      expect(context).toContain('AQA')
      expect(context).toContain('Mathematics')
      expect(context).toContain('Algebra')
      expect(context).toContain('hard')
    })

    it('should build context for GCSE with topic and subtopic', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'Edexcel',
        subject: 'Physics',
        topic: 'Mechanics',
        subtopic: 'Forces',
        difficulty: 'easy',
        question_counts: { mcq: 5, fib: 3, open_ended: 2 },
      }

      const context = buildContext(request)
      expect(context).toContain('GCSE')
      expect(context).toContain('Edexcel')
      expect(context).toContain('Physics')
      expect(context).toContain('Mechanics')
      expect(context).toContain('Forces')
      expect(context).toContain('easy')
    })
  })

  describe('calculateMarks', () => {
    it('should calculate marks evenly for 10 questions', () => {
      const result = calculateMarks(10)
      expect(result.baseMarks).toBe(10)
      expect(result.totalQuestions).toBe(10)
      // With 10 questions, each gets 10 marks, total = 100, so no adjustment needed
      expect(result.adjustment).toBe(0)
    })

    it('should calculate marks evenly for 5 questions', () => {
      const result = calculateMarks(5)
      expect(result.baseMarks).toBe(20)
      expect(result.totalQuestions).toBe(5)
      // With 5 questions, each gets 20 marks, total = 100, so no adjustment needed
      expect(result.adjustment).toBe(0)
    })

    it('should handle zero questions', () => {
      const result = calculateMarks(0)
      expect(result.baseMarks).toBe(0)
      expect(result.adjustment).toBe(0)
      expect(result.totalQuestions).toBe(0)
    })

    it('should calculate marks and adjustment for GCSE exam with 12 questions', () => {
      const result = calculateMarks(12)
      // 100 / 12 = 8.333... -> rounded to 8.3
      expect(result.baseMarks).toBeCloseTo(8.3, 1)
      // 8.3 * 12 = 99.6, so adjustment should be 0.4 to make it exactly 100
      expect(result.adjustment).toBeCloseTo(0.4, 1)
      expect(result.totalQuestions).toBe(12)
      // Verify total: baseMarks * 11 + (baseMarks + adjustment) * 1 = 100
      expect(result.baseMarks * 11 + (result.baseMarks + result.adjustment)).toBeCloseTo(100, 1)
    })

    it('should ensure total marks equals exactly 100', () => {
      const testCases = [3, 7, 12, 15, 20]
      testCases.forEach(total => {
        const result = calculateMarks(total)
        // Total should be: (baseMarks * (total - 1)) + (baseMarks + adjustment)
        const calculatedTotal = result.baseMarks * (total - 1) + (result.baseMarks + result.adjustment)
        expect(calculatedTotal).toBeCloseTo(100, 1)
      })
    })
  })

  describe('parseOpenAIResponse', () => {
    it('should parse clean JSON', () => {
      const json = '[{"question_text": "Test?"}]'
      const result = parseOpenAIResponse(json)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].question_text).toBe('Test?')
    })

    it('should parse JSON with markdown code blocks', () => {
      const json = '```json\n[{"question_text": "Test?"}]\n```'
      const result = parseOpenAIResponse(json)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].question_text).toBe('Test?')
    })

    it('should parse JSON with leading/trailing whitespace', () => {
      const json = '   [{"question_text": "Test?"}]   '
      const result = parseOpenAIResponse(json)
      expect(Array.isArray(result)).toBe(true)
      expect(result[0].question_text).toBe('Test?')
    })
  })

  describe('processMCQQuestions', () => {
    it('should process valid GCSE MCQ questions', () => {
      const mcqJson = [
        {
          question_text: 'What is 2 + 2?',
          options: [
            { option_text: '3', is_correct: false },
            { option_text: '4', is_correct: true },
            { option_text: '5', is_correct: false },
            { option_text: '6', is_correct: false },
          ],
          model_answer: 'The correct answer is 4 because 2 + 2 = 4',
        },
      ]

      const questions = processMCQQuestions(mcqJson, 10)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_type).toBe('mcq')
      expect(questions[0].question_text).toBe('What is 2 + 2?')
      expect(questions[0].correct_answer).toBe('B')
      expect(questions[0].options).toHaveLength(4)
      expect(questions[0].options?.find(opt => opt.is_correct)).toBeDefined()
    })

    it('should skip invalid MCQ questions', () => {
      const mcqJson = [
        {
          question_text: 'Valid question?',
          options: [
            { option_text: 'A', is_correct: true },
            { option_text: 'B', is_correct: false },
            { option_text: 'C', is_correct: false },
            { option_text: 'D', is_correct: false },
          ],
          model_answer: 'Explanation',
        },
        {
          // Invalid: missing question_text
          options: [],
        },
        {
          question_text: 'Another valid?',
          // Invalid: missing options
        },
      ]

      const questions = processMCQQuestions(mcqJson, 10)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_text).toBe('Valid question?')
    })

    it('should handle MCQ with correct answer at different positions', () => {
      const mcqJson = [
        {
          question_text: 'Question A?',
          options: [
            { option_text: 'A', is_correct: true },
            { option_text: 'B', is_correct: false },
            { option_text: 'C', is_correct: false },
            { option_text: 'D', is_correct: false },
          ],
          model_answer: 'A is correct',
        },
        {
          question_text: 'Question C?',
          options: [
            { option_text: 'A', is_correct: false },
            { option_text: 'B', is_correct: false },
            { option_text: 'C', is_correct: true },
            { option_text: 'D', is_correct: false },
          ],
          model_answer: 'C is correct',
        },
      ]

      const questions = processMCQQuestions(mcqJson, 10)
      expect(questions[0].correct_answer).toBe('A')
      expect(questions[1].correct_answer).toBe('C')
    })
  })

  describe('processFIBQuestions', () => {
    it('should process valid GCSE FIB questions', () => {
      const fibJson = [
        {
          question_text: 'The capital of England is [London].',
          model_answer: 'London is the capital city of England.',
        },
      ]

      const questions = processFIBQuestions(fibJson, 10)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_type).toBe('fib')
      expect(questions[0].question_text).toContain('[London]')
      expect(questions[0].correct_answer).toBe('London')
      expect(questions[0].model_answer).toBe('London is the capital city of England.')
    })

    it('should extract correct answer from brackets', () => {
      const fibJson = [
        {
          question_text: 'The formula for water is [H2O].',
          model_answer: 'H2O represents two hydrogen atoms and one oxygen atom.',
        },
      ]

      const questions = processFIBQuestions(fibJson, 10)
      expect(questions[0].correct_answer).toBe('H2O')
    })

    it('should handle FIB without brackets by extracting from model_answer', () => {
      const fibJson = [
        {
          question_text: 'The capital of France is _____.',
          model_answer: 'Paris. Paris is the capital and largest city of France.',
        },
      ]

      const questions = processFIBQuestions(fibJson, 10)
      expect(questions[0].correct_answer).toBe('Paris')
    })

    it('should skip invalid FIB questions', () => {
      const fibJson = [
        {
          question_text: 'Valid FIB question with [blank].',
          model_answer: 'Answer',
        },
        {
          // Invalid: missing question_text
          model_answer: 'Answer',
        },
      ]

      const questions = processFIBQuestions(fibJson, 10)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_text).toContain('[blank]')
    })
  })

  describe('processOpenEndedQuestions', () => {
    it('should process valid GCSE open-ended questions', () => {
      const openEndedJson = [
        {
          question_text: 'Explain the process of photosynthesis.',
          model_answer: 'Photosynthesis is the process by which plants convert light energy into chemical energy...',
        },
      ]

      const questions = processOpenEndedQuestions(openEndedJson, 15)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_type).toBe('open_ended')
      expect(questions[0].question_text).toBe('Explain the process of photosynthesis.')
      expect(questions[0].model_answer).toContain('Photosynthesis')
      expect(questions[0].correct_answer).toBeUndefined()
    })

    it('should skip invalid open-ended questions', () => {
      const openEndedJson = [
        {
          question_text: 'Valid question?',
          model_answer: 'Answer',
        },
        {
          // Invalid: missing question_text
          model_answer: 'Answer',
        },
      ]

      const questions = processOpenEndedQuestions(openEndedJson, 15)
      expect(questions).toHaveLength(1)
      expect(questions[0].question_text).toBe('Valid question?')
    })
  })

  describe('buildPrompts', () => {
    it('should build MCQ prompt for GCSE', () => {
      const context = 'Generate exam questions for:\n- Qualification: GCSE\n- Exam Board: AQA\n- Subject: Mathematics\n- Difficulty: medium'
      const prompt = buildMCQPrompt(context, 5)

      expect(prompt).toContain('GCSE')
      expect(prompt).toContain('AQA')
      expect(prompt).toContain('Mathematics')
      expect(prompt).toContain('5')
      expect(prompt).toContain('multiple choice')
      expect(prompt).toContain('JSON array')
    })

    it('should build FIB prompt for GCSE', () => {
      const context = 'Generate exam questions for:\n- Qualification: GCSE\n- Exam Board: Edexcel\n- Subject: Physics\n- Difficulty: hard'
      const prompt = buildFIBPrompt(context, 3)

      expect(prompt).toContain('GCSE')
      expect(prompt).toContain('Edexcel')
      expect(prompt).toContain('Physics')
      expect(prompt).toContain('3')
      expect(prompt).toContain('fill-in-the-blank')
      expect(prompt).toContain('[blank]')
    })

    it('should build open-ended prompt for GCSE', () => {
      const context = 'Generate exam questions for:\n- Qualification: GCSE\n- Exam Board: OCR\n- Subject: Chemistry\n- Difficulty: easy'
      const prompt = buildOpenEndedPrompt(context, 2)

      expect(prompt).toContain('GCSE')
      expect(prompt).toContain('OCR')
      expect(prompt).toContain('Chemistry')
      expect(prompt).toContain('2')
      expect(prompt).toContain('open-ended')
      expect(prompt).toContain('comprehensive')
    })
  })

  describe('validateGeneratedQuestion', () => {
    it('should validate a correct MCQ question', () => {
      const question: GeneratedQuestion = {
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
        correct_answer: 'B',
        options: [
          { option_text: '3', is_correct: false, order_index: 0 },
          { option_text: '4', is_correct: true, order_index: 1 },
          { option_text: '5', is_correct: false, order_index: 2 },
          { option_text: '6', is_correct: false, order_index: 3 },
        ],
      }

      expect(validateGeneratedQuestion(question)).toBe(true)
    })

    it('should reject MCQ without options', () => {
      const question: GeneratedQuestion = {
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
        correct_answer: 'B',
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should reject MCQ without exactly 4 options', () => {
      const question: GeneratedQuestion = {
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
        correct_answer: 'B',
        options: [
          { option_text: '3', is_correct: false, order_index: 0 },
          { option_text: '4', is_correct: true, order_index: 1 },
        ],
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should reject MCQ without exactly one correct answer', () => {
      const question: GeneratedQuestion = {
        question_text: 'What is 2 + 2?',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'The answer is 4',
        correct_answer: 'B',
        options: [
          { option_text: '3', is_correct: true, order_index: 0 },
          { option_text: '4', is_correct: true, order_index: 1 },
          { option_text: '5', is_correct: false, order_index: 2 },
          { option_text: '6', is_correct: false, order_index: 3 },
        ],
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should validate a correct FIB question', () => {
      const question: GeneratedQuestion = {
        question_text: 'The capital of England is [London].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London is the capital',
        correct_answer: 'London',
      }

      expect(validateGeneratedQuestion(question)).toBe(true)
    })

    it('should reject FIB without correct_answer', () => {
      const question: GeneratedQuestion = {
        question_text: 'The capital of England is [London].',
        question_type: 'fib',
        marks: 10,
        model_answer: 'London is the capital',
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should validate a correct open-ended question', () => {
      const question: GeneratedQuestion = {
        question_text: 'Explain the process of photosynthesis.',
        question_type: 'open_ended',
        marks: 15,
        model_answer: 'Photosynthesis is...',
      }

      expect(validateGeneratedQuestion(question)).toBe(true)
    })

    it('should reject question with empty question_text', () => {
      const question: GeneratedQuestion = {
        question_text: '',
        question_type: 'mcq',
        marks: 10,
        model_answer: 'Answer',
        correct_answer: 'A',
        options: [
          { option_text: 'A', is_correct: true, order_index: 0 },
          { option_text: 'B', is_correct: false, order_index: 1 },
          { option_text: 'C', is_correct: false, order_index: 2 },
          { option_text: 'D', is_correct: false, order_index: 3 },
        ],
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should reject question with invalid question_type', () => {
      const question = {
        question_text: 'Test?',
        question_type: 'invalid',
        marks: 10,
        model_answer: 'Answer',
      } as any

      expect(validateGeneratedQuestion(question)).toBe(false)
    })

    it('should reject question with zero or negative marks', () => {
      const question: GeneratedQuestion = {
        question_text: 'Test?',
        question_type: 'open_ended',
        marks: 0,
        model_answer: 'Answer',
      }

      expect(validateGeneratedQuestion(question)).toBe(false)
    })
  })

  describe('GCSE-specific integration tests', () => {
    it('should generate a complete GCSE Mathematics exam with all question types', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'AQA',
        subject: 'Mathematics',
        difficulty: 'medium',
        question_counts: {
          mcq: 3,
          fib: 2,
          open_ended: 1,
        },
      }

      // Validate request
      const validation = validateRequest(request)
      expect(validation.valid).toBe(true)

      // Build context
      const context = buildContext(request)
      expect(context).toContain('GCSE')
      expect(context).toContain('AQA')
      expect(context).toContain('Mathematics')

      // Calculate marks
      const totalQuestions = 3 + 2 + 1
      const marksResult = calculateMarks(totalQuestions)
      expect(marksResult.baseMarks).toBeGreaterThan(0)
      // Verify total will equal 100
      const expectedTotal = marksResult.baseMarks * (totalQuestions - 1) + (marksResult.baseMarks + marksResult.adjustment)
      expect(expectedTotal).toBeCloseTo(100, 1)

      // Process mock MCQ responses
      const mcqJson = [
        {
          question_text: 'What is the value of 2²?',
          options: [
            { option_text: '2', is_correct: false },
            { option_text: '4', is_correct: true },
            { option_text: '6', is_correct: false },
            { option_text: '8', is_correct: false },
          ],
          model_answer: '2² = 2 × 2 = 4',
        },
      ]

      const mcqQuestions = processMCQQuestions(mcqJson, marksResult.baseMarks)
      expect(mcqQuestions).toHaveLength(1)
      expect(validateGeneratedQuestion(mcqQuestions[0])).toBe(true)

      // Process mock FIB responses
      const fibJson = [
        {
          question_text: 'The square root of 16 is [4].',
          model_answer: '4 × 4 = 16, so √16 = 4',
        },
      ]

      const fibQuestions = processFIBQuestions(fibJson, marksResult.baseMarks)
      expect(fibQuestions).toHaveLength(1)
      expect(validateGeneratedQuestion(fibQuestions[0])).toBe(true)

      // Process mock open-ended responses
      const openEndedJson = [
        {
          question_text: 'Explain how to solve a quadratic equation using the quadratic formula.',
          model_answer: 'The quadratic formula is x = (-b ± √(b² - 4ac)) / 2a...',
        },
      ]

      const openEndedQuestions = processOpenEndedQuestions(openEndedJson, marksResult.baseMarks)
      expect(openEndedQuestions).toHaveLength(1)
      expect(validateGeneratedQuestion(openEndedQuestions[0])).toBe(true)
    })

    it('should handle GCSE Physics exam with topic and subtopic', () => {
      const request: QuestionGenerationRequest = {
        qualification: 'GCSE',
        exam_board: 'Edexcel',
        subject: 'Physics',
        topic: 'Mechanics',
        subtopic: 'Forces',
        difficulty: 'hard',
        question_counts: {
          mcq: 5,
          fib: 3,
          open_ended: 2,
        },
      }

      const validation = validateRequest(request)
      expect(validation.valid).toBe(true)

      const context = buildContext(request)
      expect(context).toContain('GCSE')
      expect(context).toContain('Edexcel')
      expect(context).toContain('Physics')
      expect(context).toContain('Mechanics')
      expect(context).toContain('Forces')
      expect(context).toContain('hard')

      const marksResult = calculateMarks(10)
      expect(marksResult.baseMarks).toBe(10)
      expect(marksResult.adjustment).toBe(0)
      // Verify total equals 100
      const total = marksResult.baseMarks * 10
      expect(total).toBe(100)
    })

    it('should handle different GCSE exam boards', () => {
      const examBoards = ['AQA', 'Edexcel', 'OCR', 'WJEC']

      examBoards.forEach(board => {
        const request: QuestionGenerationRequest = {
          qualification: 'GCSE',
          exam_board: board,
          subject: 'Mathematics',
          difficulty: 'medium',
          question_counts: { mcq: 5, fib: 3, open_ended: 2 },
        }

        const validation = validateRequest(request)
        expect(validation.valid).toBe(true)

        const context = buildContext(request)
        expect(context).toContain('GCSE')
        expect(context).toContain(board)
      })
    })

    it('should handle different difficulty levels for GCSE', () => {
      const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard']

      difficulties.forEach(difficulty => {
        const request: QuestionGenerationRequest = {
          qualification: 'GCSE',
          exam_board: 'AQA',
          subject: 'Chemistry',
          difficulty,
          question_counts: { mcq: 5, fib: 3, open_ended: 2 },
        }

        const validation = validateRequest(request)
        expect(validation.valid).toBe(true)

        const context = buildContext(request)
        expect(context).toContain(difficulty)
      })
    })
  })
})

