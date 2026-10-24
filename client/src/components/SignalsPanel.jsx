import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function SignalsPanel({ signals }) {
  const signalList = Array.isArray(signals) ? signals : [];

  return (
    <section
      className="rounded-[10px] border border-white/10 bg-[#111827] p-4 flex flex-col gap-3"
      aria-labelledby="signals-panel-heading"
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-[6px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
          <ShieldCheck className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h3
            id="signals-panel-heading"
            className="text-xs font-semibold text-slate-200 uppercase tracking-wider"
          >
            Reassuring or Neutral Signals
          </h3>
          <span className="text-[11px] text-slate-400">
            Factors that mitigate concern or reflect standard correspondence
          </span>
        </div>
      </div>

      {signalList.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-[#0a0f1d]/50 p-3 rounded-[8px] border border-white/5">
          No positive or neutral signals identified in the submitted text.
        </p>
      ) : (
        <ul className="space-y-2" aria-label="Reassuring signals list">
          {signalList.map((sig, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-xs text-slate-200 bg-[#0a0f1d]/50 p-2.5 rounded-[8px] border border-white/5"
            >
              <CheckCircle2
                className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span className="leading-relaxed">{sig}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
