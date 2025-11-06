import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { attemptService, examService, type ExamAttempt, type Exam } from '@/lib/examService'
import { subjectService } from '@/lib/qualificationService'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, CheckCircle2, Clock, Eye, Loader2, User } from 'lucide-react'

interface EnrichedAttempt extends ExamAttempt {
  exam?: Exam & { subject_name?: string }
  student_name?: string
  student_email?: string
}

export function AllStudentAttempts() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<EnrichedAttempt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadAttempts()
    }
  }, [user])

  const loadAttempts = async () => {
    setLoading(true)
    try {
      // Get all exams for this teacher
      const { data: exams, error: examsError } = await examService.getByTeacher(user!.id)
      if (examsError) throw examsError

      if (!exams || exams.length === 0) {
        setAttempts([])
        setLoading(false)
        return
      }

      // Get all attempts for all teacher's exams
      const allAttempts: ExamAttempt[] = []
      for (const exam of exams) {
        const { data: examAttempts, error: attemptsError } = await attemptService.getByExam(exam.id)
        if (!attemptsError && examAttempts) {
          allAttempts.push(...examAttempts)
        }
      }

      // Enrich with exam and student information
      const enrichedAttempts = await Promise.all(
        allAttempts.map(async (attempt) => {
          // Get exam info
          const exam = exams.find(e => e.id === attempt.exam_id)
          let subjectName: string | undefined
          if (exam) {
            const { data: subject } = await subjectService.getByExamBoard(exam.exam_board_id)
            subjectName = subject?.find(s => s.id === exam.subject_id)?.name
          }

          // Get student info
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', attempt.student_id)
            .single()

          return {
            ...attempt,
            exam: exam ? { ...exam, subject_name: subjectName } : undefined,
            student_name: profile?.full_name || 'Unknown',
            student_email: profile?.email || 'Unknown',
          }
        })
      )

      // Sort by most recent first
      enrichedAttempts.sort((a, b) => {
        const dateA = new Date(a.created_at || a.started_at).getTime()
        const dateB = new Date(b.created_at || b.started_at).getTime()
        return dateB - dateA
      })

      setAttempts(enrichedAttempts)
    } catch (error: any) {
      alert('Error loading student attempts: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleViewAttempt = (examId: string, attemptId: string) => {
    navigate(`/teacher/exams/${examId}/attempts?attempt=${attemptId}`)
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
          <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-3xl font-bold">All Student Attempts</h1>
        <p className="text-muted-foreground mt-2">View all student attempts across all your exams</p>
      </div>

      {attempts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No student attempts yet</p>
            <p className="text-sm">Students' attempts on your exams will appear here.</p>
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
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span className="font-medium">{attempt.student_name}</span>
                        <span className="text-muted-foreground">({attempt.student_email})</span>
                      </div>
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
                  <Button onClick={() => handleViewAttempt(attempt.exam_id, attempt.id)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


