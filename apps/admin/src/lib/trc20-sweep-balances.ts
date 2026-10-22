import { decimal } from "./trc20-sweep-policy";

export type SweepWallet = { id:string; address:string; email:string; nickname:string|null };

// Query actual custody balances. A failed/unfinished lookup is never a zero.
export async function scanFundedTronWallets(
  wallets:SweepWallet[], chain:{tokenBalance:(address:string)=>Promise<bigint>}, budgetMs=40_000,
) {
  const started=Date.now();
  const funded:Array<SweepWallet & {balance:string}>=[];
  let total=BigInt(0), checked=0, failed=0;
  for (const wallet of wallets) {
    if (Date.now()-started >= budgetMs) break;
    try {
      const amount=await chain.tokenBalance(wallet.address);
      if (amount < BigInt(0)) throw new Error("Invalid token balance");
      checked++;
      if (amount > BigInt(0)) { funded.push({...wallet,balance:decimal(amount)});total+=amount; }
    } catch { failed++; }
  }
  funded.sort((a,b)=>{
    const [aw,af=""]=a.balance.split('.'),[bw,bf=""]=b.balance.split('.');
    const av=BigInt(aw)*BigInt(1000000)+BigInt(af.padEnd(6,'0'));
    const bv=BigInt(bw)*BigInt(1000000)+BigInt(bf.padEnd(6,'0'));
    return av===bv ? a.address.localeCompare(b.address) : av>bv ? -1 : 1;
  });
  return {wallets:funded,totalUsdt:decimal(total),checked,totalWallets:wallets.length,
    failed,unchecked:wallets.length-checked-failed,checkedAt:new Date().toISOString()};
}
