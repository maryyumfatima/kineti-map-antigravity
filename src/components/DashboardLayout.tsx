import { Sidebar } from './Sidebar'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Desktop: collapsed shows icons only. Default = expanded.
  // Mobile: drawer is closed by default. Tap hamburger to open as overlay.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebarCollapsed') === 'true'
  })
  const [mobileOpen, setMobileOpen] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', String(collapsed))
    }
  }, [collapsed])

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const mainMarginClass = collapsed ? 'lg:ml-[72px]' : 'lg:ml-[240px]'

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />

      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Mobile-only top bar with hamburger */}
      <header className="lg:hidden sticky top-0 z-20 bg-background border-b border-border h-14 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-accent/20 active:scale-95 transition-transform"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6 text-text" />
        </button>
        <h2 className="text-primary font-bricolage text-[18px] font-bold">KinetiMap</h2>
      </header>

      <main className={`p-4 lg:p-8 transition-[margin] duration-200 ${mainMarginClass}`}>
        {children}
      </main>
    </div>
  )
}