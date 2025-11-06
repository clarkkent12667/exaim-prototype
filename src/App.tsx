import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useTransition } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PageSkeleton } from './components/ui/page-skeleton'

// Lazy load all page components for code splitting
const AuthPage = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard').then(m => ({ default: m.TeacherDashboard })))
const StudentDashboard = lazy(() => import('./pages/StudentDashboard').then(m => ({ default: m.StudentDashboard })))
const CreateExam = lazy(() => import('./pages/CreateExam').then(m => ({ default: m.CreateExam })))
const EditExam = lazy(() => import('./pages/EditExam').then(m => ({ default: m.EditExam })))
const ManageQuestions = lazy(() => import('./pages/ManageQuestions').then(m => ({ default: m.ManageQuestions })))
const ManageQualifications = lazy(() => import('./pages/ManageQualifications').then(m => ({ default: m.ManageQualifications })))
const TakeExam = lazy(() => import('./pages/TakeExam').then(m => ({ default: m.TakeExam })))
const ExamResults = lazy(() => import('./pages/ExamResults').then(m => ({ default: m.ExamResults })))
const ViewStudentAttempts = lazy(() => import('./pages/ViewStudentAttempts').then(m => ({ default: m.ViewStudentAttempts })))
const StudentAttemptHistory = lazy(() => import('./pages/StudentAttemptHistory').then(m => ({ default: m.StudentAttemptHistory })))
const AllStudentAttempts = lazy(() => import('./pages/AllStudentAttempts').then(m => ({ default: m.AllStudentAttempts })))
const ManageClasses = lazy(() => import('./pages/ManageClasses').then(m => ({ default: m.ManageClasses })))
const TeacherAnalytics = lazy(() => import('./pages/TeacherAnalytics').then(m => ({ default: m.TeacherAnalytics })))
const StudentAnalytics = lazy(() => import('./pages/StudentAnalytics').then(m => ({ default: m.StudentAnalytics })))
const TeacherGrades = lazy(() => import('./pages/TeacherGrades').then(m => ({ default: m.TeacherGrades })))
const StudentGrades = lazy(() => import('./pages/StudentGrades').then(m => ({ default: m.StudentGrades })))

// Loading fallback component - using skeleton for better perceived performance
const PageLoader = () => <PageSkeleton />

// Separate component for routes that needs to be inside AuthProvider
function AppRoutes() {
  const [isPending] = useTransition()
  
  // Component to handle root route redirect based on auth state and role
  // Defined inside AppRoutes to ensure it has access to AuthProvider context
  function RootRedirect() {
    const { user, session, profile, loading, getDashboardRoute } = useAuth()
    
    if (loading) {
      return <PageLoader />
    }
    
    // Redirect to role-specific dashboard if authenticated with profile, otherwise to auth
    if (user && session && profile) {
      const dashboardRoute = getDashboardRoute()
      // Use startTransition for smoother navigation
      return <Navigate to={dashboardRoute} replace />
    }
    
    // If user exists but no profile, or no user at all, redirect to auth
    return <Navigate to="/auth" replace />
  }
  
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Suspense fallback={<PageLoader />}>
        {isPending && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-primary/20 z-50">
            <div className="h-full bg-primary animate-pulse" style={{ width: '30%' }} />
          </div>
        )}
        <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <TeacherDashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <StudentDashboard />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/create"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <CreateExam />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <EditExam />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:id/questions"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <ManageQuestions />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/manage"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <ManageQualifications />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/exams/:id/take"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <TakeExam />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/exams/:id/results"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <ExamResults />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:id/attempts"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <ViewStudentAttempts />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/attempts"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <StudentAttemptHistory />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/attempts"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <AllStudentAttempts />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/classes"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <ManageClasses />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/analytics"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <TeacherAnalytics />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/analytics"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <StudentAnalytics />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/grades"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <Suspense fallback={<PageLoader />}>
                    <TeacherGrades />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/grades"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <Suspense fallback={<PageLoader />}>
                    <StudentGrades />
                  </Suspense>
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<RootRedirect />} />
            {/* Catch-all route for unmatched paths - redirect to root */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App

