import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration
// NOTE: Replace SUPABASE_ANON_KEY with your actual anon/public key from Supabase dashboard
const SUPABASE_URL = 'https://apschbgavppsbjxieuql.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('Supabase not configured - running in offline mode');
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseInstance;
}

export const supabase = getSupabase();
export { SUPABASE_URL };
