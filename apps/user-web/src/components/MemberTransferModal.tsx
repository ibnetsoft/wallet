"use client";

import { useRef, useState } from "react";

type Language = "ko" | "en" | "zh";
type Recipient = { id: string; nickname: string; address: string; network: string };
type Pending = { requestId: string; amount: string; recipient: Recipient };
const copy = {
  ko: { title:"회원 USDT 이체", info:"BSC·TRON 입금 주소로 회원을 찾아 통합 USDT 잔액을 이체합니다. 수수료는 없으며 블록체인 송금은 발생하지 않습니다.",network:"받는 회원 주소의 네트워크",address:"받는 회원의 입금 주소",amount:"이체 금액 (USDT)",available:"사용 가능",preview:"수취 회원 확인",recipient:"받는 회원",confirm:"확인 후 이체",back:"다시 입력",close:"닫기",busy:"처리 중…",retry:"동일 요청 결과 확인 · 재시도",uncertain:"통신이 중단된 경우 같은 요청으로 재시도해 주세요. 중복 이체되지 않습니다.",done:"회원 이체 완료",id:"이체 번호",fee:"수수료 0 USDT",precision:"소수점 최대 6자리",defaultError:"처리하지 못했습니다. 같은 요청으로 다시 시도해 주세요." },
  en: { title:"Member USDT transfer",info:"Find a member by their BSC or TRON deposit address and transfer unified USDT balance. No fees or blockchain transaction.",network:"Recipient address network",address:"Member deposit address",amount:"Amount (USDT)",available:"Available",preview:"Verify recipient",recipient:"Recipient",confirm:"Confirm transfer",back:"Edit",close:"Close",busy:"Processing…",retry:"Check result / retry same request",uncertain:"If the connection is interrupted, retry the same request. It will not transfer twice.",done:"Member transfer completed",id:"Transfer ID",fee:"Fee: 0 USDT",precision:"Up to 6 decimal places",defaultError:"Unable to complete. Retry the same request." },
  zh: { title:"会员 USDT 转账",info:"通过会员的 BSC 或 TRON 充值地址查找收款人，从统一 USDT 余额转账。免手续费，不产生链上交易。",network:"收款地址网络",address:"会员充值地址",amount:"转账金额 (USDT)",available:"可用余额",preview:"确认收款会员",recipient:"收款会员",confirm:"确认转账",back:"修改",close:"关闭",busy:"处理中…",retry:"查询结果 / 重试同一请求",uncertain:"连接中断时，请重试同一请求，不会重复扣款。",done:"会员转账完成",id:"转账编号",fee:"手续费 0 USDT",precision:"最多 6 位小数",defaultError:"处理失败，请重试同一请求。" },
};
const errors: Record<string, [string,string,string]> = {
  INVALID_AMOUNT:["0보다 큰 금액을 소수점 6자리 이내로 입력해 주세요.","Enter a positive amount with up to 6 decimal places.","请输入大于 0 且最多 6 位小数的金额。"],
  INVALID_ADDRESS:["선택한 네트워크의 올바른 주소를 입력해 주세요.","Enter a valid address for the selected network.","请输入所选网络的有效地址。"],
  RECIPIENT_NOT_FOUND:["이 주소에 연결된 회원이 없습니다.","No member is linked to this address.","该地址未关联会员。"],
  SELF_TRANSFER:["본인의 다른 주소로는 내부이체할 수 없습니다.","You cannot transfer to your own account.","不能向自己的账户转账。"],
  INSUFFICIENT_BALANCE:["사용 가능한 USDT 잔액이 부족합니다.","Insufficient available USDT.","可用 USDT 余额不足。"],
  RECIPIENT_CHANGED:["수취 회원이 변경됐습니다. 주소를 다시 확인해 주세요.","Recipient changed. Verify the address again.","收款人已变更，请重新确认地址。"],
  AUTH_REQUIRED:["다시 로그인해 주세요.","Please sign in again.","请重新登录。"],
  REQUEST_CONFLICT:["요청 내용이 일치하지 않습니다. 관리자에게 이체 번호와 함께 문의해 주세요.","Request mismatch. Contact support with your request ID.","请求不一致，请提供请求编号联系管理员。"],
};

