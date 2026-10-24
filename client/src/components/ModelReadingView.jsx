import React, { useState } from 'react';
import {
  FileText,
  Eye,
  Link2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import HighlightedMessage from './HighlightedMessage.jsx';

export default function ModelReadingView({
  imageObservations,
  indicators,
  activeIndicatorIndex,
  onSelectIndicator,
}) {
  const [copiedUrl, setCopiedUrl] = useState(null);

  if (!imageObservations) {
    return (
      <div className="text-xs text-slate-400 italic p-4 text-center">
        No image observations returned by the model.
      </div>
    );
  }

  const {
    transcribed_text = '',
    visual_elements = [],
    visible_urls = [],
    image_quality_note = '',
  } = imageObservations;

  const handleCopyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Image Quality Note (if present) */}
      {image_quality_note && (
        <div className="p-2.5 rounded-[8px] bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-slate-200">Image Quality Note:</span>{' '}
            {image_quality_note}
          </div>
        </div>
      )}

      {/* 2. Transcribed Text Reading Surface with Evidence Highlighting */}
      <section aria-labelledby="transcript-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-teal-400" aria-hidden="true" />
            <h3
              id="transcript-heading"
              className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Transcribed Text (Model OCR)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {transcribed_text.length.toLocaleString()} characters read
          </span>
        </div>

        {transcribed_text.trim() ? (
          <HighlightedMessage
            message={transcribed_text}
            indicators={indicators}
            activeIndicatorIndex={activeIndicatorIndex}
            onSelectIndicator={onSelectIndicator}
          />
        ) : (
          <p className="text-xs text-slate-400 italic bg-[#0a0f1d] p-3 rounded-[8px] border border-white/5">
            No visible text detected in the submitted image.
          </p>
        )}
      </section>

      {/* 3. Visual Elements Identified */}
      {visual_elements && visual_elements.length > 0 && (
        <section aria-labelledby="visual-elements-heading" className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-4 h-4 text-teal-400" aria-hidden="true" />
            <h3
              id="visual-elements-heading"
              className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Visual Elements Observed ({visual_elements.length})
            </h3>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {visual_elements.map((el, i) => (
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-[6px] bg-slate-900 border border-white/10 text-slate-200 flex items-center gap-1.5"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" aria-hidden="true" />
                <span>{el}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 4. Visible URLs Observed (Plain text only, NEVER clickable links) */}
      <section aria-labelledby="visible-urls-heading" className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h3
              id="visible-urls-heading"
              className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Visible URLs &amp; Domains ({visible_urls?.length || 0})
            </h3>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 italic">
          URLs extracted from image text are not opened or fetched. Checked later by deterministic URL inspection rules.
        </p>

        {(!visible_urls || visible_urls.length === 0) ? (
          <p className="text-xs text-slate-400 italic bg-[#0a0f1d] p-2.5 rounded-[8px] border border-white/5">
            No URLs or web links identified in the screenshot.
          </p>
        ) : (
          <div className="space-y-1.5">
            {visible_urls.map((rawUrl, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 p-2 rounded-[6px] bg-slate-900 border border-white/10 text-xs font-mono text-amber-200 break-all"
              >
                <span className="select-all">{rawUrl}</span>
                <button
                  type="button"
                  onClick={() => handleCopyUrl(rawUrl)}
                  aria-label={`Copy URL ${rawUrl}`}
                  className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-[11px]"
                >
                  {copiedUrl === rawUrl ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
