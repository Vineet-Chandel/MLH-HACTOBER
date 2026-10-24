import React from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Cpu,
  Clock,
  ShieldCheck,
  Zap,
} from 'lucide-react';

const RISK_CONFIG = {
  high_concern: {
    label: 'High Concern',
    icon: AlertOctagon,
    badgeBg: 'bg-[#ff4d4d] text-white',
    iconBg: 'bg-[#ff4d4d] text-white',
    border: 'border-black',
    accentText: 'text-[#d62828]',
    description:
      'Strong indicators of phishing, credential harvesting, or social engineering detected.',
  },
  suspicious: {
    label: 'Suspicious',
    icon: AlertTriangle,
    badgeBg: 'bg-[#fbbf24] text-black',
    iconBg: 'bg-[#fbbf24] text-black',
    border: 'border-black',
    accentText: 'text-[#b45309]',
    description:
      'Anomalous or manipulative patterns identified that warrant cautious independent verification.',
  },
  low_concern: {
    label: 'Low Concern',
    icon: CheckCircle2,
    badgeBg: 'bg-[#8bfb34] text-black',
    iconBg: 'bg-[#8bfb34] text-black',
    border: 'border-black',
    accentText: 'text-[#15803d]',
    description:
      'No evident malicious lures found in the submitted content; standard routine patterns observed.',
  },
  inconclusive: {
    label: 'Inconclusive',
    icon: HelpCircle,
    badgeBg: 'bg-[#e2e8f0] text-black',
    iconBg: 'bg-[#e2e8f0] text-black',
    border: 'border-black',
    accentText: 'text-neutral-700',
    description:
      "Not enough evidence to judge. Here's what we could and couldn't tell.",
  },
};

export default function RiskBanner({ riskLevel, summary, model, latencyMs }) {
  const config = RISK_CONFIG[riskLevel] || RISK_CONFIG.inconclusive;
  const Icon = config.icon;
  const isInconclusive = riskLevel === 'inconclusive';

  return (
    <motion.article
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="bg-white border-2 border-black rounded-2xl p-5 sm:p-6 shadow-[6px_6px_0px_#000000] flex flex-col gap-4"
      aria-labelledby="risk-banner-title"
    >
      {/* Kicker & Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-neutral-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold text-neutral-500">
            SECURITY INTELLIGENCE REPORT
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-black inline-block" />
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-neutral-600">
            DEFENSIVE EVALUATION
          </span>
        </div>

        {/* Model & Latency Badges */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {model && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#faf8f3] text-black border-2 border-black shadow-[2px_2px_0px_#000000] font-bold">
              <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{model}</span>
            </span>
          )}
          {typeof latencyMs === 'number' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white text-neutral-700 border border-neutral-300 font-semibold">
              <Clock className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
              <span>{latencyMs.toLocaleString()}ms</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Threat Level Announcement */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <motion.div
            className={`p-3 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000000] flex items-center justify-center ${config.iconBg}`}
            whileHover={{ scale: 1.08, rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
          >
            <Icon className="w-6 h-6 stroke-[2.2]" />
          </motion.div>

          <div>
            <div className="text-[11px] uppercase tracking-wider font-extrabold text-neutral-500">
              Assessed Threat Level
            </div>
            <div
              id="risk-banner-title"
              className="text-xl sm:text-2xl font-black tracking-tight text-neutral-950 flex items-center gap-2.5 flex-wrap"
            >
              <span>{config.label}</span>
              <span
                className={`text-xs font-mono font-black uppercase px-2.5 py-0.5 rounded-md border-2 border-black shadow-[2px_2px_0px_#000000] ${config.badgeBg}`}
              >
                {riskLevel.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Description Note */}
      <p className="text-xs font-medium text-neutral-600">
        {config.description}
      </p>

      {/* Summary Box */}
      <div className="p-4 rounded-xl bg-[#faf8f3] border-2 border-black text-neutral-900 leading-relaxed font-medium text-sm shadow-[2px_2px_0px_#000000]">
        <div className="text-[10px] uppercase tracking-widest font-mono font-extrabold text-neutral-500 mb-1">
          ANALYSIS SUMMARY
        </div>
        <div>{summary}</div>
      </div>

      {/* Inconclusive Helper */}
      {isInconclusive && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p>
            The model could not identify conclusive phishing indicators or confirming proof of legitimacy. Always verify requests out-of-band via official, independently discovered communication channels.
          </p>
        </div>
      )}
    </motion.article>
  );
}
