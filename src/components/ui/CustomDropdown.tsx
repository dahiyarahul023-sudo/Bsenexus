import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Search, X, LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { springSnappy, buttonTap } from '../../utils/motionTokens';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DropdownOption {
  value: string | number;
  label: string;
  count?: number;
  badge?: string;
  badgeColor?: string;
  icon?: LucideIcon;
  iconColor?: string;
  dotColor?: string;
  subtext?: string;
}

export interface CustomDropdownProps {
  options: DropdownOption[];
  value: string | number;
  onChange: (value: any) => void;
  placeholder?: string;
  prefixIcon?: LucideIcon;
  prefixLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuWidth?: string;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top' | 'auto';
  size?: 'xs' | 'sm' | 'md';
  variant?: 'default' | 'subtle' | 'amber' | 'emerald' | 'ghost';
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  prefixIcon: PrefixIcon,
  prefixLabel,
  className,
  buttonClassName,
  menuWidth = 'w-56',
  align = 'right',
  placement = 'auto',
  size = 'sm',
  variant = 'default',
  searchable = false,
  searchPlaceholder = 'Search...',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find(opt => String(opt.value) === String(value)),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase().trim();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(q) || 
      (opt.subtext && opt.subtext.toLowerCase().includes(q))
    );
  }, [options, searchable, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      if (placement === 'top') {
        setOpenUpward(true);
      } else if (placement === 'bottom') {
        setOpenUpward(false);
      } else if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUpward(spaceBelow < 280 && rect.top > 280);
      }

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);

      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    } else {
      setSearchTerm('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, placement, searchable]);

  const SelectedIcon = selectedOption?.icon || PrefixIcon;

  // Size styling
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] rounded-md gap-1',
    sm: 'px-2.5 py-1 text-[11px] rounded-lg gap-1.5',
    md: 'px-3 py-1.5 text-xs rounded-xl gap-2'
  };

  const iconSizes = {
    xs: 11,
    sm: 13,
    md: 14
  };

  // Variant styling
  const variantClasses = {
    default: 'bg-white dark:bg-[#1A1926] border-slate-200 dark:border-[#2D283E] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600',
    subtle: 'bg-slate-100 dark:bg-[#201E2E] border-slate-200 dark:border-[#2D283E] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2A263D]',
    amber: 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50',
    emerald: 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50',
    ghost: 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-[#201E2E] text-slate-700 dark:text-slate-300'
  };

  return (
    <div className={cn("relative inline-block text-left select-none", className)} ref={dropdownRef}>
      <motion.button
        type="button"
        whileTap={disabled ? undefined : buttonTap}
        transition={springSnappy}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "group flex items-center justify-between border font-bold transition-all cursor-pointer shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed",
          sizeClasses[size],
          variantClasses[variant],
          isOpen && "ring-1 ring-blue-500/40 border-blue-400 dark:border-blue-600",
          buttonClassName
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {SelectedIcon && (
            <SelectedIcon 
              size={iconSizes[size]} 
              className={cn("shrink-0", selectedOption?.iconColor || "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200")} 
            />
          )}

          {selectedOption?.dotColor && (
            <span className={cn("w-2 h-2 rounded-full shrink-0", selectedOption.dotColor)} />
          )}

          {prefixLabel && (
            <span className="text-slate-400 dark:text-slate-500 font-semibold shrink-0">
              {prefixLabel}:
            </span>
          )}

          <span className="truncate font-bold">
            {selectedOption ? selectedOption.label : placeholder}
          </span>

          {selectedOption?.count !== undefined && (
            <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-slate-100 dark:bg-[#2D283E] text-slate-600 dark:text-slate-300 font-mono font-bold">
              {selectedOption.count}
            </span>
          )}

          {selectedOption?.badge && (
            <span className={cn(
              "px-1.5 py-0.2 rounded text-[9px] font-bold font-mono uppercase",
              selectedOption.badgeColor || "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
            )}>
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown 
          size={iconSizes[size]} 
          className={cn(
            "shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-transform duration-200 ml-1",
            isOpen && "rotate-180 text-blue-500"
          )} 
        />
      </motion.button>

      {/* Popover Menu with Framer Motion AnimatePresence */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: openUpward ? 6 : -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: openUpward ? 4 : -4 }}
            transition={springSnappy}
            className={cn(
              "absolute z-50 rounded-xl bg-white dark:bg-[#1A1926] border border-slate-200 dark:border-[#2D283E] shadow-xl shadow-slate-900/10 dark:shadow-black/60 p-1 focus:outline-none overflow-hidden",
              openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
              menuWidth,
              align === 'right' ? "right-0" : "left-0"
            )}
            role="listbox"
          >
            {/* Search Box if enabled */}
            {searchable && (
              <div className="p-1 mb-1 border-b border-slate-100 dark:border-[#2D283E]">
                <div className="relative">
                  <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-6 pr-5 py-1 bg-slate-50 dark:bg-[#14131E] border border-slate-200 dark:border-[#2D283E] rounded-md text-[11px] font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable list */}
            <div className="max-h-56 overflow-y-auto space-y-0.5 no-scrollbar">
              {filteredOptions.length === 0 ? (
                <div className="py-3 px-2 text-center text-xs text-slate-400">
                  No matching options
                </div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = String(option.value) === String(value);
                  const OptIcon = option.icon;

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-left transition-colors cursor-pointer",
                        isSelected
                          ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#252233] hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {OptIcon && (
                          <OptIcon 
                            size={13} 
                            className={cn("shrink-0", option.iconColor || (isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-400"))} 
                          />
                        )}

                        {option.dotColor && (
                          <span className={cn("w-2 h-2 rounded-full shrink-0", option.dotColor)} />
                        )}

                        <div className="truncate">
                          <span className="truncate block font-bold text-[11px]">{option.label}</span>
                          {option.subtext && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate block">
                              {option.subtext}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {option.count !== undefined && (
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold",
                            isSelected 
                              ? "bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200" 
                              : "bg-slate-100 dark:bg-[#2D283E] text-slate-500 dark:text-slate-400"
                          )}>
                            {option.count}
                          </span>
                        )}

                        {option.badge && (
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase",
                            option.badgeColor || "bg-slate-200 dark:bg-[#2D283E] text-slate-700 dark:text-slate-300"
                          )}>
                            {option.badge}
                          </span>
                        )}

                        {isSelected && (
                          <Check size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
