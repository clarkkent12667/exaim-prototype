import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { examService, questionService, type Exam, type Question } from '@/lib/examService'
import { qualificationService, examBoardService, subjectService, topicService, subtopicService, type Qualification, type ExamBoard, type Subject, type Topic, type Subtopic } from '@/lib/qualificationService'
import { supabase } from '@/lib/supabase'
import Select from 'react-select'
import { Loader2, CheckCircle2, ArrowLeft, Edit2, Trash2, Plus, Save, X } from 'lucide-react'
import { Blank } from '@/components/exam/Blank'

export function CreateExam() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [examId, setExamId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<(Partial<Question> & { options?: any[] })[]>([])
  const [showReview, setShowReview] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)


  // Form data
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
    question_counts: {
      mcq: 5,
      fib: 3,
      open_ended: 2,
    },
  })

  // Dropdown data
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [subtopics, setSubtopics] = useState<Subtopic[]>([])

  // Load saved data from localStorage on mount
  useEffect(() => {
    loadQualifications()
    
    // Clear localStorage when creating a new exam to ensure fresh start
    // Only restore if we're editing an existing exam (examId is set)
    if (!examId) {
      localStorage.removeItem('createExam_questions')
      localStorage.removeItem('createExam_formData')
      setQuestions([])
      setShowReview(false)
      setFormData({
        title: '',
        description: '',
        qualification_id: '',
        exam_board_id: '',
        subject_id: '',
        topic_id: '',
        subtopic_id: '',
        difficulty: 'medium' as 'easy' | 'medium' | 'hard',
        time_limit_minutes: '',
        question_counts: {
          mcq: 5,
          fib: 3,
          open_ended: 2,
        },
      })
    } else {
      // Only restore when editing an existing exam
      // Restore questions from localStorage
      const savedQuestions = localStorage.getItem('createExam_questions')
      if (savedQuestions) {
        try {
          const parsed = JSON.parse(savedQuestions)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setQuestions(parsed)
            setShowReview(true)
          }
        } catch (error) {
          // Failed to parse saved questions
        }
      }
      
      // Restore form data from localStorage
      const savedFormData = localStorage.getItem('createExam_formData')
      if (savedFormData) {
        try {
          const parsed = JSON.parse(savedFormData)
          setFormData(prev => ({ ...prev, ...parsed }))
        } catch (error) {
          // Failed to parse saved form data
        }
      }
    }
  }, [])

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

  const loadQualifications = async () => {
    const { data } = await qualificationService.getAll()
    if (data) setQualifications(data)
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

  const handleGenerateQuestions = async () => {
    if (!formData.qualification_id || !formData.exam_board_id || !formData.subject_id) {
      alert('Please select qualification, exam board, and subject')
      return
    }

    // Validate question counts
    const totalQuestions = formData.question_counts.mcq + formData.question_counts.fib + formData.question_counts.open_ended
    if (totalQuestions === 0) {
      alert('Please specify at least one question to generate')
      return
    }

    setGenerating(true)
    try {
      const qualification = qualifications.find(q => q.id === formData.qualification_id)
      const examBoard = examBoards.find(b => b.id === formData.exam_board_id)
      const subject = subjects.find(s => s.id === formData.subject_id)
      const topic = formData.topic_id ? topics.find(t => t.id === formData.topic_id) : undefined
      const subtopic = formData.subtopic_id ? subtopics.find(s => s.id === formData.subtopic_id) : undefined

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await supabase.functions.invoke('generate-questions', {
        body: {
          qualification: qualification?.name || '',
          exam_board: examBoard?.name || '',
          subject: subject?.name || '',
          topic: topic?.name,
          subtopic: subtopic?.name,
          difficulty: formData.difficulty,
          question_counts: formData.question_counts,
        },
      })

      // Check for Supabase function invocation error first
      if (response.error) {
        // Try to extract error message from response data if available
        const errorMessage = response.data?.error || response.error.message || 'Failed to generate questions'
        const errorDetails = response.data?.details || response.error.details
        throw new Error(errorDetails ? `${errorMessage}\n\nDetails: ${errorDetails}` : errorMessage)
      }

      // Check if response data exists
      if (!response.data) {
        throw new Error('No data received from the server. Please check your network connection and try again.')
      }

      // Handle case where response.data might be a string (shouldn't happen, but safety check)
      let responseData = response.data
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData)
        } catch (parseError) {
          throw new Error('Invalid response format from server')
        }
      }

      // Check if response has error property (even if status was 200)
      if (responseData.error) {
        const errorDetails = responseData.details
        throw new Error(errorDetails ? `${responseData.error}\n\nDetails: ${errorDetails}` : responseData.error)
      }

      // Validate questions array exists
      if (!responseData.questions) {
        throw new Error('Invalid response format: questions array not found. Please try again.')
      }

      const generatedQuestions = responseData.questions as any[]
      
      if (!Array.isArray(generatedQuestions)) {
        throw new Error('Invalid response format: questions is not an array')
      }

      if (generatedQuestions.length === 0) {
        alert('No questions were generated. Please try again with different parameters.')
        setGenerating(false)
        return
      }

      // Validate question structure
      const validQuestions = generatedQuestions.filter(q => {
        const isValid = q && q.question_text && q.question_type && typeof q.marks === 'number'
        return isValid
      })

      if (validQuestions.length === 0) {
        throw new Error('All generated questions were invalid. Please try again.')
      }

      // Set questions and show review
      setQuestions(validQuestions)
      setShowReview(true) // Switch to review mode after generation
      
      // Save to localStorage immediately to prevent data loss on refresh
      localStorage.setItem('createExam_questions', JSON.stringify(validQuestions))
    } catch (error: any) {
      const errorMessage = error?.message || 'An unknown error occurred while generating questions'
      alert('Error generating questions: ' + errorMessage)
    } finally {
      setGenerating(false)
    }
  }

  const updateQuestion = (index: number, updates: Partial<Question & { options?: any[] }>) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], ...updates }
    setQuestions(updated)
    localStorage.setItem('createExam_questions', JSON.stringify(updated))
  }

  const deleteQuestion = (index: number) => {
    if (confirm('Are you sure you want to delete this question?')) {
      const updated = questions.filter((_, i) => i !== index)
      setQuestions(updated)
      localStorage.setItem('createExam_questions', JSON.stringify(updated))
      if (editingIndex === index) {
        setEditingIndex(null)
      } else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1)
      }
    }
  }

  const addNewQuestion = () => {
    const newQuestion: Omit<Question, 'id' | 'exam_id' | 'created_at' | 'updated_at'> & { options?: any[] } = {
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
    const updated = [...questions, newQuestion]
    setQuestions(updated)
    setEditingIndex(questions.length)
    localStorage.setItem('createExam_questions', JSON.stringify(updated))
  }

  const renderFibQuestion = (questionText: string, correctAnswer?: string, modelAnswer?: string) => {
    // Replace [blank], [anything], _____, or similar patterns with blanks
    // Support multiple blanks in the same question
    // Combined pattern to match all blank types: [blank], [anything], _____, etc.
    const blankPattern = /(\[blank\]|\[[^\]]+\]|_{3,}|_____+)/gi
    
    if (!blankPattern.test(questionText)) {
      // No blanks found, return text as-is
      return [{ type: 'text' as const, content: questionText }]
    }
    
    // Reset regex lastIndex
    blankPattern.lastIndex = 0
    
    // Use model_answer or correct_answer to determine blank size
    const answer = modelAnswer || correctAnswer || ''
    // Split answer by commas/semicolons if multiple blanks exist
    const answerParts = answer ? answer.split(/[,;]/).map(a => a.trim()) : []
    
    const parts: Array<{ type: 'text' | 'blank', content: string, index?: number, answerLength?: number }> = []
    let lastIndex = 0
    let blankIndex = 0
    let match
    
    // Find all matches
    while ((match = blankPattern.exec(questionText)) !== null) {
      // Add text before the blank
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: questionText.substring(lastIndex, match.index) })
      }
      
      // Get answer length for this blank (use corresponding answer part or fallback to full answer)
      const answerLength = answerParts[blankIndex]?.length || answerParts[0]?.length || answer.length
      
      // Add the blank
      parts.push({ type: 'blank', content: '', index: blankIndex, answerLength })
      blankIndex++
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining text after last blank
    if (lastIndex < questionText.length) {
      parts.push({ type: 'text', content: questionText.substring(lastIndex) })
    }
    
    return parts
  }

  const handleSaveExam = async () => {
    if (!formData.title || !formData.qualification_id || !formData.exam_board_id || !formData.subject_id) {
      alert('Please fill in all required fields')
      return
    }

    if (questions.length === 0) {
      alert('Please add at least one question')
      return
    }

    setLoading(true)
    try {
      let savedExamId = examId

      if (!savedExamId) {
        // Create exam (not published yet, will publish after questions are saved)
        const examData: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'total_marks'> = {
          teacher_id: user!.id,
          title: formData.title,
          description: formData.description,
          qualification_id: formData.qualification_id,
          exam_board_id: formData.exam_board_id,
          subject_id: formData.subject_id,
          topic_id: formData.topic_id || undefined,
          subtopic_id: formData.subtopic_id || undefined,
          difficulty: formData.difficulty,
          time_limit_minutes: formData.time_limit_minutes ? parseInt(formData.time_limit_minutes) : undefined,
          is_published: false,
        }

        const { data: exam, error: examError } = await examService.create(examData)
        if (examError || !exam) throw examError
        savedExamId = exam.id
        setExamId(savedExamId)
      } else {
        // Update exam (don't publish yet, will publish after questions are saved)
        await examService.update(savedExamId, {
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
      }

      // Save questions
      for (const question of questions) {
        if (question.id) {
          // Update existing question
          await questionService.update(question.id, {
            question_text: question.question_text,
            question_type: question.question_type,
            marks: question.marks,
            model_answer: question.model_answer,
            correct_answer: question.correct_answer,
          })

          // Update options if MCQ
          if (question.question_type === 'mcq' && question.options) {
            await questionService.updateOptions(question.id, question.options)
          }
        } else {
          // Create new question
          if (!savedExamId) {
            throw new Error('Exam ID is required to create questions')
          }
          if (!question.question_text || !question.question_type || question.marks === undefined || !question.model_answer) {
            throw new Error('Question is missing required fields')
          }
          const { data: savedQuestion } = await questionService.createWithOptions(
            {
              exam_id: savedExamId,
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

      // Don't publish the exam - it will only be visible to students when assigned to a class
      // Clear localStorage after successful save
      localStorage.removeItem('createExam_questions')
      localStorage.removeItem('createExam_formData')
      
      alert('Exam saved successfully! Assign it to a class to make it available to students.')
      navigate(`/teacher/exams/${savedExamId}/edit`)
    } catch (error: any) {
      alert('Error saving exam: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // If in review mode, show review section with all questions scrollable
  if (showReview && questions.length > 0) {
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0)
    
    return (
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => setShowReview(false)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Edit
            </Button>
          </div>
          <h1 className="text-3xl font-bold">Review Generated Questions</h1>
          <p className="text-muted-foreground mt-2">
            Review all {questions.length} generated questions. When you're satisfied, click "Save Exam" to save your exam. You can assign it to classes later.
          </p>
          <div className="mt-4 flex items-center justify-between">
            <div className="p-4 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                Total Questions: {questions.length} | Total Marks: {Math.round(totalMarks)}
              </p>
            </div>
            <Button onClick={addNewQuestion} variant="outline" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          </div>
        </div>

        {/* All questions in a scrollable container */}
        <div className="space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          {questions.map((question, index) => {
            const isEditing = editingIndex === index
            return (
              <Card key={index} className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Question {index + 1}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({question.question_type?.toUpperCase() || 'UNKNOWN'})
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {question.marks} mark{question.marks !== 1 ? 's' : ''}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isEditing ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIndex(index)}
                            className="flex items-center gap-1"
                          >
                            <Edit2 className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteQuestion(index)}
                            className="flex items-center gap-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                            className="flex items-center gap-1"
                          >
                            <X className="h-3 w-3" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                            className="flex items-center gap-1"
                          >
                            <Save className="h-3 w-3" />
                            Save
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isEditing ? (
                    <>
                      <div className="space-y-2">
                        <Label>Question Text *</Label>
                        <Textarea
                          value={question.question_text}
                          onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                          className="min-h-[100px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Question Type</Label>
                          <select
                            value={question.question_type}
                            onChange={(e) => {
                              const newType = e.target.value as 'mcq' | 'fib' | 'open_ended'
                              const updates: any = { question_type: newType }
                              if (newType === 'mcq' && !question.options) {
                                updates.options = [
                                  { option_text: '', is_correct: false, order_index: 0 },
                                  { option_text: '', is_correct: false, order_index: 1 },
                                  { option_text: '', is_correct: false, order_index: 2 },
                                  { option_text: '', is_correct: false, order_index: 3 },
                                ]
                              }
                              updateQuestion(index, updates)
                            }}
                            className="w-full rounded-md border border-input bg-background px-3 py-2"
                          >
                            <option value="mcq">Multiple Choice</option>
                            <option value="fib">Fill in the Blank</option>
                            <option value="open_ended">Open Ended</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>Marks *</Label>
                          <Input
                            type="number"
                            value={question.marks}
                            onChange={(e) => updateQuestion(index, { marks: Math.round(parseFloat(e.target.value) || 0) })}
                            min="0"
                            step="1"
                          />
                        </div>
                      </div>

                      {question.question_type === 'mcq' && question.options && (
                        <div className="space-y-2">
                          <Label>Options</Label>
                          {question.options.map((option, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <Input
                                value={option.option_text}
                                onChange={(e) => {
                                  const updatedOptions = [...question.options!]
                                  updatedOptions[optIdx] = { ...option, option_text: e.target.value }
                                  updateQuestion(index, { options: updatedOptions })
                                }}
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              />
                              <Button
                                variant={option.is_correct ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const updatedOptions = question.options!.map((opt, idx) => ({
                                    ...opt,
                                    is_correct: idx === optIdx
                                  }))
                                  const correctAnswer = String.fromCharCode(65 + optIdx)
                                  updateQuestion(index, { options: updatedOptions, correct_answer: correctAnswer })
                                }}
                              >
                                {option.is_correct ? 'Correct' : 'Mark Correct'}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {(question.question_type === 'fib' || question.question_type === 'open_ended') && (
                        <div className="space-y-2">
                          <Label>
                            {question.question_type === 'fib' ? 'Correct Answer' : 'Expected Answer Format (optional)'}
                          </Label>
                          <Input
                            value={question.correct_answer || ''}
                            onChange={(e) => updateQuestion(index, { correct_answer: e.target.value })}
                            placeholder={question.question_type === 'fib' ? 'Enter the correct answer' : 'Optional format hint'}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Model Answer</Label>
                        <Textarea
                          value={question.model_answer}
                          onChange={(e) => updateQuestion(index, { model_answer: e.target.value })}
                          className="min-h-[100px]"
                          placeholder="Explanation or model answer"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-base font-semibold mb-2">Question Text</Label>
                        {question.question_type === 'fib' ? (
                          <div className="text-base p-4 bg-gray-50 border border-gray-200 rounded-lg">
                            {renderFibQuestion(question.question_text || '', question.correct_answer || '', question.model_answer || '').map((part, partIdx) => (
                              part.type === 'blank' ? (
                                <Blank
                                  key={partIdx}
                                  readOnly
                                  answerLength={part.answerLength}
                                />
                              ) : (
                                <span key={partIdx} className="text-gray-800">{part.content}</span>
                              )
                            ))}
                          </div>
                        ) : (
                          <p className="text-base whitespace-pre-wrap">{question.question_text}</p>
                        )}
                      </div>

                      {question.question_type === 'mcq' && question.options && (
                        <div>
                          <Label className="text-base font-semibold mb-2">Options</Label>
                          <div className="space-y-2">
                            {question.options.map((option, idx) => (
                              <div
                                key={idx}
                                className={`p-3 rounded-lg border ${
                                  option.is_correct
                                    ? 'bg-green-100 border-green-500 text-gray-900'
                                    : 'bg-white border-gray-300 text-gray-900'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{String.fromCharCode(65 + idx)}.</span>
                                  <span>{option.option_text}</span>
                                  {option.is_correct && (
                                    <CheckCircle2 className="h-4 w-4 text-green-700 ml-auto" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Correct Answer: {question.correct_answer}
                          </p>
                        </div>
                      )}

                      {question.question_type === 'fib' && question.correct_answer && (
                        <div>
                          <Label className="text-base font-semibold mb-2">Correct Answer</Label>
                          <p className="text-base p-3 bg-blue-100 border border-blue-300 rounded-lg text-gray-900">
                            {question.correct_answer}
                          </p>
                        </div>
                      )}

                      <div>
                        <Label className="text-base font-semibold mb-2">Model Answer</Label>
                        <p className="text-base whitespace-pre-wrap p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-900">
                          {question.model_answer || question.correct_answer || 'No model answer provided'}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex gap-4 mt-6 sticky bottom-0 bg-background pt-4 pb-4 border-t">
          <Button variant="outline" onClick={() => setShowReview(false)}>
            Back to Edit
          </Button>
          <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
            Cancel
          </Button>
          <Button onClick={handleSaveExam} disabled={loading} className="flex-1">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save Exam
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">{examId ? 'Review & Edit Exam' : 'Create Exam'}</h1>
          <p className="text-muted-foreground mt-2">
            {examId 
              ? 'Review and edit your exam details and questions. You can save changes or continue editing questions.'
              : 'Create a new exam using AI or manually'}
          </p>
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
                onChange={(e) => {
                  const updated = { ...formData, title: e.target.value }
                  setFormData(updated)
                  localStorage.setItem('createExam_formData', JSON.stringify(updated))
                }}
                placeholder="e.g., Mathematics Midterm Exam"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  const updated = { ...formData, description: e.target.value }
                  setFormData(updated)
                  localStorage.setItem('createExam_formData', JSON.stringify(updated))
                }}
                placeholder="Optional description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Select
                  id="qualification"
                  options={qualifications.map(q => ({ value: q.id, label: q.name }))}
                  value={formData.qualification_id ? { value: formData.qualification_id, label: qualifications.find(q => q.id === formData.qualification_id)?.name || '' } : null}
                  onChange={(option) => {
                    const updated = { ...formData, qualification_id: option?.value || '', exam_board_id: '', subject_id: '', topic_id: '', subtopic_id: '' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exam_board">Exam Board *</Label>
                <Select
                  id="exam_board"
                  options={examBoards.map(b => ({ value: b.id, label: b.name }))}
                  value={formData.exam_board_id ? { value: formData.exam_board_id, label: examBoards.find(b => b.id === formData.exam_board_id)?.name || '' } : null}
                  onChange={(option) => {
                    const updated = { ...formData, exam_board_id: option?.value || '', subject_id: '', topic_id: '', subtopic_id: '' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
                  isDisabled={!formData.qualification_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  id="subject"
                  options={subjects.map(s => ({ value: s.id, label: s.name }))}
                  value={formData.subject_id ? { value: formData.subject_id, label: subjects.find(s => s.id === formData.subject_id)?.name || '' } : null}
                  onChange={(option) => {
                    const updated = { ...formData, subject_id: option?.value || '', topic_id: '', subtopic_id: '' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
                  isDisabled={!formData.exam_board_id}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (Optional)</Label>
                <Select
                  id="topic"
                  options={topics.map(t => ({ value: t.id, label: t.name }))}
                  value={formData.topic_id ? { value: formData.topic_id, label: topics.find(t => t.id === formData.topic_id)?.name || '' } : null}
                  onChange={(option) => {
                    const updated = { ...formData, topic_id: option?.value || '', subtopic_id: '' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
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
                  onChange={(option) => {
                    const updated = { ...formData, subtopic_id: option?.value || '' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
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
                  onChange={(option) => {
                    const updated = { ...formData, difficulty: option?.value as 'easy' | 'medium' | 'hard' }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes, optional)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  value={formData.time_limit_minutes}
                  onChange={(e) => {
                    const updated = { ...formData, time_limit_minutes: e.target.value }
                    setFormData(updated)
                    localStorage.setItem('createExam_formData', JSON.stringify(updated))
                  }}
                  placeholder="e.g., 60"
                />
              </div>
            </div>
          </CardContent>
        </Card>


        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>Add and manage questions for your exam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mode === 'ai' && (
                <>
                  <div className="flex gap-4 mb-4">
                    <Button
                      variant="default"
                      onClick={() => setMode('ai')}
                    >
                      AI Generation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setMode('manual')}
                    >
                      Manual Creation
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="mcq_count">MCQ Count</Label>
                      <Input
                        id="mcq_count"
                        type="number"
                        value={formData.question_counts.mcq}
                        onChange={(e) => {
                          const updated = {
                            ...formData,
                            question_counts: { ...formData.question_counts, mcq: parseInt(e.target.value) || 0 }
                          }
                          setFormData(updated)
                          localStorage.setItem('createExam_formData', JSON.stringify(updated))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fib_count">Fill in the Blank Count</Label>
                      <Input
                        id="fib_count"
                        type="number"
                        value={formData.question_counts.fib}
                        onChange={(e) => {
                          const updated = {
                            ...formData,
                            question_counts: { ...formData.question_counts, fib: parseInt(e.target.value) || 0 }
                          }
                          setFormData(updated)
                          localStorage.setItem('createExam_formData', JSON.stringify(updated))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="open_ended_count">Open-ended Count</Label>
                      <Input
                        id="open_ended_count"
                        type="number"
                        value={formData.question_counts.open_ended}
                        onChange={(e) => {
                          const updated = {
                            ...formData,
                            question_counts: { ...formData.question_counts, open_ended: parseInt(e.target.value) || 0 }
                          }
                          setFormData(updated)
                          localStorage.setItem('createExam_formData', JSON.stringify(updated))
                        }}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleGenerateQuestions}
                    disabled={generating}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Questions...
                      </>
                    ) : (
                      'Generate Questions'
                    )}
                  </Button>
                </>
              )}
              {mode === 'manual' && (
                <div className="flex gap-4 mb-4">
                  <Button
                    variant="outline"
                    onClick={() => setMode('ai')}
                  >
                    AI Generation
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setMode('manual')}
                  >
                    Manual Creation
                  </Button>
                </div>
              )}
              
              {questions.length > 0 && (
                <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    ✓ {questions.length} question{questions.length !== 1 ? 's' : ''} prepared
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Questions will be saved when you click "Save Exam". You can review and edit them from the Edit Exam page after saving.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
            {examId ? 'Back to Dashboard' : 'Cancel'}
          </Button>
          {examId && (
            <Button 
              variant="outline" 
              onClick={() => navigate(`/teacher/exams/${examId}/edit`)}
            >
              Review & Edit Exam
            </Button>
          )}
          <Button onClick={handleSaveExam} disabled={loading || questions.length === 0}>
            {loading ? 'Saving...' : examId ? 'Save Changes' : 'Save Exam'}
          </Button>
        </div>
      </div>
  )
}

