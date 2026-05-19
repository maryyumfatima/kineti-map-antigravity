import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://nxohcxzoudwccernofax.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b2hjeHpvdWR3Y2Nlcm5vZmF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2ODE4MDQsImV4cCI6MjA5MjI1NzgwNH0.dqSWJjnofDMDhyWzCXlPfUUyBwG-N9SoxRDiLaIIGVY'
)

async function main() {
  const { data, error } = await supabase.from('clinics').select('*').limit(1)
  if (error) {
    console.error('Error fetching clinics:', error)
  } else {
    console.log('Clinics data:', data)
  }
}

main()
