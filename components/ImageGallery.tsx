"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageGalleryProps {
  imageUrls: string[];
  loading?: boolean;
  onGenerateMore?: () => void;
  canGenerate?: boolean;
}

export default function ImageGallery({
  imageUrls,
  loading = false,
  onGenerateMore,
  canGenerate = false,
}: ImageGalleryProps) {
  const [enlarged, setEnlarged] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="w-16 h-16 border-4 border-gold-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-400 text-base">Generating your concept images…</p>
        <p className="text-stone-600 text-sm">This may take up to 30 seconds</p>
      </div>
    );
  }

  if (imageUrls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
        <div className="text-6xl">🎨</div>
        <h3 className="text-stone-300 text-xl font-semibold">No Concept Images Yet</h3>
        <p className="text-stone-500 text-base max-w-sm">
          Complete your ring design in the chat, then generate AI concept images to visualise your idea.
        </p>
        {canGenerate && onGenerateMore && (
          <button
            onClick={onGenerateMore}
            className="mt-2 bg-gold-600 hover:bg-gold-500 text-white rounded-xl px-6 py-3 font-semibold transition-colors"
          >
            ✨ Generate Concept Images
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Concept Visualisations</h3>
        {canGenerate && onGenerateMore && (
          <button
            onClick={onGenerateMore}
            className="text-sm bg-stone-800 hover:bg-stone-700 text-gold-400 border border-stone-700 rounded-lg px-3 py-2 transition-colors"
          >
            Regenerate
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {imageUrls.map((url, idx) => (
          <button
            key={idx}
            onClick={() => setEnlarged(url)}
            className="relative aspect-square rounded-xl overflow-hidden border border-stone-700 hover:border-gold-500 transition-all hover:scale-[1.02]"
          >
            <Image
              src={url}
              alt={`Ring concept ${idx + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 300px"
            />
          </button>
        ))}
      </div>

      <p className="text-stone-600 text-xs text-center">
        AI-generated concept images for visualisation only. Actual piece may vary.
      </p>

      {/* Lightbox */}
      {enlarged && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setEnlarged(null)}
        >
          <div className="relative w-full max-w-lg aspect-square rounded-2xl overflow-hidden">
            <Image
              src={enlarged}
              alt="Ring concept enlarged"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>
          <button
            className="absolute top-6 right-6 text-white text-4xl font-light"
            onClick={() => setEnlarged(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
