import { supabase } from './supabase'
import type { Question, QuestionOption, StudentAnswer } from './examService'

export const evaluationService = {
  async evaluateMCQ(
    question: Question,
    studentAnswer: string,
    options: QuestionOption[]
  ): Promise<{ is_correct: boolean; score: number }> {
    // Find the correct option
    const correctOption = options.find(opt => opt.is_correct)
    if (!correctOption) {
      return { is_correct: false, score: 0 }
    }

    // Compare student answer with correct option
    const isCorrect = studentAnswer === correctOption.id || 
                     studentAnswer === String.fromCharCode(65 + options.indexOf(correctOption))

    return {
      is_correct: isCorrect,
      score: isCorrect ? question.marks : 0,
    }
  },

  async evaluateFIB(
    question: Question,
    studentAnswer: string
  ): Promise<{ is_correct: boolean; score: number }> {
    if (!question.correct_answer) {
      return { is_correct: false, score: 0 }
    }

    // Normalize answers for comparison
    const normalize = (str: string) => str.trim().toLowerCase().replace(/\s+/g, ' ')

    // Try to parse correct_answer as JSON array (for multiple blanks)
    let correctAnswers: string[]
    try {
      const parsed = JSON.parse(question.correct_answer)
      if (Array.isArray(parsed)) {
        correctAnswers = parsed.map((a: any) => normalize(String(a)))
      } else {
        correctAnswers = [normalize(question.correct_answer)]
      }
    } catch {
      // Not JSON, treat as single answer
      correctAnswers = [normalize(question.correct_answer)]
    }

    // Try to parse studentAnswer as JSON array (for multiple blanks)
    let studentAnswers: string[]
    try {
      const parsed = JSON.parse(studentAnswer)
      if (Array.isArray(parsed)) {
        studentAnswers = parsed.map((a: any) => normalize(String(a)))
      } else {
        studentAnswers = [normalize(studentAnswer)]
      }
    } catch {
      // Not JSON, treat as single answer
      // If there's only one correct answer, use studentAnswer as-is
      if (correctAnswers.length === 1) {
        studentAnswers = [normalize(studentAnswer)]
      } else {
        // Multiple blanks but student answer is not JSON - try to split by comma
        studentAnswers = studentAnswer.split(',').map(a => normalize(a))
      }
    }

    // Ensure arrays have the same length
    const maxLength = Math.max(correctAnswers.length, studentAnswers.length)
    while (correctAnswers.length < maxLength) correctAnswers.push('')
    while (studentAnswers.length < maxLength) studentAnswers.push('')

    // Compare each answer
    let correctCount = 0
    let totalScore = 0

    for (let i = 0; i < correctAnswers.length; i++) {
      const correct = correctAnswers[i]
      const student = studentAnswers[i] || ''

      if (correct === '') continue // Skip empty correct answers

      // Exact match
      if (student === correct) {
        correctCount++
        continue
      }

      // Partial match (contains key terms) - only for single-word answers
      const correctTerms = correct.split(' ').filter(term => term.length > 2)
      if (correctTerms.length > 1) {
        const studentTerms = student.split(' ').filter(term => term.length > 2)
        const matchingTerms = correctTerms.filter(term => studentTerms.includes(term))
        const matchRatio = correctTerms.length > 0 ? matchingTerms.length / correctTerms.length : 0

        // Give partial credit if 70%+ of terms match
        if (matchRatio >= 0.7) {
          correctCount += matchRatio
          continue
        }
      }
    }

    // Calculate score: distribute marks evenly across blanks
    if (correctAnswers.length > 0) {
      const marksPerBlank = question.marks / correctAnswers.filter(a => a !== '').length
      totalScore = Math.round(correctCount * marksPerBlank) // Round to whole number
      // Ensure score doesn't exceed total marks
      totalScore = Math.min(totalScore, question.marks)
    }

    // Set is_correct: true if full marks, false otherwise (including partial credit)
    const isCorrectStatus = totalScore >= question.marks

    return { is_correct: isCorrectStatus, score: totalScore }
  },

  async evaluateOpenEnded(
    question: Question,
    studentAnswer: string
  ): Promise<{ score: number; ai_evaluation: any }> {
    // Call Supabase Edge Function for AI evaluation
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    // Validate required fields before sending
    if (!question.question_text || question.question_text.trim() === '') {
      throw new Error('Question text is required')
    }
    if (!question.model_answer || question.model_answer.trim() === '') {
      throw new Error('Model answer is required for open-ended questions')
    }
    if (studentAnswer === undefined || studentAnswer === null) {
      throw new Error('Student answer is required')
    }
    if (!question.marks || question.marks <= 0) {
      throw new Error('Question marks must be a positive number')
    }

    const response = await supabase.functions.invoke('evaluate-open-ended', {
      body: {
        question_text: question.question_text,
        model_answer: question.model_answer,
        student_answer: studentAnswer || '', // Ensure it's at least an empty string
        max_marks: question.marks,
      },
    })


    // Check for Supabase client error first
    // When Edge Function returns non-2xx, response.error is set, but response.data may still contain the error details
    if (response.error) {
      // Try to extract error message from response data if available (more detailed)
      const errorMessage = response.data?.error || response.error.message || 'Unknown error'
      const errorDetails = response.data?.details || response.error.details
      throw new Error(errorDetails ? `Evaluation error: ${errorMessage}\n\nDetails: ${errorDetails}` : `Evaluation error: ${errorMessage}`)
    }

    // Check if response data contains an error (from edge function)
    // This can happen even without response.error in some edge cases
    if (response.data && typeof response.data === 'object' && 'error' in response.data) {
      const errorData = response.data as { error: string; details?: string }
      throw new Error(`Evaluation error: ${errorData.error}${errorData.details ? `\n\nDetails: ${errorData.details}` : ''}`)
    }

    // Validate response data structure
    if (!response.data || typeof response.data !== 'object') {
      throw new Error('Invalid response from evaluation service')
    }

    const evaluation = response.data as {
      score: number
      feedback: string
      how_to_improve: string
    }

    // Validate evaluation structure
    if (typeof evaluation.score !== 'number' || !evaluation.feedback) {
      throw new Error('Invalid evaluation response format')
    }

    return {
      score: Math.round(evaluation.score), // Round to whole number
      ai_evaluation: evaluation,
    }
  },

  async evaluateAllAnswers(
    questions: (Question & { options?: QuestionOption[] })[],
    answers: StudentAnswer[]
  ) {
    const evaluatedAnswers: StudentAnswer[] = []
    const evaluationPromises: Promise<StudentAnswer>[] = []

    // Process all questions in parallel for faster evaluation
    for (const question of questions) {
      const answer = answers.find(a => a.question_id === question.id)
      if (!answer) continue

      // Skip evaluation for empty answers to make it faster
      const answerText = answer.answer_text || ''
      const isEmpty = !answerText || answerText.trim() === ''
      
      // If answer is empty, add to results immediately (no async evaluation needed)
      if (isEmpty) {
        evaluatedAnswers.push({
          ...answer,
          is_correct: false,
          score: 0,
          evaluated_at: new Date().toISOString(),
        })
        continue
      }

      // Create evaluation promise for non-empty answers
      const evaluationPromise = (async () => {
        let evaluation: { is_correct?: boolean; score: number; ai_evaluation?: any } = { score: 0 }

        try {
          if (question.question_type === 'mcq') {
            if (question.options) {
              evaluation = await this.evaluateMCQ(question, answerText, question.options)
            }
          } else if (question.question_type === 'fib') {
            evaluation = await this.evaluateFIB(question, answerText)
          } else if (question.question_type === 'open_ended') {
            const openEndedEval = await this.evaluateOpenEnded(question, answerText)
            // For open-ended: full marks = correct, 0 = incorrect, otherwise = partially correct (undefined)
            evaluation = {
              is_correct: openEndedEval.score >= question.marks ? true : (openEndedEval.score === 0 ? false : undefined),
              score: openEndedEval.score,
              ai_evaluation: openEndedEval.ai_evaluation,
            }
          }
        } catch (error) {
          // Continue with default evaluation (score: 0) if evaluation fails
          evaluation = { score: 0 }
        }

        const roundedScore = Math.round(evaluation.score) // Round to whole number

        return {
          ...answer,
          is_correct: evaluation.is_correct,
          score: roundedScore,
          ai_evaluation: evaluation.ai_evaluation,
          evaluated_at: new Date().toISOString(),
        }
      })()

      evaluationPromises.push(evaluationPromise)
    }

    // Wait for all evaluations to complete in parallel
    const results = await Promise.all(evaluationPromises)
    evaluatedAnswers.push(...results)

    // Calculate total score
    const totalScore = evaluatedAnswers.reduce((sum, answer) => sum + answer.score, 0)

    return { evaluatedAnswers, totalScore }
  },
}

