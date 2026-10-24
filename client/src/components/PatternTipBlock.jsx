import React from 'react';
import { motion } from 'motion/react';
import { Lightbulb } from 'lucide-react';

/**
 * PatternTipBlock: Static educational tip for identified scam pattern.
 * Clearly labeled as "Static guidance, not AI".
 */
export default function PatternTipBlock({ patternTip, displayLanguage = 'en' }) {
  if (!patternTip || !patternTip.tip) return null;

  const isHindi = displayLanguage === 'hi';
  const tipText = isHindi
    ? patternTip.tip_hi || patternTip.tip
    : patternTip.tip_en || patternTip.tip;
  const titleText = isHindi
    ? patternTip.title_hi || patternTip.title
    : patternTip.title_en || patternTip.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-white border-2 border-black flex flex-col gap-2.5 shadow-[5px_5px_0px_#000000]"
      aria-label={isHindi ? 'स्थिर मार्गदर्शन टिप' : 'Static Pattern Guidance Tip'}
    >
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[#fef08a] border border-black shadow-[1px_1px_0px_#000]">
            <Lightbulb className="w-4 h-4 text-black shrink-0" aria-hidden="true" />
          </div>
          <span className="text-xs font-black text-neutral-900">
            {isHindi ? 'जानना जरूरी है' : 'Good to know'}
            {titleText ? ` — ${titleText}` : ''}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#faf8f3] text-black border border-black font-bold shadow-[1px_1px_0px_#000] uppercase">
          {isHindi ? 'स्थिर मार्गदर्शन, एआई नहीं' : 'Static guidance (not AI)'}
        </span>
      </div>
      <p className="text-xs text-neutral-800 leading-relaxed font-semibold">
        {tipText}
      </p>
    </motion.div>
  );
}
