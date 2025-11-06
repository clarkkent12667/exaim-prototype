import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService, questionService, attemptService, answerService, statisticsService, type Exam, type Question, type QuestionOption, type StudentAnswer, type ExamStatistics } from '@/lib/examService'
import { evaluationService } from '@/lib/evaluationService'
import { CheckCircle2, XCircle, AlertCircle, Circle } from 'lucide-react'
import { Loader2 } from 'lucide-react'

export function ExamResults() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attempt')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<(Question & { options?: QuestionOption[] })[]>([])
  const [answers, setAnswers] = useState<StudentAnswer[]>([])
  const [statistics, setStatistics] = useState<ExamStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)

  useEffect(() => {
    if (id && attemptId && user) {
      loadResults()
    }
  }, [id, attemptId, user])

  const loadResults = async () => {
    setLoading(true)
    try {
      // Load exam
      const { data: examData, error: examError } = await examService.getById(id!)
      if (examError || !examData) throw examError
      setExam(examData)

      // Load questions
      const { data: questionsData, error: questionsError } = await questionService.getByExam(id!)
      if (questionsError || !questionsData) throw questionsError

      // Load options for MCQ
      const questionsWithOptions = await Promise.all(
        questionsData.map(async (q) => {
          if (q.question_type === 'mcq') {
            const { data: options } = await questionService.getOptions(q.id)
            return { ...q, options }
          }
          return q
        })
      )
      setQuestions(questionsWithOptions)

      // Load attempt
      const { data: attemptData, error: attemptError } = await attemptService.getById(attemptId!)
      if (attemptError || !attemptData) throw attemptError

      // Load answers
      const { data: answersData, error: answersError } = await answerService.getByAttempt(attemptId!)
      if (answersError || !answersData) throw answersError
      setAnswers(answersData)

      // Check if evaluation is needed (only for open-ended that haven't been evaluated)
      const needsEvaluation = answersData.some(a => {
        const question = questionsWithOptions.find(q => q.id === a.question_id)
        return question && question.question_type === 'open_ended' && !a.evaluated_at
      })

      if (needsEvaluation && attemptData.status === 'completed') {
        await evaluateAnswers(questionsWithOptions, answersData)
        // Reload answers after evaluation
        const { data: updatedAnswers } = await answerService.getByAttempt(attemptId!)
        if (updatedAnswers) setAnswers(updatedAnswers)
      } else {
        setAnswers(answersData)
      }

      // Load or calculate statistics
      let statsData = await statisticsService.getByAttempt(attemptId!)
      if (!statsData.data && answersData.length > 0) {
        // Calculate statistics if they don't exist
        // Filter out empty answers when counting skipped
        const answeredQuestions = answersData.filter(a => a.answer_text && a.answer_text.trim() !== '').map(a => a.question_id)
        const skippedCount = questionsWithOptions.filter(q => !answeredQuestions.includes(q.id)).length
        
        const correctCount = answersData.filter(a => a.is_correct === true && a.answer_text && a.answer_text.trim() !== '').length
        const incorrectCount = answersData.filter(a => a.is_correct === false && a.answer_text && a.answer_text.trim() !== '').length
        const partiallyCorrectCount = answersData.filter(a => 
          a.is_correct === undefined && a.score > 0 && a.score < questionsWithOptions.find(q => q.id === a.question_id)?.marks && a.answer_text && a.answer_text.trim() !== ''
        ).length
        
        const calculatedStats = {
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          partially_correct_count: partiallyCorrectCount,
          skipped_count: skippedCount,
          total_questions: questionsWithOptions.length,
        }
        
        await statisticsService.createOrUpdate({
          attempt_id: attemptId!,
          ...calculatedStats,
        })
        
        statsData = await statisticsService.getByAttempt(attemptId!)
      }
      
      if (statsData.data) setStatistics(statsData.data)
    } catch (error: any) {
      alert('Error loading results: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const evaluateAnswers = async (
    questionsData: (Question & { options?: QuestionOption[] })[],
    answersData: StudentAnswer[]
  ) => {
    setEvaluating(true)
    try {
      const { evaluatedAnswers, totalScore } = await evaluationService.evaluateAllAnswers(
        questionsData,
        answersData
      )

      // Update answers with evaluation results
      for (const evaluatedAnswer of evaluatedAnswers) {
        await answerService.update(evaluatedAnswer.id, {
          is_correct: evaluatedAnswer.is_correct,
          score: evaluatedAnswer.score,
          ai_evaluation: evaluatedAnswer.ai_evaluation,
          evaluated_at: evaluatedAnswer.evaluated_at,
        })
      }

      // Update attempt total score (round to whole number)
      await attemptService.update(attemptId!, { total_score: Math.round(totalScore) })

      // Calculate statistics
      // Filter out empty answers when counting skipped
      const answeredQuestions = evaluatedAnswers.filter(a => a.answer_text && a.answer_text.trim() !== '').map(a => a.question_id)
      const skippedCount = questionsData.filter(q => !answeredQuestions.includes(q.id)).length
      
      const stats = {
        correct_count: evaluatedAnswers.filter(a => a.is_correct === true && a.answer_text && a.answer_text.trim() !== '').length,
        incorrect_count: evaluatedAnswers.filter(a => a.is_correct === false && a.answer_text && a.answer_text.trim() !== '').length,
        partially_correct_count: evaluatedAnswers.filter(a => {
          const question = questionsData.find(q => q.id === a.question_id)
          return a.is_correct === undefined && a.score > 0 && question && a.score < question.marks && a.answer_text && a.answer_text.trim() !== ''
        }).length,
        skipped_count: skippedCount,
        total_questions: questionsData.length,
      }

      await statisticsService.createOrUpdate({
        attempt_id: attemptId!,
        ...stats,
      })

      // Reload data
      await loadResults()
    } catch (error: any) {
      alert('Error evaluating answers: ' + error.message)
    } finally {
      setEvaluating(false)
    }
  }

  const handleReattempt = () => {
    navigate(`/student/exams/${id}/take`)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!exam) {
    return <div>No results found</div>
  }

  // Calculate statistics if not available
  // Filter out empty answers when counting skipped
  const answeredQuestions = answers.filter(a => a.answer_text && a.answer_text.trim() !== '').map(a => a.question_id)
  const skippedCount = questions.filter(q => !answeredQuestions.includes(q.id)).length
  
  const calculatedStats = statistics || {
    correct_count: answers.filter(a => a.is_correct === true && a.answer_text && a.answer_text.trim() !== '').length,
    incorrect_count: answers.filter(a => a.is_correct === false && a.answer_text && a.answer_text.trim() !== '').length,
    partially_correct_count: answers.filter(a => {
      const question = questions.find(q => q.id === a.question_id)
      return a.is_correct === undefined && a.score > 0 && question && a.score < question.marks && a.answer_text && a.answer_text.trim() !== ''
    }).length,
    skipped_count: skippedCount,
    total_questions: questions.length,
  }

  const percentage = exam.total_marks > 0 ? (answers.reduce((sum, a) => sum + a.score, 0) / exam.total_marks) * 100 : 0

  return (
    <div className="mx-auto max-w-6xl w-full">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Exam Results</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">{exam.title}</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{calculatedStats.correct_count}</CardTitle>
              <CardDescription>Correct</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{calculatedStats.incorrect_count}</CardTitle>
              <CardDescription>Incorrect</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{calculatedStats.partially_correct_count}</CardTitle>
              <CardDescription>Partially Correct</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{calculatedStats.skipped_count}</CardTitle>
              <CardDescription>Skipped</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Score Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Score:</span>
                <span className="font-bold">{Math.round(answers.reduce((sum, a) => sum + a.score, 0))} / {exam.total_marks}</span>
              </div>
              <div className="flex justify-between">
                <span>Percentage:</span>
                <span className="font-bold">{Math.round((answers.reduce((sum, a) => sum + a.score, 0) / exam.total_marks) * 100)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 mb-6">
          <h2 className="text-2xl font-bold">Question Review</h2>
          {questions.map((question, index) => {
            const answer = answers.find(a => a.question_id === question.id)
            const hasAnswer = answer && answer.answer_text && answer.answer_text.trim() !== ''
            const isCorrect = answer?.is_correct === true
            const isIncorrect = answer?.is_correct === false
            // Partially correct: has answer, score > 0, and score < full marks (is_correct is undefined or null)
            // Handle both undefined and null from database
            const isPartiallyCorrect = hasAnswer && answer && 
              (answer.is_correct === undefined || answer.is_correct === null) && 
              answer.score > 0 && 
              answer.score < question.marks
            const isSkipped = !hasAnswer

            return (
              <Card key={question.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Question {index + 1}
                      {isCorrect && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                      {isIncorrect && <XCircle className="h-5 w-5 text-red-600" />}
                      {isPartiallyCorrect && (
                        <>
                          <AlertCircle className="h-5 w-5 text-yellow-600" />
                          <span className="text-sm font-normal text-yellow-600">Partially Correct</span>
                        </>
                      )}
                      {isSkipped && (
                        <>
                          <Circle className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-normal text-gray-500">Not Attempted</span>
                        </>
                      )}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      Score: {Math.round(answer?.score || 0)} / {question.marks}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    {question.question_type === 'fib' ? (
                      <div className="text-base leading-relaxed">
                        {isSkipped && (
                          <p className="text-sm text-gray-500 italic mb-2">You did not provide an answer for this question.</p>
                        )}
                        {renderFibQuestion(question.question_text).map((part, partIdx) => (
                          part.type === 'blank' ? (
                            <span key={partIdx} className="inline-flex items-center mx-2">
                              <Input
                                readOnly
                                className={`inline-flex h-12 min-w-[180px] max-w-[400px] border-2 rounded-lg px-4 py-2 text-base font-semibold ${
                                  isCorrect ? 'bg-green-50 border-green-500 text-green-900' : 
                                  isIncorrect ? 'bg-red-50 border-red-500 text-red-900' : 
                                  isPartiallyCorrect ? 'bg-yellow-100 border-yellow-600 text-yellow-900' :
                                  'bg-gray-50 border-gray-300 text-gray-900'
                                }`}
                                style={{ borderWidth: '2px' }}
                                value={answer?.answer_text || (isSkipped ? 'Not Attempted' : '')}
                                placeholder={isSkipped ? 'Not Attempted' : ''}
                              />
                            </span>
                          ) : (
                            <span key={partIdx} className="text-gray-800">{part.content}</span>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="font-medium">{question.question_text}</p>
                    )}
                  </div>

                  {question.question_type === 'mcq' && question.options && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Options:</p>
                      {isSkipped && (
                        <p className="text-sm text-gray-500 italic mb-2">You did not select an answer for this question.</p>
                      )}
                      {question.options.map((option, optIdx) => {
                        const isSelected = answer?.answer_text === option.id
                        const isCorrectOption = option.is_correct
                        return (
                          <div
                            key={option.id}
                            className={`p-2 rounded border ${
                              isCorrectOption ? 'bg-green-50 border-green-500' : isSelected && !isCorrectOption ? 'bg-red-50 border-red-500' : 'bg-gray-50'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}. {option.option_text}
                            {isCorrectOption && <span className="ml-2 text-green-600">✓ Correct Answer</span>}
                            {isSelected && <span className="ml-2">Your Answer</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* For partially correct open-ended: show student answer, then model answer, then how to improve */}
                  {question.question_type === 'open_ended' && isPartiallyCorrect && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
                        <p className="p-2 rounded border bg-yellow-50 border-yellow-500 whitespace-pre-wrap">
                          {answer?.answer_text}
                        </p>
                      </div>
                      {question.model_answer && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-2">Model Answer:</p>
                          <p className="p-2 rounded border bg-green-50 border-green-500 whitespace-pre-wrap">
                            {question.model_answer}
                          </p>
                        </div>
                      )}
                      {answer?.ai_evaluation?.how_to_improve && (
                        <div className="p-4 bg-blue-50 rounded border border-blue-200">
                          <p className="text-sm font-medium mb-2">How to Improve:</p>
                          <p className="text-sm">{answer.ai_evaluation.how_to_improve}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Show model answer for partially correct FIB questions */}
                  {question.question_type === 'fib' && isPartiallyCorrect && (
                    <div className="space-y-2 mt-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Model Answer:</p>
                        <p className="p-2 rounded border bg-green-50 border-green-500">
                          {question.correct_answer || question.model_answer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Show student answer and model answer for incorrect open-ended questions (but not skipped) */}
                  {question.question_type === 'open_ended' && isIncorrect && !isSkipped && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
                        <p className="p-2 rounded border bg-red-50 border-red-500">
                          {answer?.answer_text}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Model Answer:</p>
                        <p className="p-2 rounded border bg-green-50 border-green-500">
                          {question.model_answer || question.correct_answer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Show model answer for incorrect and skipped questions (non-open-ended, non-FIB) */}
                  {/* Note: For FIB, student answer is already shown in the question blank, so we only show model answer for incorrect/skipped */}
                  {(isIncorrect || isSkipped) && question.question_type !== 'open_ended' && question.question_type !== 'fib' && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Model Answer:</p>
                        {question.question_type === 'mcq' && question.options ? (
                          <div className="p-2 rounded border bg-green-50 border-green-500">
                            {(() => {
                              const correctOption = question.options.find(opt => opt.is_correct)
                              if (correctOption) {
                                const optionIndex = question.options.indexOf(correctOption)
                                return `${String.fromCharCode(65 + optionIndex)}. ${correctOption.option_text}`
                              }
                              return question.correct_answer || question.model_answer
                            })()}
                          </div>
                        ) : (
                          <p className="p-2 rounded border bg-green-50 border-green-500">
                            {question.correct_answer || question.model_answer}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Show model answer for incorrect and skipped FIB questions */}
                  {/* Student answer is already visible in the question blank above */}
                  {(isIncorrect || isSkipped) && question.question_type === 'fib' && (
                    <div className="space-y-2 mt-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Model Answer:</p>
                        <p className="p-2 rounded border bg-green-50 border-green-500">
                          {question.correct_answer || question.model_answer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Show your answer and model answer for skipped open-ended questions */}
                  {question.question_type === 'open_ended' && isSkipped && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
                        <p className="p-2 rounded border bg-gray-50 border-gray-300 text-gray-500 italic">
                          Not Attempted
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Model Answer:</p>
                        <p className="p-2 rounded border bg-green-50 border-green-500">
                          {question.model_answer || question.correct_answer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Show your answer for correct open-ended questions (no model answer needed) */}
                  {question.question_type === 'open_ended' && isCorrect && (
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Your Answer:</p>
                        <p className="p-2 rounded border bg-green-50 border-green-500">
                          {answer?.answer_text}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex gap-4">
          <Button variant="outline" onClick={() => navigate('/student/dashboard', { replace: true })}>
            Back to Dashboard
          </Button>
          <Button onClick={handleReattempt}>
            Reattempt Exam
          </Button>
        </div>
      </div>
  )
}

