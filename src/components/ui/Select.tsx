'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  /** Optional secondary text shown to the right of the label */
  hint?: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Current selected value */
  value: string;
  /** Called when the user picks a new option */
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Greyed-out text shown when value === '' */
  placeholder?: string;
  disabled?: boolean;
  /** 'sm' = compact form rows · 'md' = default */
  size?: 'sm' | 'md';
  /** Extra classes on the trigger button */
  className?: string;
  id?: string;
  /** Render a custom node inside the trigger alongside the label */
  renderTrigger?: (selected: SelectOption | undefined) => ReactNode;
  /** Extra classes on the trigger button specifically */
  triggerClassName?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  size = 'md',
  className = '',
  id,
  renderTrigger,
  triggerClassName = '',
}: SelectProps) {
  const uid = useId();
  const triggerId = id ?? uid;

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // ── Keyboard navigation ───────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledIndices = options
        .map((_, i) => i)
        .filter((i) => !options[i].disabled);

      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setOpen(true);
          const firstEnabled = enabledIndices[0] ?? 0;
          setFocusedIndex(firstEnabled);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown': {
          e.preventDefault();
          const currentPos = enabledIndices.indexOf(focusedIndex);
          const next = enabledIndices[Math.min(currentPos + 1, enabledIndices.length - 1)];
          setFocusedIndex(next ?? focusedIndex);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const currentPos = enabledIndices.indexOf(focusedIndex);
          const prev = enabledIndices[Math.max(currentPos - 1, 0)];
          setFocusedIndex(prev ?? focusedIndex);
          break;
        }
        case 'Home': {
          e.preventDefault();
          setFocusedIndex(enabledIndices[0] ?? 0);
          break;
        }
        case 'End': {
          e.preventDefault();
          setFocusedIndex(enabledIndices[enabledIndices.length - 1] ?? 0);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const opt = options[focusedIndex];
          if (opt && !opt.disabled) {
            onChange(opt.value);
            setOpen(false);
            setFocusedIndex(-1);
            triggerRef.current?.focus();
          }
          break;
        }
        case 'Tab':
          setOpen(false);
          setFocusedIndex(-1);
          break;
      }
    },
    [open, options, focusedIndex, onChange],
  );

  // ── Scroll focused item into view ─────────────────────────────────────────

  useEffect(() => {
    if (!open || focusedIndex < 0 || !panelRef.current) return;
    const item = panelRef.current.querySelector<HTMLElement>(
      `[data-index="${focusedIndex}"]`,
    );
    item?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, open]);

  // ── Sizing ────────────────────────────────────────────────────────────────

  const triggerSizeClass =
    size === 'sm'
      ? 'px-2 py-1 text-xs gap-1.5 min-h-[28px]'
      : 'px-3 py-2 text-[13px] gap-2 min-h-[36px]';

  const isPlaceholder = !value || value === '';

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setFocusedIndex(-1);
        }
      }}
    >
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => {
            if (!prev) {
              const idx = options.findIndex((o) => o.value === value && !o.disabled);
              setFocusedIndex(idx >= 0 ? idx : 0);
            }
            return !prev;
          });
        }}
        className={[
          'w-full flex items-center justify-between',
          'rounded-lg border transition-all duration-150 outline-none',
          'font-sans',
          triggerSizeClass,
          triggerClassName,
          disabled
            ? 'opacity-40 cursor-not-allowed bg-surface-2 border-border text-text-muted'
            : [
                'cursor-pointer select-none',
                'bg-surface-2 border-border text-text-primary',
                'hover:border-border-light hover:bg-surface-hover',
                open
                  ? 'border-accent/50 ring-2 ring-accent/10 bg-surface shadow-sm'
                  : '',
              ].join(' '),
        ].join(' ')}
      >
        <span className={`truncate flex-1 text-left ${isPlaceholder ? 'text-text-muted' : 'text-text-primary'}`}>
          {renderTrigger
            ? renderTrigger(selected)
            : selected
            ? selected.label
            : placeholder}
        </span>
        <ChevronDown
          size={size === 'sm' ? 12 : 14}
          className={`shrink-0 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Floating Panel ── */}
      {open && (
        <div
          ref={panelRef}
          role="listbox"
          aria-label="Options"
          className={[
            'absolute z-dropdown mt-1 w-full min-w-max',
            'bg-surface-2 border border-border rounded-xl',
            'overflow-auto max-h-56',
            'animate-scale-in',
          ].join(' ')}
          style={{
            transformOrigin: 'top center',
            boxShadow: '0 8px 32px -4px rgba(0,0,0,0.18), 0 0 0 1px var(--bdr)',
          }}
        >
          <div className="py-1">
            {options.map((opt, i) => {
              const isSelected = opt.value === value;
              const isFocused = i === focusedIndex;
              const isDisabled = opt.disabled;

              return (
                <div
                  key={opt.value}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault();
                  }}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(opt.value);
                    setOpen(false);
                    setFocusedIndex(-1);
                    triggerRef.current?.focus();
                  }}
                  onMouseEnter={() => !isDisabled && setFocusedIndex(i)}
                  className={[
                    'flex items-center justify-between gap-3 px-3 py-2 mx-1 rounded-lg',
                    'text-[13px] transition-colors duration-100',
                    isDisabled
                      ? 'opacity-40 cursor-not-allowed text-text-muted'
                      : 'cursor-pointer',
                    isFocused && !isDisabled
                      ? 'bg-accent/10 text-accent'
                      : isSelected && !isFocused
                      ? 'text-accent'
                      : 'text-text-primary hover:bg-surface-hover',
                  ].join(' ')}
                >
                  <span className="truncate flex-1">{opt.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {opt.hint && (
                      <span className="text-[10px] text-text-muted font-mono">{opt.hint}</span>
                    )}
                    {isSelected && (
                      <Check size={12} className="text-accent shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Convenience helper ───────────────────────────────────────────────────────
// Converts a plain string[] or {value,label}[] into SelectOption[]

export function toOptions(items: string[]): SelectOption[] {
  return items.map((v) => ({ value: v, label: v }));
}
