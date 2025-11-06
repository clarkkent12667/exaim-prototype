import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExamList } from '@/components/exam/ExamList'
import { attemptService, type ExamAttempt } from '@/lib/examService'
import { useExamsByTeacher } from '@/hooks/useExams'
import { useQuery } from '@tanstack/react-query'
import { Plus, Settings, BookOpen, Users, CheckCircle2, Clock, TrendingUp, Loader2, AlertCircle, BarChart3, Eye } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { supabase } from '@/lib/supabase'

export function TeacherDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  
  // Use React Query for exams data with caching
  const { data: exams = [], isLoading: examsLoading } = useExamsByTeacher(user?.id || '')
  
  // Fetch attempts for all exams (only if we have exams)
  const { data: allAttempts = [], isLoading: attemptsLoading } = useQuery({
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

  // Fetch recent attempts with student info
  const { data: recentAttempts = [] } = useQuery({
    queryKey: ['recent-attempts', exams.map(e => e.id), allAttempts.length],
    queryFn: async () => {
      if (exams.length === 0 || allAttempts.length === 0) return []
      
      // Get the 5 most recent attempts
      const recent = allAttempts.slice(0, 5)
      
      // Enrich with student and exam info
      const enriched = await Promise.all(
        recent.map(async (attempt) => {
          const exam = exams.find(e => e.id === attempt.exam_id)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', attempt.student_id)
            .single()
          
          return {
            ...attempt,
            exam_title: exam?.title || 'Unknown Exam',
            student_name: profile?.full_name || profile?.email || 'Unknown Student',
          }
        })
      )
      
      return enriched
    },
    enabled: exams.length > 0 && allAttempts.length > 0,
    staleTime: 2 * 60 * 1000,
  })

  // Memoize stats calculation to avoid recalculation on every render
  const stats = useMemo(() => {
    const totalExams = exams.length
    const publishedExams = exams.filter(e => e.is_published).length
    const totalAttempts = allAttempts.length
    const completedAttempts = allAttempts.filter(a => a.status === 'completed').length
    const pendingAttempts = allAttempts.filter(a => a.status === 'in_progress').length
    
    // Calculate average score from completed attempts
    const completedWithScores = allAttempts.filter(a => a.status === 'completed' && a.total_score !== null)
    const averageScore = completedWithScores.length > 0
      ? Math.round((completedWithScores.reduce((sum, a) => sum + a.total_score, 0) / completedWithScores.length) * 10) / 10
      : 0
    
    // Calculate completion rate
    const completionRate = totalAttempts > 0
      ? Math.round((completedAttempts / totalAttempts) * 100)
      : 0
    
    return {
      totalExams,
      publishedExams,
      totalAttempts,
      completedAttempts,
      pendingAttempts,
      averageScore,
      completionRate,
    }
  }, [exams, allAttempts])
  
  const loading = examsLoading || attemptsLoading

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
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Teacher Dashboard</h1>
          <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">
            Welcome back, <span className="font-semibold text-foreground">{profile?.full_name || user?.email}</span>
          </p>
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
            <p className="text-xs text-muted-foreground">
              {stats.publishedExams} published, {stats.totalExams - stats.publishedExams} drafts
            </p>
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
            <p className="text-xs text-muted-foreground">
              {stats.completedAttempts} completed, {stats.pendingAttempts} in progress
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Average Score</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.averageScore.toFixed(1)}
              <BarChart3 className="h-6 w-6 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {stats.completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Pending Attempts</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Skeleton className="h-8 w-12" /> : stats.pendingAttempts}
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Require attention</p>
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

        <Card 
          className="cursor-pointer hover:bg-accent transition-all hover:shadow-md border-2 hover:border-primary"
          onClick={() => navigate('/teacher/grades')}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-xl">View Grades</div>
                <CardDescription className="text-sm mt-1">View and manage student grades</CardDescription>
              </div>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Activity Section */}
      {recentAttempts.length > 0 && (
        <Card className="shadow-lg mb-6 sm:mb-8">
          <CardHeader className="bg-muted/50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="mt-1 text-sm">Latest student exam attempts</CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => navigate('/teacher/attempts')} 
                className="w-full sm:w-auto"
              >
                View All Attempts
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                  onClick={() => navigate(`/teacher/exams/${attempt.exam_id}/attempts?attempt=${attempt.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm truncate">{attempt.exam_title}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        attempt.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {attempt.student_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    {attempt.status === 'completed' && (
                      <div className="text-right">
                        <p className="text-sm font-semibold">{attempt.total_score.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    )}
                    <div className="text-right min-w-[80px]">
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at || attempt.started_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(attempt.created_at || attempt.started_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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

