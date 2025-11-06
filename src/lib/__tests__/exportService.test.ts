import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportService } from '../exportService'
import type { TeacherAnalytics, StudentAnalytics } from '../analyticsService'

// Mock jsPDF
vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setFontSize: vi.fn(),
      text: vi.fn(),
      addPage: vi.fn(),
      save: vi.fn(),
      lastAutoTable: { finalY: 100 },
    })),
  }
})

// Mock jspdf-autotable
vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}))

describe('exportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('exportTeacherAnalyticsToPDF', () => {
    it('should generate PDF with teacher analytics', () => {
      const mockAnalytics: TeacherAnalytics = {
        totalClasses: 2,
        totalStudents: 10,
        totalExams: 5,
        totalAttempts: 20,
        averageScore: 75.5,
        completionRate: 85.0,
        classPerformance: [
          {
            class_id: 'class1',
            class_name: 'Class A',
            student_count: 5,
            average_score: 80,
            completion_rate: 90,
            total_attempts: 10,
          },
        ],
        examPerformance: [
          {
            exam_id: 'exam1',
            exam_title: 'Exam 1',
            total_attempts: 10,
            average_score: 75,
            completion_rate: 100,
            total_students: 10,
          },
        ],
        studentProgress: [],
        atRiskStudents: [
          {
            student_id: 'student1',
            student_name: 'At Risk Student',
            student_email: 'atrisk@example.com',
            class_name: 'Class A',
            low_scores: 3,
            incomplete_attempts: 2,
            recommendation: 'Needs support',
          },
        ],
        questionDifficulty: [],
        topicPerformance: [],
      }

      // Mock document.createElement and related DOM methods
      global.document = {
        createElement: vi.fn().mockReturnValue({
          setAttribute: vi.fn(),
          style: { visibility: '' },
          click: vi.fn(),
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any

      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:url'),
        revokeObjectURL: vi.fn(),
      } as any

      expect(() => {
        exportService.exportTeacherAnalyticsToPDF(mockAnalytics, 'Test Teacher')
      }).not.toThrow()
    })

    it('should handle empty analytics data', () => {
      const emptyAnalytics: TeacherAnalytics = {
        totalClasses: 0,
        totalStudents: 0,
        totalExams: 0,
        totalAttempts: 0,
        averageScore: 0,
        completionRate: 0,
        classPerformance: [],
        examPerformance: [],
        studentProgress: [],
        atRiskStudents: [],
        questionDifficulty: [],
        topicPerformance: [],
      }

      expect(() => {
        exportService.exportTeacherAnalyticsToPDF(emptyAnalytics, 'Test Teacher')
      }).not.toThrow()
    })
  })

  describe('exportTeacherAnalyticsToCSV', () => {
    it('should generate CSV string with teacher analytics', () => {
      const mockAnalytics: TeacherAnalytics = {
        totalClasses: 2,
        totalStudents: 10,
        totalExams: 5,
        totalAttempts: 20,
        averageScore: 75.5,
        completionRate: 85.0,
        classPerformance: [
          {
            class_id: 'class1',
            class_name: 'Class A',
            student_count: 5,
            average_score: 80,
            completion_rate: 90,
            total_attempts: 10,
          },
        ],
        examPerformance: [
          {
            exam_id: 'exam1',
            exam_title: 'Exam 1',
            total_attempts: 10,
            average_score: 75,
            completion_rate: 100,
            total_students: 10,
          },
        ],
        studentProgress: [],
        atRiskStudents: [
          {
            student_id: 'student1',
            student_name: 'At Risk Student',
            student_email: 'atrisk@example.com',
            class_name: 'Class A',
            low_scores: 3,
            incomplete_attempts: 2,
            recommendation: 'Needs support',
          },
        ],
        questionDifficulty: [],
        topicPerformance: [],
      }

      const csv = exportService.exportTeacherAnalyticsToCSV(mockAnalytics)

      expect(csv).toContain('Teacher Analytics Report')
      expect(csv).toContain('Total Classes,2')
      expect(csv).toContain('Total Students,10')
      expect(csv).toContain('Class A')
      expect(csv).toContain('Exam 1')
      expect(csv).toContain('At Risk Student')
    })

    it('should handle empty analytics data', () => {
      const emptyAnalytics: TeacherAnalytics = {
        totalClasses: 0,
        totalStudents: 0,
        totalExams: 0,
        totalAttempts: 0,
        averageScore: 0,
        completionRate: 0,
        classPerformance: [],
        examPerformance: [],
        studentProgress: [],
        atRiskStudents: [],
        questionDifficulty: [],
        topicPerformance: [],
      }

      const csv = exportService.exportTeacherAnalyticsToCSV(emptyAnalytics)

      expect(csv).toContain('Teacher Analytics Report')
      expect(csv).toContain('Total Classes,0')
    })
  })

  describe('exportStudentAnalyticsToPDF', () => {
    it('should generate PDF with student analytics', () => {
      const mockAnalytics: StudentAnalytics = {
        totalAttempts: 5,
        averageScore: 82.5,
        completionRate: 100,
        scoreTrend: [
          {
            date: '2024-01-01',
            score: 80,
            exam_title: 'Exam 1',
            percentage: 80,
          },
          {
            date: '2024-02-01',
            score: 85,
            exam_title: 'Exam 2',
            percentage: 85,
          },
        ],
        topicPerformance: [],
        questionTypePerformance: {
          mcq: { correct: 8, total: 10, percentage: 80 },
          fib: { correct: 7, total: 10, percentage: 70 },
          open_ended: { correct: 6, total: 10, percentage: 60 },
        },
        strengths: ['Multiple Choice Questions'],
        weaknesses: ['Fill in the Blank Questions'],
        improvementAreas: ['Work on FIB questions'],
      }

      global.document = {
        createElement: vi.fn().mockReturnValue({
          setAttribute: vi.fn(),
          style: { visibility: '' },
          click: vi.fn(),
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any

      expect(() => {
        exportService.exportStudentAnalyticsToPDF(mockAnalytics, 'Test Student')
      }).not.toThrow()
    })
  })

  describe('exportStudentAnalyticsToCSV', () => {
    it('should generate CSV string with student analytics', () => {
      const mockAnalytics: StudentAnalytics = {
        totalAttempts: 5,
        averageScore: 82.5,
        completionRate: 100,
        scoreTrend: [
          {
            date: '2024-01-01',
            score: 80,
            exam_title: 'Exam 1',
            percentage: 80,
          },
        ],
        topicPerformance: [],
        questionTypePerformance: {
          mcq: { correct: 8, total: 10, percentage: 80 },
          fib: { correct: 7, total: 10, percentage: 70 },
          open_ended: { correct: 6, total: 10, percentage: 60 },
        },
        strengths: ['Multiple Choice Questions'],
        weaknesses: ['Fill in the Blank Questions'],
        improvementAreas: ['Work on FIB questions'],
      }

      const csv = exportService.exportStudentAnalyticsToCSV(mockAnalytics)

      expect(csv).toContain('Student Analytics Report')
      expect(csv).toContain('Total Attempts,5')
      expect(csv).toContain('Average Score,82.50')
      expect(csv).toContain('Multiple Choice,8,10,80.00%')
      expect(csv).toContain('Multiple Choice Questions')
      expect(csv).toContain('Work on FIB questions')
    })

    it('should handle empty analytics data', () => {
      const emptyAnalytics: StudentAnalytics = {
        totalAttempts: 0,
        averageScore: 0,
        completionRate: 0,
        scoreTrend: [],
        topicPerformance: [],
        questionTypePerformance: {
          mcq: { correct: 0, total: 0, percentage: 0 },
          fib: { correct: 0, total: 0, percentage: 0 },
          open_ended: { correct: 0, total: 0, percentage: 0 },
        },
        strengths: [],
        weaknesses: [],
        improvementAreas: [],
      }

      const csv = exportService.exportStudentAnalyticsToCSV(emptyAnalytics)

      expect(csv).toContain('Student Analytics Report')
      expect(csv).toContain('Total Attempts,0')
    })
  })

  describe('downloadCSV', () => {
    it('should trigger CSV download', () => {
      const mockLink = {
        setAttribute: vi.fn(),
        style: { visibility: '' },
        click: vi.fn(),
      }

      global.document = {
        createElement: vi.fn().mockReturnValue(mockLink),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
      } as any

      global.URL = {
        createObjectURL: vi.fn().mockReturnValue('blob:url'),
        revokeObjectURL: vi.fn(),
      } as any

      global.Blob = vi.fn().mockImplementation((parts, options) => ({
        parts,
        options,
      })) as any

      exportService.downloadCSV('test,data\n1,2', 'test.csv')

      expect(mockLink.setAttribute).toHaveBeenCalledWith('href', 'blob:url')
      expect(mockLink.setAttribute).toHaveBeenCalledWith('download', 'test.csv')
      expect(mockLink.click).toHaveBeenCalled()
    })
  })
})

