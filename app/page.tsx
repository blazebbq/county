"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import ChatInterface from "@/components/ChatInterface";
import MaterialSelector from "@/components/MaterialSelector";
import QuoteDisplay from "@/components/QuoteDisplay";
import ImageGallery from "@/components/ImageGallery";
import { DesignSpec } from "@/lib/llm/designSpecSchema";

const SketchPad = dynamic(() => import("@/components/SketchPad"), { ssr: false });
const StaffPanel = dynamic(() => import("@/components/StaffPanel"), { ssr: false });

const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

type Tab = "chat" | "materials" | "sketch" | "concepts" | "quote";

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
  const [phase, setPhase] = useState<"idle" | "active">("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [designSpec, setDesignSpec] = useState<DesignSpec | null>(null);
  const [quote, setQuote] = useState<CustomerQuote | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [showStaffPanel, setShowStaffPanel] = useState(false);
  const [pendingSketch, setPendingSketch] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState<string | null>(null);
  const [quoteReady, setQuoteReady] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staffTapCount = useRef(0);
  const staffTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (phase === "active") {
      idleTimer.current = setTimeout(() => {
        setPhase("idle");
      }, IDLE_TIMEOUT_MS);
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "active") {
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
      setPhase("active");
      setActiveTab("chat");
      setDesignSpec(null);
      setQuote(null);
      setImageUrls([]);
      setQuoteReady(false);
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
    setImageUrls([]);
    setQuoteReady(false);
    setSuggestedQuestions([]);
    setPendingSketch(null);
    setChatMessage(null);
  }, [sessionId]);

  const handleDesignSpecUpdate = useCallback((spec: DesignSpec) => {
    setDesignSpec(spec);
    setSuggestedQuestions(spec.questionsNext ?? []);
  }, []);

  const handleQuoteReady = useCallback(() => {
    setQuoteReady(true);
  }, []);

  const generateQuote = useCallback(async () => {
    if (!sessionId || generatingQuote) return;
    setGeneratingQuote(true);
    try {
      const res = await fetch(`/api/session/${sessionId}/quote`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { quote: CustomerQuote };
        setQuote(data.quote);
        setActiveTab("quote");
      }
    } catch {
      // ignore
    } finally {
      setGeneratingQuote(false);
    }
  }, [sessionId, generatingQuote]);

  const generateImages = useCallback(async () => {
    if (!sessionId || generatingImages) return;
    setGeneratingImages(true);
    setActiveTab("concepts");
    try {
      const res = await fetch(`/api/session/${sessionId}/generate-images`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { imageUrls: string[] };
        setImageUrls((prev) => [...prev, ...data.imageUrls]);
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
    { id: "concepts", label: "Concepts", emoji: "🎨" },
    { id: "quote", label: "Quote", emoji: "📋" },
  ];

  // --- IDLE SCREEN ---
  if (phase === "idle") {
    return (
      <div
        className="min-h-screen bg-stone-950 flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={() => void startSession()}
      >
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gold-700/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gold-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-8">
          {/* Logo / Brand */}
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <div className="w-24 h-24 border-2 border-gold-500 rounded-full flex items-center justify-center">
                <div className="text-5xl">💍</div>
              </div>
              <div className="absolute inset-0 border-2 border-gold-400/30 rounded-full animate-ping" />
            </div>
            <h1 className="text-4xl font-bold text-gold-400 tracking-wide mb-2">
              Design Your Ring
            </h1>
            <p className="text-stone-400 text-xl">Bespoke jewellery, crafted for you</p>
          </div>

          {/* CTA */}
          <div className="mt-12 animate-pulse">
            <div className="inline-flex items-center gap-3 bg-gold-600 hover:bg-gold-500 text-white rounded-2xl px-10 py-5 text-2xl font-semibold shadow-lg shadow-gold-900/40 transition-colors">
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

  // --- ACTIVE KIOSK ---
  return (
    <div className="min-h-screen bg-stone-950 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-stone-900 border-b border-stone-800 flex-shrink-0">
        <button
          className="flex items-center gap-2 select-none"
          onClick={handleLogoTap}
        >
          <span className="text-2xl">💍</span>
          <span className="text-gold-400 font-bold text-lg">Design Studio</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Generate concepts button */}
          {designSpec && imageUrls.length === 0 && (
            <button
              onClick={() => void generateImages()}
              disabled={generatingImages}
              className="bg-stone-800 hover:bg-stone-700 text-gold-400 border border-stone-700 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            >
              {generatingImages ? "Generating…" : "✨ Visualise"}
            </button>
          )}

          {/* Get quote button */}
          {quoteReady && !quote && (
            <button
              onClick={() => void generateQuote()}
              disabled={generatingQuote}
              className="bg-gold-600 hover:bg-gold-500 text-white rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
            >
              {generatingQuote ? "Calculating…" : "📋 Get Quote"}
            </button>
          )}

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
            onClick={() => {
              if (tab.id === "concepts" && imageUrls.length === 0 && !generatingImages) {
                void generateImages();
              }
              setActiveTab(tab.id);
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? "text-gold-400"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            <span className="text-lg">{tab.emoji}</span>
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-500" />
            )}
            {tab.id === "quote" && quote && (
              <div className="absolute top-1 right-3 w-2 h-2 bg-gold-400 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {/* Chat tab */}
        <div className={`h-full ${activeTab === "chat" ? "flex flex-col" : "hidden"}`}>
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

        {/* Materials tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "materials" ? "block" : "hidden"}`}>
          <MaterialSelector onSelect={handleChatMessageFromSelector} />
        </div>

        {/* Sketch tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "sketch" ? "block" : "hidden"}`}>
          <SketchPad onSketchCapture={handleSketchCapture} />
        </div>

        {/* Concepts tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "concepts" ? "block" : "hidden"}`}>
          <ImageGallery
            imageUrls={imageUrls}
            loading={generatingImages}
            onGenerateMore={() => void generateImages()}
            canGenerate={!!designSpec}
          />
        </div>

        {/* Quote tab */}
        <div className={`h-full overflow-y-auto ${activeTab === "quote" ? "block" : "hidden"}`}>
          {quote && sessionId ? (
            <QuoteDisplay
              quote={quote}
              sessionId={sessionId}
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
                  className="mt-2 bg-gold-600 hover:bg-gold-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
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
            <span className="text-gold-600">✦</span>
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
                onClick={() => void generateQuote()}
                className="ml-auto flex-shrink-0 bg-gold-700 text-gold-200 rounded-full px-3 py-1 text-xs font-medium"
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
