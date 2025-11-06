import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { examService, questionService, attemptService, answerService, statisticsService, type Exam, type Question, type QuestionOption, type StudentAnswer } from '@/lib/examService'
import { evaluationService } from '@/lib/evaluationService'
import { assignmentService } from '@/lib/classService'
import { ExamTimer } from '@/components/exam/ExamTimer'
import { QuestionNavigation } from '@/components/exam/QuestionNavigation'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export function TakeExam() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<(Question & { options?: QuestionOption[] })[]>([])
  const [attempt, setAttempt] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, { is_correct?: boolean; score: number; ai_evaluation?: any }>>({})
  const [checkingQuestion, setCheckingQuestion] = useState<string | null>(null)

  useEffect(() => {
    if (id && user) {
      loadExam()
    }
  }, [id, user])

  useEffect(() => {
    // Auto-save answers every 30 seconds
    const interval = setInterval(() => {
      if (attempt && Object.keys(answers).length > 0) {
        saveAnswers()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [attempt, answers])

  const loadExam = async () => {
    console.log('[TakeExam] Starting loadExam for exam:', id)
    setLoading(true)
    try {
      // Load exam
      console.log('[TakeExam] Step 1: Loading exam data...')
      const examStartTime = Date.now()
      const { data: examData, error: examError } = await examService.getById(id!)
      console.log('[TakeExam] Step 1 complete in', Date.now() - examStartTime, 'ms', { examError, hasData: !!examData })
      if (examError || !examData) {
        throw examError
      }

      // Check if exam is assigned to the student
      if (!user) {
        alert('You must be logged in to take this exam')
        navigate('/student/dashboard', { replace: true })
        return
      }

      // Use efficient method to check if exam is assigned instead of fetching all assignments
      console.log('[TakeExam] Step 2: Checking if exam is assigned to student...', { examId: id, studentId: user.id })
      const assignmentStartTime = Date.now()
      const { data: isAssigned, error: assignmentError } = await assignmentService.isAssignedToStudent(id!, user.id)
      console.log('[TakeExam] Step 2 complete in', Date.now() - assignmentStartTime, 'ms', { isAssigned, assignmentError })
      
      if (assignmentError || !isAssigned) {
        console.log('[TakeExam] Exam not assigned or error:', { assignmentError, isAssigned })
        alert('This exam has not been assigned to you. Please contact your teacher.')
        navigate('/student/dashboard', { replace: true })
        return
      }

      setExam(examData)

      // Load questions
      console.log('[TakeExam] Step 3: Loading questions...')
      const questionsStartTime = Date.now()
      const { data: questionsData, error: questionsError } = await questionService.getByExam(id!)
      console.log('[TakeExam] Step 3 complete in', Date.now() - questionsStartTime, 'ms', { questionsError, questionCount: questionsData?.length })
      if (questionsError || !questionsData) {
        throw questionsError
      }
      
      // Check if exam has questions
      if (questionsData.length === 0) {
        console.error('[TakeExam] Exam has no questions!')
        alert('This exam has no questions. Please contact your teacher.')
        navigate('/student/dashboard', { replace: true })
        return
      }

      // Load options for MCQ questions
      console.log('[TakeExam] Step 4: Loading MCQ options...')
      const optionsStartTime = Date.now()
      const questionsWithOptions = await Promise.all(
        questionsData.map(async (q) => {
          if (q.question_type === 'mcq') {
            const { data: options } = await questionService.getOptions(q.id)
            return { ...q, options }
          }
          return q
        })
      )
      console.log('[TakeExam] Step 4 complete in', Date.now() - optionsStartTime, 'ms')

      setQuestions(questionsWithOptions)

      // Create or get existing attempt
      console.log('[TakeExam] Step 5: Loading attempts...')
      const attemptsStartTime = Date.now()
      const { data: attempts } = await attemptService.getByStudent(user!.id)
      console.log('[TakeExam] Step 5 complete in', Date.now() - attemptsStartTime, 'ms', { attemptCount: attempts?.length })
      const existingAttempt = attempts?.find(a => a.exam_id === id && a.status === 'in_progress')

      if (existingAttempt) {
        console.log('[TakeExam] Found existing attempt:', existingAttempt.id)
        setAttempt(existingAttempt)
        setStartedAt(new Date(existingAttempt.started_at))
        
        // Load existing answers
        console.log('[TakeExam] Step 6: Loading existing answers...')
        const answersStartTime = Date.now()
        const { data: existingAnswers } = await answerService.getByAttempt(existingAttempt.id)
        console.log('[TakeExam] Step 6 complete in', Date.now() - answersStartTime, 'ms', { answerCount: existingAnswers?.length })
        const answersMap: Record<string, string> = {}
        const submittedMap: Record<string, { is_correct?: boolean; score: number; ai_evaluation?: any }> = {}
        existingAnswers?.forEach(a => {
          // Store answer as-is (may be JSON array for multiple blanks)
          answersMap[a.question_id] = a.answer_text || ''
          // If answer has been evaluated AND there's an actual answer, show feedback
          // Include partially correct (is_correct === undefined) and include ai_evaluation
          if (a.evaluated_at && (a.answer_text && a.answer_text.trim() !== '')) {
            submittedMap[a.question_id] = {
              is_correct: a.is_correct, // Can be true, false, or undefined (partially correct)
              score: a.score,
              ai_evaluation: a.ai_evaluation
            }
          }
        })
        setAnswers(answersMap)
        setSubmittedQuestions(submittedMap)
      } else {
        // Create new attempt
        console.log('[TakeExam] Step 6: Creating new attempt...')
        const createAttemptStartTime = Date.now()
        const { data: newAttempt, error: attemptError } = await attemptService.create({
          exam_id: id!,
          student_id: user!.id,
        })
        console.log('[TakeExam] Step 6 complete in', Date.now() - createAttemptStartTime, 'ms', { attemptError, hasAttempt: !!newAttempt })
        if (attemptError || !newAttempt) {
          throw attemptError
        }
        setAttempt(newAttempt)
        setStartedAt(new Date())
      }
      console.log('[TakeExam] All steps complete!')
    } catch (error: any) {
      console.error('[TakeExam] Error in loadExam:', error)
      alert('Error loading exam: ' + error.message)
      navigate('/student/dashboard', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  const saveAnswers = async (questionId?: string) => {
    if (!attempt) {
      return
    }

    const questionToSave = questionId 
      ? questions.find(q => q.id === questionId)
      : questions[currentQuestionIndex]
    
    if (!questionToSave) {
      return
    }

    const answerText = answers[questionToSave.id] || ''
    
    // For MCQ and FIB, evaluate instantly
    let score = 0
    let is_correct: boolean | undefined = undefined
    let evaluated_at: string | undefined = undefined

    if (answerText && (questionToSave.question_type === 'mcq' || questionToSave.question_type === 'fib')) {
      try {
        if (questionToSave.question_type === 'mcq' && questionToSave.options) {
          const evaluation = await evaluationService.evaluateMCQ(
            questionToSave,
            answerText,
            questionToSave.options
          )
          score = evaluation.score
          is_correct = evaluation.is_correct
          evaluated_at = new Date().toISOString()
        } else if (questionToSave.question_type === 'fib') {
          // For FIB with single blank, pass the answer text directly
          const evaluation = await evaluationService.evaluateFIB(
            questionToSave,
            answerText
          )
          score = evaluation.score
          is_correct = evaluation.is_correct
          evaluated_at = new Date().toISOString()
        }
      } catch (error) {
        // Error evaluating answer
      }
    }
    
    await answerService.saveAnswer({
      attempt_id: attempt.id,
      question_id: questionToSave.id,
      answer_text: answerText,
      score,
      is_correct,
      evaluated_at,
    })
  }

  const handleAnswerChange = async (questionId: string, value: string) => {
    setAnswers({ ...answers, [questionId]: value })
    // Remove feedback when answer changes
    if (submittedQuestions[questionId]) {
      const newSubmitted = { ...submittedQuestions }
      delete newSubmitted[questionId]
      setSubmittedQuestions(newSubmitted)
    }
  }

  const handleSubmitAnswer = async (questionId: string) => {
    const question = questions.find(q => q.id === questionId)
    if (!question) {
      alert('Question not found')
      return
    }

    const answerText = answers[questionId]
    if (!answerText) {
      alert('Please provide an answer before submitting')
      return
    }

    // For FIB questions, check if the blank is filled
    if (question.question_type === 'fib') {
      if (!answerText || answerText.trim().length === 0) {
        alert('Please fill in the blank before submitting')
        return
      }
    }

    setCheckingQuestion(questionId)
    try {
      // Save the answer first
      await saveAnswers(questionId)

      // Evaluate the answer
      let evaluation: { is_correct: boolean; score: number } | null = null

      if (question.question_type === 'mcq' && question.options) {
        evaluation = await evaluationService.evaluateMCQ(
          question,
          answers[questionId],
          question.options
        )
      } else if (question.question_type === 'fib') {
        evaluation = await evaluationService.evaluateFIB(
          question,
          answers[questionId]
        )
      } else if (question.question_type === 'open_ended') {
        const result = await evaluationService.evaluateOpenEnded(
          question,
          answers[questionId]
        )
        // For open-ended, don't set is_correct - leave it undefined so partially correct logic works
        // is_correct will be determined based on score: full marks = correct, 0 = incorrect, otherwise = partially correct
        evaluation = { 
          is_correct: result.score >= question.marks ? true : (result.score === 0 ? false : undefined), 
          score: result.score,
          ai_evaluation: result.ai_evaluation
        }
      }

      if (evaluation) {
        setSubmittedQuestions({
          ...submittedQuestions,
          [questionId]: evaluation
        })
      }
    } catch (error: any) {
      alert('Error checking answer: ' + error.message)
    } finally {
      setCheckingQuestion(null)
    }
  }

  // Clean option text to remove letter prefixes if they exist
  const cleanOptionText = (text: string): string => {
    // Remove patterns like "A. ", "B. ", "C. ", "D. " at the start
    return text.replace(/^[A-Z]\.\s*/i, '').trim()
  }

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      saveAnswers()
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      saveAnswers()
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Save all answers first (including empty ones for unanswered questions)
      for (const question of questions) {
        await saveAnswers(question.id)
      }

      // Ensure all questions have answer records (even if empty)
      const { data: savedAnswers } = await answerService.getByAttempt(attempt.id)
      const answeredQuestionIds = new Set(savedAnswers?.map(a => a.question_id) || [])
      
      // Create empty answer records for unanswered questions
      for (const question of questions) {
        if (!answeredQuestionIds.has(question.id)) {
          await answerService.saveAnswer({
            attempt_id: attempt.id,
            question_id: question.id,
            answer_text: '',
            score: 0,
            is_correct: false,
          })
        }
      }

      // Get all saved answers (now including empty ones)
      const { data: allAnswers } = await answerService.getByAttempt(attempt.id)
      if (!allAnswers) {
        throw new Error('Failed to retrieve answers')
      }

      // Evaluate all answers (empty answers will be skipped for faster evaluation)
      const { evaluatedAnswers, totalScore } = await evaluationService.evaluateAllAnswers(
        questions,
        allAnswers
      )

      // Update all answers with evaluation results in parallel batches
      const updatePromises = evaluatedAnswers.map(evaluatedAnswer =>
        answerService.update(evaluatedAnswer.id, {
          is_correct: evaluatedAnswer.is_correct,
          score: evaluatedAnswer.score,
          ai_evaluation: evaluatedAnswer.ai_evaluation,
          evaluated_at: evaluatedAnswer.evaluated_at,
        })
      )
      await Promise.all(updatePromises)

      // Update attempt with total score (round to whole number)
      await attemptService.update(attempt.id, { total_score: Math.round(totalScore) })

      // Submit attempt
      await attemptService.submit(attempt.id)

      // Calculate and save statistics
      // Filter out empty answers when counting skipped
      const answeredQuestions = evaluatedAnswers.filter(a => a.answer_text && a.answer_text.trim() !== '').map(a => a.question_id)
      const skippedCount = questions.filter(q => !answeredQuestions.includes(q.id)).length
      
      const stats = {
        correct_count: evaluatedAnswers.filter(a => a.is_correct === true && a.answer_text && a.answer_text.trim() !== '').length,
        incorrect_count: evaluatedAnswers.filter(a => a.is_correct === false && a.answer_text && a.answer_text.trim() !== '').length,
        partially_correct_count: evaluatedAnswers.filter(a => 
          a.is_correct === undefined && a.score > 0 && a.score < questions.find(q => q.id === a.question_id)?.marks && a.answer_text && a.answer_text.trim() !== ''
        ).length,
        skipped_count: skippedCount,
        total_questions: questions.length,
      }

      await statisticsService.createOrUpdate({
        attempt_id: attempt.id,
        ...stats,
      })

      // Navigate to results
      navigate(`/student/exams/${id}/results?attempt=${attempt.id}`, { replace: true })
    } catch (error: any) {
      alert('Error submitting exam: ' + error.message)
    } finally {
      setSubmitting(false)
      setShowSubmitDialog(false)
    }
  }

  const handleTimeUp = () => {
    alert('Time is up! Submitting your exam...')
    handleSubmit()
  }

  const renderFibQuestion = (questionText: string) => {
    // Replace [blank], [anything], _____, or similar patterns with blanks
    // Now only supports single blank per question
    // Combined pattern to match all blank types: [blank], [anything], _____, etc.
    const blankPattern = /(\[blank\]|\[[^\]]+\]|_{3,}|_____+)/gi
    
    if (!blankPattern.test(questionText)) {
      // No blanks found, return text as-is
      return [{ type: 'text' as const, content: questionText }]
    }
    
    // Reset regex lastIndex
    blankPattern.lastIndex = 0
    
    const parts: Array<{ type: 'text' | 'blank', content: string, index?: number }> = []
    let lastIndex = 0
    let match
    
    // Find the first match only (single blank)
    if ((match = blankPattern.exec(questionText)) !== null) {
      // Add text before the blank
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: questionText.substring(lastIndex, match.index) })
      }
      
      // Add the blank
      parts.push({ type: 'blank', content: '', index: 0 })
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after the blank
    if (lastIndex < questionText.length) {
      parts.push({ type: 'text', content: questionText.substring(lastIndex) })
    }
    
    return parts
  }

  if (loading || !exam || !questions.length || !attempt || !startedAt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const answeredQuestions = new Set(
    questions.map((q, idx) => {
      const answer = answers[q.id]
      if (!answer) return -1
      
      // For FIB questions, check if answer is filled
      if (q.question_type === 'fib') {
        // For single blank, just check if answer exists and is non-empty
        if (answer && answer.trim().length > 0) {
          return idx
        }
        return -1
      }
      
      // For other question types, just check if answer exists and is non-empty
      return answer.trim().length > 0 ? idx : -1
    }).filter(idx => idx !== -1)
  )

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{exam.title}</h1>
            <p className="text-muted-foreground mt-2">{exam.description}</p>
          </div>
          {exam.time_limit_minutes && (
            <ExamTimer
              timeLimitMinutes={exam.time_limit_minutes}
              startedAt={startedAt}
              onTimeUp={handleTimeUp}
            />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <QuestionNavigation
              totalQuestions={questions.length}
              currentIndex={currentQuestionIndex}
              answeredQuestions={answeredQuestions}
              onNavigate={(index) => {
                saveAnswers()
                setCurrentQuestionIndex(index)
              }}
            />
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  {currentQuestion.question_type === 'fib' ? (
                    <div className="mb-6 space-y-4">
                      <div className="text-lg font-medium leading-relaxed">
                        {(() => {
                          const parts = renderFibQuestion(currentQuestion.question_text)
                          const currentAnswer = answers[currentQuestion.id] || ''
                          
                          return parts.map((part, partIdx) => (
                            part.type === 'blank' ? (
                              <span key={partIdx} className="inline-flex items-center mx-2">
                                <Input
                                  className="inline-flex h-12 min-w-[180px] max-w-[400px] bg-blue-50 border-2 border-blue-400 rounded-lg px-4 py-2 text-base text-blue-900 font-semibold shadow-sm focus:bg-blue-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-300 transition-all"
                                  style={{ borderWidth: '2px' }}
                                  value={currentAnswer}
                                  onChange={(e) => {
                                    handleAnswerChange(currentQuestion.id, e.target.value)
                                  }}
                                  onBlur={() => saveAnswers(currentQuestion.id)}
                                  placeholder="Type your answer here"
                                  disabled={submittedQuestions[currentQuestion.id] !== undefined}
                                  autoFocus={partIdx === 0 && !currentAnswer}
                                />
                              </span>
                            ) : (
                              <span key={partIdx} className="text-gray-800">{part.content}</span>
                            )
                          ))
                        })()}
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-sm text-muted-foreground">
                          <span className="font-semibold">Marks:</span> {currentQuestion.marks}
                        </p>
                        {answers[currentQuestion.id] && answers[currentQuestion.id].trim().length > 0 && (
                          <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Answer saved
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-4">{currentQuestion.question_text}</p>
                      <p className="text-sm text-muted-foreground">Marks: {currentQuestion.marks}</p>
                    </>
                  )}
                </div>

                {currentQuestion.question_type === 'mcq' && currentQuestion.options && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = answers[currentQuestion.id] === option.id
                      const isCorrect = option.is_correct
                      const isSubmitted = submittedQuestions[currentQuestion.id]
                      const showFeedback = isSubmitted !== undefined
                      
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-accent ${
                            showFeedback && isSelected
                              ? isCorrect
                                ? 'bg-green-50 border-green-500'
                                : 'bg-red-50 border-red-500'
                              : showFeedback && isCorrect
                              ? 'bg-green-50 border-green-300'
                              : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={option.id}
                            checked={isSelected}
                            onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                            className="h-4 w-4"
                            disabled={showFeedback}
                          />
                          <span className="flex-1">
                            {String.fromCharCode(65 + index)}. {cleanOptionText(option.option_text)}
                          </span>
                          {showFeedback && isCorrect && (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          )}
                          {showFeedback && isSelected && !isCorrect && (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                        </label>
                      )
                    })}
                  </div>
                )}

                {currentQuestion.question_type === 'open_ended' && (
                  <div className="space-y-2">
                    <Label htmlFor={`answer-${currentQuestion.id}`}>Your Answer</Label>
                    <Textarea
                      id={`answer-${currentQuestion.id}`}
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      placeholder="Enter your detailed answer..."
                      className="min-h-[200px]"
                      disabled={submittedQuestions[currentQuestion.id] !== undefined}
                    />
                  </div>
                )}

                {/* Feedback display */}
                {submittedQuestions[currentQuestion.id] && (() => {
                  const feedback = submittedQuestions[currentQuestion.id]
                  const isCorrect = feedback.is_correct === true
                  const isIncorrect = feedback.is_correct === false
                  const isPartiallyCorrect = feedback.is_correct === undefined && feedback.score > 0 && feedback.score < currentQuestion.marks
                  
                  return (
                    <div className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? 'bg-green-50 border-green-500'
                        : isIncorrect
                        ? 'bg-red-50 border-red-500'
                        : isPartiallyCorrect
                        ? 'bg-yellow-50 border-yellow-500'
                        : 'bg-gray-50 border-gray-500'
                    }`}>
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : isIncorrect ? (
                          <XCircle className="h-5 w-5 text-red-600" />
                        ) : isPartiallyCorrect ? (
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                        ) : null}
                        <span className={`font-semibold ${
                          isCorrect
                            ? 'text-green-800'
                            : isIncorrect
                            ? 'text-red-800'
                            : isPartiallyCorrect
                            ? 'text-yellow-800'
                            : 'text-gray-800'
                        }`}>
                          {isCorrect
                            ? 'Correct!'
                            : isIncorrect
                            ? 'Incorrect'
                            : isPartiallyCorrect
                            ? 'Partially Correct'
                            : 'Not Evaluated'}
                        </span>
                        <span className="ml-auto text-sm text-muted-foreground">
                          Score: {Math.round(feedback.score)} / {currentQuestion.marks}
                        </span>
                      </div>
                      {currentQuestion.question_type === 'fib' && currentQuestion.correct_answer && !isCorrect && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-semibold text-blue-900 mb-1">Model Answer:</p>
                          <p className="text-base text-blue-800 font-medium">
                            {currentQuestion.correct_answer}
                          </p>
                        </div>
                      )}
                      {currentQuestion.question_type === 'open_ended' && (isPartiallyCorrect || isIncorrect) && currentQuestion.model_answer && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-semibold text-blue-900 mb-1">Model Answer:</p>
                          <p className="text-sm text-blue-800 whitespace-pre-wrap">
                            {currentQuestion.model_answer}
                          </p>
                        </div>
                      )}
                      {currentQuestion.question_type === 'open_ended' && isPartiallyCorrect && feedback.ai_evaluation?.how_to_improve && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                          <p className="text-sm font-semibold text-blue-900 mb-1">How to Improve:</p>
                          <p className="text-sm text-blue-800">
                            {feedback.ai_evaluation.how_to_improve}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="flex justify-between pt-4">
                  <Button
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentQuestionIndex === 0}
                  >
                    Previous
                  </Button>
                  <div className="flex gap-2">
                    {submittedQuestions[currentQuestion.id] === undefined && (
                      <Button
                        variant="default"
                        onClick={() => handleSubmitAnswer(currentQuestion.id)}
                        disabled={!answers[currentQuestion.id] || checkingQuestion === currentQuestion.id}
                      >
                        {checkingQuestion === currentQuestion.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          'Submit Answer'
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setShowSubmitDialog(true)}
                    >
                      Submit Exam
                    </Button>
                    <Button
                      onClick={handleNext}
                      disabled={currentQuestionIndex === questions.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Exam</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your exam? You won't be able to make changes after submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

