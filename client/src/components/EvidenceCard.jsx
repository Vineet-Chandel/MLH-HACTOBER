import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  UserX,
  Clock,
  KeyRound,
  Globe,
  CreditCard,
  Link as LinkIcon,
  FileQuestion,
  HelpCircle,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import NeoButton from './NeoButton.jsx';

const CATEGORY_MAP = {
  impersonation: { label: 'Impersonation', icon: UserX },
  urgency: { label: 'Manufactured Urgency', icon: Clock },
  credential_request: { label: 'Credential Request', icon: KeyRound },
  domain_mismatch: { label: 'Domain Mismatch', icon: Globe },
  payment_request: { label: 'Payment Request', icon: CreditCard },
  attachment_or_link: { label: 'Suspicious Link / Attachment', icon: LinkIcon },
  inconsistency: { label: 'Contextual Inconsistency', icon: FileQuestion },
  other: { label: 'Other Indicator', icon: HelpCircle },
};

const SEVERITY_CONFIG = {
  high: {
    label: 'High Severity',
    icon: AlertOctagon,
    badge: 'bg-[#ff4d4d] text-white',
    quoteBg: 'bg-[#fee2e2] text-[#991b1b] border-2 border-[#ef4444]',
  },
  medium: {
    label: 'Medium Severity',
    icon: AlertTriangle,
    badge: 'bg-[#fbbf24] text-black',
    quoteBg: 'bg-[#fef3c7] text-[#92400e] border-2 border-[#f59e0b]',
  },
  low: {
    label: 'Low Severity',
    icon: CheckCircle2,
    badge: 'bg-[#8bfb34] text-black',
    quoteBg: 'bg-[#dcfce7] text-[#166534] border-2 border-[#22c55e]',
  },
};

export default function EvidenceCard({
  indicator,
  index,
  displayNumber,
  isActive,
  onFocusCard,
  onJumpToHighlight,
  inputType = 'text',
}) {
  const [isOpen, setIsOpen] = useState(indicator.severity === 'high');
  const cardRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [isActive]);

  const catMeta = CATEGORY_MAP[indicator.category] || CATEGORY_MAP.other;
  const CategoryIcon = catMeta.icon;

  const sevMeta = SEVERITY_CONFIG[indicator.severity] || SEVERITY_CONFIG.low;
  const SeverityIcon = sevMeta.icon;

  const isVerified = Boolean(indicator.evidence_match?.found);
  const isVisual = indicator.evidence_source === 'visual_element';

  return (
    <motion.article
      ref={cardRef}
      id={`evidence-card-${index}`}
      tabIndex={0}
      onFocus={() => onFocusCard?.(index)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border-2 border-black bg-white transition-all duration-150 p-4 sm:p-5 flex flex-col gap-3 ${
        isActive
          ? 'shadow-[6px_6px_0px_#000000] ring-2 ring-black'
          : 'shadow-[4px_4px_0px_#000000] hover:shadow-[5px_5px_0px_#000000]'
      }`}
      aria-labelledby={`card-title-${index}`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Indicator Index Badge */}
          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-black text-white border border-black shadow-[1px_1px_0px_#000000]">
            #{displayNumber || index + 1}
          </span>

          {/* Severity Badge */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_#000000] ${sevMeta.badge}`}
          >
            <SeverityIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{sevMeta.label}</span>
          </span>

          {/* Category Chip */}
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-[#faf8f3] text-neutral-800 border border-neutral-300">
            <CategoryIcon className="w-3.5 h-3.5 text-neutral-600" aria-hidden="true" />
            <span>{catMeta.label}</span>
          </span>
        </div>

        {/* Collapsible toggle button */}
        <motion.button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls={`card-body-${index}`}
          className="p-1 rounded-md border-2 border-black bg-[#faf8f3] hover:bg-neutral-100 cursor-pointer shadow-[2px_2px_0px_#000000]"
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 1, y: 1, boxShadow: '0px 0px 0px #000' }}
          title={isOpen ? 'Collapse card' : 'Expand card'}
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4 text-black" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4 text-black" aria-hidden="true" />
          )}
        </motion.button>
      </div>

      {/* Main Signal Title */}
      <h4
        id={`card-title-${index}`}
        className="text-sm sm:text-base font-bold text-neutral-900 leading-snug"
      >
        {indicator.signal}
      </h4>

      {/* Expandable Body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`card-body-${index}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-3 overflow-hidden pt-1"
          >
            {/* Grounded Evidence Quote Box */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                <span>{isVisual ? 'Observed Visual Element:' : 'Cited Text Quote:'}</span>
                {isVerified ? (
                  <span className="text-[#15803d] flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    VERIFIED IN INPUT
                  </span>
                ) : (
                  <span className="text-[#b45309] flex items-center gap-1 font-bold">
                    <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    UNVERIFIED CITATION
                  </span>
                )}
              </div>

              <blockquote
                className={`p-3 rounded-lg text-xs leading-relaxed font-mono break-words ${sevMeta.quoteBg} shadow-[2px_2px_0px_#000000]`}
              >
                &ldquo;{indicator.quote || 'No specific quote provided'}&rdquo;
              </blockquote>
            </div>

            {/* Explanation Note */}
            <div className="text-xs text-neutral-700 leading-relaxed font-medium bg-[#faf8f3] p-3 rounded-lg border border-neutral-300">
              <span className="font-bold text-neutral-900">Why this matters: </span>
              {indicator.explanation}
            </div>

            {/* Footer / Jump to Highlight action button */}
            {isVerified && onJumpToHighlight && (
              <div className="pt-2 flex justify-end">
                <NeoButton
                  size="sm"
                  variant="primary"
                  onClick={() => onJumpToHighlight(index)}
                  className="group"
                >
                  <Crosshair className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                  <span>Inspect in Content</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </NeoButton>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
