import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Link2,
  Copy,
  Check,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  ShieldCheck,
  SearchX,
  ExternalLink,
} from 'lucide-react';
import { defang } from '../utils/defang.js';
import NeoButton from './NeoButton.jsx';

export default function UrlChecksPanel({ urlChecks }) {
  const [copiedState, setCopiedState] = useState(null);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [copyError, setCopyError] = useState(null);

  if (!urlChecks) return null;

  const urls = urlChecks.urls || [];
  const truncated = Boolean(urlChecks.truncated);
  const notChecked = urlChecks.not_checked || [
    'domain age',
    'reputation or blacklist status',
    'TLS certificate',
    'redirect destination',
    'page content',
  ];

  const handleCopy = async (text, stateKey, successAnnouncement) => {
    try {
      setCopyError(null);
      await navigator.clipboard.writeText(text);
      setCopiedState(stateKey);
      setAnnounceMsg(successAnnouncement);
      setTimeout(() => {
        setCopiedState(null);
        setAnnounceMsg('');
      }, 2000);
    } catch {
      setCopyError('Unable to access clipboard. Please copy manually.');
      setAnnounceMsg('Failed to copy to clipboard.');
      setTimeout(() => {
        setCopyError(null);
        setAnnounceMsg('');
      }, 3000);
    }
  };

  const handleCopyAll = () => {
    const allDefanged = urls
      .map((u) => u.display_defanged || u.input || defang(u.raw || u.url || ''))
      .filter(Boolean)
      .join('\n');
    handleCopy(allDefanged, 'all', 'Copied all defanged links to clipboard.');
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase bg-[#ff4d4d] text-white border border-black shadow-[1px_1px_0px_#000]">
            <AlertOctagon className="w-3 h-3" aria-hidden="true" />
            HIGH RISK
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black uppercase bg-[#fbbf24] text-black border border-black shadow-[1px_1px_0px_#000]">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            MEDIUM
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#fef08a] text-black border border-black shadow-[1px_1px_0px_#000]">
            <Info className="w-3 h-3" aria-hidden="true" />
            LOW CONCERN
          </span>
        );
      case 'info':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#e0f2fe] text-black border border-black shadow-[1px_1px_0px_#000]">
            <Info className="w-3 h-3" aria-hidden="true" />
            INFO
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#8bfb34] text-black border border-black shadow-[1px_1px_0px_#000]">
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            CLEAN RULES
          </span>
        );
    }
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'explicit_input':
        return 'Explicit URL field';
      case 'message_body':
        return 'Found in message body';
      case 'image_ocr':
        return 'Found in image OCR';
      default:
        return 'Embedded Link';
    }
  };

  const getFindingIcon = (severity) => {
    switch (severity) {
      case 'high':
        return <AlertOctagon className="w-3.5 h-3.5 text-[#ff4d4d] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'medium':
        return <AlertTriangle className="w-3.5 h-3.5 text-[#b45309] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'low':
        return <Info className="w-3.5 h-3.5 text-[#b45309] shrink-0 mt-0.5" aria-hidden="true" />;
      default:
        return <Info className="w-3.5 h-3.5 text-neutral-600 shrink-0 mt-0.5" aria-hidden="true" />;
    }
  };

  return (
    <motion.section
      aria-label="Deterministic Rule-Based URL Checks"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.08 }}
      className="bg-white rounded-2xl border-2 border-black p-5 space-y-4 shadow-[6px_6px_0px_#000000]"
    >
      <div aria-live="polite" className="sr-only">
        {announceMsg}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-neutral-100 pb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-2 rounded-xl bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000000]">
            <Link2 className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-900 tracking-tight">
              Deterministic URL Inspection
            </h3>
            <span className="text-[10px] font-mono text-neutral-500 font-semibold">
              Parsed with pure application logic &middot; Zero network lookups
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#faf8f3] text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
          RULE ENGINE (NOT AI)
        </span>
      </div>

      {/* Explainer banner with Copy All button */}
      <div className="rounded-xl bg-[#faf8f3] border-2 border-black p-3.5 text-xs text-neutral-800 flex flex-wrap items-center justify-between gap-3 shadow-[2px_2px_0px_#000000]">
        <p className="leading-relaxed font-medium">
          Defanged links can&apos;t be clicked accidentally. Safe to share with your bank, security team, or incident responders.
        </p>

        {urls.length > 0 && (
          <NeoButton
            size="sm"
            variant="primary"
            onClick={handleCopyAll}
            aria-label="Copy all defanged links"
          >
            {copiedState === 'all' ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                <span>Copied All Links!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                <span>Copy All Defanged</span>
              </>
            )}
          </NeoButton>
        )}
      </div>

      {truncated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#fef08a] border-2 border-black text-black text-xs font-bold shadow-[2px_2px_0px_#000]">
          <Info className="w-4 h-4 text-black shrink-0" aria-hidden="true" />
          <span>Showing the first 10 links extracted from input.</span>
        </div>
      )}

      {copyError && (
        <div className="text-xs text-red-700 bg-red-100 border-2 border-black px-3 py-1.5 rounded-lg font-bold" role="alert">
          {copyError}
        </div>
      )}

      {/* URL List or Empty State */}
      {urls.length === 0 ? (
        <div className="flex items-center gap-2 py-4 px-4 rounded-xl bg-[#faf8f3] border-2 border-black text-neutral-600 text-xs font-semibold">
          <SearchX className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />
          <span>No links detected in this submission.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {urls.map((u, idx) => {
            const defangedDisplay = u.display_defanged || u.input || '';
            const severityLevel = u.max_severity || u.highest_severity || 'none';
            const isDefangedCopied = copiedState === `${idx}-defanged`;
            const rawUrl = u.raw || u.url || u.input || '';

            return (
              <div
                key={idx}
                className="bg-white rounded-xl border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_#000000]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="space-y-1.5 min-w-0 max-w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-black font-bold select-all break-all bg-[#faf8f3] px-2.5 py-1 rounded-md border-2 border-black shadow-[1px_1px_0px_#000]">
                        {defangedDisplay}
                      </span>
                      {getSeverityBadge(severityLevel)}
                      {u.source && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white text-neutral-700 border border-neutral-400">
                          {getSourceLabel(u.source)}
                        </span>
                      )}
                    </div>
                    {u.registrable_domain && (
                      <div className="text-xs text-neutral-600 flex items-center gap-1.5 pt-0.5 font-medium">
                        <span>Registrable domain:</span>
                        <code className="text-black font-mono font-bold bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-300">
                          {u.registrable_domain}
                        </code>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <NeoButton
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        handleCopy(
                          defangedDisplay,
                          `${idx}-defanged`,
                          `Copied defanged URL ${defangedDisplay}`
                        )
                      }
                      aria-label={`Copy defanged URL ${defangedDisplay}`}
                    >
                      {isDefangedCopied ? (
                        <>
                          <Check className="w-3 h-3 mr-1" aria-hidden="true" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 mr-1" aria-hidden="true" />
                          <span>Defanged</span>
                        </>
                      )}
                    </NeoButton>
                  </div>
                </div>

                {/* Findings List */}
                {u.findings?.length > 0 ? (
                  <div className="space-y-2 pt-2 border-t border-neutral-200">
                    {u.findings.map((f, fIdx) => (
                      <div
                        key={fIdx}
                        className="flex items-start gap-2 text-xs bg-[#faf8f3] rounded-lg p-2.5 border border-neutral-300 font-medium"
                      >
                        {getFindingIcon(f.severity)}
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-900 mr-1.5">
                            {f.label}:
                          </span>
                          <span className="text-neutral-700 leading-relaxed">
                            {f.detail}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-[#15803d] font-bold pt-2 border-t border-neutral-200">
                    <ShieldCheck className="w-4 h-4 text-[#15803d]" aria-hidden="true" />
                    <span>No rule-based anomalies detected on this URL.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Visible Not-Checked Notice */}
      <div className="rounded-xl bg-[#faf8f3] border border-neutral-300 p-3 space-y-1.5 text-xs text-neutral-600">
        <p className="text-neutral-900 font-bold leading-relaxed">
          LinkSleuth did not look up this domain&apos;s age, reputation, certificate, or blacklist status.
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-[11px] font-mono text-neutral-500 self-center mr-1">Not checked:</span>
          {notChecked.map((item, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-white text-neutral-700 border border-neutral-300"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
