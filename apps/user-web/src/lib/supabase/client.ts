import { createBrowserClient } from "@supabase/ssr";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey || supabaseKey.includes("YOUR_SUPABASE_ANON_KEY") || supabaseUrl.includes("placeholder-project")) {
    console.warn("Using Mock Supabase Client for local development");
    const mockClient = {
      auth: {
        signInWithPassword: async ({ email, password }: { email: string; password?: string }) => {
          console.log("Mock signing in:", email);
          if (typeof window !== "undefined") {
            localStorage.setItem("mock_user_email", email);
            document.cookie = `sb-mock-session=${email}; path=/; max-age=3600`;
          }
          return {
            data: {
              user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: email },
              session: { access_token: "mock-token", user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: email } }
            },
            error: null
          };
        },
        getSession: async () => {
          let email = null;
          let metadata = {};
          if (typeof window !== "undefined") {
            email = localStorage.getItem("mock_user_email");
            try {
              metadata = JSON.parse(localStorage.getItem("mock_user_metadata") || "{}");
            } catch (e) {}
          }
          if (email) {
            return {
              data: {
                session: {
                  access_token: "mock-token",
                  user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: email, user_metadata: metadata }
                }
              },
              error: null
            };
          }
          return { data: { session: null }, error: null };
        },
        getUser: async () => {
          let email = null;
          let metadata = {};
          if (typeof window !== "undefined") {
            email = localStorage.getItem("mock_user_email");
            try {
              metadata = JSON.parse(localStorage.getItem("mock_user_metadata") || "{}");
            } catch (e) {}
          }
          if (email) {
            return { data: { user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", email: email, user_metadata: metadata } }, error: null };
          }
          return { data: { user: null }, error: null };
        },
        updateUser: async ({ data }: { data: any }) => {
          console.log("Mock updating user:", data);
          let metadata = {};
          if (typeof window !== "undefined") {
            try {
              metadata = JSON.parse(localStorage.getItem("mock_user_metadata") || "{}");
            } catch (e) {}
            const newMeta = { ...metadata, ...data };
            localStorage.setItem("mock_user_metadata", JSON.stringify(newMeta));
            metadata = newMeta;
          }
          return { data: { user: { id: "f0e5d88f-3496-4415-8933-4a7359ba6232", user_metadata: metadata } }, error: null };
        },
        signOut: async () => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("mock_user_email");
            document.cookie = "sb-mock-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
          }
          return { error: null };
        },
        onAuthStateChange: (callback: any) => {
          return { data: { subscription: { unsubscribe: () => {} } } };
        }
      }
    };
    return mockClient as any;
  }

  // A single client owns the browser auth cookie. Creating one client per
  // component can race session persistence immediately after sign-in.
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseKey);
  }

  return browserClient;
}

export const supabase = createClient();
