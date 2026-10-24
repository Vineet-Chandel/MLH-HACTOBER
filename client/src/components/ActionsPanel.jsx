import React from 'react';
import { ListOrdered, AlertTriangle, Shield, CheckSquare } from 'lucide-react';

export default function ActionsPanel({ recommendedActions }) {
  const actions = Array.isArray(recommendedActions) ? recommendedActions : [];

  // Check if any action mentions post-click / compromise remediation
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
    <section
      className="rounded-[10px] border border-white/10 bg-[#111827] p-4 flex flex-col gap-3.5"
      aria-labelledby="actions-panel-heading"
    >
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-[6px] bg-teal-950/60 border border-teal-500/30 text-teal-400">
          <ListOrdered className="w-4 h-4" aria-hidden="true" />
        </div>
        <div>
          <h3
            id="actions-panel-heading"
            className="text-xs font-semibold text-slate-200 uppercase tracking-wider"
          >
            Recommended Next Steps
          </h3>
          <span className="text-[11px] text-slate-400">
            Defensive action plan based on identified indicators
          </span>
        </div>
      </div>

      {/* Conditional Callout: ONLY if model mentioned post-click or credential compromise */}
      {postClickActions.length > 0 && (
        <div
          className="rounded-[8px] border border-rose-500/30 bg-rose-950/30 p-3 flex flex-col gap-2"
          role="region"
          aria-label="Remediation actions if you already interacted"
        >
          <div className="flex items-center gap-2 text-rose-300 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" aria-hidden="true" />
            <span>If you already clicked or shared information</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-xs text-rose-200/90 leading-relaxed">
            {postClickActions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Numbered Checklist */}
      {standardActions.length === 0 && postClickActions.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-[#0a0f1d]/50 p-3 rounded-[8px] border border-white/5">
          No specific remedial actions recommended for this submission.
        </p>
      ) : (
        <ol className="space-y-2" aria-label="Action steps checklist">
          {standardActions.map((act, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3 text-xs text-slate-200 bg-[#0a0f1d]/50 p-2.5 rounded-[8px] border border-white/5"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-mono text-[11px] font-bold text-teal-400">
                {idx + 1}
              </span>
              <span className="leading-relaxed mt-0.5">{act}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Static 2-line Safety Reminder Footer */}
      <footer className="pt-2 border-t border-white/10 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
        <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          <strong>General safety reminder (not model output):</strong> Verify via an independently obtained official channel; never enter OTPs or passwords after following a message link.
        </p>
      </footer>
    </section>
  );
}
