const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.dgjpbnwsbbwuintptkkg:DldydghUSEBAY@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function test() {
  await client.connect();
  try {
    const res = await client.query("INSERT INTO public.users (id, email, nickname, status) VALUES ('d0199e71-8b9a-41d3-a5f1-3ec7b2a6f23b', 'my@email.com', 'test_dummy123', 'PENDING')");
    console.log("Success:", res.rowCount);
  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await client.end();
  }
}
test();
