import { useQuery } from '@tanstack/react-query'
import { assignmentService, type AssignmentWithExam } from '@/lib/classService'
import { examService } from '@/lib/examService'
import { qualificationService, examBoardService, subjectService } from '@/lib/qualificationService'

/**
 * React Query hook for fetching student assignments with enriched exam data
 * Optimized to batch load all related data efficiently
 */
export function useStudentAssignments(studentId: string) {
  return useQuery({
    queryKey: ['assignments', 'student', studentId],
    queryFn: async () => {
      if (!studentId) return []
      
      // Fetch assignments
      const { data: assignments } = await assignmentService.getByStudent(studentId)
      if (!assignments || assignments.length === 0) return []

      // Batch load all exams at once
      const examIds = assignments.map(a => a.exam_id).filter(Boolean)
      const examPromises = examIds.map(id => examService.getById(id))
      const examResults = await Promise.all(examPromises)
      const exams = examResults.map(r => r.data).filter(Boolean)

      // Get unique qualification, exam board, and subject IDs
      const examBoardIds = [...new Set(exams.map(e => e.exam_board_id).filter(Boolean))]
      const subjectIds = [...new Set(exams.map(e => e.subject_id).filter(Boolean))]

      // Batch load all qualifications, exam boards, and subjects at once
      const [qualificationsResult, allExamBoardsResult, allSubjectsResult] = await Promise.all([
        qualificationService.getAll(),
        examBoardService.getAll(),
        subjectService.getAll(),
      ])

      // Filter to only the ones we need
      const qualifications = qualificationsResult.data || []
      const examBoards = (allExamBoardsResult.data || []).filter(b => examBoardIds.includes(b.id))
      const subjects = (allSubjectsResult.data || []).filter(s => subjectIds.includes(s.id))

      // Create lookup maps for O(1) access
      const qualMap = new Map(qualifications.map(q => [q.id, q]))
      const boardMap = new Map(examBoards.map(b => [b.id, b]))
      const subjectMap = new Map(subjects.map(s => [s.id, s]))
      const examMap = new Map(exams.map(e => [e.id, e]))

      // Enrich assignments efficiently
      const enrichedAssignments = assignments
        .map(assignment => {
          const exam = examMap.get(assignment.exam_id)
          if (!exam) return null

          const qual = qualMap.get(exam.qualification_id)
          const board = boardMap.get(exam.exam_board_id)
          const subject = subjectMap.get(exam.subject_id)

          return {
            ...assignment,
            qualification_name: qual?.name,
            exam_board_name: board?.name,
            subject_name: subject?.name,
          }
        })
        .filter(Boolean) as (AssignmentWithExam & { qualification_name?: string; exam_board_name?: string; subject_name?: string })[]

      return enrichedAssignments
    },
    enabled: !!studentId,
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
  })
}

