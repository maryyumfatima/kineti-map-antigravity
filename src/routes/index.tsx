import { createFileRoute, redirect } from '@tanstack/react-router'
import { Homepage } from '../components/marketing/Homepage'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // If the user is authorised, redirect them to the dashboard
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      throw redirect({
        to: '/dashboard',
        replace: true,
      })
    }
  },
  component: Homepage,
})
