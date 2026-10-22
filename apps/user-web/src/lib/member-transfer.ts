import type { PoolClient } from "pg";
import { getAddress } from "ethers";
import { TronWeb } from "tronweb";

export class TransferError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function parseTransferAmount(value: unknown): string {
  // No floating-point arithmetic, exponent notation, or silent rounding.
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(value)) {
    throw new TransferError("INVALID_AMOUNT");
  }
  const [whole, fraction = ""] = value.split(".");
  if (BigInt(whole) * BigInt(1000000) + BigInt(fraction.padEnd(6, "0")) <= BigInt(0)) {
    throw new TransferError("INVALID_AMOUNT");
  }
  return `${whole}.${fraction.padEnd(6, "0")}`;
}

export function parseTransferAddress(network: unknown, address: unknown) {
  if (network !== "BSC" && network !== "TRON") throw new TransferError("INVALID_NETWORK");
  if (typeof address !== "string" || address.length > 64) throw new TransferError("INVALID_ADDRESS");
  const trimmed = address.trim();
  if (network === "TRON") {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(trimmed) || !TronWeb.isAddress(trimmed)) throw new TransferError("INVALID_ADDRESS");
    return { network, address: trimmed };
  }
  try { return { network, address: getAddress(trimmed) }; }
  catch { throw new TransferError("INVALID_ADDRESS"); }
}

export function requireUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new TransferError("INVALID_REQUEST");
  }
  return value.toLowerCase();
}

export async function findTransferRecipient(db: Pick<PoolClient, "query">, senderId: string, network: string, address: string, lock = false) {
  const result = await db.query(
    `SELECT w.user_id AS id, u.nickname, w.address
     FROM public.user_wallets w JOIN public.users u ON u.id=w.user_id
     WHERE w.chain_type=$1 AND ${network === "BSC" ? "lower(w.address)=lower($2)" : "w.address=$2"}
       AND u.status IN ('ACTIVE','PENDING')
     ${lock ? "FOR SHARE OF w" : ""}`,
    [network, address],
  );
  if (result.rows.length !== 1) throw new TransferError("RECIPIENT_NOT_FOUND");
  const recipient = result.rows[0];
  if (recipient.id === senderId) throw new TransferError("SELF_TRANSFER");
  return { id: String(recipient.id), nickname: String(recipient.nickname || ""), address: String(recipient.address), network };
}

export type MemberTransferInput = {
  senderId: string; recipientId: string; requestId: string;
  network: string; address: string; amount: string;
};

export async function executeMemberTransfer(db: PoolClient, input: MemberTransferInput) {
  const senderId = requireUuid(input.senderId);
  const recipientId = requireUuid(input.recipientId);
  const requestId = requireUuid(input.requestId);
  const { network, address } = parseTransferAddress(input.network,input.address);
  const amount = parseTransferAmount(input.amount);
  await db.query("BEGIN");
  try {
    await db.query("SET LOCAL lock_timeout = '5s'");
    await db.query("SET LOCAL statement_timeout = '15s'");
    const recipient = await findTransferRecipient(db, senderId, network, address, true);
    if (recipient.id !== recipientId) throw new TransferError("RECIPIENT_CHANGED", 409);
    const members = await db.query(
      `SELECT id, nickname FROM public.users WHERE id=ANY($1::uuid[])
       AND status IN ('ACTIVE','PENDING') ORDER BY id FOR SHARE`, [[senderId, recipientId]],
    );
    if (members.rows.length !== 2) throw new TransferError("MEMBER_UNAVAILABLE");
    const asset = (await db.query("SELECT id FROM public.assets WHERE symbol='USDT'")).rows;
    if (asset.length !== 1) throw new Error("USDT asset is not configured");
    const assetId = asset[0].id;

    // The unique INSERT waits for a simultaneous retry to commit or roll back.
    const inserted = await db.query(
      `INSERT INTO public.member_usdt_transfers
       (request_id,sender_user_id,recipient_user_id,asset_id,amount,recipient_network,recipient_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (sender_user_id,request_id) DO NOTHING RETURNING id`,
      [requestId,senderId,recipientId,assetId,amount,network,recipient.address],
    );
    if (!inserted.rows.length) {
      const existing = (await db.query(
        `SELECT id, recipient_user_id, amount=$3::numeric AS same_amount, recipient_network, recipient_address
         FROM public.member_usdt_transfers WHERE sender_user_id=$1 AND request_id=$2`, [senderId,requestId,amount],
      )).rows[0];
      if (!existing || !existing.same_amount || existing.recipient_user_id !== recipientId || existing.recipient_network !== network || existing.recipient_address !== recipient.address) {
        throw new TransferError("REQUEST_CONFLICT",409);
      }
      await db.query("COMMIT");
      return { id: existing.id as string, duplicate: true };
    }
    // Always create and lock both balance rows in UUID order, including A↔B sends.
    for (const id of [senderId,recipientId].sort()) {
      await db.query(
        `INSERT INTO public.user_balances (user_id,asset_id,available_balance,locked_balance,updated_at)
         VALUES ($1,$2,0,0,now()) ON CONFLICT (user_id,asset_id) DO NOTHING`, [id,assetId],
      );
    }
    await db.query(
      `SELECT user_id FROM public.user_balances WHERE user_id=ANY($1::uuid[]) AND asset_id=$2 ORDER BY user_id FOR UPDATE`,
      [[senderId,recipientId],assetId],
    );
    const debit = await db.query(
      `UPDATE public.user_balances SET available_balance=available_balance-$3::numeric, updated_at=now()
       WHERE user_id=$1 AND asset_id=$2 AND available_balance >= $3::numeric RETURNING user_id`, [senderId,assetId,amount],
    );
    if (debit.rowCount !== 1) throw new TransferError("INSUFFICIENT_BALANCE");
    await db.query(
      `UPDATE public.user_balances SET available_balance=available_balance+$3::numeric,updated_at=now()
       WHERE user_id=$1 AND asset_id=$2`, [recipientId,assetId,amount],
    );
    const id = String(inserted.rows[0].id);
    const sender = members.rows.find(row => row.id === senderId);
    const common = { source: "member_transfer", transfer_id: id, network, recipient_address: recipient.address,
      sender_user_id: senderId, recipient_user_id: recipientId, sender_nickname: sender?.nickname || "", recipient_nickname: recipient.nickname, fee: "0" };
    const debitLedger = await db.query(
      `INSERT INTO public.ledger_entries (user_id,asset_id,amount,tx_type,status,tx_hash,details)
       VALUES ($1,$2,-$3::numeric,'TRANSFER_OUT','COMPLETED',$4,$5::jsonb) RETURNING id`,
      [senderId,assetId,amount,`MEMBER-USDT:${id}:OUT`,JSON.stringify({...common,description:`회원 이체 보냄 → ${recipient.nickname}`})],
    );
    const creditLedger = await db.query(
      `INSERT INTO public.ledger_entries (user_id,asset_id,amount,tx_type,status,tx_hash,details)
       VALUES ($1,$2,$3::numeric,'TRANSFER_IN','COMPLETED',$4,$5::jsonb) RETURNING id`,
      [recipientId,assetId,amount,`MEMBER-USDT:${id}:IN`,JSON.stringify({...common,description:`회원 이체 받음 ← ${sender?.nickname || ""}`})],
    );
    await db.query("UPDATE public.member_usdt_transfers SET sender_ledger_id=$2,recipient_ledger_id=$3 WHERE id=$1",[id,debitLedger.rows[0].id,creditLedger.rows[0].id]);
    await db.query("COMMIT");
    return { id, duplicate: false };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
