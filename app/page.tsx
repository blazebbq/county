"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import ChatInterface from "@/components/ChatInterface";
import MaterialSelector from "@/components/MaterialSelector";
import QuoteDisplay from "@/components/QuoteDisplay";
import ImagePreview from "@/components/ImagePreview";
import LeadCapture from "@/components/LeadCapture";
import { DesignSpec } from "@/lib/llm/designSpecSchema";

const SketchPad = dynamic(() => import("@/components/SketchPad"), { ssr: false });
const StaffPanel = dynamic(() => import("@/components/StaffPanel"), { ssr: false });

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

// Validate hex colour values before applying to CSS to prevent injection via localStorage
const HEX_COLOUR_RE = /^#[0-9a-fA-F]{3,8}$/;

// Apply saved theme from localStorage on mount
function applySavedTheme() {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem("kiosk_theme");
    if (stored) {
      const t = JSON.parse(stored) as Record<string, unknown>;
      const root = document.documentElement;
      const keys: [string, string][] = [
        ["primary", "--color-primary"],
        ["accent", "--color-accent"],
        ["background", "--color-background"],
        ["button", "--color-button"],
      ];
      for (const [key, cssVar] of keys) {
        const val = t[key];
        if (typeof val === "string" && HEX_COLOUR_RE.test(val)) {
          root.style.setProperty(cssVar, val);
        }
      }
    }
  } catch { /* ignore */ }
}

type Tab = "chat" | "materials" | "sketch" | "quote";

// Three phases: idle → lead capture → active design studio
type Phase = "idle" | "lead" | "active";

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

