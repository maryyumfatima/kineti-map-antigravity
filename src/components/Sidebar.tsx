import { Link, useRouter } from '@tanstack/react-router'
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
  LogOut
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const navItems = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/patients', icon: Users },
  { name: 'Sessions', path: '/sessions', icon: Calendar },
  { name: 'Availability', path: '/availability', icon: Clock },
  { name: 'Feedback', path: '/feedback', icon: Star },
  { name: 'Revenue', path: '/revenue', icon: DollarSign },
  { name: 'Branding', path: '/branding', icon: Palette },
  { name: 'Billing', path: '/billing', icon: CreditCard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export function Sidebar() {
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
    router.navigate({ to: '/login' })
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[240px] bg-background border-r border-border flex flex-col z-10">
      <div className="p-6">
        <h2 className="text-primary font-bricolage text-[22px] font-bold">KinetiMap</h2>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          // Note: using an explicit activeProps object to match requested styling
          return (
            <Link
              key={item.name}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              activeProps={{
                className: 'bg-primary text-white',
              }}
              inactiveProps={{
                className: 'text-text hover:bg-accent/20',
              }}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-border mt-auto">
        <div className="text-sm font-medium text-text mb-4 truncate px-2">
          {email ?? "User"}
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text hover:bg-accent/20 transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
