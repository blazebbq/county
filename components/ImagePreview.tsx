"use client";

import Image from "next/image";

interface ImagePreviewProps {
  imageUrl: string | null;
  loading?: boolean;
  canGenerate?: boolean;
  onGenerate?: () => void;
  onProceedWithQuote?: () => void;
}

export default function ImagePreview({
  imageUrl,
  loading = false,
  canGenerate = false,
  onGenerate,
  onProceedWithQuote,
}: ImagePreviewProps) {
  return (
    <div className="flex flex-col h-full bg-stone-900 border-l border-stone-800">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-stone-800 flex-shrink-0">
        <h3
          className="font-semibold text-sm uppercase tracking-widest"
          style={{ color: "var(--color-primary)" }}
        >
          Concept Render
        </h3>
      </div>

      {/* Image area */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-14 h-14 border-4 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
            />
            <p className="text-stone-400 text-sm text-center">
              Generating your concept…
            </p>
            <p className="text-stone-600 text-xs text-center">This may take ~30 seconds</p>
          </div>
        ) : imageUrl ? (
          <div className="relative w-full max-w-xs aspect-square rounded-xl overflow-hidden border border-stone-700">
            <Image
              src={imageUrl}
              alt="Ring concept render"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 320px"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <div className="text-5xl opacity-30">💍</div>
            <p className="text-stone-500 text-sm">
              {canGenerate
                ? "Click Generate to visualise your design"
                : "Complete your design in the chat first"}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-4 space-y-3 flex-shrink-0">
        {/* Generate button */}
        <button
          onClick={onGenerate}
          disabled={!canGenerate || loading}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-white"
          style={{ backgroundColor: loading ? "#57534e" : "var(--color-button)" }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin inline-block"
                style={{ borderColor: "white", borderTopColor: "transparent" }}
              />
              Generating…
            </span>
          ) : imageUrl ? (
            "🔄 Regenerate"
          ) : (
            "✨ Generate"
          )}
        </button>

        {/* Proceed with quote button — only shown when we have an image */}
        {imageUrl && onProceedWithQuote && (
          <button
            onClick={onProceedWithQuote}
            className="w-full rounded-xl py-3 text-sm font-semibold transition-colors text-white border"
            style={{
              backgroundColor: "var(--color-primary)",
              borderColor: "var(--color-accent)",
            }}
          >
            📋 Proceed With Quote
          </button>
        )}

        {imageUrl && (
          <p className="text-stone-600 text-xs text-center">
            AI render for visualisation only. Actual piece may vary.
          </p>
        )}
      </div>
    </div>
  );
}
