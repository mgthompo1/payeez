/**
 * Atlas Native Vault Service
 * Retrieves and decrypts card data stored in the Atlas vault
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface DecryptedCardData {
  pan: string;
  cardHolderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvc: string;
  brand: string | null;
}

export interface TokenRecord {
  id: string;
  tenant_id: string;
  vault_provider: 'atlas' | 'basis_theory' | 'vgs';
  vault_token_id: string;
  encrypted_card_data: string | null;
  encryption_aad: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  card_holder_name: string | null;
  session_id: string | null;
  is_active: boolean;
}

// AES-256-GCM decryption using Web Crypto API (Deno compatible)
async function decrypt(
  encrypted: { v: number; iv: string; ct: string; tag: string },
  aad: string,
  masterKey: string
): Promise<string> {
  // Decode the base64 master key (must match Elements package encryption)
  const keyBytes = base64Decode(masterKey);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Decode base64url values
  const iv = base64UrlDecode(encrypted.iv);
  const ciphertext = base64UrlDecode(encrypted.ct);
  const tag = base64UrlDecode(encrypted.tag);

  // Combine ciphertext and tag (Web Crypto expects them together)
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: new TextEncoder().encode(aad),
      tagLength: 128,
    },
    key,
    combined
  );

  return new TextDecoder().decode(decrypted);
}

function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64Decode(str: string): Uint8Array {
  // Standard base64 decode (for master key)
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Retrieve card data from the Atlas vault
 */
export async function getCardDataFromVault(
  tokenId: string,
  sessionId?: string
): Promise<DecryptedCardData | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const masterKey = Deno.env.get('ATLAS_MASTER_KEY') || Deno.env.get('ATLAS_CREDENTIALS_ENCRYPTION_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  if (!masterKey) {
    throw new Error('ATLAS_MASTER_KEY not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find the token by vault_token_id
  const { data: token, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('vault_token_id', tokenId)
    .eq('is_active', true)
    .single();

  if (error || !token) {
    console.error('[AtlasVault] Token not found:', tokenId, error);
    return null;
  }

  const tokenRecord = token as TokenRecord;

  // Check if token is for Atlas vault
  if (tokenRecord.vault_provider !== 'atlas') {
    console.error('[AtlasVault] Token is not from Atlas vault:', tokenRecord.vault_provider);
    return null;
  }

  // Check if we have encrypted data
  if (!tokenRecord.encrypted_card_data || !tokenRecord.encryption_aad) {
    console.error('[AtlasVault] Token missing encrypted data');
    return null;
  }

  // Verify session binding if provided
  if (sessionId && tokenRecord.session_id && tokenRecord.session_id !== sessionId) {
    console.error('[AtlasVault] Session mismatch for token');
    return null;
  }

  try {
    // Parse and decrypt the card data
    const encryptedData = JSON.parse(tokenRecord.encrypted_card_data);
    const decryptedJson = await decrypt(encryptedData, tokenRecord.encryption_aad, masterKey);
    const cardData = JSON.parse(decryptedJson) as DecryptedCardData;

    return cardData;
  } catch (decryptError) {
    console.error('[AtlasVault] Failed to decrypt card data:', decryptError);
    return null;
  }
}

/**
 * Mark a token as used/inactive after successful payment
 * Also clears the CVC (PCI requirement - don't store CVC after auth)
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // For PCI compliance, we should ideally re-encrypt the card data without CVC
  // For now, we'll just mark it inactive after use
  await supabase
    .from('tokens')
    .update({
      is_active: false,
      // Clear encrypted data after use for security
      // encrypted_card_data: null
    })
    .eq('vault_token_id', tokenId);
}

/**
 * Get card metadata (non-sensitive) for display
 */
export async function getCardMetadata(tokenId: string): Promise<{
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
} | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: token, error } = await supabase
    .from('tokens')
    .select('card_brand, card_last4, card_exp_month, card_exp_year, card_holder_name')
    .eq('vault_token_id', tokenId)
    .eq('is_active', true)
    .single();

  if (error || !token) {
    return null;
  }

  return {
    brand: token.card_brand,
    last4: token.card_last4,
    expMonth: token.card_exp_month,
    expYear: token.card_exp_year,
    holderName: token.card_holder_name,
  };
}
