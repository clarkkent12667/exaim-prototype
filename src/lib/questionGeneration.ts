/**
 * Testable question generation logic extracted from the Supabase edge function
 * This module contains the core logic for generating exam questions that can be unit tested
 */

export interface QuestionGenerationRequest {
  qualification: string
  exam_board: string
  subject: string
  topic?: string
  subtopic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  question_counts: {
    mcq: number
    fib: number
    open_ended: number
  }
}

export interface GeneratedQuestion {
  question_text: string
  question_type: 'mcq' | 'fib' | 'open_ended'
  marks: number
  model_answer: string
  correct_answer?: string
  options?: Array<{
    option_text: string
    is_correct: boolean
    order_index: number
  }>
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  error?: {
    message: string
  }
}

/**
 * Validates a question generation request
 */
export function validateRequest(request: QuestionGenerationRequest): { valid: boolean; error?: string } {
  if (!request.qualification || request.qualification.trim() === '') {
    return { valid: false, error: 'qualification is required and cannot be empty' }
  }

  if (!request.exam_board || request.exam_board.trim() === '') {
    return { valid: false, error: 'exam_board is required and cannot be empty' }
  }

  if (!request.subject || request.subject.trim() === '') {
    return { valid: false, error: 'subject is required and cannot be empty' }
  }

  if (!request.difficulty || !['easy', 'medium', 'hard'].includes(request.difficulty)) {
    return { valid: false, error: 'difficulty is required and must be one of: easy, medium, hard' }
  }

  if (!request.question_counts ||
      typeof request.question_counts.mcq !== 'number' ||
      typeof request.question_counts.fib !== 'number' ||
      typeof request.question_counts.open_ended !== 'number') {
    return { valid: false, error: 'question_counts is required and must have numeric mcq, fib, and open_ended fields' }
  }

  return { valid: true }
}

/**
 * Builds the context string for question generation
 */
export function buildContext(request: QuestionGenerationRequest): string {
  let context = `Generate exam questions for:\n- Qualification: ${request.qualification}\n- Exam Board: ${request.exam_board}\n- Subject: ${request.subject}`
  if (request.topic) context += `\n- Topic: ${request.topic}`
  if (request.subtopic) context += `\n- Subtopic: ${request.subtopic}`
  context += `\n- Difficulty: ${request.difficulty}`
  return context
}

/**
 * Calculates marks per question type based on total questions
 * Ensures the total always equals exactly 100 by adjusting for rounding differences
 */
export function calculateMarks(totalQuestions: number): {
  baseMarks: number
  adjustment: number
  totalQuestions: number
} {
  if (totalQuestions === 0) {
    return { baseMarks: 0, adjustment: 0, totalQuestions: 0 }
  }
  
  // Calculate base marks per question
  const baseMarks = 100 / totalQuestions
  // Round to 1 decimal place for base marks
  const roundedBaseMarks = Math.round(baseMarks * 10) / 10
  // Calculate what the total would be with rounded marks
  const roundedTotal = roundedBaseMarks * totalQuestions
  // Calculate the difference to ensure exactly 100
  const difference = 100 - roundedTotal
  // Adjust the last question to account for rounding differences
  const adjustment = Math.round(difference * 10) / 10
  
  return {
    baseMarks: roundedBaseMarks,
    adjustment,
    totalQuestions,
  }
}

/**
 * Parses and cleans JSON content from OpenAI response
 */
export function parseOpenAIResponse(content: string): any {
  let cleanedContent = content.trim()
  // Remove markdown code blocks if present
  cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(cleanedContent)
}

/**
 * Processes MCQ questions from OpenAI response
 */
export function processMCQQuestions(
  mcqJson: any[],
  marks: number
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  mcqJson.forEach((q: any, index: number) => {
    if (!q.question_text || !q.options || !Array.isArray(q.options)) {
      return
    }

    const correctOption = q.options.find((opt: any) => opt.is_correct)
    questions.push({
      question_text: q.question_text,
      question_type: 'mcq',
      marks,
      model_answer: q.model_answer || 'No explanation provided',
      correct_answer: correctOption ? String.fromCharCode(65 + q.options.indexOf(correctOption)) : 'A',
      options: q.options.map((opt: any, idx: number) => ({
        option_text: opt.option_text || '',
        is_correct: opt.is_correct || false,
        order_index: idx,
      })),
    })
  })

  return questions
}

