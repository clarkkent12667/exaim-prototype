import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { examService } from '@/lib/examService'

/**
 * React Query hook for fetching exams by teacher
 * Provides caching, automatic refetching, and loading states
 */
export function useExamsByTeacher(teacherId: string) {
  return useQuery({
    queryKey: ['exams', 'teacher', teacherId],
    queryFn: async () => {
      const { data, error } = await examService.getByTeacher(teacherId)
      if (error) throw error
      return data || []
    },
    enabled: !!teacherId, // Only fetch if teacherId exists
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  })
}

/**
 * React Query hook for fetching a single exam by ID
 */
export function useExam(examId: string) {
  return useQuery({
    queryKey: ['exams', examId],
    queryFn: async () => {
      const { data, error } = await examService.getById(examId)
      if (error) throw error
      return data
    },
    enabled: !!examId,
    staleTime: 5 * 60 * 1000, // Exam data is relatively static
  })
}

/**
 * Mutation hook for deleting an exam
 * Automatically invalidates and refetches the exams list
 */
export function useDeleteExam() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (examId: string) => {
      const { error } = await examService.delete(examId)
      if (error) throw error
      return examId
    },
    onSuccess: (examId) => {
      // Invalidate all exam queries to refetch
      queryClient.invalidateQueries({ queryKey: ['exams'] })
      // Remove the specific exam from cache
      queryClient.removeQueries({ queryKey: ['exams', examId] })
    },
  })
}

/**
 * Mutation hook for publishing/unpublishing an exam
 */
export function useToggleExamPublish() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ examId, publish }: { examId: string; publish: boolean }) => {
      const { error } = publish 
        ? await examService.publish(examId)
        : await examService.unpublish(examId)
      if (error) throw error
      return { examId, publish }
    },
    onSuccess: () => {
      // Invalidate exams list to refetch with updated status
      queryClient.invalidateQueries({ queryKey: ['exams'] })
    },
  })
}

