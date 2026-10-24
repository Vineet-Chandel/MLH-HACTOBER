import React, { useState } from 'react';
import { Copy, Check, FileDown, Shield } from 'lucide-react';
import { defangText } from '../utils/defang.js';
import NeoButton from './NeoButton.jsx';

export default function CopyReportButton({
  analysis,
  meta,
  submittedMessage,
  submittedUrl,
  urlChecks,
  staticGuidance,
}) {
  const [copied, setCopied] = useState(false);
  const [defangLinks, setDefangLinks] = useState(true);
  const [announceMsg, setAnnounceMsg] = useState('');
  const [copyError, setCopyError] = useState(null);

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
      `Input Mode: ${meta?.input_type === 'image' ? 'SCREENSHOT / IMAGE' : 'TEXT SUBMISSION'}`,
      `Assessed Risk Level: ${analysis.risk_level.toUpperCase()}`,
      `Heuristic Score: ${analysis.heuristic_score} / 100 (Heuristic indicator, not a probability)`,
      `Model: ${meta?.model || 'Gemma 4'}`,
      `Latency: ${meta?.latency_ms ? `${meta.latency_ms}ms` : 'N/A'}`,
      '',
      'EXECUTIVE SUMMARY:',
      subDivider,
      analysis.summary,
      '',
    ];

    // Deterministic Rule-Based URL Checks (Not AI)
    if (urlChecks?.urls?.length > 0) {
      lines.push('DETERMINISTIC RULE-BASED URL CHECKS (NOT AI):');
      lines.push(subDivider);
      lines.push(
        'Rules run on string patterns only; links are never opened, downloaded, or resolved.'
      );
      urlChecks.urls.forEach((u, i) => {
        lines.push(`[URL ${i + 1}] ${u.display_defanged || u.raw || u.url}`);
        lines.push(`    Parse Status: ${u.parse_ok ? 'OK' : 'Malformed / Non-web'}`);
        if (u.hostname) lines.push(`    Hostname: ${u.hostname}`);
        if (u.registrable_domain)
          lines.push(`    Registrable Domain: ${u.registrable_domain}`);
        lines.push(`    Highest Severity: ${u.highest_severity.toUpperCase()}`);
        if (u.findings?.length > 0) {
          lines.push('    Findings:');
          u.findings.forEach((f) => {
            lines.push(`      - [${f.severity.toUpperCase()}] ${f.label}: ${f.detail}`);
          });
        } else {
          lines.push('    Findings: None (clean rules)');
        }
        lines.push('');
      });
      if (urlChecks.not_checked?.length > 0) {
        lines.push(
          "Notice: LinkSleuth did not look up this domain's age, reputation, certificate, or blacklist status."
        );
      }
      lines.push('');
    }

    // Indicators / Findings
    lines.push(`IDENTIFIED INDICATORS (${analysis.indicators?.length || 0}):`);
    lines.push(subDivider);
    if (!analysis.indicators || analysis.indicators.length === 0) {
      lines.push('No suspicious or malicious indicators identified.');
    } else {
      analysis.indicators.forEach((ind, i) => {
        lines.push(`[#${i + 1}] ${ind.signal}`);
        lines.push(`    Severity: ${ind.severity.toUpperCase()}`);
        lines.push(`    Category: ${ind.category}`);
        if (ind.quote) lines.push(`    Evidence Quote: "${ind.quote}"`);
        lines.push(`    Explanation: ${ind.explanation}`);
        lines.push('');
      });
    }

    // Reassuring Signals
    if (analysis.positive_or_neutral_signals?.length > 0) {
      lines.push('REASSURING OR NEUTRAL SIGNALS:');
      lines.push(subDivider);
      analysis.positive_or_neutral_signals.forEach((sig) => lines.push(`- ${sig}`));
      lines.push('');
    }

    // Recommended Actions
    lines.push('RECOMMENDED NEXT STEPS:');
    lines.push(subDivider);
    if (!analysis.recommended_actions || analysis.recommended_actions.length === 0) {
      lines.push('No specific remedial actions recommended.');
    } else {
      analysis.recommended_actions.forEach((act, i) => lines.push(`${i + 1}. ${act}`));
    }
    lines.push('');

    // Pattern & Language
    if (analysis.scam_pattern && analysis.scam_pattern !== 'none' && analysis.scam_pattern !== 'unclear') {
      lines.push('AI-SUGGESTED SCAM PATTERN (AI-GENERATED, NOT A VERDICT):');
      lines.push(subDivider);
      lines.push(`Pattern ID: ${analysis.scam_pattern}`);
      if (staticGuidance?.pattern_tip?.title) {
        lines.push(`Pattern Title: ${staticGuidance.pattern_tip.title}`);
      }
      if (analysis.detected_language) {
        lines.push(`Detected Language: ${analysis.detected_language}`);
      }
      if (analysis.pattern_rationale) {
        lines.push(`Pattern Rationale: ${analysis.pattern_rationale}`);
      }
      lines.push('');
    } else if (analysis.detected_language && analysis.detected_language !== 'unclear') {
      lines.push(`DETECTED LANGUAGE: ${analysis.detected_language}`);
      lines.push('');
    }

    // Static Pattern Tip
    if (staticGuidance?.pattern_tip?.tip) {
      lines.push('STATIC PATTERN GUIDANCE (NOT AI-GENERATED):');
      lines.push(subDivider);
      lines.push(`Good to know: ${staticGuidance.pattern_tip.tip}`);
      lines.push('');
    }

    // Limitations & Disclaimer
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
      setCopyError(null);
      let text = generateReportText();
      if (defangLinks) {
        text = defangText(text);
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setAnnounceMsg('Full report copied to clipboard.');
      setTimeout(() => {
        setCopied(false);
        setAnnounceMsg('');
      }, 2000);
    } catch {
      setCopyError('Unable to copy report to clipboard.');
      setAnnounceMsg('Failed to copy report to clipboard.');
      setTimeout(() => {
        setCopyError(null);
        setAnnounceMsg('');
      }, 3000);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Live region for aria screen readers */}
      <div aria-live="polite" className="sr-only">
        {announceMsg}
      </div>

      {/* Defang links checkbox */}
      <label className="flex items-center gap-2 text-xs font-bold text-neutral-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={defangLinks}
          onChange={(e) => setDefangLinks(e.target.checked)}
          className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer"
        />
        <span>Defang links</span>
      </label>

      {/* Tactile NeoButton */}
      <NeoButton
        size="sm"
        variant={copied ? 'primary' : 'secondary'}
        onClick={handleCopy}
        aria-label="Copy full analysis report to clipboard"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 mr-1 stroke-[2.5]" aria-hidden="true" />
            <span>Report Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
            <span>Copy Full Report</span>
          </>
        )}
      </NeoButton>

      {copyError && (
        <span className="text-xs font-bold text-red-600" role="alert">
          {copyError}
        </span>
      )}
    </div>
  );
}
