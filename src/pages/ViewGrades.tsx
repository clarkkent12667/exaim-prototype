import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  attemptService,
  examService,
  questionService,
  answerService,
  type Exam, 
  type ExamAttempt 
} from '@/lib/examService'
import { subjectService } from '@/lib/qualificationService'
import { assignmentService, classService, type Class } from '@/lib/classService'
import { supabase } from '@/lib/supabase'
import { useExamsByTeacher } from '@/hooks/useExams'
import { useQuery } from '@tanstack/react-query'
import {
  calculateStatistics,
  calculateGradeLetter,
  getGradeColor,
  getPercentageColor,
  type StudentGrade,
  type GradeStatistics
} from '@/lib/gradesService'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
  BookOpen,
  Users,
  TrendingUp,
  Award,
  BarChart3,
  GraduationCap,
  Download,
  Calendar
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ExamWithGrades extends Exam {
  subject_name?: string
  classes?: Class[]
  studentGrades: StudentGrade[]
  statistics: GradeStatistics
  earliestSubmission?: string
  latestSubmission?: string
}

export function ViewGrades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set())
  const [selectedClass, setSelectedClass] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')
  
  // Markbook options
  const [coloredCells, setColoredCells] = useState(true)
  const [attemptedOnly, setAttemptedOnly] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>('all')
  const [attemptDisplayMode, setAttemptDisplayMode] = useState<'best' | 'last'>('best')
  const [selectedAttempt, setSelectedAttempt] = useState<{ examId: string; attemptId: string; studentId: string } | null>(null)

  // Fetch classes for the teacher
  const { data: teacherClasses = [] } = useQuery({
    queryKey: ['classes', 'teacher', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await classService.getByTeacher(user.id)
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch exams
  const { data: exams = [], isLoading: examsLoading } = useExamsByTeacher(user?.id || '')

  // Fetch all attempts for all exams
  const { data: allAttempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ['attempts', 'all', exams.map(e => e.id)],
    queryFn: async () => {
      if (exams.length === 0) return []
      const examIds = exams.map(e => e.id)
      const { data } = await attemptService.getByExams(examIds)
      return data || []
    },
    enabled: exams.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch subjects for filtering
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: async () => {
      const { data } = await subjectService.getAll()
      return data || []
    },
    staleTime: 10 * 60 * 1000, // Subjects don't change often
  })

  // Process and enrich data
  const [resolvedExams, setResolvedExams] = useState<ExamWithGrades[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const processData = async () => {
      if (!exams.length || !allAttempts.length) {
        setResolvedExams([])
        return
      }

      setIsProcessing(true)
      const processedExams: ExamWithGrades[] = []

      for (const exam of exams) {
        // Get subject name
        let subjectName: string | undefined
        if (exam.subject_id) {
          const subject = allSubjects.find(s => s.id === exam.subject_id)
          subjectName = subject?.name
        }

        // Get class assignments for this exam
        const { data: assignments } = await assignmentService.getByExam(exam.id)
        const assignedClasses: Class[] = []
        if (assignments && assignments.length > 0) {
          for (const assignment of assignments) {
            // assignment.classes is the joined class data (Supabase returns it as an object, not array)
            if (assignment.classes && typeof assignment.classes === 'object') {
              // Handle both single object and array (in case Supabase returns it differently)
              if (Array.isArray(assignment.classes)) {
                assignedClasses.push(...(assignment.classes as Class[]))
              } else {
                assignedClasses.push(assignment.classes as Class)
              }
            } else if (assignment.class_id) {
              // Fallback: fetch class if not included in join
              const { data: classData } = await classService.getById(assignment.class_id)
              if (classData) {
                assignedClasses.push(classData)
              }
            }
          }
        }
        // Remove duplicates (in case an exam is assigned to the same class multiple times)
        const uniqueClasses = assignedClasses.filter((cls, index, self) =>
          index === self.findIndex(c => c.id === cls.id)
        )

        // Get attempts for this exam (only completed ones)
        const examAttempts = allAttempts.filter(
          a => a.exam_id === exam.id && a.status === 'completed'
        )

        if (examAttempts.length === 0) continue

        // Enrich attempts with student data
        const allStudentGrades: (StudentGrade & { last_attempt_score?: number; last_attempt_submitted_at?: string })[] = await Promise.all(
          examAttempts.map(async (attempt) => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', attempt.student_id)
              .single()

            const percentage = exam.total_marks > 0 
              ? (attempt.total_score / exam.total_marks) * 100 
              : 0

            return {
              student_id: attempt.student_id,
              student_name: profile?.full_name || 'Unknown',
              student_email: profile?.email || 'Unknown',
              score: Math.round(attempt.total_score),
              percentage: Math.round(percentage * 10) / 10,
              grade: calculateGradeLetter(percentage),
              submitted_at: attempt.submitted_at,
              attempt_id: attempt.id,
              last_attempt_score: Math.round(attempt.total_score),
              last_attempt_submitted_at: attempt.submitted_at,
            }
          })
        )

        // Group by student: keep best attempt for grade, but also track last attempt
        const studentGradesMap = new Map<string, StudentGrade & { 
          last_attempt_score?: number
          last_attempt_submitted_at?: string
          last_attempt_id?: string
          attempt_count?: number
        }>()
        const lastAttemptMap = new Map<string, { 
          score: number
          submitted_at?: string
          attempt_id: string
        }>()
        const attemptCountMap = new Map<string, number>()
        
        // Count attempts per student
        allStudentGrades.forEach(grade => {
          const count = attemptCountMap.get(grade.student_id) || 0
          attemptCountMap.set(grade.student_id, count + 1)
        })
        
        // First, find the last attempt for each student (most recent submission date)
        for (const grade of allStudentGrades) {
          if (!grade.submitted_at) continue
          
          const existing = lastAttemptMap.get(grade.student_id)
          if (!existing) {
            lastAttemptMap.set(grade.student_id, {
              score: grade.score,
              submitted_at: grade.submitted_at,
              attempt_id: grade.attempt_id
            })
          } else {
            const existingDate = new Date(existing.submitted_at || 0).getTime()
            const currentDate = new Date(grade.submitted_at).getTime()
            if (currentDate > existingDate) {
              lastAttemptMap.set(grade.student_id, {
                score: grade.score,
                submitted_at: grade.submitted_at,
                attempt_id: grade.attempt_id
              })
            }
          }
        }
        
        // Then, find the best attempt for each student (for grade display)
        for (const grade of allStudentGrades) {
          const existing = studentGradesMap.get(grade.student_id)
          if (!existing || grade.percentage > existing.percentage) {
            const lastAttempt = lastAttemptMap.get(grade.student_id)
            const attemptCount = attemptCountMap.get(grade.student_id) || 1
            studentGradesMap.set(grade.student_id, {
              ...grade,
              last_attempt_score: lastAttempt?.score,
              last_attempt_submitted_at: lastAttempt?.submitted_at,
              last_attempt_id: lastAttempt?.attempt_id,
              attempt_count: attemptCount
            })
          }
        }
        
        // Ensure all entries have last attempt info
        for (const [studentId, grade] of studentGradesMap.entries()) {
          if (!grade.last_attempt_id) {
            const lastAttempt = lastAttemptMap.get(studentId)
            if (lastAttempt) {
              grade.last_attempt_score = lastAttempt.score
              grade.last_attempt_submitted_at = lastAttempt.submitted_at
              grade.last_attempt_id = lastAttempt.attempt_id
            }
          }
          if (!grade.attempt_count) {
            grade.attempt_count = attemptCountMap.get(studentId) || 1
          }
        }
        
        const studentGrades = Array.from(studentGradesMap.values())

        // Calculate statistics
        const scores = studentGrades.map(g => g.score)
        const statistics = calculateStatistics(scores, exam.total_marks)

        // Get date range
        const submissionDates = studentGrades
          .map(g => g.submitted_at)
          .filter(Boolean) as string[]
        
        const earliestSubmission = submissionDates.length > 0
          ? new Date(Math.min(...submissionDates.map(d => new Date(d).getTime()))).toISOString()
          : undefined
        const latestSubmission = submissionDates.length > 0
          ? new Date(Math.max(...submissionDates.map(d => new Date(d).getTime()))).toISOString()
          : undefined

        processedExams.push({
          ...exam,
          subject_name: subjectName,
          classes: uniqueClasses,
          studentGrades: studentGrades.sort((a, b) => b.percentage - a.percentage), // Sort by percentage descending
          statistics,
          earliestSubmission,
          latestSubmission,
        })
      }

      const sorted = processedExams.sort((a, b) => {
        // Sort by latest submission date, most recent first
        const dateA = b.latestSubmission ? new Date(b.latestSubmission).getTime() : 0
        const dateB = a.latestSubmission ? new Date(a.latestSubmission).getTime() : 0
        return dateA - dateB
      })

      setResolvedExams(sorted)
      setIsProcessing(false)
    }

    processData()
  }, [exams, allAttempts, allSubjects])

  // Filter exams
  const filteredExams = useMemo(() => {
    return resolvedExams.filter(exam => {
      // Search filter
      if (searchQuery && !exam.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }

      // Subject filter
      if (selectedSubject !== 'all' && exam.subject_id !== selectedSubject) {
        return false
      }

      // Class filter
      if (selectedClass !== 'all') {
        const examClassIds = exam.classes?.map(c => c.id) || []
        if (!examClassIds.includes(selectedClass)) {
          return false
        }
      }

      return true
    })
  }, [resolvedExams, searchQuery, selectedSubject, selectedClass])

  // Calculate overview statistics
  const overviewStats = useMemo(() => {
    const totalExams = filteredExams.length
    const totalStudents = new Set(
      filteredExams.flatMap(e => e.studentGrades.map(g => g.student_id))
    ).size
    const allPercentages = filteredExams.flatMap(e => 
      e.studentGrades.map(g => g.percentage)
    )
    const averagePerformance = allPercentages.length > 0
      ? Math.round((allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length) * 10) / 10
      : 0
    const completedExams = filteredExams.length

    return {
      totalExams,
      totalStudents,
      averagePerformance,
      completedExams,
    }
  }, [filteredExams])

  // Markbook data processing
  const markbookData = useMemo(() => {
    // Get all unique students
    const allStudentIds = new Set<string>()
    filteredExams.forEach(exam => {
      exam.studentGrades.forEach(grade => {
        allStudentIds.add(grade.student_id)
      })
    })

    // Filter exams based on attemptedOnly
    let markbookExams = filteredExams
    if (attemptedOnly) {
      markbookExams = filteredExams.filter(exam => exam.studentGrades.length > 0)
    }

    // Filter by time period
    if (timeFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      switch (timeFilter) {
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          break
        case 'term':
          filterDate.setMonth(now.getMonth() - 3)
          break
      }
      markbookExams = markbookExams.filter(exam => {
        if (!exam.latestSubmission) return false
        return new Date(exam.latestSubmission) >= filterDate
      })
    }

    // Create student-exam score map
    const studentExamScores = new Map<string, Map<string, {
      score: number
      percentage: number
      attemptId: string
      submittedAt?: string
      attemptCount?: number
      bestScore?: number
      bestPercentage?: number
      bestAttemptId?: string
      lastScore?: number
      lastPercentage?: number
      lastAttemptId?: string
      lastSubmittedAt?: string
    }>>()

    Array.from(allStudentIds).forEach(studentId => {
      const examMap = new Map<string, {
        score: number
        percentage: number
        attemptId: string
        submittedAt?: string
        attemptCount?: number
        bestScore?: number
        bestPercentage?: number
        bestAttemptId?: string
        lastScore?: number
        lastPercentage?: number
        lastAttemptId?: string
        lastSubmittedAt?: string
      }>()
      
      markbookExams.forEach(exam => {
        const grade = exam.studentGrades.find(g => g.student_id === studentId)
        if (grade) {
          const gradeWithExtras = grade as StudentGrade & {
            last_attempt_score?: number
            last_attempt_submitted_at?: string
            last_attempt_id?: string
            attempt_count?: number
          }
          
          // Determine which attempt to show based on mode
          const isBestMode = attemptDisplayMode === 'best'
          const displayScore = isBestMode ? grade.score : (gradeWithExtras.last_attempt_score || grade.score)
          const displayPercentage = isBestMode 
            ? grade.percentage 
            : (gradeWithExtras.last_attempt_score !== undefined && exam.total_marks > 0
                ? Math.round(((gradeWithExtras.last_attempt_score / exam.total_marks) * 100) * 10) / 10
                : grade.percentage)
          const displayAttemptId = isBestMode 
            ? grade.attempt_id 
            : (gradeWithExtras.last_attempt_id || grade.attempt_id)
          const displaySubmittedAt = isBestMode
            ? grade.submitted_at
            : (gradeWithExtras.last_attempt_submitted_at || grade.submitted_at)
          
          examMap.set(exam.id, {
            score: displayScore,
            percentage: displayPercentage,
            attemptId: displayAttemptId,
            submittedAt: displaySubmittedAt,
            attemptCount: gradeWithExtras.attempt_count || 1,
            bestScore: grade.score,
            bestPercentage: grade.percentage,
            bestAttemptId: grade.attempt_id,
            lastScore: gradeWithExtras.last_attempt_score,
            lastPercentage: gradeWithExtras.last_attempt_score !== undefined && exam.total_marks > 0
              ? Math.round(((gradeWithExtras.last_attempt_score / exam.total_marks) * 100) * 10) / 10
              : grade.percentage,
            lastAttemptId: gradeWithExtras.last_attempt_id || grade.attempt_id,
            lastSubmittedAt: gradeWithExtras.last_attempt_submitted_at || grade.submitted_at
          })
        }
      })
      
      studentExamScores.set(studentId, examMap)
    })

    // Get student names
    const studentNames = new Map<string, { name: string; email: string }>()
    filteredExams.forEach(exam => {
      exam.studentGrades.forEach(grade => {
        if (!studentNames.has(grade.student_id)) {
          studentNames.set(grade.student_id, {
            name: grade.student_name,
            email: grade.student_email
          })
        }
      })
    })

    return {
      students: Array.from(allStudentIds),
      exams: markbookExams,
      studentExamScores,
      studentNames
    }
  }, [filteredExams, attemptedOnly, timeFilter, attemptDisplayMode])

  // Download Markbook as Excel (CSV)
  const downloadMarkbookAsExcel = () => {
    const { students, exams, studentExamScores, studentNames } = markbookData
    
    // Create CSV header
    const modeLabel = attemptDisplayMode === 'best' ? 'Best Attempt' : 'Last Attempt'
    const headers = ['Student Name', 'Student Email', ...exams.map(e => `${e.title} (${modeLabel})`), ...exams.map(e => `${e.title} (Attempts)`)]
    const rows: string[][] = [headers]

    // Create rows for each student
    students.forEach(studentId => {
      const studentInfo = studentNames.get(studentId)
      const row = [
        studentInfo?.name || 'Unknown',
        studentInfo?.email || 'Unknown'
      ]
      
      // Add scores
      exams.forEach(exam => {
        const scoreData = studentExamScores.get(studentId)?.get(exam.id)
        if (scoreData) {
          row.push(`${scoreData.score}/${exam.total_marks} (${scoreData.percentage.toFixed(1)}%)`)
        } else {
          row.push('-')
        }
      })
      
      // Add attempt counts
      exams.forEach(exam => {
        const scoreData = studentExamScores.get(studentId)?.get(exam.id)
        if (scoreData && scoreData.attemptCount) {
          row.push(scoreData.attemptCount.toString())
        } else {
          row.push('-')
        }
      })
      
      rows.push(row)
    })

    // Convert to CSV
    const csv = rows.map(row => 
      row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')
    ).join('\n')

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `markbook_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const toggleExam = (examId: string) => {
    setExpandedExams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(examId)) {
        newSet.delete(examId)
      } else {
        newSet.add(examId)
      }
      return newSet
    })
  }

  const loading = examsLoading || attemptsLoading || isProcessing

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl w-full">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <Button variant="outline" onClick={() => navigate('/teacher/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">View Grades</h1>
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
          View and analyze student grades across all your exams
        </p>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="all">All Subjects</option>
                {allSubjects.map(subject => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background text-sm"
              >
                <option value="all">All Classes</option>
                {teacherClasses.map(cls => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="markbook">Markbook</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">

      {/* Overview Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Exams with Grades</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {overviewStats.totalExams}
              <BookOpen className="h-6 w-6 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Exams with completed attempts</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Total Students Graded</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {overviewStats.totalStudents}
              <Users className="h-6 w-6 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Unique students across all exams</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Average Performance</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {overviewStats.averagePerformance}%
              <TrendingUp className="h-6 w-6 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Average score across all exams</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Exams Completed</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {overviewStats.completedExams}
              <Award className="h-6 w-6 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Total completed exam attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Exams List */}
      {filteredExams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No grades found</p>
            <p className="text-sm">
              {searchQuery || selectedSubject !== 'all'
                ? 'Try adjusting your filters'
                : 'Students\' completed exam attempts will appear here'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredExams.map((exam) => {
            const isExpanded = expandedExams.has(exam.id)
            const stats = exam.statistics

            return (
              <Card key={exam.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{exam.title}</CardTitle>
                      <CardDescription className="space-y-1">
                        {exam.subject_name && (
                          <div>Subject: {exam.subject_name}</div>
                        )}
                        {exam.classes && exam.classes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 text-xs font-medium">
                              <GraduationCap className="h-3 w-3" />
                              <span>Classes:</span>
                            </div>
                            {exam.classes.map((cls) => (
                              <span
                                key={cls.id}
                                className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200 font-medium"
                                title={cls.description || cls.name}
                              >
                                {cls.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {(!exam.classes || exam.classes.length === 0) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground italic">
                            <GraduationCap className="h-3 w-3" />
                            <span>Not assigned to any class</span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                          <span>Total Marks: {exam.total_marks}</span>
                          <span>Students: {stats.totalStudents}</span>
                          <span>Average: {stats.average}%</span>
                        </div>
                        {exam.earliestSubmission && exam.latestSubmission && (
                          <div className="text-xs">
                            Date Range: {new Date(exam.earliestSubmission).toLocaleDateString()} - {new Date(exam.latestSubmission).toLocaleDateString()}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExam(exam.id)}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-6">
                    {/* Statistics Panel */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Performance Statistics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Average:</span>
                            <span className="font-semibold">{stats.average}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Median:</span>
                            <span className="font-semibold">{stats.median}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Highest:</span>
                            <span className="font-semibold text-green-600">{stats.highest}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Lowest:</span>
                            <span className="font-semibold text-red-600">{stats.lowest}%</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Grade Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => (
                            <div key={grade} className="flex items-center justify-between">
                              <span className={`px-2 py-1 rounded text-sm font-medium border ${getGradeColor(grade)}`}>
                                Grade {grade}
                              </span>
                              <span className="font-semibold">{stats.gradeDistribution[grade]}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Student Grades Table */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Student Grades</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 text-sm font-medium">Student</th>
                              <th className="text-left p-2 text-sm font-medium">Email</th>
                              <th className="text-center p-2 text-sm font-medium">Score</th>
                              <th className="text-center p-2 text-sm font-medium">Avg %</th>
                              <th className="text-center p-2 text-sm font-medium">Last Attempt</th>
                              <th className="text-center p-2 text-sm font-medium">Grade</th>
                              <th className="text-center p-2 text-sm font-medium">Submitted</th>
                              <th className="text-center p-2 text-sm font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {exam.studentGrades.map((grade) => (
                              <tr key={grade.attempt_id} className="border-b hover:bg-muted/50">
                                <td className="p-2 text-sm">{grade.student_name}</td>
                                <td className="p-2 text-sm text-muted-foreground">{grade.student_email}</td>
                                <td className="p-2 text-sm text-center">
                                  {grade.score} / {exam.total_marks}
                                </td>
                                <td className="p-2 text-center">
                                  <span className="text-sm font-medium">
                                    {stats.average.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <span className="text-sm font-medium">
                                    {(grade as any).last_attempt_score !== undefined 
                                      ? `${(grade as any).last_attempt_score} / ${exam.total_marks}`
                                      : 'N/A'}
                                  </span>
                                </td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getGradeColor(grade.grade)}`}>
                                    {grade.grade}
                                  </span>
                                </td>
                                <td className="p-2 text-sm text-center text-muted-foreground">
                                  {grade.submitted_at
                                    ? new Date(grade.submitted_at).toLocaleDateString()
                                    : 'N/A'}
                                </td>
                                <td className="p-2 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/teacher/exams/${exam.id}/attempts?attempt=${grade.attempt_id}&single=true`)}
                                  >
                                    View
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="markbook" className="space-y-6">
          {/* Markbook Options */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={coloredCells}
                      onChange={(e) => setColoredCells(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Colored cells</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attemptedOnly}
                      onChange={(e) => setAttemptedOnly(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span>Attempted exams only</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <select
                      value={timeFilter}
                      onChange={(e) => setTimeFilter(e.target.value)}
                      className="px-3 py-2 border rounded-md bg-background text-sm"
                    >
                      <option value="all">All Time</option>
                      <option value="week">Last Week</option>
                      <option value="month">Last Month</option>
                      <option value="term">Last Term (3 months)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={attemptDisplayMode}
                      onChange={(e) => setAttemptDisplayMode(e.target.value as 'best' | 'last')}
                      className="px-3 py-2 border rounded-md bg-background text-sm"
                      title="Choose which attempt to display: Best (highest score) or Last (most recent)"
                    >
                      <option value="best">Best Attempt</option>
                      <option value="last">Last Attempt</option>
                    </select>
                  </div>
                </div>
                <Button onClick={downloadMarkbookAsExcel} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download as Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Markbook Grid */}
          {markbookData.exams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-lg mb-2">No exams found</p>
                <p className="text-sm">
                  {attemptedOnly
                    ? 'No exams have been attempted by students yet'
                    : 'No exams match your current filters'}
                </p>
              </CardContent>
            </Card>
          ) : markbookData.students.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-lg mb-2">No students found</p>
                <p className="text-sm">No students have completed any exams yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 text-sm font-medium sticky left-0 bg-muted/50 z-10 border-r">
                          Student
                        </th>
                        {markbookData.exams.map((exam) => (
                          <th
                            key={exam.id}
                            className="text-center p-3 text-sm font-medium min-w-[120px]"
                            title={exam.title}
                          >
                            <div className="flex flex-col">
                              <span className="font-semibold truncate max-w-[150px] mx-auto">
                                {exam.title}
                              </span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {exam.total_marks} marks
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {markbookData.students.map((studentId) => {
                        const studentInfo = markbookData.studentNames.get(studentId)
                        return (
                          <tr key={studentId} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium sticky left-0 bg-background z-10 border-r">
                              <div className="flex flex-col">
                                <span className="font-semibold">{studentInfo?.name || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground">{studentInfo?.email || ''}</span>
                              </div>
                            </td>
                            {markbookData.exams.map((exam) => {
                              const scoreData = markbookData.studentExamScores
                                .get(studentId)
                                ?.get(exam.id)
                              
                              const percentage = scoreData?.percentage || 0
                              const getCellColor = () => {
                                if (!coloredCells || !scoreData) return ''
                                if (percentage >= 90) return 'bg-green-100 hover:bg-green-200'
                                if (percentage >= 80) return 'bg-blue-100 hover:bg-blue-200'
                                if (percentage >= 70) return 'bg-yellow-100 hover:bg-yellow-200'
                                if (percentage >= 60) return 'bg-orange-100 hover:bg-orange-200'
                                return 'bg-red-100 hover:bg-red-200'
                              }

                              return (
                                <td
                                  key={exam.id}
                                  className={`p-3 text-center text-sm cursor-pointer transition-colors ${getCellColor()}`}
                                  onClick={() => {
                                    if (scoreData) {
                                      setSelectedAttempt({
                                        examId: exam.id,
                                        attemptId: scoreData.attemptId,
                                        studentId: studentId
                                      })
                                    }
                                  }}
                                  title={scoreData ? `Click to view details` : 'No attempt'}
                                >
                                  {scoreData ? (
                                    <div className="flex flex-col">
                                      <span className="font-semibold">
                                        {scoreData.score} / {exam.total_marks}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {scoreData.percentage.toFixed(1)}%
                                      </span>
                                      {scoreData.attemptCount && scoreData.attemptCount > 1 && (
                                        <div className="mt-1">
                                          {attemptDisplayMode === 'best' && scoreData.lastScore !== undefined && scoreData.lastScore !== scoreData.bestScore && (
                                            <div 
                                              className={`text-xs px-1.5 py-0.5 rounded border text-center ${
                                                scoreData.lastScore > scoreData.bestScore 
                                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                                  : 'bg-orange-50 text-orange-700 border-orange-200'
                                              }`}
                                              title={`${scoreData.attemptCount} attempts. Last attempt: ${scoreData.lastScore}/${exam.total_marks} (${scoreData.lastPercentage?.toFixed(1)}%)`}
                                            >
                                              {scoreData.lastScore > scoreData.bestScore ? '↑' : '↓'} Last: {scoreData.lastScore}/{exam.total_marks}
                                            </div>
                                          )}
                                          {attemptDisplayMode === 'last' && scoreData.bestScore !== undefined && scoreData.lastScore !== scoreData.bestScore && (
                                            <div 
                                              className={`text-xs px-1.5 py-0.5 rounded border text-center ${
                                                scoreData.lastScore! > scoreData.bestScore 
                                                  ? 'bg-green-50 text-green-700 border-green-200' 
                                                  : 'bg-orange-50 text-orange-700 border-orange-200'
                                              }`}
                                              title={`${scoreData.attemptCount} attempts. Best attempt: ${scoreData.bestScore}/${exam.total_marks} (${scoreData.bestPercentage?.toFixed(1)}%)`}
                                            >
                                              {scoreData.lastScore! > scoreData.bestScore ? '↑' : '↓'} Best: {scoreData.bestScore}/{exam.total_marks}
                                            </div>
                                          )}
                                          {scoreData.lastScore === scoreData.bestScore && scoreData.attemptCount > 1 && (
                                            <div 
                                              className="text-xs px-1.5 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200 text-center"
                                              title={`${scoreData.attemptCount} attempts (all same score)`}
                                            >
                                              {scoreData.attemptCount} attempts
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Attempt Details Dialog */}
      <Dialog open={!!selectedAttempt} onOpenChange={() => setSelectedAttempt(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attempt Details</DialogTitle>
            <DialogDescription>
              View detailed breakdown of student's attempt
            </DialogDescription>
          </DialogHeader>
          {selectedAttempt && (
            <AttemptDetailsDialog
              examId={selectedAttempt.examId}
              attemptId={selectedAttempt.attemptId}
              studentId={selectedAttempt.studentId}
              onClose={() => setSelectedAttempt(null)}
              navigate={navigate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Attempt Details Component
function AttemptDetailsDialog({
  examId,
  attemptId,
  studentId,
  onClose,
  navigate
}: {
  examId: string
  attemptId: string
  studentId: string
  onClose: () => void
  navigate: (path: string) => void
}) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [allAttempts, setAllAttempts] = useState<ExamAttempt[]>([])
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(attemptId)
  const [exam, setExam] = useState<Exam | null>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true)
      try {
        // Load exam
        const { data: examData } = await examService.getById(examId)
        setExam(examData || null)

        // Load ALL attempts for this student-exam combination
        const { data: allExamAttempts } = await attemptService.getByExam(examId)
        const studentAttempts = (allExamAttempts || [])
          .filter(a => a.student_id === studentId && a.status === 'completed')
          .sort((a, b) => {
            const dateA = new Date(a.submitted_at || a.started_at || a.created_at || 0).getTime()
            const dateB = new Date(b.submitted_at || b.started_at || b.created_at || 0).getTime()
            return dateB - dateA // Most recent first
          })
        
        setAllAttempts(studentAttempts)
        
        // Set initial attempt (use the one passed in, or the most recent)
        const initialAttempt = studentAttempts.find(a => a.id === attemptId) || studentAttempts[0]
        if (initialAttempt) {
          setSelectedAttemptId(initialAttempt.id)
          setAttempt(initialAttempt)
        }

        // Load questions
        const { data: questionsData } = await questionService.getByExam(examId)
        if (questionsData) {
          const questionsWithOptions = await Promise.all(
            questionsData.map(async (q: any) => {
              if (q.question_type === 'mcq') {
                const { data: options } = await questionService.getOptions(q.id)
                return { ...q, options }
              }
              return q
            })
          )
          setQuestions(questionsWithOptions)
        }
      } catch (error: any) {
        console.error('Error loading attempt details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (examId && attemptId && studentId) {
      loadDetails()
    }
  }, [examId, attemptId, studentId])

  // Load answers when selected attempt changes
  useEffect(() => {
    const loadAnswers = async () => {
      if (!selectedAttemptId) return
      
      const selectedAttempt = allAttempts.find(a => a.id === selectedAttemptId)
      if (selectedAttempt) {
        setAttempt(selectedAttempt)
        const { data: answersData } = await answerService.getByAttempt(selectedAttemptId)
        setAnswers(answersData || [])
      }
    }

    if (selectedAttemptId && allAttempts.length > 0) {
      loadAnswers()
    }
  }, [selectedAttemptId, allAttempts])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!attempt || !exam) {
    return <div className="py-4 text-center text-muted-foreground">Failed to load attempt details</div>
  }

  const totalTimeSpent = answers.reduce((sum, ans) => sum + (ans.time_spent_seconds || 0), 0)
  const correctCount = answers.filter(a => a.is_correct).length
  const incorrectCount = answers.filter(a => a.is_correct === false).length
  const skippedCount = answers.filter(a => !a.answer_text || a.answer_text.trim() === '').length

  // Calculate best score
  const bestAttempt = allAttempts.length > 0 
    ? allAttempts.reduce((best, current) => 
        current.total_score > best.total_score ? current : best
      )
    : null

  return (
    <div className="space-y-6">
      {/* Attempt Selector */}
      {allAttempts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Attempts ({allAttempts.length})</CardTitle>
            <CardDescription>
              Select an attempt to view its details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allAttempts.map((att, index) => {
                const percentage = exam.total_marks > 0 
                  ? Math.round((att.total_score / exam.total_marks) * 100) 
                  : 0
                const isSelected = att.id === selectedAttemptId
                const isBest = bestAttempt && att.id === bestAttempt.id
                const submittedDate = att.submitted_at 
                  ? new Date(att.submitted_at).toLocaleDateString() 
                  : 'Not submitted'
                
                return (
                  <button
                    key={att.id}
                    onClick={() => setSelectedAttemptId(att.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Attempt {allAttempts.length - index}</span>
                        {isBest && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 border border-green-200">
                            Best
                          </span>
                        )}
                        {index === 0 && (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 border border-blue-200">
                            Latest
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-bold">
                        {Math.round(att.total_score)} / {exam.total_marks}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {percentage}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {submittedDate}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {allAttempts.length > 1 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Viewing:</span>
          <span className="font-semibold text-foreground">
            Attempt {allAttempts.length - allAttempts.findIndex(a => a.id === selectedAttemptId)} of {allAttempts.length}
          </span>
          {bestAttempt && attempt.id === bestAttempt.id && (
            <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 border border-green-200">
              Best Score
            </span>
          )}
          {allAttempts.findIndex(a => a.id === selectedAttemptId) === 0 && (
            <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 border border-blue-200">
              Most Recent
            </span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Score</div>
            <div className="text-2xl font-bold">
              {Math.round(attempt.total_score)} / {exam.total_marks}
            </div>
            <div className="text-sm text-muted-foreground">
              {Math.round((attempt.total_score / exam.total_marks) * 100)}%
            </div>
            {allAttempts.length > 1 && bestAttempt && attempt.id !== bestAttempt.id && (
              <div className="text-xs text-muted-foreground mt-1">
                Best: {Math.round(bestAttempt.total_score)}/{exam.total_marks}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Time Spent</div>
            <div className="text-2xl font-bold">
              {Math.floor(totalTimeSpent / 60)}m {totalTimeSpent % 60}s
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Correct</div>
            <div className="text-2xl font-bold text-green-600">{correctCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Incorrect</div>
            <div className="text-2xl font-bold text-red-600">{incorrectCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Questions Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Question Breakdown</h3>
        <div className="space-y-3">
          {questions.map((question, index) => {
            const answer = answers.find(a => a.question_id === question.id)
            const timeSpent = answer?.time_spent_seconds || 0
            
            return (
              <Card key={question.id} className={answer?.is_correct ? 'border-green-200' : answer?.is_correct === false ? 'border-red-200' : 'border-gray-200'}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">Q{index + 1}</span>
                        <span className="text-sm text-muted-foreground">
                          ({question.marks} marks)
                        </span>
                        {answer?.is_correct && (
                          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                            Correct
                          </span>
                        )}
                        {answer?.is_correct === false && (
                          <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                            Incorrect
                          </span>
                        )}
                        {(!answer?.answer_text || answer.answer_text.trim() === '') && (
                          <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-800">
                            Skipped
                          </span>
                        )}
                      </div>
                      <p className="text-sm mb-2">{question.question_text}</p>
                      {answer && (
                        <div className="space-y-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Answer: </span>
                            <span className="font-medium">{answer.answer_text || '(No answer)'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Score: </span>
                            <span className="font-medium">{answer.score} / {question.marks}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Time spent: </span>
                            <span className="font-medium">{Math.floor(timeSpent / 60)}m {timeSpent % 60}s</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => {
          navigate(`/teacher/exams/${examId}/attempts?attempt=${attemptId}&single=true`)
          onClose()
        }}>
          View Full Details
        </Button>
      </div>
    </div>
  )
}

