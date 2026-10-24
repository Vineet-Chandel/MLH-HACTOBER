import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function SignalsPanel({ signals }) {
  const signalList = Array.isArray(signals) ? signals : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.12 }}
      className="rounded-2xl border-2 border-black bg-white p-5 flex flex-col gap-3.5 shadow-[6px_6px_0px_#000000]"
      aria-labelledby="signals-panel-heading"
    >
      <div className="flex items-center gap-2.5 border-b-2 border-neutral-100 pb-3">
        <div className="p-2 rounded-xl bg-[#8bfb34] border-2 border-black shadow-[2px_2px_0px_#000000] text-black">
          <ShieldCheck className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </div>
        <div>
          <h3
            id="signals-panel-heading"
            className="text-xs font-black uppercase tracking-wider text-neutral-900"
          >
            Reassuring or Neutral Signals
          </h3>
          <span className="text-[11px] font-medium text-neutral-500">
            Factors that mitigate concern or reflect standard correspondence
          </span>
        </div>
      </div>

      {signalList.length === 0 ? (
        <p className="text-xs text-neutral-500 italic bg-[#faf8f3] p-3.5 rounded-xl border border-neutral-300">
          No positive or neutral signals identified in the submitted content.
        </p>
      ) : (
        <ul className="space-y-2.5" aria-label="Reassuring signals list">
          {signalList.map((sig, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-xs text-neutral-800 bg-[#faf8f3] p-3 rounded-xl border border-neutral-300 font-medium leading-relaxed"
            >
              <CheckCircle2
                className="w-4 h-4 text-[#15803d] flex-shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{sig}</span>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
