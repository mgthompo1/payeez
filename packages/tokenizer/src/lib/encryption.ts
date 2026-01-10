import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

// A consistent, insecure key for development only.
// This ensures tokens persist across server restarts during development.
const DEV_FALLBACK_KEY_BUFFER = crypto.createHash('sha256').update('ATLAS_INSECURE_DEV_SECRET').digest();

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function getKey(): Buffer {
  const raw = process.env.ATLAS_MASTER_KEY;

  // 1. Production Safety Check
  if (process.env.NODE_ENV === 'production') {
    if (!raw) {
      throw new Error("🚨 CRITICAL: ATLAS_MASTER_KEY is missing in production! System halting.");
    }
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new Error(`ATLAS_MASTER_KEY must decode to 32 bytes. Got ${key.length}.`);
    }
    return key;
  }

  // 2. Development Convenience
  if (!raw) {
    // Only warn once per process to avoid log spam, if possible.
    // Since Next.js might reload modules, we'll just log it.
    // Use a unique console group or color to make it obvious but not annoying.
    if (!global.hasWarnedEncryption) {
      console.warn("\n⚠️  [Atlas Security] Running in DEV mode with INSECURE fallback key.");
      console.warn("    Tokens will work locally but this key is NOT safe for real data.\n");
      global.hasWarnedEncryption = true;
    }
    return DEV_FALLBACK_KEY_BUFFER;
  }

  // 3. Manual Dev Key (if provided)
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`ATLAS_MASTER_KEY must decode to 32 bytes. Got ${key.length}.`);
  }
  return key;
}

// Global augmentation to prevent log spam in dev
declare global {
  var hasWarnedEncryption: boolean;
}

export type Encrypted = { v: 1; iv: string; ct: string; tag: string; kid?: string };

export function encrypt(plaintext: string, aad?: string): Encrypted {
  const key = getKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));

  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iv: b64url(iv),
    ct: b64url(ct),
    tag: b64url(tag),
    kid: process.env.ATLAS_KEY_ID || "dev",
  };
}

export function decrypt(enc: Encrypted, aad?: string): string {
  const key = getKey();
  const iv = fromB64url(enc.iv);
  const ct = fromB64url(enc.ct);
  const tag = fromB64url(enc.tag);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(tag);

  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

export function generateTokenId(): string {
  return `tok_${crypto.randomBytes(16).toString("hex")}`;
}
