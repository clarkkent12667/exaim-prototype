import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GradesHeatMap, type HeatMapCell, type HeatMapStudent, type HeatMapExam } from '@/components/analytics/GradesHeatMap'
import { InterventionHeatMap, type InterventionDataPoint } from '@/components/analytics/InterventionHeatMap'
import { FilterBar } from '@/components/analytics/FilterBar'
import { ExportButton } from '@/components/analytics/ExportButton'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { useGradesHeatMap, useInterventionData } from '@/hooks/useAnalytics'
import { useFilterOptions } from '@/hooks/useFilters'
import { AnalyticsSkeleton } from '@/components/ui/page-skeleton'
import { Grid3x3, TrendingUp, Users, BookOpen, BarChart3 } from 'lucide-react'

type ViewMode = 'markbook' | 'intervention'

export function TeacherGrades() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<ViewMode>('markbook')
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedExamBoard, setSelectedExamBoard] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)

  // Use React Query hooks for optimized data fetching
  const { classes, subjects, examBoards } = useFilterOptions(user?.id)
  
  // Fetch data based on view mode
  const { data: heatMapData, isLoading: heatMapLoading } = useGradesHeatMap(
    user?.id || '',
    selectedClass || undefined,
    dateRange || undefined,
    selectedSubject || undefined,
    selectedExamBoard || undefined
  )

  const { data: interventionData = [], isLoading: interventionLoading } = useInterventionData(
    user?.id || '',
    selectedClass || undefined
  )

  // Memoize summary stats calculation
  const summaryStats = useMemo(() => {
    if (viewMode === 'markbook' && heatMapData) {
      const totalStudents = heatMapData.students.length
      const totalExams = heatMapData.exams.length
      const classAverage =
        totalStudents > 0
          ? heatMapData.students.reduce((sum, s) => sum + s.average_score, 0) / totalStudents
          : 0
      const totalPossibleCells = totalStudents * totalExams
      const completedCells = heatMapData.cells.length
      const completionRate = totalPossibleCells > 0 ? (completedCells / totalPossibleCells) * 100 : 0

      return {
        totalStudents,
        totalExams,
        classAverage,
        completionRate,
      }
    } else if (viewMode === 'intervention' && interventionData.length > 0) {
      const totalStudents = interventionData.length
      const avgScore = interventionData.reduce((sum, d) => sum + d.average_score, 0) / totalStudents
      const avgTime = interventionData.reduce((sum, d) => sum + d.time_spent_minutes, 0) / totalStudents

      return {
        totalStudents,
        totalExams: 0,
        classAverage: avgScore,
        completionRate: avgTime,
      }
    }
    return {
      totalStudents: 0,
      totalExams: 0,
      classAverage: 0,
      completionRate: 0,
    }
  }, [viewMode, heatMapData, interventionData])

  const loading = viewMode === 'markbook' ? heatMapLoading : interventionLoading

  const handleExportPDF = useCallback(() => {
    // TODO: Implement PDF export
    alert('PDF export coming soon')
  }, [])

  const handleExportCSV = useCallback(() => {
    if (!heatMapData) return

    // Create CSV content
    const headers = ['Student', 'Email', ...heatMapData.exams.map((e) => e.title), 'Average']
    const rows = heatMapData.students.map((student) => {
      const studentCells = heatMapData.exams.map((exam) => {
        const cell = heatMapData.cells.find(
          (c) => c.student_id === student.id && c.exam_id === exam.id
        )
        return cell ? `${cell.percentage.toFixed(1)}%` : '-'
      })
      return [
        student.name,
        student.email,
        ...studentCells,
        student.average_score.toFixed(1),
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n')

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `grades-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [heatMapData])

  // Memoize handlers
  const handleCellClick = useCallback((cell: HeatMapCell, student: HeatMapStudent, exam: HeatMapExam) => {
    if (cell.attempt_id) {
      navigate(`/teacher/exams/${exam.id}/attempts/${cell.attempt_id}`)
    }
  }, [navigate])

  const handleInterventionPointClick = useCallback((point: InterventionDataPoint) => {
    navigate(`/teacher/students/${point.student_id}/attempts`)
  }, [navigate])

  if (loading) {
    return <AnalyticsSkeleton />
  }

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

  return (
    <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Grades & Markbook</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Visualize student performance across all exams
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={viewMode === 'markbook' ? 'default' : 'outline'}
              onClick={() => setViewMode('markbook')}
              size="sm"
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              Markbook
            </Button>
            <Button
              variant={viewMode === 'intervention' ? 'default' : 'outline'}
              onClick={() => setViewMode('intervention')}
              size="sm"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Intervention
            </Button>
            {viewMode === 'markbook' && (
              <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        quickFilters={viewMode === 'markbook' ? getQuickFilters() : []}
        classes={classes}
        selectedClass={selectedClass}
        onClassChange={setSelectedClass}
        subjects={subjects}
        selectedSubject={selectedSubject}
        onSubjectChange={setSelectedSubject}
        examBoards={examBoards}
        selectedExamBoard={selectedExamBoard}
        onExamBoardChange={setSelectedExamBoard}
        dateRange={viewMode === 'markbook' ? dateRange : null}
        onDateRangeChange={viewMode === 'markbook' ? setDateRange : undefined}
        showClass={true}
        showSubject={true}
        showExamBoard={true}
        showDateRange={viewMode === 'markbook'}
        onClearAll={() => {
          setSelectedClass('')
          setSelectedSubject('')
          setSelectedExamBoard('')
          setDateRange(null)
        }}
      />

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <AnalyticsCard
          title="Total Students"
          value={summaryStats.totalStudents}
          icon={Users}
          description="Students in view"
          variant="default"
        />
        {viewMode === 'markbook' && (
          <AnalyticsCard
            title="Total Exams"
            value={summaryStats.totalExams}
            icon={BookOpen}
            description="Exams in view"
            variant="default"
          />
        )}
        <AnalyticsCard
          title="Class Average"
          value={summaryStats.classAverage.toFixed(1)}
          icon={BarChart3}
          description="Average score"
          variant={summaryStats.classAverage >= 80 ? 'success' : summaryStats.classAverage >= 60 ? 'warning' : 'danger'}
          progress={summaryStats.classAverage}
        />
        <AnalyticsCard
          title={viewMode === 'markbook' ? 'Completion Rate' : 'Avg Time Spent'}
          value={
            viewMode === 'markbook'
              ? `${summaryStats.completionRate.toFixed(1)}%`
              : `${Math.round(summaryStats.completionRate)}m`
          }
          icon={TrendingUp}
          description={viewMode === 'markbook' ? 'Completed attempts' : 'Average time'}
          variant={viewMode === 'markbook' && summaryStats.completionRate >= 80 ? 'success' : viewMode === 'markbook' && summaryStats.completionRate >= 50 ? 'warning' : 'default'}
          progress={viewMode === 'markbook' ? summaryStats.completionRate : undefined}
        />
      </div>

      {/* Heat Maps */}
      {viewMode === 'markbook' ? (
        heatMapData ? (
          <GradesHeatMap
            students={heatMapData.students}
            exams={heatMapData.exams}
            cells={heatMapData.cells}
            onCellClick={handleCellClick}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No data available. Try adjusting your filters.
            </CardContent>
          </Card>
        )
      ) : (
        interventionData.length > 0 ? (
          <InterventionHeatMap
            data={interventionData}
            onPointClick={handleInterventionPointClick}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No intervention data available. Try adjusting your filters.
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}

