import { NextRequest, NextResponse } from "next/server";
import { encrypt, generateTokenId } from "@/lib/encryption";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Initialize Supabase client (service role for token storage)
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase credentials not configured");
  }

  return createClient(url, key, {
    auth: { persistSession: false }
  });
}

function allowedOrigins(): string[] {
  const raw = process.env.ATLAS_ALLOWED_ORIGINS?.trim();
  if (raw) return raw.split(",").map(s => s.trim()).filter(Boolean);

  // In dev, allow localhost:3000-3010 to make it easy to run locally
  if (process.env.NODE_ENV !== 'production') {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
    ];
  }
  return [];
}

function cors(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  const allowed = allowedOrigins();
  const ok = allowed.includes(origin);

  return {
    ok,
    headers: {
      "Access-Control-Allow-Origin": ok ? origin : "null",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
      "Cache-Control": "no-store",
    }
  };
}

export async function OPTIONS(req: NextRequest) {
  const c = cors(req);
  return new NextResponse(null, { status: 204, headers: c.headers });
}

export async function POST(req: NextRequest) {
  const c = cors(req);
  if (!c.ok) {
    return NextResponse.json({ message: "Origin not allowed" }, { status: 403, headers: c.headers });
  }

  try {
    const body = await req.json();
    const {
      pan,
      cardHolderName,
      expiryMonth,
      expiryYear,
      cvc,
      sessionId,
      cardBrand
    } = body ?? {};

    // Validate required fields
    if (!pan || !expiryMonth || !expiryYear || !cvc) {
      return NextResponse.json(
        { message: "Invalid card data - missing required fields" },
        { status: 400, headers: c.headers }
      );
    }

    // Clean and validate PAN
    const cleanPan = String(pan).replace(/\s+/g, "");
    if (cleanPan.length < 13 || cleanPan.length > 19) {
      return NextResponse.json(
        { message: "Invalid card number length" },
        { status: 400, headers: c.headers }
      );
    }

    const tokenId = generateTokenId();
    const origin = req.headers.get("origin") || "no-origin";

    // Create AAD (Additional Authenticated Data) for encryption binding
    // This ensures the encrypted data can only be decrypted with the same context
    const aad = `origin:${origin}|session:${sessionId || "none"}|token:${tokenId}`;

    // Build card data object for encryption
    const cardData = {
      pan: cleanPan,
      cardHolderName: cardHolderName || "",
      expiryMonth: String(expiryMonth).padStart(2, '0'),
      expiryYear: String(expiryYear).slice(-2),
      cvc: String(cvc),
      brand: cardBrand || null,
    };

    // Encrypt the full card data
    const encryptedCardData = encrypt(JSON.stringify(cardData), aad);

    // Store in Supabase (Atlas Vault)
    try {
      const supabase = getSupabaseClient();

      // SECURITY: sessionId is required to establish tenant context
      // Without it, we cannot securely associate the token with a tenant
      if (!sessionId) {
        // In production, require sessionId to prevent cross-tenant data leakage
        if (process.env.NODE_ENV === 'production') {
          console.error('[AtlasTokenizer] SECURITY: sessionId required in production');
          return NextResponse.json(
            { message: "Session ID is required for tokenization" },
            { status: 400, headers: c.headers }
          );
        }
        // In development, warn but continue with a dev-only token
        console.warn('[AtlasTokenizer] DEV MODE: No sessionId provided - token will not be persisted');
        return NextResponse.json(
          {
            tokenId,
            status: "created",
            last4: cleanPan.slice(-4),
            expiryMonth: cardData.expiryMonth,
            expiryYear: `20${cardData.expiryYear}`,
            brand: cardBrand,
            _dev_warning: "Token not persisted - no sessionId provided"
          },
          { status: 200, headers: c.headers }
        );
      }

      // Get the tenant_id from the session
      const { data: session } = await supabase
        .from('payment_sessions')
        .select('tenant_id, status')
        .eq('id', sessionId)
        .single();

      if (!session) {
        console.error('[AtlasTokenizer] Session not found:', sessionId);
        return NextResponse.json(
          { message: "Invalid session ID" },
          { status: 400, headers: c.headers }
        );
      }

      // Verify session is in a state that accepts tokenization
      if (session.status !== 'requires_payment_method') {
        console.error('[AtlasTokenizer] Session in invalid state:', session.status);
        return NextResponse.json(
          { message: `Cannot tokenize for session in state: ${session.status}` },
          { status: 400, headers: c.headers }
        );
      }

      const tenantId = session.tenant_id;

      if (!tenantId) {
        console.error('[AtlasTokenizer] Session has no tenant_id:', sessionId);
        return NextResponse.json(
          { message: "Session configuration error" },
          { status: 500, headers: c.headers }
        );
      }

      // Insert token into Atlas vault
      const { error: insertError } = await supabase
        .from('tokens')
        .insert({
          tenant_id: tenantId,
          vault_provider: 'atlas',
          vault_token_id: tokenId,
          encrypted_card_data: JSON.stringify(encryptedCardData),
          encryption_aad: aad,
          card_brand: cardBrand || null,
          card_last4: cleanPan.slice(-4),
          card_exp_month: parseInt(cardData.expiryMonth, 10),
          card_exp_year: parseInt(`20${cardData.expiryYear}`, 10),
          card_holder_name: cardHolderName || null,
          session_id: sessionId || null,
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
          is_active: true,
        });

      if (insertError) {
        console.error('[AtlasTokenizer] Failed to store token:', insertError);
        return NextResponse.json(
          { message: "Failed to store token" },
          { status: 500, headers: c.headers }
        );
      }

    } catch (dbError: any) {
      console.error('[AtlasTokenizer] Database error:', dbError);
      // In dev mode, allow continuing without DB
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[AtlasTokenizer] DEV MODE: Continuing without database');
      } else {
        return NextResponse.json(
          { message: "Database error" },
          { status: 500, headers: c.headers }
        );
      }
    }

    // NEVER log PAN/CVC. This log is safe.
    console.log(`[AtlasTokenizer] Token created: ${tokenId} (brand: ${cardBrand || 'unknown'})`);

    return NextResponse.json(
      {
        tokenId,
        status: "created",
        last4: cleanPan.slice(-4),
        expiryMonth: cardData.expiryMonth,
        expiryYear: `20${cardData.expiryYear}`,
        brand: cardBrand,
      },
      { status: 200, headers: c.headers }
    );

  } catch (err: any) {
    console.error('[AtlasTokenizer] Unexpected error:', err);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500, headers: c.headers }
    );
  }
}
