import { NextRequest, NextResponse } from "next/server";
import { encrypt, generateTokenId } from "@/lib/encryption";
import { saveToVault } from "@/lib/vault";

export const runtime = "nodejs";

function allowedOrigins(): string[] {
  const raw = process.env.ATLAS_ALLOWED_ORIGINS?.trim();
  if (raw) return raw.split(",").map(s => s.trim()).filter(Boolean);

  // In dev, allow localhost:3000-3010 to make it easy to run locally
  if (process.env.NODE_ENV !== 'production') {
     return [
       "http://localhost:3000",
       "http://localhost:3001",
       "http://localhost:3002",
       // Add more if needed or just rely on manual env var for strictness
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
    const { pan, expiry, cvc, sessionId } = body ?? {};

    if (!pan || !expiry || !cvc) {
      return NextResponse.json({ message: "Invalid card data" }, { status: 400, headers: c.headers });
    }

    const tokenId = generateTokenId();
    const origin = req.headers.get("origin") || "no-origin";

    // Bind encryption to origin (AAD). If origin changes, decrypt fails.
    const aad = `origin:${origin}|session:${sessionId || "none"}|token:${tokenId}`;

    // Encrypt PAN only (prototype). Do not store CVC.
    const encryptedPan = encrypt(String(pan), aad);

    // Save to Mock Vault (File-based) so API can retrieve it
    saveToVault(tokenId, JSON.stringify(encryptedPan), aad);

    // NEVER log PAN/CVC. This log is safe.
    console.log(`[AtlasTokenizer] token created ${tokenId}`);

    return NextResponse.json(
      {
        tokenId,
        status: "created",
        last4: String(pan).replace(/\s+/g, "").slice(-4),
        expiry,
        // you may also want to return a "brand" (visa/mastercard) later
      },
      { status: 200, headers: c.headers }
    );
  } catch {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500, headers: c.headers });
  }
}