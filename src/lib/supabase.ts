import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

// Lazy singleton — the same reason as env.ts: don't touch env at import time.
let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

// Backwards-compatible export — a Proxy that defers to getSupabase() on first access.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
