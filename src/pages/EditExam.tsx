import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService, questionService, type Exam, type Question } from '@/lib/examService'
import { qualificationService, examBoardService, subjectService, topicService, subtopicService } from '@/lib/qualificationService'
import type { Qualification, ExamBoard, Subject, Topic, Subtopic } from '@/lib/qualificationService'
import Select from 'react-select'
import { Loader2 } from 'lucide-react'

export function EditExam() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<(Question & { options?: any[] })[]>([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    qualification_id: '',
    exam_board_id: '',
    subject_id: '',
    topic_id: '',
    subtopic_id: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    time_limit_minutes: '',
  })

  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])

  useEffect(() => {
    if (id && user) {
      loadExam()
    }
  }, [id, user])

  useEffect(() => {
    if (formData.qualification_id && formData.qualification_id.trim() !== '') {
      loadExamBoards(formData.qualification_id)
    } else {
      setExamBoards([])
      setSubjects([])
      setTopics([])
      setSubtopics([])
    }
  }, [formData.qualification_id])

  useEffect(() => {
    if (formData.exam_board_id && formData.exam_board_id.trim() !== '') {
      loadSubjects(formData.exam_board_id)
    } else {
      setSubjects([])
      setTopics([])
      setSubtopics([])
    }
  }, [formData.exam_board_id])

  useEffect(() => {
    if (formData.subject_id && formData.subject_id.trim() !== '') {
      loadTopics(formData.subject_id)
    } else {
      setTopics([])
      setSubtopics([])
    }
  }, [formData.subject_id])

  useEffect(() => {
    if (formData.topic_id && formData.topic_id.trim() !== '') {
      loadSubtopics(formData.topic_id)
    } else {
      setSubtopics([])
    }
  }, [formData.topic_id])

  const loadExam = async () => {
    setLoading(true)
    try {
      // Load exam
      const { data: examData, error: examError } = await examService.getById(id!)
      if (examError || !examData) throw examError

      // Verify ownership
      if (examData.teacher_id !== user!.id) {
        alert('You do not have permission to edit this exam')
        navigate('/teacher/dashboard')
        return
      }

      setExam(examData)
      setFormData({
        title: examData.title,
        description: examData.description || '',
        qualification_id: examData.qualification_id,
        exam_board_id: examData.exam_board_id,
        subject_id: examData.subject_id,
        topic_id: examData.topic_id || '',
        subtopic_id: examData.subtopic_id || '',
        difficulty: examData.difficulty,
        time_limit_minutes: examData.time_limit_minutes?.toString() || '',
      })

      // Load qualifications
      const { data: quals } = await qualificationService.getAll()
      if (quals) setQualifications(quals)

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
    } catch (error: any) {
      alert('Error loading exam: ' + error.message)
      navigate('/teacher/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadExamBoards = async (qualificationId: string) => {
    const { data } = await examBoardService.getByQualification(qualificationId)
    if (data) setExamBoards(data)
  }

  const loadSubjects = async (examBoardId: string) => {
    const { data } = await subjectService.getByExamBoard(examBoardId)
    if (data) setSubjects(data)
  }

  const loadTopics = async (subjectId: string) => {
    const { data } = await topicService.getBySubject(subjectId)
    if (data) setTopics(data)
  }

  const loadSubtopics = async (topicId: string) => {
    const { data } = await subtopicService.getByTopic(topicId)
    if (data) setSubtopics(data)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.qualification_id || !formData.exam_board_id || !formData.subject_id) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      // Update exam
      await examService.update(id!, {
        title: formData.title,
        description: formData.description,
        qualification_id: formData.qualification_id,
        exam_board_id: formData.exam_board_id,
        subject_id: formData.subject_id,
        topic_id: formData.topic_id || undefined,
        subtopic_id: formData.subtopic_id || undefined,
        difficulty: formData.difficulty,
        time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : undefined,
      })

      // Update questions
      for (const question of questions) {
        if (question.id) {
          await questionService.update(question.id, {
            question_text: question.question_text,
            question_type: question.question_type,
            marks: question.marks,
            model_answer: question.model_answer,
            correct_answer: question.correct_answer,
          })

          if (question.question_type === 'mcq' && question.options) {
            await questionService.updateOptions(question.id, question.options)
          }
        } else {
          const { data: savedQuestion } = await questionService.createWithOptions(
            {
              exam_id: id!,
              question_text: question.question_text,
              question_type: question.question_type,
              marks: question.marks,
              model_answer: question.model_answer,
              correct_answer: question.correct_answer,
            },
            question.options
          )
          if (savedQuestion) {
            question.id = savedQuestion.id
          }
        }
      }

      alert('Exam updated successfully!')
      navigate('/teacher/dashboard')
    } catch (error: any) {
      alert('Error updating exam: ' + error.message)
    } finally {
      setSaving(false)
    }
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
          <h1 className="text-3xl font-bold">Edit Exam</h1>
          <p className="text-muted-foreground mt-2">Update exam details and questions</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Exam Details</CardTitle>
            <CardDescription>Basic information about your exam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Select
                  id="qualification"
                  options={qualifications.map(q => ({ value: q.id, label: q.name }))}
                  value={formData.qualification_id ? { value: formData.qualification_id, label: qualifications.find(q => q.id === formData.qualification_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, qualification_id: option?.value || '', exam_board_id: '', subject_id: '', topic_id: '', subtopic_id: '' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam_board">Exam Board *</Label>
                <Select
                  id="exam_board"
                  options={examBoards.map(b => ({ value: b.id, label: b.name }))}
                  value={formData.exam_board_id ? { value: formData.exam_board_id, label: examBoards.find(b => b.id === formData.exam_board_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, exam_board_id: option?.value || '', subject_id: '', topic_id: '', subtopic_id: '' })}
                  isDisabled={!formData.qualification_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  id="subject"
                  options={subjects.map(s => ({ value: s.id, label: s.name }))}
                  value={formData.subject_id ? { value: formData.subject_id, label: subjects.find(s => s.id === formData.subject_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, subject_id: option?.value || '', topic_id: '', subtopic_id: '' })}
                  isDisabled={!formData.exam_board_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (Optional)</Label>
                <Select
                  id="topic"
                  options={topics.map(t => ({ value: t.id, label: t.name }))}
                  value={formData.topic_id ? { value: formData.topic_id, label: topics.find(t => t.id === formData.topic_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, topic_id: option?.value || '', subtopic_id: '' })}
                  isDisabled={!formData.subject_id}
                  isClearable
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtopic">Subtopic (Optional)</Label>
                <Select
                  id="subtopic"
                  options={subtopics.map(s => ({ value: s.id, label: s.name }))}
                  value={formData.subtopic_id ? { value: formData.subtopic_id, label: subtopics.find(s => s.id === formData.subtopic_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, subtopic_id: option?.value || '' })}
                  isDisabled={!formData.topic_id}
                  isClearable
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty *</Label>
                <Select
                  id="difficulty"
                  options={[
                    { value: 'easy', label: 'Easy' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'hard', label: 'Hard' },
                  ]}
                  value={{ value: formData.difficulty, label: formData.difficulty.charAt(0).toUpperCase() + formData.difficulty.slice(1) }}
                  onChange={(option) => setFormData({ ...formData, difficulty: option?.value as 'easy' | 'medium' | 'hard' })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes, optional)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit_minutes}
                  onChange={(e) => setFormData({ ...formData, time_limit_minutes: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>Manage questions for this exam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                {questions.length === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      No questions yet. Click the button below to add your first question.
                    </p>
                    <Button
                      onClick={() => navigate(`/teacher/exams/${id}/questions`)}
                      className="w-full"
                      variant="default"
                    >
                      Add Questions
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      {questions.length} question{questions.length !== 1 ? 's' : ''} in this exam.
                    </p>
                    <Button
                      onClick={() => navigate(`/teacher/exams/${id}/questions`)}
                      className="w-full"
                      variant="default"
                    >
                      Manage Questions
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
  )
}

