import { NextResponse } from "next/server";
import { Wallet } from "ethers";
import { getVerifiedAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await request.json().catch(() => ({}));
    const privateKey = process.env.MASTER_HOT_WALLET_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ success: false, error: "MASTER_HOT_WALLET_PRIVATE_KEY server environment variable is missing." }, { status: 503 });
    }

    return NextResponse.json({ success: true, address: new Wallet(privateKey).address });
  } catch (err: any) {
    console.error("wallet/setup route error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
