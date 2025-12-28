/**
 * Chase Stratus (Orbital) PSP Adapter
 * Uses Basis Theory proxy to forward card data to Chase Paymentech
 *
 * Chase Orbital API Docs: https://developer.jpmorgan.com/
 */

export interface AuthorizeRequest {
  amount: number;
  currency: string;
  tokenId: string;
  idempotencyKey: string;
  capture: boolean;
  customerEmail?: string;
  metadata?: Record<string, string>;
}

export interface AuthorizeResponse {
  success: boolean;
  transactionId: string;
  status: 'authorized' | 'captured' | 'failed';
  card?: {
    brand?: string;
    last4?: string;
    exp_month?: number;
    exp_year?: number;
  };
  failureCode?: string;
  failureMessage?: string;
  rawResponse: unknown;
}

export const chaseAdapter = {
  name: 'chase' as const,

  async authorize(
    req: AuthorizeRequest,
    credentials: {
      orbital_connection_username: string;
      orbital_connection_password: string;
      merchant_id: string;
      terminal_id: string;
      environment?: 'test' | 'live';
    },
    basisTheoryApiKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://orbital1.chasepaymentech.com/authorize'
      : 'https://orbitalvar1.chasepaymentech.com/authorize';

    // Chase Orbital uses XML format
    const messageType = req.capture ? 'AC' : 'A'; // AC = Auth+Capture, A = Auth only

    // Use Basis Theory proxy with XML body
    const proxyResponse = await fetch('https://api.basistheory.com/proxy', {
      method: 'POST',
      headers: {
        'BT-API-KEY': basisTheoryApiKey,
        'BT-PROXY-URL': baseUrl,
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <NewOrder>
    <OrbitalConnectionUsername>${credentials.orbital_connection_username}</OrbitalConnectionUsername>
    <OrbitalConnectionPassword>${credentials.orbital_connection_password}</OrbitalConnectionPassword>
    <IndustryType>EC</IndustryType>
    <MessageType>${messageType}</MessageType>
    <BIN>000001</BIN>
    <MerchantID>${credentials.merchant_id}</MerchantID>
    <TerminalID>${credentials.terminal_id}</TerminalID>
    <AccountNum>{{${req.tokenId} | json: '$.number'}}</AccountNum>
    <Exp>{{${req.tokenId} | json: '$.expiration_month'}}{{${req.tokenId} | json: '$.expiration_year'}}</Exp>
    <CardSecVal>{{${req.tokenId} | json: '$.cvc'}}</CardSecVal>
    <CurrencyCode>${getCurrencyCode(req.currency)}</CurrencyCode>
    <CurrencyExponent>2</CurrencyExponent>
    <Amount>${req.amount}</Amount>
    <OrderID>${req.idempotencyKey}</OrderID>
  </NewOrder>
</Request>`,
    });

    const responseText = await proxyResponse.text();
    const result = parseXmlResponse(responseText);

    const respCode = result.RespCode;
    const isSuccess = respCode === '00' || respCode === '0';

    return {
      success: isSuccess,
      transactionId: result.TxRefNum || '',
      status: isSuccess ? (req.capture ? 'captured' : 'authorized') : 'failed',
      card: {
        last4: result.AccountNum?.slice(-4),
      },
      failureCode: isSuccess ? undefined : respCode,
      failureMessage: isSuccess ? undefined : result.StatusMsg || result.RespMsg,
      rawResponse: result,
    };
  },

  async capture(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      orbital_connection_username: string;
      orbital_connection_password: string;
      merchant_id: string;
      terminal_id: string;
      environment?: 'test' | 'live';
    }
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://orbital1.chasepaymentech.com/authorize'
      : 'https://orbitalvar1.chasepaymentech.com/authorize';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <MarkForCapture>
    <OrbitalConnectionUsername>${credentials.orbital_connection_username}</OrbitalConnectionUsername>
    <OrbitalConnectionPassword>${credentials.orbital_connection_password}</OrbitalConnectionPassword>
    <MerchantID>${credentials.merchant_id}</MerchantID>
    <TerminalID>${credentials.terminal_id}</TerminalID>
    <BIN>000001</BIN>
    <TxRefNum>${transactionId}</TxRefNum>
    <Amount>${amount}</Amount>
  </MarkForCapture>
</Request>`,
    });

    const responseText = await response.text();
    const result = parseXmlResponse(responseText);

    const respCode = result.RespCode;
    const isSuccess = respCode === '00' || respCode === '0';

    return {
      success: isSuccess,
      transactionId: result.TxRefNum || transactionId,
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.RespCode,
      failureMessage: result.StatusMsg,
      rawResponse: result,
    };
  },

  async refund(
    transactionId: string,
    amount: number,
    currency: string,
    credentials: {
      orbital_connection_username: string;
      orbital_connection_password: string;
      merchant_id: string;
      terminal_id: string;
      environment?: 'test' | 'live';
    },
    idempotencyKey: string
  ): Promise<AuthorizeResponse> {
    const baseUrl = credentials.environment === 'live'
      ? 'https://orbital1.chasepaymentech.com/authorize'
      : 'https://orbitalvar1.chasepaymentech.com/authorize';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="UTF-8"?>
<Request>
  <NewOrder>
    <OrbitalConnectionUsername>${credentials.orbital_connection_username}</OrbitalConnectionUsername>
    <OrbitalConnectionPassword>${credentials.orbital_connection_password}</OrbitalConnectionPassword>
    <IndustryType>EC</IndustryType>
    <MessageType>R</MessageType>
    <BIN>000001</BIN>
    <MerchantID>${credentials.merchant_id}</MerchantID>
    <TerminalID>${credentials.terminal_id}</TerminalID>
    <TxRefNum>${transactionId}</TxRefNum>
    <Amount>${amount}</Amount>
    <OrderID>${idempotencyKey}</OrderID>
  </NewOrder>
</Request>`,
    });

    const responseText = await response.text();
    const result = parseXmlResponse(responseText);

    const respCode = result.RespCode;
    const isSuccess = respCode === '00' || respCode === '0';

    return {
      success: isSuccess,
      transactionId: result.TxRefNum || '',
      status: isSuccess ? 'captured' : 'failed',
      failureCode: result.RespCode,
      failureMessage: result.StatusMsg,
      rawResponse: result,
    };
  },

  verifyWebhook(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      return signature.length > 0 && secret.length > 0;
    } catch {
      return false;
    }
  },

  normalizeWebhook(payload: any): {
    type: string;
    pspEventId: string;
    transactionId: string;
    amount?: number;
    currency?: string;
    failureCode?: string;
    failureMessage?: string;
  } {
    // Chase doesn't have webhooks in the traditional sense
    // Typically uses batch settlement files
    return {
      type: 'unknown',
      pspEventId: payload.id || '',
      transactionId: payload.TxRefNum || '',
      amount: payload.Amount ? parseInt(payload.Amount) : undefined,
      failureCode: payload.RespCode,
      failureMessage: payload.StatusMsg,
    };
  },
};

// Helper to get ISO 4217 numeric currency code
function getCurrencyCode(currency: string): string {
  const codes: Record<string, string> = {
    USD: '840',
    CAD: '124',
    GBP: '826',
    EUR: '978',
    AUD: '036',
    NZD: '554',
  };
  return codes[currency.toUpperCase()] || '840';
}

// Simple XML parser for Chase response
function parseXmlResponse(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  const tagRegex = /<(\w+)>([^<]*)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}
