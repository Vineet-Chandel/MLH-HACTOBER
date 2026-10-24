import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Eye, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';

/**
 * Computes segmented text ranges for rendering highlights with overlapping interval support.
 * Pure function, zero dangerouslySetInnerHTML.
 */
function buildSegments(text, indicators) {
  if (!text || typeof text !== 'string') return [];

  // Filter valid matches
  const validMatches = [];
  (indicators || []).forEach((ind, originalIndex) => {
    if (
      ind.evidence_match &&
      ind.evidence_match.found &&
      typeof ind.evidence_match.start === 'number' &&
      typeof ind.evidence_match.end === 'number' &&
      ind.evidence_match.end > ind.evidence_match.start
    ) {
      const start = Math.max(0, Math.min(text.length, ind.evidence_match.start));
      const end = Math.max(0, Math.min(text.length, ind.evidence_match.end));
      if (end > start) {
        validMatches.push({
          start,
          end,
          originalIndex,
          displayNumber: ind.displayNumber || originalIndex + 1,
          severity: ind.severity,
          category: ind.category,
        });
      }
    }
  });

  if (validMatches.length === 0) {
    return [{ start: 0, end: text.length, isHighlight: false, indicators: [] }];
  }

  // Collect sorted unique cut points
  const cutPointsSet = new Set([0, text.length]);
  validMatches.forEach((m) => {
    cutPointsSet.add(m.start);
    cutPointsSet.add(m.end);
  });
  const cutPoints = Array.from(cutPointsSet).sort((a, b) => a - b);

  const segments = [];
  for (let i = 0; i < cutPoints.length - 1; i++) {
    const start = cutPoints[i];
    const end = cutPoints[i + 1];
    const covering = validMatches.filter((m) => m.start <= start && m.end >= end);

    if (covering.length === 0) {
      segments.push({
        start,
        end,
        isHighlight: false,
        indicators: [],
      });
    } else {
      let severity = 'low';
      if (covering.some((c) => c.severity === 'high')) {
        severity = 'high';
      } else if (covering.some((c) => c.severity === 'medium')) {
        severity = 'medium';
      }

      segments.push({
        start,
        end,
        isHighlight: true,
        severity,
        indicators: covering,
      });
    }
  }

  return segments;
}

export default function HighlightedMessage({
  message,
  indicators,
  activeIndicatorIndex,
  onSelectIndicator,
}) {
  const segments = useMemo(
    () => buildSegments(message, indicators),
    [message, indicators]
  );

  const verifiedCount = (indicators || []).filter(
    (i) => i.evidence_match && i.evidence_match.found
  ).length;

  const handleSegmentKeyDown = (e, targetIndex) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectIndicator(targetIndex);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header bar above reading surface */}
      <div className="flex items-center justify-between border-b-2 border-neutral-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#8bfb34] border-2 border-black shadow-[2px_2px_0px_#000000]">
            <FileText className="w-4 h-4 text-black" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900">
              Content Inspection Surface
            </h3>
            <span className="text-[10px] font-mono text-neutral-500">
              Grounded Evidence Verification
            </span>
          </div>
        </div>

        <div className="text-xs">
          {verifiedCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#8bfb34] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{verifiedCount} quote span{verifiedCount === 1 ? '' : 's'}</span>
            </span>
          ) : (
            <span className="text-neutral-500 text-xs italic">No matching text quotes</span>
          )}
        </div>
      </div>

      {/* Reading Surface: Pure white, crisp black 2px border, hard drop shadow */}
      <div
        className="rounded-xl border-2 border-black bg-white text-neutral-900 p-4 sm:p-5 shadow-[4px_4px_0px_#000000] font-sans text-sm sm:text-base leading-relaxed break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap selection:bg-[#8bfb34]/40"
        aria-label="Submitted message text with highlighted indicators"
        tabIndex={0}
      >
        {segments.map((seg, idx) => {
          const sliceText = message.slice(seg.start, seg.end);

          if (!seg.isHighlight) {
            return <span key={idx}>{sliceText}</span>;
          }

          const isCurrentActive = seg.indicators.some(
            (ind) => ind.originalIndex === activeIndicatorIndex
          );

          let bgClasses = 'bg-[#dcfce7] text-[#166534] border-b-2 border-[#15803d]';
          let badgeBg = 'bg-[#15803d] text-white';

          if (seg.severity === 'high') {
            bgClasses = 'bg-[#fee2e2] text-[#991b1b] border-b-2 border-[#b91c1c]';
            badgeBg = 'bg-[#b91c1c] text-white';
          } else if (seg.severity === 'medium') {
            bgClasses = 'bg-[#fef3c7] text-[#92400e] border-b-2 border-[#b45309]';
            badgeBg = 'bg-[#b45309] text-white';
          }

          const primaryTargetIndex = seg.indicators[0].originalIndex;
          const indicatorTags = seg.indicators
            .map((i) => `#${i.displayNumber}`)
            .join(', ');

          return (
            <mark
              key={idx}
              id={`highlight-${primaryTargetIndex}`}
              tabIndex={0}
              role="button"
              aria-label={`Evidence quote for indicator ${indicatorTags}: ${seg.severity} severity. Click to focus card.`}
              onClick={() => onSelectIndicator(primaryTargetIndex)}
              onKeyDown={(e) => handleSegmentKeyDown(e, primaryTargetIndex)}
              className={`inline rounded px-1.5 py-0.5 mx-0.5 cursor-pointer transition-all duration-150 ${bgClasses} ${
                isCurrentActive
                  ? 'ring-2 ring-black ring-offset-1 font-bold shadow-[2px_2px_0px_#000000]'
                  : 'hover:opacity-90'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black`}
            >
              <span>{sliceText}</span>
              <sup
                className={`ml-1 inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-black tracking-tight select-none border border-black/40 ${badgeBg}`}
                aria-hidden="true"
              >
                {indicatorTags}
              </sup>
            </mark>
          );
        })}
      </div>

      <p className="text-[11px] font-medium text-neutral-500 italic">
        Tip: Click any highlighted span to jump directly to its evidence analysis card.
      </p>
    </div>
  );
}
