import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStudentAssignments } from '@/hooks/useAssignments'
import { BookOpen, Calendar } from 'lucide-react'
import { ListSkeleton } from '@/components/ui/page-skeleton'

export function StudentDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  
  // Use React Query hook for optimized data fetching with caching
  const { data: assignedExams = [], isLoading: loading } = useStudentAssignments(user?.id || '')
  
  const handleTakeExam = useCallback((examId: string) => {
    navigate(`/student/exams/${examId}/take`)
  }, [navigate])


  if (!user || !profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="mx-auto max-w-6xl w-full">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Student Dashboard</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Welcome back, {profile?.full_name || user?.email}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/student/attempts')} className="w-full sm:w-auto">
            View My Attempt History
          </Button>
        </div>
      </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              My Assigned Exams
            </CardTitle>
            <CardDescription>
              Exams assigned to you by your teachers. You can only see exams that have been assigned to your classes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <ListSkeleton count={3} />
            ) : assignedExams.length === 0 ? (
              <p className="text-muted-foreground">
                No exams have been assigned to you yet. Contact your teacher to get assigned exams.
              </p>
            ) : (
              <div className="space-y-4">
                {assignedExams.map((assignment) => (
                  <Card key={assignment.id} className="cursor-pointer hover:bg-accent transition-colors border-primary/20" onClick={() => handleTakeExam(assignment.exam_id)}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {assignment.exam_title}
                            <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-1 rounded">Assigned</span>
                          </CardTitle>
                          <CardDescription>
                            {assignment.subject_name} • {assignment.exam_board_name} • {assignment.qualification_name}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex gap-4 text-sm text-muted-foreground">
                          <span>Total Marks: {assignment.exam_total_marks}</span>
                          {assignment.due_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Due: {new Date(assignment.due_date).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <Button onClick={(e) => { e.stopPropagation(); handleTakeExam(assignment.exam_id) }}>
                          Take Exam
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
