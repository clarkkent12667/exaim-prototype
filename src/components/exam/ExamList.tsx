import { useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { examService, type Exam } from '@/lib/examService'
import { useExamsByTeacher, useDeleteExam, useToggleExamPublish } from '@/hooks/useExams'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, Trash2, Eye, Copy, CheckCircle2, XCircle } from 'lucide-react'
import { ListSkeleton } from '@/components/ui/page-skeleton'

interface ExamListProps {
  teacherId: string
}

export const ExamList = memo(function ExamList({ teacherId }: ExamListProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Use React Query for data fetching with automatic caching
  const { data: exams = [], isLoading } = useExamsByTeacher(teacherId)
  const deleteExam = useDeleteExam()
  const togglePublish = useToggleExamPublish()
  
  // Mutation for duplicating exam
  const duplicateExam = useMutation({
    mutationFn: async (exam: Exam) => {
      const { data: newExam, error } = await examService.create({
        ...exam,
        title: `${exam.title} (Copy)`,
        is_published: false,
      })
      if (error) throw error
      return newExam
    },
    onSuccess: (newExam) => {
      // Invalidate exams list to show the new exam
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      navigate(`/teacher/exams/${newExam.id}/edit`)
    },
  })

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return
    deleteExam.mutate(id)
  }, [deleteExam])

  const handlePublish = useCallback(async (id: string, currentStatus: boolean) => {
    togglePublish.mutate({ examId: id, publish: !currentStatus })
  }, [togglePublish])

  const handleDuplicate = useCallback(async (exam: Exam) => {
    duplicateExam.mutate(exam)
  }, [duplicateExam])

  if (isLoading) {
    return <ListSkeleton count={3} />
  }

  return (
    <div className="space-y-4">
      {exams.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No exams created yet. Create your first exam to get started.
          </CardContent>
        </Card>
      ) : (
        exams.map((exam) => (
          <Card key={exam.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {exam.description || 'No description'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {exam.is_published ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-gray-400" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {exam.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Difficulty: {exam.difficulty}</span>
                  <span>Total Marks: {exam.total_marks}</span>
                  {exam.time_limit_minutes && (
                    <span>Time Limit: {exam.time_limit_minutes} min</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/teacher/exams/${exam.id}/attempts`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Attempts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePublish(exam.id, exam.is_published)}
                  >
                    {exam.is_published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/teacher/exams/${exam.id}/edit`)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(exam)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(exam.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
})

