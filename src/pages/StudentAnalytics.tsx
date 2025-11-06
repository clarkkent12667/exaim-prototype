import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsService, type StudentAnalytics } from '@/lib/analyticsService'
import { exportService } from '@/lib/exportService'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { TopicBreakdownChart } from '@/components/analytics/TopicBreakdownChart'
import { ExportButton } from '@/components/analytics/ExportButton'
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter'
import { TrendingUp, CheckCircle2, Loader2, BarChart3, Target, AlertCircle } from 'lucide-react'

export function StudentAnalytics() {
  const { user, profile } = useAuth()
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)

  useEffect(() => {
    if (user) {
      loadAnalytics()
    }
  }, [user, dateRange])

  const loadAnalytics = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await analyticsService.getStudentAnalytics(
        user.id,
        dateRange || undefined
      )
      if (error) throw error
      setAnalytics(data)
    } catch (error: any) {
      alert('Error loading analytics: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExportPDF = () => {
    if (analytics && profile) {
      exportService.exportStudentAnalyticsToPDF(analytics, profile.full_name || user?.email || 'Student')
    }
  }

  const handleExportCSV = () => {
    if (analytics) {
      const csv = exportService.exportStudentAnalyticsToCSV(analytics)
      exportService.downloadCSV(csv, `student-analytics-${new Date().toISOString().split('T')[0]}.csv`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!analytics) {
    return <div>No analytics data available</div>
  }

  // Prepare chart data
  const scoreTrendData = analytics.scoreTrend.map(st => ({
    name: new Date(st.date).toLocaleDateString(),
    value: st.percentage,
    score: st.score,
  }))

  const questionTypeData = [
    { name: 'Multiple Choice', value: analytics.questionTypePerformance.mcq.percentage },
    { name: 'Fill in the Blank', value: analytics.questionTypePerformance.fib.percentage },
    { name: 'Open-Ended', value: analytics.questionTypePerformance.open_ended.percentage },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">My Analytics</h1>
            <p className="text-muted-foreground text-lg">Track your progress and performance</p>
          </div>
          <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-8">
        <DateRangeFilter onFilterChange={setDateRange} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <AnalyticsCard
          title="Total Attempts"
          value={analytics.totalAttempts}
          icon={CheckCircle2}
          description="Exams completed"
        />
        <AnalyticsCard
          title="Average Score"
          value={analytics.averageScore.toFixed(2)}
          icon={TrendingUp}
          description="Across all exams"
        />
        <AnalyticsCard
          title="Completion Rate"
          value={`${analytics.completionRate.toFixed(2)}%`}
          icon={BarChart3}
          description="Completed attempts"
        />
      </div>

      {/* Score Trend Chart */}
      {scoreTrendData.length > 0 && (
        <Card className="mb-8">
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
      )}

      {/* Question Type Performance */}
      <Card className="mb-8">
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
                <div className="text-3xl font-bold">
                  {analytics.questionTypePerformance.mcq.percentage.toFixed(1)}%
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
                <div className="text-3xl font-bold">
                  {analytics.questionTypePerformance.fib.percentage.toFixed(1)}%
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
                <div className="text-3xl font-bold">
                  {analytics.questionTypePerformance.open_ended.percentage.toFixed(1)}%
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

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
              <ul className="space-y-2">
                {analytics.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>{strength}</span>
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
              <ul className="space-y-2">
                {analytics.improvementAreas.map((area, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-orange-600">→</span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Score History Table */}
      {analytics.scoreTrend.length > 0 && (
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
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Exam</th>
                    <th className="text-left p-2">Score</th>
                    <th className="text-left p-2">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.scoreTrend.map((st, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{new Date(st.date).toLocaleDateString()}</td>
                      <td className="p-2">{st.exam_title}</td>
                      <td className="p-2">{st.score.toFixed(2)}</td>
                      <td className="p-2">{st.percentage.toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

