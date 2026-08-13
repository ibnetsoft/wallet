import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function createSafeClient(url: string, key: string, options?: object) {
  const shouldUseMock =
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_MOCK_SUPABASE === "true";

  if (shouldUseMock && (!url || !key || key.includes("YOUR_SUPABASE_ANON_KEY") || url.includes("placeholder"))) {
    console.warn("Using Mock Supabase Client in Admin App");

    const mockData: Record<string, unknown[]> = {
      profiles: [
        { id: "u-1", email: "user@urc369.com", nickname: "User (??", referral_code: "URC883920", created_at: "2026-07-21T00:00:00Z", usdt_balance: 10500.0, status: "ACTIVE" },
        { id: "u-2", email: "b_kim@urc369.com", nickname: "User B", referral_code: "URC110293", created_at: "2026-07-21T00:00:00Z", usdt_balance: 0.0, status: "PENDING" },
        { id: "u-3", email: "yh_park@urc369.com", nickname: "User E", referral_code: "URC992011", created_at: "2026-07-20T00:00:00Z", usdt_balance: 0.0, status: "PENDING" }
      ],
      system_settings: [
        { id: "1", key: "daily_rate", value: "1.2", description: "?쇱씪 ?섏씡瑜?(%)" },
        { id: "2", key: "min_withdraw", value: "30.00", description: "理쒖냼 異쒓툑 媛??湲덉븸 (USDT)" },
        { id: "3", key: "withdrawal_fee_rate", value: "3", description: "異쒓툑 ?섏닔猷?(%)" }
      ],
      ledger_entries: [
        { id: "w-1001", user_id: "u-2", users: { email: "b_kim@urc369.com" }, amount: 30.0, fee: 0.9, asset: "USDT", tx_hash: "", status: "PENDING", created_at: "2026-07-27T12:30:00Z" }
      ],
      users: [
        {
          id: "u-1",
          email: "user@urc369.com",
          nickname: "User (??",
          status: "ACTIVE",
          user_wallets: [{ address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" }],
          user_balances: [
            { asset_id: 1, available_balance: "100.00" },
            { asset_id: 2, available_balance: "10500.00" }
          ]
        },
        {
          id: "u-2",
          email: "b_kim@urc369.com",
          nickname: "User B",
          status: "PENDING",
          user_wallets: [{ address: "0x2546BcD3c84621e9b3d7d1225015b6024f2b23a9" }],
          user_balances: [
            { asset_id: 2, available_balance: "3500.00" }
          ]
        }
      ],
      vault_transfers: [],
      sweep_requests: []
    };

    const mockClient = {
      from: (table: string) => {
        const data = mockData[table] ?? [];

        return {
          select: () => {
            const chain = {
              order: () => chain,
              eq: (col: string, val: unknown) => {
                const filtered = data.filter((item) => {
                  if (!item || typeof item !== "object") {
                    return false;
                  }
                  return (item as Record<string, unknown>)[col] === val;
                });

                return {
                  single: () => Promise.resolve({ data: filtered[0] ?? null, error: null }),
                  then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
                    resolve({ data: filtered, error: null })
                };
              },
              limit: () => chain,
              single: () => Promise.resolve({ data: data[0] ?? null, error: null }),
              then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
                resolve({ data, error: null })
            };

            return chain;
          },
          insert: (newData: unknown) => {
            const arr = Array.isArray(newData) ? newData : [newData];
            data.push(...arr);
            return Promise.resolve({ data, error: null });
          },
          update: (updateData: unknown) => ({
            eq: (col: string, val: unknown) => {
              data.forEach((item) => {
                if (item && typeof item === "object" && (item as Record<string, unknown>)[col] === val) {
                  Object.assign(item as Record<string, unknown>, updateData);
                }
              });
              return Promise.resolve({ data, error: null });
            }
          })
        };
      },
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        getUser: () => Promise.resolve({ data: { user: null }, error: null })
      }
    };

    return mockClient as unknown as ReturnType<typeof createClient>;
  }

  if (!url || !key) {
    return createClient("https://placeholder.supabase.co", "placeholder-key", options);
  }

  return createClient(url, key, options);
}

export const supabase = createSafeClient(supabaseUrl, supabaseAnonKey);
export const supabaseAdmin = createSafeClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
