import React from 'react';
import { motion } from 'motion/react';
import { Info, AlertCircle } from 'lucide-react';

export default function LimitationsPanel({ limitations }) {
  const limitList = Array.isArray(limitations) ? limitations : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.18 }}
      className="rounded-2xl border-2 border-black bg-white p-5 flex flex-col gap-3.5 shadow-[6px_6px_0px_#000000]"
      aria-labelledby="limitations-heading"
    >
      <div className="flex items-center gap-2.5 border-b-2 border-neutral-100 pb-3">
        <div className="p-2 rounded-xl bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000000] text-black">
          <Info className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </div>
        <h3
          id="limitations-heading"
          className="text-xs font-black uppercase tracking-wider text-neutral-900"
        >
          Investigation Scope &amp; Limitations
        </h3>
      </div>

      {/* Model-generated Limitations */}
      {limitList.length > 0 && (
        <ul className="space-y-2 pl-2 text-xs text-neutral-700 leading-relaxed font-medium">
          {limitList.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-1.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Fixed App Disclaimer */}
      <div className="p-3.5 rounded-xl bg-[#faf8f3] border-2 border-black text-xs text-neutral-800 flex items-start gap-3 leading-relaxed shadow-[2px_2px_0px_#000000]">
        <AlertCircle className="w-4 h-4 text-neutral-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong className="text-black font-extrabold">Disclaimer:</strong> LinkSleuth provides indicators, not proof. It cannot definitively guarantee that a message, sender, or website is completely safe. Always verify through authoritative out-of-band channels.
        </p>
      </div>
    </motion.section>
  );
}
