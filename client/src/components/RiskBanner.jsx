import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Cpu,
  Clock,
} from 'lucide-react';

const RISK_CONFIG = {
  high_concern: {
    label: 'High Concern',
    icon: AlertOctagon,
    badgeBg: 'bg-rose-950/80 text-rose-200 border-rose-500/40',
    iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/30',
    accent: 'text-rose-300',
    description: 'Strong indicators of phishing, credential harvesting, or social engineering detected.',
  },
  suspicious: {
    label: 'Suspicious',
    icon: AlertTriangle,
    badgeBg: 'bg-amber-950/80 text-amber-200 border-amber-500/40',
    iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30',
    accent: 'text-amber-300',
    description: 'Anomalous or manipulative patterns identified that warrant cautious independent verification.',
  },
  low_concern: {
    label: 'Low Concern',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40',
    iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/30',
    accent: 'text-emerald-300',
    description: 'No evident malicious lures found in the submitted content; standard routine patterns observed.',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: HelpCircle,
    badgeBg: 'bg-slate-800/80 text-slate-200 border-slate-600/40',
    iconBg: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
    border: 'border-slate-700/60',
    accent: 'text-slate-300',
    description: "Not enough evidence to judge. Here's what we could and couldn't tell.",
  },
};

export default function RiskBanner({ riskLevel, summary, model, latencyMs }) {
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.inconclusive;
  const Icon = config.icon;

  const isInconclusive = riskLevel === 'inconclusive';

  return (
    <article
      className={`rounded-[10px] border p-4 bg-[#111827] ${config.border} flex flex-col gap-3`}
      aria-labelledby="risk-banner-title"
    >
      {/* Header Row: Threat badge + Model/Latency metadata */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-[8px] border flex items-center justify-center ${config.iconBg}`}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Assessed Threat Level
            </div>
            <div
              id="risk-banner-title"
              className="text-base sm:text-lg font-bold tracking-tight text-[#fdfbf7] flex items-center gap-2"
            >
              <span>{config.label}</span>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-[6px] border ${config.badgeBg}`}
              >
                {riskLevel.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Model & Latency Metadata Chips */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          {model && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-slate-900 border border-white/10">
              <Cpu className="w-3 h-3 text-teal-400" aria-hidden="true" />
              <span>{model}</span>
            </span>
          )}
          {typeof latencyMs === 'number' && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-[6px] bg-slate-900 border border-white/10">
              <Clock className="w-3 h-3 text-slate-400" aria-hidden="true" />
              <span>{latencyMs.toLocaleString()}ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Inconclusive Calm Guidance */}
      {isInconclusive && (
        <div className="p-3 rounded-[8px] bg-slate-800/50 border border-slate-700/60 text-xs text-slate-300 flex items-start gap-2 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="font-semibold text-slate-200">
              Not enough evidence to judge.
            </span>{' '}
            Here's what we could and couldn't tell: The message lacks sufficient distinct context or technical indicators. Treat any unexpected links or requests cautiously and verify through an independent channel.
          </div>
        </div>
      )}

      {/* Executive Summary */}
      <div className="pt-2 border-t border-white/10">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
          Executive Summary
        </h3>
        <p className="text-sm text-slate-200 leading-relaxed bg-[#0a0f1d]/60 p-3 rounded-[8px] border border-white/5 break-words [overflow-wrap:anywhere]">
          {summary}
        </p>
      </div>
    </article>
  );
}
