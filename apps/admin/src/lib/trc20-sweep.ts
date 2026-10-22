import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { TronWeb, type Types } from "tronweb";
import { TronSweepChain } from "./trc20-sweep-chain";
import { decimal, units, MAX_GAS_SUN, receiptState } from "./trc20-sweep-policy";
import { scanFundedTronWallets, type SweepWallet } from "./trc20-sweep-balances";

export const sweepPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
type Config = { target: string; key: string; enabled: boolean; reserve: bigint; maxFunding: bigint; issues: string[] };
type Wallet = { id: string; user_id: string; address: string; derivation_index: number; email: string };
type Quote = { walletId: string; source: string; target: string; raw: string; funding: string; feeLimit: string; expires: number };
type SweepRow = {
  id: string; source_wallet_id: string; user_id: string; source_address: string; target_address: string;
  amount: string; amount_raw: string; gas_amount_sun: string; fee_limit_sun: string; status: string;
  gas_funding_tx_hash: string | null; sweep_tx_hash: string | null;
  gas_signed_tx: Types.SignedTransaction | null; sweep_signed_tx: Types.SignedTransaction | null;
  error_message: string | null; created_at: string;
};
export class SweepError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const ACTIVE = ['PENDING', 'GAS_FUNDED', 'SWEEPING'];

async function configuration(client: PoolClient): Promise<Config> {
  const rows = await client.query<{ key: string; value: string }>(
    "SELECT key,value FROM public.system_settings WHERE key=ANY($1::text[])",
    [['tron_master_hot_wallet','tron_master_hot_wallet_private_key','tron_energy_reserve_trx','tron_sweep_gas_fund_trx','tron_sweep_enabled']]);
  const values = new Map(rows.rows.map(r => [r.key,r.value]));
  const target = values.get('tron_master_hot_wallet')?.trim() ?? '';
  const key = (values.get('tron_master_hot_wallet_private_key') || process.env.TRON_MASTER_HOT_WALLET_PRIVATE_KEY || '').trim().replace(/^0x/, '');
  const issues: string[] = [];
  if (!TronWeb.isAddress(target)) issues.push('시스템 설정에서 TRON 회사 지갑을 등록하세요.');
  try { if (!/^[0-9a-f]{64}$/i.test(key) || TronWeb.address.fromPrivateKey(key) !== target) issues.push('TRON 회사 지갑 주소와 서명키가 일치하지 않습니다.'); }
  catch { issues.push('TRON 회사 지갑 서명키를 확인하세요.'); }
  if (!process.env.WALLET_MASTER_MNEMONIC) issues.push('회원 지갑 서명에 필요한 서버 니모닉이 없습니다.');
  if (!process.env.CRON_SECRET) issues.push('서버의 검토 인증 설정(CRON_SECRET)이 필요합니다.');
  let reserve = BigInt("0"), maxFunding = BigInt("0");
  try {
    reserve = units(values.get('tron_energy_reserve_trx') || '50');
    maxFunding = units(values.get('tron_sweep_gas_fund_trx') || '15');
    if (maxFunding <= BigInt("0") || maxFunding > MAX_GAS_SUN || reserve < BigInt("1000000")) throw new Error();
  } catch { issues.push('TRX 대납 한도(0 초과~100 TRX)와 회사 지갑 최소 잔액(1 TRX 이상)을 확인하세요.'); }
  return { target, key, enabled: values.get('tron_sweep_enabled') === 'true', reserve, maxFunding, issues };
}
async function memberWallet(client: PoolClient, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SweepError('회원 지갑을 선택하세요.');
  const row = (await client.query<Wallet>(`SELECT w.id,w.user_id,w.address,w.derivation_index,u.email
    FROM public.user_wallets w JOIN public.users u ON u.id=w.user_id WHERE w.id=$1 AND w.chain_type='TRON'`,[id])).rows[0];
  if (!row) throw new SweepError('등록된 TRON 회원 지갑을 찾지 못했습니다.',404);
  return row;
}
function memberKey(wallet: Wallet) {
  const mnemonic = process.env.WALLET_MASTER_MNEMONIC;
  if (!mnemonic || !Number.isSafeInteger(wallet.derivation_index) || wallet.derivation_index < 0) throw new SweepError('회원 지갑 서명 설정이 올바르지 않습니다.');
  const account = TronWeb.fromMnemonic(mnemonic, `m/44'/195'/0'/0/${wallet.derivation_index}`);
  if (account.address !== wallet.address) throw new SweepError('회원 주소가 서버 니모닉에서 파생된 주소와 다릅니다. 이 지갑은 전송하지 않습니다.');
  return account.privateKey.replace(/^0x/, '');
}
function ready(config: Config, execute = false) {
  if (config.issues.length) throw new SweepError(config.issues.join(' '),503);
  if (execute && !config.enabled) throw new SweepError('TRC20 모으기를 활성화한 뒤 실행하세요.',409);
}
function signedQuote(quote: Quote) {
  const data = Buffer.from(JSON.stringify(quote)).toString('base64url');
  const sig = createHmac('sha256',process.env.CRON_SECRET!).update('trc20-sweep-review:'+data).digest('hex');
  return `${data}.${sig}`;
}
function readQuote(token: string): Quote {
  if (typeof token !== 'string' || token.length > 3000 || !process.env.CRON_SECRET) throw new SweepError('검토를 다시 진행하세요.');
  const [data,sig] = token.split('.');
  const expected = createHmac('sha256',process.env.CRON_SECRET).update('trc20-sweep-review:'+data).digest('hex');
  if (!sig || sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig),Buffer.from(expected))) throw new SweepError('검토 인증이 올바르지 않습니다.');
  const value: Quote = JSON.parse(Buffer.from(data,'base64url').toString());
  if (value.expires <= Date.now()) throw new SweepError('검토 후 5분이 지났습니다. 잔액을 다시 조회하세요.');
  return value;
}
export function publicSweep(row: SweepRow) {
  return { id: row.id, source: row.source_address, target: row.target_address, amount: row.amount,
    gasTrx: decimal(BigInt(row.gas_amount_sun)), status: row.status, gasTx: row.gas_funding_tx_hash,
    sweepTx: row.sweep_tx_hash, message: row.error_message, createdAt: row.created_at };
}

