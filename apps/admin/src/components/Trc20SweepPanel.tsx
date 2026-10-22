"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/admin-path";

type SweepRequest = { id:string; source:string; target:string; amount:string; gasTrx:string; status:string; gasTx:string|null; sweepTx:string|null; message:string|null };
type Dashboard = {
  wallets:Array<{id:string;address:string;email:string;nickname:string|null}>;
  requests:SweepRequest[];
  settings:{target:string;enabled:boolean;reserveTrx:string;maxFundingTrx:string;issues:string[]};
};
type Preview = {source:string;target:string;amount:string;sourceTrx:string;masterTrx:string;maxGasTrx:string;feeLimitTrx:string;issues:string[];enabled:boolean;token:string|null};
const active = (status:string) => ['PENDING','GAS_FUNDED','SWEEPING'].includes(status);
const labels:Record<string,string> = {PENDING:'TRX 대납 확정 대기',GAS_FUNDED:'USDT 전송 준비',SWEEPING:'USDT 확정 대기',COMPLETED:'모으기 완료',FAILED:'실패',CANCELLED:'취소'};
const inputClass = "w-full rounded-lg border border-[#36363B] bg-[#0C0C0E] p-2 text-sm text-white";

export default function Trc20SweepPanel() {
  const [data,setData] = useState<Dashboard|null>(null);
  const [walletId,setWalletId] = useState('');
  const [preview,setPreview] = useState<Preview|null>(null);
  const [enabled,setEnabled] = useState(false);
  const [maxFunding,setMaxFunding] = useState('15');
  const [reserve,setReserve] = useState('50');
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  // Keep the same key after a timeout. Never create another transfer merely
  // because the browser did not receive the first response.
  const operationKey = useRef<string|null>(null);

  const load = useCallback(async () => {
    const response = await fetch(adminApi('/api/wallet/trc20-sweep'),{cache:'no-store'});
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'TRC20 모으기 내역을 조회하지 못했습니다.');
    setData(result);
  },[]);
  useEffect(() => { void load().catch(error => setMessage(error.message)); },[load]);
  useEffect(() => {
    if (data) { setEnabled(data.settings.enabled);setMaxFunding(data.settings.maxFundingTrx);setReserve(data.settings.reserveTrx); }
  },[data]);
  async function post(body:object) {
    const response = await fetch(adminApi('/api/wallet/trc20-sweep'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || '모으기 요청을 처리하지 못했습니다.');
    return result;
  }
  async function perform(action:()=>Promise<void>) {
    setBusy(true);setMessage('');
    try { await action(); }
    catch(error) { setMessage(error instanceof Error ? error.message : '요청 결과를 확인하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  const pending = data?.requests.find(row=>active(row.status));
  async function review() {
    const result = await post({action:'PREVIEW',walletId});
    setPreview(result.preview);operationKey.current=null;
  }
  async function execute() {
    if (!preview?.token) return;
    if (!confirm(`TRON 메인넷에서 ${preview.amount} USDT를 회사 지갑으로 모읍니다.\n\n출발: ${preview.source}\n수신: ${preview.target}\nTRX 대납 상한: ${preview.maxGasTrx} TRX\n\n실제 온체인 송금입니다. 회원 장부 잔액은 유지됩니다. 계속하시겠습니까?`)) return;
    operationKey.current ??= crypto.randomUUID();
    const result = await post({action:'EXECUTE',token:preview.token,idempotencyKey:operationKey.current,confirmation:'COLLECT TRC20'});
    setMessage(result.request.status==='COMPLETED' ? 'TRC20 모으기가 확정됐습니다. 회원 잔액은 그대로 유지됩니다.' : '요청이 저장됐습니다. 아래 기존 요청의 상태 확인·계속 진행을 이용하세요.');
    setPreview(null);await load();
  }
  return (
    <section aria-labelledby="trc20-sweep-title" className="space-y-5 rounded-2xl border border-[#30D5C8]/40 bg-[#16161A] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="trc20-sweep-title" className="text-lg font-bold text-white">TRON · TRC20 USDT 모으기</h3>
          <p className="mt-1 text-xs text-[#A5A5AD]">회원 주소의 실제 USDT를 TRON 회사 지갑으로 옮깁니다. 회원의 앱 잔액은 차감하지 않습니다.</p>
        </div>
        <button disabled={busy} onClick={()=>void perform(load)} className="rounded-lg border border-[#36363B] px-3 py-2 text-xs text-white disabled:opacity-40">내역 새로고침</button>
      </div>
      {data && <>
        <div className="rounded-xl bg-[#0C0C0E] p-4 text-xs text-[#C8C8CE]">
          <p>수신 회사 지갑</p><p className="mt-1 break-all font-mono text-[#30D5C8]">{data.settings.target || '미등록'}</p>
          {data.settings.issues.map(issue=><p key={issue} className="mt-2 text-[#FFB45A]">{issue}</p>)}
          <Link href="/settings" className="mt-2 inline-block text-[#00D2FF] underline">시스템 설정에서 TRON 회사 지갑 등록</Link>
        </div>
        <details className="rounded-xl border border-[#36363B] p-4 text-sm text-white">
          <summary className="cursor-pointer">모으기 활성화·TRX 대납 한도</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <label className="text-xs">요청당 TRX 대납 상한<input aria-label="요청당 TRX 대납 상한" className={inputClass} value={maxFunding} onChange={event=>setMaxFunding(event.target.value)} inputMode="decimal" /></label>
            <label className="text-xs">회사 지갑 TRX 최소 보유량<input aria-label="회사 지갑 TRX 최소 보유량" className={inputClass} value={reserve} onChange={event=>setReserve(event.target.value)} inputMode="decimal" /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)} />TRC20 모으기 활성화</label>
          </div>
          <p className="mt-3 text-xs text-[#A5A5AD]">TRX는 주소 활성화·대역폭·에너지 비용에 사용됩니다. 검토 시 대납액과 회사 지갑의 최소 보유량을 확인합니다.</p>
          <button disabled={busy} onClick={()=>void perform(async()=>{await post({action:'CONFIGURE',enabled,maxFundingTrx:maxFunding,reserveTrx:reserve});setPreview(null);await load();setMessage('TRC20 모으기 설정을 저장했습니다.');})} className="mt-3 rounded-lg bg-[#26262B] px-4 py-2 text-xs disabled:opacity-40">설정 저장</button>
        </details>
        <div className="flex flex-wrap gap-3">
          <select aria-label="모을 TRON 회원 지갑" value={walletId} disabled={busy || Boolean(pending)} onChange={event=>{setWalletId(event.target.value);setPreview(null);}} className={`${inputClass} min-w-0 flex-1`}>
            <option value="">모을 회원 지갑 선택</option>
            {data.wallets.map(wallet=><option key={wallet.id} value={wallet.id}>{wallet.nickname || wallet.email} · {wallet.address}</option>)}
          </select>
          <button disabled={busy || !walletId || Boolean(pending)} onClick={()=>void perform(review)} className="rounded-lg bg-[#26262B] px-4 py-2 text-sm text-white disabled:opacity-40">온체인 잔액·수수료 검토</button>
        </div>
        {pending && <p className="text-xs text-[#FFB45A]">진행 중인 요청이 있습니다. 아래 내역에서 같은 요청을 계속 진행하세요.</p>}
        {preview && <div className="space-y-2 rounded-xl border border-[#30D5C8]/30 p-4 text-sm text-white">
          <p className="break-all text-xs">출발: {preview.source}</p><p className="break-all text-xs">수신: {preview.target}</p>
          <p className="font-bold">모을 수량: {preview.amount} USDT</p>
          <p className="text-xs">회원 지갑 TRX: {preview.sourceTrx} · 회사 지갑 TRX: {preview.masterTrx}</p>
          <p className="text-xs">TRX 대납 상한: {preview.maxGasTrx} · 계약 에너지 수수료 상한: {preview.feeLimitTrx} TRX</p>
          {preview.issues.map(issue=><p key={issue} className="text-xs text-[#FFB45A]">{issue}</p>)}
          {!data.settings.enabled && <p className="text-xs text-[#FFB45A]">설정에서 모으기를 활성화해야 실행할 수 있습니다.</p>}
          <button disabled={busy || !preview.token || !data.settings.enabled || Boolean(pending)} onClick={()=>void perform(execute)} className="rounded-lg bg-[#30D5C8] px-4 py-2 font-bold text-black disabled:opacity-40">검토한 수량 모으기 실행</button>
        </div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#C8C8CE]">
            <caption className="mb-2 text-left font-bold text-white">TRC20 모으기 내역</caption>
            <thead><tr><th className="p-2">수량·출발 주소</th><th className="p-2">상태</th><th className="p-2">온체인 내역</th><th className="p-2">진행</th></tr></thead>
            <tbody>{data.requests.map(row=><tr key={row.id} className="border-t border-[#36363B]">
              <td className="p-2">{row.amount} USDT<p className="max-w-52 break-all font-mono text-[10px]">{row.source}</p></td>
              <td className="p-2">{labels[row.status] || row.status}{row.message && <p className="max-w-64 text-[#FFB45A]">{row.message}</p>}</td>
              <td className="space-y-1 p-2">{row.gasTx && <a className="block text-[#00D2FF] underline" href={`https://tronscan.org/#/transaction/${row.gasTx}`} target="_blank" rel="noreferrer">TRX 대납 TX</a>}{row.sweepTx && <a className="block text-[#00D2FF] underline" href={`https://tronscan.org/#/transaction/${row.sweepTx}`} target="_blank" rel="noreferrer">USDT 모으기 TX</a>}</td>
              <td className="p-2">{active(row.status) && <button disabled={busy} onClick={()=>void perform(async()=>{const result=await post({action:'RESUME',requestId:row.id});setMessage(result.busy ? '다른 요청에서 처리 중입니다. 잠시 후 확인하세요.' : result.request.status==='COMPLETED' ? '모으기 확정 완료. 회원 잔액은 유지됩니다.' : '확정 대기 중입니다. 잠시 후 같은 요청의 상태를 확인하세요.');await load();})} className="rounded border border-[#36363B] px-2 py-2 disabled:opacity-40">상태 확인·계속 진행</button>}</td>
            </tr>)}</tbody>
          </table>
          {data.requests.length===0 && <p className="py-3 text-xs text-[#A5A5AD]">아직 모으기 요청이 없습니다.</p>}
        </div>
      </>}
      {message && <p role="status" className="rounded-lg bg-[#0C0C0E] p-3 text-xs text-[#EAECEF]">{message}</p>}
    </section>
  );
}
