import { supabase } from './supabase'

export interface Class {
  id: string
  teacher_id: string
  name: string
  description?: string
  created_at?: string
  updated_at?: string
}

export interface ClassEnrollment {
  id: string
  class_id: string
  student_id: string
  enrolled_at?: string
  status: 'active' | 'inactive'
}

export interface ExamAssignment {
  id: string
  class_id: string
  exam_id: string
  assigned_by: string
  assigned_at?: string
  due_date?: string
  is_active: boolean
}

export interface ClassWithDetails extends Class {
  student_count?: number
  exam_count?: number
}

export interface EnrollmentWithStudent extends ClassEnrollment {
  student_name?: string
  student_email?: string
}

export interface AssignmentWithExam extends ExamAssignment {
  exam_title?: string
  exam_total_marks?: number
}

export const classService = {
  async create(classData: Omit<Class, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('classes')
      .insert(classData)
      .select()
      .single()
    return { data, error }
  },

  async getById(id: string) {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('id', id)
      .single()
    return { data, error }
  },

  async getByTeacher(teacherId: string) {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  async getByTeacherWithDetails(teacherId: string): Promise<{ data: ClassWithDetails[] | null, error: any }> {
    const { data: classes, error: classesError } = await this.getByTeacher(teacherId)
    if (classesError || !classes) return { data: null, error: classesError }

    const classesWithDetails = await Promise.all(
      classes.map(async (cls) => {
        // Get student count
        const { count: studentCount } = await supabase
          .from('class_enrollments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('status', 'active')

        // Get exam count
        const { count: examCount } = await supabase
          .from('exam_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('class_id', cls.id)
          .eq('is_active', true)

        return {
          ...cls,
          student_count: studentCount || 0,
          exam_count: examCount || 0,
        }
      })
    )

    return { data: classesWithDetails, error: null }
  },

  async update(id: string, updates: Partial<Class>) {
    const { data, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    return { data, error }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', id)
    return { error }
  },
}

export const enrollmentService = {
  async enrollStudent(classId: string, studentId: string) {
    const { data, error } = await supabase
      .from('class_enrollments')
      .insert({
        class_id: classId,
        student_id: studentId,
        status: 'active',
      })
      .select()
      .single()
    return { data, error }
  },

  async removeStudent(classId: string, studentId: string) {
    const { error } = await supabase
      .from('class_enrollments')
      .update({ status: 'inactive' })
      .eq('class_id', classId)
      .eq('student_id', studentId)
    return { error }
  },

  async getByClass(classId: string): Promise<{ data: EnrollmentWithStudent[] | null, error: any }> {
    const { data: enrollments, error } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })

    if (error || !enrollments) return { data: null, error }

    // Enrich with student information
    const enrollmentsWithStudents = await Promise.all(
      enrollments.map(async (enrollment) => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', enrollment.student_id)
          .single()

        return {
          ...enrollment,
          student_name: profile?.full_name || 'Unknown',
          student_email: profile?.email || 'Unknown',
        }
      })
    )

    return { data: enrollmentsWithStudents, error: null }
  },

  async getByStudent(studentId: string) {
    console.log('[enrollmentService.getByStudent] Fetching enrollments for student:', studentId)
    const startTime = Date.now()
    const { data, error } = await supabase
      .from('class_enrollments')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .order('enrolled_at', { ascending: false })
    console.log('[enrollmentService.getByStudent] Completed in', Date.now() - startTime, 'ms', {
      error,
      errorCode: error?.code,
      errorMessage: error?.message,
      enrollmentCount: data?.length,
      enrollments: data?.map(e => ({ id: e.id, class_id: e.class_id, status: e.status }))
    })
    return { data, error }
  },
}

export const assignmentService = {
  async assignExam(assignment: Omit<ExamAssignment, 'id' | 'assigned_at'>) {
    // First check if the exam is published
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('is_published')
      .eq('id', assignment.exam_id)
      .single()
    
    if (examError) {
      return { data: null, error: examError }
    }
    
    if (!exam?.is_published) {
      return { 
        data: null, 
        error: { 
          message: 'Cannot assign unpublished exam. Please publish the exam first.',
          code: 'UNPUBLISHED_EXAM'
        } 
      }
    }
    
    const { data, error } = await supabase
      .from('exam_assignments')
      .insert({
        ...assignment,
        is_active: true,
      })
      .select()
      .single()
    return { data, error }
  },

  async unassignExam(classId: string, examId: string) {
    const { error } = await supabase
      .from('exam_assignments')
      .update({ is_active: false })
      .eq('class_id', classId)
      .eq('exam_id', examId)
    return { error }
  },

  async getByClass(classId: string): Promise<{ data: AssignmentWithExam[] | null, error: any }> {
    const { data: assignments, error } = await supabase
      .from('exam_assignments')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })

    if (error || !assignments) return { data: null, error }

    // Enrich with exam information
    const assignmentsWithExams = await Promise.all(
      assignments.map(async (assignment) => {
        const { data: exam } = await supabase
          .from('exams')
          .select('title, total_marks')
          .eq('id', assignment.exam_id)
          .single()

        return {
          ...assignment,
          exam_title: exam?.title || 'Unknown',
          exam_total_marks: exam?.total_marks || 0,
        }
      })
    )

    return { data: assignmentsWithExams, error: null }
  },

  async getByStudent(studentId: string): Promise<{ data: AssignmentWithExam[] | null, error: any }> {
    // Get all classes the student is enrolled in
    const { data: enrollments } = await enrollmentService.getByStudent(studentId)
    if (!enrollments || enrollments.length === 0) {
      return { data: [], error: null }
    }

    const classIds = enrollments.map(e => e.class_id).filter(Boolean)
    if (classIds.length === 0) {
      return { data: [], error: null }
    }

    const { data: assignments, error } = await supabase
      .from('exam_assignments')
      .select('*')
      .in('class_id', classIds)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false })

    if (error || !assignments) return { data: null, error }

    // Enrich with exam information
    const assignmentsWithExams = await Promise.all(
      assignments.map(async (assignment) => {
        const { data: exam } = await supabase
          .from('exams')
          .select('title, total_marks')
          .eq('id', assignment.exam_id)
          .single()

        return {
          ...assignment,
          exam_title: exam?.title || 'Unknown',
          exam_total_marks: exam?.total_marks || 0,
        }
      })
    )

    return { data: assignmentsWithExams, error: null }
  },

  async getByExam(examId: string) {
    const { data, error } = await supabase
      .from('exam_assignments')
      .select(`
        *,
        classes (*)
      `)
      .eq('exam_id', examId)
      .eq('is_active', true)
    return { data, error }
  },

  async isAssignedToStudent(examId: string, studentId: string): Promise<{ data: boolean, error: any }> {
    console.log('[assignmentService.isAssignedToStudent] Starting check', { examId, studentId })
    // Efficiently check if a specific exam is assigned to a student
    // by using a single query with joins instead of fetching all assignments
    const enrollmentsStartTime = Date.now()
    const { data: enrollments, error: enrollmentsError } = await enrollmentService.getByStudent(studentId)
    console.log('[assignmentService.isAssignedToStudent] Enrollments fetched in', Date.now() - enrollmentsStartTime, 'ms', { 
      enrollmentsError, 
      enrollmentCount: enrollments?.length,
      enrollments: enrollments?.map(e => ({ id: e.id, class_id: e.class_id, status: e.status }))
    })
    
    if (enrollmentsError || !enrollments || enrollments.length === 0) {
      console.log('[assignmentService.isAssignedToStudent] No enrollments found')
      return { data: false, error: enrollmentsError }
    }

    const classIds = enrollments.map(e => e.class_id).filter(Boolean)
    console.log('[assignmentService.isAssignedToStudent] Class IDs:', classIds)
    if (classIds.length === 0) {
      console.log('[assignmentService.isAssignedToStudent] No valid class IDs')
      return { data: false, error: null }
    }

    const assignmentStartTime = Date.now()
    console.log('[assignmentService.isAssignedToStudent] Querying exam_assignments...', { examId, classIds })
    const { data: assignment, error } = await supabase
      .from('exam_assignments')
      .select('id')
      .eq('exam_id', examId)
      .in('class_id', classIds)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    
    console.log('[assignmentService.isAssignedToStudent] Assignment query completed in', Date.now() - assignmentStartTime, 'ms', {
      error,
      errorCode: error?.code,
      errorMessage: error?.message,
      hasAssignment: !!assignment,
      assignment
    })

    // If error (other than not found), return error
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.log('[assignmentService.isAssignedToStudent] Error occurred:', error)
      return { data: false, error }
    }

    // Return true if assignment exists, false otherwise
    const result = { data: !!assignment, error: null }
    console.log('[assignmentService.isAssignedToStudent] Final result:', result)
    return result
  },
}

