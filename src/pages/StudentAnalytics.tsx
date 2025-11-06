import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { exportService } from '@/lib/exportService'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { TopicBreakdownChart } from '@/components/analytics/TopicBreakdownChart'
import { FilterBar } from '@/components/analytics/FilterBar'
import { ScoreGauge } from '@/components/analytics/ScoreGauge'
import { InsightsPanel } from '@/components/analytics/InsightsPanel'
import { ExportButton } from '@/components/analytics/ExportButton'
import { useStudentAnalytics } from '@/hooks/useAnalytics'
import { AnalyticsSkeleton } from '@/components/ui/page-skeleton'
import { TrendingUp, CheckCircle2, BarChart3, Target, AlertCircle, CheckCircle, BookOpen, History } from 'lucide-react'

export function StudentAnalytics() {
  const { user, profile } = useAuth()
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Use React Query hook for optimized data fetching
  const { data: analytics, isLoading } = useStudentAnalytics(
    user?.id || '',
    dateRange || undefined
  )

  // Memoize chart data and insights
  const { scoreTrendData, questionTypeData, insights } = useMemo(() => {
    if (!analytics) {
      return { scoreTrendData: [], questionTypeData: [], insights: [] }
    }

    const trendData = analytics.scoreTrend.map(st => ({
      name: new Date(st.date).toLocaleDateString(),
      value: st.percentage,
      score: st.score,
    }))

    const qTypeData = [
      { name: 'Multiple Choice', value: analytics.questionTypePerformance.mcq.percentage },
      { name: 'Fill in the Blank', value: analytics.questionTypePerformance.fib.percentage },
      { name: 'Open-Ended', value: analytics.questionTypePerformance.open_ended.percentage },
    ]

    const insightsList = []
    if (analytics.averageScore >= 80) {
      insightsList.push({
        type: 'success' as const,
        title: 'Excellent Performance',
        description: `You're performing exceptionally well with an average score of ${analytics.averageScore.toFixed(1)}%. Keep up the great work!`,
      })
    } else if (analytics.averageScore < 60) {
      insightsList.push({
        type: 'warning' as const,
        title: 'Focus Needed',
        description: `Your average score is ${analytics.averageScore.toFixed(1)}%. Consider reviewing the areas for improvement.`,
      })
    }

    if (analytics.improvementAreas.length > 0) {
      insightsList.push({
        type: 'recommendation' as const,
        title: 'Review Weak Areas',
        description: `Focus on improving your performance in ${analytics.improvementAreas.length} area${analytics.improvementAreas.length > 1 ? 's' : ''}. Practice more in these areas.`,
      })
    }

    return { scoreTrendData: trendData, questionTypeData: qTypeData, insights: insightsList }
  }, [analytics])

  const handleExportPDF = useCallback(() => {
    if (analytics && profile) {
      exportService.exportStudentAnalyticsToPDF(analytics, profile.full_name || user?.email || 'Student')
    }
  }, [analytics, profile, user])

  const handleExportCSV = useCallback(() => {
    if (analytics) {
      const csv = exportService.exportStudentAnalyticsToCSV(analytics)
      exportService.downloadCSV(csv, `student-analytics-${new Date().toISOString().split('T')[0]}.csv`)
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
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">My Analytics</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Track your progress and performance
            </p>
          </div>
          <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        quickFilters={getQuickFilters()}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        showDateRange={true}
        onClearAll={() => setDateRange(null)}
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <AnalyticsCard
          title="Total Attempts"
          value={analytics.totalAttempts}
          icon={CheckCircle2}
          description="Exams completed"
          variant="default"
        />
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
        <AnalyticsCard
          title="Strengths"
          value={analytics.strengths.length}
          icon={Target}
          description="Areas of excellence"
          variant="success"
        />
      </div>

      {/* Insights Panel */}
      {insights.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <InsightsPanel insights={insights} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="performance">
            <TrendingUp className="h-4 w-4 mr-2" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="topics">
            <BookOpen className="h-4 w-4 mr-2" />
            Topics
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <ScoreGauge
                score={analytics.averageScore}
                title="Overall Performance"
                description="Your average score"
                target={80}
                size="md"
              />
            </div>
            <div className="lg:col-span-2">
              {scoreTrendData.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Score Trend</CardTitle>
                    <CardDescription>Your performance over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart
                      data={scoreTrendData}
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

          {/* Strengths and Weaknesses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analytics.strengths.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-green-600" />
                    Strengths
                  </CardTitle>
                  <CardDescription>Areas where you excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analytics.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {analytics.improvementAreas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Areas for Improvement
                  </CardTitle>
                  <CardDescription>Focus areas to enhance performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {analytics.improvementAreas.map((area, index) => (
                      <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                        <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{area}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Trend</CardTitle>
              <CardDescription>Your scores over time</CardDescription>
            </CardHeader>
            <CardContent>
              {scoreTrendData.length > 0 ? (
                <PerformanceChart
                  data={scoreTrendData}
                  type="line"
                  dataKey="value"
                  color="#8884d8"
                />
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No performance data available yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topics Tab */}
        <TabsContent value="topics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Question Type Performance</CardTitle>
              <CardDescription>Performance by question type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Multiple Choice</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {analytics.questionTypePerformance.mcq.percentage.toFixed(1)}%
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${analytics.questionTypePerformance.mcq.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {analytics.questionTypePerformance.mcq.correct} / {analytics.questionTypePerformance.mcq.total} correct
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fill in the Blank</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {analytics.questionTypePerformance.fib.percentage.toFixed(1)}%
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${analytics.questionTypePerformance.fib.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {analytics.questionTypePerformance.fib.correct} / {analytics.questionTypePerformance.fib.total} correct
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Open-Ended</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-2">
                      {analytics.questionTypePerformance.open_ended.percentage.toFixed(1)}%
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${analytics.questionTypePerformance.open_ended.percentage}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {analytics.questionTypePerformance.open_ended.correct} / {analytics.questionTypePerformance.open_ended.total} correct
                    </p>
                  </CardContent>
                </Card>
              </div>
              <TopicBreakdownChart data={questionTypeData} type="bar" />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          {analytics.scoreTrend.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Score History</CardTitle>
                <CardDescription>Detailed breakdown of your exam attempts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Date</th>
                        <th className="text-left p-3 font-semibold">Exam</th>
                        <th className="text-left p-3 font-semibold">Score</th>
                        <th className="text-left p-3 font-semibold">Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.scoreTrend.map((st, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-3">{new Date(st.date).toLocaleDateString()}</td>
                          <td className="p-3">{st.exam_title}</td>
                          <td className="p-3 font-medium">{st.score.toFixed(2)}</td>
                          <td className="p-3">
                            <span className={`font-medium ${
                              st.percentage >= 80 ? 'text-green-600' :
                              st.percentage >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {st.percentage.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No score history available yet
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

