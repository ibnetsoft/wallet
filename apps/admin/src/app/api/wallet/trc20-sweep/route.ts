import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";
import { sweepPool, sweepDashboard, previewSweep, createSweep, advanceSweep, saveSweepSettings, SweepError } from "@/lib/trc20-sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const admin = await getAdminUser();
  if (admin?.role !== 'SUPER_ADMIN') return NextResponse.json({success:false,error:'최고 관리자 권한이 필요합니다.'},{status:403});
  const client = await sweepPool.connect();
  try { return NextResponse.json({success:true,...await sweepDashboard(client)}); }
  catch { return NextResponse.json({success:false,error:'TRC20 모으기 설정을 읽지 못했습니다. DB 마이그레이션 적용 여부를 확인하세요.'},{status:503}); }
  finally { client.release(); }
}
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (admin?.role !== 'SUPER_ADMIN') return NextResponse.json({success:false,error:'최고 관리자 권한이 필요합니다.'},{status:403});
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({success:false,error:'요청 출처가 일치하지 않습니다.'},{status:403});
  const client = await sweepPool.connect();
  try {
    const input = await request.json();
    if (input.action === 'PREVIEW') return NextResponse.json({success:true,preview:await previewSweep(client,input.walletId)});
    if (input.action === 'CONFIGURE') { await saveSweepSettings(client,input); return NextResponse.json({success:true}); }
    if (input.action === 'EXECUTE') {
      const id = await createSweep(client,input,admin.id);
      return NextResponse.json({success:true,...await advanceSweep(client,id)});
    }
    if (input.action === 'RESUME') return NextResponse.json({success:true,...await advanceSweep(client,input.requestId)});
    throw new SweepError('지원하지 않는 요청입니다.');
  } catch (error) {
    return NextResponse.json({success:false,error:error instanceof SweepError ? error.message : '요청을 처리하지 못했습니다. 기존 모으기 내역을 확인하세요.'},{status:error instanceof SweepError ? error.status : 500});
  } finally { client.release(); }
}
