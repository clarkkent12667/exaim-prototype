import { supabase } from './supabase'

export interface Qualification {
  id: string
  name: string
  description?: string
  created_at?: string
}

export interface ExamBoard {
  id: string
  name: string
  qualification_id: string
  created_at?: string
}

export interface Subject {
  id: string
  name: string
  exam_board_id: string
  created_at?: string
}

export interface Topic {
  id: string
  name: string
  subject_id: string
  created_at?: string
}

export interface Subtopic {
  id: string
  name: string
  topic_id: string
  created_at?: string
}

// Qualifications CRUD
export const qualificationService = {
  async getAll() {
    const { data, error } = await supabase
      .from('qualifications')
      .select('*')
      .order('name')
    return { data, error }
  },

  async create(qualification: Omit<Qualification, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('qualifications')
      .insert(qualification)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Qualification>) {
    const { data, error } = await supabase
      .from('qualifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('qualifications')
      .delete()
      .eq('id', id)
    return { error }
  },

  async bulkCreate(qualifications: Omit<Qualification, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('qualifications')
      .insert(qualifications)
      .select()
    return { data, error }
  },
}

// Exam Boards CRUD
export const examBoardService = {
  async getAll() {
    const { data, error } = await supabase
      .from('exam_boards')
      .select('*')
      .order('name')
    return { data, error }
  },

  async getByQualification(qualificationId: string) {
    if (!qualificationId || qualificationId.trim() === '') {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('exam_boards')
      .select('*')
      .eq('qualification_id', qualificationId)
      .order('name')
    return { data, error }
  },

  async create(examBoard: Omit<ExamBoard, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('exam_boards')
      .insert(examBoard)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<ExamBoard>) {
    const { data, error } = await supabase
      .from('exam_boards')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('exam_boards')
      .delete()
      .eq('id', id)
    return { error }
  },

  async bulkCreate(examBoards: Omit<ExamBoard, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('exam_boards')
      .insert(examBoards)
      .select()
    return { data, error }
  },
}

// Subjects CRUD
export const subjectService = {
  async getAll() {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name')
    return { data, error }
  },

  async getByExamBoard(examBoardId: string) {
    if (!examBoardId || examBoardId.trim() === '') {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('exam_board_id', examBoardId)
      .order('name')
    return { data, error }
  },

  async create(subject: Omit<Subject, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('subjects')
      .insert(subject)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Subject>) {
    const { data, error } = await supabase
      .from('subjects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id)
    return { error }
  },

  async bulkCreate(subjects: Omit<Subject, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('subjects')
      .insert(subjects)
      .select()
    return { data, error }
  },
}

// Topics CRUD
export const topicService = {
  async getAll() {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .order('name')
    return { data, error }
  },

  async getBySubject(subjectId: string) {
    if (!subjectId || subjectId.trim() === '') {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('subject_id', subjectId)
      .order('name')
    return { data, error }
  },

  async create(topic: Omit<Topic, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('topics')
      .insert(topic)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Topic>) {
    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id)
    return { error }
  },

  async bulkCreate(topics: Omit<Topic, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('topics')
      .insert(topics)
      .select()
    return { data, error }
  },
}

// Subtopics CRUD
export const subtopicService = {
  async getAll() {
    const { data, error } = await supabase
      .from('subtopics')
      .select('*')
      .order('name')
    return { data, error }
  },

  async getByTopic(topicId: string) {
    if (!topicId || topicId.trim() === '') {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('subtopics')
      .select('*')
      .eq('topic_id', topicId)
      .order('name')
    return { data, error }
  },

  async create(subtopic: Omit<Subtopic, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('subtopics')
      .insert(subtopic)
      .select()
      .single()
    return { data, error }
  },

  async update(id: string, updates: Partial<Subtopic>) {
    const { data, error } = await supabase
      .from('subtopics')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('subtopics')
      .delete()
      .eq('id', id)
    return { error }
  },

  async bulkCreate(subtopics: Omit<Subtopic, 'id' | 'created_at'>[]) {
    const { data, error } = await supabase
      .from('subtopics')
      .insert(subtopics)
      .select()
    return { data, error }
  },
}

