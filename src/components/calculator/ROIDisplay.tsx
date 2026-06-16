'use client';

import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ChevronDown, ChevronUp, Info, TrendingUp, DollarSign, Activity, Zap } from 'lucide-react';
import { calculateROI, ROIInputs, ROIResult, BASE_SUN_HOURS, MONTHLY_CORRECTION, DEGRADATION_RATE } from '@/lib/roi/roiCalculator';
import { formatINR } from '@/lib/engine/calculator';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { STATE_DATA } from '@/lib/data/masters';
import { SYSTEMS } from '@/lib/data/bom';
import { useSettings } from '@/lib/hooks/useSettings';

interface ROIDisplayProps {
  inputs: ROIInputs;
}

export function ROIDisplay({ inputs }: ROIDisplayProps) {
  // Calculate ROI data
  const roiData: ROIResult = calculateROI(inputs);

  // Generate Year 1 monthly data for the chart
  const corrections = MONTHLY_CORRECTION[inputs.location] || MONTHLY_CORRECTION['default'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const monthlyChartData = monthNames.map((month, idx) => {
    const monthlyDays = [31,28,31,30,31,30,31,31,30,31,30,31][idx];
    const monthlyGen = inputs.systemKw * BASE_SUN_HOURS * corrections[idx] * monthlyDays;
    return {
      month,
      generation: Math.round(monthlyGen)
    };
  });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <TrendingUp size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">Payback Period</span>
          </div>
          <div className="text-2xl font-bold text-accent">
            {roiData.paybackYear ? `${roiData.paybackYear} Years` : '> 25 Years'}
          </div>
        </div>
        
        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <DollarSign size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">Net Present Value</span>
          </div>
          <div className="text-2xl font-bold text-success">
            {formatINR(Math.round(roiData.npv))}
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <Activity size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">IRR</span>
          </div>
          <div className="text-2xl font-bold text-info">
            {roiData.irr.toFixed(1)}%
          </div>
        </div>

        <div className="bg-surface p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2 text-text-muted mb-2">
            <Zap size={18} />
            <span className="text-sm font-semibold uppercase tracking-wider">LCOE</span>
          </div>
          <div className="text-2xl font-bold text-warning">
            ₹{roiData.lcoe.toFixed(2)} <span className="text-sm font-normal text-text-muted">/kWh</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Generation Chart */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-border flex flex-col h-full">
          <h3 className="text-lg font-bold text-text-primary mb-6 shrink-0">Year 1 Monthly Generation (kWh)</h3>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10}
                />
                <YAxis 
                  tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} 
                  axisLine={false} 
                  tickLine={false} 
                />
                <Tooltip 
                  cursor={{ fill: 'var(--color-surface-hover)' }}
                  contentStyle={{ 
                    backgroundColor: 'var(--color-surface)', 
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Bar 
                  dataKey="generation" 
                  fill="var(--color-accent)" 
                  radius={[4, 4, 0, 0]} 
                  name="Generation (kWh)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-text-muted mt-4 text-center shrink-0">
            Note: Displays expected monsoon dips during Jun-Sep based on regional MNRE profiles.
          </p>
        </div>

        {/* Assumptions Box */}
        <div className="bg-surface p-6 rounded-xl border border-border flex flex-col h-[350px]">
          <h3 className="text-lg font-bold text-text-primary mb-4 shrink-0">
            Assumptions
          </h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-border">
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-secondary text-sm">Sun hours base</span>
              <span className="text-text-primary font-medium text-sm">{BASE_SUN_HOURS.toFixed(1)} / day</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-secondary text-sm">Location Correction</span>
              <span className="text-text-primary font-medium text-sm capitalize">{inputs.location} Profile</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-secondary text-sm">Annual Degradation</span>
              <span className="text-text-primary font-medium text-sm">{(DEGRADATION_RATE * 100).toFixed(1)}% / year</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-secondary text-sm">Electricity Escalation</span>
              <span className="text-text-primary font-medium text-sm">{inputs.electricityEscalation}% / year</span>
            </div>
            <div className="flex justify-between border-b border-border pb-2">
              <span className="text-text-secondary text-sm">Discount Rate (NPV)</span>
              <span className="text-text-primary font-medium text-sm">{inputs.discountRate}%</span>
            </div>
            
            <div className="bg-info/10 text-info p-3 rounded-lg flex items-start gap-2 mt-4 text-xs font-medium">
              <Info size={16} className="shrink-0 mt-0.5" />
              <p>Actual generation may vary ±15% based on shading, soiling, and orientation.</p>
            </div>
          </div>
          
        </div>
      </div>

      {/* 25-Year Projection Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border bg-surface-active">
          <h3 className="text-lg font-bold text-text-primary">25-Year Financial Projection</h3>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="sticky top-0 bg-surface-hover shadow-sm z-10">
              <tr className="text-text-muted uppercase tracking-wider text-xs font-bold">
                <th className="px-6 py-4">Year</th>
                <th className="px-6 py-4 text-right">Generation (kWh)</th>
                <th className="px-6 py-4 text-right">Net Savings</th>
                <th className="px-6 py-4 text-right">Cumulative Savings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {roiData.yearlyData.map((row) => {
                const isPaybackYear = row.year === roiData.paybackYear;
                return (
                  <tr 
                    key={row.year} 
                    className={`hover:bg-surface-hover transition-colors ${isPaybackYear ? 'bg-success/5 border-l-4 border-l-success' : ''}`}
                  >
                    <td className={`px-6 py-3 font-medium ${isPaybackYear ? 'text-success' : 'text-text-primary'}`}>
                      {isPaybackYear ? `Year ${row.year} (Payback)` : `Year ${row.year}`}
                    </td>
                    <td className="px-6 py-3 text-right text-text-secondary">{row.annualGeneration.toLocaleString()}</td>
                    <td className="px-6 py-3 text-right text-text-secondary">{formatINR(row.netSavings)}</td>
                    <td className={`px-6 py-3 text-right font-medium ${isPaybackYear ? 'text-success' : 'text-text-primary'}`}>
                      {formatINR(row.cumulativeSavings)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ConnectedROIDisplay() {
  const { settings } = useSettings();
  const selectedState = useCalculatorStore((s) => s.selectedState);
  const electricityInflationRate = useCalculatorStore((s) => s.electricityInflationRate);
  const calcResult = useCalculatorStore((s) => s.calcResult);
  
  if (!calcResult || calcResult.capacityKW <= 0) return null;

  const systemKw = calcResult.capacityKW;

  const electricityRatePerUnit = calcResult.annualGenerationKWh > 0 ? (calcResult.annualSavingsINR / calcResult.annualGenerationKWh) : 8;
  
  const location = selectedState.toLowerCase();

  const inputs: ROIInputs = {
    systemKw,
    systemCost: calcResult.finalCustomerPrice || calcResult.mrpInclGST,
    electricityRatePerUnit,
    electricityEscalation: electricityInflationRate,
    discountRate: 8,
    location,
    systemLifeYears: 25,
    maintenanceCostPerYear: 1500,
  };

  return <ROIDisplay inputs={inputs} />;
}
