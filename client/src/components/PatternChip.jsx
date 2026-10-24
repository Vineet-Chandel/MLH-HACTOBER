import React from 'react';
import { motion } from 'motion/react';
import { Tag, Sparkles, Globe2, ShieldQuestion } from 'lucide-react';
import indiaPatternsData from '../data/india-scam-patterns.json' with { type: 'json' };

const rawPatterns = Array.isArray(indiaPatternsData)
  ? indiaPatternsData
  : indiaPatternsData.patterns || [];

/**
 * PatternChip: Renders AI-suggested scam pattern and detected language chips.
 * Clearly tagged with "AI-generated, not a verdict".
 */
export default function PatternChip({
  scamPattern,
  patternRationale,
  detectedLanguage = 'unclear',
  displayLanguage = 'en',
}) {
  const isHindi = displayLanguage === 'hi';

  const formatLanguageLabel = (lang) => {
    switch (lang) {
      case 'hi':
        return isHindi ? 'भाषा: हिन्दी (देवनागरी)' : 'Language: Hindi (Devanagari)';
      case 'hinglish':
        return isHindi ? 'भाषा: हिंग्लिश (लैटिन लिपि)' : 'Language: Hinglish (Latin script)';
      case 'en':
        return isHindi ? 'भाषा: अंग्रेज़ी' : 'Language: English';
      case 'mixed':
        return isHindi ? 'भाषा: मिश्रित (देवनागरी + लैटिन)' : 'Language: Mixed (Hindi + English)';
      case 'other':
        return isHindi ? 'भाषा: अन्य' : 'Language: Other';
      default:
        return isHindi ? 'भाषा: अस्पष्ट' : 'Language: Unclear';
    }
  };

  const isHiddenPattern =
    !scamPattern ||
    scamPattern === 'none' ||
    scamPattern === 'unclear' ||
    scamPattern === 'other';

  if (isHiddenPattern) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2.5 py-3 px-4 rounded-xl bg-white border-2 border-black text-xs text-neutral-700 shadow-[3px_3px_0px_#000000] font-medium">
        <div className="flex items-center gap-2">
          <ShieldQuestion className="w-4 h-4 text-black" aria-hidden="true" />
          <span>
            {isHindi
              ? 'कोई विशिष्ट भारतीय स्कैम पैटर्न नहीं पहचाना गया (सामान्य सुरक्षा संकेतकों पर मूल्यांकन)।'
              : 'No specific localized scam pattern identified (evaluated against universal defensive markers).'}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-[#faf8f3] text-black border border-black shadow-[1px_1px_0px_#000]">
          <Globe2 className="w-3.5 h-3.5 text-neutral-700" aria-hidden="true" />
          <span>{formatLanguageLabel(detectedLanguage)}</span>
        </span>
      </div>
    );
  }

  // Look up pattern title from data file
  const matched = rawPatterns.find((p) => p.id === scamPattern);
  const patternTitle = isHindi
    ? matched?.title_hi || scamPattern
    : matched?.title_en || scamPattern;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-2xl bg-white border-2 border-black flex flex-col gap-3 shadow-[5px_5px_0px_#000000]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-neutral-100 pb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 rounded-lg bg-[#8bfb34] border border-black text-black shadow-[1px_1px_0px_#000]">
            <Tag className="w-4 h-4" aria-hidden="true" />
          </div>
          <span className="text-xs font-black text-neutral-900">
            {isHindi ? 'एआई-सुझाया गया पैटर्न:' : 'AI-suggested Pattern:'}{' '}
            <span className="text-black underline decoration-2 decoration-[#8bfb34] font-extrabold">{patternTitle}</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#faf8f3] text-black border border-black font-bold shadow-[1px_1px_0px_#000]">
            {isHindi ? 'एआई-जनरेटेड, कोई अंतिम निर्णय नहीं' : 'AI-suggested, not a verdict'}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-white text-black border border-black shadow-[1px_1px_0px_#000]">
          <Globe2 className="w-3.5 h-3.5 text-black" aria-hidden="true" />
          <span>{formatLanguageLabel(detectedLanguage)}</span>
        </span>
      </div>

      {patternRationale && (
        <p className="text-xs text-neutral-800 leading-relaxed pl-3 border-l-3 border-[#8bfb34] font-medium italic">
          {patternRationale}
        </p>
      )}
    </motion.div>
  );
}
