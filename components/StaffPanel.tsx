"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";

const MIN_PIN_LENGTH = 4;

const DEFAULT_THEME = {
  primary: "#d4920f",
  accent: "#e8ad22",
  background: "#0c0a09",
  button: "#b5720b",
};

// Validate hex colour value to prevent malicious data from localStorage
const HexColour = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
const ThemeSchema = z.object({
  primary: HexColour,
  accent: HexColour,
  background: HexColour,
  button: HexColour,
}).partial();

function applyTheme(theme: typeof DEFAULT_THEME) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", theme.primary);
  root.style.setProperty("--color-accent", theme.accent);
  root.style.setProperty("--color-background", theme.background);
  root.style.setProperty("--color-button", theme.button);
}

function loadTheme(): typeof DEFAULT_THEME {
  try {
    const stored = localStorage.getItem("kiosk_theme");
    if (stored) {
      const parsed = ThemeSchema.safeParse(JSON.parse(stored) as unknown);
      if (parsed.success) return { ...DEFAULT_THEME, ...parsed.data };
    }
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

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

interface PdfTemplate {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  documentTitle: string;
  headingDesignSpecification: string;
  headingPriceEstimate: string;
  labelDescription: string;
  labelMetal: string;
  labelRingSize: string;
  labelStones: string;
  labelStyle: string;
  labelComplexity: string;
  labelEstimatedPrice: string;
  labelRange: string;
  labelLeadTime: string;
  disclaimerText: string;
  vatText: string;
}

const DEFAULT_PDF_TEMPLATE: PdfTemplate = {
  shopName: "Your Jewellery Shop",
  shopAddress: "",
  shopPhone: "",
  shopEmail: "",
  documentTitle: "Custom Ring Design Estimate",
  headingDesignSpecification: "DESIGN SPECIFICATION",
  headingPriceEstimate: "PRICE ESTIMATE",
  labelDescription: "Description",
  labelMetal: "Metal",
  labelRingSize: "Ring Size",
  labelStones: "Stones",
  labelStyle: "Style",
  labelComplexity: "Complexity",
  labelEstimatedPrice: "Estimated Price",
  labelRange: "Range",
  labelLeadTime: "Estimated Lead Time",
  disclaimerText:
    "This is an indicative estimate only. Final price may vary based on exact specifications, current material costs, and craftsperson assessment.",
  vatText: "VAT may apply. No obligation to purchase.",
};

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
  const [activeSection, setActiveSection] = useState<"session" | "theme" | "pdf">("session");
  const [theme, setTheme] = useState<typeof DEFAULT_THEME>(DEFAULT_THEME);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [metalRatesUpdatedAt, setMetalRatesUpdatedAt] = useState<string | null>(null);

  // PDF template state
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>(DEFAULT_PDF_TEMPLATE);
  const [pdfFetched, setPdfFetched] = useState(false);
  const [pdfSaving, setPdfSaving] = useState(false);
  const [pdfSaveSuccess, setPdfSaveSuccess] = useState(false);
  const [pdfSaveError, setPdfSaveError] = useState("");

  useEffect(() => {
    const t = loadTheme();
    setTheme(t);
    const stored = localStorage.getItem("staff_recipient_email") ?? "";
    setRecipientEmail(stored);
    const notifStored = localStorage.getItem("staff_notification_email") ?? "";
    setNotificationEmail(notifStored);
  }, []);

  // Fetch PDF template the first time the pdf section is entered
  const handleSectionChange = async (section: "session" | "theme" | "pdf") => {
    setActiveSection(section);
    if (section === "pdf" && !pdfFetched) {
      try {
        const res = await fetch("/api/admin/pdf-template");
        if (res.ok) {
          const data = await res.json() as { settings: PdfTemplate & { notificationEmail: string } };
          setPdfTemplate(data.settings);
          if (data.settings.notificationEmail) {
            setNotificationEmail(data.settings.notificationEmail);
          }
          setPdfFetched(true);
        }
      } catch { /* ignore */ }
    }
    if (section === "theme") {
      // Fetch metal rates last-updated time
      try {
        const res = await fetch("/api/admin/metal-rates");
        if (res.ok) {
          const data = await res.json() as { updatedAt?: string };
          if (data.updatedAt) setMetalRatesUpdatedAt(data.updatedAt);
        }
      } catch { /* ignore */ }
    }
  };

  const handleSaveNotificationEmail = async () => {
    localStorage.setItem("staff_notification_email", notificationEmail.trim());
    // Persist to DB via pdf-template endpoint (add notificationEmail field)
    try {
      await fetch("/api/admin/pdf-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pdfTemplate, notificationEmail: notificationEmail.trim() }),
      });
    } catch { /* ignore */ }
  };

  const handlePdfFieldChange = (key: keyof PdfTemplate, value: string) => {
    setPdfTemplate((prev) => ({ ...prev, [key]: value }));
    setPdfSaveSuccess(false);
    setPdfSaveError("");
  };


  const handlePdfSave = async () => {
    const FIELD_LABELS: Record<keyof PdfTemplate, string> = {
      shopName: "Shop Name",
      shopAddress: "Shop Address",
      shopPhone: "Shop Phone",
      shopEmail: "Shop Email",
      documentTitle: "Document Title",
      headingDesignSpecification: "Design Specification Heading",
      headingPriceEstimate: "Price Estimate Heading",
      labelDescription: "Description Label",
      labelMetal: "Metal Label",
      labelRingSize: "Ring Size Label",
      labelStones: "Stones Label",
      labelStyle: "Style Label",
      labelComplexity: "Complexity Label",
      labelEstimatedPrice: "Estimated Price Label",
      labelRange: "Range Label",
      labelLeadTime: "Lead Time Label",
      disclaimerText: "Main Disclaimer",
      vatText: "VAT / Obligation Line",
    };
    // Basic non-empty validation for required fields
    const requiredKeys: (keyof PdfTemplate)[] = [
      "shopName", "documentTitle", "headingDesignSpecification", "headingPriceEstimate",
      "labelDescription", "labelMetal", "labelRingSize", "labelStones", "labelStyle",
      "labelComplexity", "labelEstimatedPrice", "labelRange", "labelLeadTime",
      "disclaimerText", "vatText",
    ];
    for (const key of requiredKeys) {
      if (!pdfTemplate[key].trim()) {
        setPdfSaveError(`"${FIELD_LABELS[key]}" cannot be empty.`);
        return;
      }
    }
    setPdfSaving(true);
    setPdfSaveError("");
    setPdfSaveSuccess(false);
    try {
      const res = await fetch("/api/admin/pdf-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pdfTemplate),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Save failed");
      }
      setPdfSaveSuccess(true);
    } catch (err) {
      setPdfSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPdfSaving(false);
    }
  };

  const handleThemeChange = (key: keyof typeof DEFAULT_THEME, value: string) => {
    const updated = { ...theme, [key]: value };
    setTheme(updated);
    localStorage.setItem("kiosk_theme", JSON.stringify(updated));
    applyTheme(updated);
  };

  const handleResetTheme = () => {
    setTheme(DEFAULT_THEME);
    localStorage.removeItem("kiosk_theme");
    applyTheme(DEFAULT_THEME);
  };

  const handleSaveRecipientEmail = () => {
    localStorage.setItem("staff_recipient_email", recipientEmail.trim());
  };

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
              <h2 className="text-xl font-bold text-gold-400">Staff Panel</h2>
              <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-2xl">×</button>
            </div>

            {/* Section tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => void handleSectionChange("session")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "session" ? "bg-gold-700 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700"}`}
              >
                Session
              </button>
              <button
                onClick={() => void handleSectionChange("theme")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "theme" ? "bg-gold-700 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700"}`}
              >
                🎨 Theme & Settings
              </button>
              <button
                onClick={() => void handleSectionChange("pdf")}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "pdf" ? "bg-gold-700 text-white" : "bg-stone-800 text-stone-400 hover:bg-stone-700"}`}
              >
                📄 PDF Template
              </button>
            </div>

            {/* Session view */}
            {activeSection === "session" && (
              <>
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
              </>
            )}

            {/* Theme & Settings view */}
            {activeSection === "theme" && (
              <div className="space-y-4">
                {/* Lead notification email */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Lead Notification Email</h3>
                  <p className="text-stone-500 text-xs">Receive an email when a new customer starts the ring builder.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      placeholder="staff@yourshop.com"
                      className="flex-1 bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                      style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    />
                    <button
                      onClick={() => void handleSaveNotificationEmail()}
                      className="bg-gold-700 hover:bg-gold-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Recipient email */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Quote Recipient Email</h3>
                  <p className="text-stone-500 text-xs">Email address that receives submitted quote requests.</p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="staff@yourshop.com"
                      className="flex-1 bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                      style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    />
                    <button
                      onClick={handleSaveRecipientEmail}
                      className="bg-gold-700 hover:bg-gold-600 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Metal rates last updated */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-2">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Live Gold Price</h3>
                  <p className="text-stone-500 text-xs">
                    {metalRatesUpdatedAt
                      ? `Last updated: ${new Date(metalRatesUpdatedAt).toLocaleString("en-GB")}`
                      : "Rate not yet fetched — will update on next pricing call."}
                  </p>
                  <p className="text-stone-600 text-xs">Rates are cached for 1 hour and sourced from metals-api.com (requires METALS_API_KEY).</p>
                </div>

                {/* Theme colours */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-4">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Colour Theme</h3>
                  <p className="text-stone-500 text-xs">Changes apply instantly and persist across sessions.</p>

                  {([
                    ["primary", "Primary Colour", "Headings and accents"],
                    ["accent", "Accent Colour", "Secondary highlights"],
                    ["background", "Background Colour", "Main background"],
                    ["button", "Button Colour", "Action buttons"],
                  ] as [keyof typeof DEFAULT_THEME, string, string][]).map(([key, label, desc]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-stone-200 text-sm font-medium">{label}</p>
                        <p className="text-stone-500 text-xs">{desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-stone-400 text-xs font-mono">{theme[key]}</span>
                        <input
                          type="color"
                          value={theme[key]}
                          onChange={(e) => handleThemeChange(key, e.target.value)}
                          className="w-10 h-10 rounded-lg border border-stone-600 cursor-pointer bg-transparent"
                          style={{ padding: "2px" }}
                        />
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleResetTheme}
                    className="w-full bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl py-2 text-sm font-medium transition-colors mt-2"
                  >
                    Reset to Defaults
                  </button>
                </div>
              </div>
            )}

            {/* PDF Template view */}
            {activeSection === "pdf" && (
              <div className="space-y-4">
                {/* Shop Information */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Shop Information</h3>
                  {([
                    ["shopName", "Shop Name"],
                    ["shopAddress", "Address Line"],
                    ["shopPhone", "Phone Number"],
                    ["shopEmail", "Email"],
                  ] as [keyof PdfTemplate, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-stone-400 text-xs mb-1">{label}</label>
                      <input
                        type="text"
                        value={pdfTemplate[key]}
                        onChange={(e) => handlePdfFieldChange(key, e.target.value)}
                        className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                        style={{ userSelect: "text", WebkitUserSelect: "text" }}
                      />
                    </div>
                  ))}
                </div>

                {/* Document Title */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Document Title</h3>
                  <input
                    type="text"
                    value={pdfTemplate.documentTitle}
                    onChange={(e) => handlePdfFieldChange("documentTitle", e.target.value)}
                    className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                  />
                </div>

                {/* Section Headings */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Section Headings</h3>
                  {([
                    ["headingDesignSpecification", "Design Specification Heading"],
                    ["headingPriceEstimate", "Price Estimate Heading"],
                  ] as [keyof PdfTemplate, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-stone-400 text-xs mb-1">{label}</label>
                      <input
                        type="text"
                        value={pdfTemplate[key]}
                        onChange={(e) => handlePdfFieldChange(key, e.target.value)}
                        className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                        style={{ userSelect: "text", WebkitUserSelect: "text" }}
                      />
                    </div>
                  ))}
                </div>

                {/* Field Labels */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Field Labels</h3>
                  {([
                    ["labelDescription", "Description"],
                    ["labelMetal", "Metal"],
                    ["labelRingSize", "Ring Size"],
                    ["labelStones", "Stones"],
                    ["labelStyle", "Style"],
                    ["labelComplexity", "Complexity"],
                    ["labelEstimatedPrice", "Estimated Price"],
                    ["labelRange", "Range"],
                    ["labelLeadTime", "Estimated Lead Time"],
                  ] as [keyof PdfTemplate, string][]).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-stone-400 text-xs mb-1">{label}</label>
                      <input
                        type="text"
                        value={pdfTemplate[key]}
                        onChange={(e) => handlePdfFieldChange(key, e.target.value)}
                        className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                        style={{ userSelect: "text", WebkitUserSelect: "text" }}
                      />
                    </div>
                  ))}
                </div>

                {/* Disclaimer Text */}
                <div className="bg-stone-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Disclaimer Text</h3>
                  <div>
                    <label className="block text-stone-400 text-xs mb-1">Main Disclaimer</label>
                    <textarea
                      value={pdfTemplate.disclaimerText}
                      onChange={(e) => handlePdfFieldChange("disclaimerText", e.target.value)}
                      rows={3}
                      className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none resize-none"
                      style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 text-xs mb-1">VAT / Obligation Line</label>
                    <input
                      type="text"
                      value={pdfTemplate.vatText}
                      onChange={(e) => handlePdfFieldChange("vatText", e.target.value)}
                      className="w-full bg-stone-700 border border-stone-600 rounded-xl px-3 py-2 text-stone-100 placeholder-stone-500 text-sm focus:outline-none"
                      style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    />
                  </div>
                </div>

                {pdfSaveError && <p className="text-red-400 text-sm">{pdfSaveError}</p>}
                {pdfSaveSuccess && <p className="text-green-400 text-sm">✓ Changes saved. Next PDF will use updated text.</p>}

                <button
                  onClick={() => void handlePdfSave()}
                  disabled={pdfSaving}
                  className="w-full bg-gold-700 hover:bg-gold-600 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-semibold transition-colors"
                >
                  {pdfSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            )}

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

