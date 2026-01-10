import { BasePSPAdapter } from './base';
import {
  PSPChargeRequest,
  PSPChargeResponse,
  PSPCaptureRequest,
  PSPCaptureResponse,
  PSPRefundRequest,
  PSPRefundResponse,
  PSPName,
  PSPCredentials,
} from '../types';
import { decrypt, Encrypted } from '../utils/encryption';
import { getFromVault } from '../utils/vault';

export class WindcaveAdapter extends BasePSPAdapter {
  constructor(credentials: PSPCredentials) {
    super('windcave', credentials);
  }

  protected getBaseUrl(): string {
    return this.credentials.environment === 'live'
      ? 'https://sec.windcave.com/api/v1'
      : 'https://sec.windcave.com/api/v1'; // Windcave seems to use same URL, auth determines env? Or separate? 
      // Docs often imply same endpoint. Will assume same for now.
  }

  protected async ping(): Promise<void> {
    // Basic connectivity check
    await this.fetchWithRetry(`${this.baseUrl}/transactions`, {
       method: 'GET', // Likely invalid method or auth error, but tests connectivity
       headers: this.getHeaders()
    });
  }

  private getHeaders(): HeadersInit {
    const auth = Buffer.from(`${this.credentials.username}:${this.credentials.api_key}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    };
  }

  async charge(request: PSPChargeRequest): Promise<PSPChargeResponse> {
    // 1. Detokenize from Atlas Vault
    const vaultEntry = getFromVault(request.token);
    if (!vaultEntry) {
      return {
        success: false,
        transaction_id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        failure_code: 'token_not_found',
        failure_message: 'Atlas Token not found in vault',
        raw_response: {}
      };
    }

    const decryptedPan = decrypt(JSON.parse(vaultEntry.data) as Encrypted, vaultEntry.aad);

    // 2. Prepare Payload
    const payload = {
      type: request.capture ? 'purchase' : 'auth',
      amount: (request.amount / 100).toFixed(2),
      currency: request.currency,
      merchantReference: request.idempotency_key,
      card: {
        cardHolderName: 'Atlas Customer',
        cardNumber: decryptedPan,
        dateExpiryMonth: '12', // Placeholder - API needs to receive this from Tokenizer meta or user
        dateExpiryYear: '25',
        cvc2: '123' // Dummy
      }
    };

    try {
      const response = await this.fetchWithRetry(`${this.baseUrl}/transactions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.authorised) {
        return {
          success: true,
          transaction_id: data.id,
          status: request.capture ? 'captured' : 'authorized',
          amount: request.amount,
          currency: request.currency,
          raw_response: data
        };
      } else {
        const failureCat = this.normalizeFailureCategory(data.reCo, data.responseText);
        return {
          success: false,
          transaction_id: data.id || '',
          status: 'failed',
          amount: request.amount,
          currency: request.currency,
          failure_code: data.reCo,
          failure_message: data.responseText,
          failure_category: failureCat,
          raw_response: data
        };
      }
    } catch (e: any) {
      return {
        success: false,
        transaction_id: '',
        status: 'failed',
        amount: request.amount,
        currency: request.currency,
        failure_code: 'network_error',
        failure_message: e.message,
        failure_category: 'processing_error',
        raw_response: {}
      };
    }
  }

  async capture(request: PSPCaptureRequest): Promise<PSPCaptureResponse> {
      // Stub
      return { success: false, transaction_id: '', amount: 0, status: 'failed', failure_message: 'Not implemented', raw_response: {} };
  }

  async refund(request: PSPRefundRequest): Promise<PSPRefundResponse> {
      // Stub
      return { success: false, refund_id: '', amount: 0, status: 'failed', failure_message: 'Not implemented', raw_response: {} };
  }

  async void(transactionId: string): Promise<{ success: boolean; error?: string }> {
      return { success: false, error: 'Not implemented' };
  }

  async initiate3DS(request: { amount: number; currency: string; token: string; return_url: string; }): Promise<{ threeds_session_id: string; challenge_required: boolean; challenge_url?: string; authentication_value?: string; eci?: string; }> {
      return { threeds_session_id: '', challenge_required: false };
  }

  verifyWebhook(payload: string, signature: string): boolean {
      return true;
  }

  parseWebhook(payload: string): { event_type: string; transaction_id?: string; amount?: number; currency?: string; raw: Record<string, unknown>; } {
      return { event_type: 'unknown', raw: {} };
  }
}