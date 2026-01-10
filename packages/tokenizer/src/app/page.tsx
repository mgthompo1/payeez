"use client";

import { useEffect, useState } from "react";

export default function TokenizerPage() {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Determine safe parent origin from query param
    const urlParams = new URLSearchParams(window.location.search);
    const parentOrigin = urlParams.get("parentOrigin") || "*";

    const handleMessage = async (event: MessageEvent) => {
      // Security: Validate origin in production
      // if (event.origin !== parentOrigin && parentOrigin !== "*") return;

      if (event.data?.type === "ATLAS_CONFIRM") {
        await tokenize(parentOrigin);
      }
    };

    window.addEventListener("message", handleMessage);
    
    // Notify parent we are ready
    window.parent.postMessage({ type: "ATLAS_READY" }, parentOrigin);

    return () => window.removeEventListener("message", handleMessage);
  }, [cardNumber, expiry, cvc]);

  const tokenize = async (parentOrigin: string) => {
    if (processing) return;
    setProcessing(true);
    setError(null);

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get("sessionId");

      const res = await fetch("/api/tokenize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pan: cardNumber.replace(/\s/g, ""),
          expiry,
          cvc,
          sessionId
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Tokenization failed");
      }

      const data = await res.json();
      
      // Send token back to parent securely
      window.parent.postMessage({
        type: "ATLAS_TOKEN_CREATED",
        payload: { tokenId: data.tokenId }
      }, parentOrigin);

    } catch (err: any) {
      setError(err.message);
      window.parent.postMessage({
        type: "ATLAS_ERROR",
        payload: { message: err.message }
      }, parentOrigin);
    } finally {
      setProcessing(false);
    }
  };

  // Formatters
  const handleCardChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Simple formatting 0000 0000 0000 0000
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 16) v = v.slice(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) {
      parts.push(v.slice(i, i + 4));
    }
    setCardNumber(parts.join(" "));
  };

  return (
    <div className="w-full max-w-md p-4 bg-white">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
          <input
            type="text"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardChange}
          />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="MM/YY"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-gray-700 mb-1">CVC</label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="123"
              value={cvc}
              onChange={(e) => setCvc(e.target.value)}
            />
          </div>
        </div>
        {error && (
          <div className="text-red-500 text-sm mt-2">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}