export default function KioskPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [designSpec, setDesignSpec] = useState<DesignSpec | null>(null);
  const [quote, setQuote] = useState<CustomerQuote | null>(null);
  // Single image — only the latest render is kept
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [pendingSketch, setPendingSketch] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  // Lead details captured once at session start — reused for quote submission
  const [leadFirstName, setLeadFirstName] = useState<string | null>(null);
  const [leadEmail, setLeadEmail] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffTapCount = useRef(0);
  const staffTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply saved theme on mount
  useEffect(() => {
    applySavedTheme();
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (phase === "active" || phase === "lead") {
      idleTimer.current = setTimeout(() => {
        setPhase("idle");
      }, IDLE_TIMEOUT_MS);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "active" || phase === "lead") {
      resetIdleTimer();
      const events = ["touchstart", "mousedown", "keydown"];
      events.forEach((e) => window.addEventListener(e, resetIdleTimer));
      return () => {
        events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
        if (idleTimer.current) clearTimeout(idleTimer.current);
      };
    }
  }, [phase, resetIdleTimer]);

  const startSession = useCallback(async () => {
    try {
      const res = await fetch("/api/session/start", { method: "POST" });
      const data = await res.json() as { sessionId: string };
      setSessionId(data.sessionId);
      // Go to lead capture first
      setPhase("lead");
      setActiveTab("chat");
      setDesignSpec(null);
      setQuote(null);
      setImageUrl(null);
      setQuoteReady(false);
      setLeadFirstName(null);
      setLeadEmail(null);
      setSuggestedQuestions([
        "I'm looking for an engagement ring",
        "I want something modern and minimalist",
        "I'd like a classic solitaire in gold",
      ]);
    } catch {
      // retry
    }
  }, []);

  const handleReset = useCallback(async () => {
    if (sessionId) {
      await fetch(`/api/session/${sessionId}/close`, { method: "POST" }).catch(() => {});
    }
    setPhase("idle");
    setSessionId(null);
    setDesignSpec(null);
    setQuote(null);
    setImageUrl(null);
    setQuoteReady(false);
    setSuggestedQuestions([]);
    setPendingSketch(null);
    setChatMessage(null);
    setLeadFirstName(null);
    setLeadEmail(null);
  }, [sessionId]);

  const handleDesignSpecUpdate = useCallback((spec: DesignSpec) => {
    setDesignSpec(spec);
    setSuggestedQuestions(spec.questionsNext ?? []);
  }, []);

  const handleQuoteReady = useCallback(() => {
    setQuoteReady(true);
  }, []);

  // Always recompute quote fresh
  const generateQuote = useCallback(async () => {
    if (!sessionId || generatingQuote) return;
    setGeneratingQuote(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/quote`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { quote: CustomerQuote };
        setQuote(data.quote);
      }
    } catch {
      // ignore
    } finally {
      setGeneratingQuote(false);
    }
  }, [sessionId, generatingQuote]);

  // Generate exactly one image, replace existing
  const generateImage = useCallback(async () => {
    if (!sessionId || generatingImages) return;
    setGeneratingImages(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/generate-images`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { imageUrls: string[] };
        if (data.imageUrls.length > 0) {
          // Replace — only one image at a time
          setImageUrl(data.imageUrls[0]);
        }
      }
    } catch {
      // ignore
    } finally {
      setGeneratingImages(false);
    }
  }, [sessionId, generatingImages]);

  const handleSketchCapture = useCallback((dataUrl: string) => {
    setPendingSketch(dataUrl);
    setChatMessage("I've attached a sketch of my ring idea — please take a look.");
    setActiveTab("chat");
  }, []);

  const handleChatMessageFromSelector = useCallback((message: string) => {
    setChatMessage(message);
    setActiveTab("chat");
  }, []);

  const handleProceedWithQuote = useCallback(() => {
    // Navigate to the quote tab
    setActiveTab("quote");
    // Always regenerate quote fresh when proceeding
    void generateQuote();
  }, [generateQuote]);

  // Refresh quote every time the quote tab is opened
  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    if (tab === "quote" && quoteReady) {
      void generateQuote();
    }
  }, [quoteReady, generateQuote]);

  // Staff panel: tap logo 5 times quickly to reveal unlock panel
  const STAFF_UNLOCK_TAP_COUNT = 5;
  const handleLogoTap = () => {
    staffTapCount.current += 1;
    if (staffTapTimer.current) clearTimeout(staffTapTimer.current);
    staffTapTimer.current = setTimeout(() => { staffTapCount.current = 0; }, 1500);
    if (staffTapCount.current >= STAFF_UNLOCK_TAP_COUNT) {
      staffTapCount.current = 0;
      if (sessionId) setShowStaffPanel(true);
    }
  };

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "chat", label: "Chat", emoji: "💬" },
    { id: "materials", label: "Materials", emoji: "💎" },
    { id: "sketch", label: "Sketch", emoji: "✏️" },
    { id: "quote", label: "Quote", emoji: "📋" },
  ];

  // --- IDLE SCREEN ---
  if (phase === "idle") {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center cursor-pointer select-none"
        style={{ backgroundColor: "var(--color-background)" }}
        onClick={() => void startSession()}
      >
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-10" style={{ backgroundColor: "var(--color-primary)" }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-5" style={{ backgroundColor: "var(--color-accent)" }} />
        </div>

        <div className="relative z-10 text-center px-8">
          {/* Logo / Brand */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="w-24 h-24 border-2 rounded-full flex items-center justify-center" style={{ borderColor: "var(--color-primary)" }}>
                <div className="text-5xl">💍</div>
              </div>
              <div className="absolute inset-0 border-2 rounded-full animate-ping opacity-30" style={{ borderColor: "var(--color-accent)" }} />
            </div>
            <h1 className="text-4xl font-bold tracking-wide mb-2" style={{ color: "var(--color-primary)" }}>
              Design Your Ring
            </h1>
            <p className="text-stone-400 text-xl">Bespoke jewellery, crafted for you</p>
          </div>

          {/* CTA */}
          <div className="mt-12 animate-pulse">
            <div
              className="inline-flex items-center gap-3 text-white rounded-2xl px-10 py-5 text-2xl font-semibold shadow-lg transition-colors"
              style={{ backgroundColor: "var(--color-button)" }}
            >
              <span>✨</span>
              <span>Tap to Begin</span>
            </div>
          </div>

          <p className="mt-8 text-stone-600 text-sm">
            Design your perfect custom ring with AI assistance
          </p>
        </div>

        {/* Shop name footer */}
        <div className="absolute bottom-8 text-stone-700 text-sm">
          {process.env.NEXT_PUBLIC_SHOP_NAME ?? "Your Jewellery Shop"}
        </div>
      </div>
    );
  }

  // --- LEAD CAPTURE SCREEN ---
  if (phase === "lead" && sessionId) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--color-background)" }}>
        <header className="flex items-center justify-between px-5 py-3 bg-stone-900 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💍</span>
            <span className="font-bold text-lg" style={{ color: "var(--color-primary)" }}>Design Studio</span>
          </div>
          <button
            onClick={() => void handleReset()}
            className="text-stone-500 hover:text-stone-300 text-sm px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
        </header>
        <LeadCapture sessionId={sessionId} onComplete={(firstName, email) => {
          setLeadFirstName(firstName);
          setLeadEmail(email);
          setPhase("active");
        }} />
      </div>
    );
  }

  // --- ACTIVE KIOSK ---
  return (
    <div className="min-h-screen flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-stone-900 border-b border-stone-800 flex-shrink-0">
        <button
          className="flex items-center gap-2 select-none"
          onClick={handleLogoTap}
        >
          <span className="text-2xl">💍</span>
          <span className="font-bold text-lg" style={{ color: "var(--color-primary)" }}>Design Studio</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Reset */}
          <button
            onClick={() => void handleReset()}
            className="text-stone-500 hover:text-stone-300 text-sm px-3 py-2 rounded-xl hover:bg-stone-800 transition-colors"
          >
            Reset
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav className="flex bg-stone-900 border-b border-stone-800 flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
            style={activeTab === tab.id ? { color: "var(--color-primary)" } : {}}
          >
            <span className="text-lg">{tab.emoji}</span>
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: "var(--color-primary)" }} />
            )}
            {tab.id === "quote" && quote && (
              <div className="absolute top-1 right-3 w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-accent)" }} />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">

        {/* Chat tab — split layout: flex-col on mobile (chat top, image bottom), flex-row on desktop */}
        <div className={`h-full ${activeTab === "chat" ? "flex flex-col md:flex-row" : "hidden"}`}>
          {/* Chat conversation — fills available space */}
          <div className="flex flex-col flex-1 min-w-0 md:max-w-[60%] overflow-hidden">
            {sessionId && (
              <ChatInterface
                sessionId={sessionId}
                onDesignSpecUpdate={handleDesignSpecUpdate}
                onQuoteReady={handleQuoteReady}
                suggestedQuestions={suggestedQuestions}
                initialMessage={chatMessage ?? undefined}
                initialImageDataUrl={pendingSketch ?? undefined}
                onMessageSent={() => {
                  setChatMessage(null);
                  setPendingSketch(null);
                }}
              />
            )}
          </div>

          {/* Image preview — fixed width on desktop, fixed height on mobile */}
          <div className="flex flex-col md:w-[40%] flex-shrink-0 h-64 md:h-auto">
            <ImagePreview
              imageUrl={imageUrl}
              loading={generatingImages}
              canGenerate={!!designSpec}
              onGenerate={() => void generateImage()}
              onProceedWithQuote={imageUrl ? handleProceedWithQuote : undefined}
            />
          </div>
        </div>

        {/* Materials tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "materials" ? "block" : "hidden"}`}>
          <MaterialSelector onSelect={handleChatMessageFromSelector} />
        </div>

        {/* Sketch tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "sketch" ? "block" : "hidden"}`}>
          <SketchPad onSketchCapture={handleSketchCapture} />
        </div>

        {/* Quote tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "quote" ? "block" : "hidden"}`}>
          {generatingQuote ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} />
              <p className="text-stone-400 text-base">Calculating your quote…</p>
            </div>
          ) : quote && sessionId ? (
            <QuoteDisplay
              quote={quote}
              sessionId={sessionId}
              renderImageUrl={imageUrl}
              leadFirstName={leadFirstName ?? undefined}
              leadEmail={leadEmail ?? undefined}
              onDownloadPdf={() => {}}
              onReset={() => void handleReset()}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
              <div className="text-6xl">📋</div>
              <h3 className="text-stone-300 text-xl font-semibold">No Quote Yet</h3>
              <p className="text-stone-500 text-base max-w-sm">
                Complete your ring design in the chat, then generate a price estimate.
              </p>
              {quoteReady && (
                <button
                  onClick={() => void generateQuote()}
                  disabled={generatingQuote}
                  className="mt-2 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
                  style={{ backgroundColor: "var(--color-button)" }}
                >
                  {generatingQuote ? "Calculating…" : "📋 Generate Quote"}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Design spec pill */}
      {designSpec && activeTab !== "quote" && (
        <div className="flex-shrink-0 px-4 py-2 bg-stone-900 border-t border-stone-800">
          <div className="flex items-center gap-2 text-xs text-stone-500 overflow-x-auto whitespace-nowrap">
            <span style={{ color: "var(--color-primary)" }}>✦</span>
            {designSpec.metal && (
              <span className="bg-stone-800 rounded-full px-2 py-1 text-stone-300">
                {designSpec.metal.type.replace("_", " ")}
              </span>
            )}
            {designSpec.ringSize && (
              <span className="bg-stone-800 rounded-full px-2 py-1 text-stone-300">
                Size {designSpec.ringSize.system} {designSpec.ringSize.value}
              </span>
            )}
            {designSpec.stones && designSpec.stones.kind !== "none" && (
              <span className="bg-stone-800 rounded-full px-2 py-1 text-stone-300">
                {designSpec.stones.kind.replace("_", " ")} — {designSpec.stones.tier}
              </span>
            )}
            {designSpec.complexity && (
              <span className="bg-stone-800 rounded-full px-2 py-1 text-stone-300">
                {designSpec.complexity}
              </span>
            )}
            {quoteReady && !quote && (
              <button
                onClick={() => handleTabChange("quote")}
                className="ml-auto flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: "var(--color-button)", color: "white" }}
              >
                Get Quote →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Staff Panel */}
      {showStaffPanel && sessionId && (
        <StaffPanel sessionId={sessionId} onClose={() => setShowStaffPanel(false)} />
      )}
    </div>
  );
}


