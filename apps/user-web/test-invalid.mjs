import { createClient } from "@supabase/supabase-js";

const supabase = createClient("https://dgjpbnwsbbwuintptkkg.supabase.co", "INVALID_KEY_TEST");

async function testAuth() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: "test@sys.hongbou.com",
    password: "password",
  });
  console.log("Auth Error:", JSON.stringify(error));
}
testAuth();
