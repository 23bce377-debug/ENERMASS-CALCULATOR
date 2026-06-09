'use client';

import { useState, useMemo } from 'react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { SYSTEMS, type SolarSystem } from '@/lib/data/bom';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';
import { useConfirm } from '@/components/ui/Confirm';
import {
  BarChart3,
  RotateCcw,
  Search,
  ToggleLeft,
  ToggleRight,
  Sun,
  Cpu,
  Battery,
  Loader2,
  CloudUpload,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table';

// ─── Collect Unique BOM Descriptions ────────────────────────────────────────────

interface BomDescEntry {
  description: string;
  defaultRate: number; // average across all systems
  systems: number;     // how many systems use this item
}

function getUniqueBomDescriptions(systems: SolarSystem[]): BomDescEntry[] {
  const map = new Map<string, { totalRate: number; count: number }>();

  for (const sys of systems) {
    for (const item of sys.items) {
      const existing = map.get(item.description);
      if (existing) {
        existing.totalRate += item.ratePerUnit;
        existing.count += 1;
      } else {
        map.set(item.description, { totalRate: item.ratePerUnit, count: 1 });
      }
    }
  }

  return Array.from(map.entries()).map(([description, { totalRate, count }]) => ({
    description,
    defaultRate: totalRate / count,
    systems: count,
  }));
}

// ─── Sort Indicator Helper ──────────────────────────────────────────────────────

function renderSortIndicator(column: any) {
  if (!column.getCanSort()) return null;
  const sorted = column.getIsSorted();
  if (sorted === 'asc') return <span className="ml-1 text-accent text-[10px]">▲</span>;
  if (sorted === 'desc') return <span className="ml-1 text-accent text-[10px]">▼</span>;
  return <span className="ml-1 text-text-muted/30 group-hover:text-text-muted/80 text-[10px] transition-colors">↕</span>;
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function RateMasterPage() {
  const rateMaster = useCalculatorStore((s) => s.rateMaster);
  const setRateMaster = useCalculatorStore((s) => s.setRateMaster);
  const dbSystems = useCalculatorStore((s) => s.dbSystems);
  const dbLoaded = useCalculatorStore((s) => s.dbLoaded);
  const dbPanels = useCalculatorStore((s) => s.dbPanels);
  const dbInverters = useCalculatorStore((s) => s.dbInverters);
  const dbBatteries = useCalculatorStore((s) => s.dbBatteries);
  const { settings, setSettings, commitRateMasterToDb, isSyncing } = useSettings();
  const confirm = useConfirm();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'bom' | 'panels' | 'inverters' | 'batteries'>('bom');
  const [search, setSearch] = useState('');

  // Sorting States
  const [bomSorting, setBomSorting] = useState<SortingState>([]);
  const [panelSorting, setPanelSorting] = useState<SortingState>([]);
  const [inverterSorting, setInverterSorting] = useState<SortingState>([]);
  const [batterySorting, setBatterySorting] = useState<SortingState>([]);

  // Standard BOM Categories Data
  const allBomDescriptions = useMemo(() => {
    const systems = dbLoaded && dbSystems.length > 0 ? dbSystems : SYSTEMS;
    return getUniqueBomDescriptions(systems).filter(
      (item) => !['PANEL', 'INVERTER', 'BATTERY'].includes(item.description.toUpperCase())
    );
  }, [dbLoaded, dbSystems]);

  // Specific Equipment Data
  const panelCatalog = useMemo(() => {
    const base = dbLoaded && dbPanels.length > 0 ? dbPanels : [];
    const rateOverrides = settings?.currentEquipmentRates?.panels ?? {};
    return [...base, ...(settings?.customPanels ?? [])].map((panel) => ({
      ...panel,
      ratePerWatt: rateOverrides[panel.id] ?? panel.ratePerWatt,
    }));
  }, [dbLoaded, dbPanels, settings]);

  const inverterCatalog = useMemo(() => {
    const base = dbLoaded && dbInverters.length > 0 ? dbInverters : [];
    const rateOverrides = settings?.currentEquipmentRates?.inverters ?? {};
    return [...base, ...(settings?.customInverters ?? [])].map((inverter) => ({
      ...inverter,
      rate: rateOverrides[inverter.id] ?? inverter.rate,
    }));
  }, [dbLoaded, dbInverters, settings]);

  const batteryCatalog = useMemo(() => {
    const base = dbLoaded && dbBatteries.length > 0 ? dbBatteries : [];
    const rateOverrides = settings?.currentEquipmentRates?.batteries ?? {};
    return [...base, ...(settings?.customBatteries ?? [])].map((battery) => ({
      ...battery,
      rate: rateOverrides[battery.id] ?? battery.rate,
    }));
  }, [dbLoaded, dbBatteries, settings]);

  // Find defaults for specific brand comparison
  const defaultPanelById = useMemo(() => new Map(dbPanels.map(p => [p.id, p])), [dbPanels]);
  const defaultInverterById = useMemo(() => new Map(dbInverters.map(i => [i.id, i])), [dbInverters]);
  const defaultBatteryById = useMemo(() => new Map(dbBatteries.map(b => [b.id, b])), [dbBatteries]);

  // Overrides counters
  const activeBomCount = useMemo(
    () => Object.values(rateMaster).filter((v) => v.active).length,
    [rateMaster],
  );

  const activePanelsCount = useMemo(
    () => Object.keys(settings.currentEquipmentRates?.panels || {}).length,
    [settings.currentEquipmentRates?.panels],
  );

  const activeInvertersCount = useMemo(
    () => Object.keys(settings.currentEquipmentRates?.inverters || {}).length,
    [settings.currentEquipmentRates?.inverters],
  );

  const activeBatteriesCount = useMemo(
    () => Object.keys(settings.currentEquipmentRates?.batteries || {}).length,
    [settings.currentEquipmentRates?.batteries],
  );

  const totalActiveOverrides = activeBomCount + activePanelsCount + activeInvertersCount + activeBatteriesCount;

  // ─── Actions & Handlers ────────────────────────────────────────────────────────

  const handleCommit = async () => {
    const error = await commitRateMasterToDb();
    if (error) {
      toast(`Commit failed: ${error}`, 'error');
    } else {
      toast('Rates committed to database successfully ✓', 'success');
    }
  };

  const handleResetAll = async () => {
    const confirmed = await confirm({
      title: 'Reset All Rate Master Overrides?',
      message: 'This will reset all customized pricing rates, including specific panel brands, power inverter models, battery units, and general BOM category overrides, back to their baseline factory defaults.',
      confirmLabel: 'Reset All Rates',
      cancelLabel: 'Keep Current Rates',
      type: 'warning',
    });
    if (!confirmed) return;
    useCalculatorStore.setState({ rateMaster: {} });
    setSettings({
      currentEquipmentRates: {
        panels: {},
        inverters: {},
        batteries: {},
      },
    });
  };

  const handleBomToggle = (desc: string) => {
    const current = rateMaster[desc];
    const defaultEntry = allBomDescriptions.find((d) => d.description === desc);
    if (current) {
      setRateMaster(desc, current.rate, !current.active);
    } else {
      setRateMaster(desc, defaultEntry?.defaultRate ?? 0, true);
    }
  };

  const handleBomRateChange = (desc: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const current = rateMaster[desc];
    setRateMaster(desc, num, current?.active ?? false);
  };

  const handleEquipmentRateChange = (
    category: 'panels' | 'inverters' | 'batteries',
    id: string,
    value: string,
  ) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;

    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        [category]: {
          ...settings.currentEquipmentRates[category],
          [id]: num,
        },
      },
    });
  };

  const handleRemoveEquipmentOverride = (
    category: 'panels' | 'inverters' | 'batteries',
    id: string,
  ) => {
    const nextRates = { ...settings.currentEquipmentRates?.[category] };
    delete nextRates[id];

    setSettings({
      currentEquipmentRates: {
        ...settings.currentEquipmentRates,
        [category]: nextRates,
      },
    });
  };

  // Keyboard navigation for spreadsheet grid
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.querySelector(`input[data-row="${rowIndex + 1}"]`) as HTMLInputElement | null;
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.querySelector(`input[data-row="${rowIndex - 1}"]`) as HTMLInputElement | null;
      if (prevInput) prevInput.focus();
    }
  };

  // ─── Column Helpers & Definitions ──────────────────────────────────────────────

  const bomColumnHelper = createColumnHelper<BomDescEntry>();
  const bomColumns = useMemo(() => [
    bomColumnHelper.accessor('description', {
      header: 'BOM Component Description',
      cell: info => {
        const desc = info.getValue();
        const isActive = rateMaster[desc]?.active ?? false;
        return (
          <span className={`font-semibold ${isActive ? 'text-accent' : 'text-text-primary'}`}>
            {desc}
          </span>
        );
      }
    }),
    bomColumnHelper.accessor('systems', {
      header: 'Usage Systems',
      cell: info => <span className="text-text-muted">{info.getValue()} systems</span>,
    }),
    bomColumnHelper.accessor('defaultRate', {
      header: 'Baseline Cost',
      cell: info => <span className="font-mono text-text-secondary">{formatINR(info.getValue())}</span>,
    }),
    bomColumnHelper.display({
      id: 'rateOverride',
      header: 'Master Override Rate',
      cell: props => {
        const entry = props.row.original;
        const master = rateMaster[entry.description];
        const isActive = master?.active ?? false;
        const masterRate = master?.rate ?? entry.defaultRate;
        return (
          <div className="flex items-center justify-end">
            <input
              type="number"
              value={masterRate}
              onChange={(e) => handleBomRateChange(entry.description, e.target.value)}
              min={0}
              step={10}
              data-row={props.row.index}
              onKeyDown={(e) => handleKeyDown(e, props.row.index)}
              className={`w-full min-w-[180px] md:min-w-[210px] text-right px-3 py-1.5 rounded-lg bg-background border text-sm font-mono outline-none transition-all
                ${isActive
                  ? 'border-accent/40 text-accent focus:border-accent focus:ring-1 focus:ring-accent/20'
                  : 'border-border text-text-secondary focus:border-border-light'
                }`}
            />
          </div>
        );
      }
    }),
    bomColumnHelper.display({
      id: 'active',
      header: 'Active',
      cell: props => {
        const entry = props.row.original;
        const isActive = rateMaster[entry.description]?.active ?? false;
        return (
          <button
            onClick={() => handleBomToggle(entry.description)}
            className="transition-all hover:scale-110"
            aria-label={isActive ? 'Deactivate' : 'Activate'}
          >
            {isActive ? (
              <ToggleRight size={28} className="text-accent" />
            ) : (
              <ToggleLeft size={28} className="text-text-muted" />
            )}
          </button>
        );
      }
    })
  ], [rateMaster, allBomDescriptions]);

  const panelColumnHelper = createColumnHelper<any>();
  const panelColumns = useMemo(() => [
    panelColumnHelper.display({
      id: 'brandModel',
      header: 'Panel Brand & Model',
      sortingFn: (rowA, rowB) => rowA.original.brand.localeCompare(rowB.original.brand),
      cell: props => {
        const panel = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.panels?.[panel.id] !== undefined;
        return (
          <div>
            <div className={`font-semibold ${isOverridden ? 'text-accent' : 'text-text-primary'}`}>
              {panel.brand}
            </div>
            <div className="text-xs text-text-muted">{panel.model}</div>
          </div>
        );
      }
    }),
    panelColumnHelper.display({
      id: 'specs',
      header: 'Specs',
      cell: props => {
        const panel = props.row.original;
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info/10 text-info border border-info/20">
            {panel.wattage}W · {panel.type}
          </span>
        );
      }
    }),
    panelColumnHelper.accessor('ratePerWatt', {
      header: 'Default Rate',
      cell: props => {
        const panel = props.row.original;
        const defaultRate = defaultPanelById.get(panel.id)?.ratePerWatt ?? panel.ratePerWatt;
        return <span className="font-mono text-text-secondary">₹{defaultRate.toFixed(2)} / W</span>;
      }
    }),
    panelColumnHelper.display({
      id: 'rateOverride',
      header: 'Master Selling Rate',
      cell: props => {
        const panel = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.panels?.[panel.id] !== undefined;
        return (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              value={panel.ratePerWatt}
              onChange={(e) => handleEquipmentRateChange('panels', panel.id, e.target.value)}
              min={0}
              step={0.1}
              data-row={props.row.index}
              onKeyDown={(e) => handleKeyDown(e, props.row.index)}
              className={`w-full min-w-[150px] text-right px-3 py-1.5 rounded-lg bg-background border text-sm font-mono outline-none transition-all
                ${isOverridden
                  ? 'border-accent/40 text-accent focus:border-accent focus:ring-1 focus:ring-accent/20'
                  : 'border-border text-text-secondary focus:border-border-light'
                }`}
            />
            <span className="text-xs text-text-muted w-10 text-left">₹/W</span>
          </div>
        );
      }
    }),
    panelColumnHelper.display({
      id: 'perPanelRate',
      header: '₹/Panel',
      cell: props => {
        const panel = props.row.original;
        const defaultRate = defaultPanelById.get(panel.id)?.ratePerWatt ?? panel.ratePerWatt;
        const isOverridden = settings.currentEquipmentRates?.panels?.[panel.id] !== undefined;
        return (
          <div className="flex flex-col items-end">
            {isOverridden && (
              <span className="text-[10px] text-text-muted line-through">
                {formatINR(defaultRate * panel.wattage)}
              </span>
            )}
            <span className={`font-semibold ${isOverridden ? 'text-warning' : 'text-text-primary'}`}>
              {formatINR(panel.ratePerWatt * panel.wattage)}
            </span>
          </div>
        );
      }
    }),
    panelColumnHelper.display({
      id: 'overridden',
      header: 'Overridden',
      cell: props => {
        const panel = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.panels?.[panel.id] !== undefined;
        return isOverridden ? (
          <button
            onClick={() => handleRemoveEquipmentOverride('panels', panel.id)}
            className="px-2.5 py-1 text-xs font-semibold text-error bg-error/10 border border-error/20 rounded-md hover:bg-error hover:text-background transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        ) : (
          <span className="text-xs text-text-muted font-mono">—</span>
        );
      }
    })
  ], [settings.currentEquipmentRates?.panels, panelCatalog]);

  const inverterColumnHelper = createColumnHelper<any>();
  const inverterColumns = useMemo(() => [
    inverterColumnHelper.display({
      id: 'brandModel',
      header: 'Inverter Brand & Model',
      sortingFn: (rowA, rowB) => rowA.original.brand.localeCompare(rowB.original.brand),
      cell: props => {
        const inverter = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.inverters?.[inverter.id] !== undefined;
        return (
          <div>
            <div className={`font-semibold ${isOverridden ? 'text-accent' : 'text-text-primary'}`}>
              {inverter.brand}
            </div>
            <div className="text-xs text-text-muted">{inverter.model}</div>
          </div>
        );
      }
    }),
    inverterColumnHelper.display({
      id: 'specs',
      header: 'Specs',
      cell: props => {
        const inverter = props.row.original;
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info/10 text-info border border-info/20 uppercase">
            {inverter.capacityKW} kW · {inverter.type}
          </span>
        );
      }
    }),
    inverterColumnHelper.accessor('rate', {
      header: 'Default Rate',
      cell: props => {
        const inverter = props.row.original;
        const defaultRate = defaultInverterById.get(inverter.id)?.rate ?? inverter.rate;
        return <span className="font-mono text-text-secondary">{formatINR(defaultRate)}</span>;
      }
    }),
    inverterColumnHelper.display({
      id: 'rateOverride',
      header: 'Master Selling Price',
      cell: props => {
        const inverter = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.inverters?.[inverter.id] !== undefined;
        return (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              value={inverter.rate}
              onChange={(e) => handleEquipmentRateChange('inverters', inverter.id, e.target.value)}
              min={0}
              step={100}
              data-row={props.row.index}
              onKeyDown={(e) => handleKeyDown(e, props.row.index)}
              className={`w-full min-w-[150px] text-right px-3 py-1.5 rounded-lg bg-background border text-sm font-mono outline-none transition-all
                ${isOverridden
                  ? 'border-accent/40 text-accent focus:border-accent focus:ring-1 focus:ring-accent/20'
                  : 'border-border text-text-secondary focus:border-border-light'
                }`}
            />
            <span className="text-xs text-text-muted w-10 text-left">₹</span>
          </div>
        );
      }
    }),
    inverterColumnHelper.display({
      id: 'overridden',
      header: 'Overridden',
      cell: props => {
        const inverter = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.inverters?.[inverter.id] !== undefined;
        return isOverridden ? (
          <button
            onClick={() => handleRemoveEquipmentOverride('inverters', inverter.id)}
            className="px-2.5 py-1 text-xs font-semibold text-error bg-error/10 border border-error/20 rounded-md hover:bg-error hover:text-background transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        ) : (
          <span className="text-xs text-text-muted font-mono">—</span>
        );
      }
    })
  ], [settings.currentEquipmentRates?.inverters, inverterCatalog]);

  const batteryColumnHelper = createColumnHelper<any>();
  const batteryColumns = useMemo(() => [
    batteryColumnHelper.display({
      id: 'brandModel',
      header: 'Battery Brand & Model',
      sortingFn: (rowA, rowB) => rowA.original.brand.localeCompare(rowB.original.brand),
      cell: props => {
        const battery = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.batteries?.[battery.id] !== undefined;
        return (
          <div>
            <div className={`font-semibold ${isOverridden ? 'text-accent' : 'text-text-primary'}`}>
              {battery.brand}
            </div>
            <div className="text-xs text-text-muted">{battery.model}</div>
          </div>
        );
      }
    }),
    batteryColumnHelper.display({
      id: 'specs',
      header: 'Specs',
      cell: props => {
        const battery = props.row.original;
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-info/10 text-info border border-info/20">
            {battery.capacityKWh} kWh · {battery.chemistry}
          </span>
        );
      }
    }),
    batteryColumnHelper.accessor('rate', {
      header: 'Default Rate',
      cell: props => {
        const battery = props.row.original;
        const defaultRate = defaultBatteryById.get(battery.id)?.rate ?? battery.rate;
        return <span className="font-mono text-text-secondary">{formatINR(defaultRate)}</span>;
      }
    }),
    batteryColumnHelper.display({
      id: 'rateOverride',
      header: 'Master Selling Price',
      cell: props => {
        const battery = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.batteries?.[battery.id] !== undefined;
        return (
          <div className="flex items-center justify-end gap-2">
            <input
              type="number"
              value={battery.rate}
              onChange={(e) => handleEquipmentRateChange('batteries', battery.id, e.target.value)}
              min={0}
              step={100}
              data-row={props.row.index}
              onKeyDown={(e) => handleKeyDown(e, props.row.index)}
              className={`w-full min-w-[150px] text-right px-3 py-1.5 rounded-lg bg-background border text-sm font-mono outline-none transition-all
                ${isOverridden
                  ? 'border-accent/40 text-accent focus:border-accent focus:ring-1 focus:ring-accent/20'
                  : 'border-border text-text-secondary focus:border-border-light'
                }`}
            />
            <span className="text-xs text-text-muted w-10 text-left">₹</span>
          </div>
        );
      }
    }),
    batteryColumnHelper.display({
      id: 'overridden',
      header: 'Overridden',
      cell: props => {
        const battery = props.row.original;
        const isOverridden = settings.currentEquipmentRates?.batteries?.[battery.id] !== undefined;
        return isOverridden ? (
          <button
            onClick={() => handleRemoveEquipmentOverride('batteries', battery.id)}
            className="px-2.5 py-1 text-xs font-semibold text-error bg-error/10 border border-error/20 rounded-md hover:bg-error hover:text-background transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        ) : (
          <span className="text-xs text-text-muted font-mono">—</span>
        );
      }
    })
  ], [settings.currentEquipmentRates?.batteries, batteryCatalog]);

  // ─── Table Hooks Initialization ───────────────────────────────────────────────

  const bomTable = useReactTable({
    data: allBomDescriptions,
    columns: bomColumns,
    state: {
      sorting: bomSorting,
      globalFilter: search,
    },
    onSortingChange: setBomSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, value) => {
      const q = String(value).toLowerCase();
      return String(row.original.description).toLowerCase().includes(q);
    },
  });

  const panelTable = useReactTable({
    data: panelCatalog,
    columns: panelColumns,
    state: {
      sorting: panelSorting,
      globalFilter: search,
    },
    onSortingChange: setPanelSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, value) => {
      const q = String(value).toLowerCase();
      return String(row.original.brand).toLowerCase().includes(q) ||
             String(row.original.model).toLowerCase().includes(q);
    },
  });

  const inverterTable = useReactTable({
    data: inverterCatalog,
    columns: inverterColumns,
    state: {
      sorting: inverterSorting,
      globalFilter: search,
    },
    onSortingChange: setInverterSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, value) => {
      const q = String(value).toLowerCase();
      return String(row.original.brand).toLowerCase().includes(q) ||
             String(row.original.model).toLowerCase().includes(q);
    },
  });

  const batteryTable = useReactTable({
    data: batteryCatalog,
    columns: batteryColumns,
    state: {
      sorting: batterySorting,
      globalFilter: search,
    },
    onSortingChange: setBatterySorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, value) => {
      const q = String(value).toLowerCase();
      return String(row.original.brand).toLowerCase().includes(q) ||
             String(row.original.model).toLowerCase().includes(q);
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <BarChart3 size={24} className="text-accent" />
            Rate Master
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Global baseline and specific equipment rate management command center
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Overrides Counter */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-glow border border-accent/20">
            <span className="text-lg font-bold text-accent">{totalActiveOverrides}</span>
            <span className="text-xs text-text-muted">active overrides</span>
          </div>

          <button
            onClick={handleCommit}
            disabled={isSyncing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-background text-sm font-semibold hover:bg-accent-hover transition-all shadow-md shadow-accent/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CloudUpload size={16} />
            )}
            {isSyncing ? 'Committing...' : 'Commit to DB'}
          </button>

          <button
            onClick={handleResetAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-error hover:border-error/30 transition-all"
          >
            <RotateCcw size={14} /> Reset All
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-border bg-surface rounded-xl overflow-hidden max-w-fit">
        <button
          onClick={() => { setActiveTab('bom'); setSearch(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all
            ${activeTab === 'bom'
              ? 'text-accent bg-accent-glow border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border-b-2 border-transparent'
            }`}
        >
          <BarChart3 size={15} />
          BOM Categories ({allBomDescriptions.length})
        </button>
        <button
          onClick={() => { setActiveTab('panels'); setSearch(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all
            ${activeTab === 'panels'
              ? 'text-accent bg-accent-glow border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border-b-2 border-transparent'
            }`}
        >
          <Sun size={15} />
          Solar Panels ({panelCatalog.length})
        </button>
        <button
          onClick={() => { setActiveTab('inverters'); setSearch(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all
            ${activeTab === 'inverters'
              ? 'text-accent bg-accent-glow border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border-b-2 border-transparent'
            }`}
        >
          <Cpu size={15} />
          Inverters ({inverterCatalog.length})
        </button>
        <button
          onClick={() => { setActiveTab('batteries'); setSearch(''); }}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all
            ${activeTab === 'batteries'
              ? 'text-accent bg-accent-glow border-b-2 border-accent'
              : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover border-b-2 border-transparent'
            }`}
        >
          <Battery size={15} />
          Batteries ({batteryCatalog.length})
        </button>
      </div>

      {/* Unified Search Bar */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          placeholder={
            activeTab === 'bom'
              ? 'Search BOM categories (e.g. STRUCTURE, CABLE)...'
              : activeTab === 'panels'
              ? 'Search panel models (e.g. Adani, Waaree)...'
              : activeTab === 'inverters'
              ? 'Search inverter brands (e.g. Growatt, Deye)...'
              : 'Search batteries (e.g. Luminous, LFP)...'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/20 outline-none transition-all"
        />
      </div>

      {/* Table Containers */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-md shadow-black/10">
        
        {activeTab === 'bom' && (
          <SpreadsheetGrid table={bomTable} />
        )}

        {activeTab === 'panels' && (
          <SpreadsheetGrid table={panelTable} />
        )}

        {activeTab === 'inverters' && (
          <SpreadsheetGrid table={inverterTable} />
        )}

        {activeTab === 'batteries' && (
          <SpreadsheetGrid table={batteryTable} />
        )}

      </div>
    </div>
  );
}

// ─── Reusable Spreadsheet Grid Component ────────────────────────────────────────

interface SpreadsheetGridProps {
  table: any;
}

function SpreadsheetGrid({ table }: SpreadsheetGridProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        {table.getHeaderGroups().map((headerGroup: any) => (
          <tr key={headerGroup.id} className="bg-surface-hover/55 border-b border-border text-xs uppercase tracking-wider text-text-muted">
            {headerGroup.headers.map((header: any) => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={`px-4 py-3.5 font-bold group select-none text-left transition-colors
                  ${header.column.getCanSort() ? 'cursor-pointer hover:bg-surface-hover/80 hover:text-text-primary' : ''}`}
              >
                <div className="flex items-center gap-1.5">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {renderSortIndicator(header.column)}
                </div>
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row: any) => (
          <tr
            key={row.id}
            className="border-b border-border/40 transition-colors hover:bg-surface-hover/20"
          >
            {row.getVisibleCells().map((cell: any) => (
              <td key={cell.id} className="px-4 py-2.5 align-middle">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
        {table.getRowModel().rows.length === 0 && (
          <tr>
            <td colSpan={table.getVisibleFlatColumns().length} className="py-16 text-center text-sm text-text-muted">
              No matching records found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
