import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { examService, type Exam } from '@/lib/examService'
import { Edit2, Trash2, Eye, Copy, CheckCircle2, XCircle } from 'lucide-react'

interface ExamListProps {
  teacherId: string
}

export function ExamList({ teacherId }: ExamListProps) {
  const navigate = useNavigate()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExams()
  }, [teacherId])

  const loadExams = async () => {
    setLoading(true)
    const { data, error } = await examService.getByTeacher(teacherId)
    if (!error && data) {
      setExams(data)
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam?')) return
    const { error } = await examService.delete(id)
    if (!error) {
      await loadExams()
    }
  }

  const handlePublish = async (id: string, currentStatus: boolean) => {
    if (currentStatus) {
      await examService.unpublish(id)
    } else {
      await examService.publish(id)
    }
    await loadExams()
  }

  const handleDuplicate = async (exam: Exam) => {
    // Create a copy of the exam
    const { data: newExam, error } = await examService.create({
      ...exam,
      title: `${exam.title} (Copy)`,
      is_published: false,
    })
    if (!error && newExam) {
      navigate(`/teacher/exams/${newExam.id}/edit`)
    }
  }

  if (loading) {
    return <p>Loading exams...</p>
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
}

