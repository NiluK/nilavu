import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function createClient(token?: string | null) {
  const options: any = {}

  if (token) {
    options.global = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    options
  )
}
