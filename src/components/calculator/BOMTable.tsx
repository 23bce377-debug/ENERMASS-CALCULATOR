'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  memo,
} from 'react';
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Info,
} from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR, type LineResult } from '@/lib/engine/calculator';
import { getActivePanelBrands } from '@/lib/data/masters';
import { useSettings } from '@/lib/hooks/useSettings';
import { useToast } from '@/components/ui/Toast';

// ─── BOM Row Grouping ───────────────────────────────────────────────────────────

interface RowGroup {
  label: string;
  keys: string[]; // BOM description keys that belong to this group
}

const ROW_GROUPS: RowGroup[] = [
  { label: 'Solar Panels',            keys: ['PANEL'] },
  { label: 'Power Electronics',       keys: ['INVERTER', 'COMMUNICATION DEVICE', 'BATTERY'] },
  { label: 'Metering',                keys: ['SOLAR METER'] },
  { label: 'Mounting & Structure',    keys: ['STRUCTURE', 'ACCESSORIES'] },
  { label: 'Electrical Protection',   keys: ['ACDB', 'DCDB', 'ISOLATOR', 'METER BOX'] },
  { label: 'Earthing',                keys: ['EARTH ROD', 'GI STRIP', 'EARTH COMPOUND', 'CHAMBER BOX', 'EARTH BENCH'] },
  { label: 'Cabling',                 keys: ['DC CABLE', 'AC CABLE', 'ALUM CABLE 50 SQMM', 'ALUM CABLE 10 SQMM', 'COPPER', 'MC4(ADDITIONAL)'] },
  { label: 'Wiring',                  keys: ['WIRING PIPE', 'WIRING ACCESSORIES', 'L/A'] },
  { label: 'Services',                keys: ['TRANSPORTATION', 'COMMISSION', 'SITE VISIT', 'INSTALLATION'] },
];

interface GroupedLines {
  label: string;
  lines: LineResult[];
  groupTotal: number;
  groupGST: number;
}

function groupLines(lines: LineResult[]): GroupedLines[] {
  const assigned = new Set<number>();
  const groups: GroupedLines[] = [];

  for (const group of ROW_GROUPS) {
    const matching = lines.filter(
      (l) => group.keys.includes(l.description) && !assigned.has(l.index),
    );
    matching.forEach((l) => assigned.add(l.index));

    if (matching.length > 0) {
      groups.push({
        label: group.label,
        lines: matching,
        groupTotal: matching.reduce((s, l) => s + l.lineTotal, 0),
        groupGST: matching.reduce((s, l) => s + l.lineGST, 0),
      });
    }
  }

  // Catch ungrouped items
  const ungrouped = lines.filter((l) => !assigned.has(l.index));
  if (ungrouped.length > 0) {
    groups.push({
      label: 'Other',
      lines: ungrouped,
      groupTotal: ungrouped.reduce((s, l) => s + l.lineTotal, 0),
      groupGST: ungrouped.reduce((s, l) => s + l.lineGST, 0),
    });
  }

  return groups;
}

// ─── Inline Edit Cell ───────────────────────────────────────────────────────────

interface InlineCellProps {
  value: number;
  onCommit: (val: number) => void;
  format?: (v: number) => string;
  className?: string;
  isRate?: boolean;
}

