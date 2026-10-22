const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
// Run the production TS modules with isolated fake database/chain adapters.
require.extensions['.ts'] = (module,filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}
}).outputText,filename);
const { TronWeb,utils } = require('tronweb');
const policy = require('../src/lib/trc20-sweep-policy.ts');
const { TronSweepChain } = require('../src/lib/trc20-sweep-chain.ts');
const { previewSweep,createSweep,advanceSweep,publicSweep } = require('../src/lib/trc20-sweep.ts');
const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'; // Public BIP-39 test vector only.
process.env.WALLET_MASTER_MNEMONIC=mnemonic;
process.env.CRON_SECRET='unit-test-review-secret';
const member=TronWeb.fromMnemonic(mnemonic,"m/44'/195'/0'/0/3");
const master=TronWeb.fromMnemonic(mnemonic,"m/44'/195'/0'/0/10");
const wallet={id:randomUUID(),user_id:randomUUID(),email:'test@example.invalid',address:member.address,derivation_index:3};
const amount=BigInt(201000000);
function transaction(phase,source,target,value,fee=BigInt(8000000)) {
  const valueFields=phase==='gas'
    ? {owner_address:policy.hexAddress(source),to_address:policy.hexAddress(target),amount:Number(value)}
    : {owner_address:policy.hexAddress(source),contract_address:policy.hexAddress(policy.TRON_USDT),data:policy.transferData(target,value),call_value:0};
  const tx={visible:false,txID:'',raw_data:{contract:[{type:phase==='gas'?'TransferContract':'TriggerSmartContract',parameter:{type_url:'type.googleapis.com/protocol.'+(phase==='gas'?'TransferContract':'TriggerSmartContract'),value:valueFields}}],ref_block_bytes:'0000',ref_block_hash:'0000000000000000',timestamp:Date.now(),expiration:Date.now()+60000,...(phase==='sweep'?{fee_limit:Number(fee)}:{})},raw_data_hex:''};
  const pb=utils.transaction.txJsonToPb(tx);tx.raw_data_hex=utils.transaction.txPbToRawDataHex(pb);tx.txID=utils.transaction.txPbToTxID(pb).replace(/^0x/,'');
  return tx;
}
function transferLog(source=wallet.address,target=master.address,value=amount) {
  return {address:policy.hexAddress(policy.TRON_USDT).slice(2),topics:[policy.TRANSFER_TOPIC,policy.hexAddress(source).slice(2).padStart(64,'0'),policy.hexAddress(target).slice(2).padStart(64,'0')],data:value.toString(16).padStart(64,'0')};
}
class FakeChain extends TronSweepChain {
  gasSigned=0;sweepSigned=0;broadcasts=[];failNext=false;gasSolid=false;sweepSolid=false;
  async trxBalance(address){return {balance:address===master.address?BigInt(200000000):(this.gasSolid?BigInt(10000000):BigInt(0)),activated:true};}
  async tokenBalance(){return amount;}
  async estimate(){return {feeLimit:BigInt(8000000),requiredTrx:BigInt(10000000)};}
  async signGas(source,target,value){this.gasSigned++;return {...transaction('gas',source,target,value),signature:['test-signature']};}
  async signSweep(source,target,value,fee){this.sweepSigned++;return {...transaction('sweep',source,target,value,fee),signature:['test-signature']};}
  async broadcast(tx){this.broadcasts.push(tx.txID);if(this.failNext){this.failNext=false;throw new Error('Simulated lost broadcast response');}}
  async confirmed(txId){
    if(this.gasSolid && txId===this.broadcasts[0])return {id:txId,blockNumber:123,receipt:{}};
    if(this.sweepSolid)return {id:txId,blockNumber:124,receipt:{result:'SUCCESS'},log:[transferLog()]};
    return {};
  }
}
class FakeDb {
  row=null;queries=[];enabled=true;maxFunding='15';
  async query(sql,params=[]){this.queries.push(sql);const rows=[];
    if(sql.includes('SELECT key,value'))return {rows:[['tron_master_hot_wallet',master.address],['tron_master_hot_wallet_private_key',master.privateKey],['tron_energy_reserve_trx','50'],['tron_sweep_gas_fund_trx',this.maxFunding],['tron_sweep_enabled',String(this.enabled)]].map(([key,value])=>({key,value}))};
    if(sql.includes('SELECT w.id,w.user_id'))return {rows:params[0]===wallet.id?[wallet]:[]};
    if(sql.startsWith('SELECT * FROM public.trc20_sweep_requests'))return {rows:this.row && (params[0]===this.row.id || params[0]===this.row.idempotency_key)?[{...this.row}]:[]};
    if(sql.startsWith('INSERT INTO public.trc20_sweep_requests')){
      if(!this.row)this.row={id:randomUUID(),user_id:params[0],source_wallet_id:params[1],source_address:params[2],target_address:params[3],amount:params[4],amount_raw:params[5],idempotency_key:params[6],gas_amount_sun:params[8],fee_limit_sun:params[9],status:'PENDING',gas_funding_tx_hash:null,sweep_tx_hash:null,gas_signed_tx:null,sweep_signed_tx:null,error_message:null,created_at:new Date().toISOString()};
      return {rows:[{id:this.row.id}]};
    }
    if(sql.includes('SET lease_token=$2,lease_until=now()')){
      if(this.row && ['PENDING','GAS_FUNDED','SWEEPING'].includes(this.row.status) && !this.row.lease_token){this.row.lease_token=params[1];return {rows:[{...this.row}]};}return {rows:[]};
    }
    if(sql.includes('SET lease_until=NULL,lease_token=NULL')){this.row.lease_token=null;return {rows:[]};}
    if(sql.startsWith('UPDATE public.trc20_sweep_requests SET ')){
      assert.equal(this.row.lease_token,params[1]);
      if(sql.includes('gas_funding_tx_hash=$4'))Object.assign(this.row,{gas_amount_sun:params[2],gas_funding_tx_hash:params[3],gas_signed_tx:JSON.parse(params[4])});
      if(sql.includes("status='GAS_FUNDED'"))this.row.status='GAS_FUNDED';
      if(sql.includes('gas_amount_sun=0'))this.row.gas_amount_sun='0';
      if(sql.includes("status='SWEEPING'"))Object.assign(this.row,{status:'SWEEPING',sweep_tx_hash:params[2],sweep_signed_tx:JSON.parse(params[3])});
      if(sql.includes("status='COMPLETED'"))Object.assign(this.row,{status:'COMPLETED',gas_signed_tx:null,sweep_signed_tx:null});
      if(sql.includes("status='FAILED'"))this.row.status='FAILED';
      if(sql.includes('error_message=$3'))this.row.error_message=params[2];
      if(sql.includes('error_message=NULL'))this.row.error_message=null;
      rows.push({...this.row});return {rows};
    }
    throw new Error('Unexpected query '+sql);
  }
}
test('amount conversions preserve six-decimal precision and reject malformed values',()=>{
  assert.equal(policy.units('201.000001'),BigInt(201000001));assert.equal(policy.decimal(BigInt(201000001)),'201.000001');
  for(const invalid of ['-1','1e6','1.0000001','NaN'])assert.throws(()=>policy.units(invalid));
});
test('unsigned transaction validation rejects a validly encoded but substituted destination',()=>{
  const intent={phase:'sweep',source:wallet.address,target:master.address,amount,feeLimit:BigInt(8000000)};
  policy.validateUnsigned(transaction('sweep',wallet.address,master.address,amount),intent);
  assert.throws(()=>policy.validateUnsigned(transaction('sweep',wallet.address,wallet.address,amount),intent));
  const tampered=transaction('sweep',wallet.address,master.address,amount);tampered.raw_data_hex+='00';
  assert.throws(()=>policy.validateUnsigned(tampered,intent));
  policy.validateUnsigned(transaction('gas',master.address,wallet.address,BigInt(10000000)),{phase:'gas',source:master.address,target:wallet.address,amount:BigInt(10000000),feeLimit:BigInt(0)});
});
test('only solid receipts with the exact USDT event complete a sweep',()=>{
  const intent={source:wallet.address,target:master.address,amount};
  assert.equal(policy.receiptState({},'abc',intent),'pending');
  assert.equal(policy.receiptState({id:'abc',blockNumber:1,receipt:{result:'SUCCESS'},log:[transferLog()]},'abc',intent),'confirmed');
  assert.equal(policy.receiptState({id:'abc',blockNumber:1,receipt:{result:'SUCCESS'},log:[transferLog(wallet.address,wallet.address)]},'abc',intent),'failed');
  assert.equal(policy.receiptState({id:'abc',blockNumber:1,receipt:{result:'OUT_OF_ENERGY'},log:[]},'abc',intent),'failed');
});
test('preview is read-only and an insufficient funding cap cannot produce an executable quote',async()=>{
  const db=new FakeDb(),chain=new FakeChain();db.maxFunding='1';
  const preview=await previewSweep(db,wallet.id,chain);
  assert.equal(preview.token,null);assert.equal(preview.amount,'201.000000');assert(preview.issues.length);
  assert.equal(chain.gasSigned+chain.sweepSigned+chain.broadcasts.length,0);assert(db.queries.every(q=>q.startsWith('SELECT')));
});
test('lost responses reuse persisted signed transactions; confirmation changes no member balances',async()=>{
  const db=new FakeDb(),chain=new FakeChain();
  const preview=await previewSweep(db,wallet.id,chain),key=randomUUID();
  const input={token:preview.token,idempotencyKey:key,confirmation:'COLLECT TRC20'};
  const id=await createSweep(db,input,randomUUID());assert.equal(await createSweep(db,input,randomUUID()),id);
  chain.failNext=true;await advanceSweep(db,id,chain);
  assert.equal(db.row.status,'PENDING');assert(db.row.gas_signed_tx);assert.equal(chain.gasSigned,1);
  const gas=chain.broadcasts[0];await advanceSweep(db,id,chain);
  assert.equal(chain.broadcasts[1],gas);assert.equal(chain.gasSigned,1);
  chain.gasSolid=true;chain.failNext=true;await advanceSweep(db,id,chain);
  assert.equal(db.row.status,'SWEEPING');assert(db.row.sweep_signed_tx);assert.equal(chain.sweepSigned,1);
  const sweep=chain.broadcasts.at(-1);await advanceSweep(db,id,chain);
  assert.equal(chain.broadcasts.at(-1),sweep);assert.equal(chain.sweepSigned,1);
  chain.sweepSolid=true;const result=await advanceSweep(db,id,chain);assert.equal(result.request.status,'COMPLETED');
  assert.equal(db.row.gas_signed_tx,null);assert.equal(db.row.sweep_signed_tx,null);
  assert(!db.queries.some(q=>/\b(?:UPDATE|INSERT INTO)\s+public\.(?:user_balances|ledger_entries)/i.test(q)));
  assert(!JSON.stringify(publicSweep(db.row)).includes('signature'));
});
test('an occupied lease never broadcasts another transaction',async()=>{
  const db=new FakeDb(),chain=new FakeChain();const preview=await previewSweep(db,wallet.id,chain);
  const id=await createSweep(db,{token:preview.token,idempotencyKey:randomUUID(),confirmation:'COLLECT TRC20'},randomUUID());
  db.row.lease_token=randomUUID();assert.equal((await advanceSweep(db,id,chain)).busy,true);assert.equal(chain.broadcasts.length,0);
});
test('disabled collection rejects execution without signing or creating a request',async()=>{
  const db=new FakeDb(),chain=new FakeChain();const preview=await previewSweep(db,wallet.id,chain);db.enabled=false;
  await assert.rejects(createSweep(db,{token:preview.token,idempotencyKey:randomUUID(),confirmation:'COLLECT TRC20'},randomUUID()));
  assert.equal(db.row,null);assert.equal(chain.broadcasts.length,0);
});
test('legacy USDT simulation is validated by emitted event, even with a zero return word',async()=>{
  class SimulationChain extends TronSweepChain {
    async rpc(method){
      if(method.includes('triggerconstantcontract'))return {result:{result:true},energy_used:65000,constant_result:['0'.repeat(64)],logs:[transferLog()]};
      if(method.includes('getchainparameters'))return {chainParameter:[{key:'getEnergyFee',value:100}]};
      if(method.includes('getaccountresource'))return {};
      throw new Error('Unexpected method');
    }
  }
  const estimate=await new SimulationChain().estimate(wallet.address,master.address,amount);
  assert.equal(estimate.feeLimit,BigInt(8450000));assert.equal(estimate.requiredTrx,BigInt(10450000));
});
