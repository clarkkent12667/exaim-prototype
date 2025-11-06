import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Plus,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
  BarChart3,
} from 'lucide-react'

interface MenuItem {
  label: string
  icon: React.ReactNode
  path: string
  roles: ('teacher' | 'student')[]
}

const teacherMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/teacher/dashboard',
    roles: ['teacher'],
  },
  {
    label: 'Create Exam',
    icon: <Plus className="h-5 w-5" />,
    path: '/teacher/exams/create',
    roles: ['teacher'],
  },
  {
    label: 'View Grades',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/teacher/grades',
    roles: ['teacher'],
  },
  {
    label: 'Manage Classes',
    icon: <Users className="h-5 w-5" />,
    path: '/teacher/classes',
    roles: ['teacher'],
  },
  {
    label: 'Manage Qualifications',
    icon: <Settings className="h-5 w-5" />,
    path: '/teacher/exams/manage',
    roles: ['teacher'],
  },
]

const studentMenuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/student/dashboard',
    roles: ['student'],
  },
  {
    label: 'View Grades',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/student/grades',
    roles: ['student'],
  },
]

export function Sidebar() {
  const { profile, signOut, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed))
    // Dispatch custom event to notify Layout component
    window.dispatchEvent(new CustomEvent('sidebarToggle', { detail: { isCollapsed } }))
  }, [isCollapsed])

  // Memoize menu items to prevent recalculation - must be called before early returns
  const menuItems = useMemo(
    () => profile?.role === 'teacher' ? teacherMenuItems : studentMenuItems,
    [profile?.role]
  )
  
  // Memoize isActive function - must be called before early returns
  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname])

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }, [signOut, navigate])

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev: boolean) => !prev)
  }, [])

  // Don't hide sidebar during loading - only hide if we're definitely not authenticated
  // This prevents the sidebar from flickering during auth state transitions
  if (loading) {
    // Show a minimal sidebar during loading to prevent layout shift
    return (
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col">
        <div className="flex h-full w-64 flex-col bg-card border-r">
          <div className="flex h-16 items-center justify-center border-b">
            <img 
              src="/image/Only Graphic.png" 
              alt="Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>
      </aside>
    )
  }

  // Only hide sidebar if we're definitely not authenticated (not just during transitions)
  if (!user) return null

  // If profile is not loaded yet, show minimal sidebar
  if (!profile) {
    return (
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col">
        <div className="flex h-full w-64 flex-col bg-card border-r">
          <div className="flex h-16 items-center justify-center border-b">
            <img 
              src="/image/Only Graphic.png" 
              alt="Logo" 
              className="h-8 w-8 object-contain"
            />
          </div>
        </div>
      </aside>
    )
  }

  const SidebarContent = () => (
    <div className={`flex h-full flex-col bg-card border-r transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      <div className={`flex h-16 items-center justify-between border-b ${isCollapsed ? 'px-2' : 'px-6'}`}>
        <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          {isCollapsed ? (
            <img 
              src="/image/Only Graphic.png" 
              alt="Logo" 
              className="h-8 w-8 object-contain flex-shrink-0"
            />
          ) : (
            <img 
              src="/image/Full logo.png" 
              alt="Logo" 
              className="h-10 object-contain flex-shrink-0"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hidden lg:flex"
              onClick={toggleCollapse}
              title="Minimize sidebar"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <nav className="space-y-1">
          {menuItems.map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? 'secondary' : 'ghost'}
              className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
              onClick={() => {
                navigate(item.path)
                setIsMobileOpen(false)
              }}
              title={isCollapsed ? item.label : undefined}
            >
              {item.icon}
              {!isCollapsed && <span className="ml-3">{item.label}</span>}
            </Button>
          ))}
        </nav>
      </div>

      <div className="border-t p-4">
        {!isCollapsed && (
          <div className="mb-4 px-2">
            <p className="text-sm font-medium truncate">{profile?.full_name || user?.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
          </div>
        )}
        <Button
          variant="ghost"
          className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start'}`}
          onClick={handleSignOut}
          title={isCollapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="h-5 w-5" />
          {!isCollapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>

      {isCollapsed && (
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 w-full"
            onClick={toggleCollapse}
            title="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed left-0 top-0 z-40 h-full w-64 transform transition-transform duration-300 lg:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:flex-col">
        <SidebarContent />
      </aside>
    </>
  )
}

