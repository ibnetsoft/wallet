import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import {
  DepositSyncError,
  isDepositSyncMigrationError,
  syncBscUsdtDeposits,
} from "@/lib/bsc-usdt-deposit-indexer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

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

  console.error("Manual BSC USDT deposit sync error:", error);
  return NextResponse.json(
    { success: false, error: "Unable to synchronize BSC USDT deposits. Check the server logs." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ success: false, error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const result = await syncBscUsdtDeposits();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return syncErrorResponse(error);
  }
}
