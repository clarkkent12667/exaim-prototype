import { ReactNode, useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved ? JSON.parse(saved) : false
  })

  useEffect(() => {
    const handleSidebarToggle = (event: CustomEvent) => {
      setIsCollapsed(event.detail.isCollapsed)
    }

    // Listen for custom sidebar toggle event
    window.addEventListener('sidebarToggle', handleSidebarToggle as EventListener)
    
    // Also listen for storage events (for cross-tab sync)
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebarCollapsed')
      if (saved) {
        setIsCollapsed(JSON.parse(saved))
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('sidebarToggle', handleSidebarToggle as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main 
        className={`flex-1 overflow-y-auto transition-all duration-300 ${
          isCollapsed 
            ? 'lg:pl-16' 
            : 'lg:pl-64'
        }`}
      >
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

