import { Sidebar } from './Sidebar'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'
import { Menu, ChevronLeft } from 'lucide-react'

export function DashboardLayout({ children, fullWidth = false }: { children: React.ReactNode, fullWidth?: boolean }) {
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

  const mainMarginClass = fullWidth ? 'lg:ml-0' : (collapsed ? 'lg:ml-[72px]' : 'lg:ml-[240px]')

  return (
    <div className="min-h-screen bg-background">
      <div className="top-progress-bar" />
      <Toaster position="top-right" richColors />

      {!fullWidth && (
        <Sidebar
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed(c => !c)}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile-only top bar with hamburger or Full Width toggle */}
      <header className={`${fullWidth ? 'flex' : 'lg:hidden'} sticky top-0 z-20 bg-gradient-to-r from-primary to-[#005a63] border-b border-primary/20 h-14 flex items-center px-4 gap-3 shadow-lg`}>
        <button
          type="button"
          onClick={() => fullWidth ? window.history.back() : setMobileOpen(true)}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 active:scale-95 transition-transform"
          aria-label={fullWidth ? "Go back" : "Open menu"}
        >
          {fullWidth ? <ChevronLeft className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
        </button>
        <h2 className="text-white font-bricolage text-[18px] font-bold">
          {fullWidth ? 'Patient Profile' : 'KinetiMap'}
        </h2>
      </header>

      <main className={`p-4 lg:p-8 transition-[margin] duration-200 ${mainMarginClass}`}>
        {children}
      </main>
    </div>
  )
}