function InlineCell({ value, onCommit, format, className = '', isRate }: InlineCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
    } else {
      setDraft(String(value)); // Revert if invalid
    }
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        min="0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`w-full px-1.5 py-0.5 rounded bg-background border border-accent/40
          text-xs font-mono text-text-primary text-right
          focus:outline-none focus:border-accent ${className}`}
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className={`w-full text-right font-mono text-xs cursor-text
        hover:bg-accent-glow rounded px-1.5 py-0.5 transition-colors
        ${className}`}
      title="Click to edit"
    >
      {isRate ? `₹${new Intl.NumberFormat('en-IN').format(value)}` : (format ? format(value) : value)}
    </button>
  );
}

// ─── Memoized BOM Row ───────────────────────────────────────────────────────────

interface BOMRowProps {
  line: LineResult;
  onOverrideQty: (index: number, qty: number) => void;
  onOverrideRate: (index: number, rate: number) => void;
  onOverrideGst: (index: number, gst: number) => void;
  onClearOverride: (index: number) => void;
  onRemoveCustomItem: (index: number) => void;
  onToggleItemSelection: (index: number) => void;
  isPanelInteractive?: boolean;
  panelExpanded?: boolean;
  onTogglePanelDetails?: () => void;
}

const BOMRow = memo(function BOMRow({
  line,
  onOverrideQty,
  onOverrideRate,
  onOverrideGst,
  onClearOverride,
  onRemoveCustomItem,
  onToggleItemSelection,
  isPanelInteractive = false,
  panelExpanded = false,
  onTogglePanelDetails,
}: BOMRowProps) {
  const isMandatory = line.description.toUpperCase() === 'PANEL' || line.description.toUpperCase() === 'INVERTER';
  const isDimmed = line.isDisabled;
  const dimClass = isDimmed ? 'opacity-35' : '';

  return (
    <tr className={`border-b border-border/30 group transition-colors hover:bg-surface-hover ${dimClass}
      ${line.isOverridden ? 'border-l-2 border-l-warning/60' : ''}`}>
      {/* # */}
      <td className="py-2 px-2 text-center text-text-muted text-xs">
        <div className="flex items-center justify-center gap-2">
          <input
            type="checkbox"
            checked={isMandatory ? true : !line.isDisabled}
            disabled={isMandatory}
            onChange={() => {
              if (!isMandatory) {
                onToggleItemSelection(line.index);
              }
            }}
            className={`w-3.5 h-3.5 rounded border border-border bg-surface text-accent focus:ring-accent/30 focus:ring-offset-0 focus:ring-1 transition-all ${
              isMandatory ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={isMandatory ? 'Mandatory Item' : 'Toggle item selection'}
          />
          <span className="flex items-center gap-1 min-w-[14px] justify-center">
            {line.isOverridden && (
              <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" title="Overridden" />
            )}
            {line.index + 1}
          </span>
        </div>
      </td>

      {/* Description */}
      <td className={`py-2 px-2 text-xs font-medium whitespace-nowrap ${line.isDisabled ? 'line-through text-text-muted' : 'text-text-primary'}`}>
        {isPanelInteractive ? (
          <button
            onClick={onTogglePanelDetails}
            className="inline-flex items-center gap-1.5 hover:text-accent transition-colors disabled:pointer-events-none"
            title="Show selected panel details"
            disabled={line.isDisabled}
          >
            {panelExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className={line.isDisabled ? 'line-through' : ''}>{line.description}</span>
          </button>
        ) : (
          line.description
        )}
      </td>

      {/* Remarks */}
      <td className={`py-2 px-2 text-xs text-text-muted whitespace-nowrap ${line.isDisabled ? 'line-through' : ''}`}>
        {line.remarks || '–'}
      </td>

      {/* Unit */}
      <td className={`py-2 px-2 text-xs text-text-muted text-center ${line.isDisabled ? 'line-through' : ''}`}>
        {line.unit || 'Nos'}
      </td>

      {/* Qty — editable */}
      <td className="py-1 px-1 w-18">
        {line.isDisabled ? (
          <div className="w-full text-right font-mono text-xs text-text-muted px-1.5 py-0.5 line-through">
            {line.effectiveQty}
          </div>
        ) : (
          <InlineCell
            value={line.effectiveQty}
            onCommit={(v) => onOverrideQty(line.index, v)}
          />
        )}
      </td>

      {/* Rate/Unit — editable */}
      <td className="py-1 px-1 w-22.5">
        {line.isDisabled ? (
          <div className="w-full text-right font-mono text-xs text-text-muted px-1.5 py-0.5 line-through">
            {`₹${new Intl.NumberFormat('en-IN').format(line.effectiveRate)}`}
          </div>
        ) : (
          <InlineCell
            value={line.effectiveRate}
            onCommit={(v) => onOverrideRate(line.index, v)}
            isRate
          />
        )}
      </td>

      {/* Total */}
      <td className={`py-2 px-2 text-xs font-mono text-right ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-primary'}`}>
        {line.isDisabled ? (
          <span>
            <span className="line-through text-text-muted mr-1.5 opacity-60">
              {formatINR(line.effectiveQty * line.effectiveRate)}
            </span>
            <span>₹0</span>
          </span>
        ) : (
          formatINR(line.lineTotal)
        )}
      </td>

      {/* GST % — editable */}
      <td className="py-1 px-1 w-15">
        {line.isDisabled ? (
          <div className="w-full text-right font-mono text-xs text-text-muted px-1.5 py-0.5 line-through">
            {`${line.effectiveGstPct * 100}%`}
          </div>
        ) : (
          <InlineCell
            value={line.effectiveGstPct * 100}
            onCommit={(v) => onOverrideGst(line.index, v / 100)}
            format={(v) => `${v}%`}
          />
        )}
      </td>

      {/* GST Amt */}
      <td className={`py-2 px-2 text-xs font-mono text-right ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-muted'}`}>
        {line.isDisabled ? (
          <span>
            <span className="line-through text-text-muted mr-1.5 opacity-60">
              {formatINR(line.effectiveQty * line.effectiveRate * line.effectiveGstPct)}
            </span>
            <span>₹0</span>
          </span>
        ) : (
          formatINR(line.lineGST)
        )}
      </td>

      {/* SubTotal */}
      <td className={`py-2 px-2 text-xs font-mono text-right font-semibold ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-primary'}`}>
        {line.isDisabled ? (
          <span>
            <span className="line-through text-text-muted mr-1.5 opacity-60 font-normal">
              {formatINR(line.effectiveQty * line.effectiveRate * (1 + line.effectiveGstPct))}
            </span>
            <span>₹0</span>
          </span>
        ) : (
          formatINR(line.lineSubTotal)
        )}
      </td>

      <td className="py-2 px-2 text-center w-8">
        <div className="flex gap-1 justify-center">
        {line.isOverridden && !line.isCustomItem && (
          <button
            onClick={() => onClearOverride(line.index)}
            className="p-1 rounded hover:bg-warning/15 text-warning/70 hover:text-warning
              transition-colors"
            title="Reset to default"
          >
            <RotateCcw size={12} />
          </button>
        )}
        {line.isCustomItem && (
          <button
            onClick={() => onRemoveCustomItem(line.customItemIndex!)}
            className="p-1 rounded hover:bg-error/15 text-error/70 hover:text-error
              transition-colors"
            title="Remove custom item"
          >
            <RotateCcw size={12} className="rotate-45" />
          </button>
        )}
        </div>
      </td>
    </tr>
  );
});

