import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, ChevronUp, AlertCircle, Activity, Gauge } from 'lucide-react';

export default function HeuristicMeter({ score, riskLevel }) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Normalize score to 0 - 100
  const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0));

  // Determine bar fill color based on risk level / score
  const isInconclusive = riskLevel === 'inconclusive';
  let barColor = 'bg-[#8bfb34]';
  let badgeColor = 'bg-[#8bfb34] text-black';
  let statusText = 'Low Suspicion';

  if (isInconclusive) {
    barColor = 'bg-[#cbd5e1]';
    badgeColor = 'bg-[#e2e8f0] text-black';
    statusText = 'Inconclusive';
  } else if (normalizedScore >= 70) {
    barColor = 'bg-[#ff4d4d]';
    badgeColor = 'bg-[#ff4d4d] text-white';
    statusText = 'High Threat';
  } else if (normalizedScore >= 35) {
    barColor = 'bg-[#fbbf24]';
    badgeColor = 'bg-[#fbbf24] text-black';
    statusText = 'Moderate Lures';
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.05 }}
      className="bg-white border-2 border-black rounded-2xl p-5 shadow-[6px_6px_0px_#000000] flex flex-col gap-4"
      aria-labelledby="heuristic-meter-heading"
    >
      {/* Top row inspired by Image 3 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-neutral-500">
            DEFENSIVE HEURISTICS
          </div>
          <h3
            id="heuristic-meter-heading"
            className="text-base sm:text-lg font-black tracking-tight text-neutral-900"
          >
            Threat Indicator Score
          </h3>
          <p className="text-xs text-neutral-600 font-medium italic">
            Heuristic indicator, not a statistical probability
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`font-mono text-base font-black px-3 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000000] ${badgeColor}`}
            aria-label={`Score ${normalizedScore} out of 100`}
          >
            {normalizedScore} <span className="text-xs font-normal opacity-80">/ 100</span>
          </div>

          <motion.button
            type="button"
            onClick={() => setShowExplanation((prev) => !prev)}
            aria-expanded={showExplanation}
            aria-controls="heuristic-explanation-box"
            className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 py-1.5 px-3 rounded-lg border-2 border-black bg-white shadow-[2px_2px_0px_#000000] cursor-pointer"
            whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0px #000000' }}
            whileTap={{ x: 1, y: 1, boxShadow: '0px 0px 0px #000000' }}
          >
            <HelpCircle className="w-3.5 h-3.5 text-neutral-700" aria-hidden="true" />
            <span className="hidden sm:inline">Details</span>
            {showExplanation ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </motion.button>
        </div>
      </div>

      {/* Metric Breakdown Container inspired by Image 3 */}
      <div className="p-3.5 rounded-xl border border-neutral-300 bg-[#faf8f3] flex flex-col gap-3">
        {/* Animated Progress Bar */}
        <div
          className="w-full h-4 bg-white rounded-lg overflow-hidden border-2 border-black p-0.5 shadow-inner"
          role="progressbar"
          aria-valuenow={normalizedScore}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Heuristic threat score bar"
        >
          <motion.div
            className={`h-full rounded-md border border-black/40 ${barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${normalizedScore}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.1 }}
          />
        </div>

        {/* Consistency Legend like Image 3 (Easy/Medium/Hard style) */}
        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-neutral-600 px-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#8bfb34] border border-black" />
            <span>0-34 Safe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#fbbf24] border border-black" />
            <span>35-69 Suspicious</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#ff4d4d] border border-black" />
            <span>70-100 High Risk</span>
          </div>
        </div>
      </div>

      {/* Animated Explanation Dropdown */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div
            id="heuristic-explanation-box"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-neutral-900 text-neutral-100 border-2 border-black text-xs leading-relaxed flex items-start gap-3 shadow-[3px_3px_0px_#000000]">
              <AlertCircle className="w-5 h-5 text-[#8bfb34] flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1.5 font-sans">
                <p>
                  <strong className="text-white">About this heuristic score:</strong> This score represents the model&apos;s qualitative weighting of anomaly signals (urgency, credential harvesting, brand impersonation, spoofed links) detected in the submission.
                </p>
                <p className="text-neutral-400">
                  It is intended as a triage aid for security personnel, not a mathematical probability of malicious intent. Low scores do not guarantee safety.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
