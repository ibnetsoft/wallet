import crypto from 'crypto';

const secret = 'test-secret-key-12345';

function generateToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token) {
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (signature !== expectedSignature) return null;
  return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
}

const payload = { userId: '123-abc', expiresAt: Date.now() + 10000 };
const token = generateToken(payload);
console.log('Token:', token);
console.log('Verified:', verifyToken(token));
