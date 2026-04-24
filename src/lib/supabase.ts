import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nxohcxzoudwccernofax.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b2hjeHpvdWR3Y2Nlcm5vZmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODE4MDQsImV4cCI6MjA5MjI1NzgwNH0.dqSWJjnofDMDhyWzCXlPfUUyBwG-N9SoxRDiLaIIGVY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
