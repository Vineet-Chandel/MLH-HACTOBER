import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyReportButton({ analysis, meta, submittedMessage, submittedUrl }) {
  const [copied, setCopied] = useState(false);

  const generateReportText = () => {
    if (!analysis) return '';

    const timestamp = new Date().toISOString();
    const divider = '='.repeat(60);
    const subDivider = '-'.repeat(40);

    const lines = [
      divider,
      'LINKSLEUTH DEFENSIVE SECURITY INVESTIGATION REPORT',
      divider,
      `Generated: ${timestamp}`,
      `Assessed Risk Level: ${analysis.risk_level.toUpperCase()}`,
      `Heuristic Score: ${analysis.heuristic_score} / 100 (Heuristic indicator, not a probability)`,
      `Model: ${meta?.model || 'Gemma 4'}`,
      `Latency: ${meta?.latency_ms ? `${meta.latency_ms}ms` : 'N/A'}`,
      '',
      'EXECUTIVE SUMMARY:',
      subDivider,
      analysis.summary,
      '',
      `IDENTIFIED INDICATORS (${analysis.indicators?.length || 0}):`,
      subDivider,
    ];

    if (!analysis.indicators || analysis.indicators.length === 0) {
      lines.push('None detected.');
    } else {
      analysis.indicators.forEach((ind, i) => {
        lines.push(`[${i + 1}] Category: ${ind.category.toUpperCase()}`);
        lines.push(`    Severity: ${ind.severity.toUpperCase()}`);
        lines.push(
          `    Verified in Message: ${
            ind.evidence_match?.found ? 'YES' : 'NO (Unverified quote)'
          }`
        );
        lines.push(`    Quoted Evidence: "${ind.evidence}"`);
        lines.push(`    Explanation: ${ind.explanation}`);
        if (ind.uncertainty) {
          lines.push(`    Uncertainty: ${ind.uncertainty}`);
        }
        lines.push('');
      });
    }

    lines.push('POSITIVE OR NEUTRAL SIGNALS:');
    lines.push(subDivider);
    if (!analysis.positive_or_neutral_signals || analysis.positive_or_neutral_signals.length === 0) {
      lines.push('None noted.');
    } else {
      analysis.positive_or_neutral_signals.forEach((sig) => lines.push(`- ${sig}`));
    }
    lines.push('');

    lines.push('RECOMMENDED ACTIONS:');
    lines.push(subDivider);
    if (!analysis.recommended_actions || analysis.recommended_actions.length === 0) {
      lines.push('None provided.');
    } else {
      analysis.recommended_actions.forEach((act, i) => lines.push(`${i + 1}. ${act}`));
    }
    lines.push('');

    lines.push('INVESTIGATION LIMITATIONS & DISCLAIMER:');
    lines.push(subDivider);
    if (analysis.limitations?.length > 0) {
      analysis.limitations.forEach((lim) => lines.push(`- ${lim}`));
    }
    lines.push(
      'Disclaimer: LinkSleuth provides indicators, not proof. It cannot confirm that a message, sender, or website is safe.'
    );
    lines.push(divider);

    return lines.join('\n');
  };

  const handleCopy = async () => {
    try {
      const text = generateReportText();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy full analysis report to clipboard"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-white/10 hover:border-teal-500/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 cursor-pointer"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span className="text-emerald-300 font-semibold">Report Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
          <span>Copy Full Report</span>
        </>
      )}
    </button>
  );
}