export async function sweepDashboard(client: PoolClient) {
  const config = await configuration(client);
  const wallets = (await client.query(`SELECT w.id,w.address,w.user_id,u.email,u.nickname
    FROM public.user_wallets w JOIN public.users u ON u.id=w.user_id
    WHERE w.chain_type='TRON' ORDER BY u.created_at,w.id`)).rows;
  const requests = (await client.query<SweepRow>(`SELECT id,source_address,target_address,amount,gas_amount_sun,status,
    gas_funding_tx_hash,sweep_tx_hash,error_message,created_at FROM public.trc20_sweep_requests ORDER BY created_at DESC LIMIT 30`)).rows;
  return { wallets, requests: requests.map(publicSweep), settings: {
    target: config.target, enabled: config.enabled, reserveTrx: decimal(config.reserve), maxFundingTrx: decimal(config.maxFunding), issues: config.issues } };
}
export async function sweepBalances(client: PoolClient, chain = new TronSweepChain()) {
  const config = await configuration(client);
  const wallets = (await client.query<SweepWallet>(`SELECT w.id,w.address,u.email,u.nickname
    FROM public.user_wallets w JOIN public.users u ON u.id=w.user_id
    WHERE w.chain_type='TRON' AND w.address<>$1 ORDER BY u.created_at,w.id`,[config.target])).rows;
  return scanFundedTronWallets(wallets,chain);
}
export async function previewSweep(client: PoolClient, walletId: string, chain = new TronSweepChain()) {
  const config = await configuration(client); ready(config);
  const wallet = await memberWallet(client,walletId); memberKey(wallet);
  if (wallet.address === config.target) throw new SweepError('회원 주소와 회사 지갑 주소가 같습니다.');
  const master = await chain.trxBalance(config.target);
  if (!master.activated) throw new SweepError('TRON 회사 지갑을 먼저 활성화하세요.');
  const amount = await chain.tokenBalance(wallet.address);
  if (amount <= BigInt("0")) throw new SweepError('이 회원 주소에 모을 수 있는 온체인 USDT가 없습니다.');
  const source = await chain.trxBalance(wallet.address);
  const estimate = await chain.estimate(wallet.address,config.target,amount);
  if (estimate.feeLimit <= BigInt("0") || estimate.feeLimit > MAX_GAS_SUN) throw new SweepError('예상 에너지 비용이 100 TRX 한도를 초과합니다.');
  const funding = estimate.requiredTrx > source.balance ? estimate.requiredTrx-source.balance : BigInt("0");
  const issues: string[] = [];
  if (funding > config.maxFunding) issues.push(`필요 TRX 대납 ${decimal(funding)}가 설정 한도 ${decimal(config.maxFunding)}를 초과합니다.`);
  if (funding > BigInt(0) && master.balance < funding + config.reserve + BigInt("2000000")) issues.push('회사 지갑의 TRX가 대납액·최소 보유량·전송 수수료를 충당하지 못합니다.');
  const quote: Quote = { walletId,source:wallet.address,target:config.target,raw:amount.toString(),funding:funding.toString(),feeLimit:estimate.feeLimit.toString(),expires:Date.now()+300_000 };
  return { source:wallet.address,target:config.target,amount:decimal(amount),sourceTrx:decimal(source.balance),masterTrx:decimal(master.balance),
    maxGasTrx:decimal(funding),feeLimitTrx:decimal(estimate.feeLimit),issues,enabled:config.enabled,
    token: issues.length ? null : signedQuote(quote) };
}

