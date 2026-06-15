'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useConfirm } from '@/components/ui/Confirm';
import {
  ClipboardList,
  Save,
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface BOMItem {
  id: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  originalQuantity: number;
}

const INITIAL_BOM: BOMItem[] = [
  { id: '1', category: 'Modules', description: '550W Mono PERC Solar Panels', quantity: 28, originalQuantity: 28, unit: 'Nos', unitPrice: 12500 },
  { id: '2', category: 'Inverter', description: '15kW String Inverter', quantity: 1, originalQuantity: 1, unit: 'Nos', unitPrice: 85000 },
  { id: '3', category: 'Structure', description: 'GI Mounting Structure (Standard)', quantity: 15, originalQuantity: 15, unit: 'kW', unitPrice: 3500 },
  { id: '4', category: 'Cables', description: 'DC Cable 4sqmm', quantity: 100, originalQuantity: 80, unit: 'm', unitPrice: 45 }, // Adjusted quantity
  { id: '5', category: 'Civil', description: 'Concrete blocks for flat roof', quantity: 30, originalQuantity: 0, unit: 'Nos', unitPrice: 150 }, // New item
];

export default function BOMAdjustmentPage() {
  const router = useRouter();
  const confirm = useConfirm();
  const [items, setItems] = useState<BOMItem[]>(INITIAL_BOM);
  const [notes, setNotes] = useState('');

  const handleQuantityChange = (id: string, newQuantity: number) => {
    setItems(items.map(item => item.id === id ? { ...item, quantity: newQuantity } : item));
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    const newItem: BOMItem = {
      id: Date.now().toString(),
      category: 'Misc',
      description: 'New Component',
      quantity: 1,
      originalQuantity: 0,
      unit: 'Nos',
      unitPrice: 0,
    };
    setItems([...items, newItem]);
  };

  const handleSave = async () => {
    const confirmed = await confirm({
      title: 'Save BOM Adjustment',
      message: 'Are you sure you want to finalize these adjustments? This will update the project costing.',
      confirmLabel: 'Save Adjustments',
      cancelLabel: 'Cancel',
    });

    if (confirmed) {
      console.log('Saved BOM:', items);
      router.push('/quotes');
    }
  };

  const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const originalCost = items.reduce((sum, item) => sum + (item.originalQuantity * item.unitPrice), 0);
  const costDiff = totalCost - originalCost;

  return (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">Post-Survey BOM Adjustment</h1>
              <Badge variant="warning">Draft</Badge>
            </div>
            <p className="text-sm text-text-muted mt-1">Project: PRJ-2026-042 • Survey Completed: June 12, 2026</p>
          </div>
        </div>
        <Button variant="primary" icon={<Save size={16} />} onClick={handleSave}>
          Finalize Adjustment
        </Button>
      </div>

      {costDiff > 0 && (
        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="text-warning mt-0.5" size={20} />
          <div>
            <h4 className="text-warning-dark font-bold text-sm">Cost Increase Detected</h4>
            <p className="text-text-secondary text-sm mt-1">
              Adjustments have increased the base BOM cost by <span className="font-bold">₹{costDiff.toLocaleString('en-IN')}</span>. 
              This may affect the project margin.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="text-accent" size={20} />
            Bill of Materials
          </CardTitle>
          <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={handleAddItem}>
            Add Item
          </Button>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-semibold text-text-muted">Category</th>
                <th className="px-4 py-3 font-semibold text-text-muted w-1/3">Description</th>
                <th className="px-4 py-3 font-semibold text-text-muted text-center">Original Qty</th>
                <th className="px-4 py-3 font-semibold text-text-muted text-center w-32">Adjusted Qty</th>
                <th className="px-4 py-3 font-semibold text-text-muted">Unit</th>
                <th className="px-4 py-3 font-semibold text-text-muted text-right">Unit Price</th>
                <th className="px-4 py-3 font-semibold text-text-muted text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-text-muted text-center"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isChanged = item.quantity !== item.originalQuantity;
                return (
                  <tr key={item.id} className={`border-b border-border/50 ${isChanged ? 'bg-accent/5' : ''}`}>
                    <td className="px-4 py-3 text-text-secondary">{item.category}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{item.description}</td>
                    <td className="px-4 py-3 text-center text-text-muted">{item.originalQuantity}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                        className={`w-full text-center bg-background border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 ${
                          isChanged ? 'border-accent text-accent font-bold' : 'border-border text-text-primary'
                        }`}
                        min={0}
                      />
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{item.unit}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{item.unitPrice.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 rounded-md hover:bg-error/10 text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-hover font-bold">
                <td colSpan={6} className="px-4 py-4 text-right text-text-primary">Total Estimated Cost:</td>
                <td className="px-4 py-4 text-right text-accent font-mono text-lg">₹{totalCost.toLocaleString('en-IN')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Survey Notes & Justification</CardTitle>
        </CardHeader>
        <div className="p-1">
          <textarea
            className="w-full bg-background border border-border rounded-lg p-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 min-h-[100px]"
            placeholder="Explain the reason for BOM adjustments (e.g., 'Extra cable required due to longer routing path discovered during site survey...')"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </Card>
    </div>
  );
}
