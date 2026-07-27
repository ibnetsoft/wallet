import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function createSafeClient(url: string, key: string, options?: any) {
  if (!url || !key || key.includes("YOUR_SUPABASE_ANON_KEY") || url.includes("placeholder")) {
    console.warn("Using Mock Supabase Client in Admin App");
    
    const mockData: Record<string, any[]> = {
      profiles: [
        { id: "u-1", email: "user@urc369.com", nickname: "User (나)", referral_code: "URC883920", created_at: "2026-07-21T00:00:00Z", usdt_balance: 10500.00, status: "ACTIVE" },
        { id: "u-2", email: "b_kim@urc369.com", nickname: "User B", referral_code: "URC110293", created_at: "2026-07-21T00:00:00Z", usdt_balance: 0.00, status: "PENDING" },
        { id: "u-3", email: "yh_park@urc369.com", nickname: "User E", referral_code: "URC992011", created_at: "2026-07-20T00:00:00Z", usdt_balance: 0.00, status: "PENDING" }
      ],
      system_settings: [
        { id: "1", key: "daily_rate", value: "1.2", description: "일일 수익률 (%)" },
        { id: "2", key: "min_withdraw", value: "10.00", description: "최소 출금 가능 금액 (USDT)" },
        { id: "3", key: "withdrawal_fee_rate", value: "3", description: "출금 수수료 (%)" }
      ],
      ledger_entries: [
        { id: "w-1001", user_id: "u-2", users: { email: "b_kim@urc369.com" }, amount: 30.00, fee: 0.90, asset: "USDT", tx_hash: "", status: "PENDING", created_at: "2026-07-27T12:30:00Z" }
      ],
      users: [
        { id: "u-1", email: "user@urc369.com", nickname: "User (나)", status: "ACTIVE" }
      ],
      vault_transfers: [],
      sweep_requests: []
    };

    const mockClient = {
      from: (table: string) => {
        const data = mockData[table] || [];
        return {
          select: (columns: string = "*") => {
            return {
              order: (col: string, opt: any) => {
                return Promise.resolve({ data, error: null });
              },
              eq: (col: string, val: any) => {
                const filtered = data.filter(item => item[col] === val);
                return {
                  single: () => Promise.resolve({ data: filtered[0] || null, error: null }),
                  then: (resolve: any) => resolve({ data: filtered, error: null })
                };
              },
              then: (resolve: any) => resolve({ data, error: null })
            };
          },
          insert: (newData: any) => {
            const arr = Array.isArray(newData) ? newData : [newData];
            data.push(...arr);
            return Promise.resolve({ data, error: null });
          },
          update: (updateData: any) => {
            return {
              eq: (col: string, val: any) => {
                data.forEach(item => {
                  if (item[col] === val) {
                    Object.assign(item, updateData);
                  }
                });
                return Promise.resolve({ data, error: null });
              }
            };
          }
        };
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null })
      }
    };
    return mockClient as any;
  }
  return createClient(url, key, options);
}

export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
