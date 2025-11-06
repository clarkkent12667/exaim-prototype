import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { analyticsService, type TeacherAnalytics } from '@/lib/analyticsService'
import { exportService } from '@/lib/exportService'
import { classService } from '@/lib/classService'
import { AnalyticsCard } from '@/components/analytics/AnalyticsCard'
import { PerformanceChart } from '@/components/analytics/PerformanceChart'
import { InterventionList } from '@/components/analytics/InterventionList'
import { ExportButton } from '@/components/analytics/ExportButton'
import { DateRangeFilter } from '@/components/analytics/DateRangeFilter'
import { Users, BookOpen, TrendingUp, CheckCircle2, Loader2, BarChart3 } from 'lucide-react'
import Select from 'react-select'

export function TeacherAnalytics() {
  const { user, profile } = useAuth()
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<string>('')
  const [classes, setClasses] = useState<Array<{ value: string; label: string }>>([])
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null)

  useEffect(() => {
    if (user) {
      loadClasses()
      loadAnalytics()
    }
  }, [user, selectedClass, dateRange])

  const loadClasses = async () => {
    if (!user) return
    const { data } = await classService.getByTeacher(user.id)
    if (data) {
      setClasses([
        { value: '', label: 'All Classes' },
        ...data.map(c => ({ value: c.id, label: c.name }))
      ])
    }
  }

  const loadAnalytics = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await analyticsService.getTeacherAnalytics(
        user.id,
        selectedClass || undefined,
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
      exportService.exportTeacherAnalyticsToPDF(analytics, profile.full_name || user?.email || 'Teacher')
    }
  }

  const handleExportCSV = () => {
    if (analytics) {
      const csv = exportService.exportTeacherAnalyticsToCSV(analytics)
      exportService.downloadCSV(csv, `teacher-analytics-${new Date().toISOString().split('T')[0]}.csv`)
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
  const classPerformanceData = analytics.classPerformance.map(cp => ({
    name: cp.class_name,
    value: cp.average_score,
    completion: cp.completion_rate,
  }))

  const examPerformanceData = analytics.examPerformance.map(ep => ({
    name: ep.exam_title.length > 20 ? ep.exam_title.substring(0, 20) + '...' : ep.exam_title,
    value: ep.average_score,
    attempts: ep.total_attempts,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-lg">Comprehensive insights into your classes and exams</p>
          </div>
          <ExportButton onExportPDF={handleExportPDF} onExportCSV={handleExportCSV} />
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Filter by Class</CardTitle>
            <CardDescription>View analytics for a specific class</CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              options={classes}
              value={classes.find(c => c.value === selectedClass) || classes[0]}
              onChange={(option) => setSelectedClass(option?.value || '')}
            />
          </CardContent>
        </Card>
        <DateRangeFilter onFilterChange={setDateRange} />
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AnalyticsCard
          title="Total Classes"
          value={analytics.totalClasses}
          icon={Users}
          description="Active classes"
        />
        <AnalyticsCard
          title="Total Students"
          value={analytics.totalStudents}
          icon={Users}
          description="Enrolled students"
        />
        <AnalyticsCard
          title="Total Exams"
          value={analytics.totalExams}
          icon={BookOpen}
          description="Created exams"
        />
        <AnalyticsCard
          title="Total Attempts"
          value={analytics.totalAttempts}
          icon={CheckCircle2}
          description="Student attempts"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

      {/* At-Risk Students */}
      <div className="mb-8">
        <InterventionList students={analytics.atRiskStudents} />
      </div>

      {/* Exam Performance Table */}
      {analytics.examPerformance.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Detailed Exam Performance</CardTitle>
            <CardDescription>Performance metrics for each exam</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Exam Title</th>
                    <th className="text-left p-2">Total Attempts</th>
                    <th className="text-left p-2">Average Score</th>
                    <th className="text-left p-2">Completion Rate</th>
                    <th className="text-left p-2">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.examPerformance.map((ep) => (
                    <tr key={ep.exam_id} className="border-b">
                      <td className="p-2">{ep.exam_title}</td>
                      <td className="p-2">{ep.total_attempts}</td>
                      <td className="p-2">{ep.average_score.toFixed(2)}</td>
                      <td className="p-2">{ep.completion_rate.toFixed(2)}%</td>
                      <td className="p-2">{ep.total_students}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Performance Table */}
      {analytics.classPerformance.length > 0 && (
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
                    <th className="text-left p-2">Class Name</th>
                    <th className="text-left p-2">Students</th>
                    <th className="text-left p-2">Average Score</th>
                    <th className="text-left p-2">Completion Rate</th>
                    <th className="text-left p-2">Total Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.classPerformance.map((cp) => (
                    <tr key={cp.class_id} className="border-b">
                      <td className="p-2">{cp.class_name}</td>
                      <td className="p-2">{cp.student_count}</td>
                      <td className="p-2">{cp.average_score.toFixed(2)}</td>
                      <td className="p-2">{cp.completion_rate.toFixed(2)}%</td>
                      <td className="p-2">{cp.total_attempts}</td>
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

