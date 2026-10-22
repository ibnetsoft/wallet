import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/current-user";
import { executeMemberTransfer, parseTransferAddress, parseTransferAmount, requireUuid } from "@/lib/member-transfer";
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
    const amount = parseTransferAmount(body.amount);
    const requestId = requireUuid(body.requestId);
    const recipientId = requireUuid(body.recipientId);
    const client = await transferPool.connect();
    try {
      const transfer = await executeMemberTransfer(client,{senderId:user.id,recipientId,requestId,network,address,amount});
      return NextResponse.json({success:true,transfer});
    } finally { client.release(); }
  } catch (error) { return transferFailure(error); }
}
