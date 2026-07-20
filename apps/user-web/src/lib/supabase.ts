import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Guard: 빌드 타임에 env 없어도 런타임에만 실제 호출되면 정상 동작
function createSafeClient(url: string, key: string, options?: object): SupabaseClient {
  if (!url || !key) {
    // 빌드/정적 분석 시 더미 클라이언트 반환 (실제 호출은 런타임에만 발생)
    return createClient(
      "https://placeholder.supabase.co",
      "placeholder-key",
      options
    );
  }
  return createClient(url, key, options);
}

// Public client (프론트엔드 / RLS 적용)
export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey);

// Admin client (API Routes / RLS 우회)
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