function PanelSelectionDetailRow({
  line,
  panelMix,
  selectedPanelId,
  panelCatalog,
}: {
  line: LineResult;
  panelMix: Record<string, number>;
  selectedPanelId: string | null;
  panelCatalog: Map<string, { brand: string; model: string; wattage: number; ratePerWatt: number }>;
}) {
  const mixEntries = Object.entries(panelMix).filter(
    ([, qty]) => Number.isFinite(qty) && qty > 0,
  );

  const rows =
    mixEntries.length > 0
      ? mixEntries.map(([panelId, qty]) => {
          const panel = panelCatalog.get(panelId);
          return {
            key: panelId,
            label: panel ? `${panel.brand} ${panel.model}` : `Unknown Panel (${panelId})`,
            qty,
            ratePerPanel: panel ? panel.ratePerWatt * panel.wattage : null,
          };
        })
      : selectedPanelId
      ? (() => {
          const panel = panelCatalog.get(selectedPanelId);
          return [
            {
              key: selectedPanelId,
              label: panel ? `${panel.brand} ${panel.model}` : `Selected Panel (${selectedPanelId})`,
              qty: line.effectiveQty,
              ratePerPanel: panel ? panel.ratePerWatt * panel.wattage : line.effectiveRate,
            },
          ];
        })()
      : [];

  const totalSelectedQty = rows.reduce((sum, row) => sum + row.qty, 0);
  const qtyDelta = line.effectiveQty - totalSelectedQty;

  return (
    <tr className="border-b border-border/30 bg-accent-glow/20">
      <td colSpan={11} className="px-4 py-3">
        <div className="rounded-lg border border-accent/30 bg-surface-hover/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
              Selected Panel Mix
            </p>
            <div className="text-[11px] text-text-muted">
              Total Selected: <span className="font-semibold text-text-primary">{totalSelectedQty}</span>
              {' '} / BOM Qty: <span className="font-semibold text-text-primary">{line.effectiveQty}</span>
              {qtyDelta !== 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded ${
                  qtyDelta > 0 ? 'bg-warning/15 text-warning' : 'bg-error/15 text-error'
                }`}>
                  {qtyDelta > 0 ? `${qtyDelta} remaining` : `${Math.abs(qtyDelta)} extra`}
                </span>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-text-muted">
              No specific panel mix selected. Using system default panel line.
            </p>
          ) : (
            <div className="space-y-1.5">
              {rows.map((row) => (
                <div key={row.key} className="flex items-center justify-between text-xs">
                  <span className="text-text-primary">{row.label}</span>
                  <span className="text-text-secondary font-mono">
                    Qty {row.qty}
                    {row.ratePerPanel !== null && ` · ₹${new Intl.NumberFormat('en-IN').format(row.ratePerPanel)} / panel`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Group Header Row ───────────────────────────────────────────────────────────

function GroupHeader({
  label,
  total,
  gst,
  expanded,
  onToggle,
  count,
}: {
  label: string;
  total: number;
  gst: number;
  expanded: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <tr
      onClick={onToggle}
      className="cursor-pointer bg-surface-hover/50 hover:bg-surface-hover transition-colors"
    >
      <td colSpan={6} className="py-2 px-2">
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown size={14} className="text-text-muted" />
          ) : (
            <ChevronRight size={14} className="text-text-muted" />
          )}
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {label}
          </span>
          <span className="text-[10px] text-text-muted">({count})</span>
        </div>
      </td>
      <td className="py-2 px-2 text-right">
        {!expanded && (
          <span className="text-xs font-mono text-text-secondary">{formatINR(total)}</span>
        )}
      </td>
      <td className="py-2 px-2"></td>
      <td className="py-2 px-2 text-right">
        {!expanded && (
          <span className="text-xs font-mono text-text-muted">{formatINR(gst)}</span>
        )}
      </td>
      <td className="py-2 px-2 text-right">
        {!expanded && (
          <span className="text-xs font-mono font-semibold text-text-primary">{formatINR(total + gst)}</span>
        )}
      </td>
      <td className="py-2 px-2"></td>
    </tr>
  );
}

// ─── Margin Slider ──────────────────────────────────────────────────────────────

function MarginControl({
  value,
  onChange,
}: {
  value: number; // as decimal, e.g. 0.20
  onChange: (val: number | null) => void;
}) {
  const pctValue = Math.round(value * 100);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={pctValue}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        className="flex-1 h-1.5 rounded-full appearance-none bg-border
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-accent/30
          cursor-pointer"
      />
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={pctValue}
          onChange={(e) => {
            const v = parseInt(e.target.value);
            if (!isNaN(v) && v >= 0 && v <= 100) onChange(v / 100);
          }}
          className="w-14 px-2 py-1 rounded-md bg-background border border-border
            text-xs font-mono text-right text-text-primary
            focus:outline-none focus:border-accent/40"
        />
        <span className="text-xs text-text-muted">%</span>
      </div>
      <div className="relative">
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className="p-1 rounded hover:bg-surface-hover text-text-muted"
        >
          <Info size={14} />
        </button>
        {showTooltip && (
          <div className="absolute right-0 top-full mt-1 px-3 py-2 rounded-lg
            bg-surface-hover border border-border text-[10px] text-text-secondary
            whitespace-nowrap z-50 shadow-xl">
            MRP = Cost × (1 + Margin%)
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main BOM Table Component ───────────────────────────────────────────────────

export function BOMTable() {
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const targetMarginPct = useCalculatorStore((s) => s.targetMarginPct);
  const panelMix = useCalculatorStore((s) => s.panelMix);
  const selectedPanelId = useCalculatorStore((s) => s.selectedPanelId);
  const setRowOverride = useCalculatorStore((s) => s.setRowOverride);
  const clearRowOverride = useCalculatorStore((s) => s.clearRowOverride);
  const setMarginOverride = useCalculatorStore((s) => s.setMarginOverride);
  const removeCustomItem = useCalculatorStore((s) => s.removeCustomItem);
  const toggleItemSelection = useCalculatorStore((s) => s.toggleItemSelection);
  const dcCableLengthM = useCalculatorStore((s) => s.dcCableLengthM);
  const acCableLengthM = useCalculatorStore((s) => s.acCableLengthM);
  const setCableLengths = useCalculatorStore((s) => s.setCableLengths);
  const { settings } = useSettings();
  const { toast } = useToast();

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedPanelRows, setExpandedPanelRows] = useState<Set<number>>(new Set());

  // Inline Add Custom Item State
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemRate, setNewItemRate] = useState('');
  const [newItemGst, setNewItemGst] = useState('18');

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const togglePanelRow = useCallback((index: number) => {
    setExpandedPanelRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const panelCatalog = useMemo(() => {
    const allPanels = getActivePanelBrands(settings);
    return new Map(
      allPanels.map((panel) => [
        panel.id,
        {
          brand: panel.brand,
          model: panel.model,
          wattage: panel.wattage,
          ratePerWatt: panel.ratePerWatt,
        },
      ]),
    );
  }, [settings.customPanels]);

  // Group the BOM lines
  const groups = useMemo(
    () => (calcResult ? groupLines(calcResult.lines) : []),
    [calcResult],
  );

  // Row action handlers
  const handleOverrideQty = useCallback(
    (index: number, qty: number) => setRowOverride(index, { qty }),
    [setRowOverride],
  );
  const handleOverrideRate = useCallback(
    (index: number, rate: number) => setRowOverride(index, { ratePerUnit: rate }),
    [setRowOverride],
  );
  const handleOverrideGst = useCallback(
    (index: number, gst: number) => setRowOverride(index, { gstPct: gst }),
    [setRowOverride],
  );

  if (!calcResult) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center" id="bom-table">
        <div className="text-text-muted text-sm">
          Select a system to view the Bill of Materials
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm" id="bom-table">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-active flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary tracking-widest uppercase">Bill of Materials</h3>
          <span className="text-[10px] font-mono font-medium bg-background px-2 py-0.5 rounded text-text-muted">
            {calcResult.lines.length} items
          </span>
        </div>
        
        {/* Wiring Distances Controls */}
        <div className="flex items-center gap-4 bg-background px-3 py-1.5 rounded-lg border border-border/60">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">DC Cable (Panel to Inv)</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={dcCableLengthM}
                onChange={(e) => setCableLengths(parseFloat(e.target.value) || 0, acCableLengthM)}
                className="w-14 px-1.5 py-0.5 rounded bg-surface border border-border text-xs font-mono text-right text-text-primary focus:outline-none focus:border-accent"
              />
              <span className="text-[10px] text-text-muted">m</span>
            </div>
          </div>
          <div className="w-px h-4 bg-border"></div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-text-muted">AC Cable (Inv to Meter)</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={acCableLengthM}
                onChange={(e) => setCableLengths(dcCableLengthM, parseFloat(e.target.value) || 0)}
                className="w-14 px-1.5 py-0.5 rounded bg-surface border border-border text-xs font-mono text-right text-text-primary focus:outline-none focus:border-accent"
              />
              <span className="text-[10px] text-text-muted">m</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-225">
          <thead className="bg-background/60 sticky top-0 z-10">
            <tr className="border-b border-border">
              <th className="py-2.5 px-2 text-center text-text-muted font-medium w-10">#</th>
              <th className="py-2.5 px-2 text-left text-text-muted font-medium">Description</th>
              <th className="py-2.5 px-2 text-left text-text-muted font-medium w-20">Remarks</th>
              <th className="py-2.5 px-2 text-center text-text-muted font-medium w-12">Unit</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-18">Qty</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-22.5">Rate/Unit</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-24">Total</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-15">GST%</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-20">GST Amt</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-24">SubTotal</th>
              <th className="py-2.5 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.label);
              return (
                <React.Fragment key={group.label}>
                  <GroupHeader
                    label={group.label}
                    total={group.groupTotal}
                    gst={group.groupGST}
                    expanded={!isCollapsed}
                    onToggle={() => toggleGroup(group.label)}
                    count={group.lines.length}
                  />
                  {!isCollapsed &&
                    group.lines.map((line) => {
                      const isPanelLine = line.description.toUpperCase() === 'PANEL';
                      const isPanelExpanded = expandedPanelRows.has(line.index);
                      return (
                        <React.Fragment key={line.index}>
                          <BOMRow
                            line={line}
                            onOverrideQty={handleOverrideQty}
                            onOverrideRate={handleOverrideRate}
                            onOverrideGst={handleOverrideGst}
                            onClearOverride={clearRowOverride}
                            onRemoveCustomItem={removeCustomItem}
                            onToggleItemSelection={toggleItemSelection}
                            isPanelInteractive={isPanelLine}
                            panelExpanded={isPanelExpanded}
                            onTogglePanelDetails={
                              isPanelLine ? () => togglePanelRow(line.index) : undefined
                            }
                          />
                          {isPanelLine && isPanelExpanded && (
                            <PanelSelectionDetailRow
                              line={line}
                              panelMix={panelMix}
                              selectedPanelId={selectedPanelId}
                              panelCatalog={panelCatalog}
                            />
                          )}
                        </React.Fragment>
                      );
                    })}
                </React.Fragment>
              );
            })}
            {isAddingItem ? (
              <tr className="bg-surface-active">
                <td className="py-2 px-2 border-b border-border text-center text-text-muted">-</td>
                <td className="py-2 px-2 border-b border-border">
                  <input
                    type="text"
                    placeholder="Description"
                    value={newItemDesc}
                    onChange={e => setNewItemDesc(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent focus:outline-none"
                    autoFocus
                  />
                </td>
                <td colSpan={2} className="py-2 px-2 border-b border-border"></td>
                <td className="py-2 px-2 border-b border-border">
                  <input
                    type="number"
                    placeholder="Qty"
                    min="0"
                    value={newItemQty}
                    onChange={e => setNewItemQty(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="py-2 px-2 border-b border-border">
                  <input
                    type="number"
                    placeholder="Rate"
                    min="0"
                    value={newItemRate}
                    onChange={e => setNewItemRate(e.target.value)}
                    className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="py-2 px-2 border-b border-border"></td>
                <td className="py-2 px-2 border-b border-border">
                  <select
                    value={newItemGst}
                    onChange={e => setNewItemGst(e.target.value)}
                    className="w-full bg-background border border-border rounded px-1 py-1 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                  >
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </td>
                <td colSpan={2} className="py-2 px-2 border-b border-border"></td>
                <td className="py-2 px-2 border-b border-border text-right whitespace-nowrap">
                  <button
                    onClick={() => {
                      const descNormalized = newItemDesc.trim().toLowerCase();
                      if (!descNormalized) { setIsAddingItem(false); return; }
                      const hasDuplicate = calcResult.lines.some((line) => line.description.trim().toLowerCase() === descNormalized);
                      if (hasDuplicate) return toast('An item with the same description already exists.', 'error');
                      const qty = parseFloat(newItemQty) || 0;
                      const rate = parseFloat(newItemRate) || 0;
                      const gstRaw = parseFloat(newItemGst) / 100;
                      // Constrain GST to valid GstPct values
                      const VALID_GST: Array<0 | 0.05 | 0.12 | 0.18> = [0, 0.05, 0.12, 0.18];
                      const gst = VALID_GST.reduce((prev, curr) => Math.abs(curr - gstRaw) < Math.abs(prev - gstRaw) ? curr : prev);
                      if (qty > 0 && rate >= 0) {
                        useCalculatorStore.getState().addCustomItem({
                          description: newItemDesc.trim(),
                          qty, ratePerUnit: rate, gstPct: gst, unit: 'Nos'
                        });
                      }
                      setIsAddingItem(false);
                      setNewItemDesc(''); setNewItemQty(''); setNewItemRate(''); setNewItemGst('18');
                    }}
                    className="px-2 py-1 bg-accent text-background rounded hover:bg-accent-hover transition-colors font-semibold mr-1"
                  >
                    Save
                  </button>
                  <button onClick={() => setIsAddingItem(false)} className="px-2 py-1 bg-surface-hover hover:bg-surface-active text-text-primary rounded transition-colors font-semibold">
                    Cancel
                  </button>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={11} className="py-2 px-4 border-b border-border/50">
                  <button
                    onClick={() => setIsAddingItem(true)}
                    className="w-full py-2 text-xs font-semibold text-accent bg-accent/5 hover:bg-accent/10 border border-dashed border-accent/30 rounded transition-colors"
                  >
                    + Add Custom Item
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Footer: Aggregates ────────────────────────────────────────────── */}
      <div className="border-t border-border bg-background/40">
        {/* Cost aggregates */}
        <div className="px-4 py-3 space-y-2">
          <FooterRow label="Cost Before GST" value={formatINR(calcResult.costBeforeGST)} />
          <FooterRow label="Total Input GST" value={formatINR(calcResult.totalInputGST)} muted />
          <FooterRow label="Total Incl. GST" value={formatINR(calcResult.totalIncGST)} bold />
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Margin section */}
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Margin
              </span>
              <span className="text-xs font-mono text-accent font-semibold">
                {Math.round(calcResult.effectiveMarginPct * 100)}%
              </span>
            </div>
            <MarginControl
              value={targetMarginPct ?? calcResult.effectiveMarginPct}
              onChange={setMarginOverride}
            />
          </div>

          <div className="pt-1">
            <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
              After Margin
            </span>
          </div>

          <FooterRow label="MRP (excl GST)" value={formatINR(calcResult.mrpExclGST)} />
          <FooterRow label="Margin Amount" value={formatINR(calcResult.marginAmount)} accent />
          <FooterRow
            label={`Output GST Rate (${(calcResult.gstOutputRate * 100).toFixed(1)}%)`}
            value={formatINR(calcResult.mrpInclGST - calcResult.mrpExclGST)}
            muted
          />
          <FooterRow label="MRP (incl GST)" value={formatINR(calcResult.mrpInclGST)} gold />
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Per-kW analysis */}
        <div className="px-4 py-3 space-y-2">
          <FooterRow label="Per kW (excl GST)" value={formatINR(calcResult.perKWexclGST)} />
          <FooterRow label="Per kW (incl GST)" value={formatINR(calcResult.perKWinclGST)} bold />
        </div>
      </div>
    </div>
  );
}

// ─── Footer Row Helper ──────────────────────────────────────────────────────────

function FooterRow({
  label,
  value,
  bold,
  muted,
  accent,
  gold,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${muted ? 'text-text-muted' : 'text-text-secondary'}`}>
        {label}
      </span>
      <span
        className={`text-xs font-mono ${
          gold
            ? 'text-accent font-bold text-sm'
            : accent
            ? 'text-accent font-semibold'
            : bold
            ? 'text-text-primary font-bold'
            : muted
            ? 'text-text-muted'
            : 'text-text-primary font-semibold'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
