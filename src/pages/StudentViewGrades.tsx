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
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import {
  calculateStatistics,
  calculateGradeLetter,
  getGradeColor,
  type StudentGrade,
  type GradeStatistics
} from '@/lib/gradesService'
import {
  ArrowLeft,
  Loader2,
  Search,
  BookOpen,
  TrendingUp,
  Award,
  BarChart3,
  Download,
  Calendar,
  ChevronDown,
  ChevronUp
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
  studentGrades: StudentGrade[]
  statistics: GradeStatistics
  earliestSubmission?: string
  latestSubmission?: string
}

export function StudentViewGrades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set())
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [activeTab, setActiveTab] = useState('overview')
  
  // Markbook options
  const [coloredCells, setColoredCells] = useState(true)
  const [attemptedOnly, setAttemptedOnly] = useState(false)
  const [timeFilter, setTimeFilter] = useState<string>('all')
  const [selectedAttempt, setSelectedAttempt] = useState<{ examId: string; attemptId: string } | null>(null)

  // Fetch all attempts for the student
  const { data: allAttempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ['attempts', 'student', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data } = await attemptService.getByStudent(user.id)
      return data || []
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  })

  // Fetch subjects for filtering
  const { data: allSubjects = [] } = useQuery({
    queryKey: ['subjects', 'all'],
    queryFn: async () => {
      const { data } = await subjectService.getAll()
      return data || []
    },
    staleTime: 10 * 60 * 1000,
  })

  // Process and enrich data
  const [resolvedExams, setResolvedExams] = useState<ExamWithGrades[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    const processData = async () => {
      if (!allAttempts.length || !user?.id) {
        setResolvedExams([])
        return
      }

      setIsProcessing(true)
      const processedExams: ExamWithGrades[] = []
      const examIds = [...new Set(allAttempts.map(a => a.exam_id))]

      for (const examId of examIds) {
        // Get exam
        const { data: exam } = await examService.getById(examId)
        if (!exam) continue

        // Get subject name
        let subjectName: string | undefined
        if (exam.subject_id) {
          const subject = allSubjects.find(s => s.id === exam.subject_id)
          subjectName = subject?.name
        }

        // Get attempts for this exam (only completed ones)
        const examAttempts = allAttempts.filter(
          a => a.exam_id === exam.id && a.status === 'completed'
        )

        if (examAttempts.length === 0) continue

        // Enrich attempts with student data
        const allStudentGrades: (StudentGrade & { last_attempt_score?: number; last_attempt_submitted_at?: string })[] = await Promise.all(
          examAttempts.map(async (attempt) => {
            const percentage = exam.total_marks > 0 
              ? (attempt.total_score / exam.total_marks) * 100 
              : 0

            return {
              student_id: attempt.student_id,
              student_name: user.email || 'Unknown',
              student_email: user.email || 'Unknown',
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
        
        // Count attempts
        allStudentGrades.forEach(grade => {
          const count = attemptCountMap.get(grade.student_id) || 0
          attemptCountMap.set(grade.student_id, count + 1)
        })
        
        // Find the last attempt
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
        
        // Find the best attempt
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

        // Calculate statistics (for single student, this is just their own stats)
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
          studentGrades: studentGrades.sort((a, b) => b.percentage - a.percentage),
          statistics,
          earliestSubmission,
          latestSubmission,
        })
      }

      const sorted = processedExams.sort((a, b) => {
        const dateA = b.latestSubmission ? new Date(b.latestSubmission).getTime() : 0
        const dateB = a.latestSubmission ? new Date(a.latestSubmission).getTime() : 0
        return dateA - dateB
      })

      setResolvedExams(sorted)
      setIsProcessing(false)
    }

    processData()
  }, [allAttempts, allSubjects, user])

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

      return true
    })
  }, [resolvedExams, searchQuery, selectedSubject])

  // Calculate overview statistics
  const overviewStats = useMemo(() => {
    const totalExams = filteredExams.length
    const allPercentages = filteredExams.flatMap(e => 
      e.studentGrades.map(g => g.percentage)
    )
    const averagePerformance = allPercentages.length > 0
      ? Math.round((allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length) * 10) / 10
      : 0
    const completedExams = filteredExams.length

    return {
      totalExams,
      averagePerformance,
      completedExams,
    }
  }, [filteredExams])

  // Markbook data processing (simplified for single student)
  const markbookData = useMemo(() => {
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

    // Create exam score map
    const examScores = new Map<string, {
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
      const grade = exam.studentGrades[0] // Only one student (themselves)
      if (grade) {
        const gradeWithExtras = grade as StudentGrade & {
          last_attempt_score?: number
          last_attempt_submitted_at?: string
          last_attempt_id?: string
          attempt_count?: number
        }
        
        examScores.set(exam.id, {
          score: grade.score,
          percentage: grade.percentage,
          attemptId: grade.attempt_id,
          submittedAt: grade.submitted_at,
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

    return {
      exams: markbookExams,
      examScores
    }
  }, [filteredExams, attemptedOnly, timeFilter])

  // Download Markbook as Excel (CSV)
  const downloadMarkbookAsExcel = () => {
    const { exams, examScores } = markbookData
    
    // Create CSV header
    const headers = ['Exam Title', 'Subject', 'Score', 'Percentage', 'Grade', 'Attempts', 'Submitted Date']
    const rows: string[][] = [headers]

    // Create rows for each exam
    exams.forEach(exam => {
      const scoreData = examScores.get(exam.id)
      if (scoreData) {
        rows.push([
          exam.title,
          exam.subject_name || 'N/A',
          `${scoreData.score}/${exam.total_marks}`,
          `${scoreData.percentage.toFixed(1)}%`,
          calculateGradeLetter(scoreData.percentage),
          scoreData.attemptCount?.toString() || '1',
          scoreData.submittedAt ? new Date(scoreData.submittedAt).toLocaleDateString() : 'N/A'
        ])
      }
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
    link.setAttribute('download', `my_grades_${new Date().toISOString().split('T')[0]}.csv`)
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

  const loading = attemptsLoading || isProcessing

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
          <Button variant="outline" onClick={() => navigate('/student/dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">My Grades</h1>
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
          View your grades and performance across all exams
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Card className="border-2 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardDescription className="text-sm font-medium">Exams Completed</CardDescription>
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
                <CardDescription className="text-sm font-medium">Total Attempts</CardDescription>
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
                    : 'Your completed exam attempts will appear here'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredExams.map((exam) => {
                const isExpanded = expandedExams.has(exam.id)
                const stats = exam.statistics
                const grade = exam.studentGrades[0]

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
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm">
                              <span>Total Marks: {exam.total_marks}</span>
                              <span>Your Score: {grade.score} / {exam.total_marks}</span>
                              <span>Percentage: {grade.percentage}%</span>
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
                                Your Performance
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Your Score:</span>
                                <span className="font-semibold">{grade.score} / {exam.total_marks}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Percentage:</span>
                                <span className="font-semibold">{grade.percentage}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Grade:</span>
                                <span className={`px-2 py-1 rounded text-sm font-medium border ${getGradeColor(grade.grade)}`}>
                                  {grade.grade}
                                </span>
                              </div>
                              {(grade as any).attempt_count && (grade as any).attempt_count > 1 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Attempts:</span>
                                  <span className="font-semibold">{(grade as any).attempt_count}</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end">
                          <Button
                            onClick={() => {
                              const attemptId = grade.attempt_id
                              navigate(`/student/exams/${exam.id}/results?attempt=${attemptId}`)
                            }}
                          >
                            View Full Details
                          </Button>
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
                </div>
                <Button onClick={downloadMarkbookAsExcel} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download as Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Markbook Grid - Single row for student */}
          {markbookData.exams.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <p className="text-lg mb-2">No exams found</p>
                <p className="text-sm">
                  {attemptedOnly
                    ? 'No exams have been attempted yet'
                    : 'No exams match your current filters'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 text-sm font-medium">Exam</th>
                        <th className="text-center p-3 text-sm font-medium">Score</th>
                        <th className="text-center p-3 text-sm font-medium">Percentage</th>
                        <th className="text-center p-3 text-sm font-medium">Grade</th>
                        <th className="text-center p-3 text-sm font-medium">Submitted</th>
                        <th className="text-center p-3 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markbookData.exams.map((exam) => {
                        const scoreData = markbookData.examScores.get(exam.id)
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
                          <tr key={exam.id} className="border-b hover:bg-muted/30">
                            <td className="p-3 text-sm font-medium">
                              <div className="flex flex-col">
                                <span className="font-semibold">{exam.title}</span>
                                {exam.subject_name && (
                                  <span className="text-xs text-muted-foreground">{exam.subject_name}</span>
                                )}
                              </div>
                            </td>
                            <td className={`p-3 text-center text-sm ${getCellColor()}`}>
                              {scoreData ? (
                                <span className="font-semibold">
                                  {scoreData.score} / {exam.total_marks}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className={`p-3 text-center text-sm ${getCellColor()}`}>
                              {scoreData ? (
                                <span className="font-semibold">
                                  {scoreData.percentage.toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className={`p-3 text-center ${getCellColor()}`}>
                              {scoreData ? (
                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getGradeColor(calculateGradeLetter(scoreData.percentage))}`}>
                                  {calculateGradeLetter(scoreData.percentage)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="p-3 text-sm text-center text-muted-foreground">
                              {scoreData?.submittedAt
                                ? new Date(scoreData.submittedAt).toLocaleDateString()
                                : 'N/A'}
                            </td>
                            <td className="p-3 text-center">
                              {scoreData && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedAttempt({
                                    examId: exam.id,
                                    attemptId: scoreData.attemptId
                                  })}
                                >
                                  View Details
                                </Button>
                              )}
                            </td>
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
              View detailed breakdown of your attempt
            </DialogDescription>
          </DialogHeader>
          {selectedAttempt && (
            <StudentAttemptDetailsDialog
              examId={selectedAttempt.examId}
              attemptId={selectedAttempt.attemptId}
              onClose={() => setSelectedAttempt(null)}
              navigate={navigate}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Student Attempt Details Component (simplified version)
function StudentAttemptDetailsDialog({
  examId,
  attemptId,
  onClose,
  navigate
}: {
  examId: string
  attemptId: string
  onClose: () => void
  navigate: (path: string) => void
}) {
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [answers, setAnswers] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true)
      try {
        const { data: examData } = await examService.getById(examId)
        setExam(examData || null)

        const { data: attemptData } = await attemptService.getById(attemptId)
        setAttempt(attemptData || null)

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

        const { data: answersData } = await answerService.getByAttempt(attemptId)
        setAnswers(answersData || [])
      } catch (error: any) {
        console.error('Error loading attempt details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (examId && attemptId) {
      loadDetails()
    }
  }, [examId, attemptId])

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

  return (
    <div className="space-y-6">
      {/* Summary */}
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => {
          navigate(`/student/exams/${examId}/results?attempt=${attemptId}`)
          onClose()
        }}>
          View Full Details
        </Button>
      </div>
    </div>
  )
}

