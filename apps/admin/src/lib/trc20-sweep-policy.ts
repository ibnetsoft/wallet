import { TronWeb, utils } from "tronweb";
import type { Types } from "tronweb";
type Transaction = Types.Transaction;

export const TRON_USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const MAX_GAS_SUN = BigInt("100000000");
export const TRANSFER_TOPIC = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export function units(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) throw new Error("수량은 소수점 6자리 이하로 입력하세요.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt("1000000") + BigInt(fraction.padEnd(6, "0"));
}
export function decimal(value: bigint): string {
  return `${value / BigInt("1000000")}.${(value % BigInt("1000000")).toString().padStart(6, "0")}`;
}
export function hexAddress(address: string): string {
  if (/^41[0-9a-f]{40}$/i.test(address)) return address.toLowerCase();
  if (!TronWeb.isAddress(address)) throw new Error("올바른 TRON 주소가 아닙니다.");
  return TronWeb.address.toHex(address).toLowerCase();
}
export function transferData(target: string, amount: bigint): string {
  return "a9059cbb" + hexAddress(target).slice(2).padStart(64, "0") + amount.toString(16).padStart(64, "0");
}

// Compare the exact protobuf bytes being signed with the human-readable
// intent. An RPC response cannot change the owner, target, amount, or call.
export function validateUnsigned(tx: Transaction, intent: {
  phase: "gas" | "sweep"; source: string; target: string; amount: bigint; feeLimit: bigint;
}, now = Date.now()) {
  if (!utils.transaction.txCheck(tx)) throw new Error("트랜잭션 데이터 검증에 실패했습니다.");
  const raw = tx.raw_data;
  if (!raw || raw.contract.length !== 1 || raw.expiration <= now + 10_000 || raw.expiration > now + 15 * 60_000) {
    throw new Error("트랜잭션의 유효기간 또는 호출 수가 올바르지 않습니다.");
  }
  const call = raw.contract[0];
  const value = call.parameter.value as unknown as Record<string, unknown>;
  if ((call.Permission_id ?? 0) !== 0 || raw.data || hexAddress(String(value.owner_address)) !== hexAddress(intent.source)) {
    throw new Error("트랜잭션 소유자가 일치하지 않습니다.");
  }
  if (intent.phase === "gas") {
    if (call.type !== "TransferContract" || hexAddress(String(value.to_address)) !== hexAddress(intent.target)
      || BigInt(String(value.amount)) !== intent.amount || intent.amount > MAX_GAS_SUN) {
      throw new Error("TRX 대납 수량 또는 수신 주소가 일치하지 않습니다.");
    }
  } else if (call.type !== "TriggerSmartContract" || hexAddress(String(value.contract_address)) !== hexAddress(TRON_USDT)
    || String(value.data).toLowerCase() !== transferData(intent.target, intent.amount)
    || BigInt(String(value.call_value ?? 0)) !== BigInt("0") || BigInt(String(value.call_token_value ?? 0)) !== BigInt("0")
    || BigInt(raw.fee_limit ?? 0) !== intent.feeLimit || intent.feeLimit > MAX_GAS_SUN) {
    throw new Error("USDT 계약, 수량, 수신 주소 또는 수수료 한도가 일치하지 않습니다.");
  }
}

export type SolidReceipt = {
  id?: string; blockNumber?: number; result?: string;
  receipt?: { result?: string };
  log?: Array<{ address: string; topics: string[]; data: string }>;
};
export function receiptState(info: SolidReceipt, txId: string, intent?: { source: string; target: string; amount: bigint }) {
  if (!info.id || info.id !== txId || !info.blockNumber) return "pending";
  if (info.result === "FAILED" || (info.receipt?.result && info.receipt.result !== "SUCCESS")) return "failed";
  if (!intent) return "confirmed";
  const matching = (info.log ?? []).some(log => log.address.toLowerCase() === hexAddress(TRON_USDT).slice(2)
    && log.topics[0]?.toLowerCase() === TRANSFER_TOPIC
    && log.topics[1]?.toLowerCase() === hexAddress(intent.source).slice(2).padStart(64, "0")
    && log.topics[2]?.toLowerCase() === hexAddress(intent.target).slice(2).padStart(64, "0")
    && /^[0-9a-f]{64}$/i.test(log.data) && BigInt("0x" + log.data) === intent.amount);
  return info.receipt?.result === "SUCCESS" && matching ? "confirmed" : "failed";
}
