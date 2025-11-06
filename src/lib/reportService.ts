import { supabase } from './supabase'
import { classService, enrollmentService } from './classService'
import { examService } from './examService'
import { subjectService } from './qualificationService'

export type ReportType = 'student' | 'class' | 'subject' | 'term' | 'exam'

export interface ReportConfig {
  student_id?: string
  class_id?: string
  subject_id?: string
  exam_id?: string
  term_name?: string
  term_start?: string
  term_end?: string
  date_range?: { start: string; end: string }
  format_style?: 'concise' | 'detailed'
  include_charts?: boolean
}

export interface ReportData {
  report_type: ReportType
  generated_at: string
  generated_by: {
    id: string
    name: string
    email: string
  }
  institution_name?: string
  data: any
}

export interface StudentReportData extends ReportData {
  report_type: 'student'
  data: {
    student: {
      id: string
      name: string
      email: string
    }
    mark_sheet: {
      total_attempts: number
      average_score: number
      best_score: number
      latest_score: number
      improvement_percentage: number
    }
    topic_mastery: Array<{
      topic_name: string
      accuracy_percentage: number
      mastery_level: string
      total_questions: number
      correct_questions: number
    }>
    progress_timeline: Array<{
      date: string
      exam_title: string
      score: number
      percentage: number
    }>
    class_comparison?: {
      student_average: number
      class_average: number
      percentile: number
      rank: number
      total_students: number
    }
  }
}

export interface ClassReportData extends ReportData {
  report_type: 'class'
  data: {
    class: {
      id: string
      name: string
      student_count: number
    }
    class_average: number
    topic_summary: Array<{
      topic_name: string
      average_accuracy: number
      total_attempts: number
    }>
    distribution: {
      excellent: number // 90-100%
      good: number // 70-89%
      average: number // 50-69%
      needs_improvement: number // <50%
    }
    top_students: Array<{
      student_id: string
      student_name: string
      average_score: number
    }>
    students_needing_attention: Array<{
      student_id: string
      student_name: string
      average_score: number
      low_scores: number
    }>
  }
}

export interface SubjectReportData extends ReportData {
  report_type: 'subject'
  data: {
    subject: {
      id: string
      name: string
    }
    classes: Array<{
      class_id: string
      class_name: string
      student_count: number
      average_score: number
      total_attempts: number
    }>
    overall_performance: {
      average_score: number
      total_students: number
      total_attempts: number
      completion_rate: number
    }
    topic_performance: Array<{
      topic_name: string
      average_accuracy: number
      total_attempts: number
    }>
  }
}

export interface TermReportData extends ReportData {
  report_type: 'term'
  data: {
    term: {
      name: string
      start_date: string
      end_date: string
    }
    coverage_percentage: number
    average_score: number
    improvement_vs_last_term?: {
      average_score_change: number
      percentage_change: number
      trend: 'improving' | 'declining' | 'stable'
    }
    class_performance: Array<{
      class_id: string
      class_name: string
      average_score: number
      student_count: number
    }>
    subject_performance: Array<{
      subject_id: string
      subject_name: string
      average_score: number
      total_attempts: number
    }>
  }
}

export interface ExamReportData extends ReportData {
  report_type: 'exam'
  data: {
    exam: {
      id: string
      title: string
      total_marks: number
      subject_name: string
    }
    participation_stats: {
      total_students: number
      attempted: number
      completed: number
      participation_rate: number
      completion_rate: number
    }
    question_difficulty: Array<{
      question_id: string
      question_text: string
      difficulty_percentage: number
      average_score: number
      total_attempts: number
    }>
    score_distribution: Array<{
      range: string
      count: number
    }>
    top_performers: Array<{
      student_id: string
      student_name: string
      score: number
      percentage: number
    }>
  }
}

export const reportService = {
  /**
   * Generate a student report
   * NOTE: Analytics feature has been removed
   */
  async generateStudentReport(
    studentId: string,
    config: ReportConfig = {}
  ): Promise<{ data: StudentReportData | null; error: any }> {
    return { data: null, error: new Error('Analytics feature has been removed') }
  },

  /**
   * Generate a class report
   * NOTE: Analytics feature has been removed
   */
  async generateClassReport(
    classId: string,
    config: ReportConfig = {}
  ): Promise<{ data: ClassReportData | null; error: any }> {
    return { data: null, error: new Error('Analytics feature has been removed') }
  },

  /**
   * Generate a subject report
   * NOTE: Analytics feature has been removed
   */
  async generateSubjectReport(
    subjectId: string,
    config: ReportConfig = {}
  ): Promise<{ data: SubjectReportData | null; error: any }> {
    return { data: null, error: new Error('Analytics feature has been removed') }
  },

  /**
   * Generate a term report
   * NOTE: Analytics feature has been removed
   */
  async generateTermReport(
    termName: string,
    termStart: string,
    termEnd: string,
    config: ReportConfig = {}
  ): Promise<{ data: TermReportData | null; error: any }> {
    return { data: null, error: new Error('Analytics feature has been removed') }
  },

  /**
   * Generate an exam report
   * NOTE: Analytics feature has been removed
   */
  async generateExamReport(
    examId: string,
    config: ReportConfig = {}
  ): Promise<{ data: ExamReportData | null; error: any }> {
    return { data: null, error: new Error('Analytics feature has been removed') }
  },

  /**
   * Queue a report for generation
   */
  async queueReport(
    reportType: ReportType,
    config: ReportConfig,
    fileFormat: 'pdf' | 'csv' = 'pdf'
  ): Promise<{ data: { id: string } | null; error: any }> {
    try {
      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser?.user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      // Set expiration (30 days from now)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 30)

      const { data, error } = await supabase
        .from('report_queue')
        .insert({
          created_by: currentUser.user.id,
          report_type: reportType,
          report_config: config,
          status: 'pending',
          file_format: fileFormat,
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (error) return { data: null, error }

      return { data: { id: data.id }, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  /**
   * Get report queue status
   */
  async getReportStatus(reportQueueId: string): Promise<{ data: any | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('report_queue')
        .select('*')
        .eq('id', reportQueueId)
        .single()

      if (error) return { data: null, error }

      return { data, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  },
}

