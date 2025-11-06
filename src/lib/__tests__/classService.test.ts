import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classService, enrollmentService, assignmentService } from '../classService'
import { supabase } from '../supabase'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('classService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('should create a new class', async () => {
      const mockClass = {
        id: 'class1',
        teacher_id: 'teacher1',
        name: 'Test Class',
        description: 'Test Description',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockClass, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await classService.create({
        teacher_id: 'teacher1',
        name: 'Test Class',
        description: 'Test Description',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockClass)
      expect(mockInsert).toHaveBeenCalled()
    })

    it('should handle errors when creating class', async () => {
      const mockError = { message: 'Database error', code: '23505' }
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: mockError }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await classService.create({
        teacher_id: 'teacher1',
        name: 'Test Class',
      })

      expect(result.error).toEqual(mockError)
      expect(result.data).toBeNull()
    })
  })

  describe('getById', () => {
    it('should get class by id', async () => {
      const mockClass = {
        id: 'class1',
        teacher_id: 'teacher1',
        name: 'Test Class',
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockClass, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await classService.getById('class1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockClass)
    })
  })

  describe('getByTeacher', () => {
    it('should get all classes for a teacher', async () => {
      const mockClasses = [
        { id: 'class1', teacher_id: 'teacher1', name: 'Class 1' },
        { id: 'class2', teacher_id: 'teacher1', name: 'Class 2' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockClasses, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await classService.getByTeacher('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockClasses)
    })
  })

  describe('getByTeacherWithDetails', () => {
    it('should get classes with student and exam counts', async () => {
      const mockClasses = [
        { id: 'class1', teacher_id: 'teacher1', name: 'Class 1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockClasses, error: null }),
        }),
      })

      const mockCount = vi.fn().mockResolvedValue({ count: 5 })

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(mockCount),
          }),
        }),
      } as any)

      // Mock getByTeacher
      vi.spyOn(classService, 'getByTeacher').mockResolvedValue({ data: mockClasses, error: null })

      const result = await classService.getByTeacherWithDetails('teacher1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.[0].student_count).toBeDefined()
      expect(result.data?.[0].exam_count).toBeDefined()
    })
  })

  describe('update', () => {
    it('should update a class', async () => {
      const updatedClass = {
        id: 'class1',
        teacher_id: 'teacher1',
        name: 'Updated Class',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedClass, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await classService.update('class1', { name: 'Updated Class' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedClass)
    })
  })

  describe('delete', () => {
    it('should delete a class', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await classService.delete('class1')

      expect(result.error).toBeNull()
    })
  })
})

