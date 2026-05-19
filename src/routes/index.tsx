import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { Homepage } from '../components/marketing/Homepage'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // If the user has a valid active session, redirect to the clinical dashboard.
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({
        to: '/dashboard',
      })
    }
  },
  component: Homepage,
})
