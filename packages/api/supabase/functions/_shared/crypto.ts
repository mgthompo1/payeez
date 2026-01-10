const encoder = new TextEncoder();
const decoder = new TextDecoder();

const VERSION_PREFIX = 'v1:';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function getEncryptionKey(): Promise<CryptoKey | null> {
  const secret = Deno.env.get('ATLAS_CREDENTIALS_ENCRYPTION_KEY');
  if (!secret) {
    return null;
  }

  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return await crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJson(payload: Record<string, unknown>): Promise<string> {
  const key = await getEncryptionKey();
  if (!key) {
    throw new Error('ATLAS_CREDENTIALS_ENCRYPTION_KEY is not set');
  }

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );

  const tag = encrypted.slice(encrypted.length - TAG_LENGTH);
  const ciphertext = encrypted.slice(0, encrypted.length - TAG_LENGTH);

  return [
    VERSION_PREFIX.slice(0, -1),
    encodeBase64(iv),
    encodeBase64(ciphertext),
    encodeBase64(tag),
  ].join(':');
}

export async function decryptJson(
  payload: string
): Promise<Record<string, unknown> | null> {
  if (!payload) {
    return null;
  }

  if (!payload.startsWith(VERSION_PREFIX)) {
    return JSON.parse(payload) as Record<string, unknown>;
  }

  const key = await getEncryptionKey();
  if (!key) {
    throw new Error('ATLAS_CREDENTIALS_ENCRYPTION_KEY is not set');
  }

  const parts = payload.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = decodeBase64(parts[1]);
  const ciphertext = decodeBase64(parts[2]);
  const tag = decodeBase64(parts[3]);

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  return JSON.parse(decoder.decode(decrypted)) as Record<string, unknown>;
}
