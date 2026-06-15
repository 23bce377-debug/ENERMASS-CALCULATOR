'use client';

import { useState } from 'react';
import { Camera, MapPin, Clock, ChevronRight } from 'lucide-react';

const MOCK_SURVEYS = [
  { id: 'SRV-001', customer: 'Ramesh Patel', address: '14 MG Road, Bangalore', status: 'Pending', time: '10:00 AM' },
  { id: 'SRV-002', customer: 'Suresh Kumar', address: 'Tech Park, Whitefield', status: 'In Progress', time: '02:00 PM' },
];

export default function MobileSurveyApp() {
  const [activeTab, setActiveTab] = useState<'today' | 'completed'>('today');

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col max-w-md mx-auto border-x border-border shadow-2xl relative">
      <header className="px-5 py-6 bg-surface shadow-sm sticky top-0 z-10 rounded-b-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Field Survey</h1>
            <p className="text-sm text-text-muted mt-1 font-medium">Hello, Engineer</p>
          </div>
          <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent">
            <span className="font-bold">FE</span>
          </div>
        </div>
      </header>
      
      <div className="flex p-4">
        <div className="flex bg-surface/50 border border-border rounded-xl p-1 w-full">
          <button 
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'today' ? 'bg-surface text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Today's Tasks
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === 'completed' ? 'bg-surface text-accent shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Completed
          </button>
        </div>
      </div>

      <main className="flex-1 p-4 pt-0 space-y-4 overflow-y-auto pb-24">
        {MOCK_SURVEYS.map(survey => (
          <div key={survey.id} className="bg-surface border border-border rounded-2xl p-5 shadow-sm active:scale-[0.98] transition-transform cursor-pointer">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-mono font-bold text-accent px-2 py-1 bg-accent/5 rounded-md">{survey.id}</span>
              <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                <Clock size={12} /> {survey.status}
              </span>
            </div>
            <h3 className="font-bold text-text-primary text-xl mb-1">{survey.customer}</h3>
            <div className="flex items-start gap-2 text-sm text-text-secondary mt-3">
              <MapPin size={16} className="mt-0.5 flex-shrink-0 text-text-muted" />
              <p className="leading-snug">{survey.address}</p>
            </div>
            <div className="mt-5 pt-4 border-t border-border/50 flex justify-between items-center">
              <div className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Clock size={14} className="text-text-muted" /> {survey.time}
              </div>
              <button className="flex items-center gap-1 text-sm text-white bg-accent px-4 py-2 rounded-lg font-semibold hover:bg-accent-light transition-colors shadow-sm shadow-accent/20">
                Start <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </main>

      {/* Floating Action Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background to-transparent pt-12 pointer-events-none">
        <button className="w-full flex items-center justify-center gap-2 py-4 bg-surface border-2 border-dashed border-border text-text-secondary rounded-2xl pointer-events-auto hover:border-accent hover:text-accent transition-colors font-semibold shadow-lg">
          <Camera size={20} /> Quick Capture
        </button>
      </div>
    </div>
  );
}
