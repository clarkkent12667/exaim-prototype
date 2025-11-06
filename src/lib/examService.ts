import { supabase } from './supabase'

export interface Exam {
  id: string
  teacher_id: string
  title: string
  description?: string
  qualification_id: string
  exam_board_id: string
  subject_id: string
  topic_id?: string
  subtopic_id?: string
  difficulty: 'easy' | 'medium' | 'hard'
  time_limit_minutes?: number
  is_published: boolean
  total_marks: number
  created_at?: string
  updated_at?: string
}

export interface Question {
  id: string
  exam_id: string
  question_text: string
  question_type: 'mcq' | 'fib' | 'open_ended'
  marks: number
  model_answer: string
  correct_answer?: string
  created_at?: string
  updated_at?: string
}

export interface QuestionOption {
  id: string
  question_id: string
  option_text: string
  is_correct: boolean
  order_index: number
}

export interface ExamAttempt {
  id: string
  exam_id: string
  student_id: string
  started_at: string
  submitted_at?: string
  total_score: number
  status: 'in_progress' | 'completed'
  created_at?: string
}

export interface StudentAnswer {
  id: string
  attempt_id: string
  question_id: string
  answer_text?: string
  is_correct?: boolean
  score: number
  ai_evaluation?: any
  evaluated_at?: string
  time_spent_seconds?: number
  created_at?: string
}

export interface ExamStatistics {
  id: string
  attempt_id: string
  correct_count: number
  incorrect_count: number
  partially_correct_count: number
  skipped_count: number
  total_questions: number
  created_at?: string
}

export const examService = {
  async create(exam: Omit<Exam, 'id' | 'created_at' | 'updated_at' | 'total_marks'>) {
    const { data, error } = await supabase
      .from('exams')
      .insert(exam)
      .select()
      .single()
    return { data, error }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async getByTeacher(teacherId: string) {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getPublished() {
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async update(id: string, updates: Partial<Exam>) {
    const { data, error } = await supabase
      .from('exams')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('exams')
      .delete()
      .eq('id', id)
    return { error }
  },

  async publish(id: string) {
    return this.update(id, { is_published: true })
  },

  async unpublish(id: string) {
    return this.update(id, { is_published: false })
  },
}

export const questionService = {
  async getByExam(examId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at')
    return { data, error }
  },

  /**
   * Batch fetch questions for multiple exams (optimized for analytics)
   */
  async getByExams(examIds: string[]) {
    if (examIds.length === 0) {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('exam_id', examIds)
      .order('created_at')
    return { data, error }
  },

  async create(question: Omit<Question, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('questions')
      .insert(question)
      .select()
      .single()
    return { data, error }
  },

  async createWithOptions(question: Omit<Question, 'id' | 'created_at' | 'updated_at'>, options?: Omit<QuestionOption, 'id' | 'question_id'>[]) {
    // Create question
    const { data: questionData, error: questionError } = await this.create(question)
    if (questionError || !questionData) return { data: null, error: questionError }

    // Create options if provided
    if (options && options.length > 0) {
      const optionsToInsert = options.map((opt, idx) => ({
        ...opt,
        question_id: questionData.id,
        order_index: opt.order_index || idx,
      }))
      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(optionsToInsert)
      
      if (optionsError) return { data: questionData, error: optionsError }
    }

    return { data: questionData, error: null }
  },

  async update(id: string, updates: Partial<Question>) {
    const { data, error } = await supabase
      .from('questions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)
    return { error }
  },

  async getOptions(questionId: string) {
    const { data, error } = await supabase
      .from('question_options')
      .select('*')
      .eq('question_id', questionId)
      .order('order_index')
    return { data, error }
  },

  async updateOptions(questionId: string, options: Omit<QuestionOption, 'id' | 'question_id'>[]) {
    // Delete existing options
    await supabase
      .from('question_options')
      .delete()
      .eq('question_id', questionId)

    // Insert new options
    if (options.length > 0) {
      const optionsToInsert = options.map((opt, idx) => ({
        ...opt,
        question_id: questionId,
        order_index: opt.order_index || idx,
      }))
      const { error } = await supabase
        .from('question_options')
        .insert(optionsToInsert)
      return { error }
    }

    return { error: null }
  },
}

export const attemptService = {
  async create(attempt: Omit<ExamAttempt, 'id' | 'created_at' | 'started_at' | 'status' | 'total_score'>) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .insert({
        ...attempt,
        status: 'in_progress',
        total_score: 0,
      })
      .select()
      .single()
    return { data, error }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async getByStudent(studentId: string) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getByExam(examId: string) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getByExams(examIds: string[]) {
    if (examIds.length === 0) {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .in('exam_id', examIds)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  /**
   * Batch fetch attempts for multiple students (optimized for analytics)
   */
  async getByStudents(studentIds: string[]) {
    if (studentIds.length === 0) {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('exam_attempts')
      .select('*')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async update(id: string, updates: Partial<ExamAttempt>) {
    const { data, error } = await supabase
      .from('exam_attempts')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async submit(id: string) {
    return this.update(id, {
      status: 'completed',
      submitted_at: new Date().toISOString(),
    })
  },
}

export const answerService = {
  async saveAnswer(answer: Omit<StudentAnswer, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('student_answers')
      .upsert(answer, {
        onConflict: 'attempt_id,question_id',
      })
      .select()
      .single()
    return { data, error }
  },

  async getByAttempt(attemptId: string) {
    const { data, error } = await supabase
      .from('student_answers')
      .select('*')
      .eq('attempt_id', attemptId)
    return { data, error }
  },

  /**
   * Batch fetch answers for multiple attempts (optimized for analytics)
   */
  async getByAttempts(attemptIds: string[]) {
    if (attemptIds.length === 0) {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('student_answers')
      .select('*')
      .in('attempt_id', attemptIds)
    return { data, error }
  },

  async update(id: string, updates: Partial<StudentAnswer>) {
    const { data, error } = await supabase
      .from('student_answers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },
}

export const statisticsService = {
  async createOrUpdate(statistics: Omit<ExamStatistics, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('exam_statistics')
      .upsert(statistics, {
        onConflict: 'attempt_id',
      })
      .select()
      .single()
    return { data, error }
  },

  async getByAttempt(attemptId: string) {
    const { data, error } = await supabase
      .from('exam_statistics')
      .select('*')
      .eq('attempt_id', attemptId)
      .single()
    return { data, error }
  },
}

