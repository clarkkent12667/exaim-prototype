import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ExamList } from '@/components/exam/ExamList'
import { examService, attemptService } from '@/lib/examService'
import { Plus, Settings, BookOpen, Users, CheckCircle2, Clock, TrendingUp, Loader2 } from 'lucide-react'

export function TeacherDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalExams: 0,
    publishedExams: 0,
    totalAttempts: 0,
    completedAttempts: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadStats()
    }
  }, [user])

  const loadStats = async () => {
    setLoading(true)
    try {
      // Load exams
      const { data: exams } = await examService.getByTeacher(user!.id)
      const totalExams = exams?.length || 0
      const publishedExams = exams?.filter(e => e.is_published).length || 0

      // Batch load attempts for all exams at once instead of N+1 queries
      let totalAttempts = 0
      let completedAttempts = 0
      
      if (exams && exams.length > 0) {
        const examIds = exams.map(e => e.id)
        const { data: allAttempts } = await attemptService.getByExams(examIds)
        
        if (allAttempts) {
          totalAttempts = allAttempts.length
          completedAttempts = allAttempts.filter(a => a.status === 'completed').length
        }
      }

      setStats({
        totalExams,
        publishedExams,
        totalAttempts,
        completedAttempts,
      })
    } catch (error) {
      // Error loading stats
    } finally {
      setLoading(false)
    }
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Teacher Dashboard</h1>
            <p className="text-muted-foreground text-lg">
              Welcome back, <span className="font-semibold text-foreground">{profile?.full_name || user?.email}</span>
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/teacher/attempts')}>
            View All Student Attempts
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="border-2 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardDescription className="text-sm font-medium">Total Exams</CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalExams}
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
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.publishedExams}
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
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.totalAttempts}
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
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.completedAttempts}
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Successfully submitted</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">My Exams</CardTitle>
              <CardDescription className="mt-1">All exams you've created and managed</CardDescription>
            </div>
            <Button onClick={() => navigate('/teacher/exams/create')} size="lg">
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

