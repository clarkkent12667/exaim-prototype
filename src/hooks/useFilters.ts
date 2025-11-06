import { useQuery } from '@tanstack/react-query'
import { classService } from '@/lib/classService'
import { subjectService, examBoardService } from '@/lib/qualificationService'

/**
 * React Query hook for fetching filter options (classes, subjects, exam boards)
 * These are cached separately since they change infrequently
 */
export function useFilterOptions(teacherId?: string) {
  // Fetch classes (only if teacher)
  const { data: classesData } = useQuery({
    queryKey: ['classes', 'teacher', teacherId],
    queryFn: async () => {
      if (!teacherId) return null
      const { data } = await classService.getByTeacher(teacherId)
      return data || []
    },
    enabled: !!teacherId,
    staleTime: 10 * 60 * 1000, // 10 minutes - classes don't change often
  })

  // Fetch subjects (always available)
  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const { data } = await subjectService.getAll()
      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Fetch exam boards (always available)
  const { data: examBoardsData } = useQuery({
    queryKey: ['examBoards'],
    queryFn: async () => {
      const { data } = await examBoardService.getAll()
      return data || []
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Transform to select options format
  const classes = classesData
    ? [
        { value: '', label: 'All Classes' },
        ...classesData.map((c) => ({ value: c.id, label: c.name })),
      ]
    : [{ value: '', label: 'All Classes' }]

  const subjects = subjectsData
    ? [
        { value: '', label: 'All Subjects' },
        ...subjectsData.map((s) => ({ value: s.id, label: s.name })),
      ]
    : [{ value: '', label: 'All Subjects' }]

  const examBoards = examBoardsData
    ? [
        { value: '', label: 'All Exam Boards' },
        ...examBoardsData.map((b) => ({ value: b.id, label: b.name })),
      ]
    : [{ value: '', label: 'All Exam Boards' }]

  return {
    classes,
    subjects,
    examBoards,
    isLoading: false, // These load fast, so we don't need loading state
  }
}

