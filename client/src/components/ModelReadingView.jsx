import React, { useState } from 'react';
import { motion } from 'motion/react';
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
import NeoButton from './NeoButton.jsx';

export default function ModelReadingView({
  imageObservations,
  indicators,
  activeIndicatorIndex,
  onSelectIndicator,
}) {
  const [copiedUrl, setCopiedUrl] = useState(null);

  if (!imageObservations) {
    return (
      <div className="text-xs text-neutral-500 italic p-4 text-center">
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
    <div className="flex flex-col gap-5">
      {/* 1. Image Quality Note (if present) */}
      {image_quality_note && (
        <div className="p-3 rounded-xl bg-[#faf8f3] border-2 border-black text-xs text-neutral-800 flex items-start gap-2.5 shadow-[2px_2px_0px_#000]">
          <AlertCircle className="w-4 h-4 text-black flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-black text-black">Image Quality Note:</span>{' '}
            {image_quality_note}
          </div>
        </div>
      )}

      {/* 2. Transcribed Text Reading Surface with Evidence Highlighting */}
      <section aria-labelledby="transcript-heading" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-[#8bfb34] border border-black shadow-[1px_1px_0px_#000]">
              <FileText className="w-4 h-4 text-black" aria-hidden="true" />
            </div>
            <h3
              id="transcript-heading"
              className="text-xs font-black text-neutral-900 uppercase tracking-wider"
            >
              Transcribed Text (Model OCR)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-neutral-500">
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
          <p className="text-xs text-neutral-500 italic bg-[#faf8f3] p-3 rounded-xl border border-neutral-300">
            No visible text detected in the submitted image.
          </p>
        )}
      </section>

      {/* 3. Visual Elements Identified */}
      {visual_elements && visual_elements.length > 0 && (
        <section aria-labelledby="visual-elements-heading" className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-white border border-black shadow-[1px_1px_0px_#000]">
              <Eye className="w-4 h-4 text-black" aria-hidden="true" />
            </div>
            <h3
              id="visual-elements-heading"
              className="text-xs font-black text-neutral-900 uppercase tracking-wider"
            >
              Visual Elements Observed ({visual_elements.length})
            </h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {visual_elements.map((el, i) => (
              <span
                key={i}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border-2 border-black text-neutral-900 flex items-center gap-2 shadow-[2px_2px_0px_#000000]"
              >
                <span className="w-2 h-2 rounded-full bg-[#8bfb34] border border-black" aria-hidden="true" />
                <span>{el}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 4. Visible URLs Observed */}
      <section aria-labelledby="visible-urls-heading" className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-white border border-black shadow-[1px_1px_0px_#000]">
              <Link2 className="w-4 h-4 text-black" aria-hidden="true" />
            </div>
            <h3
              id="visible-urls-heading"
              className="text-xs font-black text-neutral-900 uppercase tracking-wider"
            >
              Visible URLs &amp; Domains ({visible_urls?.length || 0})
            </h3>
          </div>
        </div>

        <p className="text-xs text-neutral-500 italic font-medium">
          URLs extracted from image text are not opened or fetched. Checked later by deterministic URL inspection rules.
        </p>

        {(!visible_urls || visible_urls.length === 0) ? (
          <p className="text-xs text-neutral-500 italic bg-[#faf8f3] p-3 rounded-xl border border-neutral-300">
            No URLs or web links identified in the screenshot.
          </p>
        ) : (
          <div className="space-y-2">
            {visible_urls.map((rawUrl, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white border-2 border-black text-xs font-mono font-bold text-neutral-900 break-all shadow-[2px_2px_0px_#000000]"
              >
                <span className="select-all">{rawUrl}</span>
                <NeoButton
                  size="sm"
                  variant="primary"
                  onClick={() => handleCopyUrl(rawUrl)}
                  aria-label={`Copy URL ${rawUrl}`}
                >
                  {copiedUrl === rawUrl ? (
                    <>
                      <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" aria-hidden="true" />
                      <span>Copy</span>
                    </>
                  )}
                </NeoButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