export async function createSweep(client: PoolClient, input: { token: string; idempotencyKey: string; confirmation: string }, adminId: string) {
  if (input.confirmation !== 'COLLECT TRC20' || !/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey ?? '')) throw new SweepError('수량과 수신 주소를 확인하고 모으기를 승인하세요.');
  const existing = (await client.query<SweepRow>('SELECT * FROM public.trc20_sweep_requests WHERE idempotency_key=$1',[input.idempotencyKey])).rows[0];
  if (existing) return existing.id;
  const quote = readQuote(input.token);
  const config = await configuration(client); ready(config,true);
  const wallet = await memberWallet(client,quote.walletId); memberKey(wallet);
  if (wallet.address !== quote.source || config.target !== quote.target || BigInt(quote.funding) > config.maxFunding) throw new SweepError('지갑 또는 한도 설정이 바뀌었습니다. 다시 검토하세요.',409);
  try {
    const result = await client.query<{ id: string }>(`INSERT INTO public.trc20_sweep_requests
      (user_id,source_wallet_id,source_address,target_address,amount,amount_raw,status,idempotency_key,requested_by,gas_amount_sun,fee_limit_sun)
      VALUES($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,$10)
      ON CONFLICT(idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key RETURNING id`,
    [wallet.user_id,wallet.id,wallet.address,config.target,decimal(BigInt(quote.raw)),quote.raw,input.idempotencyKey,adminId,quote.funding,quote.feeLimit]);
    return result.rows[0].id;
  } catch (error) {
    if ((error as {code?:string}).code === '23505') throw new SweepError('진행 중인 TRC20 요청이 있습니다. 새 요청 대신 기존 요청을 계속 진행하세요.',409);
    throw error;
  }
}

