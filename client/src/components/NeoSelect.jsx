import React, { useState, useRef, useEffect, useId, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * NeoSelect - Custom Neo-Brutalist Animated Dropdown / Select Component.
 * Replaces native OS system <select> with a tactile, accessible, animated menu.
 */
export default function NeoSelect({
  id: customId,
  name,
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option...',
  icon: Icon,
  disabled = false,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  ariaLabel,
  size = 'md', // 'sm' | 'md'
  align = 'left', // 'left' | 'right' | 'full'
}) {
  const generatedId = useId();
  const id = customId || `neo-select-${generatedId}`;
  const listboxId = `${id}-listbox`;

  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [openUpwards, setOpenUpwards] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const listboxRef = useRef(null);

  // Auto-flip upward if viewport space below is insufficient
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > spaceBelow) {
        setOpenUpwards(true);
      } else {
        setOpenUpwards(false);
      }
    }
  }, [isOpen]);

  // Normalize options to object format: { value, label, badge, description, icon }
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => String(opt.value) === String(value));
  }, [normalizedOptions, value]);

  // Handle outside click to close dropdown (light dismiss)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleWindowBlur = () => setIsOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isOpen]);

  // Sync focused index with selected option when opening
  useEffect(() => {
    if (isOpen) {
      const idx = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, normalizedOptions, value]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          if (focusedIndex >= 0 && focusedIndex < normalizedOptions.length) {
            handleSelect(normalizedOptions[focusedIndex].value);
          }
        } else {
          setIsOpen(true);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev + 1) % normalizedOptions.length);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex((prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length);
        }
        break;

      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          setIsOpen(false);
          triggerRef.current?.focus();
        }
        break;

      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;

      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setFocusedIndex(0);
        }
        break;

      case 'End':
        if (isOpen) {
          e.preventDefault();
          setFocusedIndex(normalizedOptions.length - 1);
        }
        break;

      default:
        break;
    }
  };

  const handleSelect = (optValue) => {
    if (onChange) {
      onChange(optValue);
    }
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg',
    md: 'text-xs font-bold px-3.5 py-2 rounded-xl',
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`}>
      {label && (
        <label
          id={`${id}-label`}
          htmlFor={id}
          className="block text-xs font-black uppercase tracking-wider text-neutral-700 mb-1"
        >
          {label}
        </label>
      )}

      {/* Hidden native input for standard form submission / serialized formData */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      {/* Tactile Trigger Button */}
      <motion.button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-labelledby={label ? `${id}-label ${id}` : undefined}
        aria-label={ariaLabel || (!label ? placeholder : undefined)}
        disabled={disabled}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        whileTap={{ scale: disabled ? 1 : 0.98 }}
        className={`w-full bg-white border-2 border-black text-neutral-900 shadow-[2px_2px_0px_#000000] hover:shadow-[3px_3px_0px_#000000] transition-shadow cursor-pointer select-none flex items-center justify-between gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size] || sizeClasses.md} ${triggerClassName}`}
      >
        <span className="flex items-center gap-2 truncate min-w-0">
          {Icon && (
            <Icon className="w-3.5 h-3.5 text-neutral-700 flex-shrink-0" aria-hidden="true" />
          )}
          {selectedOption?.icon && React.createElement(selectedOption.icon, {
            className: "w-3.5 h-3.5 text-neutral-700 flex-shrink-0",
            "aria-hidden": "true",
          })}
          <span className="truncate">
            {selectedOption ? selectedOption.label : <span className="text-neutral-400 font-normal">{placeholder}</span>}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase bg-[#8bfb34] text-black border border-black/40 flex-shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </span>

        {/* Animated Chevron Indicator */}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-shrink-0 text-neutral-700"
          aria-hidden="true"
        >
          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
        </motion.span>
      </motion.button>

      {/* Animated Floating Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-activedescendant={focusedIndex >= 0 ? `${id}-opt-${focusedIndex}` : undefined}
            initial={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpwards ? 6 : -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            className={`absolute z-50 w-full min-w-[220px] bg-[#faf8f3] border-2 border-black rounded-xl shadow-[5px_5px_0px_#000000] p-1.5 overflow-hidden max-h-72 overflow-y-auto focus:outline-none ${
              openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } ${
              align === 'right' ? 'right-0' : 'left-0'
            } ${menuClassName}`}
          >
            {normalizedOptions.length === 0 ? (
              <div className="p-3 text-xs text-neutral-500 italic text-center font-medium">
                No options available
              </div>
            ) : (
              <ul className="flex flex-col gap-1 p-0 m-0 list-none" role="presentation">
                {normalizedOptions.map((opt, index) => {
                  const isSelected = String(opt.value) === String(value);
                  const isFocused = focusedIndex === index;

                  return (
                    <li
                      key={opt.value ?? index}
                      id={`${id}-opt-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(opt.value)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-[#8bfb34] text-black border border-black shadow-[1px_1px_0px_#000000]'
                          : isFocused
                          ? 'bg-neutral-200/70 text-black border border-neutral-300'
                          : 'text-neutral-800 hover:bg-neutral-100 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <div className="flex items-center gap-2">
                          {opt.icon && React.createElement(opt.icon, {
                            className: "w-3.5 h-3.5 flex-shrink-0",
                            "aria-hidden": "true",
                          })}
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-black uppercase border border-black/30 ${
                                isSelected ? 'bg-white text-black' : 'bg-neutral-200 text-neutral-800'
                              }`}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.description && (
                          <span
                            className={`text-[10px] font-normal leading-tight mt-0.5 ${
                              isSelected ? 'text-neutral-900 font-medium' : 'text-neutral-500'
                            }`}
                          >
                            {opt.description}
                          </span>
                        )}
                      </div>

                      {/* Animated Checkmark for multiple indicator feedback */}
                      <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                          >
                            <Check className="w-4 h-4 stroke-[3] text-black" aria-hidden="true" />
                          </motion.div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
