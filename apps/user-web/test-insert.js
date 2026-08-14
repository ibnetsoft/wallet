import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log("Missing env variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const userId = "d0199e71-8b9a-41d3-a5f1-3ec7b2a6f23b"; // dummy uuid
  const { data, error } = await supabase
    .from("users")
    .insert({
      id: userId,
      email: "test@example.com",
      nickname: "testnickname123",
      recommender_id: null,
      parent_id: null,
      status: "PENDING",
    });

  console.log("Insert Error:", error);
}

testInsert();
