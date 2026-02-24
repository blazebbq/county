"use client";

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
  onDownloadPdf: () => void;
  onReset: () => void;
}

export default function QuoteDisplay({ quote, sessionId, onDownloadPdf, onReset }: QuoteDisplayProps) {
  const summaryRows: [string, string][] = [
    ["Metal", quote.customerFacingSummary.metal],
    ["Stones", quote.customerFacingSummary.stones],
    ["Ring Size", quote.customerFacingSummary.ringSize],
    ["Style", quote.customerFacingSummary.style],
    ["Lead Time", quote.customerFacingSummary.leadTime],
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Price hero */}
      <div className="text-center bg-stone-800 border border-gold-700 rounded-2xl p-6">
        <p className="text-stone-400 text-sm uppercase tracking-widest mb-1">Estimated Price</p>
        <p className="text-5xl font-bold text-gold-400">
          £{quote.retailPriceGBP.toLocaleString()}
        </p>
        <p className="text-stone-400 text-sm mt-2">
          Range: £{quote.retailRangeGBP.min.toLocaleString()} – £{quote.retailRangeGBP.max.toLocaleString()}
        </p>
      </div>

      {/* Summary */}
      <div className="bg-stone-800/50 rounded-xl border border-stone-700 overflow-hidden">
        <div className="px-4 py-3 bg-stone-800 border-b border-stone-700">
          <h3 className="text-gold-400 font-semibold text-sm uppercase tracking-widest">Your Design</h3>
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

      {/* Actions */}
      <div className="space-y-3">
        <a
          href={`/api/session/${sessionId}/pdf`}
          onClick={onDownloadPdf}
          className="w-full flex items-center justify-center gap-2 bg-gold-600 hover:bg-gold-500 text-white rounded-xl py-4 font-semibold text-base transition-colors"
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
