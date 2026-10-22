const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const filename = path.join(__dirname, '../src/lib/member-transfer.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod = new Module(filename,module); mod.filename=filename; mod.paths=module.paths; mod._compile(compiled,filename);
const { parseTransferAmount,parseTransferAddress,findTransferRecipient,executeMemberTransfer } = mod.exports;

test('USDT input is exact to six decimals and rejects rounding/exponents/negative/zero',()=>{
  assert.equal(parseTransferAmount('0.000001'),'0.000001');
  assert.equal(parseTransferAmount('101.1'),'101.100000');
  for(const value of ['0','0.000000','-1','1e2','1.0000001','NaN','01','1000000000000',1,null]) assert.throws(()=>parseTransferAmount(value));
});
test('network validation includes TRON checksum and BSC normalization',()=>{
  assert.equal(parseTransferAddress('TRON','TRXifcU7eKrR8NunRerN6furg9tnscT59z').network,'TRON');
  assert.equal(parseTransferAddress('BSC','0x0000000000000000000000000000000000000001').network,'BSC');
  assert.throws(()=>parseTransferAddress('TRON','TRXifcU7eKrR8NunRerN6furg9tnscT59y'));
  assert.throws(()=>parseTransferAddress('TRON','0x0000000000000000000000000000000000000001'));
  assert.throws(()=>parseTransferAddress('ETH','0x0000000000000000000000000000000000000001'));
});

// Real PostgreSQL integration suite in an isolated disposable schema.
// The caller supplies an authenticated connection factory; no member funds are touched.
async function runDatabaseChecks(connect) {
  const schema = `test_member_transfer_${randomUUID().replaceAll('-','')}`;
  if(!/^test_member_transfer_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe fixture schema');
  const owner = await connect();
  const open = async()=>{
    const c=await connect();
    const query=c.query.bind(c);
    c.query=(sql,values)=>query(typeof sql==='string'?sql.replaceAll('public.',`${schema}.`):sql,values);
    return c;
  };
  const A=randomUUID(),B=randomUUID(),C=randomUUID();
  const bscA='0x0000000000000000000000000000000000000001',bscB='0x0000000000000000000000000000000000000002';
  const tronA='TRXifcU7eKrR8NunRerN6furg9tnscT59z';
  const checks=[];
  try {
    await owner.query(`CREATE SCHEMA ${schema}`);
    await owner.query(`CREATE TABLE ${schema}.users(id uuid PRIMARY KEY,nickname text,status text);
      CREATE TABLE ${schema}.assets(id integer PRIMARY KEY,symbol text UNIQUE);
      CREATE TABLE ${schema}.user_wallets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES ${schema}.users,chain_type text,address text UNIQUE);
      CREATE TABLE ${schema}.user_balances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES ${schema}.users,asset_id integer REFERENCES ${schema}.assets,available_balance numeric NOT NULL CHECK(available_balance>=0),locked_balance numeric,updated_at timestamptz,UNIQUE(user_id,asset_id));
      CREATE TABLE ${schema}.ledger_entries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES ${schema}.users,asset_id integer REFERENCES ${schema}.assets,amount numeric,tx_type text,status text,tx_hash text UNIQUE,details jsonb);`);
    const migration=fs.readFileSync(path.join(__dirname,'../../../supabase/migrations/20261022053037_add_member_usdt_transfers.sql'),'utf8').replaceAll('public.',`${schema}.`);
    await owner.query(migration);
    await owner.query(`INSERT INTO ${schema}.users VALUES ($1,'A','ACTIVE'),($2,'B','PENDING'),($3,'C','ACTIVE')`,[A,B,C]);
    await owner.query(`INSERT INTO ${schema}.assets VALUES (1,'USDT')`);
    await owner.query(`INSERT INTO ${schema}.user_wallets(user_id,chain_type,address) VALUES ($1,'BSC',$3),($2,'BSC',$4),($1,'TRON',$5)`,[A,B,bscA,bscB,tronA]);
    const reset=async()=>{
      await owner.query(`TRUNCATE ${schema}.member_usdt_transfers,${schema}.ledger_entries,${schema}.user_balances`);
      await owner.query(`INSERT INTO ${schema}.user_balances(user_id,asset_id,available_balance,locked_balance) VALUES ($1,1,100,0),($2,1,100,0)`,[A,B]);
    };
    const execute=async(input)=>{const c=await open();try{return await executeMemberTransfer(c,input);}finally{await c.end();}};
    const input=(overrides={})=>({senderId:A,recipientId:B,network:'BSC',address:bscB,requestId:randomUUID(),amount:'1.000000',...overrides});
    const balance=async(id)=>(await owner.query(`SELECT available_balance::text AS amount FROM ${schema}.user_balances WHERE user_id=$1`,[id])).rows[0]?.amount;
    await reset();
    const preview=await open();
    try {
      assert.equal((await findTransferRecipient(preview,B,'TRON',tronA)).id,A);
      await assert.rejects(findTransferRecipient(preview,A,'TRON',tronA),{code:'SELF_TRANSFER'});
      await assert.rejects(findTransferRecipient(preview,A,'BSC','0x0000000000000000000000000000000000000003'),{code:'RECIPIENT_NOT_FOUND'});
    } finally {await preview.end();}
    checks.push('BSC/TRON recipient lookup, unknown and self rejection');
    await execute(input({amount:'0.000001'}));
    assert.equal(await balance(A),'99.999999'); assert.equal(await balance(B),'100.000001');
    assert.equal((await owner.query(`SELECT sum(amount)::text AS total FROM ${schema}.ledger_entries`)).rows[0].total,'0.000000');
    checks.push('exact 0.000001 transfer with balanced paired ledger');
    await reset();
    const same=input();
    const retries=await Promise.all(Array.from({length:5},()=>execute(same)));
    assert.equal(new Set(retries.map(r=>r.id)).size,1); assert.equal(retries.filter(r=>!r.duplicate).length,1);
    assert.equal(Number(await balance(A)),99);assert.equal(Number(await balance(B)),101);
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${schema}.ledger_entries`)).rows[0].n,2);
    await assert.rejects(execute({...same,amount:'2.000000'}),{code:'REQUEST_CONFLICT'});
    checks.push('5 concurrent identical requests debit once; changed payload rejected');
    await reset();
    const concurrent=await Promise.allSettled([execute(input({amount:'80.000000'})),execute(input({amount:'80.000000'}))]);
    assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
    assert.equal(Number(await balance(A)),20); assert.equal(Number(await balance(B)),180);
    checks.push('concurrent overspending prevented');
    await reset();
    await Promise.all([execute(input()),execute(input({senderId:B,recipientId:A,network:'TRON',address:tronA}))]);
    assert.equal(Number(await balance(A)),100); assert.equal(Number(await balance(B)),100);
    checks.push('opposite direction BSC/TRON sends avoid deadlock and conserve balance');
    await reset();
    await assert.rejects(execute(input({recipientId:C})),{code:'RECIPIENT_CHANGED'});
    await assert.rejects(execute(input({amount:'101.000000'})),{code:'INSUFFICIENT_BALANCE'});
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${schema}.member_usdt_transfers`)).rows[0].n,0);
    assert.equal(Number(await balance(A)),100);
    checks.push('failed requests roll back transfer record and all balances');
    // Force the second ledger write to fail after both balance updates and first ledger write.
    await owner.query(`ALTER TABLE ${schema}.ledger_entries ADD CONSTRAINT test_fail_credit CHECK(tx_type<>'TRANSFER_IN')`);
    await assert.rejects(execute(input()));
    assert.equal(Number(await balance(A)),100); assert.equal(Number(await balance(B)),100);
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM ${schema}.ledger_entries`)).rows[0].n,0);
    checks.push('injected credit-ledger failure rolls back debit, credit and first ledger');
    const access=(await owner.query(`SELECT relrowsecurity AS rls,has_table_privilege('anon',$1,'SELECT') AS anon,has_table_privilege('authenticated',$1,'INSERT') AS member_write FROM pg_class WHERE oid=$1::regclass`,[`${schema}.member_usdt_transfers`])).rows[0];
    assert.equal(access.rls,true);assert.equal(access.anon,false);assert.equal(access.member_write,false);
    checks.push('RLS enabled; anon/authenticated cannot access server-only transfer records');
    return checks;
  } finally {
    await owner.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await owner.end();
  }
}
module.exports={runDatabaseChecks};

test('PostgreSQL atomicity, idempotency, concurrent spending and permissions', {
  skip: !process.env.MEMBER_TRANSFER_TEST_DATABASE_URL,
}, async()=>{
  const {Client}=require('pg');
  const checks=await runDatabaseChecks(async()=>{
    const client=new Client({connectionString:process.env.MEMBER_TRANSFER_TEST_DATABASE_URL});
    await client.connect();return client;
  });
  assert.equal(checks.length,8);
});
