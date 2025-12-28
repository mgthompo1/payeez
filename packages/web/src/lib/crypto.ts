import crypto from 'crypto'

const VERSION = 'v1'
const IV_LENGTH = 12

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptJson(payload: Record<string, unknown>): string {
  const secret = process.env.PAYEEZ_CREDENTIALS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYEEZ_CREDENTIALS_ENCRYPTION_KEY is not set')
  }

  const iv = crypto.randomBytes(IV_LENGTH)
  const key = deriveKey(secret)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${VERSION}:${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')}`
}
