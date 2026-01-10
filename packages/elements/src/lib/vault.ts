import fs from 'fs';
import path from 'path';

const VAULT_FILE = path.join(process.cwd(), '../../../.gemini/tmp/vault.json');

// Ensure directory exists
const dir = path.dirname(VAULT_FILE);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export function saveToVault(tokenId: string, encryptedData: string, aad: string) {
  let vault: Record<string, { data: string; aad: string; created: number }> = {};
  
  if (fs.existsSync(VAULT_FILE)) {
    try {
      vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
    } catch (e) {
      console.warn('Failed to read vault file, starting fresh.');
    }
  }

  vault[tokenId] = {
    data: encryptedData, // This is the full JSON string of the Encrypted object
    aad,
    created: Date.now()
  };

  fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2));
}

export function getFromVault(tokenId: string) {
  if (!fs.existsSync(VAULT_FILE)) return null;
  const vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8'));
  return vault[tokenId];
}
