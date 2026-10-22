import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { syncTrc20UsdtDeposits } from "@/lib/trc20-usdt-deposit-indexer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function HEAD(request: Request) {
  return new NextResponse(null, { status: isCronRequest(request) ? 204 : 401 });
}

export async function GET(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncTrc20UsdtDeposits();
    return NextResponse.json({ success: result.failedWallets === 0, result }, { status: result.failedWallets ? 503 : 200 });
  } catch (error) {
    console.error("Scheduled TRC20 USDT deposit sync error:", error);
    return NextResponse.json({ success: false, error: "TRC20 USDT deposit sync failed." }, { status: 500 });
  }
}
