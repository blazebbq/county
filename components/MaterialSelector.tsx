"use client";

interface MaterialSelectorProps {
  onSelect: (message: string) => void;
}

const METALS = [
  { id: "9k_yellow", label: "9ct Yellow Gold", desc: "Classic warm tone, budget-friendly", color: "#b8860b" },
  { id: "14k_yellow", label: "14ct Yellow Gold", desc: "Popular choice, good durability", color: "#d4af37" },
  { id: "18k_yellow", label: "18ct Yellow Gold", desc: "Rich colour, premium quality", color: "#f5c518" },
  { id: "14k_white", label: "14ct White Gold", desc: "Modern look, rhodium-plated", color: "#c8c8c8" },
  { id: "18k_white", label: "18ct White Gold", desc: "Bright white, luxury feel", color: "#e8e8e8" },
  { id: "sterling_silver", label: "925 Sterling Silver", desc: "Bright, accessible price point", color: "#aaa9ad" },
  { id: "platinum_950", label: "Platinum 950", desc: "Most durable, naturally white", color: "#9da4ae" },
];

const STONES = [
  { id: "lab_diamond", label: "Lab Diamond", desc: "Chemically identical to mined diamond, ethical & excellent value", emoji: "💎" },
  { id: "moissanite", label: "Moissanite", desc: "More brilliant than diamond, very affordable", emoji: "✨" },
  { id: "none", label: "Plain Band", desc: "No stones — sleek and minimalist", emoji: "⭕" },
];

const TIERS = [
  { id: "good", label: "Good", desc: "Great sparkle, excellent value" },
  { id: "better", label: "Better", desc: "Exceptional clarity and cut" },
  { id: "best", label: "Best", desc: "The finest available quality" },
];

const STYLES = [
  { id: "solitaire", label: "Solitaire", emoji: "💍", desc: "Single stone, timeless classic" },
  { id: "halo", label: "Halo", emoji: "🌟", desc: "Center stone with surrounding accent stones" },
  { id: "pave_band", label: "Pavé Band", emoji: "✨", desc: "Row of small stones along the band" },
  { id: "plain_band", label: "Plain Band", emoji: "⭕", desc: "Clean, minimalist, no stones" },
  { id: "cluster", label: "Cluster", emoji: "🌸", desc: "Group of stones forming a pattern" },
  { id: "three_stone", label: "Three Stone", emoji: "🔱", desc: "Past, present, future symbolism" },
];

export default function MaterialSelector({ onSelect }: MaterialSelectorProps) {
  return (
    <div className="p-4 space-y-6 overflow-y-auto">
      {/* Metals */}
      <div>
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-3">Metal</h3>
        <div className="grid grid-cols-2 gap-2">
          {METALS.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelect(`I'd like the ring in ${m.label}`)}
              className="flex items-center gap-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-gold-600 rounded-xl p-3 text-left transition-all group"
            >
              <div
                className="w-8 h-8 rounded-full flex-shrink-0 border-2 border-stone-600 group-hover:border-gold-500"
                style={{ backgroundColor: m.color }}
              />
              <div className="min-w-0">
                <div className="text-stone-100 font-medium text-sm truncate">{m.label}</div>
                <div className="text-stone-500 text-xs truncate">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Stone type */}
      <div>
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-3">Stone Type</h3>
        <div className="space-y-2">
          {STONES.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(`I'd like ${s.id === "none" ? "no stones — a plain band" : s.label + " stones"}`)}
              className="w-full flex items-center gap-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-gold-600 rounded-xl p-3 text-left transition-all"
            >
              <span className="text-2xl">{s.emoji}</span>
              <div>
                <div className="text-stone-100 font-medium">{s.label}</div>
                <div className="text-stone-500 text-sm">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quality tier */}
      <div>
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-3">Stone Quality</h3>
        <div className="grid grid-cols-3 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(`I'd like ${t.label} quality stones`)}
              className="bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-gold-600 rounded-xl p-3 text-center transition-all"
            >
              <div className="text-stone-100 font-semibold">{t.label}</div>
              <div className="text-stone-500 text-xs mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Styles */}
      <div>
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-3">Style</h3>
        <div className="grid grid-cols-2 gap-2">
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(`I like the ${s.label} style`)}
              className="flex items-center gap-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-gold-600 rounded-xl p-3 text-left transition-all"
            >
              <span className="text-2xl">{s.emoji}</span>
              <div className="min-w-0">
                <div className="text-stone-100 font-medium text-sm">{s.label}</div>
                <div className="text-stone-500 text-xs truncate">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Budget shortcuts */}
      <div>
        <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest mb-3">Budget Range</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Under £500", msg: "My budget is under £500" },
            { label: "£500 – £1,000", msg: "My budget is around £500 to £1,000" },
            { label: "£1,000 – £2,000", msg: "My budget is £1,000 to £2,000" },
            { label: "£2,000 – £5,000", msg: "My budget is £2,000 to £5,000" },
            { label: "£5,000+", msg: "My budget is over £5,000" },
            { label: "No limit", msg: "Budget is not a concern for me" },
          ].map((b) => (
            <button
              key={b.label}
              onClick={() => onSelect(b.msg)}
              className="bg-stone-800 hover:bg-stone-700 border border-stone-700 hover:border-gold-600 rounded-xl py-3 px-4 text-left text-stone-200 font-medium transition-all text-sm"
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
