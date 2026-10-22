import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/current-user";
import { findTransferRecipient, parseTransferAddress } from "@/lib/member-transfer";
import { requireTransferOrigin, transferFailure, transferPool } from "@/lib/member-transfer-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireTransferOrigin(request);
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({success:false,error:"AUTH_REQUIRED"},{status:401});
    const body = await request.json();
    const { network,address } = parseTransferAddress(body.network,body.address);
    const recipient = await findTransferRecipient(transferPool,user.id,network,address);
    return NextResponse.json({success:true,recipient});
  } catch (error) { return transferFailure(error); }
}
