import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GradesHeatMap, type HeatMapCell, type HeatMapStudent, type HeatMapExam } from '@/components/analytics/GradesHeatMap'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { FilterBar } from '@/components/analytics/FilterBar'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { ScoreGauge } from '@/components/analytics/ScoreGauge'
import { InsightsPanel } from '@/components/analytics/InsightsPanel'
import { ExportButton } from '@/components/analytics/ExportButton'
import { useStudentGradesHeatMap } from '@/hooks/useAnalytics'
import { useFilterOptions } from '@/hooks/useFilters'
import { AnalyticsSkeleton } from '@/components/ui/page-skeleton'
import { TrendingUp, BookOpen, BarChart3, Target, AlertCircle, CheckCircle2 } from 'lucide-react'

export function StudentGrades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedExamBoard, setSelectedExamBoard] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)

  // Use React Query hooks for optimized data fetching
  const { subjects, examBoards } = useFilterOptions()
  const { data: heatMapData, isLoading } = useStudentGradesHeatMap(
    user?.id || '',
    dateRange || undefined
  )

  // Memoize filtered data and performance trend
  const { filteredData, performanceTrend } = useMemo(() => {
    if (!heatMapData) {
      return { filteredData: null, performanceTrend: [] }
    }

    // Filter by subject and exam board if selected (simplified - would need exam details in service)
    let filteredExams = heatMapData.exams
    let filteredCells = heatMapData.cells

    // Note: Full filtering would require exam details in the service response
    // For now, we'll use all data if filters are selected
    if (selectedSubject || selectedExamBoard) {
      // Placeholder - would filter based on exam.subject_id and exam.exam_board_id if available
      filteredExams = heatMapData.exams
      filteredCells = heatMapData.cells
    }

    // Build performance trend
    const trend = filteredCells
      .sort((a, b) => {
        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
        return dateA - dateB
      })
      .map((cell) => {
        const exam = filteredExams.find((e) => e.id === cell.exam_id)
        return {
          name: exam?.title || 'Unknown',
          value: cell.percentage,
        }
      })

    return {
      filteredData: {
        student: heatMapData.student,
        exams: filteredExams,
        cells: filteredCells,
      },
      performanceTrend: trend,
    }
  }, [heatMapData, selectedSubject, selectedExamBoard])


  // Quick filter handlers
  const getQuickFilters = () => {
    const now = new Date()
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    return [
      {
        label: 'Last 7 Days',
        value: '7d',
        onClick: () => setDateRange({ start: last7Days, end: now }),
      },
      {
        label: 'Last 30 Days',
        value: '30d',
        onClick: () => setDateRange({ start: last30Days, end: now }),
      },
      {
        label: 'Last 90 Days',
        value: '90d',
        onClick: () => setDateRange({ start: last90Days, end: now }),
      },
      {
        label: 'All Time',
        value: 'all',
        onClick: () => setDateRange(null),
      },
    ]
  }

  // Memoize handlers
  const handleCellClick = useCallback((cell: HeatMapCell, student: HeatMapStudent, exam: HeatMapExam) => {
    if (cell.attempt_id) {
      navigate(`/exam-results/${cell.attempt_id}`)
    }
  }, [navigate])

  const handleExportPDF = useCallback(() => {
    alert('PDF export coming soon')
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!filteredData) return

    const headers = ['Exam', 'Score', 'Percentage', 'Date', 'Time Spent']
    const rows = filteredData.cells.map((cell) => {
      const exam = filteredData.exams.find((e) => e.id === cell.exam_id)
      return [
        exam?.title || 'Unknown',
        `${cell.score.toFixed(1)}/${exam?.total_marks || 0}`,
        `${cell.percentage.toFixed(1)}%`,
        cell.submitted_at ? new Date(cell.submitted_at).toLocaleDateString() : '-',
        cell.time_spent_minutes ? `${Math.round(cell.time_spent_minutes)}m` : '-',
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-grades-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [filteredData])

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  if (!filteredData) {
    return (
      <div className="mx-auto max-w-7xl w-full">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No grades data available. Complete some exams to see your grades here.
          </CardContent>
        </Card>
      </div>
    )
  }

  // Memoize strengths, weaknesses, stats, and insights
  const { strengths, weaknesses, completionRate, averageScore, insights } = useMemo(() => {
    if (!filteredData) {
      return { strengths: [], weaknesses: [], completionRate: 0, averageScore: 0, insights: [] }
    }

    const strengthsList: string[] = []
    const weaknessesList: string[] = []

    filteredData.cells.forEach((cell) => {
      const exam = filteredData.exams.find((e) => e.id === cell.exam_id)
      if (cell.percentage >= 80) {
        if (exam && !strengthsList.includes(exam.title)) {
          strengthsList.push(exam.title)
        }
      } else if (cell.percentage < 60) {
        if (exam && !weaknessesList.includes(exam.title)) {
          weaknessesList.push(exam.title)
        }
      }
    })

    const completion = filteredData.exams.length > 0
      ? (filteredData.cells.length / filteredData.exams.length) * 100
      : 0

    const avgScore = filteredData.student.average_score

    // Generate insights
    const insightsList = []
    if (avgScore >= 80) {
      insightsList.push({
        type: 'success' as const,
        title: 'Excellent Performance',
        description: `You're performing exceptionally well with an average score of ${avgScore.toFixed(1)}%. Keep up the great work!`,
      })
    } else if (avgScore < 60) {
      insightsList.push({
        type: 'warning' as const,
        title: 'Focus Needed',
        description: `Your average score is ${avgScore.toFixed(1)}%. Consider reviewing the areas for improvement below.`,
      })
    }

    if (completion < 50) {
      insightsList.push({
        type: 'recommendation' as const,
        title: 'Complete More Exams',
        description: `You've completed ${filteredData.cells.length} out of ${filteredData.exams.length} exams. Try to complete more to get a better picture of your performance.`,
      })
    }

    if (weaknessesList.length > 0) {
      insightsList.push({
        type: 'recommendation' as const,
        title: 'Review Weak Areas',
        description: `Focus on improving your performance in ${weaknessesList.length} exam${weaknessesList.length > 1 ? 's' : ''}. Practice more in these areas.`,
        action: {
          label: 'View Weak Areas',
          onClick: () => {
            const element = document.getElementById('weaknesses-section')
            element?.scrollIntoView({ behavior: 'smooth' })
          },
        },
      })
    }

    return {
      strengths: strengthsList,
      weaknesses: weaknessesList,
      completionRate: completion,
      averageScore: avgScore,
      insights: insightsList,
    }
  }, [filteredData])

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">My Grades</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Track your performance across all exams
            </p>
          </div>
          <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        quickFilters={getQuickFilters()}
        subjects={subjects}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
        examBoards={examBoards}
        selectedExamBoard={selectedExamBoard}
        onExamBoardChange={setSelectedExamBoard}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showSubject={true}
        showExamBoard={true}
        showDateRange={true}
        onClearAll={() => {
          setSelectedSubject('')
          setSelectedExamBoard('')
          setDateRange(null)
        }}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <AnalyticsCard
          title="Total Exams"
          value={filteredData.exams.length}
          icon={BookOpen}
          description="Exams available"
          variant="default"
        />
        <AnalyticsCard
          title="Average Score"
          value={averageScore.toFixed(1)}
          icon={BarChart3}
          description="Across all exams"
          variant={averageScore >= 80 ? 'success' : averageScore >= 60 ? 'warning' : 'danger'}
          progress={averageScore}
        />
        <AnalyticsCard
          title="Completion Rate"
          value={`${completionRate.toFixed(1)}%`}
          icon={TrendingUp}
          description="Exams completed"
          variant={completionRate >= 80 ? 'success' : completionRate >= 50 ? 'warning' : 'danger'}
          progress={completionRate}
        />
        <AnalyticsCard
          title="Completed"
          value={filteredData.cells.length}
          icon={Target}
          description="Exams finished"
          variant="default"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 sm:mb-8">
        {/* Score Gauge */}
        <div className="lg:col-span-1">
          <ScoreGauge
            score={averageScore}
            title="Overall Performance"
            description="Your average score across all exams"
            target={80}
            size="md"
          />
        </div>

        {/* Performance Trend */}
        <div className="lg:col-span-2">
          {performanceTrend.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend</CardTitle>
                <CardDescription>Your scores over time</CardDescription>
              </CardHeader>
              <CardContent>
                <PerformanceChart
                  data={performanceTrend}
                  type="line"
                  dataKey="value"
                  color="#8884d8"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No performance data available yet
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Heat Map */}
      <div className="mb-6 sm:mb-8">
        <GradesHeatMap
          students={[filteredData.student]}
          exams={filteredData.exams}
          cells={filteredData.cells}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Insights and Recommendations */}
      {insights.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <InsightsPanel insights={insights} />
        </div>
      )}

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Strengths
              </CardTitle>
              <CardDescription>Exams where you excel</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{strength}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {weaknesses.length > 0 && (
          <Card id="weaknesses-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Areas for Improvement
              </CardTitle>
              <CardDescription>Exams that need more focus</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {weaknesses.map((weakness, index) => (
                  <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                    <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{weakness}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

