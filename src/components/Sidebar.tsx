import { Link, useRouter, useParams } from '@tanstack/react-router'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  Star,
  DollarSign,
  Palette,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'AI SOAP Notes', path: '/ai/soap-notes', icon: Star },
  { name: 'Sessions', path: '/sessions', icon: Calendar },
  { name: 'Availability', path: '/availability', icon: Clock },
  { name: 'Feedback', path: '/feedback', icon: Star },
  { name: 'Revenue', path: '/revenue', icon: DollarSign },
  { name: 'Branding', path: '/branding', icon: Palette },
  { name: 'Billing', path: '/billing', icon: CreditCard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggleCollapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const [email, setEmail] = useState<string | null>(null)
  const router = useRouter()
    useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setEmail(user.email ?? null)
      }
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.navigate({ to: '/login',  })
  }

  // Width classes based on state
  // - Desktop expanded: 240px
  // - Desktop collapsed: 72px (icons only)
  // - Mobile: always 240px when open (it's an overlay anyway)
  const desktopWidthClass = collapsed ? 'lg:w-[72px]' : 'lg:w-[240px]'

  return (
    <>
      {/* Mobile backdrop — covers content when drawer is open on phone */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 h-screen w-[240px] bg-background border-r border-border z-40
          flex flex-col
          transition-transform duration-200 ease-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 ${desktopWidthClass}
        `}
      >
        {/* Header: brand + collapse/close button */}
        <div className={`flex items-center ${collapsed ? 'lg:justify-center lg:px-2' : 'justify-between px-6'} py-5`}>
          {!collapsed && (
            <h2 className="text-primary font-bricolage text-[22px] font-bold">KinetiMap</h2>
          )}

          {/* Mobile close button (X) */}
          <button
            type="button"
            onClick={onMobileClose}
            className="lg:hidden p-2 rounded-lg hover:bg-accent/20 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-text" />
          </button>

          {/* Desktop collapse toggle (chevron) */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden lg:flex p-1.5 rounded-lg hover:bg-accent/20 transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4 text-text" /> : <ChevronLeft className="w-4 h-4 text-text" />}
          </button>
        </div>

        {/* Nav items */}
        <nav className={`flex-1 ${collapsed ? 'lg:px-2' : 'px-4'} space-y-1 overflow-y-auto`}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={onMobileClose}
                className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center lg:px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative`}
                activeProps={{
                  className: 'bg-primary/10 text-primary border-l-4 border-primary rounded-l-none',
                }}
                inactiveProps={{
                  className: 'text-text hover:bg-accent/10 border-l-4 border-transparent',
                }}
                title={collapsed ? item.name : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
                {/* Hide label on desktop when collapsed; always visible on mobile */}
                <span className={collapsed ? 'lg:hidden' : ''}>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer: email + sign out */}
        <div className={`${collapsed ? 'lg:p-2' : 'p-4'} border-t border-border mt-auto`}>
          {!collapsed && (
            <div className="text-sm font-medium text-text mb-4 truncate px-2 lg:block">
              {email ?? 'User'}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={`flex items-center gap-3 ${collapsed ? 'lg:justify-center lg:px-2' : 'px-3'} py-2 rounded-lg text-sm font-medium text-text hover:bg-accent/20 transition-colors w-full`}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}