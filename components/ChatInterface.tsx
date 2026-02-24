"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DesignSpec } from "@/lib/llm/designSpecSchema";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface ChatInterfaceProps {
  sessionId: string;
  onDesignSpecUpdate: (spec: DesignSpec) => void;
  onQuoteReady: () => void;
  suggestedQuestions: string[];
  disabled?: boolean;
  initialMessage?: string;
  initialImageDataUrl?: string;
  onMessageSent?: () => void;
}

export default function ChatInterface({
  sessionId,
  onDesignSpecUpdate,
  onQuoteReady,
  suggestedQuestions,
  disabled = false,
  initialMessage,
  initialImageDataUrl,
  onMessageSent,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Welcome! I'm here to help you design your perfect custom ring. Tell me a little about what you have in mind — perhaps a special occasion, a style you love, or a metal preference?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentInitial = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string, imageDataUrl?: string) => {
    if (!text.trim() || loading || disabled) return;
    const userText = text.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userText }]);
    setLoading(true);
    onMessageSent?.();

    try {
      const body: { message: string; imageDataUrls?: string[] } = { message: userText };
      if (imageDataUrl) body.imageDataUrls = [imageDataUrl];

      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as {
        reply: string;
        designSpec: DesignSpec | null;
        questionsNext: string[];
      };

      setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);

      if (data.designSpec) {
        onDesignSpecUpdate(data.designSpec);
        if (
          data.designSpec.metal &&
          data.designSpec.ringSize &&
          data.designSpec.estimatedGoldWeightGrams &&
          data.designSpec.complexity
        ) {
          onQuoteReady();
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "I'm sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, loading, disabled, onDesignSpecUpdate, onQuoteReady, onMessageSent]);

  // Auto-send initial message from sketch/materials
  useEffect(() => {
    if (initialMessage && !sentInitial.current && !loading) {
      sentInitial.current = true;
      void sendMessage(initialMessage, initialImageDataUrl);
    }
  }, [initialMessage, initialImageDataUrl, sendMessage, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto chat-scrollbar px-4 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1 flex-shrink-0">
                ✦
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-base leading-relaxed ${
                msg.role === "user"
                  ? "bg-gold-700 text-white rounded-tr-sm"
                  : "bg-stone-800 text-stone-100 rounded-tl-sm"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-gold-600 flex items-center justify-center text-white text-sm font-bold mr-3 mt-1 flex-shrink-0">
              ✦
            </div>
            <div className="bg-stone-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-gold-400 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && !loading && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {suggestedQuestions.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => void sendMessage(q)}
              className="text-sm bg-stone-800 hover:bg-stone-700 text-gold-300 border border-stone-700 rounded-full px-3 py-1.5 transition-colors"
              disabled={disabled}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-stone-800">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your dream ring…"
            disabled={disabled || loading}
            rows={2}
            className="flex-1 bg-stone-800 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder-stone-500 resize-none focus:outline-none focus:border-gold-500 text-base transition-colors"
            style={{ userSelect: "text", WebkitUserSelect: "text" }}
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading || disabled}
            className="bg-gold-600 hover:bg-gold-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 py-3 font-semibold transition-colors flex-shrink-0 text-base"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
