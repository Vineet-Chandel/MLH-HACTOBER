import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Search,
  X,
  Check,
  ChevronDown,
  Layers,
  ArrowRight,
  ShieldAlert,
  Globe,
  FileText,
  Mail,
  MessageSquare,
  PhoneCall,
  Image as ImageIcon,
  Link as LinkIcon,
  FlaskConical,
  Maximize2,
  Minimize2,
  PenTool,
  RotateCcw,
} from 'lucide-react';
import NeoButton from './NeoButton.jsx';

/**
 * NeoDropdownModal - Custom Neo-Brutalist Animated Scenario Dropdown & Modal.
 * Renders directly over the page as a sleek animated popover menu, with optional
 * toggle to fullscreen modal dialog.
 */
export default function NeoDropdownModal({
  id = 'sample-dropdown-modal',
  title = 'Synthetic Security Scenarios',
  subtitle = 'Choose a curated scenario to evaluate defensive AI detection and URL checks',
  triggerLabel = 'Load synthetic sample...',
  selectedScenario = null,
  badgeText,
  icon: TriggerIcon = FlaskConical,
  samples = [],
  onSelect,
  onClear,
  type = 'text', // 'text' | 'image'
  className = '',
  disabled = false,
  defaultMode = 'dropdown', // 'dropdown' (renders over page) | 'modal'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState(defaultMode); // 'dropdown' | 'modal'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside in dropdown mode
  useEffect(() => {
    if (!isOpen || displayMode === 'modal') return;

    const handleClickOutside = (e) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        (!menuRef.current || !menuRef.current.contains(e.target))
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, displayMode]);

  // Lock body scroll ONLY when in modal mode
  useEffect(() => {
    if (isOpen && displayMode === 'modal') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, displayMode]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Determine categories dynamically
  const categories = useMemo(() => {
    if (type === 'image') {
      return [
        { id: 'all', label: 'All Images' },
        { id: 'sms', label: 'SMS & Texts' },
        { id: 'email', label: 'Delivery / Email' },
        { id: 'other', label: 'Documents & Other' },
      ];
    }

    const counts = {
      all: samples.length,
      sms: 0,
      email: 0,
      india: 0,
      call: 0,
    };

    samples.forEach((s) => {
      if (s.message_type === 'sms') counts.sms++;
      if (s.message_type === 'email') counts.email++;
      if (s.message_type === 'call') counts.call++;
      if (s.id && s.id.startsWith('india-')) counts.india++;
    });

    const list = [{ id: 'all', label: `All (${counts.all})` }];
    if (counts.sms > 0) list.push({ id: 'sms', label: `SMS (${counts.sms})` });
    if (counts.email > 0) list.push({ id: 'email', label: `Email (${counts.email})` });
    if (counts.india > 0) list.push({ id: 'india', label: `India Scams (${counts.india})` });
    if (counts.call > 0) list.push({ id: 'call', label: `Call Notes (${counts.call})` });

    return list;
  }, [samples, type]);

  // Filter samples based on search and category
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      // Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'india') {
          if (!s.id || !s.id.startsWith('india-')) return false;
        } else if (s.message_type !== selectedCategory) {
          return false;
        }
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchLabel = s.label?.toLowerCase().includes(q);
      const matchMsg = s.message?.toLowerCase().includes(q);
      const matchNote = s.context_note?.toLowerCase().includes(q);
      const matchUrl = s.url?.toLowerCase().includes(q);
      const matchType = s.message_type?.toLowerCase().includes(q);
      const matchLang = s.language?.toLowerCase().includes(q);

      return matchLabel || matchMsg || matchNote || matchUrl || matchType || matchLang;
    });
  }, [samples, selectedCategory, searchQuery]);

  const handleSelectSample = (sample) => {
    if (onSelect) {
      onSelect(sample, true);
    }
    setIsOpen(false);
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const handleClearSelection = (e) => {
    e?.stopPropagation();
    if (onClear) {
      onClear();
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const getTypeIcon = (msgType) => {
    switch (msgType) {
      case 'sms':
        return MessageSquare;
      case 'email':
        return Mail;
      case 'call':
        return PhoneCall;
      default:
        return FileText;
    }
  };

  const getLanguageLabel = (lang) => {
    if (!lang || lang === 'en') return 'English';
    if (lang === 'hi') return 'हिन्दी (Hindi)';
    if (lang === 'hinglish') return 'Hinglish';
    return lang.toUpperCase();
  };

  const totalCount = samples.length;
  const displayBadge = badgeText || `${totalCount} ${type === 'image' ? 'Images' : 'Scenarios'}`;

  // Content of the menu/modal
  const renderDropdownContent = () => (
    <div className="flex flex-col h-full overflow-hidden text-neutral-900">
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b-2 border-black bg-white flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-[#8bfb34] text-black border-2 border-black shadow-[2px_2px_0px_#000000] flex-shrink-0">
            <TriggerIcon className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                id={`${id}-modal-title`}
                className="text-xs sm:text-sm font-black uppercase tracking-wider text-neutral-900 truncate"
              >
                {title}
              </h2>
              <span className="hidden sm:inline-block px-1.5 py-0.2 rounded text-[10px] font-mono font-black bg-black text-white flex-shrink-0">
                {displayBadge}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 font-medium truncate mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Toggle between Dropdown Over Page and Center Modal */}
          <button
            type="button"
            onClick={() => setDisplayMode((prev) => (prev === 'dropdown' ? 'modal' : 'dropdown'))}
            title={displayMode === 'dropdown' ? 'Expand to fullscreen modal' : 'Switch to dropdown over page'}
            className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
            aria-label={displayMode === 'dropdown' ? 'Expand to modal' : 'Collapse to dropdown'}
          >
            {displayMode === 'dropdown' ? (
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.5]" />
            ) : (
              <Minimize2 className="w-3.5 h-3.5 stroke-[2.5]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Search and Category Filters Bar */}
      <div className="p-3 border-b-2 border-black bg-[#faf8f3] flex flex-col gap-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scenarios by keyword (bank, KYC, OTP, customs)..."
            className="w-full pl-8 pr-7 py-1.5 bg-white border-2 border-black rounded-lg text-xs font-bold text-neutral-900 placeholder:text-neutral-400 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black shadow-[2px_2px_0px_#000]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-500 hover:text-black cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-0.5">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border-2 border-black transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-[#8bfb34] text-black shadow-[1.5px_1.5px_0px_#000]'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrollable Scenario Cards List */}
      <div className="p-3 sm:p-4 overflow-y-auto flex-1 flex flex-col gap-2.5 min-h-[200px] max-h-[58vh]">
        {/* Option 0: Blank / Custom Scenario Reset */}
        <motion.div
          whileHover={{ y: -1 }}
          onClick={handleClearSelection}
          className="p-3 rounded-xl border-2 border-dashed border-black bg-white hover:bg-[#8bfb34]/15 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000]"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#faf8f3] border border-black text-neutral-800">
              <PenTool className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xs font-black text-neutral-900 block">
                ✍ Custom Scenario / Blank Form
              </span>
              <span className="text-[10px] text-neutral-500 font-medium">
                Clear all fields and paste your own custom untrusted content
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-neutral-600 px-2 py-1 rounded bg-neutral-100 border border-black/30">
            Clear Form
          </span>
        </motion.div>

        {filteredSamples.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-center p-4">
            <div className="p-2.5 rounded-full bg-neutral-200 border-2 border-black mb-2">
              <Search className="w-5 h-5 text-neutral-600" />
            </div>
            <p className="text-xs font-bold text-neutral-800">
              No scenarios match &quot;{searchQuery}&quot;
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="mt-2.5 px-2.5 py-1 rounded-lg border-2 border-black bg-white hover:bg-[#8bfb34] text-[11px] font-bold shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredSamples.map((sample, idx) => {
            const MsgIcon = getTypeIcon(sample.message_type);
            const isCurrentlySelected = selectedScenario?.id === sample.id;

            return (
              <motion.div
                key={sample.id || idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.12, delay: Math.min(idx * 0.02, 0.2) }}
                whileHover={{ y: -1 }}
                onClick={() => handleSelectSample(sample)}
                className={`group p-3 rounded-xl border-2 border-black transition-all cursor-pointer flex flex-col gap-2 relative ${
                  isCurrentlySelected
                    ? 'bg-[#8bfb34]/25 shadow-[4px_4px_0px_#000] border-black ring-1 ring-black'
                    : 'bg-white hover:bg-[#faf8f3] shadow-[2.5px_2.5px_0px_#000] hover:shadow-[4px_4px_0px_#000]'
                }`}
              >
                {/* Card Top Meta Badges */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sample.message_type && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-[#faf8f3] text-black border border-black">
                        <MsgIcon className="w-2.5 h-2.5 stroke-[2.2]" />
                        <span>{sample.message_type}</span>
                      </span>
                    )}

                    {sample.language && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white text-neutral-800 border border-black/40">
                        <Globe className="w-2.5 h-2.5" />
                        <span>{getLanguageLabel(sample.language)}</span>
                      </span>
                    )}

                    {sample.url && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#fee2e2] text-red-800 border border-red-300">
                        <LinkIcon className="w-2.5 h-2.5" />
                        <span>Link</span>
                      </span>
                    )}

                    {isCurrentlySelected && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-[#8bfb34] text-black border border-black flex items-center gap-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-bold text-neutral-500 group-hover:text-black flex items-center gap-1 transition-colors">
                    <span>Load &amp; Analyze</span>
                    <ArrowRight className="w-3 h-3 stroke-[2.5]" />
                  </span>
                </div>

                {/* Title & Preview */}
                <div>
                  <h3 className="text-xs font-black text-neutral-900 group-hover:underline leading-snug">
                    {sample.label}
                  </h3>

                  {type === 'image' && sample.url && (
                    <div className="mt-1.5 flex items-center gap-2.5 bg-[#faf8f3] p-1.5 rounded-lg border border-black/20">
                      <img
                        src={sample.url}
                        alt={sample.label}
                        className="w-12 h-12 object-cover rounded border border-black shadow-[1px_1px_0px_#000]"
                        loading="lazy"
                      />
                      <div className="text-[11px] text-neutral-600 font-medium">
                        <p className="font-bold text-black">{sample.filename}</p>
                        <p className="text-[10px] text-neutral-500">
                          {sample.context_note || 'Pre-rendered security sample'}
                        </p>
                      </div>
                    </div>
                  )}

                  {sample.message && (
                    <blockquote className="mt-1 text-[11px] text-neutral-700 bg-[#faf8f3] p-2 rounded-lg border border-neutral-300 font-sans leading-relaxed line-clamp-2 italic">
                      &ldquo;{sample.message}&rdquo;
                    </blockquote>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 sm:p-3 border-t-2 border-black bg-white flex items-center justify-between text-[11px] font-bold text-neutral-600">
        <span>
          Showing {filteredSamples.length} of {totalCount} scenarios
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="px-2.5 py-1 rounded-md border-2 border-black bg-[#faf8f3] hover:bg-neutral-200 text-black text-[11px] font-bold shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tactile Select Trigger Button */}
      <motion.button
        ref={triggerRef}
        id={id}
        type="button"
        role="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`${selectedScenario ? selectedScenario.label : triggerLabel}. ${displayBadge} available.`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={`w-full text-xs border-2 border-black rounded-lg px-2.5 py-1.5 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer transition-all flex items-center justify-between gap-2 select-none ${
          selectedScenario
            ? 'bg-[#8bfb34] text-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
            : 'bg-[#faf8f3] hover:bg-white text-neutral-900 shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000]'
        }`}
      >
        <span className="flex items-center gap-1.5 truncate min-w-0">
          <TriggerIcon className="w-3.5 h-3.5 text-black flex-shrink-0 stroke-[2.2]" aria-hidden="true" />
          <span className="truncate">
            {selectedScenario ? selectedScenario.label : triggerLabel}
          </span>
        </span>

        <span className="flex items-center gap-1.5 flex-shrink-0">
          {selectedScenario ? (
            <span
              onClick={handleClearSelection}
              title="Reset to custom scenario"
              className="p-0.5 rounded hover:bg-black/10 text-black cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 stroke-[2.5]" />
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-[#8bfb34] text-black border border-black/40">
              {displayBadge}
            </span>
          )}
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-neutral-700"
            aria-hidden="true"
          >
            <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
          </motion.span>
        </span>
      </motion.button>

      {/* RENDER MODE 1: Floating Dropdown Menu (Over the Page) */}
      <AnimatePresence>
        {isOpen && displayMode === 'dropdown' && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className="absolute right-0 top-full mt-2 z-50 w-[92vw] sm:w-[480px] max-w-[480px] bg-[#faf8f3] border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000000] overflow-hidden flex flex-col max-h-[75vh]"
          >
            {renderDropdownContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENDER MODE 2: Centered Modal Dialog (When toggled to Modal) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && displayMode === 'modal' && (
              <motion.div
                key="sample-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
                role="presentation"
              >
                <motion.div
                  key="sample-modal-window"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={`${id}-modal-title`}
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 16 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl bg-[#faf8f3] border-2 border-black rounded-2xl shadow-[8px_8px_0px_#000000] overflow-hidden flex flex-col max-h-[88vh] text-neutral-900"
                >
                  {renderDropdownContent()}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
