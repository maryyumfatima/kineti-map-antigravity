import { Sidebar } from './Sidebar'
import { Toaster } from 'sonner'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" richColors />
      <Sidebar />
      <main className="ml-[240px] p-8">
        {children}
      </main>
    </div>
  )
}
