"use client";

import { useState } from "react";

interface LeadCaptureProps {
  sessionId: string;
  onComplete: (firstName: string, email: string) => void;
}

export default function LeadCapture({ sessionId, onComplete }: LeadCaptureProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!firstName.trim()) { setError("Please enter your first name."); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address."); return;
    }
    if (!phone.trim() || phone.replace(/\D/g, "").length < 7) {
      setError("Please enter a valid phone number."); return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/lead/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), email: email.trim(), phone: phone.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Failed to save details");
      }

      onComplete(firstName.trim(), email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-stone-800 border border-stone-600 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 text-base focus:outline-none focus:border-amber-500 transition-colors";

  return (
    <div className="flex-1 flex items-center justify-center p-6" style={{ backgroundColor: "var(--color-background)" }}>
      <div className="w-full max-w-md bg-stone-900 rounded-2xl p-8 border border-stone-700 shadow-xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">💍</div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: "var(--color-primary)" }}>
            Let&apos;s Get Started
          </h2>
          <p className="text-stone-400 text-sm">
            Enter your details so we can send you your design summary and quote.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-stone-400 text-xs mb-1 uppercase tracking-widest">First Name *</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Your first name"
              className={inputClass}
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
              autoComplete="given-name"
            />
          </div>

          <div>
            <label className="block text-stone-400 text-xs mb-1 uppercase tracking-widest">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className={inputClass}
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-stone-400 text-xs mb-1 uppercase tracking-widest">Phone Number *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              className={inputClass}
              style={{ userSelect: "text", WebkitUserSelect: "text" }}
              autoComplete="tel"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="w-full rounded-xl py-4 text-base font-semibold text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: "var(--color-button)" }}
          >
            {submitting ? "Saving…" : "Start Designing ✨"}
          </button>

          <p className="text-stone-600 text-xs text-center">
            Your details are used only to send you your design summary. No spam.
          </p>
        </div>
      </div>
    </div>
  );
}
