'use client';

import { useState } from 'react';
import { Search, Plus, Filter, Users } from 'lucide-react';

const MOCK_LEADS = [
  { id: 'LD-001', name: 'John Doe', company: 'JD Enterprises', status: 'New', source: 'Website', value: '₹12L' },
  { id: 'LD-002', name: 'Acme Corp', company: 'Acme Corp', status: 'Contacted', source: 'Referral', value: '₹45L' },
  { id: 'LD-003', name: 'Smith Retail', company: 'Smith Retail', status: 'Qualified', source: 'Exhibition', value: '₹22L' },
];

export default function CRMLeadsPage() {
  const [search, setSearch] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">CRM Leads</h1>
          <p className="text-sm text-text-muted mt-1">Manage and track potential customers</p>
        </div>
        <button onClick={() => setShowAddLead(true)} className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-light transition-colors">
          <Plus size={16} /> Add Lead
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-primary focus:border-accent/50 outline-none"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface border border-border text-sm text-text-secondary hover:text-text-primary">
          <Filter size={16} /> Filter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {['New', 'Contacted', 'Qualified', 'Proposal'].map(status => (
          <div key={status} className="bg-surface/50 border border-border rounded-xl p-4 min-h-[300px]">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center justify-between">
              {status}
              <span className="bg-surface-hover text-xs px-2 py-0.5 rounded-full">{MOCK_LEADS.filter(l => l.status === status).length}</span>
            </h3>
            <div className="space-y-3">
              {MOCK_LEADS.filter(l => l.status === status).map(lead => (
                <div key={lead.id} className="bg-surface border border-border p-3 rounded-lg hover:border-accent/50 cursor-pointer transition-colors shadow-sm">
                  <div className="font-medium text-text-primary text-sm">{lead.company}</div>
                  <div className="text-xs text-text-secondary mt-1">{lead.name}</div>
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-accent font-medium">{lead.value}</span>
                    <span className="text-text-muted">{lead.source}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showAddLead && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6 animate-fade-in shadow-2xl">
            <h2 className="text-xl font-bold text-text-primary mb-4">Add New Lead</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Customer Name</label>
                <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:border-accent outline-none" placeholder="Enter name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Company</label>
                <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:border-accent outline-none" placeholder="Enter company" />
              </div>
              
              <div className="pt-2 border-t border-border">
                <h3 className="text-sm font-semibold text-text-primary mb-3">Marketing Attribution</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Source</label>
                    <select className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:border-accent outline-none">
                      <option>Organic</option>
                      <option>Referral</option>
                      <option>Facebook Ads</option>
                      <option>Google Ads</option>
                      <option>Exhibition</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Campaign Tag</label>
                    <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:border-accent outline-none" placeholder="e.g. Summer_Sale" />
                  </div>
                </div>
                
                <div className="mt-3">
                  <label className="block text-xs font-medium text-text-secondary mb-1">UTM Parameters (Optional)</label>
                  <div className="flex gap-2">
                    <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary focus:border-accent outline-none" placeholder="utm_source" />
                    <input type="text" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-text-primary focus:border-accent outline-none" placeholder="utm_medium" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setShowAddLead(false)} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary">Cancel</button>
              <button onClick={() => setShowAddLead(false)} className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-light transition-colors">Save Lead</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
