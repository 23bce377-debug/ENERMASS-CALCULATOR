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
  Percent,
  IndianRupee,
} from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { formatINR, roundTo5, type LineResult } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';
import { useToast } from '@/components/ui/Toast';
import { Select } from '@/components/ui/Select';
import { normalizeGstRate } from '@/lib/utils/gst';

// ─── BOM Row Grouping ───────────────────────────────────────────────────────────

interface RowGroup {
  label: string;
  keys: string[]; // BOM description keys that belong to this group
}

const ROW_GROUPS: RowGroup[] = [
  { label: 'Solar Panels',            keys: ['PANEL'] },
  { label: 'Power Electronics',       keys: ['INVERTER', 'COMMUNICATION DEVICE', 'BATTERY'] },
  { label: 'Metering',                keys: ['SOLAR METER', 'NET METER'] },
  { label: 'Mounting & Structure',    keys: ['STRUCTURE', 'ACCESSORIES'] },
  { label: 'Electrical Protection',   keys: ['ACDB', 'DCDB', 'ISOLATOR', 'METER BOX'] },
  { label: 'Earthing',                keys: ['EARTH ROD', 'GI STRIP', 'EARTH COMPOUND', 'CHAMBER BOX', 'EARTH BENCH'] },
  { label: 'Cabling',                 keys: ['DC CABLE', 'AC CABLE', 'ALUM CABLE 50 SQMM', 'ALUM CABLE 10 SQMM', 'COPPER', 'MC4(ADDITIONAL)'] },
  { label: 'Wiring',                  keys: ['WIRING PIPE', 'WIRING ACCESSORIES', 'L/A', 'LIGHTNING ARRESTER'] },
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

  // 1. Group by dynamic categoryName from DB seeds
  const dynamicCategories = Array.from(new Set(lines.map(l => l.categoryName).filter(Boolean)));
  for (const catName of dynamicCategories) {
    const matching = lines.filter(l => l.categoryName === catName);
    matching.forEach(l => assigned.add(l.index));
    if (matching.length > 0) {
      groups.push({
        label: String(catName),
        lines: matching,
        groupTotal: matching.reduce((s, l) => s + l.lineTotal, 0),
        groupGST: matching.reduce((s, l) => s + l.lineGST, 0),
      });
    }
  }

  // 2. Fallback to hardcoded ROW_GROUPS
  for (const group of ROW_GROUPS) {
    const matching = lines.filter((l) => {
      if (assigned.has(l.index)) return false;
      // Match exact keys or prefixes (e.g., 'STRUCTURE RAFTER' matches 'STRUCTURE')
      return group.keys.some(k => 
        l.description.toUpperCase() === k.toUpperCase() || 
        l.description.toUpperCase().startsWith(k.toUpperCase() + ' ')
      );
    });
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

  // Sort groups based on a preferred order
  const orderMap = new Map<string, number>();
  [
    'SOLAR PANELS',
    'POWER ELECTRONICS',
    'METERING',
    'MOUNTING & STRUCTURE',
    'ELECTRICAL PROTECTION',
    'EARTHING',
    'CABLING',
    'WIRING',
    'SERVICES'
  ].forEach((cat, idx) => {
    orderMap.set(cat, idx);
  });

  groups.sort((a, b) => {
    const labelA = a.label.toUpperCase().trim();
    const labelB = b.label.toUpperCase().trim();

    const isOtherA = labelA === 'OTHER' || labelA === 'OTHERS';
    const isOtherB = labelB === 'OTHER' || labelB === 'OTHERS';

    if (isOtherA && !isOtherB) return 1;
    if (!isOtherA && isOtherB) return -1;
    if (isOtherA && isOtherB) return 0;

    const idxA = orderMap.has(labelA) ? orderMap.get(labelA)! : 100;
    const idxB = orderMap.has(labelB) ? orderMap.get(labelB)! : 100;

    if (idxA !== idxB) {
      return idxA - idxB;
    }

    return labelA.localeCompare(labelB);
  });

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
  const isEditingRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
    isEditingRef.current = true;
  };

  const commit = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    if (!isEditingRef.current) return;
    
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= 0) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
    setEditing(false);
    isEditingRef.current = false;
  };

  const cancel = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    isEditingRef.current = false;
    setEditing(false);
  };

  const handleBlur = () => {
    blurTimeoutRef.current = setTimeout(() => {
      if (isEditingRef.current) {
        commit();
      }
    }, 150);
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
        onBlur={handleBlur}
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
        border-b border-dashed border-accent/40 text-accent/90 hover:text-accent
        hover:bg-accent/10 hover:border-accent rounded-t px-1.5 py-0.5 transition-all
        ${className}`}
      title="Click to edit"
    >
      {format ? format(value) : isRate ? `₹${new Intl.NumberFormat('en-IN').format(value)}` : value}
    </button>
  );
}

// ─── Memoized BOM Row ───────────────────────────────────────────────────────────

interface BOMRowProps {
  line: LineResult;
  displayName?: string;
  onOverrideQty: (index: number, qty: number) => void;
  onOverrideRate: (index: number, rate: number) => void;
  onOverrideGst: (index: number, gst: number) => void;
  onClearOverride: (index: number) => void;
  onRemoveCustomItem: (index: number) => void;
  onToggleItemSelection: (index: number) => void;
  isPanelInteractive?: boolean;
  panelExpanded?: boolean;
  onTogglePanelDetails?: (index: number) => void;
  inventorySummary?: import('@/backend/orm/acquisition').InventorySummary[];
  dbMeters?: any[];
  dbLAs?: any[];
  solarMeterId?: string | null;
  netMeterId?: string | null;
  lightningArresterId?: string | null;
  onSelectMeter?: (type: 'solar' | 'net', id: string | null) => void;
  onSelectLA?: (id: string | null) => void;
}

const BOMRow = memo(function BOMRow({
  line,
  displayName,
  onOverrideQty,
  onOverrideRate,
  onOverrideGst,
  onClearOverride,
  onRemoveCustomItem,
  onToggleItemSelection,
  isPanelInteractive = false,
  panelExpanded = false,
  onTogglePanelDetails,
  inventorySummary,
  dbMeters,
  dbLAs,
  solarMeterId,
  netMeterId,
  lightningArresterId,
  onSelectMeter,
  onSelectLA,
}: BOMRowProps) {
  const isMandatory = false;
  const isDimmed = line.isDisabled;
  const dimClass = isDimmed ? 'opacity-35' : '';

  const inventoryItem = inventorySummary?.find(
    (item) => item.item_description.toUpperCase() === line.description.toUpperCase()
  );

  return (
    <tr className={`border-b border-border/30 group transition-all duration-200 hover:bg-surface-hover/50
      ${line.index % 2 === 1 ? 'bg-surface-hover/20' : 'bg-surface'}
      ${line.isOverridden ? 'border-l-2 border-l-warning/60' : ''}`}>
      {/* # */}
      <td className={`py-2 px-2 text-center text-text-muted text-xs w-12 ${dimClass}`}>
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
      <td className={`py-2 px-2 text-xs font-medium ${line.isDisabled ? 'line-through text-text-muted' : 'text-text-primary'}`}>
        {isPanelInteractive ? (
          <button
            onClick={() => onTogglePanelDetails?.(line.index)}
            className={`inline-flex items-center gap-1.5 hover:text-accent transition-colors disabled:pointer-events-none ${dimClass}`}
            title="Show selected panel details"
            disabled={line.isDisabled}
          >
            {panelExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className={line.isDisabled ? 'line-through' : ''}>{displayName || line.description}</span>
          </button>
        ) : line.description.toUpperCase() === 'SOLAR METER' && dbMeters ? (
          <div className="flex flex-col gap-1 w-64">
            <span className={`text-[10px] uppercase font-bold text-text-secondary tracking-wider ${dimClass}`}>{line.description}</span>
            <Select
              size="sm"
              value={solarMeterId || ''}
              onChange={(val) => onSelectMeter?.('solar', val === '' ? null : val)}
              placeholder="None (Unselected)"
              triggerClassName={isDimmed ? 'opacity-35' : ''}
              options={[
                { value: '', label: 'None (Unselected)' },
                ...dbMeters
                  .filter((m: any) => m.meter_type === 'solar_meter')
                  .map((m: any) => ({
                    value: m.id,
                    label: `${m.brand || ''} ${m.model || ''} (${m.phases} Phase)`,
                    hint: `₹${new Intl.NumberFormat('en-IN').format(m.rate)}`
                  })),
                { value: 'custom', label: 'Custom Solar Meter' }
              ]}
            />
          </div>
        ) : line.description.toUpperCase() === 'NET METER' && dbMeters ? (
          <div className="flex flex-col gap-1 w-64">
            <span className={`text-[10px] uppercase font-bold text-text-secondary tracking-wider ${dimClass}`}>{line.description}</span>
            <Select
              size="sm"
              value={netMeterId || ''}
              onChange={(val) => onSelectMeter?.('net', val === '' ? null : val)}
              placeholder="None (Unselected)"
              triggerClassName={isDimmed ? 'opacity-35' : ''}
              options={[
                { value: '', label: 'None (Unselected)' },
                ...dbMeters
                  .filter((m: any) => m.meter_type === 'net_meter')
                  .map((m: any) => ({
                    value: m.id,
                    label: `${m.brand || ''} ${m.model || ''} (${m.phases} Phase)`,
                    hint: `₹${new Intl.NumberFormat('en-IN').format(m.rate)}`
                  })),
                { value: 'custom', label: 'Custom Net Meter' }
              ]}
            />
          </div>
        ) : (line.description.toUpperCase() === 'LIGHTNING ARRESTER' || line.description.toUpperCase() === 'L/A') && dbLAs ? (
          <div className="flex flex-col gap-1 w-64">
            <span className={`text-[10px] uppercase font-bold text-text-secondary tracking-wider ${dimClass}`}>{line.description}</span>
            <Select
              size="sm"
              value={lightningArresterId || ''}
              onChange={(val) => onSelectLA?.(val === '' ? null : val)}
              placeholder="None (Unselected)"
              triggerClassName={isDimmed ? 'opacity-35' : ''}
              options={[
                { value: '', label: 'None (Unselected)' },
                ...dbLAs.map((l: any) => ({
                  value: l.id,
                  label: l.description || l.model || 'Standard L/A',
                  hint: `₹${new Intl.NumberFormat('en-IN').format(l.rate)}`
                })),
                { value: 'custom', label: 'Custom Lightning Arrester' }
              ]}
            />
          </div>
        ) : (
          <div className={`flex flex-col ${dimClass}`}>
            <span className={line.isDisabled ? 'line-through text-text-muted' : 'text-text-primary'}>
              {displayName || line.description}
            </span>
            {line.description.toUpperCase() === 'STRUCTURE' && line.unit?.toLowerCase() === 'kg' && (
              <span className="text-[10px] text-accent font-medium mt-0.5">
                Total Weight: {line.effectiveQty.toFixed(1)} kg
              </span>
            )}
          </div>
        )}
      </td>

      {/* Remarks */}
      <td className={`py-2 px-2 text-xs text-text-muted w-56 ${line.isDisabled ? 'line-through' : ''} ${dimClass}`}>
        {line.remarks || '–'}
      </td>

      {/* Unit */}
      <td className={`py-2 px-2 text-xs text-text-muted text-center w-14 ${line.isDisabled ? 'line-through' : ''} ${dimClass}`}>
        {line.unit || 'Nos'}
      </td>

      {/* Qty — editable */}
      <td className={`py-1 px-1 w-16 ${dimClass}`}>
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

      {/* Rate/Unit — editable (Selling Price) */}
      <td className={`py-1 px-1 w-28 ${dimClass}`}>
        {line.isDisabled ? (
          <div className="w-full text-right font-mono text-xs text-text-muted px-1.5 py-0.5 line-through">
            {line.unitWattage 
              ? `₹${new Intl.NumberFormat('en-IN').format(line.effectiveRate / line.unitWattage)}/W`
              : `₹${new Intl.NumberFormat('en-IN').format(line.effectiveRate)}`}
          </div>
        ) : (
          <InlineCell
            value={line.unitWattage ? line.effectiveRate / line.unitWattage : line.effectiveRate}
            onCommit={(v) => onOverrideRate(line.index, line.unitWattage ? v * line.unitWattage : v)}
            isRate={!line.unitWattage}
            format={line.unitWattage ? (v) => `₹${new Intl.NumberFormat('en-IN').format(v)}/W` : undefined}
          />
        )}
      </td>

      {/* Total */}
      <td className={`py-2 px-2 text-xs font-mono text-right w-28 ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-primary'} ${dimClass}`}>
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
      <td className={`py-1 px-1 w-16 ${dimClass}`}>
        {line.isDisabled ? (
          <div className="w-full text-right font-mono text-xs text-text-muted px-1.5 py-0.5 line-through">
            {`${roundTo5(line.effectiveGstPct * 100)}%`}
          </div>
        ) : (
          <InlineCell
            value={roundTo5(line.effectiveGstPct * 100)}
            onCommit={(v) => onOverrideGst(line.index, roundTo5(v / 100))}
            format={(v) => `${roundTo5(v)}%`}
          />
        )}
      </td>

      {/* GST Amt */}
      <td className={`py-2 px-2 text-xs font-mono text-right w-24 ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-muted'} ${dimClass}`}>
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
      <td className={`py-2 px-2 text-xs font-mono text-right font-semibold w-28 ${line.isDisabled ? 'text-text-muted font-normal' : 'text-text-primary'} ${dimClass}`}>
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

      <td className={`py-2 px-2 text-center w-10 ${dimClass}`}>
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
  mode,
  amount,
  value,
  onModeChange,
  onAmountChange,
  onChange,
}: {
  mode: 'percent' | 'flat';
  amount: number;
  value: number; // as decimal, e.g. 0.20
  onModeChange: (mode: 'percent' | 'flat') => void;
  onAmountChange: (val: number | null) => void;
  onChange: (val: number | null) => void;
}) {
  const pctValue = Math.round(value * 100);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background/70 p-1">
        <button
          type="button"
          onClick={() => onModeChange('percent')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'percent' ? 'bg-surface-active text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          <Percent size={13} />
          % Margin
        </button>
        <button
          type="button"
          onClick={() => onModeChange('flat')}
          className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'flat' ? 'bg-surface-active text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
          }`}
        >
          <IndianRupee size={13} />
          Flat Amount
        </button>
      </div>

      {mode === 'percent' ? (
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
              type="button"
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
                MRP excl GST = Cost + (Cost x Margin%)
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Amount (₹)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={amount || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onAmountChange(Number.isFinite(v) && v >= 0 ? v : 0);
            }}
            className="flex-1 px-3 py-2 rounded-md bg-background border border-border
              text-sm font-mono text-right text-text-primary
              focus:outline-none focus:border-accent/40"
            placeholder="0"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main BOM Table Component ───────────────────────────────────────────────────

export function BOMTable() {
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const marginMode = useCalculatorStore((s) => s.marginMode);
  const targetMarginPct = useCalculatorStore((s) => s.targetMarginPct);
  const targetMarginAmount = useCalculatorStore((s) => s.targetMarginAmount);
  const roundOffToThousand = useCalculatorStore((s) => s.roundOffToThousand);
  const setRoundOffToThousand = useCalculatorStore((s) => s.setRoundOffToThousand);
  const projectType = useCalculatorStore((s) => s.projectType);
  const panelMix = useCalculatorStore((s) => s.panelMix);
  const selectedPanelId = useCalculatorStore((s) => s.selectedPanelId);
  const setRowOverride = useCalculatorStore((s) => s.setRowOverride);
  const clearRowOverride = useCalculatorStore((s) => s.clearRowOverride);
  const setMarginMode = useCalculatorStore((s) => s.setMarginMode);
  const setMarginOverride = useCalculatorStore((s) => s.setMarginOverride);
  const setMarginAmountOverride = useCalculatorStore((s) => s.setMarginAmountOverride);
  const removeCustomItem = useCalculatorStore((s) => s.removeCustomItem);
  const toggleItemSelection = useCalculatorStore((s) => s.toggleItemSelection);
  const dcCableLengthM = useCalculatorStore((s) => s.dcCableLengthM);
  const acCableLengthM = useCalculatorStore((s) => s.acCableLengthM);
  const setCableLengths = useCalculatorStore((s) => s.setCableLengths);
  const dbMeters = useCalculatorStore((s) => s.dbMeters);
  const dbLAs = useCalculatorStore((s) => s.dbLAs);
  const solarMeterId = useCalculatorStore((s) => s.solarMeterId);
  const netMeterId = useCalculatorStore((s) => s.netMeterId);
  const lightningArresterId = useCalculatorStore((s) => s.lightningArresterId);
  const setMeterSelection = useCalculatorStore((s) => s.setMeterSelection);
  const setLASelection = useCalculatorStore((s) => s.setLASelection);
  const { settings } = useSettings();
  const { toast } = useToast();

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedPanelRows, setExpandedPanelRows] = useState<Set<number>>(new Set());

  // Inline Add Custom Item State
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemRemarks, setNewItemRemarks] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('Nos');
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

  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);
  const selectedInverterMix = useCalculatorStore((s) => s.selectedInverterMix);
  const selectedBatteryMix = useCalculatorStore((s) => s.selectedBatteryMix);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);

  const panelCatalog = useMemo(() => {
    const base = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
    const rateOverrides = settings?.currentEquipmentRates?.panels ?? {};
    const allPanels = [...base, ...(settings?.customPanels ?? [])].map((panel) => ({
      ...panel,
      ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
    }));
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
  }, [dbLoaded, dbPanels, settings]);

  const inverterCatalog = useMemo(() => {
    const base = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
    return [...base, ...(settings?.customInverters ?? [])];
  }, [dbLoaded, dbInverters, settings]);

  const batteryCatalog = useMemo(() => {
    const base = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];
    return [...base, ...(settings?.customBatteries ?? [])];
  }, [dbLoaded, dbBatteries, settings]);

  const panelLabel = useMemo(() => {
    const mixEntries = Object.entries(panelMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (mixEntries.length > 0) {
      return mixEntries.map(([id]) => {
        const p = panelCatalog.get(id);
        return p ? `${p.brand} ${p.model}` : id;
      }).join(' + ');
    }
    if (selectedPanelId) {
      const p = panelCatalog.get(selectedPanelId);
      return p ? `${p.brand} ${p.model}` : selectedPanelId;
    }
    return '';
  }, [panelMix, selectedPanelId, panelCatalog]);

  const inverterLabel = useMemo(() => {
    const mixEntries = Object.entries(selectedInverterMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (mixEntries.length > 0) {
      return mixEntries.map(([id]) => {
        const inv = inverterCatalog.find(i => i.id === id);
        return inv ? `${inv.brand} ${inv.model}` : id;
      }).join(' + ');
    }
    return '';
  }, [selectedInverterMix, inverterCatalog]);

  const batteryLabel = useMemo(() => {
    const mixEntries = Object.entries(selectedBatteryMix).filter(([, qty]) => Number.isFinite(qty) && qty > 0);
    if (mixEntries.length > 0) {
      return mixEntries.map(([id]) => {
        const bat = batteryCatalog.find(b => b.id === id);
        return bat ? `${bat.brand} ${bat.model}` : id;
      }).join(' + ');
    }
    return '';
  }, [selectedBatteryMix, batteryCatalog]);

  // Group the BOM lines
  const groups = useMemo(
    () => (calcResult ? groupLines(calcResult.lines) : []),
    [calcResult],
  );

  const inventorySummary = useCalculatorStore((s) => s.inventorySummary);

  const totalBuyingPrice = useMemo(() => {
    if (!calcResult) return 0;
    return calcResult.lines.reduce((sum, line) => {
      const inv = inventorySummary.find(i => i.item_description.toUpperCase() === line.description.toUpperCase());
      return sum + (line.effectiveQty * (inv?.weighted_avg_cost || 0));
    }, 0);
  }, [calcResult, inventorySummary]);

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

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm" id="bom-table">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-active flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-text-primary tracking-widest uppercase">Bill of Materials</h3>
          <span className="text-[10px] font-mono font-medium bg-background px-2 py-0.5 rounded text-text-muted">
            {calcResult ? calcResult.lines.length : 0} items
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={roundOffToThousand}
          onClick={() => setRoundOffToThousand(!roundOffToThousand)}
          className="flex items-center gap-3 rounded-lg border border-border bg-background/70 px-3 py-2 text-left hover:border-accent/40 transition-colors"
        >
          <span className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">Round Pricing</span>
            <span className="text-[10px] text-text-muted">Nearest 1000</span>
          </span>
          <span
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              roundOffToThousand ? 'bg-accent' : 'bg-border'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                roundOffToThousand ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-background/60 sticky top-0 z-10">
            <tr className="border-b border-border">
              <th className="py-2.5 px-2 text-center text-text-muted font-medium w-12">#</th>
              <th className="py-2.5 px-2 text-left text-text-muted font-medium">Description</th>
              <th className="py-2.5 px-2 text-left text-text-muted font-medium w-56">Remarks</th>
              <th className="py-2.5 px-2 text-center text-text-muted font-medium w-14">Unit</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-16">Qty</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-28">Rate/Unit</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-28">Total</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-16">GST%</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-24">GST Amt</th>
              <th className="py-2.5 px-2 text-right text-text-muted font-medium w-28">SubTotal</th>
              <th className="py-2.5 px-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {!calcResult && (
              <tr>
                <td colSpan={11} className="py-8 text-center text-text-muted">
                  {dbLoaded ? "Select components to build your quote." : "Loading master data…"}
                </td>
              </tr>
            )}
            {calcResult && groups.map((group) => {
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
                      let displayName: string | undefined;
                      if (isPanelLine) {
                        displayName = panelLabel ? `PANEL (${panelLabel})` : 'PANEL';
                      } else if (line.description.toUpperCase() === 'INVERTER') {
                        displayName = inverterLabel ? `INVERTER (${inverterLabel})` : 'INVERTER';
                      } else if (line.description.toUpperCase() === 'BATTERY') {
                        displayName = batteryLabel ? `BATTERY (${batteryLabel})` : 'BATTERY';
                      }
                      return (
                        <React.Fragment key={line.index}>
                          <BOMRow
                            line={line}
                            displayName={displayName}
                            onOverrideQty={handleOverrideQty}
                            onOverrideRate={handleOverrideRate}
                            onOverrideGst={handleOverrideGst}
                            onClearOverride={clearRowOverride}
                            onRemoveCustomItem={removeCustomItem}
                            onToggleItemSelection={toggleItemSelection}
                            isPanelInteractive={isPanelLine}
                            panelExpanded={isPanelExpanded}
                            onTogglePanelDetails={
                              isPanelLine ? togglePanelRow : undefined
                            }
                            inventorySummary={inventorySummary}
                            dbMeters={dbMeters}
                            dbLAs={dbLAs}
                            solarMeterId={solarMeterId}
                            netMeterId={netMeterId}
                            lightningArresterId={lightningArresterId}
                            onSelectMeter={setMeterSelection}
                            onSelectLA={setLASelection}
                          />
                          {!isCollapsed && isPanelLine && isPanelExpanded && (
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
            {calcResult && (isAddingItem ? (
              <tr className="bg-accent/5 border-b border-accent/20">
                <td colSpan={11} className="py-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-2">
                    {/* Description */}
                    <div className="col-span-2">
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">Description *</label>
                      <input
                        type="text"
                        placeholder="e.g. SOLAR METER"
                        value={newItemDesc}
                        onChange={e => setNewItemDesc(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                        autoFocus
                      />
                    </div>
                    {/* Quote specification */}
                    <div className="col-span-2">
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">Specification Details</label>
                      <input
                        type="text"
                        placeholder="Certifications, warranty, rating"
                        value={newItemRemarks}
                        onChange={e => setNewItemRemarks(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">Unit</label>
                      <Select
                        size="sm"
                        value={newItemUnit}
                        onChange={setNewItemUnit}
                        options={[
                          { value: 'Nos', label: 'Nos' },
                          { value: 'Set', label: 'Set' },
                          { value: 'Mtr', label: 'Mtr' },
                          { value: 'Rmt', label: 'Rmt' },
                          { value: 'kg', label: 'kg' },
                          { value: 'Ltr', label: 'Ltr' },
                          { value: 'Lot', label: 'Lot' },
                          { value: 'LS', label: 'LS' },
                        ]}
                      />
                    </div>
                    {/* Qty */}
                    <div>
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">Qty *</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={newItemQty}
                        onChange={e => setNewItemQty(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
                    {/* Rate */}
                    <div>
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">Selling Rate (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        min="0"
                        value={newItemRate}
                        onChange={e => setNewItemRate(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                      />
                    </div>
                    {/* GST */}
                    <div>
                      <label className="block text-[9px] text-text-muted uppercase font-semibold mb-1">GST %</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItemGst}
                        onChange={e => setNewItemGst(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-xs text-right text-text-primary focus:border-accent focus:outline-none"
                        placeholder="18"
                      />
                    </div>
                    {/* Actions */}
                    <div className="col-span-4 flex items-end gap-2 justify-end">
                      <button
                        onClick={() => {
                          const descNormalized = newItemDesc.trim().toLowerCase();
                          if (!descNormalized) { setIsAddingItem(false); return; }
                          const hasDuplicate = calcResult.lines.some((line) => line.description.trim().toLowerCase() === descNormalized);
                          if (hasDuplicate) return toast('An item with the same description already exists.', 'error');
                          const qty = parseFloat(newItemQty) || 0;
                          const rate = parseFloat(newItemRate) || 0;
                          const gst = normalizeGstRate(newItemGst, 0.18);
                          if (qty > 0 && rate >= 0) {
                            useCalculatorStore.getState().addCustomItem({
                              description: newItemDesc.trim(),
                              remarks: newItemRemarks.trim() || undefined,
                              qty, ratePerUnit: rate, gstPct: gst, unit: newItemUnit
                            });
                          }
                          setIsAddingItem(false);
                          setNewItemDesc(''); setNewItemRemarks(''); setNewItemUnit('Nos');
                          setNewItemQty(''); setNewItemRate(''); setNewItemGst('18');
                        }}
                        className="px-3 py-1.5 bg-accent text-background rounded hover:bg-accent-hover transition-colors font-semibold text-xs"
                      >
                        + Add to BOM
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingItem(false);
                          setNewItemDesc(''); setNewItemRemarks(''); setNewItemUnit('Nos');
                          setNewItemQty(''); setNewItemRate(''); setNewItemGst('18');
                        }}
                        className="px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-text-primary rounded transition-colors font-semibold text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
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
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Footer: Aggregates ────────────────────────────────────────────── */}
      {calcResult && (
        <div className="border-t border-border bg-background/40">
          {/* Cost aggregates */}
          <div className="px-4 py-3 space-y-2">
          <FooterRow label="Procurement Cost (Base)" value={formatINR(calcResult.costBeforeGST)} />
          <FooterRow label="Input GST (ITC)" value={formatINR(calcResult.totalInputGST)} muted />
          <FooterRow label="Total Procurement Cost" value={formatINR(calcResult.totalIncGST)} bold />
          <FooterRow label="Total Buying Price (WAC)" value={formatINR(totalBuyingPrice)} success />
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
              mode={marginMode}
              amount={targetMarginAmount ?? calcResult.marginAmount}
              value={targetMarginPct ?? calcResult.effectiveMarginPct}
              onModeChange={setMarginMode}
              onAmountChange={setMarginAmountOverride}
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
          <div title="Composite rate applicable under GST Works Contract scheme. Subject to revision. Verify with CA before final invoicing.">
            <FooterRow
              label={projectType === 'commercial' 
                ? `GST @ ${(calcResult.gstOutputRate * 100).toFixed(1)}% (Commercial — ITC Eligible)` 
                : `GST @ ${(calcResult.gstOutputRate * 100).toFixed(1)}% (Composite Rate)`}
              value={formatINR(calcResult.mrpInclGST - calcResult.mrpExclGST)}
              muted
            />
          </div>
          <FooterRow label="MRP (incl GST)" value={formatINR(calcResult.mrpInclGST)} gold />
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Customer pricing */}
        <div className="px-4 py-3 space-y-2">
          <FooterRow label="Discount" value={`-${formatINR(calcResult.discountAmount)}`} muted={calcResult.discountAmount === 0} />
          <FooterRow label="Additional Costs" value={`+${formatINR(calcResult.additionalCostTotal)}`} muted={calcResult.additionalCostTotal === 0} />
          <FooterRow label="Final Customer Price" value={formatINR(calcResult.finalCustomerPrice)} gold />
          {calcResult.roundOffToThousand && calcResult.roundOffAdjustment !== 0 && (
            <p className="text-[10px] text-text-muted text-right">
              Rounded to nearest 1000; adjustment included in total panel price.
            </p>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border/60" />

        {/* Per-kW analysis */}
        <div className="px-4 py-3 space-y-2">
          <FooterRow label="Per kW (excl GST)" value={formatINR(calcResult.perKWexclGST)} />
          <FooterRow label="Per kW (incl GST)" value={formatINR(calcResult.perKWinclGST)} bold />
        </div>
      </div>
      )}
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
  success,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  accent?: boolean;
  gold?: boolean;
  success?: boolean;
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
            : success
            ? 'text-success font-bold'
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

