import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { syncTrc20UsdtDeposits } from "@/lib/trc20-usdt-deposit-indexer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const result = await syncTrc20UsdtDeposits();
    return NextResponse.json({ success: result.failedWallets === 0, result }, { status: result.failedWallets ? 503 : 200 });
  } catch (error) {
    console.error("Manual TRC20 USDT deposit sync error:", error);
    return NextResponse.json({ success: false, error: "Unable to synchronize TRC20 USDT deposits." }, { status: 500 });
  }
}