export default function MemberTransferModal({ userId,balance,lang,onClose,onSuccess }: {
  userId:string; balance:number; lang:Language; onClose:()=>void; onSuccess:()=>void;
}) {
  const t = copy[lang];
  const key = `member-usdt-transfer:${userId}`;
  const [pending,setPending] = useState<Pending|null>(() => {
    try { const saved = sessionStorage.getItem(key); return saved ? JSON.parse(saved) : null; } catch { return null; }
  });
  const [network,setNetwork] = useState(pending?.recipient.network || "BSC");
  const [address,setAddress] = useState(pending?.recipient.address || "");
  const [amount,setAmount] = useState(pending?.amount || "");
  const [recipient,setRecipient] = useState<Recipient|null>(pending?.recipient || null);
  const [busy,setBusy] = useState(false);
  const sending = useRef(false);
  const [error,setError] = useState("");
  const [receipt,setReceipt] = useState<string|null>(null);
  const errorText = (code:string) => errors[code]?.[lang === "ko" ? 0 : lang === "en" ? 1 : 2] || t.defaultError;

  const preview = async () => {
    if (sending.current) return;
    if (!/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(amount) || Number(amount) <= 0) { setError(errorText("INVALID_AMOUNT")); return; }
    sending.current = true; setBusy(true); setError("");
    try {
      const res = await fetch("/api/transfers/preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({network,address})});
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setRecipient(data.recipient);
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "")); }
    finally { sending.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (sending.current || !recipient) return;
    sending.current = true; setBusy(true); setError("");
    const request = pending || { requestId:crypto.randomUUID(),amount,recipient };
    // Persist before sending, so reloads and uncertain responses reuse the same ID.
    try {
      sessionStorage.setItem(key,JSON.stringify(request));
      setPending(request);
      const res = await fetch("/api/transfers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        requestId:request.requestId,recipientId:request.recipient.id,network:request.recipient.network,address:request.recipient.address,amount:request.amount,
      })});
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 400 || data.error === "RECIPIENT_CHANGED") { sessionStorage.removeItem(key); setPending(null); setRecipient(null); }
        throw new Error(data.error);
      }
      setReceipt(data.transfer.id);
      sessionStorage.removeItem(key); setPending(null);
      onSuccess();
    } catch (e) { setError(errorText(e instanceof Error ? e.message : "")); }
    finally { sending.current = false; setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="member-transfer-title" className="bg-[#1E2329] border border-[#2B3139] rounded-2xl w-full max-w-sm p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
      <h3 id="member-transfer-title" className="font-bold text-[#EAECEF]">{t.title}</h3>
      <p className="text-xs text-[#848E9C] leading-relaxed">{t.info}</p>
      {receipt ? <div className="space-y-3" role="status"><p className="text-[#0ECB81] font-bold">{t.done}</p><p className="text-sm">{amount} USDT → {recipient?.nickname}</p><p className="text-xs break-all text-[#848E9C]">{t.id}: {receipt}</p></div> : recipient ? <div className="space-y-3">
        <div className="rounded-xl bg-[#0B0E11] p-3 space-y-2 text-sm"><p>{t.recipient}: <strong>{recipient.nickname}</strong></p><p className="text-xs text-[#848E9C]">969-{recipient.id.slice(0,8).toUpperCase()} · {recipient.network === "TRON" ? "TRON (TRC20)" : "BSC (BEP20)"}</p><p className="font-mono text-xs break-all select-all">{recipient.address}</p><p className="font-bold text-[#FCD535]">{amount} USDT</p><p className="text-xs text-[#0ECB81]">{t.fee}</p></div>
        {pending && <p className="text-xs text-[#848E9C] break-all">{t.uncertain}<br />ID: {pending.requestId}</p>}
        <button disabled={busy} onClick={submit} className="w-full py-3 bg-[#FCD535] text-[#0B0E11] rounded-xl font-bold disabled:opacity-50">{busy ? t.busy : pending ? t.retry : t.confirm}</button>
        {!pending && <button disabled={busy} onClick={()=>{setRecipient(null);setError("");}} className="w-full text-sm text-[#848E9C]">{t.back}</button>}
      </div> : <div className="space-y-3">
        <label className="block text-xs text-[#848E9C]">{t.network}<select value={network} disabled={busy} onChange={e=>setNetwork(e.target.value)} className="block w-full mt-1 p-3 bg-[#0B0E11] rounded-xl text-white"><option value="BSC">BSC (BEP20)</option><option value="TRON">TRON (TRC20)</option></select></label>
        <label className="block text-xs text-[#848E9C]">{t.address}<input value={address} disabled={busy} onChange={e=>setAddress(e.target.value)} autoComplete="off" spellCheck={false} className="block w-full mt-1 p-3 bg-[#0B0E11] rounded-xl text-white font-mono" placeholder={network === "BSC" ? "0x..." : "T..."} /></label>
        <label className="block text-xs text-[#848E9C]">{t.amount}<input value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)} inputMode="decimal" autoComplete="off" placeholder={t.precision} className="block w-full mt-1 p-3 bg-[#0B0E11] rounded-xl text-white" /></label>
        <p className="text-xs text-[#848E9C]">{t.available}: {balance.toLocaleString(undefined,{maximumFractionDigits:6})} USDT</p>
        <button disabled={busy} onClick={preview} className="w-full py-3 bg-[#FCD535] text-[#0B0E11] rounded-xl font-bold disabled:opacity-50">{busy ? t.busy : t.preview}</button>
      </div>}
      {error && <p role="alert" className="text-xs text-[#F6465D]">{error}</p>}
      <button onClick={onClose} disabled={busy} className="w-full py-2 text-sm text-[#848E9C] disabled:opacity-50">{t.close}</button>
    </section>
  </div>;
}
