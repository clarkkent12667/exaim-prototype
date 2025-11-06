import { ReactNode, useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Get sidebar state from localStorage to match sidebar width
  const getSidebarWidth = () => {
    if (typeof window === 'undefined') return 64
    const saved = localStorage.getItem('sidebarCollapsed')
    const isCollapsed = saved ? JSON.parse(saved) : false
    return isCollapsed ? 16 : 64
  }

  const [sidebarWidth, setSidebarWidth] = useState(getSidebarWidth)

  useEffect(() => {
    const handleSidebarToggle = (event: CustomEvent) => {
      setSidebarWidth(event.detail.isCollapsed ? 16 : 64)
    }

    // Listen for custom sidebar toggle event
    window.addEventListener('sidebarToggle', handleSidebarToggle as EventListener)
    
    // Also listen for storage events (for cross-tab sync)
    const handleStorageChange = () => {
      setSidebarWidth(getSidebarWidth())
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
        className="flex-1 overflow-y-auto transition-all duration-300"
        style={{ paddingLeft: typeof window !== 'undefined' && window.innerWidth >= 1024 ? `${sidebarWidth * 4}px` : '0' }}
      >
        <div className="container mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

