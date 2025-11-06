import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '@/lib/analyticsService'
// Import optimized versions (uncomment when ready to use)
// import { 
//   getTeacherAnalyticsOptimized,
//   getGradesHeatMapDataOptimized,
//   getInterventionDataOptimized,
//   getStudentAnalyticsOptimized
// } from '@/lib/analyticsServiceOptimized'

/**
 * React Query hook for fetching teacher analytics
 * Provides caching and automatic refetching
 */
export function useTeacherAnalytics(
  teacherId: string,
  classId?: string,
  dateRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ['analytics', 'teacher', teacherId, classId, dateRange],
    queryFn: async () => {
      // TODO: Switch to optimized version after testing
      // const { data, error } = await getTeacherAnalyticsOptimized(teacherId, classId, dateRange)
      const { data, error } = await analyticsService.getTeacherAnalytics(
        teacherId,
        classId,
        dateRange
      )
      if (error) throw error
      return data
    },
    enabled: !!teacherId,
    staleTime: 3 * 60 * 1000, // 3 minutes - analytics data changes less frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * React Query hook for fetching student analytics
 */
export function useStudentAnalytics(
  studentId: string,
  dateRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ['analytics', 'student', studentId, dateRange],
    queryFn: async () => {
      // TODO: Switch to optimized version after testing
      // const { data, error } = await getStudentAnalyticsOptimized(studentId, dateRange)
      const { data, error } = await analyticsService.getStudentAnalytics(
        studentId,
        dateRange
      )
      if (error) throw error
      return data
    },
    enabled: !!studentId,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

/**
 * React Query hook for fetching grades heat map data (teacher)
 */
export function useGradesHeatMap(
  teacherId: string,
  classId?: string,
  dateRange?: { start: Date; end: Date },
  subjectId?: string,
  examBoardId?: string
) {
  return useQuery({
    queryKey: ['grades', 'heatmap', 'teacher', teacherId, classId, dateRange, subjectId, examBoardId],
    queryFn: async () => {
      // TODO: Switch to optimized version after testing
      // const { data, error } = await getGradesHeatMapDataOptimized(teacherId, classId, dateRange, subjectId, examBoardId)
      const { data, error } = await analyticsService.getGradesHeatMapData(
        teacherId,
        classId,
        dateRange,
        subjectId,
        examBoardId
      )
      if (error) throw error
      return data
    },
    enabled: !!teacherId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * React Query hook for fetching student grades heat map
 */
export function useStudentGradesHeatMap(
  studentId: string,
  dateRange?: { start: Date; end: Date }
) {
  return useQuery({
    queryKey: ['grades', 'heatmap', 'student', studentId, dateRange],
    queryFn: async () => {
      const { data, error } = await analyticsService.getStudentGradesHeatMap(
        studentId,
        dateRange
      )
      if (error) throw error
      return data
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  })
}

/**
 * React Query hook for fetching intervention data
 */
export function useInterventionData(
  teacherId: string,
  classId?: string
) {
  return useQuery({
    queryKey: ['intervention', teacherId, classId],
    queryFn: async () => {
      // TODO: Switch to optimized version after testing
      // const { data, error } = await getInterventionDataOptimized(teacherId, classId)
      const { data, error } = await analyticsService.getInterventionData(
        teacherId,
        classId
      )
      if (error) throw error
      return data || []
    },
    enabled: !!teacherId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
  })
}

