'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, X, Star, Keyboard, Shield } from 'lucide-react';
import { Button } from '../ui/Button';

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const tourDone = window.localStorage.getItem('enermass_onboarding_completed');
      if (!tourDone) {
        setIsOpen(true);
      }
    }
  }, []);

  const handleFinish = () => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem('enermass_onboarding_completed', 'true');
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const tourSteps = [
    {
      title: 'Welcome to EnerMass Solar Pricing',
      description: 'Your enterprise-grade platform for system designs, Bill of Materials (BOM) estimation, and accounts management.',
      icon: <Sparkles className="text-accent w-10 h-10 animate-bounce" />
    },
    {
      title: 'Global Command Palette (⌘K)',
      description: 'Access any page, search catalog masters, or trigger actions from anywhere instantly using the Ctrl+K / Cmd+K hotkey.',
      icon: <Keyboard className="text-accent w-10 h-10" />
    },
    {
      title: 'Materialized Executive Analytics',
      description: 'Review margins, accounts aging ledgers, and logistics. Filter by date ranges and bookmark favorites for quick reference.',
      icon: <Star className="text-accent w-10 h-10 fill-accent/20" />
    },
    {
      title: 'Cryptographic Device Protection',
      description: 'Your sessions are bound securely via hardware signatures to prevent unauthorized account takeovers and direct breaches.',
      icon: <Shield className="text-accent w-10 h-10" />
    }
  ];

  const currentStepData = tourSteps[step - 1];

  return (
    <div className="fixed inset-0 z-modal-backdrop flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm animate-fade-in no-print">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md flex flex-col p-6 space-y-6 animate-scale-in"
      >
        {/* Tour progress header */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-accent font-bold uppercase tracking-wider text-[10px]">Guided Tour · Step {step} of {tourSteps.length}</span>
          <button 
            onClick={handleFinish}
            className="text-text-muted hover:text-text-primary p-0.5 rounded transition-colors"
            aria-label="Skip tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tour graphic / icon */}
        <div className="flex justify-center py-4 bg-background/50 rounded-xl border border-border/40">
          {currentStepData.icon}
        </div>

        {/* Text descriptions */}
        <div className="space-y-2 text-center">
          <h2 id="tour-title" className="text-base font-bold text-text-primary tracking-wide">{currentStepData.title}</h2>
          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">{currentStepData.description}</p>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1.5 py-1">
          {tourSteps.map((_, idx) => (
            <span 
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300
                ${idx + 1 === step ? 'w-5 bg-accent' : 'w-1.5 bg-border'}`}
            />
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between gap-3 pt-2">
          <Button variant="outline" onClick={handleFinish} className="text-xs py-1.5">
            Skip Tour
          </Button>
          
          {step < tourSteps.length ? (
            <Button onClick={() => setStep(prev => prev + 1)} className="text-xs py-1.5 flex items-center gap-1">
              Next Step <ArrowRight size={13} />
            </Button>
          ) : (
            <Button onClick={handleFinish} className="text-xs py-1.5">
              Get Started
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
