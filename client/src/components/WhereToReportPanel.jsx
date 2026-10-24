import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  PhoneCall,
  Globe,
  Building2,
  Shield,
  ExternalLink,
  AlertTriangle,
  Info,
} from 'lucide-react';
import NeoButton from './NeoButton.jsx';

export default function WhereToReportPanel({
  staticGuidance,
  userState,
  isHindi = false,
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!staticGuidance) return null;

  const { resources = [], user_state_guidance: userStateGuidance } = staticGuidance;
  const isHighRiskOrActed = userState && userState !== 'none';

  const getResourceIcon = (type) => {
    switch (type) {
      case 'phone':
        return <PhoneCall className="w-4 h-4 text-black shrink-0 mt-0.5" aria-hidden="true" />;
      case 'website':
        return <Globe className="w-4 h-4 text-black shrink-0 mt-0.5" aria-hidden="true" />;
      case 'advice':
        return <Building2 className="w-4 h-4 text-black shrink-0 mt-0.5" aria-hidden="true" />;
      default:
        return <Shield className="w-4 h-4 text-black shrink-0 mt-0.5" aria-hidden="true" />;
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25, delay: 0.2 }}
      aria-label={isHindi ? 'रिपोर्टिंग संसाधन (स्थिर जानकारी)' : 'Reporting Resources (Static Guidance)'}
      className="bg-white rounded-2xl border-2 border-black p-5 flex flex-col gap-4 shadow-[6px_6px_0px_#000000]"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-neutral-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#8bfb34] border-2 border-black shadow-[2px_2px_0px_#000000] text-black">
            <ShieldAlert className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-black text-neutral-900 tracking-tight">
                {isHindi ? 'कहां रिपोर्ट करें (भारत)' : 'Where to Report (Official Portals)'}
              </h3>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#faf8f3] text-black border-2 border-black font-bold shadow-[1px_1px_0px_#000]">
                {isHindi ? 'एआई-जनरेटेड नहीं' : 'Not AI-generated'}
              </span>
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              {isHindi
                ? 'नियत जानकारी। विवरण आधिकारिक पोर्टल पर सत्यापित करें।'
                : 'Fixed guidance. Always verify details on the official government or banking portal.'}
            </p>
          </div>
        </div>

        {/* Toggle Collapse Button */}
        {!isHighRiskOrActed && (
          <NeoButton
            size="sm"
            variant="secondary"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? (isHindi ? 'छुपाएं' : 'Collapse') : (isHindi ? 'देखें' : 'View resources')}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
            )}
          </NeoButton>
        )}
      </div>

      {/* Main Panel Content */}
      <AnimatePresence>
        {(isExpanded || isHighRiskOrActed) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col gap-4 overflow-hidden"
          >
            {/* Urgent Action Guidance Block */}
            {userStateGuidance && (
              <div
                className={`p-4 rounded-xl border-2 border-black text-xs flex flex-col gap-2.5 shadow-[3px_3px_0px_#000000] ${
                  userState === 'paid_money'
                    ? 'bg-[#fee2e2] text-[#991b1b]'
                    : userState === 'shared_info'
                    ? 'bg-[#fef3c7] text-[#92400e]'
                    : 'bg-[#e0f2fe] text-[#075985]'
                }`}
                role="alert"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-black" aria-hidden="true" />
                  <span className="font-black text-sm text-black">
                    {isHindi ? userStateGuidance.heading_hi : userStateGuidance.heading_en}
                  </span>
                  <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded bg-white text-black border border-black uppercase font-bold">
                    {isHindi ? 'स्थिर मार्गदर्शन' : 'Emergency Action'}
                  </span>
                </div>

                <ol className="list-decimal list-inside space-y-1.5 pl-1 leading-relaxed font-semibold text-neutral-900">
                  {(isHindi ? userStateGuidance.steps_hi : userStateGuidance.steps_en).map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Official Resources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {resources.map((res) => {
                const resName = isHindi ? res.name_hi || res.name_en : res.name_en;
                const resUseFor = isHindi ? res.use_for_hi || res.use_for_en : res.use_for_en;

                return (
                  <div
                    key={res.id}
                    className="p-3.5 rounded-xl bg-[#faf8f3] border-2 border-black flex flex-col justify-between gap-3 shadow-[3px_3px_0px_#000000]"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 rounded-lg bg-white border border-black shadow-[1px_1px_0px_#000]">
                        {getResourceIcon(res.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-black text-neutral-900">
                            {resName}
                          </span>
                          {res.needs_verification && (
                            <span
                              title="Verification pending"
                              className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-400 font-bold"
                            >
                              unverified
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-600 mt-1 leading-relaxed font-medium">
                          {resUseFor}
                        </p>
                      </div>
                    </div>

                    {/* Contact Action */}
                    <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs">
                      {res.type === 'phone' && res.number && (
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500 font-mono text-[11px] font-bold">Dial:</span>
                          <a
                            href={`tel:${res.number}`}
                            className="font-mono font-black text-black px-2.5 py-0.5 rounded-md bg-[#8bfb34] border-2 border-black shadow-[1px_1px_0px_#000] hover:bg-[#7ce62c]"
                          >
                            {res.number}
                          </a>
                          <span className="text-[11px] text-neutral-500 font-medium">(24x7)</span>
                        </div>
                      )}

                      {res.type === 'website' && res.url && (
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] text-neutral-500 font-medium">Official Portal:</span>
                          <a
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-black px-2 py-0.5 rounded-md bg-white border-2 border-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100"
                          >
                            <span>{res.url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="w-3 h-3 ml-0.5" aria-hidden="true" />
                          </a>
                        </div>
                      )}

                      {res.type === 'advice' && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-600 font-medium italic">
                          <Info className="w-3.5 h-3.5 text-neutral-500 shrink-0" aria-hidden="true" />
                          <span>
                            {isHindi ? 'स्वतंत्र रूप से सत्यापित करें' : 'Verify independently'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Disclaimer */}
            <div className="text-xs text-neutral-600 italic bg-[#faf8f3] p-3 rounded-xl border border-neutral-300 flex items-center gap-2 font-medium">
              <Info className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden="true" />
              <span>
                {isHindi
                  ? 'लिंकस्लूथ संकेत प्रदान करता है, कोई कानूनी प्रमाण नहीं। वास्तविक प्राधिकारी कभी भी निजी मैसेज में भेजे गए नंबरों से संपर्क करने का निर्देश नहीं देते।'
                  : 'LinkSleuth provides indicators, not proof. Official authorities will never contact you from personal messaging handles or demand video arrests.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
