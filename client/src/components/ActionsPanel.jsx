import React from 'react';
import { motion } from 'motion/react';
import { ListOrdered, AlertTriangle, Shield, CheckSquare, ArrowRight } from 'lucide-react';

export default function ActionsPanel({ recommendedActions }) {
  const actions = Array.isArray(recommendedActions) ? recommendedActions : [];

  const postClickKeywords = [
    'already clicked',
    'if you clicked',
    'entered credentials',
    'submitted credentials',
    'shared information',
    'compromised',
    'change your password',
    'reset your password',
    'contact fraud',
  ];

  const postClickActions = actions.filter((act) =>
    postClickKeywords.some((kw) => act.toLowerCase().includes(kw))
  );

  const standardActions = actions.filter((act) => !postClickActions.includes(act));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.15 }}
      className="rounded-2xl border-2 border-black bg-white p-5 flex flex-col gap-4 shadow-[6px_6px_0px_#000000]"
      aria-labelledby="actions-panel-heading"
    >
      <div className="flex items-center gap-2.5 border-b-2 border-neutral-100 pb-3">
        <div className="p-2 rounded-xl bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000000]">
          <ListOrdered className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
        </div>
        <div>
          <h3
            id="actions-panel-heading"
            className="text-xs font-black uppercase tracking-wider text-neutral-900"
          >
            Recommended Next Steps
          </h3>
          <span className="text-[11px] font-medium text-neutral-500">
            Defensive action plan based on identified indicators
          </span>
        </div>
      </div>

      {/* Post-click emergency callout */}
      {postClickActions.length > 0 && (
        <div
          className="rounded-xl border-2 border-black bg-[#fee2e2] p-4 flex flex-col gap-2.5 shadow-[3px_3px_0px_#000000]"
          role="region"
          aria-label="Remediation actions if you already interacted"
        >
          <div className="flex items-center gap-2 text-[#991b1b] text-xs font-black uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-[#ef4444] flex-shrink-0" aria-hidden="true" />
            <span>If you already clicked links or shared information</span>
          </div>
          <ul className="space-y-2 pl-2 text-xs text-neutral-900 font-semibold leading-relaxed">
            {postClickActions.map((action, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#991b1b] mt-1.5 shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Numbered checklist for standard actions */}
      {standardActions.length === 0 && postClickActions.length === 0 ? (
        <p className="text-xs text-neutral-500 italic bg-[#faf8f3] p-3.5 rounded-xl border border-neutral-300">
          No specific remedial actions recommended for this submission.
        </p>
      ) : (
        <ol className="space-y-2.5" aria-label="Action steps list">
          {standardActions.map((action, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-xs text-neutral-800 bg-[#faf8f3] p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000000] font-medium leading-relaxed"
            >
              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[#8bfb34] text-black border border-black shadow-[1px_1px_0px_#000000] shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="self-center">{action}</span>
            </li>
          ))}
        </ol>
      )}
    </motion.section>
  );
}