export async function advanceSweep(client: PoolClient, id: string, chain = new TronSweepChain()) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new SweepError('올바른 요청을 선택하세요.');
  const token = randomUUID();
  const claimed = await client.query<SweepRow>(`UPDATE public.trc20_sweep_requests SET lease_token=$2,lease_until=now()+interval '90 seconds',updated_at=now()
    WHERE id=$1 AND status=ANY($3::text[]) AND (lease_until IS NULL OR lease_until<now()) RETURNING *`,[id,token,ACTIVE]);
  let row = claimed.rows[0];
  if (!row) {
    row = (await client.query<SweepRow>('SELECT * FROM public.trc20_sweep_requests WHERE id=$1',[id])).rows[0];
    if (!row) throw new SweepError('요청을 찾지 못했습니다.',404);
    return { request: publicSweep(row), busy: ACTIVE.includes(row.status) };
  }
  const update = async (sql: string, params: unknown[] = []) => {
    const result = await client.query<SweepRow>(`UPDATE public.trc20_sweep_requests SET ${sql},updated_at=now() WHERE id=$1 AND lease_token=$2 RETURNING *`,[id,token,...params]);
    if (!result.rows[0]) throw new SweepError('요청 처리 잠금이 변경됐습니다. 상태를 다시 확인하세요.',409);
    row = result.rows[0];
  };
  try {
    const config = await configuration(client); ready(config,true);
    if (row.target_address !== config.target) throw new SweepError('진행 중인 요청의 수신 지갑이 현재 설정과 다릅니다.');
    const wallet = await memberWallet(client,row.source_wallet_id);
    if (wallet.user_id !== row.user_id || wallet.address !== row.source_address) throw new SweepError('요청의 회원 지갑 정보가 변경됐습니다.');
    const key = memberKey(wallet), amount = BigInt(row.amount_raw), funding = BigInt(row.gas_amount_sun), feeLimit = BigInt(row.fee_limit_sun);
    if (funding > config.maxFunding || feeLimit > MAX_GAS_SUN) throw new SweepError('요청의 TRX 한도를 확인하세요.');

    if (row.status === 'PENDING') {
      if (row.gas_funding_tx_hash && row.gas_signed_tx) {
        const state = receiptState(await chain.confirmed(row.gas_funding_tx_hash),row.gas_funding_tx_hash);
        if (state === 'failed') { await update("status='FAILED',error_message='TRX 대납이 온체인에서 실패했습니다.'"); return {request:publicSweep(row)}; }
        if (state === 'pending') {
          await chain.broadcast(row.gas_signed_tx); // Same signed TX only, never a fresh payment.
          return { request:publicSweep(row) };
        }
        await update("status='GAS_FUNDED',error_message=NULL");
      } else {
        if (await chain.tokenBalance(wallet.address) < amount) throw new SweepError('검토한 USDT 수량보다 현재 온체인 잔액이 적습니다.');
        const account = await chain.trxBalance(wallet.address);
        const estimate = await chain.estimate(wallet.address,config.target,amount);
        if (estimate.feeLimit > feeLimit) throw new SweepError('예상 에너지 비용이 검토 시점보다 올랐습니다. 다시 검토하세요.');
        const needed = estimate.requiredTrx > account.balance ? estimate.requiredTrx-account.balance : BigInt("0");
        if (needed > funding) throw new SweepError('필요한 TRX 대납액이 검토 한도를 초과합니다. 다시 검토하세요.');
        if (needed > BigInt("0")) {
          const master = await chain.trxBalance(config.target);
          if (master.balance < needed+config.reserve+BigInt("2000000")) throw new SweepError('회사 지갑의 TRX 최소 보유량을 유지할 수 없습니다.');
          const signed = await chain.signGas(config.target,wallet.address,needed,config.key);
          await update('gas_amount_sun=$3,gas_funding_tx_hash=$4,gas_signed_tx=$5::jsonb,error_message=NULL',[needed.toString(),signed.txID,JSON.stringify(signed)]);
          // Persist before sending. A timeout must leave the request active.
          await chain.broadcast(signed);
          return { request:publicSweep(row) };
        }
        await update("status='GAS_FUNDED',gas_amount_sun=0,error_message=NULL");
      }
    }
    if (row.status === 'GAS_FUNDED') {
      if (await chain.tokenBalance(wallet.address) < amount) throw new SweepError('현재 온체인 USDT 잔액이 요청 수량보다 적습니다.');
      const signed = await chain.signSweep(wallet.address,config.target,amount,feeLimit,key);
      await update("status='SWEEPING',sweep_tx_hash=$3,sweep_signed_tx=$4::jsonb,error_message=NULL",[signed.txID,JSON.stringify(signed)]);
      await chain.broadcast(signed);
      return { request:publicSweep(row) };
    }
    if (row.status === 'SWEEPING' && row.sweep_tx_hash && row.sweep_signed_tx) {
      const state = receiptState(await chain.confirmed(row.sweep_tx_hash),row.sweep_tx_hash,{source:wallet.address,target:config.target,amount});
      if (state === 'confirmed') {
        // A custody move changes no member balances and creates no WITHDRAW ledger entry.
        await update("status='COMPLETED',completed_at=now(),gas_signed_tx=NULL,sweep_signed_tx=NULL,error_message=NULL");
      } else if (state === 'failed') {
        await update("status='FAILED',error_message='USDT 전송이 실패했거나 확정 전송 내역이 요청과 다릅니다.'");
      } else { await chain.broadcast(row.sweep_signed_tx); }
    }
    return { request:publicSweep(row) };
  } catch (error) {
    const message = error instanceof SweepError ? error.message : 'TRON 처리 결과를 아직 확정하지 못했습니다. 기존 요청에서 상태 확인을 이용하세요.';
    if (!row.gas_signed_tx && !row.sweep_signed_tx && !row.gas_funding_tx_hash && !row.sweep_tx_hash) {
      await update("status='FAILED',error_message=$3",[message]);
    } else { await update('error_message=$3',[message]); }
    return { request:publicSweep(row) };
  } finally {
    await client.query('UPDATE public.trc20_sweep_requests SET lease_until=NULL,lease_token=NULL WHERE id=$1 AND lease_token=$2',[id,token]);
  }
}

export async function saveSweepSettings(client: PoolClient, input: { enabled: boolean; maxFundingTrx: string; reserveTrx: string }) {
  const max = units(input.maxFundingTrx), reserve = units(input.reserveTrx);
  if (typeof input.enabled !== 'boolean' || max <= BigInt("0") || max > MAX_GAS_SUN || reserve < BigInt("1000000")) throw new SweepError('대납 상한은 0 초과~100 TRX, 최소 보유량은 1 TRX 이상이어야 합니다.');
  await client.query('BEGIN');
  try {
    for (const [key,value] of [['tron_sweep_enabled',String(input.enabled)],['tron_sweep_gas_fund_trx',input.maxFundingTrx],['tron_energy_reserve_trx',input.reserveTrx]]) {
      await client.query('INSERT INTO public.system_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[key,value]);
    }
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK');throw error; }
}