/**
 * Processes Fill-in-the-Blank questions from OpenAI response
 */
export function processFIBQuestions(
  fibJson: any[],
  marks: number
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  fibJson.forEach((q: any) => {
    if (!q.question_text) {
      return
    }

    // Extract correct answer from model_answer or question_text
    const blankMatch = q.question_text.match(/\[(.*?)\]/)
    const correctAnswer = blankMatch ? blankMatch[1] : (q.model_answer ? q.model_answer.split('.')[0].trim() : '')

    questions.push({
      question_text: q.question_text,
      question_type: 'fib',
      marks,
      model_answer: q.model_answer || 'No explanation provided',
      correct_answer: correctAnswer,
    })
  })

  return questions
}

/**
 * Processes Open-ended questions from OpenAI response
 */
export function processOpenEndedQuestions(
  openEndedJson: any[],
  marks: number
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = []

  openEndedJson.forEach((q: any) => {
    if (!q.question_text) {
      return
    }

    questions.push({
      question_text: q.question_text,
      question_type: 'open_ended',
      marks,
      model_answer: q.model_answer || 'No model answer provided',
    })
  })

  return questions
}

/**
 * Builds the MCQ prompt for OpenAI
 */
export function buildMCQPrompt(context: string, count: number): string {
  return `${context}\n\nGenerate ${count} multiple choice questions (MCQ). For each question, provide:
1. The question text
2. 4 options (A, B, C, D)
3. The correct answer (A, B, C, or D)
4. Model answer explanation

Format as JSON array with this structure:
[
  {
    "question_text": "Question here?",
    "options": [
      {"option_text": "Option A", "is_correct": true},
      {"option_text": "Option B", "is_correct": false},
      {"option_text": "Option C", "is_correct": false},
      {"option_text": "Option D", "is_correct": false}
    ],
    "model_answer": "Explanation of why this is correct"
  }
]`
}

/**
 * Builds the FIB prompt for OpenAI
 */
export function buildFIBPrompt(context: string, count: number): string {
  return `${context}\n\nGenerate ${count} fill-in-the-blank questions. For each question, provide:
1. The question text with exactly ONE blank (use [blank] or _____)
2. The correct answer (what should fill the blank)
3. Model answer explanation

CRITICAL: Each question MUST have exactly ONE blank only. Do NOT create questions with multiple blanks.

Format as JSON array:
[
  {
    "question_text": "Question with [blank] here",
    "model_answer": "Correct answer and explanation"
  }
]`
}

/**
 * Builds the Open-ended prompt for OpenAI
 */
export function buildOpenEndedPrompt(context: string, count: number): string {
  return `${context}\n\nGenerate ${count} open-ended questions. For each question, provide:
1. The question text
2. Model answer (comprehensive answer that would receive full marks)

Format as JSON array:
[
  {
    "question_text": "Question here?",
    "model_answer": "Comprehensive model answer"
  }
]`
}

/**
 * Validates that a generated question has required fields
 */
export function validateGeneratedQuestion(question: GeneratedQuestion): boolean {
  if (!question.question_text || question.question_text.trim() === '') {
    return false
  }

  if (!question.question_type || !['mcq', 'fib', 'open_ended'].includes(question.question_type)) {
    return false
  }

  if (typeof question.marks !== 'number' || question.marks <= 0) {
    return false
  }

  if (!question.model_answer || question.model_answer.trim() === '') {
    return false
  }

  // MCQ questions must have options and correct_answer
  if (question.question_type === 'mcq') {
    if (!question.options || question.options.length !== 4) {
      return false
    }
    if (!question.correct_answer) {
      return false
    }
    const correctCount = question.options.filter(opt => opt.is_correct).length
    if (correctCount !== 1) {
      return false
    }
  }

  // FIB questions must have correct_answer
  if (question.question_type === 'fib') {
    if (!question.correct_answer || question.correct_answer.trim() === '') {
      return false
    }
  }

  return true
}

