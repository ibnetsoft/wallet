import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron-auth";
import { sweepPool } from "@/lib/trc20-sweep";
import { runAutomaticSweeps } from "@/lib/trc20-sweep-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function HEAD(request:Request) {
  return new NextResponse(null,{status:isCronRequest(request)?204:401});
}
export async function GET(request:Request) {
  if (!isCronRequest(request)) return NextResponse.json({success:false,error:'Unauthorized'},{status:401});
  const client=await sweepPool.connect();
  try { return NextResponse.json({success:true,result:await runAutomaticSweeps(client)}); }
  catch(error) {
    console.error('Automatic TRC20 collection worker failed',error);
    return NextResponse.json({success:false,error:'TRC20 automatic collection will retry on the next scheduled run.'},{status:503});
  } finally { client.release(); }
}
