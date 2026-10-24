import React from 'react';
import { Info, AlertCircle } from 'lucide-react';

export default function LimitationsPanel({ limitations }) {
  const limitList = Array.isArray(limitations) ? limitations : [];

  return (
    <section
      className="rounded-[10px] border border-white/10 bg-[#111827] p-4 flex flex-col gap-3"
      aria-labelledby="limitations-heading"
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-[6px] bg-slate-800 border border-white/10 text-slate-300">
          <Info className="w-4 h-4" aria-hidden="true" />
        </div>
        <h3
          id="limitations-heading"
          className="text-xs font-semibold text-slate-200 uppercase tracking-wider"
        >
          Investigation Scope &amp; Limitations
        </h3>
      </div>

      {/* Model-generated Limitations */}
      {limitList.length > 0 && (
        <ul className="space-y-1.5 pl-5 list-disc text-xs text-slate-400 leading-relaxed">
          {limitList.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      )}

      {/* Fixed App Disclaimer (Always permanently visible) */}
      <div className="p-2.5 rounded-[8px] bg-[#0a0f1d]/70 border border-white/5 text-[11px] text-slate-400 flex items-start gap-2 leading-relaxed">
        <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong className="text-slate-300">Disclaimer:</strong> LinkSleuth provides indicators, not proof. It cannot confirm that a message, sender, or website is safe.
        </p>
      </div>
    </section>
  );
}
