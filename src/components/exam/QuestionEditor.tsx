import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Question } from '@/lib/examService'
import { Plus, Trash2, X } from 'lucide-react'

interface QuestionEditorProps {
  questions: (Question & { options?: any[] })[]
  onQuestionsChange: (questions: (Question & { options?: any[] })[]) => void
  mode: 'ai' | 'manual'
}

export function QuestionEditor({ questions, onQuestionsChange, mode }: QuestionEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const addQuestion = () => {
    const newQuestion: Question & { options?: any[] } = {
      id: '',
      exam_id: '',
      question_text: '',
      question_type: 'mcq',
      marks: 1,
      model_answer: '',
      correct_answer: '',
      options: mode === 'ai' ? [] : [
        { option_text: '', is_correct: false, order_index: 0 },
        { option_text: '', is_correct: false, order_index: 1 },
        { option_text: '', is_correct: false, order_index: 2 },
        { option_text: '', is_correct: false, order_index: 3 },
      ],
    }
    onQuestionsChange([...questions, newQuestion])
    setEditingIndex(questions.length)
  }

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index)
    onQuestionsChange(newQuestions)
    if (editingIndex === index) setEditingIndex(null)
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1)
  }

  const updateQuestion = (index: number, updates: Partial<Question & { options?: any[] }>) => {
    const newQuestions = [...questions]
    newQuestions[index] = { ...newQuestions[index], ...updates }
    onQuestionsChange(newQuestions)
  }

  const addOption = (questionIndex: number) => {
    const question = questions[questionIndex]
    if (!question.options) question.options = []
    question.options.push({
      option_text: '',
      is_correct: false,
      order_index: question.options.length,
    })
    updateQuestion(questionIndex, { options: question.options })
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex]
    if (question.options) {
      question.options = question.options.filter((_, i) => i !== optionIndex)
      question.options.forEach((opt, idx) => {
        opt.order_index = idx
      })
      updateQuestion(questionIndex, { options: question.options })
    }
  }

  const updateOption = (questionIndex: number, optionIndex: number, updates: Partial<any>) => {
    const question = questions[questionIndex]
    if (question.options) {
      question.options[optionIndex] = { ...question.options[optionIndex], ...updates }
      updateQuestion(questionIndex, { options: question.options })
    }
  }

  const setCorrectOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex]
    if (question.options) {
      question.options.forEach((opt, idx) => {
        opt.is_correct = idx === optionIndex
      })
      const correctOption = question.options[optionIndex]
      updateQuestion(questionIndex, {
        options: question.options,
        correct_answer: String.fromCharCode(65 + optionIndex),
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Questions ({questions.length})</h2>
        <Button onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </div>

      {questions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No questions yet. {mode === 'ai' ? 'Generate questions using AI or' : ''} add questions manually.
          </CardContent>
        </Card>
      ) : (
        questions.map((question, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Question {index + 1}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  >
                    {editingIndex === index ? <X className="h-4 w-4" /> : 'Edit'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeQuestion(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor={`question-type-${index}`}>Question Type</Label>
                    <select
                      id={`question-type-${index}`}
                      value={question.question_type}
                      onChange={(e) => {
                        const newType = e.target.value as 'mcq' | 'fib' | 'open_ended'
                        updateQuestion(index, {
                          question_type: newType,
                          options: newType === 'mcq' && !question.options ? [
                            { option_text: '', is_correct: false, order_index: 0 },
                            { option_text: '', is_correct: false, order_index: 1 },
                            { option_text: '', is_correct: false, order_index: 2 },
                            { option_text: '', is_correct: false, order_index: 3 },
                          ] : question.options,
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
                    <Label htmlFor={`question-text-${index}`}>Question Text *</Label>
                    <Textarea
                      id={`question-text-${index}`}
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, { question_text: e.target.value })}
                      placeholder="Enter your question here..."
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`marks-${index}`}>Marks *</Label>
                      <Input
                        id={`marks-${index}`}
                        type="number"
                        value={question.marks}
                        onChange={(e) => updateQuestion(index, { marks: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`model-answer-${index}`}>Model Answer *</Label>
                    <Textarea
                      id={`model-answer-${index}`}
                      value={question.model_answer}
                      onChange={(e) => updateQuestion(index, { model_answer: e.target.value })}
                      placeholder="Enter the model answer..."
                      className="min-h-[80px]"
                    />
                  </div>

                  {question.question_type === 'mcq' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Options</Label>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(index)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Option
                        </Button>
                      </div>
                      {question.options?.map((option, optIndex) => (
                        <div key={optIndex} className="flex gap-2 items-center">
                          <Input
                            value={option.option_text}
                            onChange={(e) => updateOption(index, optIndex, { option_text: e.target.value })}
                            placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                          />
                          <Button
                            variant={option.is_correct ? 'default' : 'outline'}
                            onClick={() => setCorrectOption(index, optIndex)}
                          >
                            {option.is_correct ? 'Correct' : 'Mark Correct'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(index, optIndex)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {(question.question_type === 'fib' || question.question_type === 'open_ended') && (
                    <div className="space-y-2">
                      <Label htmlFor={`correct-answer-${index}`}>
                        {question.question_type === 'fib' ? 'Correct Answer (for Fill in the Blank)' : 'Expected Answer Format (optional)'}
                      </Label>
                      <Input
                        id={`correct-answer-${index}`}
                        value={question.correct_answer || ''}
                        onChange={(e) => updateQuestion(index, { correct_answer: e.target.value })}
                        placeholder={question.question_type === 'fib' ? 'Enter the correct answer' : 'Optional format hint'}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="font-medium">{question.question_text}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>Type: {question.question_type.toUpperCase()}</span>
                    <span>Marks: {question.marks}</span>
                  </div>
                  {question.question_type === 'mcq' && question.options && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Options:</p>
                      {question.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <span className="font-mono">{String.fromCharCode(65 + optIdx)}.</span>
                          <span>{opt.option_text}</span>
                          {opt.is_correct && <span className="text-green-600">✓ Correct</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}

