import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService } from '@/lib/examService'
import { qualificationService, examBoardService, subjectService } from '@/lib/qualificationService'
import { assignmentService, type AssignmentWithExam } from '@/lib/classService'
import { BookOpen, Calendar } from 'lucide-react'

export function StudentDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [assignedExams, setAssignedExams] = useState<(AssignmentWithExam & { qualification_name?: string; exam_board_name?: string; subject_name?: string })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAssignedExams()
  }, [])

  const loadAssignedExams = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data } = await assignmentService.getByStudent(user.id)
      if (!data || data.length === 0) {
        setAssignedExams([])
        setLoading(false)
        return
      }

      // Batch load all exams at once
      const examIds = data.map(a => a.exam_id).filter(Boolean)
      const examPromises = examIds.map(id => examService.getById(id))
      const examResults = await Promise.all(examPromises)
      const exams = examResults.map(r => r.data).filter(Boolean)

      // Get unique qualification, exam board, and subject IDs
      const qualificationIds = [...new Set(exams.map(e => e.qualification_id).filter(Boolean))]
      const examBoardIds = [...new Set(exams.map(e => e.exam_board_id).filter(Boolean))]
      const subjectIds = [...new Set(exams.map(e => e.subject_id).filter(Boolean))]

      // Batch load all qualifications, exam boards, and subjects at once
      const [qualificationsResult, allExamBoardsResult, allSubjectsResult] = await Promise.all([
        qualificationService.getAll(),
        examBoardService.getAll(),
        subjectService.getAll(),
      ])

      // Filter to only the ones we need
      const qualifications = qualificationsResult.data || []
      const examBoards = (allExamBoardsResult.data || []).filter(b => examBoardIds.includes(b.id))
      const subjects = (allSubjectsResult.data || []).filter(s => subjectIds.includes(s.id))

      // Create lookup maps for O(1) access
      const qualMap = new Map(qualifications.map(q => [q.id, q]))
      const boardMap = new Map(examBoards.map(b => [b.id, b]))
      const subjectMap = new Map(subjects.map(s => [s.id, s]))
      const examMap = new Map(exams.map(e => [e.id, e]))

      // Enrich assignments efficiently
      const enrichedAssignments = data
        .map(assignment => {
          const exam = examMap.get(assignment.exam_id)
          if (!exam) return null

          const qual = qualMap.get(exam.qualification_id)
          const board = boardMap.get(exam.exam_board_id)
          const subject = subjectMap.get(exam.subject_id)

          return {
            ...assignment,
            qualification_name: qual?.name,
            exam_board_name: board?.name,
            subject_name: subject?.name,
          }
        })
        .filter(Boolean) as any

      setAssignedExams(enrichedAssignments)
    } catch (error) {
      console.error('Error loading assigned exams:', error)
      setAssignedExams([])
    } finally {
      setLoading(false)
    }
  }


  if (!user || !profile) {
    return <div>Loading...</div>
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Student Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {profile?.full_name || user?.email}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/student/attempts')}>
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
              <p>Loading exams...</p>
            ) : assignedExams.length === 0 ? (
              <p className="text-muted-foreground">
                No exams have been assigned to you yet. Contact your teacher to get assigned exams.
              </p>
            ) : (
              <div className="space-y-4">
                {assignedExams.map((assignment) => (
                  <Card key={assignment.id} className="cursor-pointer hover:bg-accent transition-colors border-primary/20" onClick={() => navigate(`/student/exams/${assignment.exam_id}/take`)}>
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
                        <Button onClick={(e) => { e.stopPropagation(); navigate(`/student/exams/${assignment.exam_id}/take`) }}>
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
