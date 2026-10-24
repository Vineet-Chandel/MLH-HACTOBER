import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export default function HeuristicMeter({ score, riskLevel }) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Normalize score to 0 - 100
  const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0));

  // Determine bar fill color based on risk level / score
  const isInconclusive = riskLevel === 'inconclusive';
  let barColor = 'bg-teal-500';
  let badgeColor = 'text-teal-300 bg-teal-950/70 border-teal-500/30';

  if (isInconclusive) {
    barColor = 'bg-slate-500';
    badgeColor = 'text-slate-300 bg-slate-800 border-slate-600/40';
  } else if (normalizedScore >= 70) {
    barColor = 'bg-rose-500';
    badgeColor = 'text-rose-300 bg-rose-950/70 border-rose-500/30';
  } else if (normalizedScore >= 35) {
    barColor = 'bg-amber-500';
    badgeColor = 'text-amber-300 bg-amber-950/70 border-amber-500/30';
  } else {
    barColor = 'bg-emerald-500';
    badgeColor = 'text-emerald-300 bg-emerald-950/70 border-emerald-500/30';
  }

  return (
    <section
      className="rounded-[10px] border border-white/10 bg-[#111827] p-4 flex flex-col gap-3"
      aria-labelledby="heuristic-meter-heading"
    >
      {/* Top row: Label, Score, and Help toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <h3
            id="heuristic-meter-heading"
            className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          >
            Heuristic Indicator
          </h3>
          <span className="text-[11px] text-slate-400 italic">
            Heuristic indicator, not a probability
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-sm font-bold px-2.5 py-0.5 rounded-[6px] border ${badgeColor}`}
            aria-label={`Score ${normalizedScore} out of 100`}
          >
            {normalizedScore} <span className="text-xs font-normal opacity-70">/ 100</span>
          </span>

          <button
            type="button"
            onClick={() => setShowExplanation((prev) => !prev)}
            aria-expanded={showExplanation}
            aria-controls="heuristic-explanation-box"
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-teal-300 py-1 px-2 rounded-[6px] border border-white/10 hover:border-teal-500/30 bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">What does this mean?</span>
            {showExplanation ? (
              <ChevronUp className="w-3 h-3" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10 relative"
        role="progressbar"
        aria-valuenow={normalizedScore}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Heuristic threat score bar"
      >
        <div
          className={`h-full transition-all duration-500 ease-out rounded-full ${barColor}`}
          style={{ width: `${normalizedScore}%` }}
        />
      </div>

      {/* Toggled Explanation Box */}
      {showExplanation && (
        <div
          id="heuristic-explanation-box"
          className="p-3 rounded-[8px] bg-[#0a0f1d] border border-teal-500/20 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5 animate-fadeIn"
        >
          <AlertCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p>
              <strong className="text-slate-100">About this score:</strong> This number represents the model&apos;s rough internal weighting of the heuristic signals and indicators it detected in the text.
            </p>
            <p className="text-slate-400">
              It is <em>not</em> an empirical probability, not a statistical likelihood, and does not reflect telemetry or reputation databases. LLM heuristic scoring can produce false positives or false negatives.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
