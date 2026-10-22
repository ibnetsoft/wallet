import { setTimeout as delay } from "node:timers/promises";
import { TronWeb } from "tronweb";
import type { Types } from "tronweb";
type Transaction = Types.Transaction;
type SignedTransaction = Types.SignedTransaction;
import { TRON_USDT, TRANSFER_TOPIC, hexAddress, transferData, validateUnsigned, type SolidReceipt } from "./trc20-sweep-policy";

const HOST = "https://api.trongrid.io"; // Mainnet only; never accept an endpoint from the browser.
export class TronSweepChain {
  private lastRequest = 0;
  private signer = new TronWeb({ fullHost: HOST });

  async rpc<T>(method: string, body: object): Promise<T> {
    await delay(Math.max(0, 1_100 - (Date.now() - this.lastRequest)));
    this.lastRequest = Date.now();
    const response = await fetch(`${HOST}/${method}`, {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8_000),
      headers: { "Content-Type": "application/json", ...(process.env.TRONGRID_API_KEY ? { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY } : {}) },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`TRON 조회 실패 (HTTP ${response.status}). 잠시 후 다시 확인하세요.`);
    return response.json() as Promise<T>;
  }
  async trxBalance(address: string) {
    const account = await this.rpc<{ balance?: number; address?: string }>("wallet/getaccount", { address, visible: true });
    return { balance: BigInt(account.balance ?? 0), activated: Boolean(account.address) };
  }
  async tokenBalance(address: string) {
    const value = await this.rpc<{ result?: { result?: boolean }; constant_result?: string[] }>("wallet/triggerconstantcontract", {
      owner_address: address, contract_address: TRON_USDT, function_selector: "balanceOf(address)",
      parameter: hexAddress(address).slice(2).padStart(64, "0"), visible: true,
    });
    if (!value.result?.result || !/^[0-9a-f]{64}$/i.test(value.constant_result?.[0] ?? "")) throw new Error("USDT 온체인 잔액을 확인하지 못했습니다.");
    return BigInt("0x" + value.constant_result![0]);
  }
  async estimate(source: string, target: string, amount: bigint) {
    const simulation = await this.rpc<{ result?: { result?: boolean }; energy_used?: number; logs?: Array<{address:string;topics:string[];data:string}> }>("wallet/triggerconstantcontract", {
      owner_address: source, contract_address: TRON_USDT, function_selector: "transfer(address,uint256)",
      parameter: transferData(target, amount).slice(8), visible: true,
    });
    // Mainnet USDT can return a zero word while emitting a valid Transfer.
    // Verify the simulated event rather than treating the return word as bool.
    const simulatedTransfer = simulation.logs?.some(log => {
      let contract = log.address.toLowerCase();
      if (!/^[0-9a-f]{40}$/i.test(contract)) {
        try { contract = TronWeb.address.toHex(log.address).replace(/^41(?=[0-9a-f]{40}$)/i, '').toLowerCase(); }
        catch { return false; }
      }
      return contract === hexAddress(TRON_USDT).slice(2) && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC
        && log.topics[1]?.toLowerCase() === hexAddress(source).slice(2).padStart(64,'0')
        && log.topics[2]?.toLowerCase() === hexAddress(target).slice(2).padStart(64,'0')
        && /^[0-9a-f]{64}$/i.test(log.data) && BigInt('0x'+log.data) === amount;
    });
    if (!simulation.result?.result || !Number.isSafeInteger(simulation.energy_used) || !simulation.energy_used
      || !simulatedTransfer) throw new Error("USDT 전송 시뮬레이션에 실패했습니다. 수신 지갑과 주소 활성화 상태를 확인하세요.");
    const params = await this.rpc<{ chainParameter?: Array<{ key: string; value: number }> }>("wallet/getchainparameters", {});
    const price = params.chainParameter?.find(p => p.key === "getEnergyFee")?.value;
    if (!Number.isSafeInteger(price) || !price || price <= 0) throw new Error("TRON 에너지 단가를 확인하지 못했습니다.");
    const resources = await this.rpc<{ EnergyLimit?: number; EnergyUsed?: number }>("wallet/getaccountresource", { address: source, visible: true });
    const available = BigInt(Math.max(0, (resources.EnergyLimit ?? 0) - (resources.EnergyUsed ?? 0)));
    const bufferedEnergy = (BigInt(simulation.energy_used) * BigInt("13") + BigInt("9")) / BigInt("10");
    const feeLimit = bufferedEnergy * BigInt(price);
    const burnEnergy = bufferedEnergy > available ? bufferedEnergy - available : BigInt("0");
    return { feeLimit, requiredTrx: burnEnergy * BigInt(price) + BigInt("2000000") };
  }
  async signGas(source: string, target: string, amount: bigint, key: string) {
    const tx = await this.rpc<Transaction>("wallet/createtransaction", { owner_address: source, to_address: target, amount: Number(amount), visible: true });
    validateUnsigned(tx, { phase: "gas", source, target, amount, feeLimit: BigInt("0") });
    return this.signer.trx.sign(tx, key) as Promise<SignedTransaction>;
  }
  async signSweep(source: string, target: string, amount: bigint, feeLimit: bigint, key: string) {
    const built = await this.rpc<{ result?: { result?: boolean }; transaction?: Transaction }>("wallet/triggersmartcontract", {
      owner_address: source, contract_address: TRON_USDT, function_selector: "transfer(address,uint256)",
      parameter: transferData(target, amount).slice(8), fee_limit: Number(feeLimit), call_value: 0, visible: true,
    });
    if (!built.result?.result || !built.transaction) throw new Error("USDT 전송 트랜잭션을 만들지 못했습니다.");
    validateUnsigned(built.transaction, { phase: "sweep", source, target, amount, feeLimit });
    return this.signer.trx.sign(built.transaction, key) as Promise<SignedTransaction>;
  }
  async broadcast(tx: SignedTransaction) {
    if (tx.raw_data.expiration <= Date.now()) throw new Error("전송 유효기간이 지났습니다. 새 요청을 만들지 말고 기존 TX를 확인하세요.");
    const result = await this.rpc<{ result?: boolean; code?: string }>("wallet/broadcasttransaction", tx);
    if (!result.result && result.code !== "DUP_TRANSACTION_ERROR") throw new Error("전송 결과를 확정하지 못했습니다. 기존 요청의 상태 확인을 이용하세요.");
  }
  confirmed(txId: string) { return this.rpc<SolidReceipt>("walletsolidity/gettransactioninfobyid", { value: txId }); }
}
