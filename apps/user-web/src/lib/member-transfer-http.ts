import { NextResponse } from "next/server";
import { Pool } from "pg";
import { TransferError } from "./member-transfer";

export const transferPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

export function requireTransferOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || !request.headers.get("content-type")?.startsWith("application/json")) {
    throw new TransferError("INVALID_ORIGIN",403);
  }
}

export function transferFailure(error: unknown) {
  if (error instanceof TransferError) return NextResponse.json({success:false,error:error.code},{status:error.status});
  if (error instanceof SyntaxError) return NextResponse.json({success:false,error:"INVALID_REQUEST"},{status:400});
  console.error("Member transfer failed",error);
  return NextResponse.json({success:false,error:"TRANSFER_UNAVAILABLE"},{status:503});
}
