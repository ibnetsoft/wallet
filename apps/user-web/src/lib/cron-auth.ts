import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_SIGNATURE_AGE_MS = 3 * 60 * 1000;

function hasValidSignature(request: Request, secret: string) {
  const url = new URL(request.url);
  const timestamp = url.searchParams.get("cron_ts");
  const signature = url.searchParams.get("cron_sig");
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return false;
  }

  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_SIGNATURE_AGE_MS) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${url.pathname}:${timestamp}`)
    .digest("hex");
  if (signature.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function isCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`
    || request.headers.get("x-cron-secret") === secret
    || hasValidSignature(request, secret);
}
