import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExamList } from '@/components/exam/ExamList'
import { attemptService } from '@/lib/examService'
import { useExamsByTeacher } from '@/hooks/useExams'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings, BookOpen, Users, CheckCircle2, Clock, TrendingUp, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export function TeacherDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  
  // Use React Query for exams data with caching
  const { data: exams = [], isLoading: examsLoading } = useExamsByTeacher(user?.id || '')
  
  // Fetch attempts for all exams (only if we have exams)
  const { data: allAttempts = [] } = useQuery({
    queryKey: ['attempts', 'exams', exams.map(e => e.id)],
    queryFn: async () => {
      if (exams.length === 0) return []
      const examIds = exams.map(e => e.id)
      const { data } = await attemptService.getByExams(examIds)
      return data || []
    },
    enabled: exams.length > 0, // Only fetch if we have exams
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // Memoize stats calculation to avoid recalculation on every render
  const stats = useMemo(() => {
    const totalExams = exams.length
    const publishedExams = exams.filter(e => e.is_published).length
    const totalAttempts = allAttempts.length
    const completedAttempts = allAttempts.filter(a => a.status === 'completed').length
    
    return {
      totalExams,
      publishedExams,
      totalAttempts,
      completedAttempts,
    }
  }, [exams, allAttempts])
  
  const loading = examsLoading

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl w-full">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Teacher Dashboard</h1>
            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
              Welcome back, <span className="font-semibold text-foreground">{profile?.full_name || user?.email}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/teacher/attempts')} className="w-full sm:w-auto">
            View All Student Attempts
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Total Exams</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.totalExams}
              <BookOpen className="h-6 w-6 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All exams created</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Published Exams</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.publishedExams}
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Available to students</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Total Attempts</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.totalAttempts}
              <Users className="h-6 w-6 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All student attempts</p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Completed Attempts</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.completedAttempts}
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Successfully submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card 
          className="cursor-pointer hover:bg-accent transition-all hover:shadow-md border-2 hover:border-primary"
          onClick={() => navigate('/teacher/exams/create')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-xl">Create Exam</div>
                <CardDescription className="text-sm mt-1">Create a new exam using AI or manually</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-all hover:shadow-md border-2 hover:border-primary"
          onClick={() => navigate('/teacher/classes')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-xl">Manage Classes</div>
                <CardDescription className="text-sm mt-1">Create classes and assign exams to students</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card 
          className="cursor-pointer hover:bg-accent transition-all hover:shadow-md border-2 hover:border-primary"
          onClick={() => navigate('/teacher/exams/manage')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <Settings className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-xl">Manage Qualifications</div>
                <CardDescription className="text-sm mt-1">Manage qualifications, exam boards, and topics</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-xl">Recent Activity</div>
                <CardDescription className="text-sm mt-1">View recent exam activity</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Exams List */}
      <Card className="shadow-lg">
        <CardHeader className="bg-muted/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl sm:text-2xl">My Exams</CardTitle>
              <CardDescription className="mt-1 text-sm">All exams you've created and managed</CardDescription>
            </div>
            <Button onClick={() => navigate('/teacher/exams/create')} size="lg" className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create New Exam
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <ExamList teacherId={user.id} />
        </CardContent>
      </Card>
    </div>
  )
}

