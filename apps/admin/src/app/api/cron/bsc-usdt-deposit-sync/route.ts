import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import {
  DepositSyncError,
  isDepositSyncMigrationError,
  syncBscUsdtDeposits,
} from "@/lib/bsc-usdt-deposit-indexer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function syncErrorResponse(error: unknown) {
  if (error instanceof DepositSyncError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
  }

  if (isDepositSyncMigrationError(error)) {
    return NextResponse.json(
      { success: false, error: "BSC USDT deposit migration is not applied yet." },
      { status: 503 }
    );
  }

  console.error("Scheduled BSC USDT deposit sync error:", error);
  return NextResponse.json({ success: false, error: "BSC USDT deposit sync failed." }, { status: 500 });
}

export async function HEAD(request: Request) {
  return new NextResponse(null, { status: isCronRequest(request) ? 204 : 401 });
}

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncBscUsdtDeposits();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return syncErrorResponse(error);
  }
}
