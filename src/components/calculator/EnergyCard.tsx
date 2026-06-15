'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Select } from '@/components/ui/Select';
import { AlertTriangle } from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { STATE_DATA, getActiveBatteryBrands } from '@/lib/data/masters';
import { formatINR } from '@/lib/engine/calculator';
import { useSettings } from '@/lib/hooks/useSettings';

// Seasonal variation factors (derived from real Indian solar irradiance patterns)
const SEASONAL_FACTORS = [0.85, 0.88, 0.95, 1.05, 1.10, 1.05, 0.95, 0.98, 1.02, 1.00, 0.92, 0.85];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEGRADATION_RATE = 0.005; // 0.5% per year panel degradation
const LIFETIME_YEARS = 25;
const BATTERY_DOD = 0.80; // 80% depth of discharge (conservative for LFP)
const INVERTER_EFFICIENCY = 0.93; // Typical inverter efficiency during discharge

export function EnergyCard() {
  const calcResult = useCalculatorStore((s) => s.calcResult);
  const selectedState = useCalculatorStore((s) => s.selectedState);
  const selectedBatteryMix = useCalculatorStore((s) => s.selectedBatteryMix);
  const backupLoadW = useCalculatorStore((s) => s.backupLoadW);
  const setBackupLoadW = useCalculatorStore((s) => s.setBackupLoadW);
  const orientation = useCalculatorStore((s) => s.orientation);
  const setOrientation = useCalculatorStore((s) => s.setOrientation);
  const electricityInflationRate = useCalculatorStore((s) => s.electricityInflationRate);
  const setElectricityInflationRate = useCalculatorStore((s) => s.setElectricityInflationRate);
  const { settings } = useSettings();

  // Local slider state — only commit to store on release
  const [localSlider, setLocalSlider] = useState<number | null>(null);
  const displayLoadW = localSlider ?? backupLoadW;

  const commitSlider = useCallback(() => {
    if (localSlider !== null) {
      setBackupLoadW(localSlider);
      setLocalSlider(null);
    }
  }, [localSlider, setBackupLoadW]);

  const allBatteries = useMemo(() => getActiveBatteryBrands(settings), [settings]);

  const totalBatteryCapacityKWh = useMemo(() => {
    const batteryById = new Map(allBatteries.map((battery) => [battery.id, battery]));
    return Object.entries(selectedBatteryMix).reduce((sum, [batteryId, qty]) => {
      const battery = batteryById.get(batteryId);
      if (!battery || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + battery.capacityKWh * qty;
    }, 0);
  }, [allBatteries, selectedBatteryMix]);

  const maxDischargeKW = useMemo(() => {
    const batteryById = new Map(allBatteries.map((battery) => [battery.id, battery]));
    return Object.entries(selectedBatteryMix).reduce((sum, [batteryId, qty]) => {
      const battery = batteryById.get(batteryId);
      if (!battery || !Number.isFinite(qty) || qty <= 0) return sum;
      return sum + (('maxDischargeKW' in battery && typeof battery.maxDischargeKW === 'number') ? battery.maxDischargeKW : (battery.capacityKWh * 0.5)) * qty;
    }, 0);
  }, [allBatteries, selectedBatteryMix]);

  const isLoadTooHigh = maxDischargeKW > 0 && (displayLoadW / 1000) > maxDischargeKW;

  // Usable capacity = Total × DoD × Inverter efficiency
  const usableCapacityKWh = totalBatteryCapacityKWh * BATTERY_DOD * INVERTER_EFFICIENCY;
  const activeLoadW = displayLoadW;
  const backupHours = activeLoadW > 0 ? usableCapacityKWh / (activeLoadW / 1000) : 0;

  const dbStateData = useCalculatorStore((s) => s.dbStateData);
  const stateData = dbStateData[selectedState];

  if (!calcResult) return null;

  if (!stateData) {
    return (
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-lg shadow-black/20 flex flex-col items-center justify-center p-8 text-center h-[300px]" id="energy-card">
        <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">Energy & Returns</h3>
        <p className="text-text-muted text-sm max-w-[250px]">Select an installation state to view generation metrics and ROI projections.</p>
      </div>
    );
  }

  const lifetimeSavings = calcResult.lifetimeSavingsINR;

  // Monthly breakdown for chart
  const baseMonthlyGen = calcResult.annualGenerationKWh / 12;
  const chartData = SEASONAL_FACTORS.map((factor, i) => ({
    month: MONTH_LABELS[i],
    gen: Math.round(baseMonthlyGen * factor),
  }));
  
  const maxGen = Math.max(...chartData.map(d => d.gen));

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-lg shadow-black/20" id="energy-card">
      <div className="px-5 py-4 border-b border-border bg-surface-active flex items-center justify-between">
        <h3 className="text-xs font-bold text-text-primary tracking-widest uppercase">Energy & Returns</h3>
      </div>

      <div className="p-5 space-y-6">
        {/* Context Info */}
        <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-background border border-border">
          <InfoBox label="State" value={selectedState} />
          <InfoBox label="Sun Hours" value={`${stateData.sunHoursPerDay} h/day`} />
          <InfoBox label="PR" value={`${(stateData.performanceRatio * 100).toFixed(0)}%`} />
        </div>

        {/* Site & Financial Config */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">Roof Orientation</label>
            <Select
              value={orientation}
              onChange={(v) => setOrientation(v as any)}
              options={[
                { value: 'South', label: 'South', hint: '100% Yield' },
                { value: 'East/West', label: 'East / West', hint: '~85% Yield' },
                { value: 'Flat', label: 'Flat', hint: '~90% Yield' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-semibold text-text-muted uppercase tracking-wider">Utility Inflation / Yr</label>
            <Select
              value={String(electricityInflationRate)}
              onChange={(v) => setElectricityInflationRate(parseFloat(v))}
              options={[
                { value: '0', label: '0%' },
                { value: '0.02', label: '2%' },
                { value: '0.04', label: '4%' },
                { value: '0.06', label: '6%' },
              ]}
            />
          </div>
        </div>

        {/* Backup Load Control — slider commits only on release */}
        <div className="p-4 rounded-xl border border-border bg-background space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">Backup Load</div>
              <div className="text-xs text-text-secondary">Set the expected load to estimate battery backup duration.</div>
            </div>
            <div className="text-sm font-mono font-semibold text-accent tabular-nums">
              {displayLoadW.toLocaleString('en-IN')} W
            </div>
          </div>
          <div className="space-y-2">
            <input
              type="range"
              min={100}
              max={10000}
              step={50}
              value={displayLoadW}
              onChange={(e) => setLocalSlider(parseInt(e.target.value, 10))}
              onPointerUp={commitSlider}
              onTouchEnd={commitSlider}
              className="w-full h-1.5 rounded-full appearance-none bg-border 
                [&::-webkit-slider-thumb]:appearance-none 
                [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent 
                [&::-webkit-slider-thumb]:cursor-pointer 
                [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-accent/30 
                cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
              <span>100 W</span>
              <span>10,000 W</span>
            </div>
          </div>

          {/* Live backup result */}
          {totalBatteryCapacityKWh > 0 && (
            <div className="mt-2 p-3 rounded-lg border border-accent/20 bg-accent-glow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-text-muted uppercase tracking-wider">Estimated Backup</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {usableCapacityKWh.toFixed(1)} kWh usable ({(BATTERY_DOD * 100).toFixed(0)}% DoD × {(INVERTER_EFFICIENCY * 100).toFixed(0)}% inv. eff.)
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-mono font-bold ${backupHours >= 4 ? 'text-success' : backupHours >= 1 ? 'text-warning' : 'text-error'}`}>
                    {backupHours >= 1 ? `${Math.floor(backupHours)}h ${Math.round((backupHours % 1) * 60)}m` : `${Math.round(backupHours * 60)}m`}
                  </div>
                  <div className="text-[10px] text-text-muted">at {displayLoadW.toLocaleString('en-IN')} W</div>
                </div>
              </div>
              {isLoadTooHigh && (
                <div className="mt-2 text-[10px] text-error font-medium bg-error/10 px-2 py-1 rounded">
                  <AlertTriangle size={12} className="inline mr-1" /> Load exceeds continuous battery discharge rate ({maxDischargeKW.toFixed(1)} kW). System will trip.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetricBox label="Daily Generation" value={`${calcResult.dailyGenerationKWh.toFixed(1)} kWh`} />
          <MetricBox label="Monthly Gen." value={`${Math.round(calcResult.monthlyGenerationKWh)} kWh`} />
          <MetricBox label="Annual Gen." value={`${Math.round(calcResult.annualGenerationKWh).toLocaleString()} kWh`} />
          <MetricBox label="Monthly Savings" value={formatINR(calcResult.monthlySavingsINR)} success />
          <MetricBox label="Annual Savings" value={formatINR(calcResult.annualSavingsINR)} success />
          <MetricBox
            label="Backup Time"
            value={activeLoadW > 0 && totalBatteryCapacityKWh > 0 ? `${backupHours.toFixed(1)} hrs` : '—'}
            success={backupHours >= 4}
          />
          <MetricBox
            label="Battery Capacity"
            value={`${totalBatteryCapacityKWh.toFixed(1)} kWh`}
          />
        </div>

        {totalBatteryCapacityKWh === 0 && (
          <div className="p-3 rounded-xl border border-warning/30 bg-warning/5 text-xs text-warning">
            No batteries selected. Add batteries in the Equipment tab to see backup time estimates.
          </div>
        )}

        {/* Lifetime Highlight */}
        <div className="p-4 rounded-xl border border-success/30 bg-success/5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-success/80 uppercase tracking-wider">Lifetime Savings (25 yrs)</div>
            <div className="text-[10px] text-text-muted mt-0.5">Includes {electricityInflationRate * 100}%/yr utility inflation & degradation</div>
          </div>
          <div className="text-xl font-mono font-bold text-success">
            {formatINR(lifetimeSavings)}
          </div>
        </div>


      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-20">
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xs font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function MetricBox({ label, value, success, accent }: { label: string; value: string; success?: boolean; accent?: boolean }) {
  return (
    <div className="p-3 rounded-lg border border-border bg-surface-hover/50 transition-colors hover:border-border-light">
      <div className="text-[10px] text-text-secondary uppercase tracking-wider mb-1.5">{label}</div>
      <div className={`text-sm font-mono font-semibold tabular-nums ${
        success ? 'text-success' : accent ? 'text-accent' : 'text-text-primary'
      }`}>
        {value}
      </div>
    </div>
  );
}
