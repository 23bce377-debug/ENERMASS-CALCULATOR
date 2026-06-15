import { useState } from 'react';
import { X, Search, Plus, Layers, Zap, Battery, Gauge, Construction } from 'lucide-react';
import { useCalculatorStore } from '@/lib/store/calculatorStore';
import { TAX_CONSTANTS } from '@/lib/tax-constants';

interface CatalogItem {
  name: string;
  category: string;
  cost: number;
  gst: number;
  unit: string;
}

interface CatalogPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: CatalogItem) => void;
}

export default function CatalogPickerModal({ isOpen, onClose, onSelect }: CatalogPickerModalProps) {
  const [activeTab, setActiveTab] = useState<'panels' | 'inverters' | 'batteries' | 'meters' | 'structures'>('panels');
  const [searchQuery, setSearchQuery] = useState('');

  const dbPanels = useCalculatorStore(s => s.dbPanels);
  const dbInverters = useCalculatorStore(s => s.dbInverters);
  const dbBatteries = useCalculatorStore(s => s.dbBatteries);
  const dbMeters = useCalculatorStore(s => s.dbMeters);
  const dbStructures = useCalculatorStore(s => s.dbStructures);

  if (!isOpen) return null;

  // Filter lists based on search
  const filteredPanels = dbPanels.filter(p => 
    `${p.brand} ${p.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(p => ({
    name: `${p.brand} ${p.model} ${p.wattage || ''}W Panel`,
    category: 'solar_panels',
    cost: Number(p.ratePerWatt || 0) * Number(p.wattage || 1),
    gst: Number(p.gst_pct || TAX_CONSTANTS.RESIDENTIAL_GST_RATE),
    unit: 'Nos'
  }));

  const filteredInverters = dbInverters.filter(inv => 
    `${inv.brand} ${inv.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(inv => ({
    name: `${inv.brand} ${inv.model} ${inv.capacityKW || ''}kW Inverter`,
    category: 'power_electronics',
    cost: Number(inv.rate || 0),
    gst: Number(inv.gst_pct || 0.12),
    unit: 'Nos'
  }));

  const filteredBatteries = dbBatteries.filter(bat => 
    `${bat.brand} ${bat.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(bat => ({
    name: `${bat.brand} ${bat.model} ${bat.capacityKWh || ''}kWh Battery`,
    category: 'power_electronics',
    cost: Number(bat.rate || 0),
    gst: Number(bat.gst_pct || 0.12),
    unit: 'Nos'
  }));

  const filteredMeters = dbMeters.filter(m => 
    `${m.brand} ${m.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(m => ({
    name: `${m.meter_type === 'solar_meter' ? 'Solar' : 'Net'} Meter ${m.brand || ''} ${m.model || ''}`,
    category: 'metering',
    cost: Number(m.rate || 0),
    gst: Number(m.gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE),
    unit: 'Nos'
  }));

  const filteredStructures = dbStructures.filter(st => 
    `${st.name} ${st.material}`.toLowerCase().includes(searchQuery.toLowerCase())
  ).map(st => ({
    name: `${st.name} Structure (${st.material || ''})`,
    category: 'mounting_structure',
    cost: Number(st.flat_rate || 0),
    gst: Number(st.gst_pct || TAX_CONSTANTS.COMMERCIAL_GST_RATE),
    unit: 'Set'
  }));

  let currentItems: CatalogItem[] = [];
  if (activeTab === 'panels') currentItems = filteredPanels;
  if (activeTab === 'inverters') currentItems = filteredInverters;
  if (activeTab === 'batteries') currentItems = filteredBatteries;
  if (activeTab === 'meters') currentItems = filteredMeters;
  if (activeTab === 'structures') currentItems = filteredStructures;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-slide-up flex flex-col h-[80vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Layers size={20} className="text-accent" />
            Browse Component Database
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-56 border-r border-border bg-surface-hover/20 flex flex-col p-3 space-y-1 overflow-y-auto">
            <button
              onClick={() => setActiveTab('panels')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer
                ${activeTab === 'panels' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <Zap size={16} /> Solar Panels
            </button>
            <button
              onClick={() => setActiveTab('inverters')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer
                ${activeTab === 'inverters' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <Zap size={16} /> Inverters
            </button>
            <button
              onClick={() => setActiveTab('batteries')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer
                ${activeTab === 'batteries' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <Battery size={16} /> Batteries
            </button>
            <button
              onClick={() => setActiveTab('meters')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer
                ${activeTab === 'meters' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <Gauge size={16} /> Meters
            </button>
            <button
              onClick={() => setActiveTab('structures')}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors cursor-pointer
                ${activeTab === 'structures' ? 'bg-accent text-background shadow-md shadow-accent/15' : 'text-text-secondary hover:bg-surface hover:text-text-primary'}`}
            >
              <Construction size={16} /> Structures
            </button>
          </div>

          {/* Main Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-background/50">
            {/* Search */}
            <div className="p-4 border-b border-border shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input
                  type="text"
                  placeholder="Search database..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary outline-none focus:border-accent/50 transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {currentItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-text-muted">
                  <Search size={32} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No components found</p>
                </div>
              ) : (
                currentItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface hover:border-accent/50 transition-colors group"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{item.name}</h4>
                      <p className="text-xs text-text-muted mt-1 uppercase tracking-wider font-bold">
                        {item.category.replace('_', ' ')} • ₹{item.cost.toLocaleString('en-IN')} ({(item.gst * 100).toFixed(0)}% GST)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-bold hover:bg-accent hover:text-background transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <Plus size={14} /> Add to Bundle
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
