import { supabase } from './supabase'
import { examService, attemptService, answerService, statisticsService, questionService, type Exam, type ExamAttempt, type StudentAnswer } from './examService'
import { classService, enrollmentService, assignmentService } from './classService'

export interface TeacherAnalytics {
  totalClasses: number
  totalStudents: number
  totalExams: number
  totalAttempts: number
  averageScore: number
  completionRate: number
  classPerformance: ClassPerformance[]
  examPerformance: ExamPerformance[]
  studentProgress: StudentProgress[]
  atRiskStudents: AtRiskStudent[]
  questionDifficulty: QuestionDifficulty[]
  topicPerformance: TopicPerformance[]
}

export interface ClassPerformance {
  class_id: string
  class_name: string
  student_count: number
  average_score: number
  completion_rate: number
  total_attempts: number
}

export interface ExamPerformance {
  exam_id: string
  exam_title: string
  total_attempts: number
  average_score: number
  completion_rate: number
  total_students: number
}

export interface StudentProgress {
  student_id: string
  student_name: string
  student_email: string
  total_attempts: number
  average_score: number
  improvement_trend: 'improving' | 'declining' | 'stable'
  last_attempt_date?: string
}

export interface AtRiskStudent {
  student_id: string
  student_name: string
  student_email: string
  class_name: string
  low_scores: number
  incomplete_attempts: number
  last_activity?: string
  recommendation: string
}

export interface QuestionDifficulty {
  question_id: string
  question_text: string
  correct_rate: number
  average_score: number
  total_attempts: number
  difficulty_level: 'easy' | 'medium' | 'hard'
}

export interface TopicPerformance {
  topic_id?: string
  topic_name: string
  subject_id: string
  subject_name: string
  average_score: number
  total_attempts: number
  improvement_rate: number
}

export interface StudentAnalytics {
  totalAttempts: number
  averageScore: number
  completionRate: number
  scoreTrend: ScoreTrendPoint[]
  topicPerformance: TopicPerformance[]
  questionTypePerformance: QuestionTypePerformance
  strengths: string[]
  weaknesses: string[]
  improvementAreas: string[]
}

export interface ScoreTrendPoint {
  date: string
  score: number
  exam_title: string
  percentage: number
}

export interface QuestionTypePerformance {
  mcq: { correct: number; total: number; percentage: number }
  fib: { correct: number; total: number; percentage: number }
  open_ended: { correct: number; total: number; percentage: number }
}

