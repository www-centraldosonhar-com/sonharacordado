import { createClient } from '@supabase/supabase-js'

// =========================================================
// SUPABASE BROWSER CLIENT
// =========================================================
// The client is created only when a feature actually needs
// Supabase. Missing configuration must never prevent the
// whole Central from opening.
// =========================================================

let supabaseClient = null

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient
  }

  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL

  const supabasePublishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (
    !supabaseUrl ||
    !supabasePublishableKey
  ) {
    throw new Error(
      'Supabase não está configurado para uploads neste ambiente.'
    )
  }

  supabaseClient =
    createClient(
      supabaseUrl,
      supabasePublishableKey
    )

  return supabaseClient
}
