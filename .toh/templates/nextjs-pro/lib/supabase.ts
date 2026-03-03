import { createClient } from '@supabase/supabase-js'

// ==========================================
// Supabase Client Configuration
// ==========================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Supabase client for browser use
 * Uses the anon key which respects RLS policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ==========================================
// Type-safe Database Types
// ==========================================

// Generate types with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
// Then import and use: Database['public']['Tables']['products']['Row']

/**
 * Example of typed Supabase query:
 * 
 * const { data, error } = await supabase
 *   .from('products')
 *   .select('*')
 *   .order('created_at', { ascending: false })
 * 
 * // data is typed as Product[] if you've set up the Database type
 */

// ==========================================
// Auth Helpers
// ==========================================

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ==========================================
// Real-time Subscriptions
// ==========================================

/**
 * Subscribe to table changes
 * 
 * Example usage:
 * const unsubscribe = subscribeToTable('products', (payload) => {
 *   console.log('Change received!', payload)
 * })
 * 
 * // Later: unsubscribe()
 */
export function subscribeToTable(
  table: string,
  callback: (payload: unknown) => void
) {
  const channel = supabase
    .channel(`${table}_changes`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      callback
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
