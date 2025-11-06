import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService, questionService, type Exam, type Question } from '@/lib/examService'
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Edit2, 
  Eye, 
  Save, 
  X, 
  ChevronLeft, 
  ChevronRight,
  CheckCircle2,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2
} from 'lucide-react'

export function ManageQuestions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<(Question & { options?: any[] })[]>([])
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState<number | null>(null)
  const [editingQuestion, setEditingQuestion] = useState<Question & { options?: any[] } | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(true)
  const [sidebarMinimized, setSidebarMinimized] = useState(false)

  useEffect(() => {
    if (id && user) {
      loadExam()
    }
  }, [id, user])

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

      // Load questions
      const { data: questionsData, error: questionsError } = await questionService.getByExam(id!)
      if (questionsError || !questionsData) throw questionsError

      // Load options for MCQ
      const questionsWithOptions = await Promise.all(
        questionsData.map(async (q) => {
          if (q.question_type === 'mcq') {
            const { data: options } = await questionService.getOptions(q.id)
            return { ...q, options: options || [] }
          }
          return q
        })
      )

      setQuestions(questionsWithOptions)
      if (questionsWithOptions.length > 0) {
        setSelectedQuestionIndex(0)
        setEditingQuestion({ ...questionsWithOptions[0] })
      }
    } catch (error: any) {
      alert('Error loading exam: ' + error.message)
      navigate('/teacher/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuestion = async () => {
    if (!editingQuestion) return

    if (!editingQuestion.question_text.trim()) {
      alert('Question text is required')
      return
    }

    if (!editingQuestion.model_answer.trim()) {
      alert('Model answer is required')
      return
    }

    if (editingQuestion.question_type === 'mcq') {
      const hasOptions = editingQuestion.options && editingQuestion.options.length > 0
      const hasCorrectOption = editingQuestion.options?.some(opt => opt.is_correct)
      
      if (!hasOptions || !hasCorrectOption) {
        alert('MCQ questions must have at least one option marked as correct')
        return
      }
    }

    setSaving(true)
    try {
      if (editingQuestion.id) {
        // Update existing question
        await questionService.update(editingQuestion.id, {
          question_text: editingQuestion.question_text,
          question_type: editingQuestion.question_type,
          marks: editingQuestion.marks,
          model_answer: editingQuestion.model_answer,
          correct_answer: editingQuestion.correct_answer,
        })

        if (editingQuestion.question_type === 'mcq' && editingQuestion.options) {
          await questionService.updateOptions(editingQuestion.id, editingQuestion.options)
        }
      } else {
        // Create new question
        const { data: savedQuestion } = await questionService.createWithOptions(
          {
            exam_id: id!,
            question_text: editingQuestion.question_text,
            question_type: editingQuestion.question_type,
            marks: editingQuestion.marks,
            model_answer: editingQuestion.model_answer,
            correct_answer: editingQuestion.correct_answer,
          },
          editingQuestion.options
        )
        if (savedQuestion) {
          editingQuestion.id = savedQuestion.id
        }
      }

      // Reload questions to get updated data
      await loadExam()
      alert('Question saved successfully!')
      setIsPreviewMode(true)
    } catch (error: any) {
      alert('Error saving question: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      await questionService.delete(questionId)
      await loadExam()
      
      // Adjust selected index if needed
      if (selectedQuestionIndex !== null && selectedQuestionIndex >= questions.length - 1) {
        setSelectedQuestionIndex(Math.max(0, questions.length - 2))
      }
      
      if (questions.length <= 1) {
        setSelectedQuestionIndex(null)
        setEditingQuestion(null)
      }
    } catch (error: any) {
      alert('Error deleting question: ' + error.message)
    }
  }

  const handleAddQuestion = () => {
    const newQuestion: Question & { options?: any[] } = {
      id: '',
      exam_id: id!,
      question_text: '',
      question_type: 'mcq',
      marks: 1,
      model_answer: '',
      correct_answer: '',
      options: [
        { option_text: '', is_correct: false, order_index: 0 },
        { option_text: '', is_correct: false, order_index: 1 },
        { option_text: '', is_correct: false, order_index: 2 },
        { option_text: '', is_correct: false, order_index: 3 },
      ],
    }
    
    setQuestions([...questions, newQuestion])
    setSelectedQuestionIndex(questions.length)
    setEditingQuestion(newQuestion)
    setIsPreviewMode(false)
  }

  const handleSelectQuestion = (index: number) => {
    setSelectedQuestionIndex(index)
    setEditingQuestion({ ...questions[index] })
    setIsPreviewMode(true)
  }

  const handleEditQuestion = () => {
    setIsPreviewMode(false)
  }

  const handleCancelEdit = () => {
    if (selectedQuestionIndex !== null) {
      setEditingQuestion({ ...questions[selectedQuestionIndex] })
    }
    setIsPreviewMode(true)
  }

  const updateEditingQuestion = (updates: Partial<Question & { options?: any[] }>) => {
    if (!editingQuestion) return
    setEditingQuestion({ ...editingQuestion, ...updates })
  }

  const addOption = () => {
    if (!editingQuestion) return
    if (!editingQuestion.options) editingQuestion.options = []
    editingQuestion.options.push({
      option_text: '',
      is_correct: false,
      order_index: editingQuestion.options.length,
    })
    updateEditingQuestion({ options: editingQuestion.options })
  }

  const removeOption = (optionIndex: number) => {
    if (!editingQuestion?.options) return
    editingQuestion.options = editingQuestion.options.filter((_, i) => i !== optionIndex)
    editingQuestion.options.forEach((opt, idx) => {
      opt.order_index = idx
    })
    updateEditingQuestion({ options: editingQuestion.options })
  }

  const updateOption = (optionIndex: number, updates: Partial<any>) => {
    if (!editingQuestion?.options) return
    editingQuestion.options[optionIndex] = { ...editingQuestion.options[optionIndex], ...updates }
    updateEditingQuestion({ options: editingQuestion.options })
  }

  const setCorrectOption = (optionIndex: number) => {
    if (!editingQuestion?.options) return
    editingQuestion.options.forEach((opt, idx) => {
      opt.is_correct = idx === optionIndex
    })
    const correctOption = editingQuestion.options[optionIndex]
    updateEditingQuestion({
      options: editingQuestion.options,
      correct_answer: String.fromCharCode(65 + optionIndex),
    })
  }

  const navigateQuestion = (direction: 'prev' | 'next') => {
    if (selectedQuestionIndex === null) return
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, selectedQuestionIndex - 1)
      : Math.min(questions.length - 1, selectedQuestionIndex + 1)
    
    handleSelectQuestion(newIndex)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const currentQuestion = selectedQuestionIndex !== null ? questions[selectedQuestionIndex] : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/teacher/exams/${id}/edit`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{exam?.title || 'Manage Questions'}</h1>
              <p className="text-muted-foreground mt-1">
                {questions.length} question{questions.length !== 1 ? 's' : ''} • {exam?.subject_id ? 'Subject Exam' : 'General Exam'}
              </p>
            </div>
          </div>
          <Button onClick={handleAddQuestion}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Question List Sidebar */}
          <div className={`${sidebarMinimized ? 'col-span-1' : 'col-span-3'} transition-all duration-300`}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  {!sidebarMinimized && (
                    <>
                      <CardTitle className="text-lg">Questions</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSidebarMinimized(true)}
                        title="Minimize sidebar"
                      >
                        <PanelLeftClose className="h-5 w-5" />
                      </Button>
                    </>
                  )}
                  {sidebarMinimized && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setSidebarMinimized(false)}
                      title="Expand sidebar"
                    >
                      <PanelLeftOpen className="h-5 w-5" />
                    </Button>
                  )}
                </div>
                {!sidebarMinimized && (
                  <CardDescription>Select a question to view or edit</CardDescription>
                )}
              </CardHeader>
              {!sidebarMinimized && (
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                    {questions.length === 0 ? (
                      <div className="p-6 text-center text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No questions yet</p>
                        <p className="text-sm">Click "Add Question" to get started</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {questions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectQuestion(index)}
                            className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                              selectedQuestionIndex === index ? 'bg-primary/10 border-l-4 border-primary' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm">Question {index + 1}</div>
                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {question.question_text || 'Untitled question'}
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs px-2 py-0.5 bg-secondary rounded">
                                    {question.question_type.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {question.marks} mark{question.marks !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                              {selectedQuestionIndex === index && (
                                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0 ml-2" />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
              {sidebarMinimized && (
                <CardContent className="p-0">
                  <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
                    {questions.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      </div>
                    ) : (
                      <div className="divide-y">
                        {questions.map((question, index) => (
                          <button
                            key={index}
                            onClick={() => handleSelectQuestion(index)}
                            className={`w-full p-3 hover:bg-muted/50 transition-colors flex items-center justify-center ${
                              selectedQuestionIndex === index ? 'bg-primary/10 border-l-4 border-primary' : ''
                            }`}
                            title={`Question ${index + 1}: ${question.question_text?.substring(0, 50) || 'Untitled'}`}
                          >
                            <div className="flex flex-col items-center">
                              {selectedQuestionIndex === index ? (
                                <CheckCircle2 className="h-5 w-5 text-primary mb-1" />
                              ) : (
                                <div className="h-5 w-5 flex items-center justify-center font-semibold text-sm mb-1">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </div>

          {/* Main Content Area */}
          <div className={`${sidebarMinimized ? 'col-span-11' : 'col-span-9'} transition-all duration-300`}>
            {currentQuestion && editingQuestion ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl">
                        Question {selectedQuestionIndex! + 1} of {questions.length}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {isPreviewMode ? 'Preview mode' : 'Edit mode'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPreviewMode ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={handleEditQuestion}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          {currentQuestion.id && (
                            <Button
                              variant="destructive"
                              onClick={() => handleDeleteQuestion(currentQuestion.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveQuestion}
                            disabled={saving}
                          >
                            {saving ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isPreviewMode ? (
                    // Preview Mode
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Question Type</Label>
                        <div className="text-lg font-semibold capitalize">{editingQuestion.question_type}</div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Question</Label>
                        <div className="text-lg p-4 bg-muted rounded-lg border">
                          {editingQuestion.question_text || <span className="text-muted-foreground italic">No question text</span>}
                        </div>
                      </div>

                      {editingQuestion.question_type === 'mcq' && editingQuestion.options && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Options</Label>
                          <div className="space-y-3">
                            {editingQuestion.options.map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                className={`p-4 rounded-lg border ${
                                  opt.is_correct
                                    ? 'bg-green-50 dark:bg-green-950 border-green-500'
                                    : 'bg-muted'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-background border flex items-center justify-center font-semibold">
                                    {String.fromCharCode(65 + optIdx)}
                                  </div>
                                  <div className="flex-1">{opt.option_text || <span className="text-muted-foreground italic">Empty option</span>}</div>
                                  {opt.is_correct && (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(editingQuestion.question_type === 'fib' || editingQuestion.question_type === 'open_ended') && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">
                            {editingQuestion.question_type === 'fib' ? 'Correct Answer' : 'Expected Answer Format'}
                          </Label>
                          <div className="p-4 bg-muted rounded-lg border">
                            {editingQuestion.correct_answer || <span className="text-muted-foreground italic">Not specified</span>}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-muted-foreground">Marks</Label>
                          <div className="text-lg font-semibold">{editingQuestion.marks}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Model Answer</Label>
                        <div className="p-4 bg-muted rounded-lg border">
                          {editingQuestion.model_answer || <span className="text-muted-foreground italic">No model answer</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Edit Mode
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="question-type">Question Type *</Label>
                        <select
                          id="question-type"
                          value={editingQuestion.question_type}
                          onChange={(e) => {
                            const newType = e.target.value as 'mcq' | 'fib' | 'open_ended'
                            updateEditingQuestion({
                              question_type: newType,
                              options: newType === 'mcq' && !editingQuestion.options ? [
                                { option_text: '', is_correct: false, order_index: 0 },
                                { option_text: '', is_correct: false, order_index: 1 },
                                { option_text: '', is_correct: false, order_index: 2 },
                                { option_text: '', is_correct: false, order_index: 3 },
                              ] : editingQuestion.options,
                            })
                          }}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                        >
                          <option value="mcq">Multiple Choice</option>
                          <option value="fib">Fill in the Blank</option>
                          <option value="open_ended">Open-ended</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="question-text">Question Text *</Label>
                        <Textarea
                          id="question-text"
                          value={editingQuestion.question_text}
                          onChange={(e) => updateEditingQuestion({ question_text: e.target.value })}
                          placeholder="Enter your question here..."
                          className="min-h-[120px] text-base"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="marks">Marks *</Label>
                          <Input
                            id="marks"
                            type="number"
                            value={editingQuestion.marks}
                            onChange={(e) => updateEditingQuestion({ marks: parseFloat(e.target.value) || 0 })}
                            min="0"
                            step="0.5"
                          />
                        </div>
                      </div>

                      {editingQuestion.question_type === 'mcq' && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label>Options *</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addOption}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Option
                            </Button>
                          </div>
                          {editingQuestion.options?.map((option, optIndex) => (
                            <div key={optIndex} className="flex gap-3 items-center">
                              <div className="w-10 h-10 rounded-full bg-muted border flex items-center justify-center font-semibold flex-shrink-0">
                                {String.fromCharCode(65 + optIndex)}
                              </div>
                              <Input
                                value={option.option_text}
                                onChange={(e) => updateOption(optIndex, { option_text: e.target.value })}
                                placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                                className="flex-1"
                              />
                              <Button
                                variant={option.is_correct ? 'default' : 'outline'}
                                onClick={() => setCorrectOption(optIndex)}
                                className="flex-shrink-0"
                              >
                                {option.is_correct ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Correct
                                  </>
                                ) : (
                                  'Mark Correct'
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(optIndex)}
                                className="flex-shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {editingQuestion.options && editingQuestion.options.length === 0 && (
                            <p className="text-sm text-muted-foreground">Add at least one option</p>
                          )}
                        </div>
                      )}

                      {(editingQuestion.question_type === 'fib' || editingQuestion.question_type === 'open_ended') && (
                        <div className="space-y-2">
                          <Label htmlFor="correct-answer">
                            {editingQuestion.question_type === 'fib' ? 'Correct Answer *' : 'Expected Answer Format (optional)'}
                          </Label>
                          <Input
                            id="correct-answer"
                            value={editingQuestion.correct_answer || ''}
                            onChange={(e) => updateEditingQuestion({ correct_answer: e.target.value })}
                            placeholder={editingQuestion.question_type === 'fib' ? 'Enter the correct answer' : 'Optional format hint'}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="model-answer">Model Answer *</Label>
                        <Textarea
                          id="model-answer"
                          value={editingQuestion.model_answer}
                          onChange={(e) => updateEditingQuestion({ model_answer: e.target.value })}
                          placeholder="Enter the model answer..."
                          className="min-h-[100px]"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-xl font-semibold mb-2">No Question Selected</h3>
                  <p className="text-muted-foreground mb-4">
                    Select a question from the sidebar or add a new question to get started
                  </p>
                  <Button onClick={handleAddQuestion}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Question
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Navigation Footer */}
            {currentQuestion && (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => navigateQuestion('prev')}
                  disabled={selectedQuestionIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Question {selectedQuestionIndex! + 1} of {questions.length}
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigateQuestion('next')}
                  disabled={selectedQuestionIndex === questions.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

