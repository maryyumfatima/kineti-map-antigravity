import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { Homepage } from '../components/marketing/Homepage'

export const Route = createFileRoute('/')({
  component: Homepage,
})
