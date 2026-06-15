'use client';

import { useState } from 'react';
import { Upload, Download, Save, FileSpreadsheet, Search } from 'lucide-react';

const MOCK_INVENTORY = [
  { sku: 'PNL-540W', name: '540W Monocrystalline Panel', category: 'Panels', currentPrice: 12500, newPrice: 12500, stock: 145 },
  { sku: 'INV-5KW', name: '5kW String Inverter', category: 'Inverters', currentPrice: 45000, newPrice: 45000, stock: 23 },
  { sku: 'MNT-RCH', name: 'Roof Mount Channel (3m)', category: 'Mounting', currentPrice: 850, newPrice: 850, stock: 890 },
  { sku: 'CBL-DC-4', name: '4 sqmm DC Cable (Roll)', category: 'Cables', currentPrice: 3200, newPrice: 3200, stock: 45 },
];

export default function BulkUpdatePage() {
  const [items, setItems] = useState(MOCK_INVENTORY);
  const [search, setSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handlePriceChange = (sku: string, value: string) => {
    const num = parseInt(value, 10);
    setItems(items.map(item => item.sku === sku ? { ...item, newPrice: isNaN(num) ? 0 : num } : item));
  };

  const changedCount = items.filter(i => i.currentPrice !== i.newPrice).length;

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Bulk Price Update</h1>
          <p className="text-sm text-text-muted mt-1">Update prices across your inventory items</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors font-medium text-sm">
            <Download size={16} /> Export Template
          </button>
          <button 
            onClick={() => setIsUploading(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-surface-hover transition-colors font-medium text-sm"
          >
            <Upload size={16} /> Import Excel
          </button>
          <button 
            disabled={changedCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-light transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} /> Save Changes {changedCount > 0 && `(${changedCount})`}
          </button>
        </div>
      </div>

      {isUploading && (
        <div className="p-8 border-2 border-dashed border-border rounded-xl bg-surface/50 text-center flex flex-col items-center justify-center mb-6">
          <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
            <FileSpreadsheet size={24} />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Upload Price File</h3>
          <p className="text-sm text-text-muted mb-4 max-w-md">Drag and drop your updated Excel template here or click to browse. Ensure sku and price columns match the template.</p>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg">Select File</button>
            <button onClick={() => setIsUploading(false)} className="px-4 py-2 bg-surface border border-border text-text-secondary text-sm font-medium rounded-lg hover:text-text-primary">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex gap-4 bg-background/50">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Search SKU or Product Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary focus:border-accent/50 outline-none"
            />
          </div>
          <div className="flex items-center text-sm text-text-muted px-2">
            {items.length} items total
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-hover/50 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted w-32">SKU</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Product Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted">Category</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted w-32">Current Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted w-40">New Price (₹)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-muted w-24">Change</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.toLowerCase().includes(search.toLowerCase())).map((item) => {
                const diff = item.newPrice - item.currentPrice;
                const diffPercent = item.currentPrice > 0 ? (diff / item.currentPrice) * 100 : 0;
                
                return (
                  <tr key={item.sku} className="border-b border-border/50 hover:bg-surface-hover/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">{item.sku}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">{item.name}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      <span className="px-2 py-1 bg-surface-hover rounded-md text-[10px] uppercase tracking-wider">{item.category}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">₹{item.currentPrice.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={item.newPrice}
                        onChange={(e) => handlePriceChange(item.sku, e.target.value)}
                        className={`w-full text-right px-3 py-1.5 rounded bg-background border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-accent ${
                          item.newPrice !== item.currentPrice 
                            ? 'border-accent text-accent bg-accent/5' 
                            : 'border-border text-text-primary'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {diff !== 0 ? (
                        <span className={`text-xs font-medium ${diff > 0 ? 'text-success' : 'text-error'}`}>
                          {diff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
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
