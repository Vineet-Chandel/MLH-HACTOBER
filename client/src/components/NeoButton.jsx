import React from 'react';
import { motion } from 'motion/react';

export default function NeoButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // 'primary' (lime), 'secondary' (white), 'danger' (red), 'dark' (black), 'outline'
  size = 'md', // 'sm', 'md', 'lg'
  disabled = false,
  className = '',
  icon: Icon,
  iconPosition = 'left',
  title,
  ariaLabel,
  ...props
}) {
  // Variant styles matching the reference images:
  // - primary: Vibrant lime green (#8bfb34) with solid black border & offset black shadow (Images 1 & 3)
  // - secondary: Crisp white with solid black border & offset black shadow (Image 2)
  // - danger: Vivid coral/rose red with black border
  // - dark: Deep black with white text
  const variantStyles = {
    primary:
      'bg-[#8bfb34] hover:bg-[#7ce62c] text-black border-2 border-black font-bold',
    secondary:
      'bg-white hover:bg-neutral-50 text-black border-2 border-black font-semibold',
    danger:
      'bg-[#ff4d4d] hover:bg-[#f03a3a] text-white border-2 border-black font-bold',
    dark:
      'bg-black hover:bg-neutral-800 text-white border-2 border-black font-bold',
    outline:
      'bg-transparent hover:bg-black/5 text-black border-2 border-black font-semibold',
    amber:
      'bg-[#fbbf24] hover:bg-[#f59e0b] text-black border-2 border-black font-bold',
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 rounded-lg',
    md: 'text-sm px-4 py-2 gap-2 rounded-xl',
    lg: 'text-base px-6 py-3 gap-2.5 rounded-xl uppercase tracking-wider font-extrabold',
  };

  const currentVariant = variantStyles[variant] || variantStyles.primary;
  const currentSize = sizeStyles[size] || sizeStyles.md;

  const shadowNormal = size === 'sm' ? '3px 3px 0px #000000' : '4px 4px 0px #000000';
  const shadowHover = size === 'sm' ? '4px 4px 0px #000000' : '6px 6px 0px #000000';
  const shadowTap = '1px 1px 0px #000000';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${currentVariant} ${currentSize} ${className}`}
      style={{
        boxShadow: disabled ? 'none' : shadowNormal,
      }}
      whileHover={
        disabled
          ? {}
          : {
              x: -2,
              y: -2,
              boxShadow: shadowHover,
              transition: { duration: 0.12, ease: 'easeOut' },
            }
      }
      whileTap={
        disabled
          ? {}
          : {
              x: 2,
              y: 2,
              boxShadow: shadowTap,
              transition: { duration: 0.08, ease: 'easeIn' },
            }
      }
      {...props}
    >
      {Icon && iconPosition === 'left' && (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
      )}
      <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">{children}</span>
      {Icon && iconPosition === 'right' && (
        <Icon className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />
      )}
    </motion.button>
  );
}
