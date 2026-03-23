import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pshspnvomfkxhrymetyf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzaHNwbnZvbWZreGhyeW1ldHlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxODI5MTQsImV4cCI6MjA4OTc1ODkxNH0.aPEFkO-vyJqPOc0G1EFJN2gYv0jkkyFHhspJrsyogu8'

export const createClient = () => {
  return supabaseCreateClient(supabaseUrl, supabaseKey)
}