describe('enrollmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('enrollStudent', () => {
    it('should enroll a student in a class', async () => {
      const mockEnrollment = {
        id: 'enrollment1',
        class_id: 'class1',
        student_id: 'student1',
        status: 'active',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockEnrollment, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await enrollmentService.enrollStudent('class1', 'student1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockEnrollment)
    })
  })

  describe('removeStudent', () => {
    it('should remove a student from a class', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await enrollmentService.removeStudent('class1', 'student1')

      expect(result.error).toBeNull()
    })
  })

  describe('getByClass', () => {
    it('should get enrollments with student information', async () => {
      const mockEnrollments = [
        {
          id: 'e1',
          class_id: 'class1',
          student_id: 'student1',
          status: 'active',
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
          }),
        }),
      })

      const mockProfileSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { full_name: 'Test Student', email: 'test@example.com' },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'class_enrollments') {
          return { select: mockSelect } as any
        }
        if (table === 'profiles') {
          return { select: mockProfileSelect } as any
        }
        return {} as any
      })

      const result = await enrollmentService.getByClass('class1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.[0].student_name).toBe('Test Student')
      expect(result.data?.[0].student_email).toBe('test@example.com')
    })
  })

  describe('getByStudent', () => {
    it('should get all enrollments for a student', async () => {
      const mockEnrollments = [
        {
          id: 'e1',
          class_id: 'class1',
          student_id: 'student1',
          status: 'active',
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockEnrollments, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await enrollmentService.getByStudent('student1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockEnrollments)
    })
  })
})

describe('assignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('assignExam', () => {
    it('should assign a published exam to a class', async () => {
      const mockExam = { id: 'exam1', is_published: true }
      const mockAssignment = {
        id: 'assignment1',
        class_id: 'class1',
        exam_id: 'exam1',
        assigned_by: 'teacher1',
        is_active: true,
      }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockExam, error: null }),
        }),
      })

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAssignment, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exams') {
          return { select: mockSelect } as any
        }
        if (table === 'exam_assignments') {
          return { insert: mockInsert } as any
        }
        return {} as any
      })

      const result = await assignmentService.assignExam({
        class_id: 'class1',
        exam_id: 'exam1',
        assigned_by: 'teacher1',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockAssignment)
    })

    it('should reject assignment of unpublished exam', async () => {
      const mockExam = { id: 'exam1', is_published: false }

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockExam, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await assignmentService.assignExam({
        class_id: 'class1',
        exam_id: 'exam1',
        assigned_by: 'teacher1',
      })

      expect(result.error).toBeDefined()
      expect(result.error?.code).toBe('UNPUBLISHED_EXAM')
      expect(result.data).toBeNull()
    })
  })

  describe('unassignExam', () => {
    it('should unassign an exam from a class', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await assignmentService.unassignExam('class1', 'exam1')

      expect(result.error).toBeNull()
    })
  })

  describe('getByClass', () => {
    it('should get assignments with exam information', async () => {
      const mockAssignments = [
        {
          id: 'assignment1',
          class_id: 'class1',
          exam_id: 'exam1',
          is_active: true,
        },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAssignments, error: null }),
          }),
        }),
      })

      const mockExamSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { title: 'Test Exam', total_marks: 100 },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exam_assignments') {
          return { select: mockSelect } as any
        }
        if (table === 'exams') {
          return { select: mockExamSelect } as any
        }
        return {} as any
      })

      const result = await assignmentService.getByClass('class1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
      expect(result.data?.[0].exam_title).toBe('Test Exam')
    })
  })

  describe('getByStudent', () => {
    it('should get assignments for a student', async () => {
      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
      ]

      const mockAssignments = [
        {
          id: 'assignment1',
          class_id: 'class1',
          exam_id: 'exam1',
          is_active: true,
        },
      ]

      vi.spyOn(enrollmentService, 'getByStudent').mockResolvedValue({
        data: mockEnrollments,
        error: null,
      })

      const mockSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockAssignments, error: null }),
          }),
        }),
      })

      const mockExamSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { title: 'Test Exam', total_marks: 100 },
            error: null,
          }),
        }),
      })

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'exam_assignments') {
          return { select: mockSelect } as any
        }
        if (table === 'exams') {
          return { select: mockExamSelect } as any
        }
        return {} as any
      })

      const result = await assignmentService.getByStudent('student1')

      expect(result.error).toBeNull()
      expect(result.data).toBeDefined()
    })
  })

  describe('isAssignedToStudent', () => {
    it('should return true if exam is assigned to student', async () => {
      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
      ]

      vi.spyOn(enrollmentService, 'getByStudent').mockResolvedValue({
        data: mockEnrollments,
        error: null,
      })

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'assignment1' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await assignmentService.isAssignedToStudent('exam1', 'student1')

      expect(result.error).toBeNull()
      expect(result.data).toBe(true)
    })

    it('should return false if exam is not assigned to student', async () => {
      const mockEnrollments = [
        { id: 'e1', class_id: 'class1', student_id: 'student1', status: 'active' },
      ]

      vi.spyOn(enrollmentService, 'getByStudent').mockResolvedValue({
        data: mockEnrollments,
        error: null,
      })

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: 'PGRST116' },
                }),
              }),
            }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await assignmentService.isAssignedToStudent('exam1', 'student1')

      expect(result.error).toBeNull()
      expect(result.data).toBe(false)
    })
  })
})

