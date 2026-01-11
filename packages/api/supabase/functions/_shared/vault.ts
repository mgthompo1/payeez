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
 * Clears sensitive data (CVC) per PCI DSS requirement 3.2.2:
 * "Do not store the card verification code after authorization"
 */
export async function markTokenUsed(tokenId: string): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const masterKey = Deno.env.get('ATLAS_MASTER_KEY') || Deno.env.get('ATLAS_CREDENTIALS_ENCRYPTION_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // For PCI compliance, we need to re-encrypt card data without CVC
  // First, get the current token
  const { data: token, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('vault_token_id', tokenId)
    .single();

  if (error || !token) {
    console.error('[AtlasVault] Token not found for cleanup:', tokenId);
    return;
  }

  // If this is an Atlas vault token and we have the master key, re-encrypt without CVC
  if (token.vault_provider === 'atlas' && token.encrypted_card_data && token.encryption_aad && masterKey) {
    try {
      // Decrypt current data
      const encryptedData = JSON.parse(token.encrypted_card_data);
      const decryptedJson = await decrypt(encryptedData, token.encryption_aad, masterKey);
      const cardData = JSON.parse(decryptedJson) as DecryptedCardData;

      // Remove CVC from card data
      const sanitizedData = {
        pan: cardData.pan,
        cardHolderName: cardData.cardHolderName,
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        cvc: '', // Clear CVC
        brand: cardData.brand,
      };

      // Re-encrypt without CVC using Web Crypto (Deno compatible)
      const newAad = `${token.encryption_aad}|sanitized`;
      const reencrypted = await encryptData(JSON.stringify(sanitizedData), newAad, masterKey);

      // Update token with sanitized data
      await supabase
        .from('tokens')
        .update({
          encrypted_card_data: JSON.stringify(reencrypted),
          encryption_aad: newAad,
          is_active: false, // Mark as used
        })
        .eq('vault_token_id', tokenId);

      console.log('[AtlasVault] Token sanitized (CVC cleared):', tokenId);
    } catch (sanitizeError) {
      console.error('[AtlasVault] Failed to sanitize token, clearing entirely:', sanitizeError);
      // If re-encryption fails, just clear the encrypted data entirely
      await supabase
        .from('tokens')
        .update({
          encrypted_card_data: null,
          is_active: false,
        })
        .eq('vault_token_id', tokenId);
    }
  } else {
    // For non-Atlas tokens, just mark as inactive
    await supabase
      .from('tokens')
      .update({ is_active: false })
      .eq('vault_token_id', tokenId);
  }
}

/**
 * Encrypt data using AES-256-GCM (inverse of decrypt function)
 */
async function encryptData(
  plaintext: string,
  aad: string,
  masterKey: string
): Promise<{ v: number; iv: string; ct: string; tag: string }> {
  const keyBytes = base64Decode(masterKey);

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: new TextEncoder().encode(aad),
      tagLength: 128,
    },
    key,
    encoded
  );

  // Web Crypto returns ciphertext + tag combined
  const combined = new Uint8Array(encrypted);
  const ciphertext = combined.slice(0, combined.length - 16);
  const tag = combined.slice(combined.length - 16);

  return {
    v: 1,
    iv: base64UrlEncode(iv),
    ct: base64UrlEncode(ciphertext),
    tag: base64UrlEncode(tag),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
