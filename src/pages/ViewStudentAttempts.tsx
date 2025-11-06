import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService, attemptService, answerService, questionService, statisticsService, type Exam, type ExamAttempt, type Question, type QuestionOption, type StudentAnswer, type ExamStatistics } from '@/lib/examService'
import { CheckCircle2, XCircle, AlertCircle, Circle, ArrowLeft, User } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export function ViewStudentAttempts() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [exam, setExam] = useState<Exam | null>(null)
  const [attempts, setAttempts] = useState<(ExamAttempt & { student_name?: string; student_email?: string })[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<string | null>(null)
  const [questions, setQuestions] = useState<(Question & { options?: QuestionOption[] })[]>([])
  const [answers, setAnswers] = useState<StudentAnswer[]>([])
  const [statistics, setStatistics] = useState<ExamStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAttempt, setLoadingAttempt] = useState(false)
  
  // Check if we're in single/focused view mode (from grades page)
  const isSingleView = searchParams.get('single') === 'true' || searchParams.get('focus') === 'true'

  useEffect(() => {
    if (id && user) {
      if (isSingleView) {
        // In single view, only load the exam and the specific attempt
        loadExamAndSingleAttempt()
      } else {
        loadExamAndAttempts()
      }
    }
  }, [id, user, isSingleView])

  useEffect(() => {
    // If there's an attempt query parameter, load that attempt
    const attemptId = searchParams.get('attempt')
    if (attemptId) {
      if (isSingleView && exam) {
        // In single view, load attempt details directly
        loadAttemptDetails(attemptId)
      } else if (attempts.length > 0 && selectedAttempt !== attemptId) {
        const attempt = attempts.find(a => a.id === attemptId)
        if (attempt) {
          loadAttemptDetails(attemptId)
        }
      }
    }
  }, [searchParams, attempts, selectedAttempt, isSingleView, exam])

  const loadExamAndAttempts = async () => {
    setLoading(true)
    try {
      // Load exam
      const { data: examData, error: examError } = await examService.getById(id!)
      if (examError || !examData) throw examError
      setExam(examData)

      // Verify teacher owns this exam
      if (examData.teacher_id !== user!.id) {
        alert('You do not have permission to view this exam')
        navigate('/teacher/dashboard')
        return
      }

      // Load attempts
      const { data: attemptsData, error: attemptsError } = await attemptService.getByExam(id!)
      if (attemptsError) throw attemptsError

      // Enrich with student information
      const enrichedAttempts = await Promise.all(
        (attemptsData || []).map(async (attempt) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', attempt.student_id)
            .single()
          
          return {
            ...attempt,
            student_name: profile?.full_name || 'Unknown',
            student_email: profile?.email || 'Unknown',
          }
        })
      )

      setAttempts(enrichedAttempts)
    } catch (error: any) {
      alert('Error loading exam: ' + error.message)
      navigate('/teacher/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadExamAndSingleAttempt = async () => {
    setLoading(true)
    try {
      // Load exam
      const { data: examData, error: examError } = await examService.getById(id!)
      if (examError || !examData) throw examError
      setExam(examData)

      // Verify teacher owns this exam
      if (examData.teacher_id !== user!.id) {
        alert('You do not have permission to view this exam')
        navigate('/teacher/dashboard')
        return
      }

      // Load the specific attempt first to get the student ID
      const attemptId = searchParams.get('attempt')
      if (attemptId) {
        const { data: attemptData, error: attemptError } = await attemptService.getById(attemptId)
        if (attemptError || !attemptData) throw attemptError

        // Verify this attempt belongs to this exam
        if (attemptData.exam_id !== id) {
          alert('Attempt does not belong to this exam')
          navigate('/teacher/dashboard')
          return
        }

        // Get student info
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', attemptData.student_id)
          .single()

        // Load ALL attempts by this student for this exam (to show previous attempts)
        const { data: allStudentAttempts, error: attemptsError } = await attemptService.getByExam(id!)
        if (attemptsError) throw attemptsError

        // Filter to only this student's attempts
        const studentAttempts = (allStudentAttempts || []).filter(
          a => a.student_id === attemptData.student_id
        )

        // Enrich with student information
        const enrichedAttempts = await Promise.all(
          studentAttempts.map(async (attempt) => {
            return {
              ...attempt,
              student_name: profile?.full_name || 'Unknown',
              student_email: profile?.email || 'Unknown',
            }
          })
        )

        // Sort by submission date, most recent first
        enrichedAttempts.sort((a, b) => {
          const dateA = new Date(a.submitted_at || a.started_at || a.created_at || 0).getTime()
          const dateB = new Date(b.submitted_at || b.started_at || b.created_at || 0).getTime()
          return dateB - dateA
        })

        setAttempts(enrichedAttempts)
        setSelectedAttempt(attemptId)
        await loadAttemptDetails(attemptId)
      }
    } catch (error: any) {
      alert('Error loading exam: ' + error.message)
      navigate('/teacher/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadAttemptDetails = async (attemptId: string) => {
    setLoadingAttempt(true)
    setSelectedAttempt(attemptId)
    try {
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

      // Load answers
      const { data: answersData, error: answersError } = await answerService.getByAttempt(attemptId)
      if (answersError) throw answersError
      setAnswers(answersData || [])

      // Load statistics
      const { data: statsData } = await statisticsService.getByAttempt(attemptId)
      setStatistics(statsData)
    } catch (error: any) {
      alert('Error loading attempt details: ' + error.message)
    } finally {
      setLoadingAttempt(false)
    }
  }

  const renderFibQuestion = (questionText: string) => {
    const blankPattern = /(\[blank\]|\[[^\]]+\]|_{3,}|_____+)/gi
    
    if (!blankPattern.test(questionText)) {
      return [{ type: 'text' as const, content: questionText }]
    }
    
    blankPattern.lastIndex = 0
    
    const parts: Array<{ type: 'text' | 'blank', content: string, index?: number }> = []
    let lastIndex = 0
    let blankIndex = 0
    let match
    
    while ((match = blankPattern.exec(questionText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: questionText.substring(lastIndex, match.index) })
      }
      
      parts.push({ type: 'blank', content: '', index: blankIndex })
      blankIndex++
      
      lastIndex = match.index + match[0].length
    }
    
    if (lastIndex < questionText.length) {
      parts.push({ type: 'text', content: questionText.substring(lastIndex) })
    }
    
    return parts
  }

  if (loading || !exam) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const selectedAttemptData = attempts.find(a => a.id === selectedAttempt)

  return (
    <div className="mx-auto max-w-6xl w-full px-4 sm:px-6">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-4">
          <Button 
            variant="outline" 
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              if (isSingleView) {
                navigate('/teacher/grades')
              } else {
                navigate('/teacher/dashboard')
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {isSingleView ? 'Back to Grades' : 'Back to Dashboard'}
          </Button>
        </div>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">
          {isSingleView && selectedAttemptData 
            ? `${selectedAttemptData.student_name}'s Attempt` 
            : 'Student Attempts'}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base break-words">{exam.title}</p>
      </div>

      <div className={isSingleView ? 'grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start' : 'grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 items-start'}>
        {/* Attempts List - Shows all attempts in normal view, only student's attempts in single view */}
        <div className="lg:col-span-1 order-2 lg:order-1 lg:sticky lg:top-4">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg break-words">
                {isSingleView && selectedAttemptData 
                  ? `${selectedAttemptData.student_name}'s Attempts` 
                  : `Attempts (${attempts.length})`}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {isSingleView 
                  ? `Previous attempts by this student` 
                  : 'All student attempts for this exam'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              {attempts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No attempts yet</p>
              ) : (
                <div className="space-y-2">
                  {attempts.map((attempt) => (
                    <Card
                      key={attempt.id}
                      className={`cursor-pointer hover:bg-accent transition-colors ${
                        selectedAttempt === attempt.id ? 'bg-accent border-2 border-primary' : ''
                      }`}
                      onClick={() => {
                        // Update URL to reflect the selected attempt
                        const newSearchParams = new URLSearchParams(searchParams)
                        newSearchParams.set('attempt', attempt.id)
                        if (isSingleView) {
                          newSearchParams.set('single', 'true')
                        }
                        navigate(`/teacher/exams/${id}/attempts?${newSearchParams.toString()}`, { replace: true })
                        loadAttemptDetails(attempt.id)
                      }}
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            {!isSingleView && (
                              <>
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                  <p className="font-medium text-xs sm:text-sm truncate">{attempt.student_name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2 truncate">
                                  {attempt.student_email}
                                </p>
                              </>
                            )}
                            <div className="flex items-center gap-2 text-xs mb-2">
                              <span className={`px-2 py-1 rounded whitespace-nowrap ${
                                attempt.status === 'completed' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                              </span>
                            </div>
                            {attempt.status === 'completed' && (
                              <p className="text-xs font-semibold mb-1 break-words">
                                Score: {Math.round(attempt.total_score)} / {exam.total_marks}
                                {exam.total_marks > 0 && (
                                  <span className="text-muted-foreground ml-1">
                                    ({Math.round((attempt.total_score / exam.total_marks) * 100)}%)
                                  </span>
                                )}
                              </p>
                            )}
                            {attempt.submitted_at && (
                              <p className="text-xs text-muted-foreground break-words">
                                <span className="hidden sm:inline">
                                  {new Date(attempt.submitted_at).toLocaleDateString()} {new Date(attempt.submitted_at).toLocaleTimeString()}
                                </span>
                                <span className="sm:hidden">
                                  {new Date(attempt.submitted_at).toLocaleDateString()}
                                </span>
                              </p>
                            )}
                            {!attempt.submitted_at && attempt.started_at && (
                              <p className="text-xs text-muted-foreground break-words">
                                Started: {new Date(attempt.started_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attempt Details */}
        <div className={isSingleView ? 'col-span-1 order-1 lg:order-2 lg:col-span-2' : 'lg:col-span-2 order-1'}>
          {!selectedAttempt ? (
            <Card>
              <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
                <p className="text-sm sm:text-base">Select an attempt to view details</p>
              </CardContent>
            </Card>
          ) : loadingAttempt ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Student Info Card - Enhanced for single view */}
              {selectedAttemptData && (
                <Card className={isSingleView ? 'border-2' : ''}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <User className="h-4 w-4 sm:h-5 sm:w-5" />
                      {isSingleView ? 'Student Information' : 'Score Summary'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={isSingleView ? 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4' : 'space-y-2'}>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                        <span className="text-muted-foreground text-sm">Student:</span>
                        <span className="font-bold text-sm sm:text-base break-words">{selectedAttemptData.student_name}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                        <span className="text-muted-foreground text-sm">Email:</span>
                        <span className="font-medium text-sm sm:text-base break-words truncate">{selectedAttemptData.student_email}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                        <span className="text-muted-foreground text-sm">Total Score:</span>
                        <span className="font-bold text-base sm:text-lg">
                          {Math.round(answers.reduce((sum, a) => sum + a.score, 0))} / {exam.total_marks}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2">
                        <span className="text-muted-foreground text-sm">Percentage:</span>
                        <span className="font-bold text-base sm:text-lg">
                          {Math.round((answers.reduce((sum, a) => sum + a.score, 0) / exam.total_marks) * 100)}%
                        </span>
                      </div>
                      {selectedAttemptData.submitted_at && (
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 sm:col-span-2">
                          <span className="text-muted-foreground text-sm">Submitted:</span>
                          <span className="font-medium text-sm sm:text-base break-words">
                            <span className="hidden sm:inline">
                              {new Date(selectedAttemptData.submitted_at).toLocaleString()}
                            </span>
                            <span className="sm:hidden">
                              {new Date(selectedAttemptData.submitted_at).toLocaleDateString()}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary Statistics */}
              {statistics && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-xl sm:text-2xl text-green-600">{statistics.correct_count}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Correct</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-xl sm:text-2xl text-red-600">{statistics.incorrect_count}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Incorrect</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-xl sm:text-2xl text-yellow-600">{statistics.partially_correct_count}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Partially Correct</CardDescription>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2 sm:pb-3">
                      <CardTitle className="text-xl sm:text-2xl text-gray-600">{statistics.skipped_count}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">Skipped</CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              )}

              {/* Question Review */}
              <div className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-bold">Question Review</h2>
                {questions.map((question, index) => {
                  const answer = answers.find(a => a.question_id === question.id)
                  const isCorrect = answer?.is_correct
                  const isPartiallyCorrect = answer && answer.is_correct === undefined && answer.score > 0 && answer.score < question.marks
                  const isSkipped = !answer

                  return (
                    <Card key={question.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            Question {index + 1}
                            {isCorrect === true && <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />}
                            {isCorrect === false && <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />}
                            {isPartiallyCorrect && <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 flex-shrink-0" />}
                            {isSkipped && <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0" />}
                          </CardTitle>
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            Score: {answer?.score || 0} / {question.marks}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6">
                        <div>
                          {question.question_type === 'fib' ? (
                            <div className="text-base whitespace-pre-wrap inline-flex flex-wrap items-center gap-2">
                              {renderFibQuestion(question.question_text).map((part, partIdx) => (
                                part.type === 'blank' ? (
                                  <div
                                    key={partIdx}
                                    className={`inline-flex h-10 min-w-[120px] max-w-[300px] border-2 rounded-md px-3 py-2 text-sm font-medium ${
                                      isCorrect ? 'bg-green-50 border-green-500 text-green-900' : 
                                      isCorrect === false ? 'bg-red-50 border-red-500 text-red-900' : 
                                      'bg-yellow-100 border-yellow-600 text-yellow-900'
                                    }`}
                                    style={{ borderWidth: '2px' }}
                                  >
                                    {answer?.answer_text || ''}
                                  </div>
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
                            {question.options.map((option, optIdx) => {
                              const isSelected = answer?.answer_text === option.id
                              const isCorrectOption = option.is_correct
                              return (
                                <div
                                  key={option.id}
                                  className={`p-2 rounded border ${
                                    isCorrectOption ? 'bg-green-50 border-green-500' : 
                                    isSelected && !isCorrectOption ? 'bg-red-50 border-red-500' : 
                                    'bg-gray-50'
                                  }`}
                                >
                                  {String.fromCharCode(65 + optIdx)}. {option.option_text}
                                  {isCorrectOption && <span className="ml-2 text-green-600">✓ Correct Answer</span>}
                                  {isSelected && <span className="ml-2">Student's Answer</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {question.question_type === 'fib' && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Student's Answer:</p>
                              <p className="p-2 rounded border bg-gray-50">
                                {answer?.answer_text || 'Not answered'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Correct Answer:</p>
                              <p className="p-2 rounded border bg-green-50 border-green-500">
                                {question.correct_answer || question.model_answer}
                              </p>
                            </div>
                          </div>
                        )}

                        {question.question_type === 'open_ended' && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Student's Answer:</p>
                              <p className={`p-2 rounded border ${isCorrect ? 'bg-green-50 border-green-500' : isCorrect === false ? 'bg-red-50 border-red-500' : 'bg-gray-50'}`}>
                                {answer?.answer_text || 'Not answered'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Model Answer:</p>
                              <p className="p-2 rounded border bg-green-50 border-green-500">
                                {question.correct_answer || question.model_answer}
                              </p>
                            </div>
                          </div>
                        )}

                        {question.question_type === 'open_ended' && answer?.ai_evaluation && (
                          <div className="mt-4 p-4 bg-blue-50 rounded border border-blue-200">
                            <p className="text-sm font-medium mb-2">AI Feedback:</p>
                            <p className="text-sm">{answer.ai_evaluation.feedback}</p>
                            {answer.ai_evaluation.evaluation_metadata && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <p>Accuracy: {answer.ai_evaluation.evaluation_metadata.accuracy}%</p>
                                <p>Completeness: {answer.ai_evaluation.evaluation_metadata.completeness}%</p>
                                <p>Relevance: {answer.ai_evaluation.evaluation_metadata.relevance}%</p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

