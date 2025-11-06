import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { attemptService, examService, type ExamAttempt, type Exam } from '@/lib/examService'
import { subjectService } from '@/lib/qualificationService'
import { ArrowLeft, CheckCircle2, Clock, Eye, Loader2 } from 'lucide-react'

export function StudentAttemptHistory() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<(ExamAttempt & { exam?: Exam })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadAttempts()
    }
  }, [user])

  const loadAttempts = async () => {
    setLoading(true)
    try {
      // Load all attempts for the student
      const { data: attemptsData, error: attemptsError } = await attemptService.getByStudent(user!.id)
      if (attemptsError) throw attemptsError

      // Enrich with exam information
      const enrichedAttempts = await Promise.all(
        (attemptsData || []).map(async (attempt) => {
          const { data: examData } = await examService.getById(attempt.exam_id)
          let subjectName: string | undefined
          if (examData) {
            const { data: subject } = await subjectService.getByExamBoard(examData.exam_board_id)
            subjectName = subject?.find(s => s.id === examData.subject_id)?.name
          }
          return {
            ...attempt,
            exam: examData ? { ...examData, subject_name: subjectName } : undefined,
          }
        })
      )

      setAttempts(enrichedAttempts)
    } catch (error: any) {
      alert('Error loading attempt history: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleViewResults = (examId: string, attemptId: string) => {
    navigate(`/student/exams/${examId}/results?attempt=${attemptId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" onClick={() => navigate('/student/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-3xl font-bold">My Attempt History</h1>
        <p className="text-muted-foreground mt-2">View all your exam attempts and results</p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No attempts yet</p>
            <p className="text-sm">Start taking exams to see your attempt history here.</p>
            <Button className="mt-4" onClick={() => navigate('/student/dashboard')}>
              Browse Exams
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => (
            <Card key={attempt.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">
                      {attempt.exam?.title || 'Unknown Exam'}
                    </CardTitle>
                    <CardDescription className="space-y-1">
                      {attempt.exam && (
                        <>
                          {attempt.exam.subject_name && (
                            <div>Subject: {attempt.exam.subject_name}</div>
                          )}
                          <div>Total Marks: {attempt.exam.total_marks}</div>
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {attempt.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      attempt.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Started: </span>
                        <span className="font-medium">
                          {new Date(attempt.started_at).toLocaleString()}
                        </span>
                      </div>
                      {attempt.submitted_at && (
                        <div>
                          <span className="text-muted-foreground">Submitted: </span>
                          <span className="font-medium">
                            {new Date(attempt.submitted_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {attempt.status === 'completed' && attempt.exam && (
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Score: </span>
                          <span className="font-bold text-lg">
                            {Math.round(attempt.total_score)} / {attempt.exam.total_marks}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Percentage: </span>
                          <span className="font-bold text-lg">
                            {Math.round((attempt.total_score / attempt.exam.total_marks) * 100)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  {attempt.status === 'completed' && (
                    <Button onClick={() => handleViewResults(attempt.exam_id, attempt.id)}>
                      <Eye className="h-4 w-4 mr-2" />
                      View Results
                    </Button>
                  )}
                  {attempt.status === 'in_progress' && attempt.exam && (
                    <Button onClick={() => navigate(`/student/exams/${attempt.exam_id}/take`)}>
                      Continue Exam
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

