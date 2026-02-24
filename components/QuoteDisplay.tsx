"use client";

import { useState } from "react";

interface CustomerQuote {
  retailPriceGBP: number;
  retailRangeGBP: { min: number; max: number };
  estimateDisclaimer: string;
  customerFacingSummary: {
    metal: string;
    stones: string;
    ringSize: string;
    style: string;
    leadTime: string;
  };
}

interface QuoteDisplayProps {
  quote: CustomerQuote;
  sessionId: string;
  renderImageUrl?: string | null;
  onDownloadPdf: () => void;
  onReset: () => void;
}

export default function QuoteDisplay({ quote, sessionId, renderImageUrl, onDownloadPdf, onReset }: QuoteDisplayProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const summaryRows: [string, string][] = [
    ["Metal", quote.customerFacingSummary.metal],
    ["Stones", quote.customerFacingSummary.stones],
    ["Ring Size", quote.customerFacingSummary.ringSize],
    ["Style", quote.customerFacingSummary.style],
    ["Lead Time", quote.customerFacingSummary.leadTime],
  ];

  const handleProceedWithQuote = async () => {
    setSubmitError("");
    if (!customerName.trim()) {
      setSubmitError("Please enter your name.");
      return;
    }
    if (!customerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      setSubmitError("Please enter a valid email address.");
      return;
    }
    if (!quote.retailPriceGBP) {
      setSubmitError("No price estimate available. Please generate a quote first.");
      return;
    }

    setSubmitting(true);
    try {
      // Load recipient email from localStorage (set in Staff Panel)
      const recipientEmail =
        typeof window !== "undefined"
          ? (localStorage.getItem("staff_recipient_email") ?? undefined)
          : undefined;

      const res = await fetch(`/api/session/${sessionId}/submit-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          renderImageUrl: renderImageUrl ?? undefined,
          recipientEmail,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed to submit");
      }

      setSubmitSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 text-center min-h-64">
        <div className="text-5xl">✅</div>
        <h3 className="text-stone-100 text-xl font-semibold">Quote Submitted!</h3>
        <p className="text-stone-400 text-base max-w-sm">
          Thank you, {customerName}! Your design details and quote have been saved. A member of staff will be in touch.
        </p>
        <button
          onClick={onReset}
          className="mt-4 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl px-6 py-3 font-medium transition-colors border border-stone-700"
        >
          Start New Design
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Price hero */}
      <div className="text-center bg-stone-800 border border-stone-600 rounded-2xl p-6" style={{ borderColor: "var(--color-primary)" }}>
        <p className="text-stone-400 text-sm uppercase tracking-widest mb-1">Estimated Price</p>
        <p className="text-5xl font-bold" style={{ color: "var(--color-primary)" }}>
          £{quote.retailPriceGBP.toLocaleString()}
        </p>
        <p className="text-stone-400 text-sm mt-2">
          Range: £{quote.retailRangeGBP.min.toLocaleString()} – £{quote.retailRangeGBP.max.toLocaleString()}
        </p>
      </div>

      {/* Summary */}
      <div className="bg-stone-800/50 rounded-xl border border-stone-700 overflow-hidden">
        <div className="px-4 py-3 bg-stone-800 border-b border-stone-700">
          <h3 className="font-semibold text-sm uppercase tracking-widest" style={{ color: "var(--color-primary)" }}>Your Design</h3>
        </div>
        <div className="divide-y divide-stone-700/50">
          {summaryRows.map(([label, value]) => (
            <div key={label} className="flex justify-between items-center px-4 py-3">
              <span className="text-stone-400 text-sm">{label}</span>
              <span className="text-stone-100 font-medium text-sm text-right max-w-[60%]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="bg-stone-900 border border-stone-700 rounded-xl p-4">
        <p className="text-stone-500 text-xs leading-relaxed">{quote.estimateDisclaimer}</p>
      </div>

      {/* Customer details form */}
      <div className="bg-stone-800/50 rounded-xl border border-stone-700 p-4 space-y-3">
        <h3 className="font-semibold text-sm uppercase tracking-widest mb-1" style={{ color: "var(--color-accent)" }}>
          Your Details
        </h3>
        <div>
          <label className="block text-stone-400 text-xs mb-1">Your Name *</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Full name"
            className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-gold-500 text-base transition-colors"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          />
        </div>
        <div>
          <label className="block text-stone-400 text-xs mb-1">Email Address *</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-gold-500 text-base transition-colors"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          />
        </div>
        {submitError && (
          <p className="text-red-400 text-sm">{submitError}</p>
        )}
        <button
          onClick={() => void handleProceedWithQuote()}
          disabled={submitting}
          className="w-full rounded-xl py-4 font-semibold text-base transition-colors text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--color-button)" }}
        >
          {submitting ? "Submitting…" : "📋 Proceed With Quote"}
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <a
          href={`/api/session/${sessionId}/pdf`}
          onClick={onDownloadPdf}
          className="w-full flex items-center justify-center gap-2 text-white rounded-xl py-4 font-semibold text-base transition-colors"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          📄 Download PDF Estimate
        </a>

        <button
          onClick={onReset}
          className="w-full bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl py-4 font-medium text-base transition-colors border border-stone-700"
        >
          Start New Design
        </button>
      </div>

      <div className="text-center">
        <p className="text-stone-600 text-xs">
          No obligation. A member of staff will be happy to discuss your design in detail.
        </p>
      </div>
    </div>
  );
}

