import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseKey.includes("YOUR_SUPABASE_ANON_KEY") || supabaseUrl.includes("placeholder-project")) {
    const mockSession = cookieStore.get("sb-mock-session")?.value;
    const mockClient = {
      auth: {
        getSession: async () => {
          if (mockSession) {
            return {
              data: {
                session: {
                  access_token: "mock-token",
                  user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: mockSession }
                }
              },
              error: null
            };
          }
          return { data: { session: null }, error: null };
        },
        getUser: async () => {
          if (mockSession) {
            return { data: { user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: mockSession } }, error: null };
          }
          return { data: { user: null }, error: null };
        }
      }
    };
    return mockClient as any;
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    }
  );
}
