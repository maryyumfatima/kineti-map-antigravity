import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '../components/DashboardLayout'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

const stats = [
  { title: "Today's Sessions", value: "0" },
  { title: "Active Patients", value: "0" },
  { title: "Avg Feedback Score", value: "0" },
  { title: "Unpaid Sessions", value: "0" },
]

function Dashboard() {
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-primary font-bricolage mb-8">Dashboard Overview</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-card rounded-xl p-6 border border-border flex flex-col">
              <span className="text-[40px] font-bold text-primary font-bricolage mb-2 leading-none">
                {stat.value}
              </span>
              <span className="text-text font-medium text-sm">
                {stat.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
