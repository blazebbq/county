"use client";

import React, { useState } from "react";

const MIN_PIN_LENGTH = 4;

interface DesignSpec {
  intentSummary?: string;
  metal?: { type: string; finish: string } | null;
  ringSize?: { system: string; value: string } | null;
  stones?: { kind: string; tier: string; list: unknown[] } | null;
  complexity?: string | null;
  styleTags?: string[];
}

interface Costing {
  metalCost: number;
  stoneCost: number;
  labourCost: number;
  overhead: number;
  totalCost: number;
  assumptions: string[];
  timestamp: string;
}

interface StaffSession {
  transcript: Array<{ role: string; content: string }>;
  designSpec: DesignSpec | null;
  quote: {
    retailPriceGBP: number;
    staffOnlyCosting: Costing;
  } | null;
  imageRefs: string[];
  customerEmail: string | null;
  status: string;
  createdAt: string;
}

interface StaffPanelProps {
  sessionId: string;
  onClose: () => void;
}

export default function StaffPanel({ sessionId, onClose }: StaffPanelProps) {
  const [step, setStep] = useState<"pin" | "view">("pin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<StaffSession | null>(null);

  const handleUnlock = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        setError("Incorrect PIN. Please try again.");
        setPin("");
        return;
      }

      // Fetch session data
      const dataRes = await fetch(`/api/admin/session/${sessionId}`);
      if (dataRes.ok) {
        const data = await dataRes.json() as { session: StaffSession };
        setSessionData(data.session);
      }

      setStep("view");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePinKey = (digit: string) => {
    if (pin.length < 12) setPin((p) => p + digit);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-stone-900 border border-stone-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {step === "pin" ? (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-gold-400 mb-2 text-center">Staff Access</h2>
            <p className="text-stone-500 text-center mb-8">Enter your PIN to view session details</p>

            {/* PIN display */}
            <div className="flex justify-center gap-3 mb-6">
              {Array.from({ length: Math.max(MIN_PIN_LENGTH, pin.length) }).map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl transition-colors ${
                    i < pin.length ? "border-gold-500 bg-gold-900/30 text-gold-400" : "border-stone-700 bg-stone-800"
                  }`}
                >
                  {i < pin.length ? "●" : ""}
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-center text-sm mb-4">{error}</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    if (d === "⌫") setPin((p) => p.slice(0, -1));
                    else if (d) handlePinKey(d);
                  }}
                  disabled={!d}
                  className={`py-4 rounded-xl text-xl font-semibold transition-colors ${
                    d === "⌫"
                      ? "bg-stone-800 hover:bg-stone-700 text-stone-400"
                      : d
                        ? "bg-stone-800 hover:bg-stone-700 text-stone-100"
                        : "invisible"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl py-3 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleUnlock()}
                disabled={pin.length < MIN_PIN_LENGTH || loading}
                className="flex-1 bg-gold-600 hover:bg-gold-500 disabled:opacity-40 text-white rounded-xl py-3 font-semibold transition-colors"
              >
                {loading ? "Checking…" : "Unlock"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gold-400">Session Details</h2>
              <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-2xl">×</button>
            </div>

            <div className="bg-stone-800 rounded-xl p-4">
              <p className="text-stone-400 text-xs mb-1">Session ID</p>
              <p className="text-stone-200 font-mono text-sm">{sessionId}</p>
            </div>

            {sessionData?.designSpec && (
              <div className="bg-stone-800 rounded-xl p-4 space-y-2">
                <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Design Spec</h3>
                {sessionData.designSpec.intentSummary && (
                  <p className="text-stone-300 text-sm">{sessionData.designSpec.intentSummary}</p>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                  {sessionData.designSpec.metal && (
                    <>
                      <span className="text-stone-500">Metal:</span>
                      <span className="text-stone-200">{sessionData.designSpec.metal.type}</span>
                    </>
                  )}
                  {sessionData.designSpec.ringSize && (
                    <>
                      <span className="text-stone-500">Ring Size:</span>
                      <span className="text-stone-200">{sessionData.designSpec.ringSize.system} {sessionData.designSpec.ringSize.value}</span>
                    </>
                  )}
                  {sessionData.designSpec.complexity && (
                    <>
                      <span className="text-stone-500">Complexity:</span>
                      <span className="text-stone-200">{sessionData.designSpec.complexity}</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {sessionData?.quote?.staffOnlyCosting && (
              <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4 space-y-2">
                <h3 className="text-red-400 font-semibold text-sm uppercase tracking-widest">Cost Breakdown (Staff Only)</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Metal Cost", `£${sessionData.quote.staffOnlyCosting.metalCost}`],
                    ["Stone Cost", `£${sessionData.quote.staffOnlyCosting.stoneCost}`],
                    ["Labour", `£${sessionData.quote.staffOnlyCosting.labourCost}`],
                    ["Overhead", `£${sessionData.quote.staffOnlyCosting.overhead}`],
                    ["Total Cost", `£${sessionData.quote.staffOnlyCosting.totalCost}`],
                    ["Retail Price", `£${sessionData.quote.retailPriceGBP}`],
                  ].map(([label, value], idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-stone-500">{label}:</span>
                      <span className="text-stone-200 font-medium">{value}</span>
                    </React.Fragment>
                  ))}
                </div>
                <div className="mt-3 space-y-1">
                  {sessionData.quote.staffOnlyCosting.assumptions.map((a, i) => (
                    <p key={i} className="text-stone-600 text-xs">• {a}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-stone-800 rounded-xl p-4">
              <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-2">Conversation</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessionData?.transcript.map((msg, i) => (
                  <div key={i} className="text-xs">
                    <span className={`font-medium ${msg.role === "user" ? "text-gold-400" : "text-stone-400"}`}>
                      {msg.role === "user" ? "Customer: " : "Assistant: "}
                    </span>
                    <span className="text-stone-300 whitespace-pre-wrap">{msg.content.slice(0, 200)}{msg.content.length > 200 ? "…" : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl py-3 font-medium transition-colors"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
