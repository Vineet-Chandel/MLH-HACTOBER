import React, { useMemo } from 'react';
import { Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';

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
          displayNumber: originalIndex + 1,
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
      // Determine composite severity (high > medium > low)
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
    <div className="flex flex-col gap-2.5">
      {/* Header bar above reading surface */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-teal-400" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Submitted Content Inspection
          </h3>
        </div>
        <div className="text-[11px] text-slate-400">
          {verifiedCount > 0 ? (
            <span className="flex items-center gap-1 text-teal-300 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{verifiedCount} quote span{verifiedCount === 1 ? '' : 's'} highlighted</span>
            </span>
          ) : (
            <span className="text-slate-400">No matching text quotes identified</span>
          )}
        </div>
      </div>

      {/* Reading Surface: Warm off-white, high-contrast document viewer */}
      <div
        className="rounded-[10px] border border-slate-300/80 bg-[#fdfbf7] text-[#0f172a] p-4 sm:p-5 shadow-sm font-sans text-sm sm:text-base leading-relaxed break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap selection:bg-teal-200"
        aria-label="Submitted message text with highlighted indicators"
        tabIndex={0}
      >
        {segments.map((seg, idx) => {
          const sliceText = message.slice(seg.start, seg.end);

          if (!seg.isHighlight) {
            return <span key={idx}>{sliceText}</span>;
          }

          // Highlight segment
          const isCurrentActive = seg.indicators.some(
            (ind) => ind.originalIndex === activeIndicatorIndex
          );

          let bgClasses = 'bg-[#ccfbf1] text-[#115e59] border-b-2 border-[#14b8a6]';
          let badgeBg = 'bg-[#115e59] text-white';

          if (seg.severity === 'high') {
            bgClasses = 'bg-[#fee2e2] text-[#991b1b] border-b-2 border-[#f43f5e]';
            badgeBg = 'bg-[#991b1b] text-white';
          } else if (seg.severity === 'medium') {
            bgClasses = 'bg-[#fef3c7] text-[#92400e] border-b-2 border-[#f59e0b]';
            badgeBg = 'bg-[#92400e] text-white';
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
              className={`inline rounded px-1 py-0.5 mx-0.5 cursor-pointer transition-all duration-150 ${bgClasses} ${
                isCurrentActive
                  ? 'ring-2 ring-teal-600 ring-offset-1 ring-offset-[#fdfbf7] font-semibold'
                  : 'hover:opacity-90'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600`}
            >
              <span>{sliceText}</span>
              <sup
                className={`ml-1 inline-flex items-center px-1 py-0.2 rounded text-[10px] font-mono font-bold tracking-tight select-none ${badgeBg}`}
                aria-hidden="true"
              >
                {indicatorTags}
              </sup>
            </mark>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 italic">
        Tip: Click or focus any highlighted span to jump directly to its evidence analysis card.
      </p>
    </div>
  );
}
