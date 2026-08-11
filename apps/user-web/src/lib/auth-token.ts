import crypto from "crypto";

type TokenPayload = Record<string, unknown> & {
  expiresAt: number;
};

function getAuthTokenSecret() {
  const secret = process.env.APP_AUTH_TOKEN_SECRET;

  if (!secret) {
    throw new Error("APP_AUTH_TOKEN_SECRET is required");
  }

  return secret;
}

export function signAuthToken(payload: TokenPayload) {
  const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(dataStr)
    .digest("base64url");

  return `${dataStr}.${signature}`;
}

export function verifyAuthToken<T extends TokenPayload>(token: string): T {
  const [dataStr, signature] = token.split(".");
  if (!dataStr || !signature) {
    throw new Error("Invalid token format");
  }

  const expectedSignature = crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(dataStr)
    .digest("base64url");

  if (signature !== expectedSignature) {
    throw new Error("Invalid token signature");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid token payload");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid token payload");
  }

  const typedPayload = payload as T;
  if (typeof typedPayload.expiresAt !== "number") {
    throw new Error("Invalid token expiry");
  }

  if (typedPayload.expiresAt < Date.now()) {
    throw new Error("Token expired");
  }

  return typedPayload;
}
