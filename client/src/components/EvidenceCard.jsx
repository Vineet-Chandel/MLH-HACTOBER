import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

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
    badge: 'bg-rose-950/70 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/30',
    quoteBg: 'bg-rose-950/20 text-rose-200 border-rose-500/20',
  },
  medium: {
    label: 'Medium Severity',
    icon: AlertTriangle,
    badge: 'bg-amber-950/70 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30',
    quoteBg: 'bg-amber-950/20 text-amber-200 border-amber-500/20',
  },
  low: {
    label: 'Low Severity',
    icon: CheckCircle2,
    badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/30',
    quoteBg: 'bg-emerald-950/20 text-emerald-200 border-emerald-500/20',
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
  // Collapsible: high severity expanded by default, medium/low collapsed by default
  const [isOpen, setIsOpen] = useState(indicator.severity === 'high');
  const cardRef = useRef(null);

  // If card becomes active, auto-scroll and ensure it is open
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
    <article
      ref={cardRef}
      id={`evidence-card-${index}`}
      tabIndex={0}
      onFocus={() => onFocusCard?.(index)}
      className={`rounded-[10px] border bg-[#111827] transition-all duration-200 ${sevMeta.border} ${
        isActive
          ? 'ring-2 ring-teal-400 ring-offset-2 ring-offset-[#0a0f1d]'
          : 'hover:border-white/20'
      } p-3.5 sm:p-4 flex flex-col gap-2.5`}
      aria-labelledby={`card-title-${index}`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Card index tag */}
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-[6px] bg-slate-900 border border-white/10 text-slate-300">
            #{displayNumber}
          </span>

          {/* Category label with icon */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <CategoryIcon className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
            <span id={`card-title-${index}`}>{catMeta.label}</span>
          </div>

          {/* Severity Badge */}
          <span
            className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[6px] border ${sevMeta.badge}`}
          >
            <SeverityIcon className="w-3 h-3" aria-hidden="true" />
            <span>{sevMeta.label}</span>
          </span>

          {/* Source Tag for Image Analysis */}
          {inputType === 'image' && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-[6px] bg-slate-800 text-slate-300 border border-slate-700">
              {isVisual ? 'Visual element' : 'From transcribed text'}
            </span>
          )}
        </div>

        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Collapse indicator details' : 'Expand indicator details'}
          className="p-1 rounded-[6px] text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Quoted Evidence Monospace block */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
          <span className="font-semibold text-slate-400 uppercase tracking-wider">
            {isVisual ? 'Visual Evidence:' : 'Quoted Evidence:'}
          </span>

          {/* Grounding Verification Badge */}
          {inputType === 'image' ? (
            isVisual ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-teal-300 bg-teal-950/70 border border-teal-500/30 px-2 py-0.5 rounded-[6px]">
                <CheckCircle2 className="w-3 h-3 text-teal-400" aria-hidden="true" />
                <span>Visual observation (layout / logo / pattern)</span>
              </span>
            ) : isVerified ? (
              <span className="flex items-center gap-1 text-[10px] font-medium text-teal-300 bg-teal-950/70 border border-teal-500/30 px-2 py-0.5 rounded-[6px]">
                <CheckCircle2 className="w-3 h-3 text-teal-400" aria-hidden="true" />
                <span>Matches the model&apos;s reading of the image, not independently verified</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-[6px]">
                <AlertCircle className="w-3 h-3 text-amber-400" aria-hidden="true" />
                <span>Not found in model transcript, treat with caution</span>
              </span>
            )
          ) : isVerified ? (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-[6px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              <span>Quote verified in your message</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-300 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-[6px]">
              <AlertCircle className="w-3 h-3 text-amber-400" aria-hidden="true" />
              <span>Not found in your message, treat with caution</span>
            </span>
          )}
        </div>

        <div
          className={`font-mono text-xs p-2.5 rounded-[8px] border break-words break-all [overflow-wrap:anywhere] leading-relaxed ${sevMeta.quoteBg}`}
        >
          &ldquo;{indicator.evidence}&rdquo;
        </div>
      </div>

      {/* Collapsible Body Details */}
      {isOpen && (
        <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5 animate-fadeIn">
          {/* Why it matters */}
          <div>
            <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Why it matters
            </div>
            <p className="text-xs text-slate-200 leading-relaxed bg-[#0a0f1d]/50 p-2.5 rounded-[8px] border border-white/5">
              {indicator.explanation}
            </p>
          </div>

          {/* Alternative explanation / uncertainty */}
          {indicator.uncertainty && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>Alternative explanation / uncertainty</span>
              </div>
              <p className="text-xs text-slate-400 italic leading-relaxed bg-[#0a0f1d]/30 p-2 rounded-[8px] border border-white/5">
                {indicator.uncertainty}
              </p>
            </div>
          )}

          {/* Jump to Highlight Button (if verified) */}
          {isVerified && onJumpToHighlight && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => onJumpToHighlight(index)}
                className="flex items-center gap-1 text-[11px] font-medium text-teal-300 hover:text-teal-200 py-1 px-2.5 rounded-[6px] bg-teal-950/60 border border-teal-500/30 hover:bg-teal-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
              >
                <Crosshair className="w-3 h-3" aria-hidden="true" />
                <span>Jump to quote in message</span>
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
