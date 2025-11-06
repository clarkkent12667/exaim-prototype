import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportService } from '@/lib/exportService'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { InterventionList } from '@/components/analytics/InterventionList'
import { FilterBar } from '@/components/analytics/FilterBar'
import { ExportButton } from '@/components/analytics/ExportButton'
import { useTeacherAnalytics } from '@/hooks/useAnalytics'
import { useFilterOptions } from '@/hooks/useFilters'
import { AnalyticsSkeleton } from '@/components/ui/page-skeleton'
import { Users, BookOpen, TrendingUp, CheckCircle2, BarChart3, AlertTriangle, GraduationCap } from 'lucide-react'

export function TeacherAnalytics() {
  const { user, profile } = useAuth()
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Use React Query hooks for optimized data fetching
  const { classes } = useFilterOptions(user?.id)
  const { data: analytics, isLoading } = useTeacherAnalytics(
    user?.id || '',
    selectedClass || undefined,
    dateRange || undefined
  )

  // Memoize chart data preparation
  const { classPerformanceData, examPerformanceData } = useMemo(() => {
    if (!analytics) {
      return { classPerformanceData: [], examPerformanceData: [] }
    }

    return {
      classPerformanceData: analytics.classPerformance.map(cp => ({
        name: cp.class_name,
        value: cp.average_score,
        completion: cp.completion_rate,
      })),
      examPerformanceData: analytics.examPerformance.map(ep => ({
        name: ep.exam_title.length > 20 ? ep.exam_title.substring(0, 20) + '...' : ep.exam_title,
        value: ep.average_score,
        attempts: ep.total_attempts,
      })),
    }
  }, [analytics])

  const handleExportPDF = useCallback(() => {
    if (analytics && profile) {
      exportService.exportTeacherAnalyticsToPDF(analytics, profile.full_name || user?.email || 'Teacher')
    }
  }, [analytics, profile, user])

  const handleExportCSV = useCallback(() => {
    if (analytics) {
      const csv = exportService.exportTeacherAnalyticsToCSV(analytics)
      exportService.downloadCSV(csv, `teacher-analytics-${new Date().toISOString().split('T')[0]}.csv`)
    }
  }, [analytics])

  if (isLoading) {
    return <AnalyticsSkeleton />
  }

  if (!analytics) {
    return (
      <div className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No analytics data available
          </CardContent>
        </Card>
      </div>
    )
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Comprehensive insights into your classes and exams
            </p>
          </div>
          <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        quickFilters={getQuickFilters()}
        classes={classes}
        selectedClass={selectedClass}
        onClassChange={setSelectedClass}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showClass={true}
        showDateRange={true}
        onClearAll={() => {
          setSelectedClass('')
          setDateRange(null)
        }}
      />

      {/* Executive Summary - KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <AnalyticsCard
          title="Total Classes"
          value={analytics.totalClasses}
          icon={GraduationCap}
          description="Active classes"
          variant="default"
        />
        <AnalyticsCard
          title="Total Students"
          value={analytics.totalStudents}
          icon={Users}
          description="Enrolled students"
          variant="default"
        />
        <AnalyticsCard
          title="Total Exams"
          value={analytics.totalExams}
          icon={BookOpen}
          description="Created exams"
          variant="default"
        />
        <AnalyticsCard
          title="Total Attempts"
          value={analytics.totalAttempts}
          icon={CheckCircle2}
          description="Student attempts"
          variant="default"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <AnalyticsCard
          title="Average Score"
          value={analytics.averageScore.toFixed(1)}
          icon={TrendingUp}
          description="Across all exams"
          variant={analytics.averageScore >= 80 ? 'success' : analytics.averageScore >= 60 ? 'warning' : 'danger'}
          progress={analytics.averageScore}
        />
        <AnalyticsCard
          title="Completion Rate"
          value={`${analytics.completionRate.toFixed(1)}%`}
          icon={BarChart3}
          description="Completed attempts"
          variant={analytics.completionRate >= 80 ? 'success' : analytics.completionRate >= 50 ? 'warning' : 'danger'}
          progress={analytics.completionRate}
        />
      </div>

      {/* At-Risk Students Alert */}
      {analytics.atRiskStudents.length > 0 && (
        <Card className="mb-6 sm:mb-8 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-5 w-5" />
              {analytics.atRiskStudents.length} Student{analytics.atRiskStudents.length > 1 ? 's' : ''} Need Attention
            </CardTitle>
            <CardDescription>
              These students may benefit from additional support or intervention
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="classes">
            <GraduationCap className="h-4 w-4 mr-2" />
            Classes
          </TabsTrigger>
          <TabsTrigger value="exams">
            <BookOpen className="h-4 w-4 mr-2" />
            Exams
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users className="h-4 w-4 mr-2" />
            Students
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {classPerformanceData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Class Performance</CardTitle>
                  <CardDescription>Average scores by class</CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceChart
                    data={classPerformanceData}
                    type="bar"
                    dataKey="value"
                    color="#8884d8"
                  />
                </CardContent>
              </Card>
            )}

            {examPerformanceData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Exam Performance</CardTitle>
                  <CardDescription>Average scores by exam</CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceChart
                    data={examPerformanceData}
                    type="bar"
                    dataKey="value"
                    color="#82ca9d"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-6">
          {analytics.classPerformance.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Class Performance Comparison</CardTitle>
                  <CardDescription>Average scores across all classes</CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceChart
                    data={classPerformanceData}
                    type="bar"
                    dataKey="value"
                    color="#8884d8"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Class Performance</CardTitle>
                  <CardDescription>Performance metrics for each class</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Class Name</th>
                          <th className="text-left p-3 font-semibold">Students</th>
                          <th className="text-left p-3 font-semibold">Average Score</th>
                          <th className="text-left p-3 font-semibold">Completion Rate</th>
                          <th className="text-left p-3 font-semibold">Total Attempts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.classPerformance.map((cp) => (
                          <tr key={cp.class_id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3 font-medium">{cp.class_name}</td>
                            <td className="p-3">{cp.student_count}</td>
                            <td className="p-3">
                              <span className={`font-medium ${
                                cp.average_score >= 80 ? 'text-green-600' :
                                cp.average_score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {cp.average_score.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3">{cp.completion_rate.toFixed(2)}%</td>
                            <td className="p-3">{cp.total_attempts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No class performance data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Exams Tab */}
        <TabsContent value="exams" className="space-y-6">
          {analytics.examPerformance.length > 0 ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Exam Performance Comparison</CardTitle>
                  <CardDescription>Average scores across all exams</CardDescription>
                </CardHeader>
                <CardContent>
                  <PerformanceChart
                    data={examPerformanceData}
                    type="bar"
                    dataKey="value"
                    color="#82ca9d"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Detailed Exam Performance</CardTitle>
                  <CardDescription>Performance metrics for each exam</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-3 font-semibold">Exam Title</th>
                          <th className="text-left p-3 font-semibold">Total Attempts</th>
                          <th className="text-left p-3 font-semibold">Average Score</th>
                          <th className="text-left p-3 font-semibold">Completion Rate</th>
                          <th className="text-left p-3 font-semibold">Students</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.examPerformance.map((ep) => (
                          <tr key={ep.exam_id} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-3 font-medium">{ep.exam_title}</td>
                            <td className="p-3">{ep.total_attempts}</td>
                            <td className="p-3">
                              <span className={`font-medium ${
                                ep.average_score >= 80 ? 'text-green-600' :
                                ep.average_score >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {ep.average_score.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3">{ep.completion_rate.toFixed(2)}%</td>
                            <td className="p-3">{ep.total_students}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No exam performance data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6">
          <InterventionList students={analytics.atRiskStudents} />
        </TabsContent>
      </Tabs>

    </div>
  )
}

