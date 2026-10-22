import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/current-user";
import { ensureBscWallet, ensureTronWallet } from "@/lib/wallet-generation";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: "Authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const network = body?.network === "TRON" ? "TRON" : "BSC";
    const wallet = network === "TRON"
      ? await ensureTronWallet(user.id)
      : await ensureBscWallet(user.id);
    return NextResponse.json({
      success: true,
      address: wallet.address,
      derivation_index: wallet.derivationIndex,
      chain_type: wallet.chainType,
      existing: wallet.existing,
    });
  } catch (error: unknown) {
    console.error("Wallet generation error:", error);
    const unavailable = error instanceof Error && error.message === "Wallet service is unavailable";
    return NextResponse.json(
      { success: false, error: unavailable ? "Wallet service is unavailable" : "Failed to generate wallet" },
      { status: unavailable ? 503 : 500 }
    );
  }
}
