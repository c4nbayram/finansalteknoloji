import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anon)

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL veya VITE_SUPABASE_ANON_KEY eksik - Supabase devre dışı.',
  )
}

export const supabase: SupabaseClient = createClient(url ?? 'http://localhost', anon ?? 'public-anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const BUCKET_PROFILE = 'profile-photos'
export const BUCKET_COVERS = 'blog-covers'

