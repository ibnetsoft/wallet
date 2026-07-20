import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function createSafeClient(url: string, key: string, options?: object): SupabaseClient {
  if (!url || !key) {
    return createClient("https://placeholder.supabase.co", "placeholder-key", options);
  }
  return createClient(url, key, options);
}

// Standard client
export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey);

// Admin client to bypass RLS for administrative actions (e.g. approving withdrawals)
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