export const analyticsService = {
  async getTeacherAnalytics(teacherId: string, classId?: string, dateRange?: { start: Date; end: Date }): Promise<{ data: TeacherAnalytics | null, error: any }> {
    try {
      // Get classes
      const { data: classes } = await classService.getByTeacher(teacherId)
      const filteredClasses = classId ? classes?.filter(c => c.id === classId) : classes
      const totalClasses = filteredClasses?.length || 0

      // Get all students in classes
      let allStudentIds: string[] = []
      if (filteredClasses && filteredClasses.length > 0) {
        for (const cls of filteredClasses) {
          const { data: enrollments } = await enrollmentService.getByClass(cls.id)
          if (enrollments) {
            allStudentIds.push(...enrollments.map(e => e.student_id))
          }
        }
      }
      const uniqueStudentIds = [...new Set(allStudentIds)]
      const totalStudents = uniqueStudentIds.length

      // Get exams
      const { data: exams } = await examService.getByTeacher(teacherId)
      const totalExams = exams?.length || 0

      // Get all attempts for exams
      let allAttempts: ExamAttempt[] = []
      let totalScore = 0
      let completedCount = 0
      if (exams && exams.length > 0) {
        for (const exam of exams) {
          const { data: attempts } = await attemptService.getByExam(exam.id)
          if (attempts) {
            // Filter by date range if provided
            let filteredAttempts = attempts
            if (dateRange) {
              filteredAttempts = attempts.filter(a => {
                const attemptDate = new Date(a.started_at)
                return attemptDate >= dateRange.start && attemptDate <= dateRange.end
              })
            }
            allAttempts.push(...filteredAttempts)
            completedCount += filteredAttempts.filter(a => a.status === 'completed').length
            totalScore += filteredAttempts
              .filter(a => a.status === 'completed')
              .reduce((sum, a) => sum + a.total_score, 0)
          }
        }
      }
      const totalAttempts = allAttempts.length
      const averageScore = completedCount > 0 ? totalScore / completedCount : 0
      const completionRate = totalAttempts > 0 ? (completedCount / totalAttempts) * 100 : 0

      // Class performance
      const classPerformance: ClassPerformance[] = []
      if (filteredClasses) {
        for (const cls of filteredClasses) {
          const { data: enrollments } = await enrollmentService.getByClass(cls.id)
          const studentCount = enrollments?.length || 0
          
          const { data: assignments } = await assignmentService.getByClass(cls.id)
          const examIds = assignments?.map(a => a.exam_id) || []
          
          let classAttempts: ExamAttempt[] = []
          let classTotalScore = 0
          let classCompletedCount = 0
          
          for (const examId of examIds) {
            const { data: attempts } = await attemptService.getByExam(examId)
            if (attempts) {
              const classStudentAttempts = attempts.filter(a => 
                uniqueStudentIds.includes(a.student_id) &&
                (!dateRange || (new Date(a.started_at) >= dateRange.start && new Date(a.started_at) <= dateRange.end))
              )
              classAttempts.push(...classStudentAttempts)
              classCompletedCount += classStudentAttempts.filter(a => a.status === 'completed').length
              classTotalScore += classStudentAttempts
                .filter(a => a.status === 'completed')
                .reduce((sum, a) => sum + a.total_score, 0)
            }
          }
          
          classPerformance.push({
            class_id: cls.id,
            class_name: cls.name,
            student_count: studentCount,
            average_score: classCompletedCount > 0 ? classTotalScore / classCompletedCount : 0,
            completion_rate: classAttempts.length > 0 ? (classCompletedCount / classAttempts.length) * 100 : 0,
            total_attempts: classAttempts.length,
          })
        }
      }

      // Exam performance
      const examPerformance: ExamPerformance[] = []
      if (exams) {
        for (const exam of exams) {
          const { data: attempts } = await attemptService.getByExam(exam.id)
          if (attempts) {
            let filteredAttempts = attempts
            if (dateRange) {
              filteredAttempts = attempts.filter(a => {
                const attemptDate = new Date(a.started_at)
                return attemptDate >= dateRange.start && attemptDate <= dateRange.end
              })
            }
            const completedAttempts = filteredAttempts.filter(a => a.status === 'completed')
            const avgScore = completedAttempts.length > 0
              ? completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length
              : 0
            
            examPerformance.push({
              exam_id: exam.id,
              exam_title: exam.title,
              total_attempts: filteredAttempts.length,
              average_score: avgScore,
              completion_rate: filteredAttempts.length > 0 ? (completedAttempts.length / filteredAttempts.length) * 100 : 0,
              total_students: [...new Set(filteredAttempts.map(a => a.student_id))].length,
            })
          }
        }
      }

      // Student progress (simplified - would need more data for trends)
      const studentProgress: StudentProgress[] = []
      for (const studentId of uniqueStudentIds) {
        const { data: attempts } = await attemptService.getByStudent(studentId)
        if (attempts && attempts.length > 0) {
          const completedAttempts = attempts.filter(a => a.status === 'completed')
          const avgScore = completedAttempts.length > 0
            ? completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length
            : 0
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', studentId)
            .single()

          studentProgress.push({
            student_id: studentId,
            student_name: profile?.full_name || 'Unknown',
            student_email: profile?.email || 'Unknown',
            total_attempts: attempts.length,
            average_score: avgScore,
            improvement_trend: 'stable', // Simplified - would need historical comparison
            last_attempt_date: attempts[0]?.started_at,
          })
        }
      }

      // At-risk students (simplified logic)
      const atRiskStudents: AtRiskStudent[] = []
      for (const student of studentProgress) {
        const { data: attempts } = await attemptService.getByStudent(student.student_id)
        if (attempts) {
          const completedAttempts = attempts.filter(a => a.status === 'completed')
          const lowScores = completedAttempts.filter(a => {
            // Get exam to calculate percentage
            const examId = a.exam_id
            // Simplified - would need exam data
            return a.total_score < 50 // Assuming 50% threshold
          }).length
          
          const incompleteAttempts = attempts.filter(a => a.status === 'in_progress').length
          
          if (lowScores > 0 || incompleteAttempts > 2) {
            // Find which class
            let className = 'Unknown'
            if (filteredClasses) {
              for (const cls of filteredClasses) {
                const { data: enrollments } = await enrollmentService.getByClass(cls.id)
                if (enrollments?.some(e => e.student_id === student.student_id)) {
                  className = cls.name
                  break
                }
              }
            }

            atRiskStudents.push({
              student_id: student.student_id,
              student_name: student.student_name,
              student_email: student.student_email,
              class_name: className,
              low_scores: lowScores,
              incomplete_attempts: incompleteAttempts,
              last_activity: student.last_attempt_date,
              recommendation: lowScores > 0 
                ? 'Student has low scores. Consider additional support or review sessions.'
                : 'Student has incomplete attempts. Follow up on engagement.',
            })
          }
        }
      }

      // Question difficulty (simplified - would need question-level data)
      const questionDifficulty: QuestionDifficulty[] = []

      // Topic performance (simplified - would need topic data)
      const topicPerformance: TopicPerformance[] = []

      return {
        data: {
          totalClasses,
          totalStudents,
          totalExams,
          totalAttempts,
          averageScore,
          completionRate,
          classPerformance,
          examPerformance,
          studentProgress,
          atRiskStudents,
          questionDifficulty,
          topicPerformance,
        },
        error: null,
      }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  async getStudentAnalytics(studentId: string, dateRange?: { start: Date; end: Date }): Promise<{ data: StudentAnalytics | null, error: any }> {
    try {
      const { data: attempts } = await attemptService.getByStudent(studentId)
      if (!attempts || attempts.length === 0) {
        return {
          data: {
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
          },
          error: null,
        }
      }

      let filteredAttempts = attempts
      if (dateRange) {
        filteredAttempts = attempts.filter(a => {
          const attemptDate = new Date(a.started_at)
          return attemptDate >= dateRange.start && attemptDate <= dateRange.end
        })
      }

      const completedAttempts = filteredAttempts.filter(a => a.status === 'completed')
      const totalAttempts = filteredAttempts.length
      const averageScore = completedAttempts.length > 0
        ? completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length
        : 0
      const completionRate = totalAttempts > 0 ? (completedAttempts.length / totalAttempts) * 100 : 0

      // Score trend
      const scoreTrend: ScoreTrendPoint[] = []
      for (const attempt of completedAttempts.sort((a, b) => 
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
      )) {
        const { data: exam } = await examService.getById(attempt.exam_id)
        if (exam) {
          const percentage = exam.total_marks > 0 ? (attempt.total_score / exam.total_marks) * 100 : 0
          scoreTrend.push({
            date: attempt.started_at,
            score: attempt.total_score,
            exam_title: exam.title,
            percentage,
          })
        }
      }

      // Question type performance
      let mcqCorrect = 0, mcqTotal = 0
      let fibCorrect = 0, fibTotal = 0
      let openEndedCorrect = 0, openEndedTotal = 0

      for (const attempt of completedAttempts) {
        const { data: answers } = await answerService.getByAttempt(attempt.id)
        if (answers) {
          const { data: exam } = await examService.getById(attempt.exam_id)
          if (exam) {
            const { data: questions } = await questionService.getByExam(exam.id)
            if (questions) {
              for (const answer of answers) {
                const question = questions.find(q => q.id === answer.question_id)
                if (question) {
                  if (question.question_type === 'mcq') {
                    mcqTotal++
                    if (answer.is_correct) mcqCorrect++
                  } else if (question.question_type === 'fib') {
                    fibTotal++
                    if (answer.is_correct) fibCorrect++
                  } else if (question.question_type === 'open_ended') {
                    openEndedTotal++
                    if (answer.is_correct || (answer.score > 0 && answer.score >= question.marks * 0.7)) {
                      openEndedCorrect++
                    }
                  }
                }
              }
            }
          }
        }
      }

      const questionTypePerformance: QuestionTypePerformance = {
        mcq: {
          correct: mcqCorrect,
          total: mcqTotal,
          percentage: mcqTotal > 0 ? (mcqCorrect / mcqTotal) * 100 : 0,
        },
        fib: {
          correct: fibCorrect,
          total: fibTotal,
          percentage: fibTotal > 0 ? (fibCorrect / fibTotal) * 100 : 0,
        },
        open_ended: {
          correct: openEndedCorrect,
          total: openEndedTotal,
          percentage: openEndedTotal > 0 ? (openEndedCorrect / openEndedTotal) * 100 : 0,
        },
      }

      // Topic performance (simplified)
      const topicPerformance: TopicPerformance[] = []

      // Strengths and weaknesses (simplified)
      const strengths: string[] = []
      const weaknesses: string[] = []
      const improvementAreas: string[] = []

      if (questionTypePerformance.mcq.percentage > 80) {
        strengths.push('Multiple Choice Questions')
      } else if (questionTypePerformance.mcq.percentage < 60) {
        weaknesses.push('Multiple Choice Questions')
        improvementAreas.push('Focus on understanding key concepts for MCQ questions')
      }

      if (questionTypePerformance.fib.percentage > 80) {
        strengths.push('Fill in the Blank Questions')
      } else if (questionTypePerformance.fib.percentage < 60) {
        weaknesses.push('Fill in the Blank Questions')
        improvementAreas.push('Practice vocabulary and key terms for FIB questions')
      }

      if (questionTypePerformance.open_ended.percentage > 70) {
        strengths.push('Open-Ended Questions')
      } else if (questionTypePerformance.open_ended.percentage < 50) {
        weaknesses.push('Open-Ended Questions')
        improvementAreas.push('Work on structuring comprehensive answers for open-ended questions')
      }

      return {
        data: {
          totalAttempts,
          averageScore,
          completionRate,
          scoreTrend,
          topicPerformance,
          questionTypePerformance,
          strengths,
          weaknesses,
          improvementAreas,
        },
        error: null,
      }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  async getGradesHeatMapData(
    teacherId: string,
    classId?: string,
    dateRange?: { start: Date; end: Date },
    subjectId?: string,
    examBoardId?: string
  ): Promise<{
    data: {
      students: Array<{
        id: string
        name: string
        email: string
        average_score: number
      }>
      exams: Array<{
        id: string
        title: string
        total_marks: number
        average_score: number
      }>
      cells: Array<{
        student_id: string
        exam_id: string
        score: number
        percentage: number
        attempt_id?: string
        submitted_at?: string
        time_spent_minutes?: number
      }>
    } | null
    error: any
  }> {
    try {
      // Get classes
      const { data: classes } = await classService.getByTeacher(teacherId)
      const filteredClasses = classId ? classes?.filter((c) => c.id === classId) : classes

      // Get all students in classes
      let allStudentIds: string[] = []
      if (filteredClasses && filteredClasses.length > 0) {
        for (const cls of filteredClasses) {
          const { data: enrollments } = await enrollmentService.getByClass(cls.id)
          if (enrollments) {
            allStudentIds.push(...enrollments.map((e) => e.student_id))
          }
        }
      }
      const uniqueStudentIds = [...new Set(allStudentIds)]

      // Get exams with filters
      let { data: exams } = await examService.getByTeacher(teacherId)
      if (subjectId) {
        exams = exams?.filter((e) => e.subject_id === subjectId)
      }
      if (examBoardId) {
        exams = exams?.filter((e) => e.exam_board_id === examBoardId)
      }

      if (!exams || exams.length === 0) {
        return {
          data: {
            students: [],
            exams: [],
            cells: [],
          },
          error: null,
        }
      }

      // Get all attempts for these exams
      const examIds = exams.map((e) => e.id)
      const { data: allAttempts } = await attemptService.getByExams(examIds)

      // Filter attempts by date range and student IDs
      let filteredAttempts = (allAttempts || []).filter((a) => {
        if (!uniqueStudentIds.includes(a.student_id)) return false
        if (dateRange) {
          const attemptDate = new Date(a.started_at)
          return attemptDate >= dateRange.start && attemptDate <= dateRange.end
        }
        return true
      })

      // Get student profiles
      const studentsMap = new Map<string, { id: string; name: string; email: string }>()
      for (const studentId of uniqueStudentIds) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', studentId)
          .single()
        if (profile) {
          studentsMap.set(studentId, {
            id: studentId,
            name: profile.full_name || 'Unknown',
            email: profile.email || '',
          })
        }
      }

      // Calculate student averages and exam averages
      const studentScores = new Map<string, number[]>()
      const examScores = new Map<string, number[]>()

      for (const attempt of filteredAttempts.filter((a) => a.status === 'completed')) {
        // Student scores
        if (!studentScores.has(attempt.student_id)) {
          studentScores.set(attempt.student_id, [])
        }
        studentScores.get(attempt.student_id)?.push(attempt.total_score)

        // Exam scores
        if (!examScores.has(attempt.exam_id)) {
          examScores.set(attempt.exam_id, [])
        }
        examScores.get(attempt.exam_id)?.push(attempt.total_score)
      }

      // Build students array with averages
      const students = Array.from(studentsMap.values()).map((student) => {
        const scores = studentScores.get(student.id) || []
        const average_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        return { ...student, average_score }
      })

      // Build exams array with averages
      const examsWithAverages = exams.map((exam) => {
        const scores = examScores.get(exam.id) || []
        const average_score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        return {
          id: exam.id,
          title: exam.title,
          total_marks: exam.total_marks,
          average_score,
        }
      })

      // Build cells array
      const cells: Array<{
        student_id: string
        exam_id: string
        score: number
        percentage: number
        attempt_id?: string
        submitted_at?: string
        time_spent_minutes?: number
      }> = []

      for (const attempt of filteredAttempts.filter((a) => a.status === 'completed')) {
        const exam = exams.find((e) => e.id === attempt.exam_id)
        if (!exam) continue

        const percentage = exam.total_marks > 0 ? (attempt.total_score / exam.total_marks) * 100 : 0

        // Calculate time spent
        let timeSpentMinutes: number | undefined
        if (attempt.submitted_at && attempt.started_at) {
          const startTime = new Date(attempt.started_at).getTime()
          const endTime = new Date(attempt.submitted_at).getTime()
          timeSpentMinutes = (endTime - startTime) / (1000 * 60) // Convert to minutes
        }

        cells.push({
          student_id: attempt.student_id,
          exam_id: attempt.exam_id,
          score: attempt.total_score,
          percentage,
          attempt_id: attempt.id,
          submitted_at: attempt.submitted_at,
          time_spent_minutes: timeSpentMinutes,
        })
      }

      return {
        data: {
          students,
          exams: examsWithAverages,
          cells,
        },
        error: null,
      }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  async getInterventionData(
    teacherId: string,
    classId?: string
  ): Promise<{
    data: Array<{
      student_id: string
      student_name: string
      student_email: string
      class_name?: string
      average_score: number
      time_spent_minutes: number
      total_attempts: number
    }> | null
    error: any
  }> {
    try {
      // Get classes
      const { data: classes } = await classService.getByTeacher(teacherId)
      const filteredClasses = classId ? classes?.filter((c) => c.id === classId) : classes

      // Get all students in classes
      let allStudentIds: string[] = []
      if (filteredClasses && filteredClasses.length > 0) {
        for (const cls of filteredClasses) {
          const { data: enrollments } = await enrollmentService.getByClass(cls.id)
          if (enrollments) {
            allStudentIds.push(...enrollments.map((e) => e.student_id))
          }
        }
      }
      const uniqueStudentIds = [...new Set(allStudentIds)]

      // Get all attempts for these students
      const interventionData: Array<{
        student_id: string
        student_name: string
        student_email: string
        class_name?: string
        average_score: number
        time_spent_minutes: number
        total_attempts: number
      }> = []

      for (const studentId of uniqueStudentIds) {
        const { data: attempts } = await attemptService.getByStudent(studentId)
        if (!attempts || attempts.length === 0) continue

        const completedAttempts = attempts.filter((a) => a.status === 'completed')
        if (completedAttempts.length === 0) continue

        // Calculate average score
        const totalScore = completedAttempts.reduce((sum, a) => sum + a.total_score, 0)
        const average_score = totalScore / completedAttempts.length

        // Calculate total time spent
        let totalTimeMinutes = 0
        for (const attempt of completedAttempts) {
          if (attempt.submitted_at && attempt.started_at) {
            const startTime = new Date(attempt.started_at).getTime()
            const endTime = new Date(attempt.submitted_at).getTime()
            totalTimeMinutes += (endTime - startTime) / (1000 * 60)
          }
        }

        // Get student profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', studentId)
          .single()

        // Find class name
        let className: string | undefined
        if (filteredClasses) {
          for (const cls of filteredClasses) {
            const { data: enrollments } = await enrollmentService.getByClass(cls.id)
            if (enrollments?.some((e) => e.student_id === studentId)) {
              className = cls.name
              break
            }
          }
        }

        interventionData.push({
          student_id: studentId,
          student_name: profile?.full_name || 'Unknown',
          student_email: profile?.email || 'Unknown',
          class_name: className,
          average_score,
          time_spent_minutes: totalTimeMinutes,
          total_attempts: completedAttempts.length,
        })
      }

      return {
        data: interventionData,
        error: null,
      }
    } catch (error: any) {
      return { data: null, error }
    }
  },

  async getStudentGradesHeatMap(
    studentId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<{
    data: {
      student: {
        id: string
        name: string
        email: string
        average_score: number
      }
      exams: Array<{
        id: string
        title: string
        total_marks: number
        average_score: number
      }>
      cells: Array<{
        student_id: string
        exam_id: string
        score: number
        percentage: number
        attempt_id?: string
        submitted_at?: string
        time_spent_minutes?: number
      }>
    } | null
    error: any
  }> {
    try {
      // Get student profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', studentId)
        .single()

      if (!profile) {
        return {
          data: {
            student: {
              id: studentId,
              name: 'Unknown',
              email: '',
              average_score: 0,
            },
            exams: [],
            cells: [],
          },
          error: null,
        }
      }

      // Get all attempts for this student
      const { data: attempts } = await attemptService.getByStudent(studentId)
      if (!attempts || attempts.length === 0) {
        return {
          data: {
            student: {
              id: studentId,
              name: profile.full_name || 'Unknown',
              email: profile.email || '',
              average_score: 0,
            },
            exams: [],
            cells: [],
          },
          error: null,
        }
      }

      // Filter by date range
      let filteredAttempts = attempts
      if (dateRange) {
        filteredAttempts = attempts.filter((a) => {
          const attemptDate = new Date(a.started_at)
          return attemptDate >= dateRange.start && attemptDate <= dateRange.end
        })
      }

      const completedAttempts = filteredAttempts.filter((a) => a.status === 'completed')

      // Get unique exam IDs
      const examIds = [...new Set(completedAttempts.map((a) => a.exam_id))]

      // Get exam details
      const exams: Array<{
        id: string
        title: string
        total_marks: number
        average_score: number
      }> = []

      for (const examId of examIds) {
        const { data: exam } = await examService.getById(examId)
        if (exam) {
          // Calculate average for this exam (from all attempts)
          const examAttempts = completedAttempts.filter((a) => a.exam_id === examId)
          const avgScore =
            examAttempts.length > 0
              ? examAttempts.reduce((sum, a) => sum + a.total_score, 0) / examAttempts.length
              : 0

          exams.push({
            id: exam.id,
            title: exam.title,
            total_marks: exam.total_marks,
            average_score: avgScore,
          })
        }
      }

      // Calculate student average
      const studentAverage =
        completedAttempts.length > 0
          ? completedAttempts.reduce((sum, a) => sum + a.total_score, 0) / completedAttempts.length
          : 0

      // Build cells array
      const cells: Array<{
        student_id: string
        exam_id: string
        score: number
        percentage: number
        attempt_id?: string
        submitted_at?: string
        time_spent_minutes?: number
      }> = []

      for (const attempt of completedAttempts) {
        const exam = exams.find((e) => e.id === attempt.exam_id)
        if (!exam) continue

        const percentage = exam.total_marks > 0 ? (attempt.total_score / exam.total_marks) * 100 : 0

        // Calculate time spent
        let timeSpentMinutes: number | undefined
        if (attempt.submitted_at && attempt.started_at) {
          const startTime = new Date(attempt.started_at).getTime()
          const endTime = new Date(attempt.submitted_at).getTime()
          timeSpentMinutes = (endTime - startTime) / (1000 * 60)
        }

        cells.push({
          student_id: attempt.student_id,
          exam_id: attempt.exam_id,
          score: attempt.total_score,
          percentage,
          attempt_id: attempt.id,
          submitted_at: attempt.submitted_at,
          time_spent_minutes: timeSpentMinutes,
        })
      }

      return {
        data: {
          student: {
            id: studentId,
            name: profile.full_name || 'Unknown',
            email: profile.email || '',
            average_score: studentAverage,
          },
          exams,
          cells,
        },
        error: null,
      }
    } catch (error: any) {
      return { data: null, error }
    }
  },
}

