import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  Sparkles,
  Loader2,
  Lock,
  Clock,
  AlertCircle,
  FileSearch,
  Cpu,
  Layers,
} from 'lucide-react';
import NeoButton from './NeoButton.jsx';

export default function GenerationScreenLockModal({
  isOpen,
  elapsedSeconds,
  investigationMode = 'text',
  onCancel,
}) {
  // Prevent background scroll while screen is locked
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Context generation stages for live visual feedback
  const getStageText = () => {
    if (investigationMode === 'screenshot') {
      if (elapsedSeconds < 4) return 'Transcribing visual tokens and OCR text...';
      if (elapsedSeconds < 10) return 'Analyzing visual elements and spoofed interface lures...';
      if (elapsedSeconds < 18) return 'Extracting visible URLs and checking lookalike domains...';
      return 'Grounded evidence verification and threat calculation...';
    } else {
      if (elapsedSeconds < 3) return 'Parsing message structure and linguistic tokens...';
      if (elapsedSeconds < 8) return 'Detecting urgency lures, impersonation, and phishing patterns...';
      if (elapsedSeconds < 14) return 'Running deterministic rule checks against embedded links...';
      return 'Cross-verifying cited quotes and grounding evidence...';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="generation-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm select-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lock-modal-title"
        >
          <motion.div
            initial={{ scale: 0.9, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="bg-white border-3 border-black rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-[8px_8px_0px_#000000] flex flex-col items-center text-center gap-5 relative overflow-hidden"
          >
            {/* Top decorative stripe */}
            <div className="absolute top-0 inset-x-0 h-2 bg-[#8bfb34] border-b-2 border-black" />

            {/* Screen Lock Status Chip */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-mono font-black uppercase bg-[#faf8f3] text-black border-2 border-black shadow-[2px_2px_0px_#000]">
              <Lock className="w-3.5 h-3.5 text-black" aria-hidden="true" />
              <span>SCREEN LOCKED &bull; GENERATING CONTEXT</span>
            </div>

            {/* Animated Neo Badge with Lucide Shield & Sparkles */}
            <div className="relative my-1">
              <motion.div
                className="p-5 rounded-2xl bg-[#8bfb34] border-2 border-black shadow-[4px_4px_0px_#000000] flex items-center justify-center text-black relative"
                animate={{
                  rotate: [0, -2, 2, 0],
                  scale: [1, 1.03, 1],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <ShieldCheck className="w-10 h-10 stroke-[2.2]" aria-hidden="true" />

                <motion.div
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-md bg-white border border-black shadow-[1px_1px_0px_#000]"
                  animate={{
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-black fill-black" />
                </motion.div>
              </motion.div>

              {/* Pulsing ring */}
              <motion.div
                className="absolute -inset-2 rounded-2xl border-2 border-black/30 pointer-events-none"
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
              />
            </div>

            {/* Modal Heading & Stage */}
            <div className="space-y-2">
              <h3 id="lock-modal-title" className="text-lg sm:text-xl font-black text-neutral-900 tracking-tight">
                Defensive Security Analysis
              </h3>
              <p className="text-xs font-semibold text-neutral-700 min-h-[36px] flex items-center justify-center px-2">
                {getStageText()}
              </p>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-[#faf8f3] border-2 border-black rounded-xl p-1 shadow-[2px_2px_0px_#000] overflow-hidden">
              <motion.div
                className="h-3 rounded-lg bg-[#8bfb34] border border-black/40"
                animate={{
                  width: ['15%', '60%', '85%', '95%'],
                }}
                transition={{
                  duration: 20,
                  ease: 'easeOut',
                }}
              />
            </div>

            {/* Timer & AI Model Info */}
            <div className="flex items-center justify-between w-full pt-1 px-1 text-xs font-mono font-bold text-neutral-600">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#faf8f3] border border-black/30">
                <Clock className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span>Elapsed: {elapsedSeconds}s</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#faf8f3] border border-black/30">
                <Cpu className="w-3.5 h-3.5 text-neutral-500" aria-hidden="true" />
                <span>Gemma 4 AI</span>
              </span>
            </div>

            {/* Cancel Action Button */}
            {onCancel && (
              <div className="pt-2 w-full flex justify-center">
                <NeoButton
                  variant="danger"
                  size="sm"
                  onClick={onCancel}
                  className="w-full sm:w-auto"
                >
                  Cancel Analysis
                </NeoButton>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
