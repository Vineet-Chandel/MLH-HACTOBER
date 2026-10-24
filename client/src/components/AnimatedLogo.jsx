import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Sparkles, Terminal, Shield, Zap, Search } from 'lucide-react';

export default function AnimatedLogo({ size = 'md' }) {
  const isLarge = size === 'lg';

  return (
    <motion.div
      className="relative flex items-center gap-3.5 select-none"
      initial="idle"
      whileHover="hover"
    >
      {/* Neo-brutalist Animated Badge Icon */}
      <motion.div
        className="relative flex items-center justify-center bg-[#8bfb34] border-2 border-black rounded-xl p-2.5 sm:p-3 shadow-[3px_3px_0px_#000000] cursor-pointer"
        whileHover={{
          scale: 1.05,
          rotate: [0, -3, 3, 0],
          boxShadow: '5px 5px 0px #000000',
          transition: { duration: 0.35, ease: 'easeInOut' },
        }}
        whileTap={{
          scale: 0.95,
          boxShadow: '1px 1px 0px #000000',
          x: 2,
          y: 2,
        }}
      >
        {/* Subtle rotating glow / aura */}
        <motion.div
          className="absolute -inset-1 rounded-xl bg-[#8bfb34]/40 blur-sm -z-10"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Central Shield Icon from Lucide with Animated Spring */}
        <motion.div
          variants={{
            idle: { scale: 1, rotate: 0 },
            hover: { scale: 1.12, rotate: 5 },
          }}
          transition={{ type: 'spring', stiffness: 350, damping: 15 }}
          className="relative"
        >
          <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-black stroke-[2.2]" />

          {/* Sparkle badge pinned on the shield */}
          <motion.div
            className="absolute -top-1 -right-1"
            animate={{
              rotate: [0, 180, 360],
              scale: [0.8, 1.15, 0.8],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Sparkles className="w-3 h-3 text-black fill-black" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Brand Typography & Tagline */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 flex-wrap">
          <motion.span
            className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900"
            variants={{
              idle: { x: 0 },
              hover: { x: 2 },
            }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            LinkSleuth
          </motion.span>

          {/* Pill Badge inspired by Image 2 (LIVE) & Image 3 */}
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000000]">
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-[#8bfb34] border border-black inline-block"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [1, 0.6, 1],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            GEMMA 4 AI
          </span>
        </div>

        <p className="text-xs font-semibold text-neutral-600 tracking-tight">
          Defensive Phishing &amp; Social Engineering Intelligence
        </p>
      </div>
    </motion.div>
  );
}
